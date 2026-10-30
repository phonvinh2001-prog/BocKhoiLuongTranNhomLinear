# Không gian làm việc QS v18.1

- Trên cùng: Mở/Lưu dự án, Tính vùng và Xuất hồ sơ. Trong menu xuất chọn vùng đang xem hoặc các vùng đã lưu; DXF luôn xuất vùng đang xem.
- Trái: đặt tên vùng, thêm/cập nhật, mở vùng đã lưu. Thiết lập dự án và mẫu được thu gọn.
- Trung tâm: bản vẽ với Vừa khung/zoom, số liệu diện tích vùng/mặt nhôm và điểm ty. Lớp hiển thị có thanh trần, xương, ty, nối tấm, nối xương, viền và kích thước.
- Phải: nhóm Mặt bằng, Sản phẩm/hướng, Xương/viền, Cao độ/ty, Nối tấm, Phương pháp tính. Nhãn có đơn vị và liên kết input. Trên màn hình hẹp, dùng nút Thông số để mở cột này.
- Dưới: Lắp đặt, Cắt cây, Đặt mua, Cảnh báo; có phạm vi vùng/dự án, tìm vật tư, thu gọn và thanh cuộn. Bấm dòng lắp đặt của vùng đang xem để đánh dấu thanh/xương/ty tương ứng trên bản vẽ. Chưa hỗ trợ chọn ngược từ bản vẽ về dòng bảng.
- Trạng thái: cần tính lại trong lúc sửa input; đủ thông tin tính hoặc cần kiểm tra theo warnings sau tính. Đây không phải trạng thái phê duyệt catalogue hay hồ sơ đặt hàng.

Thay đổi chỉ tổ chức giao diện và renderer; không sửa công thức quantity của v18. Tắt lớp không xóa vật tư khỏi tính toán hoặc file xuất. Main/website hiện hành chưa được thay thế.

Kiểm tra: bộ hồi quy engine và kiểm thử trạng thái/lọc bảng/ẩn lớp không đổi BOM. Trình duyệt: bốn tab, tìm Ty ren, thu/mở bảng, bật/tắt xương/ty, cột thuộc tính tại chiều rộng 1000 px, bố cục 520 px, menu xuất và file Excel/CSV.

Tạo HTML đóng gói bằng `node scripts/build-portable.mjs <đường-dẫn-file.html>`. Kiểm tra trình duyệt chạy qua `node server.mjs`; cách mở file HTML trực tiếp tùy trình duyệt.
