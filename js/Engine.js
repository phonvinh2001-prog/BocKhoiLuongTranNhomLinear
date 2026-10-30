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

// [NEW] AutoCAD Utilities
// [NEW] AutoCAD Utilities (Imported from separate file)
// [NEW] AutoCAD Utilities (Imported from separate file)
import { CAD_UTILS } from "./CADParser.js";
import { JointSolver } from "./JointSolver.js";

import { distribute, splitRun, packCuts, structureForRuns, csvText, escapeHTML } from './QuantityRules.js';
import { xlsxBytes, layoutDXF } from './ExportFormats.js';
import { validateProject } from './ProjectData.js';
export default class Engine {
  constructor() {
    this.cvs = document.getElementById("cvs");
    this.ctx = this.cvs.getContext("2d");
    this.cont = document.getElementById("cont");
    this.currentPreset = null;
    this.totalArea = 0;
    this.userPresets = [];

    // [STATE] Drawing State
    this.state = {
      mode: "IDLE", // IDLE, DRAW, EDIT
      points: [], // Array of {x, y}
      strips: [], // Array of strips
      gridSize: 0.5, // Grid snap size (meters)
      scale: 50, // Pixels per meter
      panX: 0,
      panY: 0,
      isDrag: false,
      lastM: { x: 0, y: 0 },
      edges: [], // List of wall edges {p1, p2, type}
      viewportW: 800,
      viewportH: 600,

      // [PROJECT ZONES] Storage
      projectZones: [],
      editingIndex: null,

      // [NEW] AutoCAD Features State
      CMD: {
        lastPoint: null, // Last clicked point (for relative coords)
        cursorPos: { x: 0, y: 0 }, // Current mouse pos (meters)
        isOrtho: false, // Ortho mode active?
        tempPoints: [], // For ghost lines
        history: [], // Command history
        activeCmd: null, // Current active command (e.g., 'OFFSET')
      },
    };

    // [DATA PERSISTENCE] Cấu hình lưu trữ
    this.STORAGE_KEY = "ALUMASTER_V17_STATE";
    this.saveTimeout = null;

    this.ctx.stroke();

    // [AUTO-CAD] Draw Overlay (Ghost lines, Tooltips)
    // This call is moved to the end of the draw() method.
    this.resize();
    this.bindEvents();
    this.loadPresets();

    // Khởi tạo preview renderer
    this.previewRenderer = new PreviewRenderer("previewCanvas");

    // [AUTO-CAD] Setup Event Listeners
    this.setupCADListeners();

    // [NEW] Joint Solver
    this.jointSolver = new JointSolver();
    // Default Joint Config
    this.state.jointConfig = {
      pattern: "DEFAULT", // DEFAULT, GRID, BRICK, RANDOM
      patternShift: 0.5,
    };
    // Initialize in PRESET mode (this will hide CMD bar)
    this.switchMode("PRESET");
    this.applyPreset();
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

    // Cập nhật Command Bar (Chỉ hiện khi Free Draw)
    const cmdBar = document.getElementById("cmd-bar-container");
    if (cmdBar) cmdBar.style.display = mode === "FREE" ? "flex" : "none";

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
    this.cont.onmousedown = (e) => {
      // [NEW] Check Joint Click first
      const m = this.getMouse(e);
      // Check Drag Start
      if (e.button === 0 && this.handleJointDown && this.handleJointDown(e)) return;
      // Check Click (Add/Remove) - Only if not dragging
      if (e.button === 0 && this.handleJointClick && this.handleJointClick(m)) return;

      this.onDown(e);
    };
    this.cont.onmousemove = (e) => {
      if (this.handleJointDrag && this.handleJointDrag(e)) return;
      this.onMove(e);
    };
    this.cont.onmouseup = () => {
      if (this.handleJointUp && this.handleJointUp()) return;
      this.state.isDrag = false;
    };
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

    document.querySelectorAll('[id^="cfg_"]').forEach(el=>{if(!["cfg_preset","cfg_dir","cfg_joint_pattern","cfg_joint_shift","cfg_calcMode"].includes(el.id))el.addEventListener("change",()=>this.calculate());});

    // 3. Config UI


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
      this.calculate();
      this.autoSave();
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
      div.innerHTML = `${escapeHTML(p.name)} - ${p.pW}mm x ${p.gW}mm <button onclick="app.deletePreset(${i})">Xóa</button>`;
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

  // [HELPER] Auto-center view on drawing


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
      type: "NONE",
    }));
  }

  // [HÀM PHỤ] Tính diện tích hình học thực tế (m2)
  getPolygonArea() {
    let area = 0;
    const pts = this.state.points;
    if (!pts || pts.length < 3) return 0;
    for (let i = 0; i < pts.length; i++) {
      let j = (i + 1) % pts.length;
      area += pts[i].x * pts[j].y;
      area -= pts[j].x * pts[i].y;
    }
    return Math.abs(area / 2);
  }

  // [HÀM PHỤ] Tính chu vi hình học thực tế (m dài)
  getPolygonPerimeter() {
    let perim = 0;
    const pts = this.state.points;
    if (!pts || pts.length < 3) return 0;
    for (let i = 0; i < pts.length; i++) {
      let j = (i + 1) % pts.length;
      const dx = pts[j].x - pts[i].x;
      const dy = pts[j].y - pts[i].y;
      perim += Math.sqrt(dx * dx + dy * dy);
    }
    return perim;
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

    // [AUTO-CAD] Update Cursor Pos immediately
    const rawM = this.getMouse(e);
    // Apply Ortho for Click (if Shift held or F8 Active)
    // Need last point to calc ortho projection
    let finalM = rawM;
    const lastPt =
      this.state.points.length > 0
        ? this.state.points[this.state.points.length - 1]
        : null;

    // Check ORTHO (Shift key OR F8 State)
    const isOrtho = e.shiftKey || this.state.CMD.isOrtho;

    if (this.state.mode === "DRAW" && lastPt && isOrtho) {
      const dx = Math.abs(rawM.x - lastPt.x);
      const dy = Math.abs(rawM.y - lastPt.y);
      if (dx > dy)
        finalM = { x: rawM.x, y: lastPt.y }; // Horizontal lock
      else finalM = { x: lastPt.x, y: rawM.y }; // Vertical lock
    }

    // [CONVERT] Chuyển đổi từ tọa độ màn hình (pixel) sang tọa độ canvas (mét)
    const m = finalM;

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
    // [AUTO-CAD] Store cursor pos for Command Parser
    this.state.CMD.cursorPos = m;

    // [AUTO-CAD] Re-draw to show ghost lines
    if (this.state.mode === "DRAW") {
      this.draw();
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
    if (this.state.points.length < 3) {this.state.strips=[];this.state.carriers=[];this.state.hangers=[];return;}

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

    const maxL = Math.min(this.getInputValue("cfg_maxL", 0.5, 12.0, 6.0, true), this.getInputValue("cfg_maxTrans", 0.5, 100, 12, true)); // Chiều dài nhôm tối đa (m)
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
          // [REFACTORED] DÙNG JOINT SOLVER ĐỂ TÍNH TOÁN CẮT TẤM

          // [NEW] Lấy Manual Joints từ Map (nếu có)
          if (!this.state.manualJointsMap) this.state.manualJointsMap = {};
          const stripKey = pos.toFixed(3) + ":" + seg.start.toFixed(3);
          /* [MODIFIED] Clone array to allow injection of drag joint */
          let manualJoints = [...(this.state.manualJointsMap[stripKey] || (segs.length===1?this.state.manualJointsMap[pos.toFixed(3)]:null) || [])];

          // [DRAG SUPPORT] Inject Dragging Joint temp
          if (
            this.state &&
            this.state.dragJoint &&
            this.state.dragJoint.stripKey === stripKey
          ) {
            manualJoints.push(this.state.dragJoint.val);
          }

          // 1. Lấy config manual joints cho strip này
          const stripConfig = {
            manualJoints: manualJoints,
            pattern: this.state.jointConfig.pattern,
            patternShift: this.state.jointConfig.patternShift,
            rowId: this.state.strips.length, // Dùng index làm rowId cho pattern so le
          };

          // 2. Tính toán cắt
          // runLen: chiều dài thực tế cần phủ
          // maxL: chiều dài thanh nhôm
          // minCut: chiều dài tối thiểu
          const rawPieces = this.jointSolver.solveStrip(
            runLen,
            maxL,
            stripConfig,
            minCut,
          );

          // 3. Convert lại format cũ (thêm status)
          const validPieces = rawPieces.map((len) => ({
            len: len,
            status: len < minCut ? "BAD" : "OK",
          }));

          // 4. Đếm Splicer (Số đoạn - 1)
          const spliceCount_fromCutting =
            validPieces.length > 1 ? validPieces.length - 1 : 0;

          // 5. Tính toán Offset (Logic cũ)
          // [SỬA LỖI 3] Áp dụng offset cho điểm bắt đầu/kết thúc tấm (chỉ dùng wGap, bỏ SAFE_DIST)
          // [NGUYÊN NHÂN] Tấm trần cần sát viền, chỉ cách wGap hoặc offset của V-Góc
          // [THI CÔNG] SAFE_DIST (300mm) chỉ dùng cho kết cấu (xương/ty), không cho tấm
          const minOffsetBoundary = wGap;
          let adjustedStart = seg.start + minOffsetBoundary;
          let adjustedEnd = seg.end - minOffsetBoundary;

          // [SỬA LỖI 4] Điều chỉnh offset dựa trên loại viền tại 2 cạnh
          // [NGUYÊN NHÂN] V-Góc (25mm), Shadow (15mm), Fascia → độ dày khác nhau
          // [THI CÔNG] Phải để margin để tấm không va vào viền → offset >= thickness + 10mm
          // [LƯU STRIP] Lưu thông tin dãy tấm này vào state
          this.state.strips.push({
            key: stripKey,
            pos: pos, // Vị trí (X hoặc Y tùy hướng) của dãy tấm
            start: adjustedStart, // [SỬA LỖI 3,4] Điểm bắt đầu (áp dụng SAFE_DIST + edge offset)
            end: adjustedEnd, // [SỬA LỖI 3,4] Điểm kết thúc (áp dụng SAFE_DIST + edge offset)
            width: pW, // Bản rộng tấm
            isVert: isVert, // Hướng rải
            pieces: validPieces, // Mảng các mảnh {len, status}
            splices: spliceCount_fromCutting, // [SỬA LỖI 1] Splicer từ cắt panel
            totalLen: runLen, // Tổng chiều dài thực
            // [NEW] Lưu config joint để hỗ trợ Edit sau này
            jointConfig: stripConfig,
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
    this.autoSave();
    this.draw();
    document.getElementById("coords").innerText =
      `Xong: ${this.state.strips.length} lines.`;
  }

  // [HÀM PHỤ] TÍNH TOÁN KẾT CẤU: Xương gài + Ty treo
  // [THI CÔNG] Xương luôn vuông góc với Tấm (Linear system)
  // Thực tế: Tấm chạy dọc → Xương chạy ngang (và ngược lại)
  calcStructure(isPanelVert, minX, maxX, minY, maxY) {
    this.state.warnings=[];this.state.carriers=[];this.state.hangers=[];this.state.carrierJoints=[];
    const cX=this.getInputValue('cfg_cX',0.5,5,1),tY=this.getInputValue('cfg_tY',0.5,5,1),stock=this.getInputValue('cfg_carrierL',1,12,3);
    const vertical=!isPanelVert;
    for(const pos of this.getLinearDistribution(vertical?minX:minY,vertical?maxX:maxY,cX)) {
      for(const seg of this.rayCast(pos,vertical)) {
        const len=seg.end-seg.start;if(len<=1e-8)continue;
        const run={x1:vertical?pos:seg.start,y1:vertical?seg.start:pos,x2:vertical?pos:seg.end,y2:vertical?seg.end:pos,len,pieces:splitRun(len,stock)};
        let cursor=0;run.joints=run.pieces.slice(0,-1).map(l=>(cursor+=l));
        const at=t=>({x:run.x1+(run.x2-run.x1)*t/len,y:run.y1+(run.y2-run.y1)*t/len});
        const positions=[...this.getLinearDistribution(0,len,tY),...run.joints].sort((a,b)=>a-b).filter((x,i,a)=>!i||Math.abs(x-a[i-1])>1e-8);
        positions.forEach(p=>this.state.hangers.push(at(p)));run.joints.forEach(p=>this.state.carrierJoints.push(at(p)));this.state.carriers.push(run);
      }
    }
  }

  getLinearDistribution(start, end, step) {
    if(end-start<0.3-1e-8){this.state.warnings ||= [];this.state.warnings.push('Nhịp nhỏ hơn 300 mm cần cấu tạo riêng');return [];}
    return distribute(start,end,step);
  }

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

          // [NEW] Visual Cue for Manual Joints vs Auto Joints
          // Manual Joints should be highlighted if in Edit Mode
          const isManualJoin = false; // TODO: Lấy info từ piece nếu có
          // Hiện tại piece chỉ có len, status. Ta chưa pass info Manual từ JointSolver.
          // Tạm thời vẽ tất cả joints.

          // [NEW] Draw Manual Joints specifically (Overlay)
          // Lấy manual joints từ stripConfig nếu có
          if (
            s.jointConfig &&
            s.jointConfig.manualJoints &&
            s.jointConfig.manualJoints.length > 0
          ) {
            const mJoints = s.jointConfig.manualJoints;
            ctx.fillStyle = "blue";

            mJoints.forEach((mj) => {
              // Convert mj (distance from start) to coord
              let jX, jY;
              if (s.isVert) {
                jX = s.pos + s.width / 2;
                jY = s.start + mj;
                // Draw Circle or Marker
                ctx.beginPath();
                ctx.arc(jX, jY, 0.08, 0, Math.PI * 2);
                ctx.fill();
              } else {
                jX = s.start + mj;
                jY = s.pos + s.width / 2;
                ctx.beginPath();
                ctx.arc(jX, jY, 0.08, 0, Math.PI * 2);
                ctx.fill();
              }
            });
          }
        });

        // [NEW] Highlight Strip on Hover during Joint Edit Mode
        if (this.state.isJointEditing) {
          // Draw hover effect?
          // Need mouse pos. this.state.CMD.cursorPos (updated in onMove)
          // But drag/pan logic uses this.state.lastM.
          // Let's rely on standard cursor logic or just the fact that "blue dots" appear.
          // When hovering, maybe show a ghost manual joint?
          // That requires `onMove` to trigger `draw` and pass mouse pos.

          // Draw "Ghost Joint" at mouse pos if hovering this strip
          const m = this.state.CMD.cursorPos;
          if (m) {
            let isHover = false;
            if (s.isVert) {
              if (
                Math.abs(m.x - (s.pos + s.width / 2)) < s.width / 2 + 0.1 &&
                m.y >= s.start &&
                m.y <= s.end
              )
                isHover = true;
            } else {
              if (
                Math.abs(m.y - (s.pos + s.width / 2)) < s.width / 2 + 0.1 &&
                m.x >= s.start &&
                m.x <= s.end
              )
                isHover = true;
            }

            if (isHover) {
              // Draw Ghost Joint
              ctx.fillStyle = "rgba(0,0,255,0.5)";
              ctx.beginPath();
              ctx.arc(m.x, m.y, 0.08, 0, Math.PI * 2);
              ctx.fill();

              // Draw dimensions
              const dist = s.isVert ? m.y - s.start : m.x - s.start;
              ctx.font = "0.2px Arial";
              ctx.fillStyle = "blue";
              ctx.fillText(dist.toFixed(2) + "m", m.x + 0.1, m.y - 0.1);
            }
          }
        }
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

    // [NEW] VẼ SNAP LINE (NẾU CÓ)
    if (this.state.snapLine) {
      ctx.beginPath();
      // Draw infinite line or segment? infinite is better for alignment
      // Draw large line centered at snap pos
      const sl = this.state.snapLine;
      if (sl.type === "VERT") {
        ctx.moveTo(sl.val, sl.y - 10);
        ctx.lineTo(sl.val, sl.y + 10);
      } else {
        ctx.moveTo(sl.x - 10, sl.val);
        ctx.lineTo(sl.x + 10, sl.val);
      }
      ctx.strokeStyle = "#FFEB3B"; // Yellow snap line
      ctx.setLineDash([0.2, 0.1]); // Dashed
      ctx.lineWidth = 0.03;
      ctx.stroke();
      ctx.setLineDash([]); // Reset dash

      // Draw Marker
      ctx.fillStyle = "#FFEB3B";
      ctx.beginPath();
      if (sl.type === "VERT") ctx.arc(sl.val, sl.y, 0.15, 0, Math.PI * 2);
      else ctx.arc(sl.x, sl.val, 0.15, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore(); // Khôi phục trạng thái transform ban đầu
  }

  // --- [MỚI] THUẬT TOÁN TỐI ƯU CẮT THANH (BIN PACKING ALGORITHM) ---
  calculateOptimizedBars(segments, barLength, sawBladeWidth = 0.005) {
    return packCuts(segments.flatMap(s=>splitRun(s,barLength)),barLength,sawBladeWidth).count;
  }

  saveNewPreset() {
    const name=document.getElementById('newPresetName').value.trim();
    const pW=Number(document.getElementById('newPresetPW').value),gW=Number(document.getElementById('newPresetGW').value),maxL=Number(document.getElementById('newPresetMaxL').value);
    if(!name||!Number.isFinite(pW)||pW<10||pW>1000||!Number.isFinite(gW)||gW<0||!Number.isFinite(maxL)||maxL<0.5||maxL>12)return this.showFeedback('Quy cách sản phẩm không hợp lệ','error');
    this.userPresets.push({name,pW,gW,maxL,color:document.getElementById('newPresetColor').value});
    saveToStorage('USER_PRESETS',this.userPresets);this.updatePresetDropdown();
    document.getElementById('cfg_preset').value=String(this.userPresets.length-1);this.applyPreset();this.renderPresetList();
    document.getElementById('presetModal').classList.add('hidden');this.showFeedback('Đã lưu mẫu sản phẩm','success');
  }

  calculateBOQData(forceMode = null) {
    const mode=forceMode||document.getElementById('cfg_calcMode')?.value||'EXACT';
    const waste=1+this.getInputValue('cfg_waste',0,50,3)/100;
    const stock=this.getInputValue('cfg_carrierL',1,12,3),rodStock=this.getInputValue('cfg_rodStock',0.5,12,3);
    const ceilingArea=this.getPolygonArea(),pW=this.getInputValue('cfg_pW',10,1000,100)/1000,gW=this.getInputValue('cfg_gW',0,500,0)/1000;
    const panelGroups={};let panelLen=0,splices=0;
    for(const s of this.state.strips){panelLen+=s.totalLen;splices+=s.splices||0;for(const p of s.pieces){const key=p.len.toFixed(3);panelGroups[key] ||= {qty:0,status:p.status};panelGroups[key].qty++;}}
    const norm=mode==='NORM';if(norm){panelLen=ceilingArea/(pW+gW);}
    const carrierSegments=this.state.carriers.map(c=>c.len),carrierLen=norm?ceilingArea/this.getInputValue('cfg_cX',0.5,5,1):carrierSegments.reduce((a,b)=>a+b,0);
    const edgeLengths=type=>this.state.edges.filter(e=>e.type===type).map(e=>Math.hypot(e.p2.x-e.p1.x,e.p2.y-e.p1.y));
    const trim=type=>{const a=edgeLengths(type),n=a.reduce((s,l)=>s+l,0);return {totalLen:n.toFixed(3),bars:Math.ceil(this.calculateOptimizedBars(a,3)*waste)};};
    const hangers=norm?Math.ceil(ceilingArea/(this.getInputValue('cfg_cX',0.5,5,1)*this.getInputValue('cfg_tY',0.5,5,1))):this.state.hangers.length;
    const length=this.getRodLength();const rodPlan=length===null||length>rodStock?null:packCuts(Array(hangers).fill(length),rodStock,0.005);
    const carrierPlan=packCuts(carrierSegments.flatMap(l=>splitRun(l,stock)),stock);
    const warnings=[...new Set(this.state.warnings||[])];if(length!==null&&length>rodStock)warnings.push('Ty lắp dài hơn cây ty; cần quy cách được duyệt, không tự nối');if(length===null)warnings.push('Thiếu cao độ neo/trần cùng mốc hoặc chiều dài ty lắp hợp lệ');
    if(this.state.strips.some(s=>s.pieces.some(p=>p.status==='BAD')))warnings.push('Có đoạn dưới chiều dài cắt tối thiểu; cần kiểm tra');
    if(norm)warnings.push('Định mức chỉ tham khảo; chi tiết thanh và nối lấy từ bố trí thực tế');
    return {schemaVersion:1,mode,presetName:this.currentPreset?.name||'Tùy chỉnh',color:this.currentPreset?.color||'#E3F2FD',totalArea:ceilingArea.toFixed(3),ceilingArea,panelFaceArea:this.state.strips.reduce((n,s)=>n+s.totalLen*s.width,0),panelWidth:pW*1000,warnings,complete:!warnings.length,
      carriers:{totalLen:carrierLen.toFixed(3),bars:Math.ceil((norm?Math.ceil(carrierLen/stock):carrierPlan.count)*waste),couplers:Math.ceil(this.state.carriers.reduce((n,c)=>n+splitRun(c.len,stock).length-1,0)*waste),stock,plan:carrierPlan},
      trims:trim('WALL_V'),shadowTrims:trim('SHADOW'),fascia:{totalLen:edgeLengths('FASCIA').reduce((a,b)=>a+b,0).toFixed(3),segments:edgeLengths('FASCIA')},
      hangers:{total:hangers,sets:Math.ceil(hangers*waste),tyRenBars:rodPlan?Math.ceil(rodPlan.count*waste):null,installedLength:length,stock:rodStock,plan:rodPlan,details:{tyRenMeters:length===null?null:(hangers*length).toFixed(3),noDan:Math.ceil(hangers*waste),ecuLongDen:Math.ceil(hangers*2*waste),mocTreoXuong:Math.ceil(hangers*waste)}},
      panels:{groups:panelGroups,totalLen:panelLen.toFixed(3)},accessories:{splicer:Math.ceil(splices*waste)}};
  }

  getRodLength() {
    const mode=document.getElementById('cfg_rodMode')?.value||'DIRECT';
    if(mode==='DIRECT') {const v=Number(document.getElementById('cfg_hangerL')?.value);return Number.isFinite(v)&&v>0?v:null;}
    const rawA=document.getElementById('cfg_anchorZ')?.value,rawC=document.getElementById('cfg_ceilingZ')?.value;
    if(!rawA?.trim()||!rawC?.trim())return null;
    const n=(Number(rawA)-Number(rawC)+Number(document.getElementById('cfg_rodAdjust')?.value||0))/1000;
    return Number.isFinite(n)&&n>0?n:null;
  }

  showBOQ() {
    if(!this.state.strips.length)return this.showFeedback('Chưa có vùng trần để tính','error');
    this.calculate();const m=this.calculateBOQData();
    const rows=this.boqRows(m,document.getElementById('projectName')?.value||'Phòng hiện tại');
    document.getElementById('boqContent').innerHTML='<p>Phương pháp: '+escapeHTML(m.mode)+' · Diện tích vùng: '+m.totalArea+' m² · Mặt nhôm: '+m.panelFaceArea.toFixed(3)+' m²</p>'+m.warnings.map(w=>'<p class="text-red">'+escapeHTML(w)+'</p>').join('')+'<table class="qs-table">'+rows.map((r,i)=>'<tr>'+r.map(c=>'<'+(i?'td':'th')+'>'+escapeHTML(c)+'</'+(i?'td':'th')+'>').join('')+'</tr>').join('')+'</table>';
    document.getElementById('boqModal').classList.remove('hidden');
  }

  boqRows(m,zone) {
    const rows=[['Khu vực','Vật tư','Loại khối lượng','Chiều dài (mm)','Số lượng','ĐVT','Tổng dài (m)','Chế độ']];
    const add=(name,kind,len,qty,unit,total='')=>rows.push([zone,name,kind,len,qty,unit,total,m.mode]);
    for(const [len,item] of Object.entries(m.panels.groups))add('Thanh '+m.presetName,'Đoạn lắp',Math.round(Number(len)*1000),item.qty,'Thanh',(Number(len)*item.qty).toFixed(3));
    add('Xương','Mét lắp','',m.carriers.totalLen,'m',m.carriers.totalLen);
    add('Xương','Cây mua',m.carriers.stock*1000,m.carriers.bars,'Cây',(m.carriers.bars*m.carriers.stock).toFixed(3));
    add('Nối xương','Mua','',m.carriers.couplers,'Cái');
    add('Ty treo','Điểm lắp',m.hangers.installedLength===null?'Chưa đủ cao độ':Math.round(m.hangers.installedLength*1000),m.hangers.total,'Ty',m.hangers.details.tyRenMeters??'Chưa đủ dữ liệu');
    add('Ty ren','Cây mua',m.hangers.stock*1000,m.hangers.tyRenBars??'Chưa đủ dữ liệu','Cây',m.hangers.tyRenBars===null?'':(m.hangers.tyRenBars*m.hangers.stock).toFixed(3));
    add('Nở đạn','Mua','',m.hangers.details.noDan,'Cái');add('Móc treo','Mua','',m.hangers.details.mocTreoXuong,'Cái');add('Ecu/long đen','Mua','',m.hangers.details.ecuLongDen,'Bộ');
    add('V-góc','Mét lắp','',m.trims.totalLen,'m',m.trims.totalLen);add('V-góc','Cây mua',3000,m.trims.bars,'Cây',(m.trims.bars*3).toFixed(3));
    add('Shadow','Mét lắp','',m.shadowTrims.totalLen,'m',m.shadowTrims.totalLen);add('Shadow','Cây mua',3000,m.shadowTrims.bars,'Cây',(m.shadowTrims.bars*3).toFixed(3));
    m.fascia.segments.forEach(l=>add('Mặt dựng','Đoạn lắp',Math.round(l*1000),1,'Thanh',l.toFixed(3)));
    add('Nối tấm','Mua','',m.accessories.splicer,'Cái');
    m.warnings.forEach(w=>add('CẢNH BÁO: '+w,'Cần kiểm tra','','',''));
    return rows;
  }

  downloadFile(name,text,type='application/json') {
    const blob=new Blob([text],{type});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }

  showProjectBOQ() {
    const rows=this.projectRows();document.getElementById('boqContent').innerHTML='<p>Chi tiết dự án — lượng mua tính riêng từng phòng, không gộp cắt giữa phòng.</p><table class="qs-table">'+rows.map((r,i)=>'<tr>'+r.map(c=>'<'+(i?'td':'th')+'>'+escapeHTML(c)+'</'+(i?'td':'th')+'>').join('')+'</tr>').join('')+'</table>';document.getElementById('boqModal').classList.remove('hidden');
  }

  projectRows() {
    let rows=[];
    for(const z of this.state.projectZones){const m=z.stats?.accessories;if(m?.schemaVersion===1){const r=this.boqRows(m,z.name);rows.push(...(rows.length?r.slice(1):r));}else rows.push([z.name,'Kết quả phiên bản cũ: mở và tính lại trước khi xuất']);}
    return rows.length?rows:[['Chưa có phòng đã lưu']];
  }

  exportCSV() {
    if(!this.state.strips.length)return this.showFeedback('Chưa có kết quả','error');
    this.calculate();const m=this.calculateBOQData();this.downloadFile('QS_'+m.mode+'.csv',csvText(this.boqRows(m,document.getElementById('projectName')?.value||'Phòng hiện tại')),'text/csv;charset=utf-8');
  }

  exportProjectCSV() {
    if(!this.state.projectZones.length)return this.showFeedback('Chưa có phòng đã lưu','error');
    this.downloadFile('QS_DuAn.csv',csvText(this.projectRows()),'text/csv;charset=utf-8');
  }

  captureState() {
    const inputs={};document.querySelectorAll('input[id],select[id]').forEach(el=>{if(/^(cfg_|dim_|shp_|l_orient$|u_orient$)/.test(el.id))inputs[el.id]=el.value;});
    return {schemaVersion:2,ts:Date.now(),inputMode:this.state.inputMode,inputs,points:structuredClone(this.state.points),edgeTypes:this.state.edges.map(e=>e.type),presetName:this.currentPreset?.name||'Tùy chỉnh',presetColor:this.currentPreset?.color||'#E3F2FD',manualJointsMap:structuredClone(this.state.manualJointsMap||{}),jointConfig:structuredClone(this.state.jointConfig)};
  }

  restoreState(data) {
    if(!data)return;
    this.state.inputMode=data.inputMode||'FREE';
    for(const [k,v] of Object.entries(data.inputs||{})){const el=document.getElementById(k);if(el&&/^(cfg_|dim_|shp_|l_orient$|u_orient$)/.test(k))el.value=v;}
    this.state.jointConfig=structuredClone(data.jointConfig||{pattern:data.inputs?.cfg_joint_pattern||'DEFAULT',patternShift:Number(data.inputs?.cfg_joint_shift||50)/100});
    this.state.manualJointsMap=structuredClone(data.manualJointsMap||{});
    this.currentPreset={name:data.presetName||'Tùy chỉnh',color:data.presetColor||'#E3F2FD'};
    // Preserve saved geometry, rather than regenerate U/L with missing legacy controls.
    this.state.points=structuredClone(data.points||[]);this.state.mode='IDLE';this.syncEdges();this.state.edges.forEach((e,i)=>e.type=data.edgeTypes?.[i]||'WALL_V');
    for(const [id,visible] of [['ui_preset',this.state.inputMode==='PRESET'],['ui_free',this.state.inputMode==='FREE']])document.getElementById(id)?.classList.toggle('hidden',!visible);
    this.calculate();this.centerView();this.draw();this.updateAddButtonUI();
  }

  addToProject() {
    if(this.state.points.length<3)return this.showFeedback('Chưa có vùng kín để lưu','error');
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
    const calcMode = document.getElementById("cfg_calcMode")?.value || "EXACT";

    // Khởi tạo các biến lưu trữ Final
    let finalPanels = panels;
    let finalFascia = fascia;
    let finalCarrierSegments = carrierSegments;
    let finalTotalLinear = totalLinear;
    let finalCarrierLen = carrierLen;
    let finalWallV = wallV;
    let finalShadow = shadow;
    let finalHangers = hangers;

    // Ghi đè bằng dữ liệu nếu là chế độ định mức
    if (calcMode === "NORM") {
      finalTotalLinear = Number(metrics.panels.totalLen) || 0;
      finalCarrierLen = Number(metrics.carriers.totalLen) || 0;
      finalWallV = Number(metrics.trims.totalLen) || 0;
      finalShadow = Number(metrics.shadowTrims.totalLen) || 0;
      finalHangers = Number(metrics.hangers.total) || 0;

      finalPanels = [finalTotalLinear]; // gom thành 1 thanh dài
      finalFascia = [Number(metrics.fascia.totalLen) || 0];
      finalCarrierSegments = [finalCarrierLen];
    }

    const stats = {
      panels: finalPanels, // [PANELS] Mảng chiều dài tấm
      fascia: finalFascia, // [FASCIA] Mảng chiều dài fascia
      carrierSegments: finalCarrierSegments, // [NEW] Mảng chiều dài xương (cho tối ưu cắt)
      totalLinear: finalTotalLinear, // [TỔNG] Tổng chiều dài tấm
      carrierLen: finalCarrierLen, // [KẾTCẤU] Tổng chiều dài xương
      wallV: finalWallV, // [VIỀN] V-Góc
      shadow: finalShadow, // [VIỀN] Shadow
      hangers: finalHangers, // [KẾTCẤU] Số ty
      brackets, // [KẾTCẤU] Số brae
      isFacade, // [FLAG] Có fascia không
      calcMode, // [CHẾ ĐỘ] Ghi lại phương pháp
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

    const wasEditing=this.state.editingIndex!==null;
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
      wasEditing ? "Đã cập nhật khu vực" : "Đã thêm khu vực",
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

  // ============ NEW: JOINT ADJUSTMENT LOGIC ============

  // 1. Cập nhật cấu hình Pattern từ UI
  updateJointConfig() {
    const pattern = document.getElementById("cfg_joint_pattern").value;
    const shift =
      parseFloat(document.getElementById("cfg_joint_shift").value) / 100;

    // Update state
    this.state.jointConfig.pattern = pattern;
    this.state.jointConfig.patternShift = isNaN(shift) ? 0.5 : shift;

    // UI Control: Show/Hide Shift input for Brick mode
    const brickRow = document.getElementById("row_brick_shift");
    if (brickRow) {
      brickRow.classList.toggle("hidden",pattern!=="BRICK");
    }

    this.calculate();
  }

  // --- JOINT DRAGGING & SNAPPING LOGIC ---

  // A. Start Drag (Called from onMouseDown)






  toggleJointEditMode() {
    // Toggle
    this.state.isJointEditing = !this.state.isJointEditing;

    const btn = document.getElementById("btn_toggle_joint_edit");
    const hint = document.getElementById("hint_joint_edit");

    if (this.state.isJointEditing) {
      btn.classList.add("btn-active"); // Style active
      btn.innerHTML = `<i data-lucide="scissors" class="icon-xs"></i> Đang chỉnh nối... (Click để thoát)`;
      if (hint) hint.classList.remove("hidden");
      this.showFeedback("Chế độ chỉnh điểm nối: BẬT", "info");
    } else {
      btn.classList.remove("btn-active");
      btn.innerHTML = `<i data-lucide="scissors" class="icon-xs"></i> Chỉnh điểm nối (Manual)`;
      if (hint) hint.classList.add("hidden");
      this.showFeedback("Chế độ chỉnh điểm nối: TẮT", "info");
    }

    this.draw(); // Redraw UI hints
  }

  // 3. Xóa tất cả điểm nối thủ công
  clearManualJoints() {
    const hasJoints =
      this.state.manualJointsMap &&
      Object.keys(this.state.manualJointsMap).some(
        (k) => this.state.manualJointsMap[k].length > 0,
      );
    if (!hasJoints) {
      this.showFeedback("Chưa có điểm nối thủ công nào để xóa!", "warning");
      return;
    }
    if (confirm("Bạn có chắc chắn muốn xóa TẤT CẢ điểm nối thủ công đã vẽ?")) {
      this.state.manualJointsMap = {};
      this.calculate();
      this.showFeedback("Đã xóa toàn bộ điểm nối thủ công", "success");
    }
  }

  // 3. Xử lý Click thêm/xóa khớp nối (được gọi từ onDown)


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
            <div style="font-weight:600; font-size:13px">${escapeHTML(z.name || "Zone " + (i + 1))}</div>
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
      version: "18.0",
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
    let data = loadFromStorage(this.STORAGE_KEY);
    if(data){try{validateProject(data);}catch(e){this.showFeedback("Dữ liệu cũ cần kiểm tra: "+e.message,"error");return;}}
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
      version: "18.0",
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
    this.state.manualJointsMap = {};
    this.state.jointConfig = {pattern:"DEFAULT",patternShift:0.5};

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
        const data = validateProject(JSON.parse(e.target.result));

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
  // =========================================================
  // [NEW] AutoCAD FEATURE IMPLEMENTATION
  // =========================================================

  setupCADListeners() {
    // 1. Command Bar Input
    const cmdInput = document.getElementById("cmd-input");
    if (cmdInput) {
      console.log("[AutoCAD] Command Input FOUND, attaching listeners.");
      cmdInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          console.log("[AutoCAD] Command Enter:", cmdInput.value);
          this.handleCommand(cmdInput.value);
          cmdInput.value = ""; // Clear
        }
      });
    } else {
      console.error("[AutoCAD] Command Input NOT FOUND in DOM!");
    }

    // 2. Global Hotkeys (F8, Esc)
    window.addEventListener("keydown", (e) => {
      // Ortho Toggle (F8)
      if (e.key === "F8") {
        this.state.CMD.isOrtho = !this.state.CMD.isOrtho;
        this.showFeedback(
          `Ortho: ${this.state.CMD.isOrtho ? "ON" : "OFF"}`,
          "info",
        );
        this.draw();
      }
      // Cancel (Esc)
      if (e.key === "Escape") {
        if (this.state.mode === "DRAW") {
          this.finishDraw();
          this.showFeedback("Drawing Finished", "success");
        } else {
          this.state.CMD.activeCmd = null;
          this.showFeedback("Command Cancelled", "warning");
        }
        if (cmdInput) cmdInput.blur(); // Unfocus
      }
      // Quick Focus Command Bar (Space / Enter if not in input)
      if (
        (e.key === " " || e.key === "Enter") &&
        document.activeElement !== cmdInput
      ) {
        // Only focus if idle or drawing
        if (this.state.mode === "DRAW" || this.state.mode === "IDLE") {
          if (cmdInput) {
            cmdInput.focus();
            e.preventDefault();
          }
        }
      }
    });
  }

  // CORE: Command Processor
  handleCommand(inputStr) {
    if (!inputStr) return;
    if (this.state.inputMode !== "FREE") return; // Block commands if not in Free Draw logic

    // [HISTORY] Add to history (UI update logic here if needed)
    this.state.CMD.history.push(inputStr);

    const parsed = CAD_UTILS.parseInput(inputStr);
    if(!parsed)return this.showFeedback("Cú pháp tọa độ không hợp lệ","error");
    const lastPt =
      this.state.points.length > 0
        ? this.state.points[this.state.points.length - 1]
        : { x: 0, y: 0 };

    // --- A. COMMANDS ---
    if (parsed.type === "CMD") {
      switch (parsed.val) {
        case "L":
        case "LINE":
          this.resetDraw();
          this.showFeedback("Line Tool Active", "info");
          break;
        case "C":
        case "CLOSE":
          if (this.state.mode === "DRAW") this.finishDraw();
          break;
        case "U":
        case "UNDO":
          if (this.state.points.length > 0) {
            this.state.points.pop();
            this.draw();
          }
          break;
        case "Z":
        case "ZOOM":
          this.centerView();
          this.showFeedback("Zoom Extents", "success");
          break;
        case "O":
        case "OFFSET":
          // Simple toggle offset mode visualization (implementation complex, alert for now)
          alert(
            "Offset Command: Chọn cạnh để offset (Tính năng đang phát triển)",
          );
          break;
        case "M":
        case "MOVE":
          alert(
            "Move Command: Chọn điểm để di chuyển (Tính năng đang phát triển)",
          );
          break;
        case "REC":
          this.resetDraw();
          this.showFeedback("Rectangle Tool (Vẽ 4 điểm)", "info");
          break;
        default:
          this.showFeedback(`Unknown command: ${parsed.val}`, "error");
      }
      return;
    }

    // --- B. COORDINATE ENTRY (DRAW MODE ONLY) ---
    if (this.state.mode === "DRAW") {
      let newPt = null;

      // 1. Absolute Coord (x,y)
      if (parsed.type === "ABS_COORD") {
        newPt = { x: parsed.x, y: parsed.y };
      }
      // 2. Relative Coord (@x,y)
      else if (parsed.type === "REL_COORD") {
        newPt = { x: lastPt.x + parsed.x, y: lastPt.y + parsed.y };
      }
      // 3. Polar (@dist<ang)
      else if (parsed.type === "POLAR") {
        newPt = CAD_UTILS.calcDest(lastPt, parsed.dist, parsed.angle);
      }
      // 4. Direct Distance (Number)
      else if (parsed.type === "DIST") {
        // Calculate direction from LAST POINT to CURRENT MOUSE
        // Vector = Mouse - Last
        const dx = this.state.CMD.cursorPos.x - lastPt.x;
        const dy = this.state.CMD.cursorPos.y - lastPt.y;
        const currentAng = Math.atan2(dy, dx);

        // Apply Ortho Snapping for Direct Distance too
        let angle = currentAng;
        if (this.state.CMD.isOrtho) {
          // Snap angle to nearest 90 deg
          angle = Math.round(currentAng / (Math.PI / 2)) * (Math.PI / 2);
        }

        newPt = {
          x: lastPt.x + parsed.val * Math.cos(angle),
          y: lastPt.y + parsed.val * Math.sin(angle),
        };
      }

      if (newPt) {
        this.state.points.push(newPt);
        this.draw();
        this.showFeedback(
          `Point added at (${newPt.x.toFixed(2)}, ${newPt.y.toFixed(2)})`,
          "success",
        );
      }
    }
  }

  // [MODIFIED] Helper to draw UI overlay (Ghost lines, Tooltips)
  drawCADOverlay() {
    const ctx = this.ctx;
    const t = this.state.CMD;
    const lastPt =
      this.state.points.length > 0
        ? this.state.points[this.state.points.length - 1]
        : null;

    if (this.state.mode === "DRAW") {
      const mouse = t.cursorPos;

      // ALWAYS Show Tooltip if in DRAW mode
      const tooltip = document.getElementById("cursor-tooltip");
      if (tooltip) {
        tooltip.classList.remove("hidden");
        // Safe check for mouse before toScreen
        if (mouse) {
          const screenPos = this.toScreen(mouse);

          // Offset tooltip 15px from cursor
          tooltip.style.left = screenPos.x + 15 + "px";
          tooltip.style.top = screenPos.y + 15 + "px";

          if (lastPt) {
            // We have a start point -> Show Dist/Angle
            let target = { ...mouse };
            // ORTHO Logic
            if (t.isOrtho) {
              const dx = Math.abs(mouse.x - lastPt.x);
              const dy = Math.abs(mouse.y - lastPt.y);
              if (dx > dy) target.y = lastPt.y;
              else target.x = lastPt.x;
            }

            // Draw Ghost Line
            const s1 = this.toScreen(lastPt);
            const s2 = this.toScreen(target); // Recalculate screen pos for ortho target

            ctx.beginPath();
            ctx.setLineDash([5, 5]);
            ctx.strokeStyle = "#0f62fe";
            ctx.lineWidth = 1;
            ctx.moveTo(s1.x, s1.y);
            ctx.lineTo(s2.x, s2.y);
            ctx.stroke();
            ctx.setLineDash([]);

            // Distance & Angle
            const dist = Math.sqrt(
              Math.pow(target.x - lastPt.x, 2) +
                Math.pow(target.y - lastPt.y, 2),
            );
            const angle = (
              (Math.atan2(target.y - lastPt.y, target.x - lastPt.x) * 180) /
              Math.PI
            ).toFixed(1);

            tooltip.innerHTML = `X: ${target.x.toFixed(2)}, Y: ${target.y.toFixed(2)}<br>
                                    <span style="color:#4caf50">L: ${dist.toFixed(2)}m</span> <span style="color:#ffcc00">A: ${angle}°</span>
                                    ${t.isOrtho ? "<br>[ORTHO]" : ""}`;
          } else {
            // No points yet -> "Specify first point"
            tooltip.innerHTML = `Specify first point<br>X: ${mouse.x.toFixed(2)}, Y: ${mouse.y.toFixed(2)}`;
          }
        }
      }
    } else {
      // Hide tooltip if not drawing
      const tooltip = document.getElementById("cursor-tooltip");
      if (tooltip) tooltip.classList.add("hidden");
    }
  }

  // --- [NEW] JOINT DRAG & SNAP HANDLERS ---

  // 1. Helper: Find Strip under Mouse
  getStripFromPos(m) {
    if (!this.state.strips || this.state.strips.length === 0) return null;
    const hitW = (this.state.strips[0].width || 0.1) / 2; // Half Width

    for (let s of this.state.strips) {
      if (s.isVert) {
        // Strip Vertical: pos is X center, range Y [start, end]
        // Hit X: |m.x - (s.pos + hitW)| < hitW
        // Hit Y: m.y >= s.start && m.y <= s.end
        const centerX = s.pos + hitW;
        if (Math.abs(m.x - centerX) < hitW && m.y >= s.start && m.y <= s.end) {
          return { strip: s, key: s.key || s.pos.toFixed(3), isVert: true, centerX };
        }
      } else {
        // Strip Horizontal
        const centerY = s.pos + hitW;
        if (Math.abs(m.y - centerY) < hitW && m.x >= s.start && m.x <= s.end) {
          return { strip: s, key: s.key || s.pos.toFixed(3), isVert: false, centerY };
        }
      }
    }
    return null;
  }

  // 2. Handle Mouse Down on Joint (Start Drag)
  handleJointDown(e) {
    if (!this.state.isJointEditing) return false;
    const m = this.getMouse(e);
    const HIT_DIST = 0.2; // 20cm hit radius for joint

    // Iterate all strips locally to find if we hit a joint
    // Note: We use manualJointsMap directly because strips might be re-calculated
    // but finding which strip is hit first is optimized
    const hitStrip = this.getStripFromPos(m);
    if (!hitStrip) return false;

    // Check joints on this strip
    // Explicit manual joints from Map
    const manualJoints = this.state.manualJointsMap[hitStrip.key] || [];

    // Find hit joint
    let hitIndex = -1;
    let hitVal = -1;

    for (let i = 0; i < manualJoints.length; i++) {
      const jVal = manualJoints[i]; // Distance from start relative to strip
      // Abs Position of Joint:
      let jAbsX, jAbsY;
      if (hitStrip.isVert) {
        jAbsX = hitStrip.centerX;
        jAbsY = hitStrip.strip.start + jVal;
      } else {
        jAbsX = hitStrip.strip.start + jVal;
        jAbsY = hitStrip.centerY;
      }

      // Distance Check
      const dist = Math.sqrt(
        Math.pow(m.x - jAbsX, 2) + Math.pow(m.y - jAbsY, 2),
      );

      if (dist < HIT_DIST) {
        hitIndex = i;
        hitVal = jVal;
        break;
      }
    }

    if (hitIndex !== -1) {
      // START DRAG
      this.state.dragJoint = {
        stripKey: hitStrip.key,
        val: hitVal,
        startVal: hitVal,
        isVert: hitStrip.isVert,
        stripStart: hitStrip.strip.start,
        hasMoved: false,
      };

      // Remove from Map temporarily (so it becomes "Ghost" tracked by dragJoint)
      const newJoints = [...manualJoints];
      newJoints.splice(hitIndex, 1);
      this.state.manualJointsMap[hitStrip.key] = newJoints;

      this.state.isDrag = false; // Disable Pan
      // Trigger calc to remove the static joint (replaced by ghost in next draw)
      this.calculate();
      return true;
    }

    return false;
  }

  // 3. Handle Drag Move
  handleJointDrag(e) {
    if (!this.state.dragJoint) return false;

    const m = this.getMouse(e);
    const dj = this.state.dragJoint;

    // Calculate new relative value
    let newVal;
    if (dj.isVert) {
      newVal = m.y - dj.stripStart;
    } else {
      newVal = m.x - dj.stripStart;
    }

    // Clamp (Optional: Keep within strip bounds?)
    // if (newVal < 0) newVal = 0; // Maybe allow slightly outside?

    // SNAP LOGIC
    this.state.snapLine = null;
    const SNAP_DIST = 0.2; // 20cm snap

    // Find nearest wall corner projected to this strip axis
    let bestSnap = null;
    let minDiff = Infinity;

    // Use state.points (Wall Corners)
    this.state.points.forEach((p) => {
      // Project P onto Strip Axis
      // If Strip is Vert, we care about P.y
      // If Strip is Horz, we care about P.x

      let projVal, diff;
      if (dj.isVert) {
        projVal = p.y - dj.stripStart; // Relative pos on strip
        diff = Math.abs(newVal - projVal);
      } else {
        projVal = p.x - dj.stripStart;
        diff = Math.abs(newVal - projVal);
      }

      if (diff < SNAP_DIST && diff < minDiff) {
        minDiff = diff;
        bestSnap = {
          val: projVal, // The relative value to set
          absVal: dj.stripStart + projVal, // Absolute pos for visual
          type: dj.isVert ? "HOZS" : "VERT", // Snap Line Direction (Perpendicular to strip)
          // Coordinate for marker
          x: dj.isVert ? m.x : dj.stripStart + projVal,
          y: dj.isVert ? dj.stripStart + projVal : m.y,
        };
      }
    });

    if (bestSnap) {
      newVal = bestSnap.val;
      this.state.snapLine = {
        val: bestSnap.absVal, // Absolute coord for line
        type: dj.isVert ? "HOZS" : "VERT", // Line orientation
        x: bestSnap.x,
        y: bestSnap.y,
      };
    }

    // Update Drag State
    // Only update if changed > 1mm to avoid excessive recalcs
    if (Math.abs(newVal - dj.val) > 0.001) {
      dj.hasMoved = true;
      dj.val = newVal;
      this.calculate(); // Re-calc strips with new joint pos
    }

    return true;
  }

  // 4. Handle Mouse Up (End Drag)
  handleJointUp() {
    if (this.state.dragJoint) {
      const dj = this.state.dragJoint;

      // Retrieve current list
      let currentJoints = this.state.manualJointsMap[dj.stripKey] || [];

      // Logic: If NOT moved significantly -> Treat as Click -> DELETE
      // Wait! Using "hasMoved" might be too sensitive if user just clicks.
      // If delete is desired, user should click without moving.

      if (!dj.hasMoved) {
        // DELETE ACTION
        this.showFeedback("Đã xóa mối nối", "info");
      } else {
        // COMMIT ACTION
        // Add back to map
        if (dj.val > 0) {
          // Only keep if valid
          currentJoints.push(dj.val);
          this.state.manualJointsMap[dj.stripKey] = currentJoints;
        }
      }

      // Cleanup
      this.state.dragJoint = null;
      this.state.snapLine = null;
      this.calculate();
      return true;
    }
    return false;
  }

  // 5. Handle Click (Add Joint)
  handleJointClick(m) {
    if (!this.state.isJointEditing) return false;
    // Only called if NOT dragging
    const hit = this.getStripFromPos(m);
    if (!hit) return false;

    // Add new joint at click pos
    let val;
    if (hit.isVert) val = m.y - hit.strip.start;
    else val = m.x - hit.strip.start;

    if (val <= 0 || val >= hit.strip.totalLen) return false;

    // Add to Map
    let joints = this.state.manualJointsMap[hit.key] || [];
    joints.push(val);
    this.state.manualJointsMap[hit.key] = joints;

    this.calculate();
    this.showFeedback("Đã thêm mối nối", "success");
    return true;
  }
  exportProfile() {
    this.downloadFile('QS_ThietLap.json',JSON.stringify({kind:'QS_PROFILE',version:1,inputs:this.captureState().inputs,presets:this.userPresets},null,2));
  }

  loadProfile(event) {
    const file=event.target.files?.[0];if(!file)return;
    if(file.size>2000000){this.showFeedback('File mẫu quá lớn','error');return;}
    const reader=new FileReader();reader.onload=()=>{try{const p=JSON.parse(reader.result);if(p.kind!=='QS_PROFILE'||p.version!==1)throw Error('Sai định dạng mẫu');
      validateProject({version:'18.0',projectZones:[],presets:p.presets,currentWork:{points:[],inputs:p.inputs}});
      const snapshot=this.captureState();snapshot.inputs={...snapshot.inputs,...p.inputs};snapshot.jointConfig={pattern:p.inputs.cfg_joint_pattern||'DEFAULT',patternShift:Number(p.inputs.cfg_joint_shift||50)/100};this.userPresets=p.presets;this.updatePresetDropdown();this.restoreState(snapshot);saveToStorage('USER_PRESETS',this.userPresets);this.saveState();this.showFeedback('Đã tải thiết lập','success');
    }catch(e){this.showFeedback(e.message,'error');}finally{event.target.value='';}};reader.readAsText(file);
  }

  cutRows(metrics,zone) {
    const rows=[['Khu vực','Vật tư','Cây số','Stock (mm)','Các đoạn (mm)','Kerf (mm)','Dư (mm)']];
    for(const [name,plan] of [['Xương',metrics.carriers.plan],['Ty ren',metrics.hangers.plan]])if(plan)plan.bars.forEach((b,i)=>rows.push([zone,name,i+1,plan.stock*1000,b.cuts.map(l=>Math.round(l*1000)).join(' + '),Math.round(b.kerf*1000),Math.round(b.remaining*1000)]));
    return rows;
  }

  exportWorkbook(project=false) {
    let rows=[],cuts=[];
    const add=(m,name)=>{const r=this.boqRows(m,name),c=this.cutRows(m,name);rows.push(...(rows.length?r.slice(1):r));cuts.push(...(cuts.length?c.slice(1):c));};
    if(project){for(const z of this.state.projectZones){if(z.stats?.accessories?.schemaVersion!==1)return this.showFeedback('Có phòng phiên bản cũ: mở và tính lại trước','error');add(z.stats.accessories,z.name);}}
    else {this.calculate();add(this.calculateBOQData(),document.getElementById('projectName')?.value||'Phòng hiện tại');}
    if(!rows.length)return this.showFeedback('Chưa có kết quả','error');
    const summary=this.purchaseSummary(rows);
    this.downloadFile(project?'QS_DuAn.xlsx':'QS_Phong.xlsx',xlsxBytes([{name:'Chi tiet vung',rows},{name:'Tong hop mua',rows:summary},{name:'Cat cay net',rows:cuts},{name:'Ghi chu',rows:[['Nội dung'],['Cắt cây net chưa gồm cây dự phòng. Bảng mua đã áp hao hụt dự phòng.'],['Phạm vi tái dùng dư: trong từng phòng; chưa gộp cắt giữa phòng.'],['Phiên bản 18 — dữ liệu preset cần đối chiếu catalogue trước đặt hàng.']]}]),'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  }

  purchaseSummary(rows) {
    const grouped=new Map();
    for(const r of rows.slice(1))if(['Cây mua','Mua'].includes(r[2])){const key=JSON.stringify([r[1],r[3],r[5],r[7]]);if(!Number.isFinite(Number(r[4])))continue;const g=grouped.get(key)||[r[1],r[3],0,r[5],0,r[7]];g[2]+=Number(r[4]);g[4]+=Number(r[6])||0;grouped.set(key,g);}
    return [['Vật tư','Stock (mm)','SL mua','ĐVT','Tổng dài stock (m)','Chế độ'],...grouped.values()];
  }

  exportDXF() {
    this.calculate();if(!this.state.strips.length)return this.showFeedback('Chưa có vùng','error');this.downloadFile('QS_BoTri.dxf',layoutDXF(this.state),'application/dxf');
  }

}

