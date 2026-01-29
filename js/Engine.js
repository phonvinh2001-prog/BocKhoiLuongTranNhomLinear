/* 
[FILE: ENGINE.JS] - LÕI TÍNH TOÁN TRẦN NHÔM LINEAR
============================================================
Công dụng: Xử lý hình học, tính toán rải tấm, bóc tách vật tư, quản lý project
Luồng chính:
  1. [HÌNH HỌC] Nhập mặt bằng (chữ Nhật/L hoặc vẽ tự do)
  2. [RẢI TẤM] Rải các dãy tấm trần linear theo hướng dọc/ngang
  3. [CẮTỬ] Chia tấm thành từng mảnh ≤ chiều dài nhôm tối đa
  4. [SPLIT] Nếu mảnh > giới hạn vận chuyển → chia nhỏ + đếm splicer
  5. [KẾT CẤU] Tính vị trí xương gài & ty treo (treo tấm từ trần cũ)
  6. [BÓC TÁCH] Gom nhóm vật tư, áp dụng hệ số an toàn, tính BOQ
  7. [QUẢN LÝ] Lưu multiple phòng, merge BOQ project

Quy ước màu & trạng thái:
  - Tấm xanh (#E3F2FD): OK - chấp nhận
  - Tấm đỏ (#FFEBEE): BAD - dưới ngưỡng Min Cắt (phế phẩm)
  - Viền đỏ: V-Góc (nẹp chuẩn)
  - Viền tím: Shadow Gap (khe hắt)
  - Viền xanh: Fascia (tấm bịt)
  - Viền xám: Không viền (hở tường)

Đơn vị:
  - Tất cả tính toán tấm: MÉT (m)
  - Input từ UI: mm (millimeter) → convert sang m
*/

// 1. NHẬP CÁC PHỤ TÙNG CẦN THIẾT
import { EDGE_TYPES, CONSTRUCTION_STD } from "./constants.js"; // Nhập định nghĩa vật tư
import { distToSeg, saveToStorage, loadFromStorage } from "./utils.js"; // Nhập công cụ tính toán & storage
import PreviewRenderer from "./PreviewRenderer.js"; // Nhập renderer cho preview panel

// 2. XUẤT CLASS ĐỂ MAIN.JS CÓ THỂ DÙNG
export default class Engine {
  constructor() {
    this.cvs = document.getElementById("cvs");
    this.ctx = this.cvs.getContext("2d");
    this.cont = document.getElementById("cont");
    this.currentPreset = null;
    this.totalArea = 0;
    this.userPresets = [];

    // [TRẠNG THÁI HỆ THỐNG] Chứa toàn bộ dữ liệu tính toán
    this.state = {
      points: [], // [HÌNH HỌC] Các điểm góc của mặt bằng
      edges: [], // [HÌNH HỌC] Các cạnh tường (có loại viền)
      strips: [], // [TẤM TRẦN] Danh sách các dãy tấm (pos, pieces[], totalLen)
      carriers: [], // [XƯƠNG] Danh sách thanh xương gài (x1, y1, x2, y2, len)
      hangers: [], // [TY TREO] Danh sách điểm treo ty
      // [QUẢN LÝ DỰ ÁN]
      editingIndex: null, // null = thêm mới; number = sửa dự án thứ N
      projectZones: [], // Mảng lưu các phòng: {id, name, ts, savedState, stats}
      // [VẼ & VIEW]
      scale: 40, // Hệ số phóng to (px/mét)
      panX: 50, // Offset X từ trái canvas
      panY: 50, // Offset Y từ trên canvas
      mode: "IDLE", // "IDLE" | "DRAW" | ...
      isDrag: false, // Đang kéo canvas?
      lastM: { x: 0, y: 0 }, // Vị trí chuột lần trước
      inputMode: "PRESET", // "PRESET" (nhập hình mẫu) hoặc "FREE" (vẽ tự do)
    };

    // [DATA PERSISTENCE] Cấu hình lưu trữ
    this.STORAGE_KEY = "ALUMASTER_V17_STATE";
    this.saveTimeout = null;

    this.resize();
    this.bindEvents();
    this.loadPresets();

    // Khởi tạo preview renderer
    this.previewRenderer = new PreviewRenderer("previewCanvas");

    this.preset();
  }

  // [HELPER] Show feedback to user in UI
  showFeedback(message, type = "info") {
    const coordsEl = document.getElementById("coords");
    if (coordsEl) {
      const icon =
        type === "error"
          ? "❌"
          : type === "warning"
            ? "⚠️"
            : type === "success"
              ? "✅"
              : "ℹ️";
      coordsEl.innerHTML = `${icon} ${message}`;
      coordsEl.style.color =
        type === "error"
          ? "#d32f2f"
          : type === "warning"
            ? "#f57c00"
            : type === "success"
              ? "#2e7d32"
              : "#666";

      // Auto-clear
      setTimeout(() => {
        coordsEl.innerHTML = "Ready.";
        coordsEl.style.color = "";
      }, 3000);
    }
    console.log(`[${type.toUpperCase()}] ${message}`);
  }

  // [HELPER] Lấy giá trị input an toàn với validation
  // [FIX #1] Thêm NaN handling và UI feedback
  getInputValue(id, min = 0, max = Infinity, fallback = 0, showError = false) {
    const el = document.getElementById(id);
    if (!el) return fallback;

    let val = parseFloat(el.value);

    // [FIX #1] NaN handling với UI feedback
    if (isNaN(val) || el.value.trim() === "") {
      if (showError) {
        el.classList.add("error");
        console.warn(
          `⚠️ Input "${id}" không hợp lệ, sử dụng giá trị mặc định ${fallback}`,
        );
      }
      return fallback;
    }

    // Remove error class if value is valid
    el.classList.remove("error", "warning");

    // [FIX #3] Bounds checking
    if (val < min) {
      if (showError) {
        el.classList.add("warning");
        console.warn(
          `⚠️ Input "${id}" quá nhỏ (${val} < ${min}), sử dụng min ${min}`,
        );
      }
      return min;
    }
    if (val > max) {
      if (showError) {
        el.classList.add("warning");
        console.warn(
          `⚠️ Input "${id}" quá lớn (${val} > ${max}), sử dụng max ${max}`,
        );
      }
      return max;
    }

    return val;
  }

  // [CHUYỂN ĐỔI CHẾ ĐỘ] PRESET (hình mẫu) ↔ FREE (vẽ tự do)
  switchMode(mode) {
    this.state.inputMode = mode;

    // 1. Cập nhật UI (Ẩn/Hiện Tab)
    document.getElementById("ui_preset").style.display =
      mode === "PRESET" ? "block" : "none";
    document.getElementById("ui_free").style.display =
      mode === "FREE" ? "block" : "none";

    // Cập nhật nút Active
    document.getElementById("btn_tab_preset").className =
      mode === "PRESET" ? "tab-btn active" : "tab-btn";
    document.getElementById("btn_tab_free").className =
      mode === "FREE" ? "tab-btn active" : "tab-btn";

    // 2. Xử lý Logic
    if (mode === "PRESET") {
      this.state.mode = "IDLE"; // Thoát chế độ vẽ nếu đang vẽ dở
      this.preset(); // Load lại hình chữ nhật/L
    } else {
      // Chuyển sang Free: Xóa hình cũ để người dùng vẽ mới (hoặc giữ nguyên tùy bạn)
      this.state.points = [];
      this.state.strips = [];
      this.state.edges = [];
      this.draw();
      // Tự động kích hoạt vẽ luôn cho tiện
      this.resetDraw();
    }
  }

  bindEvents() {
    window.onresize = () => this.resize();
    this.cont.onmousedown = (e) => this.onDown(e);
    this.cont.onmousemove = (e) => this.onMove(e);
    this.cont.onmouseup = () => (this.state.isDrag = false);
    this.cont.onwheel = (e) => {
      e.preventDefault();
      const z = e.deltaY > 0 ? 0.9 : 1.1;
      this.state.scale *= z;
      this.draw();
    };
    this.cont.oncontextmenu = (e) => {
      e.preventDefault();
      if (this.state.mode === "DRAW") this.finishDraw();
    };

    // [FIX] BIND UI EVENTS DIRECTLY (REMOVE RELIANCE ON WINDOW.APP)
    // 1. Buttons
    this.bindClick("btn_calc", () => this.calculate());
    this.bindClick("btn_boq", () => this.showBOQ());
    this.bindClick("btn_project_boq", () => this.showProjectBOQ());
    this.bindClick("btn_addProject", () => this.addToProject());
    this.bindClick("btn_tab_preset", () => this.switchMode("PRESET"));
    this.bindClick("btn_tab_free", () => this.switchMode("FREE"));

    // 2. Preset UI
    this.bindChange("shp_type", () => this.preset());
    this.bindChange("l_orient", () => this.preset());
    this.bindChange("u_orient", () => this.preset());
    this.bindChange("dim_L", () => this.preset());
    this.bindChange("dim_W", () => this.preset());
    this.bindChange("dim_Lc", () => this.preset());
    this.bindChange("dim_Wc", () => this.preset());
    this.bindChange("dim_u_arm_1", () => this.preset());
    this.bindChange("dim_u_arm_2", () => this.preset());
    this.bindChange("dim_u_base", () => this.preset());

    // 3. Config UI
    this.bindChange("cfg_preset", () => this.applyPreset());
    this.bindChange("cfg_dir", () => this.calculate());
  }

  // [HELPER] Safe Binding
  bindClick(id, fn) {
    const el = document.getElementById(id);
    if (el) el.addEventListener("click", fn);
  }
  bindChange(id, fn) {
    const el = document.getElementById(id);
    if (el) el.addEventListener("change", fn);
  }

  loadPresets() {
    // [FIX] Use safe loadFromStorage wrapper
    let presets = loadFromStorage("USER_PRESETS");
    if (!presets) {
      // Khởi tạo danh sách mặc định
      presets = [
        { name: "C85", pW: 85, gW: 15, maxL: 6.0, color: "#E3F2FD" },
        { name: "U-Baffle", pW: 200, gW: 50, maxL: 4.0, color: "#FFF3E0" },
        { name: "G200", pW: 200, gW: 20, maxL: 6.0, color: "#F3E5F5" },
      ];
      saveToStorage("USER_PRESETS", presets);
    }
    this.userPresets = presets;
    this.updatePresetDropdown();
  }

  updatePresetDropdown() {
    const select = document.getElementById("cfg_preset");
    select.innerHTML = "";
    this.userPresets.forEach((p, i) => {
      const option = document.createElement("option");
      option.value = i;
      option.textContent = p.name;
      select.appendChild(option);
    });
  }

  applyPreset() {
    const select = document.getElementById("cfg_preset");
    const idx = parseInt(select.value);
    if (idx >= 0 && idx < this.userPresets.length) {
      this.currentPreset = this.userPresets[idx];
      // Áp dụng các giá trị từ preset
      document.getElementById("cfg_pW").value = this.currentPreset.pW;
      document.getElementById("cfg_gW").value = this.currentPreset.gW;
      document.getElementById("cfg_maxL").value = this.currentPreset.maxL;
      // Có thể thêm màu sắc nếu cần
    } else {
      this.currentPreset = null;
    }
  }

  openPresetModal() {
    this.renderPresetList();
    // [FIX] Use classList to show modal (override CSS !important)
    document.getElementById("presetModal").classList.remove("hidden");
  }

  renderPresetList() {
    const list = document.getElementById("presetList");
    list.innerHTML = "";
    this.userPresets.forEach((p, i) => {
      const div = document.createElement("div");
      div.style = "margin: 5px 0; padding: 5px; border: 1px solid #ccc;";
      div.innerHTML = `${p.name} - ${p.pW}mm x ${p.gW}mm <button onclick="app.deletePreset(${i})">Xóa</button>`;
      list.appendChild(div);
    });
  }

  deletePreset(idx) {
    this.userPresets.splice(idx, 1);
    // [FIX] Use safe saveToStorage wrapper
    saveToStorage("USER_PRESETS", this.userPresets);
    this.updatePresetDropdown();
    this.renderPresetList();
  }

  saveNewPreset() {
    const name = document.getElementById("newPresetName").value;
    const pW = parseInt(document.getElementById("newPresetPW").value);
    const gW = parseInt(document.getElementById("newPresetGW").value);
    const maxL = parseFloat(document.getElementById("newPresetMaxL").value);
    const color = document.getElementById("newPresetColor").value;
    if (name && !isNaN(pW) && !isNaN(gW) && !isNaN(maxL)) {
      const preset = { name, pW, gW, maxL, color };
      this.userPresets.push(preset);
      // [FIX] Use safe saveToStorage wrapper
      saveToStorage("USER_PRESETS", this.userPresets);
      this.updatePresetDropdown();
      this.renderPresetList();
      // [FIX] Use classList to hide modal
      document.getElementById("presetModal").classList.add("hidden");
      // Clear form
      document.getElementById("newPresetName").value = "";
      document.getElementById("newPresetPW").value = "";
      document.getElementById("newPresetGW").value = "";
      document.getElementById("newPresetMaxL").value = "";
      document.getElementById("newPresetColor").value = "#E3F2FD";

      this.showFeedback("Đã lưu mẫu mới thành công!", "success");
    } else {
      alert(
        "Vui lòng nhập đầy đủ thông tin hợp lệ (Tên, Bản rộng, Khe hở, Dài max)!",
      );
    }
  }

  resize() {
    this.cvs.width = this.cont.clientWidth;
    this.cvs.height = this.cont.clientHeight;
    this.draw();
  }

