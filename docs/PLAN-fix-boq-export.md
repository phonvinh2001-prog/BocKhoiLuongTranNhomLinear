# PLAN: Fix BOQ Export Missing Information

## Goals

- Fix "Missing Information" in BOQ Export (CSV) and UI.
- Fix logic bug in `exportCSV` (variable scope `metrics`).
- Ensure all Edge Types (including Shadow Gap) are calculated and exported.

## Analysis

1. **Missing Data**:
   - **Shadow Gap (Z-Profile)**: `calculateBOQData` currently ignores edges with type `SHADOW`. `constants.js` defines this as `W-Z15`.
   - **Fascia**: Calculated but often missing detailed breakdown in export.
   - **Accessories**: Splicers are calculated, but could be clearer.

2. **Bugs**:
   - **Variable Scope**: In `exportCSV`, `const metrics` is defined inside the `else` block (Mode 2) but accessed heavily outside it. This causes a crash if Mode 1 (Modal Open) is active.
   - **Duplicate Logic**: `exportCSV` has redundant code for listing items.

## Proposed Changes

### 1. Update `js/Engine.js` -> `calculateBOQData`

- Add logic to filter and measure `SHADOW` edges (similar to `WALL_V`).
- Calculate required bars for Shadow Gap (standard length likely 3.0m).
- Return `shadowTrims` in the result object.

### 2. Update `js/Engine.js` -> `exportCSV`

- **Fix Scope**: Move `metrics` definition or restructuring to ensure it's available for the final CSV writing block, OR unify the logic so "Mode 1" also populates a `metrics`-like structure.
- **Recommendation**: Always run `calculateBOQData` to get the base "Theoretical" values, then overwrite with "User Edits" from DOM if available.
- **Add Rows**:
  - Add "Thanh viền Shadow Gap (Z)" to the CSV output.
  - Ensure Fascia length is reported.
  - Ensure specific accessories (Splicer, Anchors) are clearly listed.

### 3. Update `js/Engine.js` -> `showBOQ`

- Add a row for "Shadow Gap" in the BOQ Modal so users can see/edit it before export.

## Verification Plan

1. **Manual Test**:
   - Draw a room with `WALL_V` and `SHADOW` edges.
   - Click "Xuất BOQ" (without opening modal). -> Check CSV for Shadow trimming.
   - Open "Xem BOQ", edit a value, then "Xuất BOQ". -> Check CSV for edited value AND no crash.
2. **Data Check**:
   - Verify total length of Shadow Gap matches geometry.
