# Sửa thông tin mẫu — v19.1

Chọn sản phẩm → nút cạnh danh sách **Sửa mẫu đang chọn** → sửa tên, bản rộng, khe, chiều dài tối đa, màu → **Lưu thay đổi**. Có thể chọn **Sửa** tại từng dòng danh sách. **+ Tạo mẫu mới** tạo bản riêng; tên trùng bị chặn để tránh ghi đè.

Mẫu cũ được nạp vào form. Lưu cập nhật đúng record, giữ các mẫu khác cùng SKU/quy tắc/phụ kiện. Thay đổi thông số sản phẩm đưa bộ có quy tắc về trạng thái chưa duyệt; cần đối chiếu lại cấu tạo. Lưu áp dụng vào vùng hiện tại; các vùng đã lưu khác giữ snapshot riêng.

Đọc/sửa một sản phẩm bằng JSON rồi áp dụng sẽ gộp/cập nhật thư viện theo đích đang sửa, ID hoặc SKU, không thay toàn bộ thư viện bằng một mẫu. File nhập cũng gộp/cập nhật. Dữ liệu lỗi và lưu trữ không ghi được có thông báo tại form.

Sửa mẫu được lưu cả thư viện lẫn phiên làm việc ngay, không chờ debounce. Mở lại dự án chọn đúng mẫu theo ID/SKU/tên, kể cả mẫu thứ hai trong danh sách.

150 kiểm thử đạt, gồm 7 ca bổ sung sửa mẫu, giữ mẫu khác, giữ quy tắc, chống trùng, merge JSON, lỗi quota, khôi phục lựa chọn. Đã thao tác trên Edge/localhost: tạo mẫu phụ, sửa/đổi tên/đổi bản rộng mẫu cũ và mẫu thứ hai, lưu, tải lại ngay, đối chiếu tên và thông số.
