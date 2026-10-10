"""Recommendation coverage for temperature, score thresholds and MMR diversity."""

import unittest

from fastapi.testclient import TestClient

from api import main
from api.main import CATALOG, MODEL_ARTIFACT
from api.recommender import recommend
from api.schemas import RecommendRequest


class RecommenderTests(unittest.TestCase):
    def test_predict_http_endpoint_returns_score_interval_and_confidence(self):
        response = TestClient(main.app).post(
            "/predict",
            json={
                "Hoàn cảnh": "Đi học",
                "Phong cách": "Casual",
                "Tmin (°C)": 18,
                "Tmax (°C)": 30,
                "Nhiệt độ ngày (°C)": 24,
                "Giữ ấm": 3,
                "Thoáng khí": 4,
                "Vận động": 4,
                "Chỉn chu": 3,
            },
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(
            {
                "score",
                "score_low",
                "score_high",
                "std_between_trees",
                "confidence_level",
                "model_version",
            }
            <= response.json().keys()
        )

    def test_twenty_contexts_return_high_scoring_pairwise_distinct_outfits(self):
        cases = [
            (gender, activity, temperature, "Casual")
            for gender in ("Nam", "Nữ")
            for activity in (
                "Đi học",
                "Xưởng/Công trình",
                "Vẽ ngoại cảnh",
                "Thuyết trình",
            )
            for temperature in (12, 28)
        ]
        cases.extend(
            [
                ("Nam", "Đi học", 20, "Smart Casual"),
                ("Nữ", "Xưởng/Công trình", 34, "Streetwear"),
                ("Nam", "Vẽ ngoại cảnh", 34, "Minimalist"),
                ("Nữ", "Thuyết trình", 12, "Artsy"),
            ]
        )
        self.assertEqual(len(cases), 20)
        for gender, activity, temperature, style in cases:
            with self.subTest(gender=gender, activity=activity, temperature=temperature, style=style):
                result = recommend(
                    CATALOG,
                    MODEL_ARTIFACT,
                    RecommendRequest(
                        gender=gender,
                        activity=activity,
                        temperature=temperature,
                        styles=[style],
                        top_n=3,
                    ),
                )
                outfits = result["outfits"]
                self.assertEqual(len(outfits), 3)
                self.assertTrue(all(item["score"] >= 6.0 for item in outfits))
                self.assertEqual(
                    [item["score"] for item in outfits],
                    sorted((item["score"] for item in outfits), reverse=True),
                )
                for index, outfit in enumerate(outfits):
                    main_items = {
                        item["id"]
                        for item in outfit["items"]
                        if item["category"] not in {"Giày", "Dép"}
                    }
                    for other in outfits[index + 1:]:
                        other_main = {
                            item["id"]
                            for item in other["items"]
                            if item["category"] not in {"Giày", "Dép"}
                        }
                        self.assertFalse(main_items & other_main)
                if temperature == 12:
                    self.assertTrue(
                        all(
                            any(item["category"] == "Áo khoác" for item in outfit["items"])
                            for outfit in outfits
                        )
                    )
                if temperature == 34:
                    self.assertTrue(
                        all(
                            all(item["category"] != "Áo khoác" for item in outfit["items"])
                            for outfit in outfits
                        )
                    )


if __name__ == "__main__":
    unittest.main()
