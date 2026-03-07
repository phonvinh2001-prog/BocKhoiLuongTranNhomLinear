# Manual Verification: Joint Adjustment System (Advanced)

**Tính năng:** Cân chỉnh nâng cao (Balanced, Drag & Snap)
**Trạng thái:** Đã cài đặt xong (Ready to Test)

## 1. Test Case: Chia cân đối (Balanced)

1.  Vẽ một phòng chữ nhật kích thước **8m x 5m** (Dài x Rộng).
2.  Set `MaxL` (Chiều dài nhôm max) = **6m**.
3.  Chọn kiểu nối: **"Mặc định (Dồn cuối)"**.
    - **Kết quả:** Tấm dài 8m sẽ chia thành **6m + 2m**.
4.  Chọn kiểu nối: **"Chia cân đối (Balanced)"**.
    - **Kết quả:** Tấm dài 8m sẽ chia thành **4m + 4m** (hai phần bằng nhau).

## 2. Test Case: Kéo thả & Bắt điểm (Drag & Snap)

1.  Bật chế độ **"Chỉnh điểm nối (Manual)"**.
2.  Di chuột vào một điểm nối (xanh đậm).
3.  **Nhấn giữ chuột trái** và kéo.
    - Điểm nối sẽ di chuyển theo chuột (trong phạm vi thanh nhôm).
4.  Kéo điểm nối đến gần vị trí góc tường hoặc cạnh đáy chữ U.
    - **Kết quả:** Điểm nối sẽ tự động "hít" (snap) vào vị trí thẳng hàng với góc tường.
5.  Thả chuột ra.
    - Điểm nối được cập nhật tại vị trí mới.

## 3. Test Case: Đa điểm nối (Multi-Joints)

1.  Vẽ phòng dài **12m**. `MaxL` = 6m. (Mặc định: 6m + 6m).
2.  Click thêm điểm nối tại vị trí **2m**.
    - **Kết quả:** Tấm chia thành 2m + ... (đoạn sau tự chia tiếp).
3.  Click thêm điểm nối tại vị trí **10m** (cách cuối 2m).
    - **Kết quả:** Tấm chia thành **2m - 8m - 2m**. Nếu 8m > MaxL, nó sẽ tự chia tiếp (VD: 2m-4m-4m-2m nếu chọn Balanced cho đoạn giữa).
