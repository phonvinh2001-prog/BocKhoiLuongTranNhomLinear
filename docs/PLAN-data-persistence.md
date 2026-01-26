# IMPL PLAN: Data Persistence (Auto-Save)

## Goal

Implement a robust data persistence system so that user data (inputs, project list, current drawing) is not lost upon page reload (F5).

## User Review Required

> [!IMPORTANT]
> **Storage Limit**: We will use `localStorage` which has a limit (~5MB). This is sufficient for text data but if the project list grows very large with complex drawings, we might hit limits. For now, it's the best zero-config solution.

## Proposed Changes

### 1. `js/utils.js` - Storage Helpers

#### [NEW] Storage Helpers

Add functions to handle saving/loading securely with JSON parsing and error handling.

- `saveToStorage(key, data)`
- `loadFromStorage(key)`

### 2. `js/Engine.js` - State Management

#### [MODIFY] `Engine` class

**A. New State Properties**

- Add `lastSaved` timestamp.
- Define `STORAGE_KEY = 'ALUMASTER_V17_STATE'`.

**B. `saveState()` Method**

- Gather all UI inputs:
  - Shape inputs: `shp_type`, `dim_*` (L, W, etc.)
  - Ceiling inputs: `cfg_*` (pW, gW, maxL, etc.)
  - Structure inputs: `cfg_cX`, `cfg_tY`, etc.
- Gather App state:
  - `projectZones` (List of rooms)
  - `inputMode` (PRESET/FREE)
  - `points` (if FREE mode)
  - `currentPreset`
- Save to `localStorage`.

**C. `loadState()` Method**

- Check `localStorage`.
- IF found:
  - Restore `projectZones`: Render project list.
  - Restore `inputMode`: Switch tab.
  - Restore Inputs: Fill value for each ID.
  - Restore Drawing:
    - If `PRESET`: Call `preset()` to redraw.
    - If `FREE`: Restore `points` and call `draw()`.
  - Show "Restored from last session" toast.

**D. Triggers (Auto-Save)**

- Add `autoSave()` with debounce (e.g., 1s after changes).
- Hook into:
  - `calculate()`
  - `addToProject()`
  - `deleteProject()`
  - Input `change` events (optional, or just rely on major actions + periodic).
- Hook `window.onbeforeunload` to save immediately code.

### 3. `js/main.js` - Initialization

#### [MODIFY] `main.js`

- Call `app.loadState()` after initialization.

## Verification Plan

### Automated Tests

- None (Logic is heavily DOM-dependent).

### Manual Verification

1. **Input Persistence**: Change dimensions (e.g., L=15m), reload page. Verify L=15m.
2. **Project List**: Add 2 rooms to Project. Reload. Verify 2 rooms exist.
3. **Drawing State**: Switch to "Free Draw", draw a triangle. Reload. Verify triangle remains.
4. **Clean Start**: Open in Incognito (empty storage). Verify defaults load correctly.
