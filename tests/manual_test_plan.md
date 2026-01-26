# 🧪 Test Plan: Carrier Length Customization

Use this checklist to verify the new features.

## 1. UI Verification

- [ ] Open `index.html` in browser.
- [ ] Verify "Dài cây Xương" input appears in the Sidebar.
- [ ] Click the input -> Verify Dropdown appears (3.0, 4.0, 5.0, 6.0).
- [ ] Type a custom value (e.g., `4.5`) -> Verify it is accepted.

## 2. Calculation Verification (Single Zone)

- [ ] Draw a room approx 10m x 10m.
- [ ] Set **Dài cây Xương = 3.0m**.
- [ ] Click **TÍNH TOÁN** -> **XUẤT QS**.
- [ ] Note the number of "Thanh xương". (Expected: High number).
- [ ] Close QS. Set **Dài cây Xương = 6.0m**.
- [ ] Click **TÍNH TOÁN** -> **XUẤT QS**.
- [ ] Verify number of "Thanh xương" is roughly **half** of the previous number.
- [ ] Verify the name in QS table says "Thanh xương (6m)".

## 3. Project BOQ Verification

- [ ] Create "Zone A" with 3m carrier. Save to Project.
- [ ] Create "Zone B" with 6m carrier. Save to Project.
- [ ] Click **PROJECT**.
- [ ] Verify the summary calculates correctly (it uses the CURRENT input setting for the grand total if recalculated, OR adheres to the logic we fixed).
  - _Note:_ Our fix applies the _current_ input carrier length to ALL saved zones when calculating the Project Total. Ensure "Dài cây Xương" is set to what you want to order (e.g., if ordering 6m for the whole project, set 6m before viewing Project BOQ).

## 4. Logic Verification (Automated)

- [ ] Open `tests/verification_tool.html` in browser.
- [ ] Verify all test cases show "✅ PASS".
