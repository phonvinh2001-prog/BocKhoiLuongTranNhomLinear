// ============ CÔNG CỤ TRỰC QUAN LỚPPHỦ (VISUAL OVERLAY EXTENSION) ============
// [FILE] js/VisualOverlay.js
// [CÔNG DỤNG] Vẽ thêm kích thước & chi tiết lên bản vẽ để kiểm tra
// [THI CÔNG] Dùng để công nhân/kỹ sư kiểm tra lại kích thước trước thi công
// [KIẾN TRÚC] Extension pattern - móc nối (hook) vào hàm draw() của Engine
//
// [TÍNH NĂNG]
// 1. "👁️ SOI KÍCH THƯỚC" - Nút bấm bật/tắt chế độ xem chi tiết
// 2. Hiển thị kích thước từng mảnh tấm (VD: 4.5m, 1.2m)
// 3. Đánh dấu vị trí nối tấm bằng dấu × màu cam (để thợ biết chỗ nối)
// 4. Hiển thị kích thước cạnh tường (để kiểm tra đo đạc)

export default class VisualOverlay {
  // --- CONSTRUCTOR: KHỞI TẠO OVERLAY ---
  // [CÔNG DỤNG] Khi khởi động app, tạo overlay extension
  // [THAM SỐ] engineInstance: Tham chiếu đến Engine chính (để truy cập state, ctx)
  constructor(engineInstance) {
    // [LƯU THAM CHIẾU] Lưu lại Engine để gọi các hàm sau này
    this.app = engineInstance; // Tham chiếu đến Core Engine

    // [TRẠNG THÁI] Mặc định BẬT (⭐ ALWAYS-ON)
    // [SỬA ĐỔI] Từ false → true để hiển thị dimension labels tự động
    this.isActive = true; // true = hiển thị overlay luôn, không cần bấm nút

    // [❌ KHÔNG CẦN] Loại bỏ injectUI() - không cần nút toggle nữa

    // [BƯỚC 2] HOOKING: Móc nối vào hàm draw() của Engine
    // [LÝ DO] Muốn overlay vẽ TRÊN CÙNG (sau khi draw() xong)
    // [KỸ THUẬT] Lưu hàm gốc, rồi ghi đè bằng hàm mới
    const originalDraw = this.app.draw.bind(this.app);

    // [GHI ĐÈ] Hàm draw mới = draw gốc + render overlay (luôn chạy vì isActive=true)
    // [QUY TRÌNH]
    // 1. Chạy draw gốc: Vẽ sàn, tấm, xương, ty (bình thường)
    // 2. Nếu overlay bật (isActive=true) → Vẽ đè kích thước lên trên
    this.app.draw = () => {
      originalDraw(); // Chạy quy trình vẽ tiêu chuẩn (Sàn, Tấm, Xương, Ty)
      if (this.isActive) this.renderLayer(); // Luôn chạy vì isActive=true
    };
  }

