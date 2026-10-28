# Changelog

## 0.1.0-beta.1 · 2026-10-27

First public beta for Windows and Linux, published under the [v0.1.0-beta release tag](https://github.com/talweg-app/talweg/releases/tag/v0.1.0-beta). The application and installer version is `0.1.0-beta.1`.

### Workspace

- Windows and Linux Electron packaging, first-run setup and configurable project folder.
- English/Russian interface, light/dark/system appearance and independent interface scaling.
- File-backed project library, separate hide/delete actions and local version history with checkpoints.
- Twelve built-in templates with worked examples and independent pages.

### Canvas

- Shapes, labelled connectors, groups, images, editable tables and checklists.
- Freehand drawing, range-level text formatting, external links and links to objects on other pages.
- Markdown notes and LaTeX math rendering, PNG and `.talweg` export.
- Tidy previews, alignment controls and keyboard-driven mind maps.

### Collaboration

- Host-approved `talweg://` invitations and editable shared boards.
- Remote cursors, selections, live move/resize/pen previews and text carets.
- Independent page navigation and the option for guests to save a separate copy.
- WebRTC discovery, custom ICE settings and an alternate WebSocket relay transport.

### Validation and limitations

- 306 unit checks, 109 browser scenarios and 14 Linux desktop smoke checks passed during beta preparation.
- The maintainer completed manual Windows and P2P checks before publication.
- The Windows installer is unsigned. Restricted networks may require TURN.
- Simultaneous rich-text formatting and structured-list changes can still conflict.

macOS is deferred. The [collaboration guide](docs/collaboration.md) and [file guide](docs/files-and-recovery.md) describe the current limits.
