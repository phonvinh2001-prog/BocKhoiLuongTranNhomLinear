# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

## [2026-01-26]

### Added

- **Data Persistence**: Auto-save architecture using `localStorage`.
- `js/utils.js`: Storage helpers (`saveToStorage`, `loadFromStorage`).
- `js/Engine.js`: `saveState`, `loadState`, and `autoSave` methods.
- `js/main.js`: Auto-load state on initialization.
- **Project File Management**: Export/Load project as JSON file.
- `exportProject()`: Download all project data as `.json` file.
- `newProject()`: Create new project with confirmation dialog.
- `loadProject()`: Import project from `.json` file.
