"""Regression checks for the exported OutfitAI training pipeline."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.model_selection import GroupKFold
from sklearn.neighbors import KNeighborsRegressor
from sklearn.preprocessing import OneHotEncoder, StandardScaler


ROOT = Path(__file__).resolve().parents[1]
MODEL_PATH = ROOT / "model" / "outfit_model.joblib"
METADATA_PATH = ROOT / "model" / "model_metadata.json"
WORKBOOK_PATH = ROOT / "data" / "DatasetDSS.xlsx"
CHARTS = (
    ROOT / "model" / "charts" / "mae_comparison.png",
    ROOT / "model" / "charts" / "actual_vs_predicted.png",
    ROOT / "model" / "charts" / "feature_importance.png",
)


def load_metadata() -> dict[str, object]:
    with METADATA_PATH.open("r", encoding="utf-8") as stream:
        return json.load(stream)


def test_model_metadata_has_exact_nine_features_and_required_fields() -> None:
    metadata = load_metadata()
    features = metadata["features"]
    assert len(features) == 9
    assert features == metadata["categorical_features"] + metadata["numeric_features"]
    assert metadata["target"] not in features
    assert not any(name.startswith("Bước") or name == "Tập" for name in features)
    for key in (
        "model_name",
        "version",
        "trained_at",
        "python_version",
        "sklearn_version",
        "categories",
        "feature_ranges",
        "metrics_test",
        "hybrid_weight",
        "best_k",
        "baseline_mae",
        "n_train",
        "n_test",
    ):
        assert key in metadata
    assert str(metadata["trained_at"]).endswith("Z")


def test_training_partition_and_groupkfold_use_id_sp_without_leakage() -> None:
    data = pd.read_excel(WORKBOOK_PATH, sheet_name="DuLieu_ML", engine="openpyxl")
    train = data[data["Tập"].astype(str).str.strip().str.casefold().eq("train")]
    test = data[data["Tập"].astype(str).str.strip().str.casefold().eq("test")]
    assert len(train) == load_metadata()["n_train"]
    assert len(test) == load_metadata()["n_test"]
    assert set(train["ID_SP"]).isdisjoint(set(test["ID_SP"]))

    metadata = load_metadata()
    assert metadata["group_kfold"]["group_column"] == "ID_SP"
    groups = train["ID_SP"].to_numpy()
    splitter = GroupKFold(n_splits=5)
    for fit_indices, validation_indices in splitter.split(train, groups=groups):
        assert set(groups[fit_indices]).isdisjoint(set(groups[validation_indices]))


def test_export_contains_complete_pipelines_and_handles_unknown_category() -> None:
    artifact = joblib.load(MODEL_PATH)
    metadata = load_metadata()
    assert artifact["features"] == metadata["features"]

    rf_pipe = artifact["rf_pipe"]
    knn_pipe = artifact["knn_pipe"]
    assert isinstance(rf_pipe.named_steps["preprocess"].named_transformers_["cat"], OneHotEncoder)
    assert (
        rf_pipe.named_steps["preprocess"].named_transformers_["cat"].handle_unknown
        == "ignore"
    )
    assert isinstance(knn_pipe.named_steps["preprocess"].named_transformers_["num"], StandardScaler)
    assert isinstance(knn_pipe.named_steps["model"], KNeighborsRegressor)
    assert knn_pipe.named_steps["model"].n_neighbors == metadata["best_k"]
    assert rf_pipe.named_steps["model"].n_estimators == 200

    sample = pd.DataFrame(
        [metadata["roundtrip_check"]["features"]],
        columns=metadata["features"],
    )
    sample.loc[:, "Hoàn cảnh"] = "Giá trị phân loại chưa gặp"
    predictions = rf_pipe.predict(sample)
    assert predictions.shape == (1,)
    assert np.isfinite(predictions).all()


def test_metrics_and_rf_size_guard() -> None:
    metadata = load_metadata()
    scores = metadata["metrics_test"]
    assert set(scores) == {"Mốc đoán trung bình", "KNN", "RF", "Lai"}
    assert scores["Lai"]["MAE"] < scores["Mốc đoán trung bình"]["MAE"]
    assert scores["Lai"]["MAE"] <= min(scores["RF"]["MAE"], scores["KNN"]["MAE"]) * 1.02

    trials = {trial["name"]: trial for trial in metadata["rf_size_trials"]}
    full = trials["full"]
    selected = trials[metadata["selected_rf_configuration"]["name"]]
    assert selected["metrics_test"]["MAE"] <= full["metrics_test"]["MAE"] * 1.02
    eligible = [
        trial
        for trial in trials.values()
        if trial["metrics_test"]["MAE"] <= full["metrics_test"]["MAE"] * 1.02
    ]
    assert selected["name"] == min(eligible, key=lambda trial: trial["compressed_bytes"])["name"]
    assert MODEL_PATH.stat().st_size == metadata["model_size_bytes"]
    assert metadata["model_size_bytes"] < metadata["model_size_baseline_bytes"]
    assert metadata["model_size_reduction_percent"] > 0


def test_confidence_thresholds_and_intervals_are_bounded() -> None:
    metadata = load_metadata()
    thresholds = metadata["confidence_thresholds"]
    assert thresholds["source"] == "quantiles_test_set"
    assert 0 <= thresholds["high_std_max"] <= thresholds["medium_std_max"]
    assert set(metadata["confidence_calibration_test"]) == {
        "Cao",
        "Trung bình",
        "Thấp",
    }

    sample = metadata["roundtrip_check"]
    assert sample["std_between_trees"] >= 0
    assert 0 <= sample["score_low"] <= sample["score"] <= sample["score_high"] <= 10
    assert np.isclose(
        sample["score_low"],
        max(0, sample["score"] - sample["std_between_trees"]),
    )
    assert np.isclose(
        sample["score_high"],
        min(10, sample["score"] + sample["std_between_trees"]),
    )


def test_artifacts_and_three_charts_were_exported() -> None:
    assert MODEL_PATH.is_file() and MODEL_PATH.stat().st_size > 0
    assert METADATA_PATH.is_file() and METADATA_PATH.stat().st_size > 0
    assert (ROOT / "data" / "mon_do.csv").is_file()
    for chart in CHARTS:
        assert chart.is_file() and chart.stat().st_size > 0


def test_joblib_prediction_matches_in_a_fresh_process() -> None:
    metadata = load_metadata()
    expected = metadata["roundtrip_check"]
    code = """
