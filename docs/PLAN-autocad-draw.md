# PLAN: AutoCAD-style Drawing System

**Goal:** Enhance the "Free Draw" mode with precise command-line inputs and visual guides, mimicking AutoCAD behavior for professional use.

## 1. User Interface (UI) Changes

- **Command Bar (Bottom):** A floating input field at the bottom of the canvas viewport.
  - Status Text: "Command: \_"
  - Input: Text input for commands (e.g., `5.5`, `@2,3`, `C`).
- **Cursor Tooltip (Dynamic):** Floating label near mouse cursor showing:
  - Current coordinates (X, Y).
  - Distance & Angle relative to last point (Polar coords).
  - Snap indicator (End, Mid, Near).

## 2. Input Logic (Command Parser)

The system will accept the following input formats in the Command Bar:

### A. Drawing Commands

| Input       | Action                                                                  | Example                                |
| ----------- | ----------------------------------------------------------------------- | -------------------------------------- |
| `NUMBER`    | **Direct Distance Entry**: Draw line of length N in direction of mouse. | `5.0` (Draw 5m at current mouse angle) |
| `@x,y`      | **Relative Coordinates**: Move X, Y from last point.                    | `@2,0` (Draw horizontal 2m)            |
| `x,y`       | **Absolute Coordinates**: Move to grid grid X, Y.                       | `0,0` (Back to origin)                 |
| `@dist<ang` | **Polar Coordinates**: Distance at angle (degrees).                     | `@5<45` (5m at 45 degrees)             |

### B. Action Shortcuts

| Key/Cmd        | Action                                 |
| -------------- | -------------------------------------- |
| `L` / `LINE`   | Start Line tool (Default in Draw mode) |
| `PL`           | Polyline (Same as Line for now)        |
| `U` / `UNDO`   | Undo last point                        |
| `C` / `CLOSE`  | Close shape (connect to start)         |
| `REC`          | Draw Rectangle by 2 corners            |
| `O` / `OFFSET` | Offset curve (Parallel wall creation)  |
| `M` / `MOVE`   | Move selected points                   |
| `Z` / `ZOOM`   | Zoom Extents (Fit view)                |

### C. Modifier Keys (Hotkeys)

- **SHIFT (Hold):** Ortho Mode (Temporary).
- **F8:** Toggle Ortho Mode (Permanent).
- **ESC:** Cancel drawing / Deselect.
- **ENTER:** Submit command / Repeat last command.

## 3. Implementation Details

### File: `index.html`

- Add `<div id="cmd-bar">` and `<div id="cursor-tooltip">`.

### File: `js/Engine.js`

- **State Updates:**
  - Track `lastPoint`, `cursorPos`, `isOrtho`.
- **Update `onMove(e)`:**
  - Calculate distance/angle from `lastPoint`.
  - Apply Ortho lock if Shift is held.
  - Update `cursor-tooltip`.
  - Render "Ghost Line" (Rubber band) from last point to mouse.
- **Update `onDown(e)`:**
  - Handle clicks as usual, but respect Ortho if active.
- **New Method `handleCommand(str)`:**
  - Parse regex patterns for Input types.
  - Update `points` state.

## 4. Verification Plan

- [ ] Verify "Direct Distance": Type `5` -> Line length is exactly 5.0m.
- [ ] Verify "Ortho": Hold Shift -> Line snaps to 90 degrees.
- [ ] Verify "Relative": Type `@2,2` -> Point moves (+2, +2).
- [ ] Verify "Close": Type `C` -> Shape closes.

## 5. Next Steps

Run `/code` to implement this plan.
