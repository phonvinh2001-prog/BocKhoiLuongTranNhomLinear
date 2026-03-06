export default class GeometryHelper {
  // [HELPER] Lấy giá trị input an toàn với validation
  static getInputValue(id, min = 0, max = Infinity, fallback = 0, showError = false) {
    const el = document.getElementById(id);
    if (!el) return fallback;

    let val = parseFloat(el.value);

    // NaN handling với UI feedback
    if (isNaN(val) || el.value.trim() === "") {
      if (showError) {
        el.classList.add("error");
        console.warn(`⚠️ Input "${id}" không hợp lệ, sử dụng mặc định ${fallback}`);
      }
      return fallback;
    }

    el.classList.remove("error", "warning");

    // Bounds checking
    if (val < min) {
      if (showError) {
        el.classList.add("warning");
        console.warn(`⚠️ Input "${id}" quá nhỏ (${val} < ${min}), sử dụng min ${min}`);
      }
      return min;
    }
    if (val > max) {
      if (showError) {
        el.classList.add("warning");
        console.warn(`⚠️ Input "${id}" quá lớn (${val} > ${max}), sử dụng max ${max}`);
      }
      return max;
    }

    return val;
  }

  // [HÌNH L] Sinh điểm tọa độ cho hình chữ L
  static generateLShape(L, W, Lc, Wc, lOrient) {
    switch (lOrient) {
      case "BOTTOM_RIGHT":
        return [
          { x: 0, y: 0 },
          { x: L, y: 0 },
          { x: L, y: W - Wc },
          { x: L - Lc, y: W - Wc },
          { x: L - Lc, y: W },
          { x: 0, y: W },
        ];
      case "BOTTOM_LEFT":
        return [
          { x: 0, y: 0 },
          { x: L, y: 0 },
          { x: L, y: W },
          { x: Lc, y: W },
          { x: Lc, y: W - Wc },
          { x: 0, y: W - Wc },
        ];
      case "TOP_RIGHT":
        return [
          { x: 0, y: 0 },
          { x: L - Lc, y: 0 },
          { x: L - Lc, y: Wc },
          { x: L, y: Wc },
          { x: L, y: W },
          { x: 0, y: W },
        ];
      case "TOP_LEFT":
        return [
          { x: Lc, y: 0 },
          { x: L, y: 0 },
          { x: L, y: W },
          { x: 0, y: W },
          { x: 0, y: Wc },
          { x: Lc, y: Wc },
        ];
      default:
        return [
          { x: 0, y: 0 },
          { x: L, y: 0 },
          { x: L, y: W - Wc },
          { x: L - Lc, y: W - Wc },
          { x: L - Lc, y: W },
          { x: 0, y: W },
        ];
    }
  }

  // [HÌNH U] Sinh điểm tọa độ cho hình chữ U
  static generateUShape(L, W, arm1, arm2, base, orient) {
    if (orient === "TOP") {
      return [
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
      return [
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
      return [
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
      return [
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
    return [];
  }
}
