# ALU-MASTER STUDIO

## Bản nâng cấp v18.5 — ứng viên kiểm tra

Giao diện: khu vực bên trái, bản vẽ trung tâm, thuộc tính bên phải và QS bên dưới; lớp vật tư bật/tắt độc lập, bảng Lắp đặt/Cắt cây/Đặt mua/Cảnh báo, tìm vật tư và menu xuất tập trung. Xem [ghi chú giao diện](docs/UI-v18.1.md).

Chạy `node server.mjs`, mở `http://127.0.0.1:8765`. Kiểm thử: `node --test tests/regression.test.mjs tests/cad-workflow.test.mjs tests/plan.test.mjs tests/region-editing.test.mjs`. Node >=20, không cần cài dependency.

Đã sửa kết quả CSV/lưu–mở, quy tắc xương/ty 150 mm và ngưỡng bù >300 mm; thêm cao độ ty, bảng cắt cây, Excel và DXF xuất. Xem [phạm vi và giới hạn v18](docs/RELEASE-v18.md). v18.2 bổ sung nhập thông số có đơn vị, PL/REC/C, F8, OSNAP, DIM/DIST, nhập DXF ASCII và nền PDF/ảnh có hiệu chuẩn. Xem [hướng dẫn CAD và giới hạn](docs/CAD-v18.2.md). v18.3 thêm nhiều vùng trên cùng mặt bằng, lỗ đa giác/chữ nhật/tròn và trừ tấm/xương/ty theo từng lỗ. Xem [hướng dẫn nhiều vùng và lỗ](docs/PLAN-v18.3.md). v18.4 sửa đổi vùng sinh bản sao, bổ sung SELECT/MOVE một hoặc nhiều vùng, kiểm tra chồng và ô bán kính lỗ tròn. Xem [hướng dẫn SELECT/MOVE](docs/SELECT-MOVE-v18.4.md). v18.5 ổn định trạng thái nút, Hoàn tất/Hủy, đổi công cụ/đổi vùng, Ctrl+Z/Y và giảm tính/lưu lặp. Xem [hướng dẫn thao tác v18.5](docs/INTERACTION-v18.5.md). Hướng rải tùy ý, gia cường tự động và backend mới vẫn nằm trong lộ trình.

**Công cụ bóc khối lượng trần nhôm chuyên nghiệp.**

Ứng dụng web giúp kỹ sư bóc tách khối lượng, lập bảng kê vật tư (BOQ) và sơ đồ cắt tấm cho các hệ trần nhôm linear một cách nhanh chóng và chính xác.

## Tính năng chính

- 📐 **Vẽ mặt bằng**: Nhập tọa độ hoặc vẽ trực tiếp trên canvas.
- 🧮 **Tính toán tự động**: Tối ưu hóa sơ đồ cắt tấm, tính toán số lượng xương, điểm treo và phụ kiện.
- 💾 **Lưu trữ thông minh**:
  - Tự động lưu trạng thái làm việc vào LocalStorage.
  - Xuất/Nhập dự án dưới định dạng file `.json`.
- 📊 **Xuất báo cáo**:
  - Xuất bảng kê (BOQ) chi tiết cho từng phòng.
  - Tổng hợp khối lượng cho toàn bộ dự án ra file Excel (CSV).

## Công nghệ sử dụng

- **Frontend**: HTML5, CSS3 (Vanilla), JavaScript (ES6 Modules).
- **Icons**: Lucide Icons.
- **Persistence**: Browser LocalStorage.

## Hướng dẫn cài đặt & Sử dụng

1. **Clone repo**: `git clone https://github.com/phonvinh2001-prog/BocKhoiLuongTranNhomLinear.git`
2. **Mở ứng dụng**: Chạy `node server.mjs` rồi mở `http://127.0.0.1:8765`; hoặc sử dụng Live Server. Bản mã nguồn ES Modules cần HTTP server.
3. **Sử dụng**:
   - Nhập tham số kỹ thuật (bản rộng tấm, bước xương, hệ số hao hụt...).
   - Vẽ mặt bằng phòng.
   - Nhấn **TÍNH TOÁN** để xem kết quả.
   - Nhấn **XUẤT QS** để xem bảng khối lượng và xuất file Excel.

## Cấu trúc thư mục

- `/js`: Chứa logic xử lý (Engine, Rendering, Utils).
- `/css`: Chứa mã nguồn giao diện.
- `/.brain`: Chứa bộ nhớ ngữ cảnh của AI (AWF).
- `/docs`: Tài liệu hướng dẫn và kế hoạch phát triển.

---

_Phát triển bởi ALU-MASTER Team._