  // --- XỬ LÝ HÌNH HỌC & INPUT (GEOMETRY) ---
  preset() {
    // Nếu đang ở chế độ Vẽ Tự Do thì không cho phép nhập số đè lên hình
    if (this.state.inputMode === "FREE") return;
    const type = document.getElementById("shp_type").value;

    // [FIX #1] Use getInputValue for safe NaN handling
    const L = this.getInputValue("dim_L", 0.2, 1000, 10.0, true);
    const W = this.getInputValue("dim_W", 0.2, 1000, 6.0, true);

    // [FIX] Replace style.display with classList to override CSS !important
    const lOptsEl = document.getElementById("L_opts");
    const uOptsEl = document.getElementById("U_opts");

    if (type === "L") {
      lOptsEl.classList.remove("hidden");
      uOptsEl.classList.add("hidden");
    } else if (type === "U") {
      lOptsEl.classList.add("hidden");
      uOptsEl.classList.remove("hidden");
    } else {
      lOptsEl.classList.add("hidden");
      uOptsEl.classList.add("hidden");
    }

    let pts = [];
    if (type === "R")
      pts = [
        { x: 0, y: 0 },
        { x: L, y: 0 },
        { x: L, y: W },
        { x: 0, y: W },
      ];
    else if (type === "L") {
      // [FIX #1 #3] Safe input with bounds validation
      const Lc = this.getInputValue(
        "dim_Lc",
        0.1,
        L - 0.1,
        Math.min(4.0, L - 0.1),
        true,
      );
      const Wc = this.getInputValue(
        "dim_Wc",
        0.1,
        W - 0.1,
        Math.min(2.5, W - 0.1),
        true,
      );
      const lOrient =
        document.getElementById("l_orient")?.value || "BOTTOM_RIGHT";

      // [SỬA LỖI] Hổ trợ 4 hướng cắt góc cho hình L
      switch (lOrient) {
        case "BOTTOM_RIGHT": // Cắt góc phải-dưới (mặc định - hiện tại)
          pts = [
            { x: 0, y: 0 },
            { x: L, y: 0 },
            { x: L, y: W - Wc },
            { x: L - Lc, y: W - Wc },
            { x: L - Lc, y: W },
            { x: 0, y: W },
          ];
          break;
        case "BOTTOM_LEFT": // Cắt góc trái-dưới
          pts = [
            { x: 0, y: 0 },
            { x: L, y: 0 },
            { x: L, y: W },
            { x: Lc, y: W },
            { x: Lc, y: W - Wc },
            { x: 0, y: W - Wc },
          ];
          break;
        case "TOP_RIGHT": // Cắt góc phải-trên
          pts = [
            { x: 0, y: 0 },
            { x: L - Lc, y: 0 },
            { x: L - Lc, y: Wc },
            { x: L, y: Wc },
            { x: L, y: W },
            { x: 0, y: W },
          ];
          break;
        case "TOP_LEFT": // Cắt góc trái-trên
          pts = [
            { x: Lc, y: 0 },
            { x: L, y: 0 },
            { x: L, y: W },
            { x: 0, y: W },
            { x: 0, y: Wc },
            { x: Lc, y: Wc },
          ];
          break;
        default:
          // Fallback về BOTTOM_RIGHT nếu invalid
          pts = [
            { x: 0, y: 0 },
            { x: L, y: 0 },
            { x: L, y: W - Wc },
            { x: L - Lc, y: W - Wc },
            { x: L - Lc, y: W },
            { x: 0, y: W },
          ];
      }
    } else if (type === "U") {
      // [FIX #1] Safe input handling
      const arm1 = this.getInputValue("dim_u_arm_1", 0.1, L - 0.1, 2.0, true);
      const arm2 = this.getInputValue("dim_u_arm_2", 0.1, L - 0.1, 2.0, true);
      const base = this.getInputValue("dim_u_base", 0.1, W - 0.1, 2.0, true);
      const orient = document.getElementById("u_orient").value;
      if (
        isNaN(arm1) ||
        isNaN(arm2) ||
        isNaN(base) ||
        !["TOP", "BOTTOM", "LEFT", "RIGHT"].includes(orient)
      ) {
        console.warn(
          "Kích thước hoặc hướng chữ U không hợp lệ. Fallback về chữ nhật.",
        );
        pts = [
          { x: 0, y: 0 },
          { x: L, y: 0 },
          { x: L, y: W },
          { x: 0, y: W },
        ];
      } else if (
        (orient === "TOP" || orient === "BOTTOM") &&
        (arm1 + arm2 >= L || base >= W)
      ) {
        console.warn(
          "Kích thước chữ U không hợp lệ: arm1 + arm2 >= L hoặc base >= W cho hướng ngang. Fallback về chữ nhật.",
        );
        pts = [
          { x: 0, y: 0 },
          { x: L, y: 0 },
          { x: L, y: W },
          { x: 0, y: W },
        ];
      } else if (
        (orient === "LEFT" || orient === "RIGHT") &&
        (arm1 + arm2 >= W || base >= L)
      ) {
        console.warn(
          "Kích thước chữ U không hợp lệ: arm1 + arm2 >= W hoặc base >= L cho hướng dọc. Fallback về chữ nhật.",
        );
        pts = [
          { x: 0, y: 0 },
          { x: L, y: 0 },
          { x: L, y: W },
          { x: 0, y: W },
        ];
      } else {
        // [SỬA LỖI] Logic tọa độ hình U chuẩn (8 điểm - Counter Clockwise)

        if (orient === "TOP") {
          // Mở trên (Top open) -> Đáy (base) nằm dưới cùng (y = W)
          // 2 Cánh (arms) nằm 2 bên trái phải
          pts = [
            { x: 0, y: 0 }, // 1. Góc trên trái
            { x: 0, y: W }, // 2. Góc dưới trái
            { x: L, y: W }, // 3. Góc dưới phải
            { x: L, y: 0 }, // 4. Góc trên phải
            { x: L - arm2, y: 0 }, // 5. Mép trong cánh phải
            { x: L - arm2, y: W - base }, // 6. Góc trong dưới phải
            { x: arm1, y: W - base }, // 7. Góc trong dưới trái
            { x: arm1, y: 0 }, // 8. Mép trong cánh trái
          ];
        } else if (orient === "BOTTOM") {
          // Mở dưới (Bottom open) -> Đáy (base) nằm trên cùng (y = 0)
          pts = [
            { x: 0, y: 0 }, // 1. Góc trên trái
            { x: 0, y: W }, // 2. Góc dưới trái
            { x: arm1, y: W }, // 3. Mép trong cánh trái
            { x: arm1, y: base }, // 4. Góc trong trên trái
            { x: L - arm2, y: base }, // 5. Góc trong trên phải
            { x: L - arm2, y: W }, // 6. Mép trong cánh phải
            { x: L, y: W }, // 7. Góc dưới phải
            { x: L, y: 0 }, // 8. Góc trên phải
          ];
        } else if (orient === "LEFT") {
          // Mở trái (Left open) -> Đáy (base) nằm bên phải (x = L)
          pts = [
            { x: 0, y: 0 }, // 1. Góc trên trái
            { x: 0, y: arm1 }, // 2. Mép trong cánh trên
            { x: L - base, y: arm1 }, // 3. Góc trong trên phải
            { x: L - base, y: W - arm2 }, // 4. Góc trong dưới phải
            { x: 0, y: W - arm2 }, // 5. Mép trong cánh dưới
            { x: 0, y: W }, // 6. Góc dưới trái
            { x: L, y: W }, // 7. Góc dưới phải
            { x: L, y: 0 }, // 8. Góc trên phải
          ];
        } else if (orient === "RIGHT") {
          // Mở phải (Right open) -> Đáy (base) nằm bên trái (x = 0)
          pts = [
            { x: 0, y: 0 }, // 1. Góc trên trái
            { x: 0, y: W }, // 2. Góc dưới trái
            { x: L, y: W }, // 3. Góc dưới phải
            { x: L, y: W - arm2 }, // 4. Mép trong cánh dưới
            { x: base, y: W - arm2 }, // 5. Góc trong dưới trái
            { x: base, y: arm1 }, // 6. Góc trong trên trái
            { x: L, y: arm1 }, // 7. Mép trong cánh trên
            { x: L, y: 0 }, // 8. Góc trên phải
          ];
        }
      }
    }

    this.state.points = pts;
    this.syncEdges();
    this.centerView();
    this.calculate();

    // [CẬP NHẬT PREVIEW] Hiển thị preview panel và render shape
    this.updatePreview(type, pts);
  }

  // [HELPER] Cập nhật preview panel
  updatePreview(shapeType, points) {
    const previewPanel = document.getElementById("preview-panel");
    if (!previewPanel) return;

    // Hiển thị preview panel khi là L hoặc U
    if (shapeType === "L" || shapeType === "U") {
      previewPanel.classList.remove("hidden");

      // Render shape trong preview
      if (this.previewRenderer && points.length > 0) {
        this.previewRenderer.renderShape(points, shapeType);

        // Validate và update status
        const validation = this.validateGeometry(shapeType, points);
        if (validation.errors.length > 0) {
          this.previewRenderer.updateStatus(validation.errors[0], "error");
        } else if (validation.warnings.length > 0) {
          this.previewRenderer.updateStatus(validation.warnings[0], "warning");
        } else {
          this.previewRenderer.updateStatus("Kích thước hợp lệ", "success");
        }
      }
    } else {
      // Ẩn preview panel cho chữ nhật
      previewPanel.classList.add("hidden");
    }
  }

  // [HELPER] Validation geometry
  validateGeometry(shapeType, points) {
    const errors = [];
    const warnings = [];

    if (shapeType === "L") {
      const L = this.getInputValue("dim_L", 0, 1000, 10.0);
      const W = this.getInputValue("dim_W", 0, 1000, 6.0);
      const Lc = this.getInputValue("dim_Lc", 0, 1000, 0);
      const Wc = this.getInputValue("dim_Wc", 0, 1000, 0);

      if (Lc >= L) errors.push("Cắt dài phải < Chiều dài");
      if (Wc >= W) errors.push("Cắt rộng phải < Chiều rộng");
      if (Lc < 0.2) warnings.push("Cắt dài nhỏ (<0.2m)");
      if (Wc < 0.2) warnings.push("Cắt rộng nhỏ (<0.2m)");
    } else if (shapeType === "U") {
      const L = this.getInputValue("dim_L", 0, 1000, 10.0);
      const W = this.getInputValue("dim_W", 0, 1000, 6.0);
      const arm1 = this.getInputValue("dim_u_arm_1", 0, 1000, 0);
      const arm2 = this.getInputValue("dim_u_arm_2", 0, 1000, 0);
      const base = this.getInputValue("dim_u_base", 0, 1000, 0);
      const orient = document.getElementById("u_orient").value;

      if (orient === "TOP" || orient === "BOTTOM") {
        if (arm1 + arm2 >= L) errors.push("Tổng 2 cánh >= Chiều dài");
        if (base >= W) errors.push("Đáy >= Chiều rộng");
      } else {
        if (arm1 + arm2 >= W) errors.push("Tổng 2 cánh >= Chiều rộng");
        if (base >= L) errors.push("Đáy >= Chiều dài");
      }
    }

    return { errors, warnings };
  }

  resetDraw() {
    this.state.points = [];
    this.state.strips = [];
    this.state.mode = "DRAW";
    document.getElementById("coords").innerText =
      "Chế độ Vẽ: Click trái thêm điểm, Chuột phải để đóng hình.";
    this.draw();
  }

  finishDraw() {
    if (this.state.points.length > 2) {
      this.state.mode = "IDLE";
      this.syncEdges();
      this.calculate();
    }
  }

  syncEdges() {
    this.state.edges = this.state.points.map((p, i) => ({
      p1: p,
      p2: this.state.points[(i + 1) % this.state.points.length],
      type: "WALL_V",
    }));
  }

  // --- TƯƠNG TÁC NGƯỜI DÙNG (INTERACTION HANDLER) ---
  // [CÔNG DỤNG] Xử lý sự kiện chuột từ người dùng
  // [THI CÔNG] Dùng để vẽ mặt bằng custom + chuyển đổi loại viền
  //
  // [CHẾ ĐỘ HOẠT ĐỘNG]
  // 1. Mode DRAW (Vẽ mặt bằng):
  //    - Click trái: Thêm điểm
  //    - Click phải: Đóng hình (tạo đa giác)
  // 2. Mode IDLE (Xem/Chỉnh sửa):
  //    - Click trái cạnh: Chuyển đổi loại viền (WALL_V → SHADOW → FASCIA → NONE → WALL_V)
  //    - Drag chuột giữa: Pan/zoom canvas
  //
  // [THAM SỐ] e: Event object từ browser (chứa thông tin chuột)
  onDown(e) {
    // [DRAG CANVAS] Nếu click chuột giữa (button=1) → kích hoạt pan
    // [THI CÔNG] Để xem toàn bộ floor plan và zoom
    if (e.button === 1) {
      this.state.isDrag = true; // Bắt đầu drag
      this.state.lastM = { x: e.clientX, y: e.clientY }; // Lưu vị trí chuột trước
      return;
    }

    // [CONVERT] Chuyển đổi từ tọa độ màn hình (pixel) sang tọa độ canvas (mét)
    const m = this.getMouse(e);

    // [CHẾ ĐỘ DRAW] Vẽ mặt bằng custom
    if (this.state.mode === "DRAW" && e.button === 0) {
      // [THÊM ĐIỂM] Thêm điểm mới vào danh sách đỉnh
      // [LÀMTRÒN] Làm tròn đến 0.1m = 10cm (tránh noise từ chuột)
      this.state.points.push({
        x:
          Math.round(m.x * CONSTRUCTION_STD.DRAWING_PRECISION) /
          CONSTRUCTION_STD.DRAWING_PRECISION,
        y:
          Math.round(m.y * CONSTRUCTION_STD.DRAWING_PRECISION) /
          CONSTRUCTION_STD.DRAWING_PRECISION,
      });
      this.draw(); // Vẽ lại canvas
    }
    // [CHẾ ĐỘ IDLE] Xem/Chỉnh sửa
    else if (this.state.mode === "IDLE" && e.button === 0) {
      // [LẶP] Kiểm tra xem có click trên cạnh nào không
      let hit = false; // Flag để kiểm tra xem có click trên cạnh
      this.state.edges.forEach((edge) => {
        // [TÍNH KHOẢNG CÁCH] Khoảng cách từ chuột đến cạnh
        // [THI CÔNG] Nếu < 0.2m (200mm) → được tính là click trên cạnh
        if (distToSeg(m, edge.p1, edge.p2) < 0.2) {
          // [CHUYỂN ĐỔI LOẠI VIỀN] Cycle: WALL_V → SHADOW → FASCIA → NONE → WALL_V
          // [THI CÔNG] Để điều chỉnh loại viền trên tường
          // - WALL_V: Thanh V-Góc (màu đỏ) - standard corner trim
          // - SHADOW: Shadow Gap (màu tím) - shadow line trim
          // - FASCIA: Fascia (màu xanh) - tấm bề ngoài decorative
          // - NONE: Không lắp viền
          const types = ["WALL_V", "SHADOW", "FASCIA", "NONE"];
          let idx = types.indexOf(edge.type);
          edge.type = types[(idx + 1) % 4]; // Chuyển sang loại tiếp theo
          hit = true; // Đánh dấu đã thay đổi
        }
      });

      // [CẬP NHẬT] Nếu thay đổi loại viền → tính toán lại
      if (hit) {
        this.calculate(); // Tính toán lại BOQ với viền mới
      }
      // [DRAG] Nếu không click trên cạnh → kích hoạt pan
      else {
        this.state.isDrag = true;
        this.state.lastM = { x: e.clientX, y: e.clientY };
      }
    }
  }

  // --- XỬ LÝ CHUỘT DI CHUYỂN (MOUSE MOVE) ---
  // [CÔNG DỤNG] Cập nhật pan + hiển thị tọa độ
  // [THI CÔNG] Để theo dõi vị trí chuột khi vẽ mặt bằng
  onMove(e) {
    // [PAN] Nếu đang drag (chuột giữa hoặc không có click edge) → cập nhật pan
    // [TÍNH TOÁN] pan mới = pan cũ + (chuột mới - chuột cũ)
    if (this.state.isDrag) {
      this.state.panX += e.clientX - this.state.lastM.x; // Dịch chuyển X
      this.state.panY += e.clientY - this.state.lastM.y; // Dịch chuyển Y
      this.state.lastM = { x: e.clientX, y: e.clientY }; // Cập nhật vị trí chuột
      this.draw(); // Vẽ lại canvas với pan mới
    }

    // [HIỂN THỊ TỌA ĐỘ] Nếu ở chế độ DRAW → hiển thị tọa độ chuột
    const m = this.getMouse(e);
    if (this.state.mode === "DRAW") {
      // [COORDS] Cập nhật hiển thị tọa độ hiện tại (X, Y) theo format "xx.xxm"
      document.getElementById("coords").innerText =
        `Drawing: ${m.x.toFixed(2)}, ${m.y.toFixed(2)}`;
    }
  }

  // --- CHUYỂN ĐỔI TỌA ĐỘ CHUỘT (GET MOUSE COORDINATES) ---
  // [CÔNG DỤNG] Convert từ tọa độ pixel (screen) sang tọa độ canvas (mét)
  // [TOÁN HỌC] Áp dụng transform ngược lại (pan + zoom)
  // [CÔNG THỨC]
  //   x = (pixelX - left - panX) / scale
  //   y = (pixelY - top - panY) / scale
  //
  // [VÍ DỤ] Nếu:
  //   - Chuột ở pixel (100, 200) trên screen
  //   - Canvas rect.left=50, rect.top=50
  //   - panX=10, panY=10, scale=50 (50px per meter)
  //   → x = (100 - 50 - 10) / 50 = 0.8m
  //   → y = (200 - 50 - 10) / 50 = 2.8m
  getMouse(e) {
    const r = this.cvs.getBoundingClientRect(); // Lấy vị trí canvas trên màn hình
    return {
      x: (e.clientX - r.left - this.state.panX) / this.state.scale, // Tọa độ X (mét)
      y: (e.clientY - r.top - this.state.panY) / this.state.scale, // Tọa độ Y (mét)
    };
  }

