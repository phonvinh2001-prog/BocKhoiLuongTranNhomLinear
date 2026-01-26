// ============ HẰNG SỐ HỆTHỐNG (CONSTANTS) ============
// [FILE] js/constants.js
// [CÔNG DỤNG] Định nghĩa các hằng số toàn cục cho hệ thống nhôm LINEAR
// [PHẠM VI] Kiểu viền, hệ thống đơn vị, công thức tính toán cố định
//
// [THI CÔNG] Các hằng số này là "quy chuẩn công trình" không thay đổi:
// - Kích thước tiêu chuẩn của viền (V-Góc 25x25mm, Shadow 15mm)
// - Màu sắc hiển thị trên canvas (đỏ=V-Góc, tím=Shadow, xanh=Fascia)
// - Định nghĩa loại viền (WALL_V, SHADOW, FASCIA, NONE)
//
// [LƯU Ý] Các hằng số này được export để các file khác (Engine.js, main.js) import dùng

// [ĐỊNH NGHĨA LOẠI VIỀN] EDGE_TYPES = Dictionary ánh xạ tên → thông tin
// [CÔNG DỤNG] Khi vẽ viền trên canvas, lấy màu từ EDGE_TYPES[edgeType].color
// [KỸ THUẬT] Dùng cấu trúc object với các field: id, color, name, code
export const EDGE_TYPES = {
  // [VIỀN 1] V-GÓC - Thanh góc 25x25mm
  // [THI CÔNG] Dùng ở góc/viền tường, định vị, chống xê dịch tấm
  // [HIỂN THỊ] Vẽ bằng màu đỏ (#D32F2F) để nhận diện trên canvas
  // [CODE] "W-V25" = Wall V-angle 25mm, dùng cho lệnh sản xuất
  WALL_V: {
    id: 0, // [ID] Mã số định danh (0)
    color: "#D32F2F", // [MÀU] Đỏ - phân biệt loại viền trên canvas
    name: "V-Góc 25x25", // [TÊN] Tiêu chuẩn: thanh V-Góc size 25mm x 25mm
    code: "W-V25", // [CODE] Mã lệnh cho nhà máy cắt (Wall V-angle 25)
  },

  // [VIỀN 2] SHADOW GAP - Thanh bóng/khe 15mm
  // [THI CÔNG] Lắp dọc các cạnh tường, tạo "bóng" giữa tấm và tường (ẩn lớp gạch)
  // [HIỂN THỊ] Vẽ bằng màu tím (#7B1FA2) để nhận diện riêng
  // [CODE] "W-Z15" = Wall Z-profile 15mm, dùng cho lệnh sản xuất
  SHADOW: {
    id: 1, // [ID] Mã số định danh (1)
    color: "#7B1FA2", // [MÀU] Tím - phân biệt loại viền trên canvas
    name: "Shadow Gap (Z)", // [TÊN] Thanh Z-profile (che khe) 15mm
    code: "W-Z15", // [CODE] Mã lệnh cho nhà máy cắt (Wall Z-profile 15)
  },

  // [VIỀN 3] FASCIA - Tấm mặt dựng
  // [THI CÔNG] Lắp ở phía trước/ngoài trần, che chắn xương/ty, tạo hình thể hoàn chỉnh
  // [VẬT LIỆU] Có thể là kính, nhôm composite, hay bê tông, tuỳ thiết kế
  // [HIỂN THỊ] Vẽ bằng màu xanh (#0288D1) để nhận diện riêng
  // [CODE] "F-OPEN" = Fascia Open (không che), dùng cho lệnh sản xuất
  FASCIA: {
    id: 2, // [ID] Mã số định danh (2)
    color: "#0288D1", // [MÀU] Xanh - phân biệt loại viền trên canvas
    name: "Fascia/Kính (Hở)", // [TÊN] Tấm mặt dựng (kính hoặc composite)
    code: "F-OPEN", // [CODE] Mã lệnh cho nhà máy cắt (Fascia Open)
  },


  // [VIỀN 4] NONE - Không lắp viền
  // [THI CÔNG] Cạnh tường này không lắp viền (tiết kiệm chi phí)
  // [HIỂN THỊ] Vẽ bằng màu xám nhạt (#B0BEC5) để nhận diện là "rỗng"
  // [CODE] "NONE" = Không có viền, không lệnh sản xuất
  NONE: {
    id: 3, // [ID] Mã số định danh (3)
    color: "#B0BEC5", // [MÀU] Xám nhạt - để chỉ "không có" viền
    name: "Không viền", // [TÊN] Cạnh không lắp viền
    code: "NONE", // [CODE] Không gửi lệnh sản xuất
  },
};

// [HẰNG SỐ THI CÔNG] Các thông số tiêu chuẩn xây dựng
// [CÔNG DỤNG] Tập trung các giá trị hardcoded để dễ bảo trì
export const CONSTRUCTION_STD = {
  SAFE_DIST_FROM_WALL: 0.3, // [M] Khoảng cách an toàn từ tường (300mm)
  CARRIER_BAR_LENGTH: 3.0, // [M] Chiều dài thanh xương chuẩn (3m)
  V_ANGLE_BAR_LENGTH: 3.0, // [M] Chiều dài thanh V-Góc chuẩn (3m)
  DEFAULT_WASTE_PCT: 3, // [%] Hao hụt mặc định
  DRAWING_PRECISION: 100, // [HeSo] 100 = 1cm, 10 = 10cm, 1000 = 1mm
};
