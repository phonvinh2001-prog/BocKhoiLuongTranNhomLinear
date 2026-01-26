# ALU-MASTER STUDIO

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
2. **Mở ứng dụng**: Mở file `index.html` trực tiếp trên trình duyệt hoặc sử dụng Live Server.
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
