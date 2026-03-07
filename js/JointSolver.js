// [FILE] js/JointSolver.js
// [CÔNG DỤNG] Xử lý thuật toán chia tấm (Joint/Splicing Logic)
// [PHẠM VI] Tính toán vị trí điểm nối dựa trên: Khổ nhôm MaxL, Điểm ghim (Manual), và Quy luật (Pattern)

export class JointSolver {
  constructor() {
    this.DEFAULT_MAX_L = 6.0;
  }

  /**
   * Tính toán các mảnh cắt cho 1 dãy (Strip)
   * @param {number} totalLen - Tổng chiều dài dãy (m)
   * @param {number} maxL - Chiều dài nhôm tối đa (m)
   * @param {Object} config - Cấu hình { manualJoints: [], pattern: 'DEFAULT'|'GRID'|'BRICK'|'RANDOM', patternShift: 0.5, rowId: 0 }
   * @param {number} minCut - Chiều dài cắt tối thiểu (m)
   * @returns {Array} Mảng các mảnh { len: number, type: 'MANUAL'|'AUTO' }
   */
  solveStrip(totalLen, maxL, config, minCut = 0.2) {
    const {
      manualJoints = [],
      pattern = "DEFAULT",
      patternShift = 0.5,
      rowId = 0,
    } = config;

    // 1. Chèn các điểm nối thủ công (Manual Joints)
    // Sắp xếp và lọc các điểm nằm trong range (0, totalLen)
    let sortedJoints = [...manualJoints]
      .filter((j) => j > 0.001 && j < totalLen - 0.001)
      .sort((a, b) => a - b);

    // Tạo các "Segment Cứng" giữa các điểm mốc
    // VD: [0, ...manualJoints, totalLen] -> [Segment 1, Segment 2, ...]
    let points = [0, ...sortedJoints, totalLen];
    let segments = [];

    for (let i = 0; i < points.length - 1; i++) {
      segments.push({
        start: points[i],
        end: points[i + 1],
        len: points[i + 1] - points[i],
        isFixed: true, // Segment này bị chặn bởi điểm Manual (hoặc đầu/cuối)
      });
    }

    // 2. Xử lý từng Segment Cứng (Chia nhỏ nếu > MaxL hoặc theo Pattern)
    let finalPieces = [];

    segments.forEach((seg, idx) => {
      // Nếu đây là Segment đầu tiên VÀ không có Manual Joint nào chặn trước nó
      // (Tức là từ 0 đến Manual Joint đầu tiên, hoặc 0 đến hết nếu ko có Manual Joint)
      // Thì mới áp dụng Pattern. Các segment giữa 2 Manual Joint chỉ chia theo MaxL.
      let applyPattern = idx === 0;

      let subPieces = this.subdivideSegment(
        seg.len,
        maxL,
        applyPattern ? pattern : "DEFAULT",
        rowId,
        patternShift,
        minCut,
      );

      finalPieces.push(...subPieces);
    });

    return finalPieces;
  }

  subdivideSegment(len, maxL, pattern, rowId, shift, minCut) {
    // Giữ nguyên (gộp) nếu chiều dài nhỏ hơn hoặc bằng maxL
    if (len <= maxL) return [len];

    let pieces = [];

    // Thuật toán: Chia cân bằng (Cắt 2 đầu, giữ nguyên các tấm giữa)
    if (pattern === "BALANCED") {
      let numFull = Math.max(0, Math.floor(len / maxL) - 1);
      let endPiece = (len - numFull * maxL) / 2;
      pieces.push(endPiece);
      for (let i = 0; i < numFull; i++) pieces.push(maxL);
      pieces.push(endPiece);
      return pieces;
    }

    let remain = len;
    let isOddRow = rowId % 2 !== 0;

    // Thuật toán: Xếp gạch
    if (pattern === "BRICK" && isOddRow) {
      let firstPieceMax = maxL * shift;
      if (remain <= firstPieceMax) {
        return [remain];
      } else {
        pieces.push(firstPieceMax);
        remain -= firstPieceMax;
      }
    }
    // Thuật toán: Ngẫu nhiên
    else if (pattern === "RANDOM") {
      let rnd = this.pseudoRandom(rowId);
      let first = minCut + rnd * (maxL - minCut);
      if (remain <= first) {
        return [remain];
      } else {
        pieces.push(first);
        remain -= first;
      }
    }

    // Mặc định: Điền các tấm maxL
    while (remain > maxL) {
      pieces.push(maxL);
      remain -= maxL;
    }

    // Xử lý mảnh vụn cuối cùng
    if (remain > 0) {
      if (remain < minCut && pieces.length > 0) {
        // Dồn mảnh vụn nhỏ vào tấm trước đó và chia đôi
        let last = pieces.pop();
        let total = last + remain;
        pieces.push(total / 2);
        pieces.push(total / 2);
      } else {
        pieces.push(remain);
      }
    }

    return pieces;
  }

  // Hàm random ổn định theo seed (rowId)
  pseudoRandom(seed) {
    let x = Math.sin(seed + 1234) * 10000;
    return x - Math.floor(x);
  }
}
