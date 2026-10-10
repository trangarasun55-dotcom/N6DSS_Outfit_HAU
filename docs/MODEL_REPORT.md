# Báo cáo huấn luyện model OutfitAI — Giai đoạn 2

## Phạm vi và dữ liệu

- Lệnh chạy: `python model/train_export.py` từ thư mục gốc.
- Workbook: `data/DatasetDSS.xlsx`, sheet `DuLieu_ML`.
- Workbook có 6.000 dòng, không thiếu dữ liệu ở các cột huấn luyện bắt buộc; điểm mục tiêu nằm trong `[0, 9.4]`.
- Chia tập giữ nguyên cột `Tập`: 4.820 Train và 1.180 Test. Có 1.500 `ID_SP`, mỗi mã có 4 dòng; không có `ID_SP` giao nhau giữa Train và Test.
- GroupKFold(5) trên Train dùng trực tiếp `ID_SP` làm group (1.205 mã), không dùng các cột điểm trung gian.
- Model chỉ nhận đúng 9 đặc trưng: `Hoàn cảnh`, `Phong cách`, `Tmin (°C)`, `Tmax (°C)`, `Nhiệt độ ngày (°C)`, `Giữ ấm`, `Thoáng khí`, `Vận động`, `Chỉn chu`. Không đưa `Tập`, `ID_SP`, mục tiêu hay các cột `Bước 1/2/3` vào `X`.

## Pipeline và kết quả Test

Tiền xử lý được đóng gói trong hai sklearn Pipeline. Cả hai dùng ColumnTransformer và OneHotEncoder với `handle_unknown="ignore"`; pipeline KNN chuẩn hóa riêng các cột số bằng StandardScaler, RF giữ nguyên thang số. K được chọn trong `[1, 2, 3, 5, 7, 10, 15, 20]` theo MAE GroupKFold. Kết quả chọn `K=3` (CV MAE `0.7427`). Trọng số lai được chọn từ dự đoán out-of-fold trên Train, quét từng bước `0.05`.

| Mô hình | MAE | RMSE | R² |
| --- | ---: | ---: | ---: |
| Mốc đoán trung bình | 2.3178 | 2.6850 | -0.0162 |
| KNN (K=3) | 0.7304 | 1.1758 | 0.8051 |
| RF (200 cây) | **0.2722** | **0.4451** | **0.9721** |
| Lai (RF 1.00 + KNN 0.00) | **0.2722** | **0.4451** | **0.9721** |

Lai vượt mốc trung bình. Trọng số RF bằng `1.00`, nên mô hình lai thực tế tương đương RF; không có lợi ích pha trộn KNN trên phân hoạch này. Model mặc định export là RF vì MAE Test thấp nhất (bằng Lai).

## Thử giảm kích thước cây

So sánh cấu hình trên cùng Train/Test; kích thước dưới đây là pipeline RF nén bằng joblib `compress=9`. Chỉ chấp nhận MAE không vượt quá 2% so với RF đầy đủ (ngưỡng `0.2777`).

| Cấu hình RF | MAE Test | Tăng MAE so với RF đầy đủ | Kích thước RF nén | Kết quả |
| --- | ---: | ---: | ---: | --- |
| `min_samples_leaf=1`, `max_depth=None` | 0.2722 | 0.00% | 9,312,055 bytes | Chọn |
| `min_samples_leaf=2`, `max_depth=None` | 0.2861 | 5.10% | 6,443,466 bytes | Loại: vượt ngưỡng |
| `min_samples_leaf=3`, `max_depth=None` | 0.3043 | 11.79% | 4,837,619 bytes | Loại: vượt ngưỡng |
| `min_samples_leaf=2`, `max_depth=20` | 0.2864 | 5.21% | 6,410,337 bytes | Loại: vượt ngưỡng |
| `min_samples_leaf=3`, `max_depth=20` | 0.3043 | 11.79% | 4,830,454 bytes | Loại: vượt ngưỡng |
| `min_samples_leaf=5`, `max_depth=14` | 0.3465 | 27.28% | 2,933,628 bytes | Loại: vượt ngưỡng |