import json, sys, joblib, numpy as np, pandas as pd
artifact = joblib.load(sys.argv[1])
with open(sys.argv[2], encoding="utf-8") as stream:
    meta = json.load(stream)
check = meta["roundtrip_check"]
frame = pd.DataFrame([check["features"]], columns=meta["features"])
rf = artifact["rf_pipe"]
transformed = rf.named_steps["preprocess"].transform(frame)
trees = np.asarray([tree.predict(transformed)[0] for tree in rf.named_steps["model"].estimators_])
rf_mean = float(trees.mean())
score = rf_mean
if artifact.get("selected_model") == "Lai":
    score = float(artifact["w"] * rf_mean + (1 - artifact["w"]) * artifact["knn_pipe"].predict(frame)[0])
print(json.dumps({"score": float(np.clip(score, 0, 10)), "std": float(trees.std(ddof=0))}))
"""
    process = subprocess.run(
        [sys.executable, "-c", code, str(MODEL_PATH), str(METADATA_PATH)],
        cwd=ROOT,
        capture_output=True,
        text=True,
        encoding="utf-8",
        check=True,
    )
    actual = json.loads(process.stdout.strip().splitlines()[-1])
    assert np.isclose(actual["score"], expected["score"], rtol=0, atol=1e-12)
    assert np.isclose(
        actual["std"], expected["std_between_trees"], rtol=0, atol=1e-12
    )