  // --- VẼ LỚP PHỦ CHI TIẾT (RENDER DETAIL LAYER) ---
  // [CÔNG DỤNG] Vẽ thêm kích thước, dấu nối, chú thích lên canvas
  // [THI CÔNG] Vẽ TRÊN CÙNG (sau draw gốc) để không bị che
  // [OUTPUT] Canvas hiển thị kích thước chi tiết + dấu vị trí nối
  // [CHỈ CHẠY KHI] this.isActive = true
  renderLayer() {
    const ctx = this.app.ctx; // Lấy canvas context từ Engine
    const state = this.app.state; // Lấy state (points, strips, edges, carriers, hangers)

    // [SAVE STATE] Lưu trạng thái canvas hiện tại (sẽ restore sau)
    ctx.save();

    // [TRANSFORM] Đồng bộ hệ tọa độ với bản vẽ chính
    // [LÝ DO] Canvas có pan/zoom, phải apply cùng transform
    ctx.translate(state.panX, state.panY); // Dịch chuyển theo pan
    ctx.scale(state.scale, state.scale); // Phóng to/thu nhỏ theo zoom

    // [FONT] Đặt font để vẽ text kích thước
    ctx.font = "0.12px Arial"; // Kích thước chữ = 0.12m (khoảng 120px khi scale=1000)
    ctx.textAlign = "center"; // Căn giữa text
    ctx.textBaseline = "middle"; // Căn giữa theo chiều dọc

    // [PHẦN A] DUYỆT QUA CÁC STRIP (DẢI TẤM) - HIỂN THỊ KÍCH THƯỚC TẤM
    // [BÓC TÁCH] Mỗi strip chứa nhiều pieces (mảnh tấm cắt)
    state.strips.forEach((s) => {
      let currentPos = 0; // Con trỏ vị trí hiện tại dọc strip
      s.pieces.forEach((p) => {
        // [TÍNH TÂM] Tọa độ tâm của từng mảnh tấm (để đặt text kích thước)
        let cx, cy;
        if (s.isVert) {
          // [TẤM ĐỨNG] Hướng dọc
          cx = s.pos + s.width / 2; // Tâm X = giữa bề rộng
          cy = s.start + currentPos + p.len / 2; // Tâm Y = giữa chiều dài
        } else {
          // [TẤM NGANG] Hướng ngang
          cx = s.start + currentPos + p.len / 2; // Tâm X = giữa chiều dài
          cy = s.pos + s.width / 2; // Tâm Y = giữa bề rộng
        }

        // [HIỂN THỊ TEXT KÍCH THƯỚC] Chỉ hiện nếu mảnh tấm đủ dài (> 300mm)
        // [LÝ DO] Mảnh quá nhỏ (<300mm) → text sẽ bị che mất
        if (p.len > 0.3) {
          ctx.fillStyle = "rgba(255,255,255,0.7)"; // Nền chữ mờ (trắng 70% opacity)
          // VẼ TEXT kích thước (VD: "4.50" m)
          // (Tạm comment để không bị rối, có thể bỏ comment để hiển thị)
          // ctx.fillText(p.len.toFixed(2), cx, cy);
        }

        // [ĐÁN HIỆU VỊ TRÍ NỐI TẤM] Đặt dấu × tại điểm nối
        // [THI CÔNG] Quan trọng: Công nhân cần biết chính xác chỗ nào cần nối
        // [ĐIỀU KIỆN] Nếu mảnh này không phải là mảnh cuối → có nối ở đuôi
        if (p.len + currentPos < s.totalLen - 0.01) {
          // [TÍNH VỊ TRỊ NỐI] Vị trí cuối của mảnh hiện tại = điểm nối
          let jx, jy;
          if (s.isVert) {
            // [TẤM ĐỨNG] Nối nằm ở giữa chiều rộng, cuối chiều dài
            jx = s.pos + s.width / 2;
            jy = s.start + currentPos + p.len;
          } else {
            // [TẤM NGANG] Nối nằm ở cuối chiều dài, giữa chiều rộng
            jx = s.start + currentPos + p.len;
            jy = s.pos + s.width / 2;
          }

          // [VẼ DẤU ×] Vẽ 2 đường chéo tạo hình ×
          ctx.beginPath();
          const r = 0.06; // Bán kính dấu × (0.06m = 60mm)
          ctx.moveTo(jx - r, jy - r); // Đường chéo 1: từ trái trên → phải dưới
          ctx.lineTo(jx + r, jy + r);
          ctx.moveTo(jx + r, jy - r); // Đường chéo 2: từ phải trên → trái dưới
          ctx.lineTo(jx - r, jy + r);
          ctx.strokeStyle = "#FFC107"; // Màu cam (nổi bật)
          ctx.lineWidth = 0.04; // Độ dày đường
          ctx.stroke(); // Vẽ
        }

        // [CẬP NHẬT CON TRỎ] Thêm chiều dài mảnh vào con trỏ
        currentPos += p.len;
      });
    });

    // [PHẦN B] HIỂN THỊ KÍCH THƯỚC CẠNH TƯỜNG (SMART LABELING)
    // [THI CÔNG] Chỉ hiển thị dimensions quan trọng nhất (để không rối)
    // [VỊ TRÍ] Text hiển thị ở tâm của từng cạnh tường
    // [TỐI ƯU] Smart font scaling - font size tự động adjust theo zoom level
    const fontSize = Math.max(0.1, 0.15 / Math.sqrt(state.scale / 50));
    ctx.font = `bold ${fontSize}px Arial`;

    state.edges.forEach((e) => {
      // [TÍNH TÂM & CHIỀU DÀI]
      const mx = (e.p1.x + e.p2.x) / 2; // Tâm X của cạnh
      const my = (e.p1.y + e.p2.y) / 2; // Tâm Y của cạnh
      const len = Math.sqrt(
        Math.pow(e.p2.x - e.p1.x, 2) + Math.pow(e.p2.y - e.p1.y, 2),
      ); // Chiều dài cạnh

      // Chỉ hiển thị cho cạnh đủ dài (> 0.5m)
      if (len > 0.5) {
        // [VẼ NỀN MỜ] Để dễ đọc
        ctx.fillStyle = "rgba(255,255,255,0.8)";
        ctx.fillRect(mx - 0.3, my - 0.08, 0.6, 0.16);

        // [VẼ TEXT] IBM Blue cho professional look
        ctx.fillStyle = "#0F62FE";
        ctx.fillText(len.toFixed(2) + "m", mx, my);
      }
    });

    (state.carrierJoints||[]).forEach(p=>{ctx.strokeStyle='#b45309';ctx.lineWidth=0.025;ctx.strokeRect(p.x-0.06,p.y-0.06,0.12,0.12);});
    // [RESTORE STATE] Khôi phục trạng thái canvas ban đầu
    ctx.restore();

    // [❌ LOẠI BỎ] Không cần legend nữa vì luôn hiển thị
  }
}

