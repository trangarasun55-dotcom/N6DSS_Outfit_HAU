# Báo cáo rà soát và sửa lỗi — N6DSS OutfitAI

## Thay đổi đã thực hiện

1. **Giao diện sáng hơn:** chuyển nền ứng dụng sang trắng xanh nhạt, thẻ trắng, viền sáng và màu nhấn tím-xanh; bổ sung kiểu hiển thị bản xem trước outfit phù hợp giao diện sáng.
2. **Chọn phong cách/màu:** sửa xử lý sự kiện chip và màu để ngăn trình duyệt tự đảo trạng thái checkbox lần thứ hai sau khi JavaScript đã cập nhật. Đây là lỗi tương tác có thể làm lựa chọn bị ngược trạng thái.
3. **Xem trước thời gian thực:** trang tiêu chí có panel bên phải cập nhật phong cách, màu, thời tiết và mức trang trọng; debounce 650 ms, hủy yêu cầu cũ khi người dùng tiếp tục chỉnh sửa, và hiển thị ba kết quả gần nhất.
4. **Không làm bẩn lịch sử:** thêm `POST /recommend/preview` ở API và `/ui/recommend-preview` ở Flask. Preview không ghi lịch sử; nút tạo gợi ý chính thức vẫn dùng endpoint lưu lịch sử hiện có.
5. **Đưa tiêu chí vào phân tích:** phong cách, màu sắc, mức trang trọng, nhiệt độ và ghi chú được gửi tới API; ghi chú được đưa vào ngữ cảnh AI. Điểm xếp hạng vẫn do bộ DSS/model và bộ lọc danh mục tính; AI tạo phần giải thích khi có cấu hình Gemini.
6. **Hồ sơ Admin:** trước đây `/profile` chuyển Admin về trang quản trị, khiến Admin không thể dùng trang hồ sơ. Đã bỏ chuyển hướng và làm nhãn hồ sơ phù hợp với Admin/User.
7. **Khả năng thiếu SDK AI:** nếu `google-genai` chưa được cài, API vẫn có thể nạp module và dùng giải thích theo quy tắc thay vì làm hỏng import toàn bộ API. Khi SDK có mặt, Gemini vẫn được dùng bình thường.
8. **Cấu hình AI:** biến môi trường của hệ thống triển khai hiện được ưu tiên hơn giá trị trong `.env`, tránh việc một khóa cũ trong `.env` ghi đè cấu hình deploy.
9. **Làm tròn DSS:** làm tròn điểm thành một chữ số theo workbook, tránh sai số nhị phân hiển thị như `4.600000000000001`.

## Các điểm đã rà soát

- Có trang đăng ký/đăng nhập riêng (`/register`, `/login`); các trang còn lại được chặn khi chưa có phiên. Đăng xuất xóa phiên web và chuyển về trang đăng nhập.
- API xác thực dùng cookie phiên; các API hồ sơ/lịch sử/đề xuất có dependency xác thực. Endpoint quản trị kiểm tra quyền ở API.
- Bộ gợi ý hiện đã có cơ chế tránh dùng lại món chính giữa các bộ được chọn; bộ chọn đa dạng được giữ lại.
- API và Flask được nối bằng `API_URL`; `run_dev.py` khởi động API trước, đợi `/health`, rồi mới chạy web.
- `requirements.txt` có trong thư mục gốc dự án. Lệnh `pip install -r requirements.txt` cần chạy từ thư mục dự án hoặc dùng đường dẫn đầy đủ.

## Kiểm thử thực hiện trong môi trường này

- `python -m compileall -q api web run_dev.py model/train_export.py`: đạt.
- `node --check web/static/js/main.js`: đạt.
- Bộ kiểm thử API/model/rules/storage/weather/AI: **47 passed** (bỏ qua kiểm thử web vì môi trường hiện tại không có gói Flask).
- `tests/test_web_client.py` chưa chạy được do môi trường kiểm tra không có `flask`; không thể tuyên bố toàn bộ dự án đã được kiểm thử end-to-end trong môi trường này.
- Không thể cài thêm dependency từ mạng trong sandbox hiện tại. Chạy thực tế vẫn cần cài các gói từ `requirements.txt`, cấu hình `.env`, và xác minh kết nối Gemini/thời tiết theo tài khoản của bạn.

## Lưu ý vận hành

- AI trực tiếp cần `GEMINI_API_KEY` hợp lệ và có hạn mức. Nếu không có khóa hoặc dịch vụ AI lỗi, hệ thống dùng giải thích theo quy tắc; phần xếp hạng outfit vẫn do DSS/model xử lý.
- Ghi chú tự do được gửi vào ngữ cảnh AI nhưng không thể đảm bảo mọi yêu cầu văn bản trở thành bộ lọc cứng nếu danh mục dữ liệu không có thuộc tính tương ứng. Các ràng buộc quan trọng như dị ứng/chất liệu bắt buộc cần có cột dữ liệu có cấu trúc và bộ lọc rõ ràng.
- Không thể đảm bảo “chạy 100%” khi chưa kiểm tra trên máy triển khai, API keys, phiên bản Python và kết nối dịch vụ bên ngoài. Các kiểm tra ở trên là những kiểm tra thực tế đã chạy được trong môi trường hiện có.
