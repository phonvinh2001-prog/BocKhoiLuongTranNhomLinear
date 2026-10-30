# Nhiều vùng trần và lỗ kỹ thuật — v18.3

Khép kín một vùng không kết thúc mặt bằng. Mỗi vùng có ID, thông số trần, kết quả và danh sách lỗ riêng. Vùng đang chọn hiện vật tư chi tiết; các vùng còn lại vẫn hiện đường bao, tên và lỗ làm tham chiếu. Vùng khép kín hợp lệ tự lưu/cập nhật vào danh sách dự án.

## Dùng nhanh

1. Vẽ vùng trần bằng **PL/REC**, khép bằng **C**. Vùng đang có được giữ trong dự án trước khi bắt đầu vùng mới.
2. Để vẽ tiếp: chọn **+ Vùng trần**, **+ Vùng chữ nhật**, nút **+ Vùng mới**, hoặc gõ **PL/REC** lần nữa. Không ghi đè vùng trước. Vùng mẫu đang hiển thị cũng được giữ; xóa vùng mẫu nếu không dùng.
3. Chọn vùng cần khoét bằng nút **Sửa** trong danh sách hoặc click vào phần trong vùng trên canvas.
4. Chọn **Lỗ đa giác** (`HOLE`, alias `HPL`), **Lỗ chữ nhật** (`HREC`) hoặc **Lỗ tròn** (`HC`). Vẽ bên trong vùng; PL cần `C`, REC cần hai góc, HC cần tâm và bán kính/điểm trên vòng tròn. **C/CIRCLE** thông thường vẫn là đường tròn tham chiếu; dùng **HC** để khoét lỗ.
5. Mặc định lỗ mới **trừ tấm, xương và ty**, theo lựa chọn đã chốt. Có thể đổi riêng mỗi lỗ thành **Chỉ tấm**, hoặc xóa bằng nút ✕. Xóa rồi vẽ lại để thay hình dạng/vị trí lỗ.
6. `U`/`REDO` hoàn tác/làm lại thao tác hoàn tất trên mặt bằng trong phiên (tối đa 20 mốc). Khi đang vẽ PL, `U` lùi từng điểm. `Esc` hủy phần đang vẽ, giữ vùng/lỗ đã hoàn tất. Lịch sử hoàn tác không lưu qua lần tải lại trang.
7. **Vừa khung / Z** xem toàn mặt bằng; **Vùng chọn / ZA** phóng vừa vùng đang sửa.

Ví dụ vùng 4 × 3 m:

```text
PL
0,0
4000,0
4000,3000
0,3000
C
HREC
1000,1000
2000,2000
```

Diện tích bao 12 m², lỗ 1 m², trần net **11 m²**. Vẽ thêm `HC`, tâm `3000,1000`, bán kính `250`: lỗ tròn có diện tích π × 0,25², trần net **10,804 m²** khi làm tròn ba số.

Vùng tiếp theo, ví dụ `PL → 5000,0 → 9000,0 → 9000,3000 → 5000,3000 → C`, được giữ cùng vùng đầu. Các vùng có thể dùng sản phẩm, hướng rải và cao độ khác nhau. Chọn **Các vùng đã lưu** để xem/xuất bảng dự án. CSV/XLSX có diện tích bao, từng lỗ và diện tích net bên cạnh vật tư. DXF hiện vẫn xuất bố trí **vùng đang xem**, có lỗ ở lớp `QS-LO-XUYEN-TRAN` hoặc `QS-LO-TAM`.

## Cách tính

- Diện tích trần = diện tích biên ngoài − tổng diện tích lỗ. Lỗ tròn tính diện tích bằng πr², giao tuyến bằng phương trình đường tròn, không xấp xỉ bằng đa giác.
- EXACT: trừ các khoảng lỗ trên tia rải tấm; lỗ xuyên trần cũng ngắt tuyến xương và phân bố lại ty trên các đoạn còn lại. Lỗ chỉ tấm giữ xương/ty. Không đặt ty trong phần rỗng của lỗ xuyên trần.
- Quy tắc biên xương/ty 150 mm và ngưỡng bù >300 mm áp cho mỗi đoạn xương còn lại. Đoạn ngắn cần cấu tạo riêng vẫn có cảnh báo.
- NORM: diện tích trừ lỗ dùng cho tấm; diện tích chỉ trừ lỗ xuyên trần dùng cho xương/ty. Đây vẫn là định mức tham khảo.
- Viền lỗ đa giác mặc định NONE. Có thể click cạnh lỗ để gán viền như cạnh ngoài; thêm/xóa lỗ không làm mất loại viền ngoài đã gán. Viền cong và hệ gia cường quanh lỗ chưa tự sinh.
- Mặt nhôm và cut list vẫn theo các tuyến tâm thanh. Lỗ tròn/lỗ xiên hoặc chỉ cắt một phần bề rộng thanh cần bản triển khai cắt/khoét chi tiết; không dùng cut list chiều dài làm bản gia công hoàn chỉnh.

## Kiểm tra hình và lưu dữ liệu

Lỗ phải hoàn toàn trong vùng, không chạm/cắt biên ngoài. Các lỗ không được chồng, chứa nhau hoặc chạm nhau, tránh trừ trùng. Phần khuyết thông ra mép cần thể hiện bằng biên ngoài. Mỗi vùng tối đa 200 lỗ; biên đa giác tối đa 2.000 đỉnh. Vùng chồng diện tích có cảnh báo trong bảng QS và phần thuộc tính; công cụ không tự hợp nhất các vùng mang quy cách khác nhau. Cần giải quyết cảnh báo trước khi dùng tổng dự án.

JSON lưu lỗ, ID vùng, tên và kết quả theo từng vùng. Mở lại chọn đúng vùng đang sửa, không thêm bản sao khi lưu tiếp. Lỗ đang vẽ chưa hoàn tất chưa được ghi như một lỗ hợp lệ; tải lại trang sẽ bỏ phần phác lỗ đó. Nên lưu JSON dự án khi làm việc với ảnh/PDF lớn do giới hạn LocalStorage. Dữ liệu dự án cũ được giữ; các phòng trước đây cùng tọa độ có thể hiện chồng nhau trên mặt bằng mới.

## Đã kiểm tra

Chạy `node --test tests/regression.test.mjs tests/cad-workflow.test.mjs tests/plan.test.mjs` — **81 kiểm tra đạt**. Bao gồm diện tích/giao tuyến, lỗ đa giác/tròn, containment/chồng lỗ, hai hướng rải, EXACT/NORM, ty ngoài lỗ, phạm vi chỉ tấm, giữ viền, snapshot từng vùng và xuất DXF/diện tích.

Qua Edge/localhost: lỗ chữ nhật 1 m², lỗ tròn R250 mm, thêm vùng khác, chọn lại vùng cũ, U/REDO, tải lại trang, chặn lỗ chạm biên và Esc không mất vùng/lỗ. Không lỗi console trong lượt kiểm tra này. Chưa nghiệm thu file xuất trong AutoCAD/Excel hoặc gia công thực tế. Nhập PDF/DXF qua hộp chọn file vẫn là phần nghiệm thu tồn từ v18.2; không thay đổi bộ đọc trong lượt này.
