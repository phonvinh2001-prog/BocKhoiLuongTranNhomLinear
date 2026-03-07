# PLAN: Joint Alignment & Advanced Adjustment (Căn chỉnh Nối tấm)

**Goal:** Enhance the Joint Adjustment system to support "Balanced Splitting" (4m+4m) and "Precision Alignment" (Snap to Wall/Base Edge), especially for complex shapes like U-Shape.

## 1. Requirement Analysis

### A. Balanced Splitting (Chia cân đối)

- **Problem:** Current default is `Auto-fill` (MaxL + Remainder). Example: 8m -> 6m + 2m.
- **Request:** Option to split equally or specifically (e.g., 4m + 4m).
- **Solution:** Add a **"Balanced"** option in Pattern dropdown or Auto-balance logic when `Remainder < Threshold`.
  - _Logic:_ If `TotalLen < 2 * MaxL`, split into 2 equal pieces (if user selects "Balanced").
  - _Manual Override:_ User clicks near the middle -> Auto-snap to center (4m).

### B. Multi-Joint Support (2m + 4m + 2m)

- **Problem:** User wants specific segmentation like 2m - 4m - 2m.
- **Solution:** Existing "Manual Joint" feature supports this.
  - _Workflow:_ User clicks at 2m. Segment becomes [2m, 6m].
  - User clicks at 6m (2m from end). Segment becomes [2m, 4m, 2m].
  - **Optimization:** Allow entering exact numbers via UI popup or command bar (e.g., "2, 6").

### C. Alignment / Snap-to-Edge (Căn thẳng hàng)

- **Problem:** Hard to click exactly perpendicular to a wall corner or "base edge".
- **Request:** "Align joint with bottom edge".
- **Solution:** **Smart Snap System**.
  - When adding/dragging a joint:
    - Detect nearby Wall Corners (vertices).
    - Detect nearby Wall Edges (perpendicular projection).
    - Show "Snap Line" (Ghost line) extending from existing geometry.
    - Snap cursor to these lines.

## 2. Implementation Steps

### Phase 1: Enhanced `JointSolver`

- Update `solveStrip` to handle "Balanced" logic better.
- _Task:_ If `pattern === 'BALANCED'` and `pieces.length === 2`, equalize them.

### Phase 2: User Interaction (Drag & Snap)

This is the core complex part.

#### 1. Dragging Logic (`Engine.js`)

- **Action:** Instead of just Click-to-Add/Remove, support **Drag-to-Move**.
- **Event Flow:**
  - `onDown`: Check if hitting existing joint -> `isDraggingJoint = true`.
  - `onMove`: Update joint position.
    - **Snap Check:** Iterate all `state.points` (corners). If `|jointX - cornerX| < threshold`, snap `jointX = cornerX`.
  - `onUp`: Commit new position.

#### 2. Visual Guides (Snap Lines)

- Draw dashed lines extending from walls/corners when hovering/dragging a joint.

### Phase 3: U-Shape Special Case

- U-Shape often has a "Base" (Day) and "Legs".
- User wants joints in the "Legs" to align with the "Base" corner?
- **Scenario:** U-Shape.
  - Inner Corner at X=4m.
  - Leg width 0-4m. Base 0-10m.
  - User wants to cut the Base at X=4m to align with the leg.
- **Solution:** The "Snap to Corner" logic covers this naturally. When dragging a joint on the Base strip, if cursor is near X=4m (Inner Corner), it will snap.

## 3. Tech Specs

### Data Structures

```javascript
// No new data structure needed.
// Rely on existing `state.jointConfig` and `state.strips`.
```

### UI Controls

- Add **"Balanced (Chia đều)"** to Pattern Dropdown.
- Add **"Snap to Wall (Bắt điểm tường)"** Toggle (Checkbox) in Joint UI group.

## 4. Task Breakdown

- [ ] **Task 1: Balanced Pattern Logic**
  - Update `JointSolver.js` to support `BALANCED` pattern.
- [ ] **Task 2: Smart Snap Logic**
  - Create `CAD_UTILS.findSnapPoint(currentPos, referencePoints, axis)`?
  - Integrate into `Engine.onMove` for Ghost Joint.
- [ ] **Task 3: Drag & Drop Implementation**
  - Refactor `handleJointClick` to support Drag start.
  - Implement `handleJointDrag` in `onMove`.
- [ ] **Task 4: Verification**
  - Test U-Shape alignment.
  - Test 8m split (4m+4m).

## 5. Next Steps

Run `/create` to start implementation.
