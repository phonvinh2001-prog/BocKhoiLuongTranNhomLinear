# Sửa chọn vùng, di chuyển và lỗ tròn — v18.4

## Các lỗi đã sửa

- Đổi vùng không còn được xem là tạo vùng mới. Chuẩn hóa ID vùng và gắn lại snapshot dữ liệu cũ khi mở/chọn. Tải vùng có cờ đang khôi phục, không chạy nhánh tự thêm; chỉ cập nhật đúng ID đã chọn. Không tự xóa hay gộp các vùng người dùng đã có.
- Mặt bằng mới bắt đầu trống; vùng hình mẫu chưa lưu không được âm thầm thêm khi bắt đầu PL/REC. Chỉ khép PL/REC mới, lưu vùng mới rõ ràng hoặc thêm lỗ vào một hình chưa lưu mới tạo record.
- SELECT là thao tác mặc định trên canvas. Chọn vùng không nhảy pan/zoom. Click nền trống bỏ chọn, không bật vẽ; click lặp tại phần chồng để lần lượt chọn vùng bị che. Shift+click chọn/bỏ chọn nhiều vùng.
- MOVE có bước điểm gốc → điểm đích, hình xem trước và Esc hủy. Chuyển cùng lỗ, DIM, tròn tham chiếu, viền và điểm nối thủ công; giữ ID, sản phẩm/cao độ. Vùng khác giữ vị trí.
- PL/REC mới và đích MOVE bị chặn khi chồng diện tích trần vùng khác. Kiểm tra giao vùng bằng các lát cắt tại đỉnh/cực trị/giao đường biên, kể cả cung tròn của lỗ; không chỉ lấy vài điểm thử trên cạnh. Tiếp xúc cạnh được phép, vùng nằm hoàn toàn trong lỗ của vùng khác được phép. Cảnh báo cả hai vùng được cập nhật sau di chuyển/xóa.
- Lỗ tròn có hướng dẫn chọn tâm và ô **Bán kính (mm)**. Chọn tâm rồi click điểm trên vòng tròn, hoặc nhập bán kính và Enter/**Tạo đường tròn**. Bán kính 0 bị chặn nhưng giữ tâm để nhập lại. Không dùng biên ngoài làm biên phác lỗ tròn.

## Dùng SELECT / MOVE

1. Gõ `SELECT`/`SEL` hoặc bấm **SELECT · Chọn**, click phần trần/đường bao. Có thể chọn từ nút **Sửa** trong danh sách vùng.
2. Vùng chọn có nét xanh đứt và các ô đỉnh. Nếu bị che, click lặp tại cùng chỗ để chuyển vùng dưới con trỏ; Shift chọn nhiều. Kiểm tra tên vùng và số vùng đã chọn trong phần thuộc tính.
3. Gõ `M`/`MOVE`, chọn điểm gốc rồi điểm đích. Khung xem trước xanh là hợp lệ, đỏ là chồng vùng. Có thể dùng F8 khóa hướng và OSNAP; Esc hủy mà không đổi vị trí.
4. Ví dụ dịch 6 m sang phải theo đơn vị lệnh mm:

```text
M
0,0
@6000,0
```

Tọa độ nhập theo X phải/Y lên như CAD; `@dx,dy` là độ dịch tương đối. Đơn vị mặc định mm, đổi được sang m. MOVE chuyển các đối tượng được chọn trong cùng mặt phẳng, không tạo bản sao. Nếu cả nhóm đang chồng nhau, cần chuyển từng vùng ra trước; di chuyển cả nhóm không giải quyết phần chồng bên trong nhóm.

`U`/`REDO` hoàn tác/làm lại thao tác MOVE đã hoàn tất. Khi MOVE đang chạy, `U` chọn lại điểm gốc. **Viền**/`TRIM` chuyển sang chế độ click cạnh để đổi viền; SELECT trở về chọn vùng. Mỗi vùng cũ vẫn có thể được chọn để di chuyển dù hiện đang chồng.

## Dùng lỗ tròn

Chọn vùng → **Lỗ tròn**/`HC` → click tâm → click điểm trên vòng tròn. Hoặc chọn tâm, nhập ví dụ `300` / `0.3m` trong ô **Bán kính (mm)** rồi Enter/**Tạo đường tròn**. R300 nghĩa là bán kính 300 mm, đường kính 600 mm.

`C/CIRCLE` vẫn tạo đường tròn tham chiếu, **HC** tạo lỗ trừ vật tư. Vùng trần ngoài hình tròn chưa được triển khai trong bản này. Lỗ phải nằm hoàn toàn trong vùng và không chồng/chạm lỗ khác. Mặc định vẫn trừ tấm, xương và ty theo lựa chọn đã chốt.

## Dữ liệu cũ và kiểm chứng

Giữ dữ liệu người dùng; không tự xóa các record trùng hoặc tự dời hình đã vẽ. Với các vùng đang chồng trong v18.3, dùng SELECT → M để sắp xếp lại, hoặc xóa record dư bằng nút Xóa nếu xác nhận đó là bản thừa. Xuất bảng bị chặn khi mặt bằng còn chồng, tránh cộng trùng tổng QS.

File `outputs/ALU-MASTER-v18.3.html` đang dùng được sao lưu trước khi cập nhật bằng mã v18.4, để tải lại đúng đường dẫn cũ và giữ cơ chế lưu của trình duyệt. Có thêm bản riêng `ALU-MASTER-v18.4.html`. Khi chuyển máy/trình duyệt/đường dẫn, dùng JSON dự án để chuyển dữ liệu; giữ file cũ/backup tới khi kiểm tra lại đủ vùng và lỗ.

**97 kiểm tra đạt**: chạy `node --test tests/regression.test.mjs tests/cad-workflow.test.mjs tests/plan.test.mjs tests/region-editing.test.mjs`. Bài kiểm tra mới dùng Engine/CAD/Plan thực với DOM mô phỏng: dữ liệu cũ thiếu zoneId, chọn/lưu/tính lặp, click nền, chọn vùng chồng, MOVE một/nhóm vùng, giữ lỗ/khối lượng/quy cách/điểm nối, đích chồng bị chặn, U/REDO, HC hai điểm và HC bằng ô bán kính.

Đã kiểm tra UI Edge/localhost ở **1191 × 668**: đổi vùng lặp vẫn 3 vùng, click canvas chọn, MOVE hai click, lỗ tròn bằng tâm + bán kính và hai click chuột. Mã HTML gộp được kiểm tra qua localhost; chưa điều khiển trực tiếp file:// trong lượt này. Các giới hạn QS/cắt theo tuyến tâm, gia cường quanh lỗ, nhập PDF/DXF và nghiệm thu AutoCAD/Excel vẫn như tài liệu trước.
