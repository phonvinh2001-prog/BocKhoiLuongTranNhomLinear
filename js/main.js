/* File: js/main.js */

// 1. Nhập khẩu các bộ phận từ kho (Modules)
import Engine from "./Engine.js";
import VisualOverlay from "./VisualOverlay.js";

console.log("🏗️ System Init: Loading ALU-MASTER v17 Modules...");

// 2. Khởi tạo bộ máy tính toán (Core Engine)
const app = new Engine();

// 3. Khởi tạo công cụ giám sát (Extension)
setTimeout(() => {
  // Render Icons
  if (window.lucide) {
    window.lucide.createIcons();
    console.log("🎨 UI Icons: Rendered.");
  }

  window.overlayExtension = new VisualOverlay(app);
  console.log("✅ Module Overlay: Ready.");

  // [DATA PERSISTENCE] Khôi phục dữ liệu cũ
  app.loadState();
}, 200);

// --- QUAN TRỌNG: GÁN VÀO WINDOW ---
window.app = app;
