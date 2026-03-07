# Audit Report - Joint Logic (Nối tấm)

## Summary

- 🔴 Critical Issues: 1
- 🟡 Warnings: 2
- 🟢 Suggestions: 1

## 🔴 Critical Issues (Phải sửa ngay)

1. Thuật toán BALANCED (Chia cân bằng) đang sai logic thi công thực tế
   - File: `js/JointSolver.js:98-102`
   - Nguy hiểm: Khi chiều dài trần lớn hơn 2 tấm (Ví dụ 13m), thuật toán hiện tại **chia đều TẤT CẢ các tấm** thành `13/3 = 4.33m`. Điều này bắt thợ phải cắt bỏ tất cả 3 tấm nhôm nguyên 6m, gây lãng phí vật tư cực lớn và tốn rất nhiều công cắt.
   - Cách sửa: Chỉ cắt 2 tấm ở hai đầu (bia) để cân bằng, còn các tấm ở giữa phải giữ nguyên độ dài tối đa (`MaxL = 6m`). Ví dụ 13m phải chia thành `[3.5m, 6m, 3.5m]`.

## 🟡 Warnings (Nên sửa)

1. Xử lý mảnh vụn (minCut) làm phát sinh Joint (điểm nối) vô lý
   - File: `js/JointSolver.js:154-160`
   - Vấn đề: Nếu tấm cuối bị dư một xíu (< 0.2m), code sẽ lấy tấm trước đó (đang là 6m) cộng với mảnh vụn và chia đôi (thành 3.05m và 3.05m). Điều này vô tình tạo ra một điểm nối (Joint) ngay giữa nhịp trần một cách kỳ cục ở cuối dãy.
   - Cách sửa: Nếu mảnh vụn quá nhỏ, có thể xem xét việc dồn tỷ lệ vào 2 tấm cuối hoặc cảnh báo người dùng. Tuy nhiên đây là logic chữa cháy phổ biến, nhưng có thể cải tiến thông minh hơn.

2. Mẫu xếp gạch (BRICK) chưa hoàn chỉnh
   - File: `js/JointSolver.js:111-113`
   - Vấn đề: Chỉ đơn thuần gán `firstPieceMax = maxL * shift` (mặc định 0.5) cho dòng lẻ. Nếu chiều dài dãy ngắn hơn `MaxL * 0.5`, nó sẽ dẫn đến các tấm vụn ở đuôi trông rất lộn xộn, mất đi tính "xếp gạch" thực sự.

## 🟢 Suggestions (Tùy chọn)

1. Hỗ trợ "Snap to Wall" (Dồn khớp nối vào sát mép tường) khi có Manual Joint.
2. Thêm cảnh báo nếu "Manual Joint" băm nhôm thành các mảnh vụn nhỏ hơn `minCut`.

## Next Steps

Chọn Menu Option (1-5) để xử lý các vấn đề này.
