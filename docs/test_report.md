# Test Report: AutoCAD Drawing Features

## 1. Refactoring for Testability

- **Extracted Logic:** Moved command parsing logic from `Engine.js` to `js/CADParser.js`.
- **Benefit:** Allows testing the math/parsing logic without loading the full Canvas/UI environment.

## 2. Test Suite Created

- **File:** `tests/test_runner.html`
- **Type:** Browser-based Unit Tests (ES Modules)
- **Coverage:**
  - [x] Direct Distance Input (e.g., `5.5`)
  - [x] Relative Coordinates (e.g., `@2,3`)
  - [x] Polar Coordinates Standard (e.g., `@5<45`)
  - [x] Polar Coordinates Simplified (e.g., `5<30`)
  - [x] Absolute Coordinates (e.g., `10,10`)
  - [x] Command Shortcuts (`L`, `CLOSE`)

## 3. Manual Verification Instructions

Since the automated agent browser is restricted in this environment:

1. Open `tests/test_runner.html` in your browser.
2. Verify all checks are Green (PASS).
3. Open Main App `index.html`.
4. Try the "Complex Scenario":
   - Type `L` (Enter) -> Start Line
   - Click a point.
   - Type `5<30` (Enter) -> Draw 5m line at 30 degrees.
   - Type `@2,0` (Enter) -> Draw 2m horizontal.
   - Type `C` (Enter) -> Close shape.

## 4. Code Changes

- Modified `js/Engine.js` to import `CAD_UTILS`.
- Created `js/CADParser.js`.
