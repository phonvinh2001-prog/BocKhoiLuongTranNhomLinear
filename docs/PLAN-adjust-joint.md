# PLAN: Joint Position Adjustment System (Tính năng điều chỉnh nối tấm)

**Goal:** Provide users with full control over panel joint positions (vị trí nối tấm/ba-via) for aesthetic alignment, complying with aluminum length limits (`MaxL`).

## 1. Requirement Analysis

### A. Manual "Anchor" Mode (Chỉnh tay)

- **Concept:** User sets specific "Anchor Points" (điểm mốc) where a joint MUST exist.
- **Auto-fill Logic:**
  - **Case 1 (Single Anchor):** Treated as a mandatory break. The remaining lengths before and after the anchor are treated as new segments. If these segments > `MaxL`, they are auto-divided (default logic).
  - **Case 2 (Two Anchors):** The segment between two anchors is checked. If > `MaxL`, it is auto-divided (e.g., split equally or `MaxL` from left).
- **Interaction:** Click on line to add joint. Click joint to remove.

### B. Pattern Mode (Quy luật)

- **Scope:** Applies to the entire room (global setting).
- **Patterns:**
  1.  **Dồn về cuối (Default):** First piece = `MaxL`, remainder at end.
  2.  **Thẳng hàng (Grid):** Joints are aligned across all strips.
  3.  **So le (Brick/Stagger):** Even strips shift joint by `50%` (or custom %).
  4.  **Ngẫu nhiên (Random):** First piece length is randomized (min `30%` to max `100%`) to avoid patterns.

## 2. Architecture Changes

### Data Structure (`Engine.js`)

Update `state` to include global patterns and per-strip manual overrides.

```javascript
this.state = {
  // ... existing
  jointConfig: {
    pattern: "DEFAULT", // DEFAULT, GRID, BRICK, RANDOM
    patternShift: 0.5, // For Brick (50%)
    randomSeed: 12345, // For stable randomness
  },
  // In each strip object:
  strips: [
    {
      // ...
      manualJoints: [2.5, 5.0], // Distances from start point (User Defined)
    },
  ],
};
```

## 3. Implementation Steps

### Phase 1: Logic Engine (New `JointSolver` Class)

Ideally separate this complex logic from `Engine.js` or `calculate()` method.

**Algorithm `solveStrip(totalLen, maxL, manualJoints, pattern)`:**

1.  **Step 1: Apply Manual Joints** -> Split `totalLen` into rigid segments.
2.  **Step 2: Apply Pattern** (Only for the first segment if no manual joints, or handling the "remainder" logic).
3.  **Step 3: Auto-fill** -> For any segment > `MaxL`, subdivide it.
    - _Subdivision Rule:_ `Math.ceil(segLen / MaxL)` parts of equal length (aesthetic) OR `MaxL` chunks (economical). **Decision: Equal Length for "Between Anchors", MaxL logic for "Free ends".**

### Phase 2: UI Updates (`index.html` & `main.js`)

- **Control Panel:** Add "Joint Manager" section.
  - Dropdown: Pattern (Standard, Grid, Brick, Random).
  - Params: Brick Shift (%).
  - Toggle: "Edit Joints Mode" (Mode chèn điểm nối).
- **Canvas Interaction:**
  - In "Edit Joints Mode":
    - Hover strip -> Show ghost joint + dimensions.
    - Click -> Add `manualJoint`.
    - Right Click Joint -> Remove.

## 4. Task Breakdown

- [ ] **Task 1: Joint Logic Refactor**
  - Create `js/Soilder.js` (or `JointSolver.js`) to handle cutting math.
  - Implement `calculateStrips` using the new logic.
- [ ] **Task 2: Pattern Implementation**
  - Add `pattern` selector to UI.
  - Implement Brick/Grid offset logic.
- [ ] **Task 3: Manual Interaction**
  - Implement `onMouseDown` logic for adding/removing joints in `state.strips`.
  - Visualize "User Joints" (Blue) vs "Auto Joints" (Gray).
- [ ] **Task 4: Verification**
  - Test Case: "Brick" pattern visual check.
  - Test Case: Manual joint at 2m -> Check remaining 8m is split correctly (e.g., 4m+4m or 6m+2m).

## 5. Verification Plan

- **Standard:** Set MaxL=6m. Draw 10m strip. Should be [6, 4].
- **Brick:** Strip 1 [6, 4]. Strip 2 [3, 6, 1].
- **Manual:** User adds joint at 5m. Strip [5, 5].
- **Manual > MaxL:** User adds joints at 1m and 9m. Gap is 8m (>6m). Logic splits 8m into [4, 4]. result: [1, 4, 4, 1].

## 6. Next Steps

Run `/create` to start Phase 1.