  // --- NHẬN DIỆN HÌNH HỌC (SHAPE DETECTION) ---
  // [HÌNH U – THI CÔNG] Phát hiện hình lõm (concave shape) để cảnh báo
  // [NGUYÊN NHÂN] Hình U có những giới hạn thi công riêng:
  // - KHÔNG nối thanh qua góc U
  // - PHẢI có Fascia tại góc U
  // - CHỈ hỗ trợ 1 hướng linear chung cho 3 nhánh
  detectShapeType() {
    const pts = this.state.points;
    if (pts.length < 5) return "RECTANGLE"; // < 5 điểm → không thể là U

    // [HÌNH U – TÍNH TOÁN] Kiểm tra là hình U nếu có 6 điểm
    // U-shape: 2 cạnh song song (ngoài/trong), 3 góc lõm
    if (pts.length === 6) {
      // [KIỂM TRA] Cạnh 0-1 vs Cạnh 3-4 có song song không? (cạnh ngoài vs trong)
      const edge1 = { x: pts[1].x - pts[0].x, y: pts[1].y - pts[0].y };
      const edge4 = { x: pts[4].x - pts[3].x, y: pts[4].y - pts[3].y };

      // [TOÁN HỌC] Hai vector song song ⟺ cross product ≈ 0
      const cross = edge1.x * edge4.y - edge1.y * edge4.x;
      const tolerance = 0.01;

      if (Math.abs(cross) < tolerance) {
        // [HÌNH U – THI CÔNG] Xác định là U-shape
        // [CẢNH BÁO] User phải hiểu: 3 nhánh riêng lẻ, không xuyên qua góc
        console.warn("⚠️ HÌNH U DETECTED - LIMITED SUPPORT:");
        console.warn("   ✓ Tấm: Tính OK từng segment (ray-casting)");
        console.warn("   ✗ Xương: KHÔNG xuyên qua góc U");
        console.warn("   ✗ Hướng: CHỈ 1 hướng chung (không riêng/nhánh)");
        console.warn("   ! Fascia: PHẢI có tại góc U (click để chọn)");
        console.warn("   ⚡ ACTION: Kiểm tra chi tiết BOQ TRƯỚC khi lắp");
        return "U_SHAPE";
      }
    }

    // Hình L hoặc hình tự do khác
    if (pts.length === 5) return "L_SHAPE";
    return "FREEFORM";
  }

  // --- TÍNH TOÁN CỐT LÕI (CORE CALCULATION) ---
  // [LUỒNG]: Rải tấm → Cắt tấm → Tính xương → Tính ty → Vẽ
  calculate() {
    if (this.state.points.length < 3) return;

    // [HÌNH U – THI CÔNG] Phát hiện hình U & lưu vào state
    this.state.shapeType = this.detectShapeType();

    // [BƯỚC 1] ĐỌC THÔNG SỐ TỪ UI (Tất cả đơn vị mm → convert m)
    // [BƯỚC 1] ĐỌC THÔNG SỐ TỪ UI (Tất cả đơn vị mm → convert m)
    // [FIX] Validate inputs to prevent NaN/Zero errors - Critical Check
    const pW_mm = this.getInputValue("cfg_pW", 10, 1000, 100, true);
    if (!pW_mm || pW_mm <= 0)
      return this.showFeedback("Lỗi: Bản rộng tấm không hợp lệ!", "error");

    const pW = pW_mm / 1000; // Bản rộng tấm (m)
    const gW = this.getInputValue("cfg_gW", 0, 500, 0, true) / 1000; // Khe hở giữa tấm (m)
    const wGap = this.getInputValue("cfg_wGap", 0, 500, 0, true) / 1000; // Khe hở tường (m)

    const maxL = this.getInputValue("cfg_maxL", 0.5, 12.0, 6.0, true); // Chiều dài nhôm tối đa (m)
    if (!maxL || maxL <= 0)
      return this.showFeedback(
        "Lỗi: Chiều dài nhôm max không hợp lệ!",
        "error",
      );

    const isVert = document.getElementById("cfg_dir").value === "90"; // Hướng rải tấm (true=dọc, false=ngang)

    const minCut = this.getInputValue("cfg_minCut", 0, 1000, 200, true) / 1000; // Chiều dài tối thiểu 1 mảnh (m)

    this.state.strips = [];
    const module = pW + gW; // [THI CÔNG] Module = bản rộng tấm + khe hở = bước rải lặp lại

    // [BƯỚC 2] TÍNH BOUNDS (Tìm min/max tọa độ mặt bằng)
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;
    this.state.points.forEach((p) => {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    });

    // [BƯỚC 3] RẢI TẤM LINEAR
    // [THI CÔNG] Rải tấm = tạo dãy tấm song song từ đầu đến cuối phòng, cách nhau "module"
    // Hướng: 90° = dãy tấm chạy dọc theo X, nên xương chạy theo Y
    //        0° = dãy tấm chạy ngang theo Y, nên xương chạy theo X
    const start = isVert ? minX : minY;
    const end = isVert ? maxX : maxY;

    // [LƯU Ý THỰC TẾ] Offset = dịch điểm khởi đầu rải để tấm không bị lệch về 1 bên
    // Tránh tình huống: 1 bên có tấm 50mm, bên kia hở 150mm
    let offset = ((end - start) % module) / 2;
    if (offset < pW / 2) offset += module / 2;

    // [VÒNG LẶP] Rải tấm: Từ start đến end, mỗi lần cách "module"
    for (let pos = start - module + offset; pos < end; pos += module) {
      const center = pos + pW / 2; // Tâm tấm (dùng để bắn tia tìm cắt với tường)
      const segs = this.rayCast(center, isVert); // Bắn tia từ tâm tấm, tìm đoạn giao với tường

      // [THI CÔNG] Xử lý từng đoạn tấm: nếu phòng có cột/hộc giữa, sẽ có multiple segs
      segs.forEach((seg) => {
        // [BÓC TÁCH] Chiều dài hữu ích của đoạn = (điểm cuối - điểm đầu) - 2 lần khe tường
        let runLen = seg.end - seg.start - wGap * 2;
        if (runLen > 0.01) {
          // [BƯỚC 4] CẮT TẤM THÀNH MẢNH - TỐI ƯU END PIECE
          // [SỬA LỖI 5] Nếu end piece quá nhỏ (< minCut), chia cân bằng để tránh phế phẩm
          // [NGUYÊN NHÂN] Cắt tuần tự maxL có thể để lại mảnh cuối < 200mm (phế phẩm)
          let pieces = [];
          const estimatedPieces = Math.ceil(runLen / maxL);
          const estimatedEndPiece = runLen - (estimatedPieces - 1) * maxL;

          if (estimatedEndPiece < minCut && estimatedPieces > 1) {
            // [THI CÔNG] End piece quá nhỏ → chia cân bằng từng mảnh
            // [VD] runLen=6.1m, maxL=6m: thay vì [6m, 0.1m] → [3.05m, 3.05m]
            // [LỢI ÍCH] Tránh phế phẩm, chất lượng hơn, không lãng phí vật liệu
            const avgLen = runLen / estimatedPieces;
            for (let i = 0; i < estimatedPieces; i++) {
              pieces.push(avgLen);
            }
          } else {
            // [THI CÔNG] End piece OK → cắt lần lượt bình thường
            let rem = runLen;
            while (rem > 0) {
              let cut = rem > maxL ? maxL : rem;
              pieces.push(cut);
              rem -= cut;
            }
          }

          // [SỬA LỖI 1] Đếm splicer từ CẮT PANEL > maxL
          // [NGUYÊN NHÂN] Nếu 1 panel cắt thành N mảnh → cần N-1 splicer để nối lại
          // [VD] runLen=8m cắt thành [6m, 2m] → 2 mảnh → 1 splicer
          // [LƯU Ý] Phải đếm LÚC CẮT, không phải LÚC CHIA TRANSPORT
          const spliceCount_fromCutting =
            pieces.length > 1 ? pieces.length - 1 : 0;

          // [CHẤT LƯỢNG] Đánh dấu từng mảnh: OK (≥ minCut) hay BAD (< minCut = phế phẩm)
          const validPieces = pieces.map((len) => ({
            len: len,
            status: len < minCut ? "BAD" : "OK", // Nếu < 200mm → BAD (lãng phí)
          }));

          // [SỬA LỖI 3] Áp dụng offset cho điểm bắt đầu/kết thúc tấm (chỉ dùng wGap, bỏ SAFE_DIST)
          // [NGUYÊN NHÂN] Tấm trần cần sát viền, chỉ cách wGap hoặc offset của V-Góc
          // [THI CÔNG] SAFE_DIST (300mm) chỉ dùng cho kết cấu (xương/ty), không cho tấm
          const minOffsetBoundary = wGap;
          let adjustedStart = seg.start + minOffsetBoundary;
          let adjustedEnd = seg.end - minOffsetBoundary;

          // [SỬA LỖI 4] Điều chỉnh offset dựa trên loại viền tại 2 cạnh
          // [NGUYÊN NHÂN] V-Góc (25mm), Shadow (15mm), Fascia → độ dày khác nhau
          // [THI CÔNG] Phải để margin để tấm không va vào viền → offset >= thickness + 10mm
          this.state.edges.forEach((e) => {
            if (e.type === "WALL_V") {
              // V-Góc dày ~25mm → offset >= 35mm (25+10mm margin)
              const vAngleMinOffset = 0.035;

              // Kiểm tra cạnh đầu strip
              if (isVert && Math.abs(e.p1.y - seg.start) < 0.01) {
                adjustedStart =
                  seg.start + Math.max(minOffsetBoundary, vAngleMinOffset);
              }
              // Kiểm tra cạnh cuối strip
              if (isVert && Math.abs(e.p1.y - seg.end) < 0.01) {
                adjustedEnd =
                  seg.end - Math.max(minOffsetBoundary, vAngleMinOffset);
              }
            }
          });

          // [LƯU STRIP] Lưu thông tin dãy tấm này vào state
          this.state.strips.push({
            pos: pos, // Vị trí (X hoặc Y tùy hướng) của dãy tấm
            start: adjustedStart, // [SỬA LỖI 3,4] Điểm bắt đầu (áp dụng SAFE_DIST + edge offset)
            end: adjustedEnd, // [SỬA LỖI 3,4] Điểm kết thúc (áp dụng SAFE_DIST + edge offset)
            width: pW, // Bản rộng tấm
            isVert: isVert, // Hướng rải
            pieces: validPieces, // Mảng các mảnh {len, status}
            splices: spliceCount_fromCutting, // [SỬA LỖI 1] Splicer từ cắt panel
            totalLen: runLen, // Tổng chiều dài thực
          });
        }
      });
    }

    // Tính tổng diện tích trần
    this.totalArea = this.state.strips.reduce(
      (sum, strip) => sum + strip.totalLen * pW,
      0,
    );

    // [BƯỚC 5] TÍNH KẾT CẤU (Xương gài + Ty treo)
    this.calcStructure(isVert, minX, maxX, minY, maxY);

    // [BƯỚC 6] VẼ & CẬP NHẬT UI
    this.draw();
    document.getElementById("coords").innerText =
      `Xong: ${this.state.strips.length} lines.`;
  }

  // [HÀM PHỤ] TÍNH TOÁN KẾT CẤU: Xương gài + Ty treo
  // [THI CÔNG] Xương luôn vuông góc với Tấm (Linear system)
  // Thực tế: Tấm chạy dọc → Xương chạy ngang (và ngược lại)
  calcStructure(isPanelVert, minX, maxX, minY, maxY) {
    this.state.carriers = [];
    this.state.hangers = [];

    // [ĐỌC THÔNG SỐ]
    // [ĐỌC THÔNG SỐ]
    // [FIX] Validate inputs using getInputValue
    const cX = this.getInputValue("cfg_cX", 0.5, 5.0, 1.0, true); // Bước xương (m)
    const tY = this.getInputValue("cfg_tY", 0.5, 5.0, 1.0, true); // Bước ty treo (m)

    // [LOGIC LINEAR] Xương luôn vuông góc với Tấm
    // Nếu Tấm dọc (isPanelVert=true) → Xương ngang (isCarrierVert=false)
    const isCarrierVert = !isPanelVert;

    const start = isCarrierVert ? minX : minY;
    const end = isCarrierVert ? maxX : maxY;

    // [BƯỚC 1] TÍNH VỊ TRÍ CÁC THANH XƯƠNG (CARRIERS)
    // [THI CÔNG] Thanh xương được rải cách nhau "bước xương" (mặc định 1.0m)
    // Nhưng cần dữ trừ khoảng 300mm từ tường (tiêu chuẩn an toàn)
    const carrierPositions = this.getLinearDistribution(start, end, cX);

    carrierPositions.forEach((pos) => {
      // [BÓC TÁCH] Với mỗi vị trí xương, bắn tia để tìm giao cắt với tường
      const segs = this.rayCast(pos, isCarrierVert);

      segs.forEach((seg) => {
        // [A] LƯU THÔNG TIN THANH XƯƠNG
        // [THI CÔNG] Xương là thanh kim loại dài, treo tấm từ trần cũ xuống
        // Độ dài = chiều dài từ tường này đến tường kia
        this.state.carriers.push({
          x1: isCarrierVert ? pos : seg.start,
          y1: isCarrierVert ? seg.start : pos,
          x2: isCarrierVert ? pos : seg.end,
          y2: isCarrierVert ? seg.end : pos,
          len: seg.end - seg.start, // Độ dài xương
        });

        // [B] TÍNH VỊ TRÍ TY TREO TRÊN THANH XƯƠNG NÀY
        // [THI CÔNG] Ty treo = điểm treo xương từ trần cũ (dùng ê tô thép)
        // Ty được rải cách nhau "bước ty treo" (mặc định 1.2m) để giữ xương không bị sag
        const hangerPositions = this.getLinearDistribution(
          seg.start,
          seg.end,
          tY,
        );

        hangerPositions.forEach((h) => {
          this.state.hangers.push({
            x: isCarrierVert ? pos : h,
            y: isCarrierVert ? h : pos,
          });
        });
      });
    });
  }

  /**
   * [HÀM PHỤ TRỢ] RẢI ĐIỂM THEO TIÊU CHUẨN XÂY DỰNG
   * =============================================
   * [CÔNG DỤNG] Tính toán vị trí xương/ty treo theo tiêu chuẩn:
   *   - Cách tường 300mm (SAFE_DIST = 0.3m)
   *   - Lặp lại theo bước (step = bước xương hoặc bước ty)
   *   - Gia cố nếu gap cuối lớn hơn 300mm
   *
   * [THỰC TẾ THI CÔNG]
   * Không thể lắp xương/ty ngay sát tường (chỉ 0mm) vì:
   *   - Tường thường không vuông góc/phẳng (sai 10-20mm)
   *   - Cần khoảng cách để lắp fastener/viền
   *   - Mặc định 300mm là tiêu chuẩn an toàn
   *
   * [LOGIC REINFORCEMENT]
   * Nếu gap cuối > 300mm → Thêm 1 hàng gia cố gần tường
   * VD: span=5m, step=1m
   *   - Hàng 1: 0.3m (từ tường)
   *   - Hàng 2: 1.3m
   *   - Hàng 3: 2.3m
   *   - Hàng 4: 3.3m
   *   - Hàng 5: 4.3m
   *   - Gap cuối: 0.7m → không cần gia cố
   * VD khác: span=4m, step=1m
   *   - Hàng 1: 0.3m
   *   - Hàng 2: 1.3m
   *   - Hàng 3: 2.3m
   *   - Hàng 4: 3.3m
   *   - Gap cuối: 0.7m → không cần gia cố
   * VD khác: span=8m, step=2m
   *   - Hàng 1: 0.3m
   *   - Hàng 2: 2.3m
   *   - Hàng 3: 4.3m
   *   - Hàng 4: 6.3m
   *   - Gap cuối: 1.7m (> 0.3m) → Thêm hàng 5: 7.7m
   *
   * [PARAMETERS]
   * @param start - Tọa độ bắt đầu (mét)
   * @param end - Tọa độ kết thúc (mét)
   * @param step - Bước lặp lại (mét): Bước xương (1.0m) hoặc Bước ty (1.2m)
   *
   * @return Mảng các tọa độ {number[]}
   */
  getLinearDistribution(start, end, step) {
    const { SAFE_DIST_FROM_WALL } = CONSTRUCTION_STD;
    let points = [];
    const span = end - start;

    // [TRƯỜNG HỢP 1] Phòng quá nhỏ (< 600mm)
    if (span < SAFE_DIST_FROM_WALL * 2) {
      points.push((start + end) / 2);
      return points;
    }

    // [TRƯỜNG HỢP 2] Phòng tiêu chuẩn
    // 2.1. Điểm đầu tiên: Cách tường Start 300mm
    let current = start + SAFE_DIST_FROM_WALL;

    // Rải đều
    while (current <= end - SAFE_DIST_FROM_WALL) {
      points.push(current);
      current += step;
    }

    // 2.3. Xử lý điểm cuối (Reinforcement Logic)
    const lastPoint = points.length > 0 ? points[points.length - 1] : start;
    if (end - lastPoint > SAFE_DIST_FROM_WALL + 0.05) {
      points.push(end - SAFE_DIST_FROM_WALL);
    }

    return points;
  }

