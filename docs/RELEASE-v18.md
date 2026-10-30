# V18 — Bản nâng cấp độ tin cậy QS (ứng viên kiểm tra)

## Đã triển khai

- Sửa bảng/CSV dùng chung kết quả, phân biệt EXACT/NORM, không đọc ngược DOM.
- Tách diện tích vùng và mặt nhôm; báo cáo không sửa dữ liệu tính. NORM không tự nhân chu vi cho mọi loại viền, không coi tổng mét tấm là một tuyến nối.
- Xương/ty bắt đầu cách biên 150 mm; chỉ bù khi hở cuối >300 mm. Ty theo tuyến xương liên tục cộng ty tại nối, loại trùng; nối xương vẽ hình vuông.
- Chia cây xương trước khi đóng gói cắt. Ty dùng từng đoạn để tính cây, có kerf và bảng dư; không lấy tổng mét chia cây cho ty bắt buộc liền.
- Cao độ neo/trần và bù cấu tạo tách khỏi chiều dài ty; thiếu số liệu/ty dài hơn stock được báo, không tự nối.
- Áp giới hạn vận chuyển cho tấm; lọc nối trùng; sửa preset và trường độ lệch Brick.
- Lưu–mở giữ tọa độ, hình U/L, thông số, kiểu nối, mode; kiểm tra JSON trước khi thay dữ liệu; mẫu JSON riêng.
- Viền bao mặc định NONE; V-góc chỉ tính trên cạnh được gán. Chưa có công cụ tuyến V-góc độc lập bên trong vùng.
- Excel phòng/dự án: chi tiết vùng, tổng hợp mua, cắt cây net và ghi chú; DXF bố trí mm, lớp kết quả riêng.
- Bổ sung bộ test production và workflow CI; bỏ định nghĩa phương thức trùng trong Engine.

## Cách chạy

Cần Node.js >=20. Không cần cài package để chạy bản này.

```text
node server.mjs
```

Mở http://127.0.0.1:8765. Chạy kiểm thử bằng `node --test tests/regression.test.mjs`.

## Phạm vi chưa hoàn tất

Đây là đợt ổn định ứng dụng cũ, chưa phải toàn bộ MVP đã chốt. Chưa có React/FastAPI/SQLite, nhập DXF/PDF, polygon có holes, hướng tùy ý, kiểm tra/gia cố cục bộ quanh thông tầng, loại xương/SKU version, nhiều loại mặt dựng, đường nối nhiều thanh, tuyến V-góc độc lập, hoặc lượng cây mua tấm theo supplyMode. Phần rải vẫn chỉ 0°/90°, lấy tâm tấm; chưa nghiệm thu cho cạnh chéo hoặc mọi cấu tạo.

Preset C85/U-Baffle/G200 là dữ liệu mẫu chưa xác nhận catalogue. Hệ số phụ kiện và bước lắp cần QS đối chiếu cấu tạo trước dùng đặt mua. Excel có bảng cắt cây net cho xương/ty; cây mua cộng dự phòng riêng. Tái dùng dư trong một phòng, không tối ưu cắt gộp dự án. Tổng hợp dùng tên/quy cách hiện có, chưa thay thế thư viện SKU chính thức.

Dữ liệu JSON v17 được nhận khi hợp lệ. Các phòng có kết quả cũ phải mở/tính lại trước xuất Excel dự án. Thiếu thông số cao độ thì không có lượng cây ty; giữ cảnh báo trong kết quả. Không có thay đổi tự động main hoặc website đang chạy.

## Kiểm tra

Bộ hồi quy: biên 299/300/301, nhịp hẹp, tuyến 7,8 m, nối/ty trùng, kerf và bảo toàn stock, chiều dài hữu ích, vận chuyển, diện tích, viền hỗn hợp, snapshot, cao độ, CSV, tổng hợp phòng, XLSX và DXF. Đây là test kỹ thuật, không thay cho 10–20 đáp án QS có catalogue đã duyệt.