Không cấu hình cây nhỏ hơn nào thỏa điều kiện 2%; do đó giữ cây đầy đủ. Để giảm file mà không thay dự đoán, artifact cuối dùng `compress=9`. Kích thước toàn bộ `outfit_model.joblib` giảm từ **11,000,985 bytes** (cùng artifact nén `compress=3`) còn **9,365,520 bytes**, giảm **14.87%**. Đây là giảm do nén, không phải do cắt bớt cây.

## Khoảng điểm và nhãn tin cậy

Mỗi dự đoán RF tính trung bình và độ lệch chuẩn population (`ddof=0`) trên dự đoán của 200 cây. Khoảng hiển thị là `clip(score − std, 0, 10)` đến `clip(score + std, 0, 10)`. Metadata chứa hai ngưỡng phân vị của độ lệch chuẩn trên Test: Cao đến `0.3681` (phân vị 1/3), Trung bình đến `0.8017` (phân vị 2/3), còn lại Thấp.

| Nhãn | Số dòng Test | Độ phủ | Độ lệch chuẩn trung bình | MAE Test |
| --- | ---: | ---: | ---: | ---: |
| Cao | 394 | 33.39% | 0.1125 | 0.0427 |
| Trung bình | 393 | 33.31% | 0.5944 | 0.2630 |
| Thấp | 393 | 33.31% | 1.0885 | 0.5116 |

Các nhóm có MAE tăng theo độ phân tán, nhưng đây là phân nhóm thực nghiệm theo Test, không phải khoảng tin cậy thống kê có bảo đảm xác suất. Không sửa endpoint trong giai đoạn này; API hiện có ngưỡng nhãn cố định `0.5/1.0` ở `api/config.py`, chưa đọc các phân vị mới từ metadata. Việc đồng bộ runtime threshold thuộc phần API ngoài phạm vi được yêu cầu.

## Nạp lại và artifacts

Script nạp `outfit_model.joblib` trong một tiến trình Python con độc lập, dùng DataFrame có đủ tên cột, rồi so sánh dự đoán với tiến trình huấn luyện. Lần chạy này khớp với sai số tuyệt đối dưới `1e-12`; mẫu kiểm tra có score `0.0035`, std `0.0493735759`, khoảng `[0.0000, 0.0528735759]`.

Artifacts được tạo/cập nhật:

- `model/outfit_model.joblib`
- `model/model_metadata.json` (có phiên bản Python/sklearn, đặc trưng, danh mục, khoảng min/max, metrics, trọng số, thử nghiệm kích thước, hiệu chuẩn độ tin cậy và mẫu kiểm tra nạp lại)
- `model/charts/mae_comparison.png`
- `model/charts/actual_vs_predicted.png`
- `model/charts/feature_importance.png`
- `data/mon_do.csv` (export lại danh mục MonDo dạng UTF-8-SIG)

## Hạn chế

- Nhãn huấn luyện được sinh từ công thức quy tắc; R² cao chủ yếu cho thấy model học lại quy tắc, không chứng minh lựa chọn trang phục phù hợp với sở thích thực tế.
- Trọng số lai OOF chọn RF `1.00`; KNN không cải thiện kết quả trên dữ liệu hiện có.
- Lựa chọn cấu hình cây theo giới hạn MAE Test dùng chính phân hoạch Test được cung cấp; đây là giới hạn thiết kế của yêu cầu thử suy giảm ≤2%, không phải đánh giá độc lập mới.
- Độ lệch chuẩn cây và các nhãn theo phân vị hỗ trợ biểu diễn mức phân tán, không đảm bảo coverage của confidence interval.
- Frontend và endpoint không được chỉnh sửa trong giai đoạn này. Ngưỡng tin cậy đang được API sử dụng chưa đồng bộ với ngưỡng mới ghi trong metadata.
