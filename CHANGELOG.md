# Changelog

## 0.1.0-beta.1 (unreleased candidate)

This describes the current candidate source. It is not a claim that installers have been published or that all target platforms have completed manual testing.

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

### Still to verify

- Installation and everyday use on a physical Windows machine; the installer is unsigned.
- Two physical devices on different networks, including a network requiring TURN.
- Conflicting rich-text formatting and structured-list changes during simultaneous editing.

macOS is deferred. The [collaboration guide](docs/collaboration.md) and [file guide](docs/files-and-recovery.md) describe the current limits.