  // [LƯỚI TÍNH TOÁN] Phương pháp bắn tia (RAY CASTING)
  // [CÔNG DỤNG] Tìm điểm giao của 1 đường thẳng với đa giác tường
  // [THỰC TẾ] Dùng để xác định vị trí tấm/xương có nằm trong phòng hay không
  // [TOÁN HỌC] Sử dụng phương pháp ray-casting trong hình học tính toán
  //
  // [THAM SỐ]
  //   val: Vị trí tia (x=val nếu isVertRay=true, hoặc y=val nếu isVertRay=false)
  //   isVertRay: true = bắn tia thẳng đứng (theo trục X), false = bắn tia ngang (theo trục Y)
  //
  // [QUẢN LÝ LỖI LOGIC]
  // VD THỰC TẾ: Phòng hình chữ nhật ABCD
  //   A(0,0) → B(10,0) → C(10,5) → D(0,5) → A
  //   Bắn tia dọc (x=5) từ trên xuống
  //   → Giao điểm 1: y=0 (đường AB), Giao điểm 2: y=5 (đường CD)
  //   → Đoạn có thể lắp tấm: [0, 5] meters
  //
  // [THUẬT TOÁN]
  // 1. Lặp qua từng cạnh của đa giác tường
  // 2. Kiểm tra xem tia có cắt cạnh này không (cross product)
  // 3. Tính toán điểm giao cụ thể (tuyến tính interpolation)
  // 4. Sắp xếp các điểm giao từ nhỏ→lớn
  // 5. Gom cặp điểm (start, end) thành các đoạn giao
  //
  // [CÔNG THỨC INTERPOLATION LINEAR]
  // Đường thẳng từ A(ax,ay) → B(bx,by)
  // Nếu cắt tia x=val → y = ay + (val - ax) * (by - ay) / (bx - ax)
  rayCast(val, isVertRay) {
    let hits = []; // Lưu tất cả điểm giao
    const pts = this.state.points; // Đỉnh của đa giác tường

    // [VÒNG LẶP] Kiểm tra từng cạnh của tường
    for (let i = 0; i < pts.length; i++) {
      let a = pts[i], // Điểm đầu cạnh
        b = pts[(i + 1) % pts.length]; // Điểm cuối cạnh (quay lại A nếu i=n-1)

      if (isVertRay) {
        // [BẮNTI THẲNG ĐỨC] Kiểm tra xem cạnh AB có cắt đường thẳng x=val không
        // Điều kiện cắt: A và B phải ở 2 bên của tia (hoặc nằm trên tia)
        if ((a.x <= val && b.x > val) || (b.x <= val && a.x > val)) {
          // [TÍNH GIAO ĐIỂM] Dùng công thức interpolation tuyến tính
          // y = a.y + (val - a.x) * (b.y - a.y) / (b.x - a.x)
          hits.push(a.y + ((val - a.x) * (b.y - a.y)) / (b.x - a.x));
        }
      } else {
        // [BẮNTIA NGANG] Kiểm tra xem cạnh AB có cắt đường thẳng y=val không
        if ((a.y <= val && b.y > val) || (b.y <= val && a.y > val)) {
          // [TÍNH GIAO ĐIỂM] x = a.x + (val - a.y) * (b.x - a.x) / (b.y - a.y)
          hits.push(a.x + ((val - a.y) * (b.x - a.x)) / (b.y - a.y));
        }
      }
    }

    // [SẮPXẾP] Sắp xếp các điểm giao từ nhỏ→lớn
    // [LÝDO] Đảm bảo gom cặp điểm (start, end) đúng thứ tự
    hits.sort((a, b) => a - b);

    // [GOMMÔI] Gom các điểm thành cặp đoạn (start-end)
    // [THI CÔNG] Kết quả là 1 list của các đoạn trong phòng có thể lắp tấm/xương
    // VD: hits=[0.5, 3.2, 5.8, 9.1] → segs=[{start:0.5, end:3.2}, {start:5.8, end:9.1}]
    let segs = [];
    for (let k = 0; k < hits.length; k += 2) {
      // Lấy cặp (hits[k], hits[k+1]) - chỉ lấy nếu cặp đầy đủ
      if (k + 1 < hits.length) {
        segs.push({ start: hits[k], end: hits[k + 1] });
      }
    }

    return segs; // Return list các đoạn giao
  }

  // [VẼ HỌA ĐỒ] Render canvas - hiển thị mặt bằng, tấm, kết cấu, viền
  // [CÔNG DỤNG] Vẽ toàn bộ visualization của floor plan + materials
  // [THI CÔNG] Dùng để visual design trên computer trước khi thi công
  // [OUTPUT] Canvas 2D: sàn (trắng), tấm (xanh nhạt), xương (cam), ty (xanh), viền (đỏ/tím)
  //
  // [QUÂN LƯỢNG HÓA MÀU]
  // - Sàn (Floor): Trắng = không lắp trần
  // - Tấm trần (Panel): Xanh nhạt #E3F2FD = khu vực có trần
  // - Tấm xấu (BAD): Đỏ nhạt #FFEBEE = dư phẩm (lỗi cắt)
  // - Xương (Carrier): Cam #EF6C00 = dầm chịu lực ngang
  // - Ty (Hanger): Xanh #4CAF50 = điểm treo (từ trần cũ)
  // - Viền (Edge): Đỏ #d32f2f (V-Góc), Tím #7b1fa2 (Shadow), Xanh #0288d1 (Fascia)
  //
  // [THAM SỐ RENDER]
  // - panX, panY: Vị trí dịch chuyển canvas (pan/zoom)
  // - scale: Hệ số phóng to/thu nhỏ (tính bằng mét → pixel)
  draw() {
    const ctx = this.ctx; // 2D context của canvas
    ctx.clearRect(0, 0, this.cvs.width, this.cvs.height); // Xóa canvas cũ
    ctx.save(); // Lưu trạng thái transform hiện tại

    // [BIẾN ĐỔIMẶT PHẲNG] Áp dụng pan + zoom để có thể di chuyển view
    ctx.translate(this.state.panX, this.state.panY); // Dịch chuyển gốc tọa độ
    ctx.scale(this.state.scale, this.state.scale); // Phóng to/thu nhỏ

    if (this.state.points.length > 0) {
      // [PHẦN 1] VẼ SÀN CÔNG TRÌNH
      // [THI CÔNG] Sàn = ranh giới của phòng (đa giác)
      // Hiển thị màu trắng để phân biệt với khu vực lắp trần
      ctx.beginPath();
      this.state.points.forEach(
        (p, i) => (i == 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)), // Vẽ các cạnh
      );
      ctx.closePath(); // Đóng đa giác
      ctx.fillStyle = "white"; // Màu nền trắng
      ctx.fill(); // Tô đầy sàn

      // [PHẦN 2] VẼ TẤM TRẦN
      // [BÓC TÁCH] Lặp qua từng strip (hàng tấm)
      // Mỗi strip chứa nhiều piece (mảnh tấm cắt)
      this.state.strips.forEach((s) => {
        // [VẼMẶC ĐỊNH] Vẽ toàn bộ strip bằng màu xanh nhạt
        ctx.fillStyle = "#E3F2FD"; // Màu xanh nhạt = khu vực lắp trần
        if (s.isVert) {
          // [TẤMDỌC] Nếu tấm thẳng đứng (isVert=true)
          // Vẽ hình chữ nhật: (pos, start) → width × totalLen
          ctx.fillRect(s.pos, s.start, s.width, s.totalLen);
        } else {
          // [TẤMNGANG] Nếu tấm ngang (isVert=false)
          // Vẽ hình chữ nhật: (start, pos) → totalLen × width
          ctx.fillRect(s.start, s.pos, s.totalLen, s.width);
        }

        // [VẼCÁC PIECE TRONG STRIP]
        // [BÓC TÁCH] Mỗi piece là 1 mảnh tấm đã được cắt
        let cur = 0; // Con trỏ vị trí hiện tại dọc strip
        s.pieces.forEach((p) => {
          // [PHÁT HIỆNLỖI] Nếu piece là "BAD" (vụn) → vẽ màu đỏ
          // [THI CÔNG] Dấu báo để thi công biết phải xử lý riêng mảnh này
          if (p.status === "BAD") {
            ctx.fillStyle = "#FFEBEE"; // Màu đỏ nhạt = dư phẩm
            if (s.isVert) {
              ctx.fillRect(s.pos, s.start + cur, s.width, p.len);
            } else {
              ctx.fillRect(s.start + cur, s.pos, p.len, s.width);
            }
          }

          // [VẼGIAO TUYẾN] Vẽ đường chia giữa các mảnh (piece separator lines)
          // [THI CÔNG] Để công nhân biết vị trí cắt trên tấm
          cur += p.len; // Cập nhật con trỏ vị trí
          ctx.beginPath();
          if (s.isVert) {
            // [TẤMDỌC] Vẽ đường ngang chia tấm
            ctx.moveTo(s.pos, s.start + cur);
            ctx.lineTo(s.pos + s.width, s.start + cur);
          } else {
            // [TẤMNGANG] Vẽ đường dọc chia tấm
            ctx.moveTo(s.start + cur, s.pos);
            ctx.lineTo(s.start + cur, s.pos + s.width);
          }
          ctx.strokeStyle = "#1976D2"; // Màu xanh đậm = giao tuyến
          ctx.lineWidth = 0.02; // Độ dày đường (tính bằng mét)
          ctx.stroke(); // Vẽ đường
        });
      });

      // [PHẦN 3] VẼ VIỀN (EDGE)
      // [THI CÔNG] Viền = các đoạn trên tường (V-Góc, Shadow, Fascia)
      // Mỗi loại viền khác nhau màu sắc để phân biệt
      this.state.edges.forEach((e) => {
        ctx.beginPath();
        ctx.moveTo(e.p1.x, e.p1.y); // Điểm đầu viền
        ctx.lineTo(e.p2.x, e.p2.y); // Điểm cuối viền
        ctx.lineWidth = 0.1; // Độ dày viền (phóng to để nhìn rõ)

        // [MẢNG MÀU] Lấy màu từ EDGE_TYPES (constants.js)
        // VD: EDGE_TYPES['WALL_V'] = {color: '#d32f2f'} (đỏ)
        // EDGE_TYPES['SHADOW'] = {color: '#7b1fa2'} (tím)
        // EDGE_TYPES['FASCIA'] = {color: '#0288d1'} (xanh)
        ctx.strokeStyle = EDGE_TYPES[e.type].color;
        ctx.stroke(); // Vẽ viền
      });

      // [PHẦN 4] VẼ KẾT CẤU
      // [THI CÔNG] Kết cấu = xương (carrier) + ty (hanger)
      // Xương = dầm chịu lực, Ty = điểm treo

      // [VẼ XƯƠNG] Vẽ từng xương dưới dạng đoạn thẳng
      ctx.lineWidth = 0.04; // Độ dày xương (phóng to để nhìn rõ)
      ctx.strokeStyle = "#EF6C00"; // Màu cam = xương gài
      this.state.carriers.forEach((c) => {
        ctx.beginPath();
        ctx.moveTo(c.x1, c.y1); // Điểm đầu xương
        ctx.lineTo(c.x2, c.y2); // Điểm cuối xương
        ctx.stroke(); // Vẽ xương
      });

      // [VẼ TY] Vẽ từng ty dưới dạng hình tròn nhỏ
      ctx.fillStyle = "#4CAF50"; // Màu xanh = ty treo
      this.state.hangers.forEach((h) => {
        ctx.beginPath();
        ctx.arc(h.x, h.y, 0.08, 0, Math.PI * 2); // Vẽ tròn tại (x,y), bán kính=0.08m
        ctx.fill(); // Tô đầy ty
      });

      // [PHẦN 5] VẼ UI CHẾ ĐỘ DRAW
      // [TƯƠNG TÁC] Khi ở chế độ DRAW (vẽ mặt bằng custom)
      // Hiển thị các điểm đỉnh bằng hình tròn đỏ để người dùng thao tác
      if (this.state.mode === "DRAW") {
        ctx.fillStyle = "red"; // Màu đỏ = điểm đỉnh có thể drag
        this.state.points.forEach((p) => {
          ctx.beginPath();
          ctx.arc(p.x, p.y, 0.1, 0, Math.PI * 2); // Vẽ tròn tại đỉnh
          ctx.fill(); // Tô đầy
        });
        ctx.strokeStyle = "#555"; // Màu xám = viền điểm
        ctx.lineWidth = 0.02; // Độ dày viền
        ctx.stroke(); // Vẽ viền
      }
    }

