/* 
[FILE: PreviewRenderer.js] - PREVIEW PANEL RENDERER
============================================================
Công dụng: Vẽ preview mini của mặt bằng trong sidebar
Hiển thị real-time khi người dùng thay đổi parameters
*/

export default class PreviewRenderer {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) {
      console.warn(`Preview canvas ${canvasId} not found`);
      return;
    }
    this.ctx = this.canvas.getContext("2d");
    this.padding = 20; // Padding xung quanh shape
  }

  renderShape(points, shapeType) {
    if (!this.canvas || !points || points.length === 0) return;

    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Clear canvas
    ctx.clearRect(0, 0, w, h);

    // Calculate bounds
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;
    points.forEach((p) => {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    });

    // Calculate scale to fit
    const rangeX = maxX - minX;
    const rangeY = maxY - minY;
    const scaleX = (w - this.padding * 2) / rangeX;
    const scaleY = (h - this.padding * 2) / rangeY;
    const scale = Math.min(scaleX, scaleY);

    // Center offset
    const offsetX = (w - rangeX * scale) / 2 - minX * scale;
    const offsetY = (h - rangeY * scale) / 2 - minY * scale;

    // Transform function
    const tx = (x) => x * scale + offsetX;
    const ty = (y) => y * scale + offsetY;

    // Draw grid background (optional)
    ctx.strokeStyle = "#f0f0f0";
    ctx.lineWidth = 0.5;
    for (let i = 0; i < w; i += 20) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, h);
      ctx.stroke();
    }
    for (let i = 0; i < h; i += 20) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(w, i);
      ctx.stroke();
    }

    // Draw shape
    ctx.beginPath();
    ctx.moveTo(tx(points[0].x), ty(points[0].y));
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(tx(points[i].x), ty(points[i].y));
    }
    ctx.closePath();

    // Fill
    ctx.fillStyle = "#E8F0FE";
    ctx.fill();

    // Stroke
    ctx.strokeStyle = "#0F62FE";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw dimension labels
    this.drawDimensions(points, tx, ty, shapeType);
  }

  drawDimensions(points, tx, ty, shapeType) {
    const ctx = this.ctx;
    ctx.font = "10px Arial";
    ctx.fillStyle = "#0F62FE";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Draw edge labels
    for (let i = 0; i < points.length; i++) {
      const p1 = points[i];
      const p2 = points[(i + 1) % points.length];

      const len = Math.sqrt(
        Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2),
      );

      // Only show labels for longer edges
      if (len > 0.5) {
        const mx = tx((p1.x + p2.x) / 2);
        const my = ty((p1.y + p2.y) / 2);

        // Background for readability
        const text = len.toFixed(1) + "m";
        const textWidth = ctx.measureText(text).width;
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.fillRect(mx - textWidth / 2 - 2, my - 6, textWidth + 4, 12);

        // Text
        ctx.fillStyle = "#0F62FE";
        ctx.fillText(text, mx, my);
      }
    }
  }

  updateStatus(message, type = "success") {
    const statusEl = document.getElementById("preview-status");
    if (!statusEl) return;

    // Remove all status classes
    statusEl.classList.remove("error", "warning");

    // Add new class
    if (type !== "success") {
      statusEl.classList.add(type);
    }

    // Update icon and text
    let icon = "check-circle";
    if (type === "error") icon = "x-circle";
    if (type === "warning") icon = "alert-circle";

    statusEl.innerHTML = `<i data-lucide="${icon}" class="icon-xs"></i> ${message}`;

    // Refresh lucide icons
    if (window.lucide) window.lucide.createIcons();
  }
}
