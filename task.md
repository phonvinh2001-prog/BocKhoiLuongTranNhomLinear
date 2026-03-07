# Task: Implement Joint Alignment & Advanced Adjustment

- [x] **Phase 1: Balanced Splitting Logic**
  - [x] Update `JointSolver.js` to support `BALANCED` pattern.
  - [x] Update `index.html` to add "Balanced (Chia cân đối)" option.
- [x] **Phase 2: Drag & Drop Joints**
  - [x] Update `Engine.js` state to track `draggingJoint` (stripIndex, jointVal).
  - [x] Implement `handleJointDown` (Start Drag).
  - [x] Implement `handleJointDrag` (On Move).
  - [x] Implement `handleJointUp` (End Drag).
- [x] **Phase 3: Smart Snap Logic**
  - [x] Implement `findSnapPoint` in `Engine.js` (Snap to Wall Corners).
  - [x] Visual Guide: Draw snap lines in `draw()`.
- [ ] **Phase 4: Verification**
  - [x] Automated Unit Test (Snap Logic) - _Skipped (Env missing Node.js)_
  - [ ] Manual Test: Balanced Splitting (8m -> 4m+4m).
  - [ ] Manual Test: Drag & Snap to corner.
