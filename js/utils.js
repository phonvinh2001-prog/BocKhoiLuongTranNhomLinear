// ============ HÀM TIỆN ÍCH TOÁN HỌC (UTILITY FUNCTIONS) ============
// [FILE] js/utils.js
// [CÔNG DỤNG] Chứa các hàm toán học thuần túy (không sử dụng DOM hay Canvas)
// [PHẠM VI] Hình học, khoảng cách, vector, v.v...
//
// [THIẾT KẾ] Tách riêng logic toán học ra file utils để:
// - Dễ tái sử dụng trong các context khác nhau
// - Dễ kiểm thử (unit test) độc lập
// - Tránh lẫn lộn với logic UI/Canvas

// --- TÍNH KHOẢNG CÁCH TỪĐIỂM ĐẾN ĐOẠN THẲNG (DISTANCE POINT TO SEGMENT) ---
// [CÔNG DỤNG] Tính khoảng cách ngắn nhất từ điểm P đến đoạn thẳng VW
// [THI CÔNG] Dùng để detect xem user click có gần cạnh viền không (< 200mm)
// [TOÁN HỌC] Sử dụng phương pháp chiếu điểm lên đoạn thẳng (projection)
//
// [THAM SỐ]
//   p: Object điểm {x, y} (điểm cần tính khoảng cách - VD: vị trí chuột)
//   v: Object điểm {x, y} (điểm đầu đoạn thẳng)
//   w: Object điểm {x, y} (điểm cuối đoạn thẳng)
//
// [RETURN] Số thực (mét) = khoảng cách ngắn nhất từ p đến đoạn VW
//
// [VÍ DỤ]
// Đoạn viền từ A(0,0) đến B(10,0)
// Click tại C(5, 0.1) → khoảng cách ≈ 0.1m (gần viền)
// Click tại D(5, 0.25) → khoảng cách ≈ 0.25m (xa viền)
// → Nếu < 0.2m → tính là click trên viền, có thể chuyển đổi loại
//
// [THUẬT TOÁN]
// 1. Tính bình phương độ dài đoạn VW: l² = (W.x - V.x)² + (W.y - V.y)²
// 2. Nếu l² = 0 (V trùng W) → Return khoảng cách từ P đến V
// 3. Tính tham số chiếu: t = (P-V)·(W-V) / l²
// 4. Clamp t vào [0, 1]:
//    - Nếu t < 0 → chiếu ra ngoài, lấy V
//    - Nếu t > 1 → chiếu ra ngoài, lấy W
//    - 0 ≤ t ≤ 1 → chiếu vào đoạn VW
// 5. Tính điểm chiếu: Q = V + t*(W - V)
// 6. Return khoảng cách P → Q: √[(P.x - Q.x)² + (P.y - Q.y)²]
export function distToSeg(p, v, w) {
  // [BƯỚC 1] TÍNH BÌNH PHƯƠNG ĐỘ DÀI ĐOẠN
  // l² = (W.x - V.x)² + (W.y - V.y)²
  let l2 = Math.pow(v.x - w.x, 2) + Math.pow(v.y - w.y, 2);

  // [BƯỚC 2] KIỂM TRA TRƯỜNG HỢP ĐẶCBIỆT: V trùng W (đoạn suy biến thành điểm)
  if (l2 == 0) {
    // Nếu V = W → khoảng cách từ P đến V
    return Math.sqrt(Math.pow(p.x - v.x, 2) + Math.pow(p.y - v.y, 2));
  }

  // [BƯỚC 3] TÍNH THAM SỐ CHIẾU: t = (P-V)·(W-V) / l²
  // t ∈ [0,1] nếu chiếu vào đoạn VW
  // t < 0 nếu chiếu ngoài phía V
  // t > 1 nếu chiếu ngoài phía W
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;

  // [BƯỚC 4] CLAMP t VÀO [0, 1]
  // Đảm bảo chiếu vào đoạn VW (không ra ngoài 2 đầu)
  t = Math.max(0, Math.min(1, t));

  // [BƯỚC 5] TÍNH ĐIỂM CHIẾU + KHOẢNG CÁCH
  // Q = V + t*(W - V) = {V.x + t*(W.x - V.x), V.y + t*(W.y - V.y)}
  // distance = √[(P.x - Q.x)² + (P.y - Q.y)²]
  return Math.sqrt(
    Math.pow(p.x - (v.x + t * (w.x - v.x)), 2) +
      Math.pow(p.y - (v.y + t * (w.y - v.y)), 2),
  );
}

// --- GHI CHÚ TƯƠNG LAI ---
// [THÊMMỚI] Có thể thêm các hàm toán học khác ở đây sau này, VD:
// - intersectSegments(): Tính giao điểm 2 đoạn thẳng
// - areaPolygon(): Tính diện tích đa giác (shoelace formula)
// - sortPoints(): Sắp xếp điểm theo thứ tự ngược chiều kim đồng hồ
// --- STORAGE HELPERS (DATA PERSISTENCE) ---
// [CÔNG DỤNG] Lưu và tải dữ liệu từ LocalStorage an toàn
// [AN TOÀN] Có try-catch để tránh lỗi quota hoặc parse error

export function saveToStorage(key, data) {
  try {
    const json = JSON.stringify(data);
    localStorage.setItem(key, json);
    return true;
  } catch (e) {
    console.error(`❌ Lỗi lưu storage [${key}]:`, e);
    return false;
  }
}

export function loadFromStorage(key) {
  try {
    const json = localStorage.getItem(key);
    if (!json) return null;
    return JSON.parse(json);
  } catch (e) {
    console.error(`❌ Lỗi đọc storage [${key}]:`, e);
    return null;
  }
}
