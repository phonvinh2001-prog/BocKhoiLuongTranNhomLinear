> Cập nhật v18.5: Enter trống / chuột phải hoàn tất hình hợp lệ; PL tự khép. Esc/Hủy/SELECT bỏ nháp. Xem [hướng dẫn mới](INTERACTION-v18.5.md).

# Nhập dữ liệu và CAD v18.2 — bản kiểm tra

Chạy `node server.mjs`, mở `http://127.0.0.1:8765`. Mã nguồn dùng ES Modules nên cần HTTP server. Không cần npm install. Kiểm tra bằng `node --test tests/regression.test.mjs tests/cad-workflow.test.mjs`.

## Thông số và đơn vị

Các ô kích thước nhận số theo đơn vị ghi trên nhãn hoặc có hậu tố `mm`, `cm`, `m`. Ví dụ bước xương `1200mm` chuyển thành `1.2` m; bản rộng tấm `8,5cm` chuyển thành `85` mm. Dấu phẩy thập phân được chấp nhận trong ô thông số. Giá trị trống/sai/ngoài giới hạn được báo ngay tại ô; không tự đổi sang quy cách khác để tính. Enter áp dụng; Enter trong kích thước hình mẫu dựng lại hình.

Đơn vị thanh lệnh mặc định **mm**, chọn được **m**. Trong tọa độ CAD, dùng dấu phẩy để ngăn X và Y, dấu chấm cho phần thập phân: `1250.5,3000`. Trục Y dương hướng lên như CAD. Tọa độ nhập tường minh ưu tiên hơn khóa hướng.

## Lệnh

| Lệnh/phím | Thao tác |
|---|---|
| `PL`, `PLINE`, `L`, `LINE` | Vẽ đường gấp khúc bằng chuột hoặc tọa độ; L/LINE là alias của PL trong bản này |
| `x,y` | Điểm tuyệt đối theo đơn vị thanh lệnh |
| `@dx,dy` | Điểm tương đối so với điểm trước |
| `@d<góc` | Đoạn theo chiều dài và góc độ, ví dụ `@4000<90` |
| Một số chiều dài | Từ điểm trước, đi theo hướng con trỏ; F8 khóa ngang/dọc |
| `C` trong PL đang mở, `CLOSE` | Khép kín; kiểm tra ít nhất ba đỉnh, không tự giao/chồng cạnh |
| `C`, `CIRCLE` khi không có PL mở | Chọn tâm, nhập bán kính hoặc chọn điểm trên đường tròn; chỉ là hình tham chiếu |
| `REC`, `RECTANG` | Chữ nhật bằng hai góc đối diện |
| `DIM`, `DAL` | DIM theo phương đoạn: hai điểm đo, rồi vị trí đặt kích thước |
| `DLI` | DIM ngang/dọc, phương được chọn từ vị trí đặt kích thước |
| `DIST`, `DI` | Đo khoảng cách, ΔX, ΔY giữa hai điểm |
| `CAL` | Hiệu chuẩn PDF/ảnh: chọn hai điểm rồi nhập chiều dài thực |
| `U`, `UNDO`, `REDO` | Hoàn tác/làm lại hình và chú thích; nút ↶/↷ trên thanh công cụ |
| F8 / giữ Shift trong PL | Khóa hướng ngang/dọc |
| F3 / OSNAP | Bật/tắt bắt điểm, chọn từng loại trong menu OSNAP |
| F9 | Bắt lưới 100 mm (tách biệt với OSNAP) |
| `Z`, `ZE`, `ZOOM` | Vừa khung vùng, bản vẽ nền và chú thích |
| Enter trống / chuột phải | Kết thúc lệnh; PL vẫn mở, chưa tính khối lượng |
| Esc | Hủy lệnh; PL/REC khôi phục vùng trước khi bắt đầu |
| Lăn chuột / giữ chuột giữa | Zoom tại con trỏ / pan |

OSNAP nhận đầu mút END, trung điểm MID, giao đoạn INT, chân vuông góc PERP, điểm gần nhất NEAR, tâm CEN và góc phần tư QUAD của đường tròn. Bán kính bắt 9 pixel theo mức zoom. INT hiện tính giữa các đoạn thẳng; chưa giải giao đường tròn/đường tròn và đường tròn/đoạn. F8 chỉ nhận snap nằm trên trục đang khóa. Không làm tròn điểm chuột xuống 1 cm như luồng vẽ cũ.

