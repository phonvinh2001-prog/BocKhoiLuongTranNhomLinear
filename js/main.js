/* File: js/main.js */

// 1. Nhập khẩu các bộ phận từ kho (Modules)
import Engine from "./Engine.js";
import VisualOverlay from "./VisualOverlay.js";
import WorkspaceUI from "./WorkspaceUI.js";
import PlanController from './PlanController.js';
import CadController from "./CadController.js";

console.log("🏗️ System Init: Loading ALU-MASTER v17 Modules...");

// 2. Khởi tạo bộ máy tính toán (Core Engine)
// 2. Khởi tạo bộ máy tính toán (Core Engine)
let app;
try {
  app = new Engine();
} catch (error) {
  console.error("🔥 CRITICAL: Engine Initialization Failed!", error);
  alert(
    "Lỗi khởi động: " +
      error.message +
      "\nVui lòng checked console (F12) để biết chi tiết.",
  );
}

// 3. Khởi tạo công cụ giám sát (Extension)
if (app) {
  setTimeout(() => {
    // Render Icons
    if (window.lucide) {
      window.lucide.createIcons();
      console.log("🎨 UI Icons: Rendered.");
    }

    try {
      window.overlayExtension = new VisualOverlay(app);
      console.log("✅ Module Overlay: Ready.");
    } catch (e) {
      console.error("⚠️ Overlay Init Failed:", e);
    }

    // [DATA PERSISTENCE] Khôi phục dữ liệu cũ
    app.loadState();
    window.workspaceUI = new WorkspaceUI(app);
    app.cad = new CadController(app, window.workspaceUI);
    app.plan = new PlanController(app.cad);
    const loader = document.getElementById("app-loader");
    if (loader) loader.style.display = "none";
  }, 200);
}

// --- QUAN TRỌNG: GÁN VÀO WINDOW ---
if (app) {
  window.app = app;
}

