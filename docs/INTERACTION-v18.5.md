# Ổn định chọn, vẽ và di chuyển — v18.5

## Cách thao tác

1. **SELECT · Chọn** là chế độ mặc định. Click phần trần/biên để chọn; Shift chọn nhiều; click lặp để đổi vùng tại vị trí chồng. Click nền trống bỏ chọn, không tạo vùng.
2. **PL / REC** tạo vùng mới. PL nhận các đỉnh; **C / Khép / Enter / Hoàn tất / chuột phải** đóng đa giác hợp lệ. REC nhận hai góc đối diện. Chưa đủ dữ liệu thì tiếp tục lệnh và hiển thị bước còn thiếu.
3. **MOVE / M**: chọn vùng → chọn điểm gốc → chọn điểm đích, hoặc nhập `@dx,dy` theo đơn vị lệnh. Enter nhận vị trí đang xem trước. F8 khóa ngang/dọc. Đích chồng vùng bị chặn; vẫn chọn được đích khác.
4. **Esc / Hủy / SELECT** bỏ lệnh và phần nháp chưa hoàn tất, giữ các vùng đã lưu. Đổi công cụ hoặc chọn vùng trong danh sách cũng bỏ nháp trước khi chuyển. Bấm lại cùng công cụ tiếp tục lệnh hiện tại, không xóa điểm gốc.
5. **Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z** hoàn tác/làm lại sau các nút lệnh và trong ô lệnh rỗng. Khi đang nhập văn bản, phím tắt giữ chức năng sửa văn bản.
6. **HC / Lỗ tròn**: chọn tâm, chọn điểm trên vòng tròn hoặc nhập ô Bán kính. Ô bán kính và xem trước đồng bộ; Enter/Hoàn tất tạo theo bán kính xem trước. Lỗ ngoài biên/chạm biên bị chặn, vẫn giữ tâm để sửa bán kính.

Thanh công cụ hiển thị lệnh hiện tại và hướng dẫn từng bước. Khép/Hoàn tất/Undo/Redo được bật theo trạng thái. Khép không đóng biên ngoài khi đang DIM. Thông số QS tạm khóa trong lúc chạy lệnh; hoàn tất/hủy để sửa thông số. Bảng QS mặc định thu gọn để dành chỗ vẽ, có thể mở rộng lại.

## Thay đổi xử lý

- Chọn lại cùng vùng hoặc lưu vùng không đổi không chạy lại phép tính và không viết lại record. Thay đổi thông số chạy tính một lần rồi lưu kết quả, tránh chuỗi tính–lưu lặp.
- Tách `Engine.buildZoneRecord` khỏi thao tác tính/UI; lưu record sử dụng kết quả đã có. Bộ nhớ đệm BOQ dùng mảng strips hiện tại, thông số, preset và revision cảnh báo chồng. Danh sách vùng không dựng lại khi nội dung hiển thị không đổi.
- MOVE buộc dựng lại thống kê theo geometry mới, cập nhật cảnh báo cả vùng chuyển và vùng còn lại; giữ ID, lỗ, DIM, viền và điểm nối. OSNAP khi MOVE có cả tâm/phần tư đường tròn.
- Giữ chế độ vừa khung vùng đang chọn hoặc zoom/pan thủ công khi đóng/mở bảng QS. Zoom +/- lấy tâm canvas, cuộn chuột giữ điểm dưới con trỏ.
- Hình mới bị từ chối do chồng vẫn giữ lệnh để sửa điểm. Esc trên mặt bằng trống giữ IDLE, không khóa ứng dụng trong DRAW rỗng.

## Kiểm chứng

112 kiểm tra Node đạt, gồm 15 ca bổ sung qua các hook Engine/CAD/Plan thực: số lần tính, bấm lặp, đổi công cụ/đổi vùng, Enter khép PL, SELECT bỏ nháp, Esc mặt bằng trống, Khép trong DIM, Enter MOVE, sửa REC chồng/lỗ tròn lỗi, Ctrl+Z/Y, hiển thị DIST, lùi góc REC, kiểm tra ô bán kính khi Hoàn tất và trạng thái nút theo bước MOVE.

Kiểm tra giao diện Edge qua localhost ở 1191 × 668: REC bằng tọa độ; chọn canvas; MOVE hai click; Ctrl+Z/Y; PL và nút Hoàn tất; chọn sidebar khi vẽ dở; Khép bị khóa trong DIM và Hủy về SELECT. File HTML đóng gói được kiểm tra riêng qua HTTP. File:// tại máy người dùng không được điều khiển trực tiếp; dữ liệu JSON cần giữ để chuyển trình duyệt/đường dẫn. Nhập file qua hộp chọn, PDF.js ngoại tuyến và nghiệm thu kết quả trong AutoCAD/Excel chưa được xác nhận trong lượt này. Giới hạn QS/gia cường quanh lỗ giữ như tài liệu v18.3–18.4.