    ctx.restore(); // Khôi phục trạng thái transform ban đầu
  }

  // --- [MỚI] THUẬT TOÁN TỐI ƯU CẮT THANH (BIN PACKING ALGORITHM) ---
  calculateOptimizedBars(segments, barLength, sawBladeWidth = 0.005) {
    let sortedSegs = [...segments].sort((a, b) => b - a);
    let bars = [];

    for (let seg of sortedSegs) {
      let placed = false;
      for (let i = 0; i < bars.length; i++) {
        if (bars[i] >= seg + sawBladeWidth) {
          bars[i] -= seg + sawBladeWidth;
          placed = true;
          break;
        }
      }

      if (!placed) {
        if (seg > barLength) {
          let requiredForThisSeg = Math.ceil(seg / barLength);
          for (let k = 0; k < requiredForThisSeg; k++) bars.push(0);
        } else {
          bars.push(barLength - seg - sawBladeWidth);
        }
      }
    }
    return bars.length;
  }

  // --- TÍNH TOÁN DATA BOQ CHUẨN HÓA (CORE LOGIC) ---
  calculateBOQData() {
    // [FIX] Dùng luôn constant đã import ở đầu file, không await import lại
    const wastePct = this.getInputValue("cfg_waste") / 100;
    const accessoryWaste = 1 + wastePct;

    const presetName = this.currentPreset
      ? this.currentPreset.name
      : "Chưa chọn";
    const color = this.currentPreset ? this.currentPreset.color : "#E3F2FD";

    // 1. TÍNH TOÁN XƯƠNG GÀI (CARRIER)
    // [UPDATE] Lấy chiều dài xương từ input (3m, 4m, 6m...)
    const carrierBarL = this.getInputValue("cfg_carrierL", 1.0, 12.0, 3.0);

    const carrierSegments = this.state.carriers.map((c) => c.len);
    const totalCarrierLen = carrierSegments.reduce((a, b) => a + b, 0);
    const carrierBarsReal = this.calculateOptimizedBars(
      carrierSegments,
      carrierBarL,
    );
    const carrierBarsOrder = Math.ceil(carrierBarsReal * accessoryWaste);
    const carrierCouplers = this.state.carriers.reduce(
      (sum, c) => sum + Math.floor((c.len - 0.01) / carrierBarL),
      0,
    );

    // 2. TÍNH TOÁN VIỀN (TRIMS)
    const trimSegments = this.state.edges
      .filter((e) => e.type === "WALL_V")
      .map((e) =>
        Math.sqrt(Math.pow(e.p2.x - e.p1.x, 2) + Math.pow(e.p2.y - e.p1.y, 2)),
      );

    const totalTrimLen = trimSegments.reduce((a, b) => a + b, 0);
    const trimBarsReal = this.calculateOptimizedBars(
      trimSegments,
      CONSTRUCTION_STD.V_ANGLE_BAR_LENGTH,
    );
    const trimBarsOrder = Math.ceil(trimBarsReal * accessoryWaste);

    // [NEW] TÍNH TOÁN SHADOW GAP (Z-PROFILE)
    const shadowSegments = this.state.edges
      .filter((e) => e.type === "SHADOW")
      .map((e) =>
        Math.sqrt(Math.pow(e.p2.x - e.p1.x, 2) + Math.pow(e.p2.y - e.p1.y, 2)),
      );

    const totalShadowLen = shadowSegments.reduce((a, b) => a + b, 0);
    // Giả sử thanh Shadow cũng dài 3m giống V-Góc (hoặc lấy từ CONST)
    const shadowBarsReal = this.calculateOptimizedBars(
      shadowSegments,
      CONSTRUCTION_STD.V_ANGLE_BAR_LENGTH,
    );
    const shadowBarsOrder = Math.ceil(shadowBarsReal * accessoryWaste);

    // 3. TÍNH TOÁN FASCIA
    const fasciaSegments = this.state.edges
      .filter((e) => e.type === "FASCIA")
      .map((e) =>
        Math.sqrt(Math.pow(e.p2.x - e.p1.x, 2) + Math.pow(e.p2.y - e.p1.y, 2)),
      );
    const totalFasciaLen = fasciaSegments.reduce((a, b) => a + b, 0);

    // 4. HỆ TREO
    const totalPoints = this.state.hangers.length;
    // [UPDATE] Lấy chiều dài Ty trung bình từ input, mặc định 1.0m
    const avgHangerLen = this.getInputValue("cfg_hangerL", 0.1, 10.0, 1.0);
    const BAR_LEN_ROD = 3.0; // [UPDATE] Ty ren khổ tiêu chuẩn 3m (theo yêu cầu user)

    const totalRodMeters = totalPoints * avgHangerLen;
    const rodBarsOrder = Math.ceil(
      (totalRodMeters * accessoryWaste) / BAR_LEN_ROD,
    );

    // 5. TẤM TRẦN (PANELS) & SPLICER
    // Tấm đã được tính toán cắt và nối trong calculate() (this.state.strips)
    // Cần tổng hợp lại số liệu
    let panelGroups = {};
    let spliceCount = 0;
    let totalPanelLen = 0;

    this.state.strips.forEach((strip) => {
      totalPanelLen += strip.totalLen;
      spliceCount += strip.splices || 0;

      // Gom nhóm các mảnh tấm
      strip.pieces.forEach((p) => {
        // Gom theo chiều dài
        let key = p.len.toFixed(2);
        if (!panelGroups[key]) panelGroups[key] = { qty: 0, status: p.status };
        panelGroups[key].qty++;
      });
    });

    // Splicer bổ sung từ Fascia
    // Fascia > MaxL thì cũng cần splicer
    // ... logic cũ có tính fascia splicer, ở đây ta đơn giản hóa hoặc add thêm vào.
    // Trong code cũ: spliceCount += numParts - 1; cho Fascia.
    const maxTransLimit = this.getInputValue("cfg_maxTrans") || 12.0;
    let fasciaSplice = 0;

    fasciaSegments.forEach((len) => {
      if (len > maxTransLimit) {
        fasciaSplice += Math.ceil(len / maxTransLimit) - 1;
      }
    });

    const totalSplice = spliceCount + fasciaSplice;
    const spliceOrder = Math.ceil(totalSplice * accessoryWaste);

    return {
      presetName,
      color,
      totalArea: this.totalArea ? this.totalArea.toFixed(2) : "0.00",
      carriers: {
        totalLen: totalCarrierLen.toFixed(2),
        bars: carrierBarsOrder,
        couplers: Math.ceil(carrierCouplers * accessoryWaste),
      },
      trims: {
        totalLen: totalTrimLen.toFixed(2),
        bars: trimBarsOrder,
      },
      shadowTrims: {
        totalLen: totalShadowLen.toFixed(2),
        bars: shadowBarsOrder,
      },
      fascia: {
        totalLen: totalFasciaLen.toFixed(2),
        segments: fasciaSegments, // có thể cần chi tiết
      },
      hangers: {
        total: totalPoints,
        sets: Math.ceil(totalPoints * accessoryWaste),
        tyRenBars: rodBarsOrder,
        details: {
          tyRenMeters: (totalRodMeters * accessoryWaste).toFixed(1),
          noDan: Math.ceil(totalPoints * accessoryWaste),
          ecuLongDen: Math.ceil(totalPoints * 2 * accessoryWaste),
          mocTreoXuong: Math.ceil(totalPoints * accessoryWaste),
        },
      },
      panels: {
        groups: panelGroups,
        totalLen: totalPanelLen.toFixed(2),
      },
      accessories: {
        splicer: spliceOrder,
      },
      // [NEW] Info for display
      panelWidth: this.getInputValue("cfg_pW", 100),
    };
  }

  // --- SHOW BOQ (EDITABLE VERSION) ---
  showBOQ() {
    if (this.state.strips.length === 0) return;

    // [FIX] Define carrierBarL for display
    const carrierBarL = this.getInputValue("cfg_carrierL", 1.0, 12.0, 3.0);

    const metrics = this.calculateBOQData();

    // Helper to create editable row
    const row = (name, unit, val, isBold = false) => `
      <tr>
          <td style="padding:4px;"><input type="text" class="boq-inp name ${isBold ? "bold" : ""}" value="${name}"></td>
          <td align="center" style="padding:4px;"><input type="text" class="boq-inp unit" value="${unit}" style="text-align:center; width:60px"></td>
          <td align="right" style="padding:4px;">
            <input type="text" class="boq-inp val ${isBold ? "bold" : ""}" value="${val}" style="text-align:right; width:80px">
          </td>
      </tr>
    `;

    let html = `
    <div style="font-family: 'Segoe UI', sans-serif;">
        <div style="background:#E3F2FD; padding:15px; border-radius:4px; margin-bottom:15px; border-left: 5px solid #1976D2;">
            <div style="font-size: 18px; font-weight: bold; color: #0D47A1;">
                TỔNG DIỆN TÍCH: ${metrics.totalArea} m²
            </div>
            <div style="color: #546E7A; font-size: 13px; margin-top: 5px;">
                Hệ trần: <b>${metrics.presetName}</b> | Màu: ${metrics.color}
            </div>
            <div style="font-style:italic; font-size:12px; color:#d32f2f; margin-top:5px">
              * Bạn có thể sửa trực tiếp Tên và Số lượng bên dưới trước khi xuất file.
            </div>
        </div>

        <h4 style="border-bottom: 2px solid #ddd; padding-bottom: 5px; color: #E65100;">1. KẾT CẤU KHUNG XƯƠNG</h4>
        <table id="boq-table-main" style="width:100%; border-collapse: collapse; margin-bottom:20px; font-size:13px">
            <tr style="background:#ECEFF1;">
                <th style="text-align:left; padding:8px;">Tên Vật Tư</th>
                <th style="padding:8px; width:80px">ĐVT</th>
                <th style="text-align:right; padding:8px; width:100px">SL Đặt hàng</th>
            </tr>
            ${row(`Tấm trần ${metrics.presetName} (${metrics.panelWidth}mm)`, "m2", metrics.totalArea, true)}
            ${row(`Thanh xương (${carrierBarL}m)`, "Cây", metrics.carriers.bars, true)}
            ${row("Thanh V-Góc (3m)", "Cây", metrics.trims.bars, true)}
            ${
              metrics.shadowTrims && metrics.shadowTrims.bars > 0
                ? row(
                    "Thanh Shadow Gap (3m)",
                    "Cây",
                    metrics.shadowTrims.bars,
                    true,
                  )
                : ""
            }
             ${
               metrics.fascia && metrics.fascia.totalLen > 0
                 ? row("Mặt dựng Fascia", "md", metrics.fascia.totalLen, true)
                 : ""
             }
        </table>

        <h4 style="border-bottom: 2px solid #ddd; padding-bottom: 5px; color: #2E7D32;">2. PHỤ KIỆN & HỆ TREO</h4>
        <table id="boq-table-acc" style="width:100%; border-collapse: collapse; margin-bottom:20px; font-size:13px">
            <tr style="background:#f5f5f5;">
                <th style="text-align:left; padding:8px;">Tên Phụ Kiện</th>
                <th style="padding:8px; width:80px">ĐVT</th>
                <th style="text-align:right; padding:8px; width:100px">Số Lượng</th>
            </tr>
            ${row("Khóa nối xương", "Cái", metrics.carriers.couplers, true)}
            ${row("Móc treo xương", "Cái", metrics.hangers.details.mocTreoXuong, true)}
            ${row("Ty ren (3m)", "Cây", metrics.hangers.tyRenBars, true)}
            ${row("Bộ Nở đạn + Ecu", "Bộ", metrics.hangers.details.noDan, true)}
            ${metrics.accessories.splicer > 0 ? row("Splicer (Nối tấm)", "Cái", metrics.accessories.splicer, true) : ""}
        </table>

         <h4 style="border-bottom: 2px solid #ddd; padding-bottom: 5px;">3. CHI TIẾT CẮT TẤM (SẢN XUẤT)</h4>
         <div style="max-height:200px; overflow-y:auto; border:1px solid #eee;">
            <table id="boq-table-panels" style="width:100%; border-collapse:collapse; font-size:12px;">
                <tr style="background:#ECEFF1; position:sticky; top:0;">
                    <th style="padding:5px; text-align:left">Chiều dài / Diễn giải</th>
                    <th style="padding:5px; text-align:right">Số lượng</th>
                </tr>
                 ${Object.entries(metrics.panels.groups)
                   .sort((a, b) => parseFloat(b[0]) - parseFloat(a[0]))
                   .map(
                     ([len, item]) => `
                    <tr style="border-bottom:1px solid #eee;">
                        <td style="padding:2px;"><input class="boq-inp" value="${len} m ${item.status === "BAD" ? "(Vụn)" : ""}" style="width:100%"></td>
                        <td style="padding:2px; text-align:right;"><input class="boq-inp bold" value="${item.qty}" style="text-align:right; width:60px"></td>
                    </tr>
                   `,
                   )
                   .join("")}
            </table>
         </div>
         <div style="font-size:11px; color:#999; margin-top:5px">* Số lượng tấm là Net (chưa waste)</div>
    </div>
    `;

    document.getElementById("boqContent").innerHTML = html;
    // [FIX] Use classList to show modal (override CSS !important)
    document.getElementById("boqModal").classList.remove("hidden");
  }

  // Hiển thị báo cáo tổng hợp cho các project zones đã lưu
  // Dùng dữ liệu trong zone.stats (theo cấu trúc mới của projectZones)
  // Hiển thị báo cáo tổng hợp cho các project zones đã lưu - Tách theo LOẠI TẤM
  showProjectBOQ() {
    const zones = this.state.projectZones || [];

    if (!zones.length) {
      document.getElementById("boqContent").innerHTML =
        '<div style="padding:10px">Chưa có khu vực nào trong Project.</div>';
      document.getElementById("boqModal").classList.remove("hidden");
      return;
    }

    // Default global fallback
    const globalCarrierL = this.getInputValue("cfg_carrierL", 1.0, 12.0, 3.0);
    const wastePct = this.getInputValue("cfg_waste", 0, 50, 0, true);
    const waste = 1 + wastePct / 100;
    const vAngleBarLength = 3.0;

    // Helper: group array counts
    const groupCounts = (arr) => {
      const g = {};
      (arr || []).forEach((len) => {
        const k = Number(len || 0).toFixed(2);
        if (!g[k]) g[k] = 0;
        g[k]++;
      });
      return Object.keys(g)
        .map((k) => ({ len: parseFloat(k), qty: g[k] }))
        .sort((a, b) => b.len - a.len);
    };

    // --- DATA AGGREGATION ---
    // [MAIN CHANGE] Group everything by Panel Type (pKey)
    const projectTotalArea = { val: 0 };
    const byType = {}; // { [pKey]: { area, panels[], fascia[], carriers: {len, bars...}, hangers, etc. } }

    zones.forEach((zone) => {
      const s = zone.stats || {};
      const zInputs = zone.savedState?.inputs || {};
      const zPW =
        parseFloat(zInputs.cfg_pW) ||
        parseFloat(document.getElementById("cfg_pW")?.value || 100);
      const zCarrierL = parseFloat(zInputs.cfg_carrierL) || globalCarrierL;
      const zHangerL = parseFloat(zInputs.cfg_hangerL) || 1.0;

      // Unique Key for Panel Type
      const pKey = `${zone.savedState?.presetName || "Custom"} (${zPW}mm)`;

      // Init Group if missing
      if (!byType[pKey]) {
        byType[pKey] = {
          // Panels
          panels: [],
          fascia: [],
          area: 0,
          // Structure
          carrierLen: 0,
          carrierBars: 0, // Computed calculated bars
          wallV: 0,
          vAngleBars: 0,
          shadow: 0,
          // Hangers
          hangerPoints: 0,
          rodBars: 0, // Ty ren bars
          // Accessories
          couplers: 0,
          mocTreo: 0,
          noDan: 0,
          splicers: 0,
        };
      }
      const grp = byType[pKey];

      // 1. Panels & Fascia
      const panels = Array.isArray(s.panels) ? s.panels.slice() : [];
      const fascia = Array.isArray(s.fascia) ? s.fascia.slice() : [];
      grp.panels.push(...panels.filter((v) => typeof v === "number"));
      grp.fascia.push(...fascia.filter((v) => typeof v === "number"));

      // 2. Area
      const zArea = Number(s.totalLinear || 0) * (zPW / 1000);
      grp.area += zArea;
      projectTotalArea.val += zArea;

      // 3. Structure (Carriers)
      grp.carrierLen += Number(s.carrierLen || 0);

      // Carrier Bars Optimization (per zone strategy)
      let zBars = 0;
      if (s.carrierSegments && Array.isArray(s.carrierSegments)) {
        zBars = Math.ceil(
          this.calculateOptimizedBars(s.carrierSegments, zCarrierL) * waste,
        );
      } else {
        zBars = Math.ceil((Number(s.carrierLen || 0) * waste) / zCarrierL);
      }
      grp.carrierBars += zBars;

      // 4. Trims (Window/Wall V)
      grp.wallV += Number(s.wallV || 0);
      grp.shadow += Number(s.shadow || 0);
      // V-Angle Bars
      grp.vAngleBars += Math.ceil(
        (Number(s.wallV || 0) * waste) / vAngleBarLength,
      );

      // 5. Hangers (Ty ren)
      const zPoints = s.isFacade ? 0 : Number(s.hangers || 0);
      grp.hangerPoints += zPoints;

      // Rod Bars (Thanh ty ren 3m)
      const zTotalRodCheck = zPoints * zHangerL;
      grp.rodBars += Math.ceil((zTotalRodCheck * waste) / 3.0);

      // 6. Accessories
      const acc = s.accessories || {};
      const zCouplers =
        acc.carriers?.couplers ||
        Math.ceil((Number(s.carrierLen || 0) * waste) / zCarrierL);
      const zMocTreo =
        acc.hangers?.details?.mocTreoXuong || Math.ceil(zPoints * waste);
      const zNoDan = acc.hangers?.details?.noDan || Math.ceil(zPoints * waste);
      const zSplicers = acc.accessories?.splicer || 0;

      grp.couplers += zCouplers;
      grp.mocTreo += zMocTreo;
      grp.noDan += zNoDan;
      grp.splicers += zSplicers;
    });

    this.autoSave(); // [AUTO-SAVE] Lưu sau khi tính toán xong

    // --- SECTION 1: PER-ZONE DETAILS ---
    // Build per-zone HTML blocks (restoring the original per-zone breakdown)
    const zoneBlocks = zones.map((zone, idx) => {
      const s = zone.stats || {};
      const panels = Array.isArray(s.panels) ? s.panels.slice() : [];
      const fascia = Array.isArray(s.fascia) ? s.fascia.slice() : [];
      const zInputs = zone.savedState?.inputs || {};
      const zPW =
        parseFloat(zInputs.cfg_pW) ||
        parseFloat(document.getElementById("cfg_pW")?.value || 100);
      const zCarrierL = parseFloat(zInputs.cfg_carrierL) || globalCarrierL;
      const zHangerL = parseFloat(zInputs.cfg_hangerL) || 1.0;

      const panelGroups = groupCounts(panels);
      const fasciaGroups = groupCounts(fascia);

      // Calculate per-zone bars
      let carrierBars = 0;
      if (s.carrierSegments && Array.isArray(s.carrierSegments)) {
        carrierBars = Math.ceil(
          this.calculateOptimizedBars(s.carrierSegments, zCarrierL) * waste,
        );
      } else {
        carrierBars = Math.ceil(
          (Number(s.carrierLen || 0) * waste) / zCarrierL,
        );
      }
      const vAngleBars = Math.ceil(
        (Number(s.wallV || 0) * waste) / vAngleBarLength,
      );
      const hangersWithWaste = Math.ceil(
        (s.isFacade ? 0 : Number(s.hangers || 0)) * waste,
      );

      return `
        <div style="border-bottom:1px solid #eee; margin-bottom:8px; padding-bottom:8px">
          <div style="display:flex; justify-content:space-between; align-items:center">
            <div><b>${zone.name || "Zone " + (idx + 1)}</b><br><small>${(Number(s.totalLinear) || 0).toFixed(2)} m</small></div>
            <div style="font-size:12px; color:#666">${new Date(zone.ts).toLocaleString()}</div>
          </div>

          <div style="margin-top:8px">
            <div style="font-weight:600; margin-bottom:6px">1) Tấm trần: ${zone.savedState?.presetName || "Custom"} (${zPW}mm) - ${Number(s.totalLinear || 0).toFixed(2)} md</div>
            <div style="max-height:140px; overflow:auto; border:1px solid #eee; padding:6px; background:#fff">
              ${panelGroups.length ? `<table style="width:100%; font-size:13px; border-collapse:collapse">${panelGroups.map((p) => `<tr><td>${p.len.toFixed(2)} m</td><td style="text-align:right">${p.qty}</td></tr>`).join("")}</table>` : '<div style="color:#666">Không có tấm</div>'}
            </div>
          </div>

          <div style="margin-top:8px">
            <div style="font-weight:600; margin-bottom:6px">2) Xương & Ty</div>
            <div style="display:flex; gap:12px; flex-wrap:wrap">
              <div> Xương: <b>${Number(s.carrierLen || 0).toFixed(2)} md</b> (${carrierBars} cây)</div>
              <div> Ty treo: <b>${s.isFacade ? 0 : Number(s.hangers || 0)}</b> (có hao hụt: ${hangersWithWaste})</div>
            </div>
          </div>

          <div style="margin-top:8px">
            <div style="font-weight:600; margin-bottom:6px">3) V-Góc & Shadow</div>
            <div> V-Góc: <b>${Number(s.wallV || 0).toFixed(2)} md</b> (${vAngleBars} cây)</div>
            <div> Shadow: <b>${Number(s.shadow || 0).toFixed(2)} md</b></div>
          </div>

          <div style="margin-top:8px">
            <div style="font-weight:600; margin-bottom:6px">4) Fascia (Mặt dựng)</div>
            <div style="max-height:120px; overflow:auto; border:1px solid #eee; padding:6px; background:#fff">
              ${fasciaGroups.length ? `<table style="width:100%; font-size:13px; border-collapse:collapse">${fasciaGroups.map((p) => `<tr><td>${p.len.toFixed(2)} m</td><td style="text-align:right">${p.qty}</td></tr>`).join("")}</table>` : '<div style="color:#666">Không có fascia</div>'}
            </div>
          </div>
        </div>`;
    });

    // --- RENDER HTML ---
    let html = `<div style="font-family: 'Segoe UI', sans-serif; padding:10px;">
      <h3 style="margin:0 0 8px 0">📋 BÁO CÁO DỰ ÁN (Chi tiết từng phòng)</h3>
      ${zoneBlocks.join("")}

      <hr style="margin:20px 0; border:none; border-top:2px solid #1565C0"/>

      <h3 style="margin:0 0 8px 0; color:#1565C0">🏷️ TỔNG HỢP VẬT TƯ (Theo Loại Tấm)</h3>
      <div style="margin-bottom:15px; background:#E3F2FD; padding:10px; border-radius:4px">
         <b>Tổng diện tích dự án:</b> <span style="font-size:18px; color:#D84315">${projectTotalArea.val.toFixed(2)} m²</span>
         <div style="font-size:11px; color:#555; margin-top:4px">Đã bao gồm hệ số hao hụt an toàn ${wastePct}%</div>
      </div>
    `;

    // --- SECTION 2: SUMMARY BY PANEL TYPE ---
    // Loop through each Panel Type
    Object.keys(byType).forEach((pKey) => {
      const grp = byType[pKey];
      const panelGroups = groupCounts(grp.panels);
      const fasciaGroups = groupCounts(grp.fascia);

      html += `
        <div style="border:1px solid #ddd; border-radius:4px; margin-bottom:20px; box-shadow:0 2px 4px rgba(0,0,0,0.05)">
            <div style="background:#f5f5f5; padding:10px; border-bottom:1px solid #ddd; font-weight:bold; color:#37474F">
                🏷️ ${pKey} - ${grp.area.toFixed(2)} m²
            </div>

            <div style="padding:10px">
                <!-- TABLE 1: MAIN MATERIAL -->
                <table style="width:100%; border-collapse:collapse; margin-bottom:10px; font-size:13px">
                    <tr style="background:#ECEFF1"><th style="text-align:left; padding:6px">Vật tư chính & Kết cấu</th><th style="text-align:right; padding:6px">Số lượng</th></tr>
                    <tr><td style="padding:6px; border-bottom:1px solid #eee">Tấm trần ${pKey}</td><td style="padding:6px; text-align:right; border-bottom:1px solid #eee"><b>${grp.area.toFixed(2)} m²</b></td></tr>
                    <tr><td style="padding:6px; border-bottom:1px solid #eee">Xương gài (Tổng ${grp.carrierLen.toFixed(2)} md)</td><td style="padding:6px; text-align:right; border-bottom:1px solid #eee"><b>${grp.carrierBars}</b> cây</td></tr>
                    <tr><td style="padding:6px; border-bottom:1px solid #eee">Thanh V-Góc (Tổng ${grp.wallV.toFixed(2)} md)</td><td style="padding:6px; text-align:right; border-bottom:1px solid #eee"><b>${grp.vAngleBars}</b> cây</td></tr>
                    ${grp.shadow > 0 ? `<tr><td style="padding:6px; border-bottom:1px solid #eee">Thanh Shadow Gap</td><td style="padding:6px; text-align:right; border-bottom:1px solid #eee">${grp.shadow.toFixed(2)} md</td></tr>` : ""}
                    ${grp.fascia.length > 0 ? `<tr><td style="padding:6px; border-bottom:1px solid #eee">Fascia (Mặt dựng)</td><td style="padding:6px; text-align:right; border-bottom:1px solid #eee">${grp.fascia.reduce((a, b) => a + b, 0).toFixed(2)} md</td></tr>` : ""}
                </table>

                <!-- TABLE 2: ACCESSORIES -->
                <table style="width:100%; border-collapse:collapse; margin-bottom:10px; font-size:13px">
                    <tr style="background:#FFF3E0"><th style="text-align:left; padding:6px; color:#E65100">Phụ kiện đi kèm</th><th style="text-align:right; padding:6px; color:#E65100">Số lượng</th></tr>
                    <tr><td style="padding:6px; border-bottom:1px solid #eee">Ty ren treo trần (3m)</td><td style="padding:6px; text-align:right; border-bottom:1px solid #eee"><b>${grp.rodBars}</b> cây <span style="color:#999;font-size:11px">(${grp.hangerPoints} điểm)</span></td></tr>
                    <tr><td style="padding:6px; border-bottom:1px solid #eee">Bộ Nở đạn + Ecu</td><td style="padding:6px; text-align:right; border-bottom:1px solid #eee"><b>${grp.noDan}</b> bộ</td></tr>
                    <tr><td style="padding:6px; border-bottom:1px solid #eee">Móc treo xương</td><td style="padding:6px; text-align:right; border-bottom:1px solid #eee"><b>${grp.mocTreo}</b> cái</td></tr>
                    <tr><td style="padding:6px; border-bottom:1px solid #eee">Khóa nối xương</td><td style="padding:6px; text-align:right; border-bottom:1px solid #eee"><b>${grp.couplers}</b> cái</td></tr>
                    ${grp.splicers > 0 ? `<tr><td style="padding:6px; border-bottom:1px solid #eee">Splicer (Nối tấm)</td><td style="padding:6px; text-align:right; border-bottom:1px solid #eee"><b>${grp.splicers}</b> cái</td></tr>` : ""}
                </table>

                <!-- DETAIL: PANELS -->
                 <div style="margin-top:8px">
                    <div style="font-size:12px; font-weight:600; color:#555; margin-bottom:4px">Chi tiết tấm cắt (Sản xuất):</div>
                    <div style="max-height:100px; overflow:auto; border:1px solid #eee; font-size:12px">
                        ${panelGroups.length ? `<table style="width:100%; border-collapse:collapse">${panelGroups.map((p) => `<tr><td style="padding:2px 5px">${p.len.toFixed(2)}m</td><td style="text-align:right; padding:2px 5px">${p.qty}</td></tr>`).join("")}</table>` : "<div style='padding:5px'>N/A</div>"}
                    </div>
                </div>
            </div>
        </div>
      `;
    });

    html += `</div>`;

    document.getElementById("boqContent").innerHTML = html;
    document.getElementById("boqModal").classList.remove("hidden");
  }

  // [XUẤT CSV] Xuất dữ liệu BOQ ra file Excel - dùng cho shopdrawing
  // [THỰC TẾ] Kỹ sư dùng file này để:
  //   1. Gửi lệnh sản xuất cho nhà máy cắt
  //   2. Lập bảng tính tổng hợp project
  //   3. Đặt hàng vật tư phụ kiện
  exportCSV() {
    if (this.state.strips.length === 0) {
      alert("Vui lòng tính toán trước khi xuất!");
      return;
    }

    // Tính toán dữ liệu BOQ
    const metrics = this.calculateBOQData();
    const carrierBarL = this.getInputValue("cfg_carrierL", 1.0, 12.0, 3.0);
    const wastePct = this.getInputValue("cfg_waste", 0, 50, 0);

    let csv = "\uFEFF"; // BOM for Excel UTF-8

    // [HEADER]
    const projectName = document.getElementById("projectName")?.value || "BOQ";
    const now = new Date();
    const dateStr = now.toISOString().split("T")[0];

    csv += `BÁO CÁO BÓC KHỐI LƯỢNG - TRẦN NHÔM LINEAR\n`;
    csv += `Tên công trình,${projectName}\n`;
    csv += `Ngày xuất,${dateStr}\n`;
    csv += `Hệ số hao hụt,${wastePct}%\n\n`;

    // Luôn tính toán data chuẩn để có metrics base (dùng cho carrier, trims...)
    // [REMOVED] Redundant recalculation causing SyntaxError
    // const metrics = this.calculateBOQData();

    // [FIX] Define isModalOpen based on DOM state
    const isModalOpen = !document
      .getElementById("boqModal")
      .classList.contains("hidden");

    if (isModalOpen) {
      // --- MODE 1: EXPORT WHAT YOU SEE (FROM DOM) ---
      // Nếu modal mở, ta ưu tiên lấy số liệu user đã sửa trong bảng

      csv += `VẬT TƯ & PHỤ KIỆN (Đã chỉnh sửa)\n`;
      csv += `Tên Vật Tư,ĐVT,Số Lượng\n`;

      // Helper function to scrape table
      const scrapeTable = (tableId) => {
        const table = document.getElementById(tableId);
        if (!table) return;
        const rows = table.querySelectorAll("tr");
        rows.forEach((row, idx) => {
          if (idx === 0) return; // Skip header
          const inputs = row.querySelectorAll("input.boq-inp");
          if (inputs.length >= 3) {
            const name = inputs[0].value;
            const unit = inputs[1].value;
            const val = inputs[2].value;
            if (name && val) {
              csv += `${name},${unit},${val}\n`;
            }
          }
        });
      };

      scrapeTable("boq-table-main");
      scrapeTable("boq-table-acc");
      csv += `\n`;

      // 2. Chi tiết tấm
      csv += `CHI TIẾT CẮT TẤM\n`;
      csv += `Chiều dài / Diễn giải,Số Lượng\n`;
      const panelTable = document.getElementById("boq-table-panels");
      if (panelTable) {
        const rows = panelTable.querySelectorAll("tr");
        rows.forEach((row, idx) => {
          if (idx === 0) return;
          const inputs = row.querySelectorAll("input.boq-inp");
          if (inputs.length >= 2) {
            csv += `${inputs[0].value},${inputs[1].value}\n`;
          }
        });
      }
    } else {
      // --- MODE 2: EXPORT FROM CALCULATION (RAW) ---
      // Logic: Tính toán tự động hoàn toàn

      csv += `BẢNG TỔNG HỢP VẬT TƯ (Tự động tính)\n`;
      csv += `Tên Vật Tư,ĐVT,Số Lượng,Ghi chú\n`;

      // 1. Tấm trần
      csv += `Tấm trần ${metrics.presetName} (${metrics.panelWidth}mm),m2,${metrics.totalArea},\n`;

      // 2. Hệ khung xương
      csv += `Thanh Xương gài (Carrier) ${carrierBarL}m,Cây,${metrics.carriers.bars},Tổng: ${metrics.carriers.totalLen} md\n`;
      csv += `Thanh V-Góc (3.0m),Cây,${metrics.trims.bars},Tổng: ${metrics.trims.totalLen} md\n`;

      // [NEW] Shadow Gap
      if (metrics.shadowTrims && metrics.shadowTrims.bars > 0) {
        csv += `Thanh Shadow Gap (Z-Profile) 3.0m,Cây,${metrics.shadowTrims.bars},Tổng: ${metrics.shadowTrims.totalLen} md\n`;
      }

      // Fascia
      if (metrics.fascia && metrics.fascia.totalLen > 0) {
        csv += `Tấm Fascia/Kính mặt dựng,md,${metrics.fascia.totalLen},Hao hụt cắt: check thực tế\n`;
      }

      // 3. Phụ kiện
      csv += `Khóa nối xương (Coupler),Cái,${metrics.carriers.couplers},\n`;
      csv += `Móc treo xương,Cái,${metrics.hangers.details.mocTreoXuong},\n`;
      csv += `Ty ren (2m),Cây,${metrics.hangers.tyRenBars},Tổng: ${metrics.hangers.details.tyRenMeters} md\n`;
      csv += `Bộ Nở đạn + Ecu,Bộ,${metrics.hangers.details.noDan},\n`;

      // Splicer
      if (metrics.accessories.splicer > 0) {
        csv += `Phụ kiện nối tấm (Splicer),Cái,${metrics.accessories.splicer},\n`;
      }

      csv += `\n`;

      // [PART 2] CHI TIẾT CẮT TẤM
      csv += `LỆNH SẢN XUẤT TẤM\n`;
      csv += `Chiều dài (mm),SL Net,Ghi chú\n`;
      Object.keys(metrics.panels.groups)
        .sort((a, b) => b - a)
        .forEach((len) => {
          const item = metrics.panels.groups[len];
          csv += `${(len * 1000).toFixed(0)},${item.qty},${item.status}\n`;
        });
    }

    // [DOWNLOAD]
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = `BOQ_${projectName.replace(/\s+/g, "_")}_${dateStr}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    this.showFeedback("Đã xuất file CSV thành công!", "success");
  }

  // [XUẤT PROJECT CSV] Xuất toàn bộ project (tất cả zones)
  exportProjectCSV() {
    const zones = this.state.projectZones || [];

    if (!zones.length) {
      alert("Chưa có phòng nào trong Project để xuất!");
      return;
    }

    const carrierBarL = this.getInputValue("cfg_carrierL", 1.0, 12.0, 3.0);
    const wastePct = this.getInputValue("cfg_waste", 0, 50, 0);
    const waste = 1 + wastePct / 100;

    let csv = "\uFEFF"; // BOM

    // [HEADER]
    const projectName =
      document.getElementById("projectName")?.value || "Project";
    const now = new Date();
    const dateStr = now.toISOString().split("T")[0];

    csv += `BÁO CÁO TỔNG HỢP DỰ ÁN - TRẦN NHÔM LINEAR\n`;
    csv += `Tên dự án,${projectName}\n`;
    csv += `Ngày xuất,${dateStr}\n`;
    csv += `Số phòng,${zones.length}\n`;
    csv += `Hệ số hao hụt,${wastePct}%\n\n`;

    // [SECTION 1: DANH SÁCH PHÒNG]
    csv += `=== DANH SÁCH PHÒNG ===\n`;
    csv += `STT,Tên phòng,Diện tích (m²),Số tấm,Xương (md),Ty treo,V-Góc (md)\n`;

    let totalArea = 0,
      totalPanels = 0,
      totalCarrier = 0,
      totalHanger = 0,
      totalWallV = 0;

    zones.forEach((zone, i) => {
      const s = zone.stats || {};
      const zInputs = zone.savedState?.inputs || {};
      const zPW = parseFloat(zInputs.cfg_pW) || 100;
      const zArea = (Number(s.totalLinear || 0) * zPW) / 1000;
      const panelCount = Array.isArray(s.panels) ? s.panels.length : 0;

      csv += `${i + 1},${zone.name || "Zone " + (i + 1)},${zArea.toFixed(2)},${panelCount},${Number(s.carrierLen || 0).toFixed(2)},${s.hangers || 0},${Number(s.wallV || 0).toFixed(2)}\n`;

      totalArea += zArea;
      totalPanels += panelCount;
      totalCarrier += Number(s.carrierLen || 0);
      totalHanger += Number(s.hangers || 0);
      totalWallV += Number(s.wallV || 0);
    });

    csv += `TỔNG CỘNG,,${totalArea.toFixed(2)},${totalPanels},${totalCarrier.toFixed(2)},${totalHanger},${totalWallV.toFixed(2)}\n\n`;

    // [SECTION 2: TỔNG HỢP VẬT TƯ TOÀN DỰ ÁN]
    csv += `=== TỔNG HỢP VẬT TƯ TOÀN DỰ ÁN ===\n`;
    csv += `STT,Tên Vật Tư,ĐVT,Số Lượng (Net),Số Lượng (Có hao hụt),Ghi Chú\n`;

    const carrierBars = Math.ceil((totalCarrier * waste) / carrierBarL);
    const vAngleBars = Math.ceil((totalWallV * waste) / 3.0);
    const hangerWithWaste = Math.ceil(totalHanger * waste);

    csv += `1,Tấm trần Linear,m²,${totalArea.toFixed(2)},${(totalArea * waste).toFixed(2)},\n`;
    csv += `2,Thanh xương gài (${carrierBarL}m),Cây,${Math.ceil(totalCarrier / carrierBarL)},${carrierBars},Tổng ${totalCarrier.toFixed(2)} md\n`;
    csv += `3,Thanh V-Góc (3m),Cây,${Math.ceil(totalWallV / 3)},${vAngleBars},Tổng ${totalWallV.toFixed(2)} md\n`;
    csv += `4,Ty ren treo trần (3m),Cây,${Math.ceil(totalHanger)},${hangerWithWaste},\n`;
    csv += `5,Bộ nở đạn + Ecu,Bộ,${totalHanger},${hangerWithWaste},\n`;
    csv += `6,Móc treo xương,Cái,${totalHanger},${hangerWithWaste},\n`;
    csv += `7,Khóa nối xương,Cái,${Math.ceil(totalCarrier / carrierBarL)},${carrierBars},\n`;
    csv += `\n`;

    // [SECTION 3: CHI TIẾT TỪNG PHÒNG]
    csv += `=== CHI TIẾT TỪNG PHÒNG ===\n\n`;

    zones.forEach((zone, i) => {
      const s = zone.stats || {};
      const panels = Array.isArray(s.panels) ? s.panels : [];
      const zInputs = zone.savedState?.inputs || {};
      const zPW = parseFloat(zInputs.cfg_pW) || 100;

      csv += `--- PHÒNG ${i + 1}: ${zone.name || "Zone " + (i + 1)} ---\n`;
      csv += `Loại tấm,${zone.savedState?.presetName || "Custom"} (${zPW}mm)\n`;
      csv += `Diện tích,${((Number(s.totalLinear || 0) * zPW) / 1000).toFixed(2)} m²\n\n`;

      // Chi tiết cắt tấm
      if (panels.length > 0) {
        csv += `Chi tiết cắt tấm:\n`;
        csv += `Chiều dài (m),Số lượng\n`;

        // Group panels by length
        const grouped = {};
        panels.forEach((len) => {
          const k = Number(len).toFixed(3);
          grouped[k] = (grouped[k] || 0) + 1;
        });

        Object.keys(grouped)
          .sort((a, b) => parseFloat(b) - parseFloat(a))
          .forEach((len) => {
            csv += `${len},${grouped[len]}\n`;
          });
      }
      csv += `\n`;
    });

    // [DOWNLOAD]
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = `PROJECT_${projectName.replace(/\s+/g, "_")}_${dateStr}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    this.showFeedback(`Đã xuất ${zones.length} phòng ra file CSV!`, "success");
  }

  // ============ QUẢN LÝ DỰ ÁN (PROJECT MANAGEMENT) ============
  // [CÔNG DỤNG] Lưu/tải project zones - cho phép lưu nhiều phòng khác nhau
  // [THI CÔNG] Dùng để quản lý shopdrawing cho 1 tòa nhà gồm nhiều phòng
  // [PHẠM VI] Mỗi zone = 1 phòng, có riêng thông số, BOQ, visualization
  //
  // [CẤU TRÚC DỮ LIỆU]
  // state.projectZones = [
  //   {
  //     name: "Phòng VP",
  //     timestamp: 1234567890,
  //     inputMode: "PRESET",
  //     inputs: {...},     // Tất cả thông số input
  //     points: [...],     // Tọa độ đỉnh mặt bằng
  //     edgeTypes: [...],  // Loại viền của từng cạnh
  //     stats: {...}       // Thống kê QS: panels, fascia, carriers, hangers, etc
  //   },
  //   ...
  // ]

  // --- LƯU TRẠNG THÁI HIỆN TẠI (SNAPSHOT CURRENT STATE) ---
  // [CÔNG DỤNG] Capture toàn bộ thông tin của phòng hiện tại
  // [OUTPUT] Object chứa inputs + geometry + edge types → dùng cho lưu project
  // [THI CÔNG] Khi click "Lưu" → gọi hàm này để capture snapshot
  captureState() {
    // [HELPER] Hàm đọc giá trị từ input DOM
    // Nếu asNumber=true → chuyển về số, ngược lại giữ string
    const getVal = (id, asNumber = false) => {
      const el = document.getElementById(id);
      if (!el) return null;
      return asNumber ? parseFloat(el.value) : el.value;
    };

    // [CAPTURE INPUTS] Lưu tất cả thông số từ các input form
    // [THI CÔNG] Bao gồm: hình dạng, kích thước, thông số trần, thông số kết cấu
    const inputs = {
      // Phần 1: Mặt bằng (Floor Plan)
      shp_type: getVal("shp_type"), // Loại hình: RECT/CUSTOM
      dim_L: getVal("dim_L", true), // Chiều dài (mm)
      dim_W: getVal("dim_W", true), // Chiều rộng (mm)
      dim_Lc: getVal("dim_Lc", true), // Chiều dài custom (mm)
      dim_Wc: getVal("dim_Wc", true), // Chiều rộng custom (mm)

      // Phần 2: Thông số trần LINEAR
      cfg_pW: getVal("cfg_pW", true), // Bản rộng tấm (mm)
      cfg_gW: getVal("cfg_gW", true), // Khe hở tấm (mm)
      cfg_maxL: getVal("cfg_maxL", true), // Chiều dài nhôm max (m)
      cfg_maxTrans: getVal("cfg_maxTrans", true), // Giới hạn vận chuyển (m) - [MỚI]
      cfg_minCut: getVal("cfg_minCut", true), // Cắt tối thiểu (mm)

      // Phần 3: Viền & Kết cấu
      cfg_dir: getVal("cfg_dir"), // Hướng rải tấm (0=ngang, 90=dọc)
      cfg_wGap: getVal("cfg_wGap", true), // Khe hở tường (mm)
      cfg_cX: getVal("cfg_cX", true), // Bước xương (m)
      cfg_tY: getVal("cfg_tY", true), // Bước ty (m)
      cfg_hangerL: getVal("cfg_hangerL", true), // [MỚI] Chiều dài ty (m)
      cfg_carrierL: getVal("cfg_carrierL", true), // [MỚI] Chiều dài xương (m)
      cfg_waste: getVal("cfg_waste", true), // Hệ số an toàn (%)
    };

    // [CAPTURE GEOMETRY] Lưu tọa độ đỉnh + loại viền
    const points = this.state.points.map((p) => ({ x: p.x, y: p.y })); // Copy điểm
    const edgeTypes = this.state.edges.map((e) => e.type || "WALL_V"); // Copy loại viền

    // [RETURN SNAPSHOT] Trả về object snapshot đầy đủ
    return {
      ts: Date.now(), // [TIMESTAMP] Thời gian lưu (ms) - dùng để sắp xếp
      inputMode: this.state.inputMode, // [MODE] PRESET hay FREE
      inputs, // [INPUTS] Tất cả thông số
      points, // [GEOMETRY] Tọa độ đỉnh mặt bằng
      edgeTypes, // [EDGES] Loại viền (WALL_V, SHADOW, FASCIA, NONE)
      // [NEW] Save Preset Name explicitly
      presetName: this.currentPreset ? this.currentPreset.name : "Custom",
    };
  }

  // --- KHÔI PHỤC TRẠNG THÁI (RESTORE SNAPSHOT) ---
  // [CÔNG DỤNG] Load snapshot của phòng trước đó
  // [INPUT] data: Snapshot object từ captureState()
  // [THI CÔNG] Khi click vào phòng trong danh sách → gọi hàm này để load
  // [QUY TRÌNH] Restore inputs → Restore geometry → Recalculate → Redraw
  restoreState(data) {
    if (!data) return; // [SAFETY] Nếu không có data → không làm gì

    // [BƯỚC 1] RESTORE INPUTS - Điền lại giá trị các input field
    // [LƯU Ý] Loop qua data.inputs, tìm DOM element tương ứng, set giá trị
    if (data.inputs) {
      Object.keys(data.inputs).forEach((k) => {
        const el = document.getElementById(k); // Tìm input theo ID
        if (el) el.value = data.inputs[k]; // Set giá trị input
      });
    }

    // [NEW] Restore Preset Name
    if (data.presetName) {
      this.currentPreset = {
        name: data.presetName,
        color: data.inputs?.newPresetColor || "#E3F2FD",
      };
    }

    // [BƯỚC 2] RESTORE GEOMETRY - Khôi phục mặt bằng
    // [KHÁC BIỆT] Tuỳ vào mode (PRESET hay FREE) → cách khôi phục khác nhau
    const mode = data.inputMode || "PRESET";

    if (mode === "PRESET") {
      // [PRESET MODE] Từ inputs → tính toán lại points (không lưu trực tiếp)
      // [LÝ DO] PRESET mode dùng công thức hình chữ nhật, nên chỉ cần restore inputs
      // switchMode sẽ gọi preset() → rebuild points từ inputs

      this.switchMode("PRESET"); // Chuyển sang PRESET mode
      // Sau khi switchMode → edges sẽ được tạo lại
      // [RESTORE EDGE TYPES] Nếu data có lưu loại viền → restore
      if (Array.isArray(data.edgeTypes) && this.state.edges.length) {
        for (let i = 0; i < this.state.edges.length; i++) {
          this.state.edges[i].type =
            data.edgeTypes[i] || this.state.edges[i].type;
        }
        this.calculate(); // Tính toán lại với edge types mới
        this.draw(); // Vẽ lại canvas
      }
    } else {
      // [FREE MODE] Từ points → restore trực tiếp (vì là custom geometry)
      // [LÝ DO] FREE mode cho phép vẽ hình bất kỳ, phải restore points
      this.switchMode("FREE"); // Chuyển sang FREE mode

      // [RESTORE POINTS] Nếu có points → set trực tiếp
      if (Array.isArray(data.points) && data.points.length > 0) {
        this.state.points = data.points.map((p) => ({ x: p.x, y: p.y })); // Copy points
        this.syncEdges(); // Tạo edges từ points
        // [RESTORE EDGE TYPES] Nếu có lưu loại viền → restore
        if (Array.isArray(data.edgeTypes)) {
          for (let i = 0; i < this.state.edges.length; i++) {
            this.state.edges[i].type =
              data.edgeTypes[i] || this.state.edges[i].type;
          }
        }
        this.calculate(); // Tính toán lại
        this.draw(); // Vẽ lại canvas
      }
    }

    // [BƯỚC 3] UPDATE UI - Cập nhật nút thêm/chỉnh sửa
    this.updateAddButtonUI(); // Set "Lưu" hay "Cập nhật" tuỳ vào editingIndex
  }

  // --- THÊM/CẬP NHẬT ZONE VÀO PROJECT (ADD OR UPDATE ZONE) ---
  // [CÔNG DỤNG] Lưu phòng hiện tại vào danh sách project zones
  // [THI CÔNG] Khi click "Thêm" → lưu phòng mới, hoặc "Lưu" → cập nhật phòng đang edit
  // [THAM SỐ] Không có (dùng state.editingIndex để xác định add hay update)
  addToProject() {
    // [LẤYTEN] Tên phòng từ input "projectName", hoặc tự động "Zone 1, Zone 2,..."
    const nameEl = document.getElementById("projectName");
    const name =
      nameEl && nameEl.value
        ? nameEl.value.trim()
        : `Zone ${this.state.projectZones.length + 1}`;

    // [TÍNH TOÁN] Đảm bảo dữ liệu tính toán mới nhất
    this.calculate();

    // [BƯỚC 1] LẤY DỮ LIỆU TẤMTRẦN
    // [THỐNG KÊ] Tuyển tập chiều dài tất cả các mảnh tấm (sau cắt)
    const panels = [];
    this.state.strips.forEach((s) => {
      if (Array.isArray(s.pieces))
        s.pieces.forEach((p) => panels.push(Number(p.len || 0))); // Lưu chiều dài (m)
    });

    // [BƯỚC 2] LẤY DỮ LIỆU FASCIA (TẤM MẶT DỰNG)
    // [THI CÔNG] Fascia = tấm che che lắp ở biên phòng (kính, bê tông, nhôm)
    const fascia = [];
    this.state.edges.forEach((e) => {
      if (e.type === "FASCIA") {
        const len = Math.sqrt(
          Math.pow(e.p2.x - e.p1.x, 2) + Math.pow(e.p2.y - e.p1.y, 2),
        );
        if (len > 0.001) fascia.push(len); // Lưu chiều dài fascia (m)
      }
    });

    // [BƯỚC 3] TÍNH TỔNG CHỈ TIÊU
    // [BÓC TÁCH] Chiều dài tấm, xương, viền, ty → dùng cho báo cáo QS
    const totalLinear = this.state.strips.reduce(
      (s, r) => s + (r.totalLen || 0),
      0,
    ); // Tổng chiều dài tấm (m)
    const carrierLen = this.state.carriers.reduce(
      (s, c) => s + (c.len || 0),
      0,
    ); // Tổng chiều dài xương (m)

    // [VIỀN] Tính toán viền V-Góc + Shadow
    let wallV = 0,
      shadow = 0;
    this.state.edges.forEach((e) => {
      const len = Math.sqrt(
        Math.pow(e.p2.x - e.p1.x, 2) + Math.pow(e.p2.y - e.p1.y, 2),
      );
      if (e.type === "WALL_V") wallV += len; // V-Góc (m)
      if (e.type === "SHADOW") shadow += len; // Shadow Gap (m)
    });

    // [KẾT CẤU] Lưu danh sách segments xương để tính toán Bin Packing chính xác
    const carrierSegments = this.state.carriers.map((c) => c.len);

    // [KẾT CẤU] Đếm ty treo
    const hangers = this.state.hangers.length; // Số ty (chiếc)
    const brackets = 0; // Mặc định 0, user có thể chỉnh lại
    const isFacade = fascia.length > 0; // Flag: có fascia hay không

    // [TỔNG HỢP] Tạo stats object chứa tất cả thống kê
    // [TỔNG HỢP] Tạo stats object chứa tất cả thống kê
    // [UPDATE] Use full metrics from calculateBOQData to capture accessories
    const metrics = this.calculateBOQData();
    const stats = {
      panels, // [PANELS] Mảng chiều dài tấm
      fascia, // [FASCIA] Mảng chiều dài fascia
      carrierSegments, // [NEW] Mảng chiều dài xương (cho tối ưu cắt)
      totalLinear, // [TỔNG] Tổng chiều dài tấm
      carrierLen, // [KẾTCẤU] Tổng chiều dài xương
      wallV, // [VIỀN] V-Góc
      shadow, // [VIỀN] Shadow
      hangers, // [KẾTCẤU] Số ty
      brackets, // [KẾTCẤU] Số brae
      isFacade, // [FLAG] Có fascia không
      // [NEW] Accessories Data
      accessories: metrics, // Store full metrics for detailed BOQ
    };

    // [BƯỚC 4] CAPTURE SNAPSHOT - Lưu snapshot của phòng này
    // [CHI TIẾT] Snapshot = inputs + geometry (points, edge types)
    // Dùng để restore sau này khi load phòng
    const savedState = this.captureState();

    // [BƯỚC 5] TẠO RECORD - Tạo object zone với đầy đủ thông tin
    const record = {
      id: Date.now(), // [ID] Unique ID (timestamp)
      name, // [TÊN] Tên phòng
      ts: Date.now(), // [TIMESTAMP] Thời gian lưu
      savedState, // [SNAPSHOT] Snapshot tính toán lại khi load
      stats, // [THỐNG KÊ] Tóm tắt chiếu dài, số lượng, v.v
    };

    // [BƯỚC 6] LƯU VÀO DANH SÁCH
    // [ĐIỀU KIỆN] Nếu editingIndex=null → thêm mới, ngược lại → cập nhật
    if (this.state.editingIndex === null) {
      this.state.projectZones.push(record); // Thêm zone mới vào cuối danh sách
    } else {
      const idx = this.state.editingIndex;
      if (this.state.projectZones[idx]) {
        this.state.projectZones[idx] = record; // Cập nhật zone tại index
      }
      this.state.editingIndex = null; // Thoát khỏi mode edit
    }

    // [BƯỚC 7] RESET UI
    if (nameEl) nameEl.value = ""; // Xóa input tên

    this.updateAddButtonUI(); // Cập nhật nút (Thêm/Lưu)
    this.renderProjectList(); // Vẽ lại danh sách zones

    // [FIX] Show feedback
    this.showFeedback(
      this.state.editingIndex === null
        ? "Đã cập nhật Zone!"
        : "Đã thêm Zone mới!",
      "success",
    );
    this.autoSave(); // [AUTO-SAVE] Lưu sau khi thay đổi project
  }

  // --- CHỈNH SỬA ZONE (EDIT EXISTING ZONE) ---
  // [CÔNG DỤNG] Load zone từ danh sách → edit → lưu lại
  // [THI CÔNG] Khi click nút ✏️ → load zone này để chỉnh sửa
  // [THAM SỐ] index: Vị trí trong mảng state.projectZones
  editZone(index) {
    const zone = this.state.projectZones[index];
    if (!zone) return; // [SAFETY] Nếu không tìm thấy zone → không làm gì

    // [BƯỚC 1] SET MODE EDIT
    this.state.editingIndex = index; // Đánh dấu đang edit zone này

    // [BƯỚC 2] RESTORE TÊN
    // Hiển thị tên phòng trong input (để user có thể chỉnh sửa)
    const nameEl = document.getElementById("projectName");
    if (nameEl) nameEl.value = zone.name || `Zone ${index + 1}`;

    // [BƯỚC 3] RESTORE TRẠNG THÁI TÍNH TOÁN
    // [QUY TRÌNH] Gọi restoreState → sẽ restore inputs + geometry
    this.restoreState(zone.savedState);

    // [BƯỚC 4] UPDATE UI
    this.updateAddButtonUI(); // Nút sẽ thay đổi từ "Thêm" thành "Lưu"
  }

  // --- XÓA ZONE (DELETE ZONE) ---
  // [CÔNG DỤNG] Xóa 1 phòng khỏi danh sách project
  // [THI CÔNG] Khi click nút 🗑️ → xóa zone này
  // [THAM SỐ] index: Vị trí trong mảng state.projectZones
  deleteZone(index) {
    // [VALIDATION] Kiểm tra index hợp lệ
    if (index < 0 || index >= this.state.projectZones.length) return;

    // [XÓA] Xóa zone tại index
    this.state.projectZones.splice(index, 1);

    // [CLEANUP] Nếu đang edit zone này → clear editingIndex
    if (this.state.editingIndex === index) this.state.editingIndex = null;

    // [UPDATE UI]
    this.updateAddButtonUI(); // Cập nhật nút
    this.renderProjectList(); // Vẽ lại danh sách (zone đã xóa sẽ mất)

    this.autoSave(); // [AUTO-SAVE] Lưu sau khi xóa project
  }

  // --- VẼ DANH SÁCH PROJECT (RENDER PROJECT LIST UI) ---
  // [CÔNG DỤNG] Hiển thị tất cả zones dưới dạng danh sách có nút Edit/Delete
  // [THI CÔNG] Dùng để duyệt, chọn, sửa, xóa phòng trong project
  // [OUTPUT] HTML danh sách zones → insert vào DOM element #projectList
  // [VẼ DANH SÁCH PROJECT] - Updated for Lucide Icons
  renderProjectList() {
    const container = document.getElementById("projectList");
    if (!container) return;

    if (this.state.projectZones.length === 0) {
      container.innerHTML =
        '<div class="text-muted p-2 text-center text-sm">Chưa có phòng nào được lưu.</div>';
      return;
    }

    const rows = this.state.projectZones.map((z, i) => {
      const d = new Date(z.ts);
      const ts =
        d.toLocaleDateString("vi-VN") +
        " " +
        d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });

      return `
        <div class="proj-item" style="display:flex; justify-content:space-between; align-items:center; padding:8px; border-bottom:1px solid #eee">
          <div style="flex:1">
            <div style="font-weight:600; font-size:13px">${z.name || "Zone " + (i + 1)}</div>
            <div style="font-size:11px; color:#666; margin-top:2px;">
                <span style="display:inline-flex; align-items:center; gap:4px">
                    <i data-lucide="maximize" class="icon-xs"></i> ${z.stats.totalLinear.toFixed(2)}m
                    <span style="margin:0 4px">•</span>
                    <i data-lucide="layers" class="icon-xs"></i> ${Array.isArray(z.stats.panels) ? z.stats.panels.length : z.stats.panels}
                </span>
                <div style="color:#999; font-size:10px; margin-top:2px">${ts}</div>
            </div>
          </div>
          <div style="margin-left:8px; display:flex; gap:6px">
            <button class="btn btn-sm btn-secondary" onclick="app.editZone(${i})" title="Sửa">
                <i data-lucide="edit-3" class="icon-xs"></i>
            </button>
            <button class="btn btn-sm btn-icon-only" style="border-color:#ffcccc; color:red" onclick="app.deleteZone(${i})" title="Xóa">
                <i data-lucide="trash-2" class="icon-xs"></i>
            </button>
          </div>
        </div>`;
    });

    container.innerHTML = rows.join("");
    if (window.lucide) window.lucide.createIcons();
  }

  // --- CẬP NHẬT NÚT "THÊM/LƯU" (UPDATE ADD BUTTON UI) ---
  // [CÔNG DỤNG] Thay đổi text/style của nút tuỳ vào mode (add hay edit)
  // [LOGIC]
  //   - Nếu editingIndex=null → "➕ Thêm" (add mode)
  //   - Nếu editingIndex!=null → "💾 Lưu" (edit/save mode)
  // [THI CÔNG] Dùng để user biết họ đang ở chế độ nào
  updateAddButtonUI() {
    const btn = document.getElementById("btn_addProject");
    if (!btn) return; // [SAFETY] Nếu không tìm nút → không làm gì

    if (this.state.editingIndex === null) {
      // [ADD MODE] Không có zone nào đang edit
      btn.textContent = "➕ Thêm"; // Text: Thêm
      btn.className = "btn"; // Style: button bình thường
    } else {
      // [EDIT MODE] Đang edit 1 zone nào đó
      btn.textContent = "💾 Lưu"; // Text: Lưu (emphasis save)
      btn.className = "btn btn-save"; // Style: button highlight (khác màu để nhấn mạnh)
    }
  }

  // --- HELPER: CẤP TRUNG TÂM VIEW (CENTER VIEW ON GEOMETRY) ---
  // [CÔNG DỤNG] Tự động zoom/pan sao cho mặt bằng nằm ở giữa canvas
  // [THI CÔNG] Khi load project → gọi hàm này để view rõ mặt bằng
  // [TOÁN HỌC] Tính bounds (min/max X,Y) → compute center → adjust pan/scale
  centerView() {
    // [TÍNH BOUNDS] Tìm min/max X,Y của mặt bằng
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;
    this.state.points.forEach((p) => {
      if (p.x < minX) minX = p.x; // Tìm X nhỏ nhất
      if (p.x > maxX) maxX = p.x; // Tìm X lớn nhất
      if (p.y < minY) minY = p.y; // Tìm Y nhỏ nhất
      if (p.y > maxY) maxY = p.y; // Tìm Y lớn nhất
    });

    // [TÍNH TÂM] Tâm hình chữ nhật bounding box
    const cx = (minX + maxX) / 2; // Tâm X
    const cy = (minY + maxY) / 2; // Tâm Y

    // [ĐIỀU CHỈNH PAN] Dịch chuyển canvas sao cho tâm mặt bằng nằm ở tâm canvas viewport
    // [CÔNG THỨC] panX = (canvas_width / 2) - (center_x * scale)
    this.state.panX = this.cvs.width / 2 - cx * this.state.scale; // Pan X
    this.state.panY = this.cvs.height / 2 - cy * this.state.scale; // Pan Y
  }

  // ============ KẾT THÚC CLASS ENGINE ============
  // Ghi chú: Hàm distToSeg() đã được import từ utils.js (không define ở đây)
  // --- DATA PERSISTENCE METHODS ---

  // [AUTO-SAVE] Trigger save with debounce (1s)
  autoSave() {
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => {
      this.saveState();
    }, 1000);
  }

  // [SAVE STATE] Lưu toàn bộ trạng thái vào LocalStorage
  saveState() {
    // 1. Capture current working inputs & geometry
    const currentSnapshot = this.captureState();

    // 2. Build Full State Object
    const fullState = {
      version: "17.0",
      ts: Date.now(),
      projectZones: this.state.projectZones,
      currentWork: currentSnapshot, // Trạng thái đang làm dở
      presets: this.userPresets, // Lưu custom presets
    };

    // 3. Save to Storage
    const success = saveToStorage(this.STORAGE_KEY, fullState);
    if (success) {
      console.log("💾 Auto-Saved State at " + new Date().toLocaleTimeString());
    }
  }

  // [LOAD STATE] Khôi phục trạng thái khi mở app
  loadState() {
    const data = loadFromStorage(this.STORAGE_KEY);
    if (!data) return; // Không có dữ liệu cũ

    console.log("📂 Loading saved state...", data);

    // 1. Restore Project List
    if (Array.isArray(data.projectZones)) {
      this.state.projectZones = data.projectZones;
      this.renderProjectList();
    }

    // 2. Restore Presets
    if (Array.isArray(data.presets)) {
      this.userPresets = data.presets;
      // Update User Presets in LocalStorage explicitly to sync legacy logic
      saveToStorage("USER_PRESETS", this.userPresets);
      this.updatePresetDropdown();
      this.renderPresetList();
    }

    // 3. Restore Current Work (Inputs + Drawing)
    if (data.currentWork) {
      this.restoreState(data.currentWork);
      this.showFeedback("Đã khôi phục phiên làm việc cũ", "info");
    }
  }

  // --- PROJECT FILE MANAGEMENT ---

  // [EXPORT PROJECT] Xuất toàn bộ dự án ra file JSON
  exportProject() {
    // Build export data
    const exportData = {
      version: "17.0",
      exportedAt: new Date().toISOString(),
      projectZones: this.state.projectZones,
      currentWork: this.captureState(),
      presets: this.userPresets,
    };

    // Create JSON blob
    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    // Create download link
    const link = document.createElement("a");
    const projectName =
      document.getElementById("projectName")?.value || "AluMaster_Project";
    const dateStr = new Date().toISOString().split("T")[0];
    link.href = url;
    link.download = `${projectName.replace(/\s+/g, "_")}_${dateStr}.json`;
    link.click();

    URL.revokeObjectURL(url);
    this.showFeedback("Đã xuất dự án ra file JSON!", "success");
  }

  // [NEW PROJECT] Tạo dự án mới (xóa tất cả dữ liệu)
  newProject() {
    // Confirm before deleting
    const zoneCount = this.state.projectZones.length;
    const confirmMsg =
      zoneCount > 0
        ? `⚠️ Bạn có ${zoneCount} phòng đã lưu.\n\nTẠO DỰ ÁN MỚI sẽ XÓA TẤT CẢ dữ liệu hiện tại.\n\nBạn có chắc chắn muốn tiếp tục?`
        : "Tạo dự án mới và xóa dữ liệu hiện tại?";

    if (!confirm(confirmMsg)) {
      this.showFeedback("Đã hủy tạo dự án mới", "info");
      return;
    }

    // Clear all data
    this.state.projectZones = [];
    this.state.points = [];
    this.state.strips = [];
    this.state.edges = [];
    this.state.carriers = [];
    this.state.hangers = [];
    this.state.editingIndex = null;

    // Reset inputs to defaults
    document.getElementById("projectName").value = "";
    document.getElementById("dim_L").value = "10.0";
    document.getElementById("dim_W").value = "6.0";
    document.getElementById("shp_type").value = "R";

    // Clear localStorage
    localStorage.removeItem(this.STORAGE_KEY);

    // Re-initialize
    this.switchMode("PRESET");
    this.renderProjectList();
    this.showFeedback("Đã tạo dự án mới!", "success");
  }

  // [LOAD PROJECT] Tải dự án từ file JSON
  loadProject(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);

        // Validate structure
        if (!data.version || !Array.isArray(data.projectZones)) {
          throw new Error("File không hợp lệ");
        }

        // Confirm if existing data
        if (this.state.projectZones.length > 0) {
          if (
            !confirm(
              `⚠️ Bạn có ${this.state.projectZones.length} phòng hiện tại.\n\nTẢI FILE MỚI sẽ GHI ĐÈ tất cả.\n\nTiếp tục?`,
            )
          ) {
            this.showFeedback("Đã hủy tải file", "info");
            event.target.value = ""; // Reset input
            return;
          }
        }

        // Load data
        this.state.projectZones = data.projectZones;
        this.renderProjectList();

        // Load presets if available
        if (Array.isArray(data.presets)) {
          this.userPresets = data.presets;
          this.userPresets = data.presets;
          saveToStorage("USER_PRESETS", this.userPresets);
          this.updatePresetDropdown();
        }

        // Load current work if available
        if (data.currentWork) {
          this.restoreState(data.currentWork);
        }

        // Save to localStorage
        this.saveState();

        this.showFeedback(
          `Đã tải ${data.projectZones.length} phòng từ file!`,
          "success",
        );
      } catch (err) {
        console.error("Load project error:", err);
        this.showFeedback("Lỗi đọc file: " + err.message, "error");
      }

      // Reset input for next load
      event.target.value = "";
    };

    reader.readAsText(file);
  }
}