Thử vùng 4 × 3 m, mỗi dòng Enter một lần:

```text
PL
0,0
@4000,0
@0,3000
@-4000,0
C
```

Diện tích vùng phải là **12.000 m²**. Trước `C`, bảng vùng chưa có khối lượng; đường mở không được thêm vào dự án. DIM không phải ràng buộc sửa hình: sửa hình không tự kéo DIM theo. Chú thích DIM và đường tròn lưu trong JSON và xuất DXF riêng lớp `QS-DIM` / `QS-REF-CIRCLE`. DIM DXF xuất thành nét và TEXT, không phải DIMENSION liên kết.

## Nhập bản vẽ

- **DXF ASCII 2D**: đọc LINE, LWPOLYLINE, POLYLINE cũ, CIRCLE, TEXT/MTEXT cơ bản; giữ layer, bật/tắt layer nền, bắt điểm từ layer đang hiện. `$INSUNITS` hỗ trợ mm/cm/m/in/ft. Nếu thiếu đơn vị, dùng lựa chọn trong form và hiện cảnh báo. Chọn polyline kín hợp lệ → **Dùng làm vùng trần**.
- **PDF**: chọn trang, hiển thị nền raster; dùng CAL trước khi vẽ đè biên. PDF.js 4.10.38 tải từ jsDelivr khi dùng chức năng PDF, cần Internet. File được đọc trong trình duyệt; không có bước gửi nội dung PDF lên máy chủ. Chưa OCR/nhận dạng biên hoặc bắt điểm vector PDF.
- **PNG/JPEG/WebP**: nền ảnh, CAL hai điểm. Hiệu chuẩn đổi tỷ lệ nền quanh điểm đầu; không đổi vùng đã bóc trước đó. Vẽ lại vùng nếu đã dùng tỷ lệ cũ.

DXF có bulge/arc, spline, INSERT/block, hatch, mesh/3D hoặc OCS nghiêng/đảo không được tự chuyển thành biên thẳng; hiện cảnh báo đối tượng bỏ qua. Chưa đọc DWG trực tiếp, chưa nối chuỗi LINE thành một biên và chưa trừ lỗ mở. TEXT chỉ hiển thị nội dung cơ bản, không tái tạo đầy đủ font/rotation/format của CAD.

Giới hạn: file 20 MB, ảnh 8 MB; DXF 30.000 đỉnh nền; mỗi vùng tối đa 2.000 đỉnh và kích thước bao ≤1.000 m. Vùng quá lớn cần kiểm tra đơn vị/tách khu vực. PDF raster tối đa 12 triệu pixel. JSON lưu dữ liệu nền và trang PDF hiện tại; mở lại PDF gốc để đổi trang. Ảnh lớn có thể vượt dung lượng LocalStorage; nên tải file JSON dự án xuống máy.

## Kiểm chứng và việc còn lại

- 62 bài kiểm tra Node đã qua: quy tắc QS cũ, đơn vị, tọa độ Y-up, F8, OSNAP, PL/REC/CIRCLE, DIM, undo/redo, DXF nhập–xuất, JSON và hiệu chuẩn nền.
- Đã thử UI qua Edge/localhost: PL tọa độ ra 12 m², không tính đường mở, DIM và chuyển trạng thái F8/F3.
- Chưa hoàn tất UI nhập file DXF/PDF, thao tác CIRCLE/OSNAP bằng chuột và kiểm tra responsive cuối cùng. Tiện ích Edge chặn thiết lập file; sau đó Computer Use dừng vì không xác định chắc URL. Không đổi quyền tiện ích để vượt chặn. Hai fixture `tests/fixtures/room-4x3-mm.dxf` và `room-survey.pdf` dùng cho kiểm tra thủ công tiếp.
- Bản HTML gộp được tạo bằng `node scripts/build-portable.mjs <output.html>`; chưa xác minh mở trực tiếp bằng file://.

Đây là bước bổ sung nhập liệu và thao tác CAD cơ bản. Bộ máy QS vẫn rải theo 0°/90°, chỉ một biên ngoài dạng đoạn thẳng cho mỗi vùng; chưa phải bộ CAD đầy đủ hay MVP CAD/PDF tự động nhận diện toàn bộ.

