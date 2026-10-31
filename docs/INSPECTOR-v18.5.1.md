# Cột thông số trần — v18.5.1

- Bỏ mục chọn Hình mẫu/Vẽ tự do khỏi giao diện. Vùng mới tạo bằng PL/REC trong khung vẽ; geometry của dự án cũ vẫn được khôi phục.
- Cột phải bắt đầu bằng sản phẩm/hướng rải; tiếp theo là xương, khe tường, dự phòng, cao độ/chiều dài ty, quy cách nối và phương pháp tính. Phạm vi trừ vật tư của lỗ nằm ở cuối cột.
- SELECT, MOVE, Viền, PL/REC, DIM/DIST ở thanh lệnh canvas. Menu **Lỗ** chứa đa giác, chữ nhật và tròn. Bán kính/Tạo đường tròn hiển thị trong thanh lệnh khi chạy C/HC.
- Nút Chỉnh điểm nối và Xóa điểm nối chuyển vào menu **Nối** trên canvas. Các giá trị kiểu nối, độ lệch so le vẫn thuộc cột thông số.
- Nhập DXF/PDF/ảnh, lựa chọn biên DXF và hiệu chuẩn chuyển vào **Nhập bản vẽ** phía trên canvas.

Giữ các ID form hình học cũ trong vùng ẩn ngoài inspector để việc khôi phục JSON và các binding còn lại không lỗi. Không thay công thức hoặc kết quả tính QS trong bản cập nhật giao diện này. Các lỗi/giới hạn phát hiện trong audit v18.5 chưa được sửa bởi thay đổi này.

Kiểm chứng: 112/112 bài hồi quy hiện có đạt. Đã thử HTML độc lập qua Edge/localhost ở 1191×668: không còn nút vẽ/chọn mode trong cột phải; sửa bước xương; tạo lỗ tròn từ menu mới và hoàn tác; Viền/SELECT; bật/tắt chỉnh nối; mở bảng nhập bản vẽ. Không ghi nhận lỗi JavaScript trong các luồng vừa thử. Chưa thử tải file thực qua hộp chọn trong lượt này.
