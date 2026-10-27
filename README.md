<p align="center"><img src="apps/web/public/favicon.svg" width="64" height="64" alt="Talweg" /></p>

<h1 align="center">Talweg</h1>

<p align="center">A local workspace for diagrams, connected notes and plans.</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-0.1.0--beta.1-e6df9e?style=flat-square" alt="0.1.0-beta.1 candidate" />
  <img src="https://img.shields.io/badge/desktop-Windows%20%2F%20Linux-8caecc?style=flat-square" alt="Windows and Linux" />
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-91b89b?style=flat-square" alt="MIT license" /></a>
</p>

<p align="center">
  English · <a href="README.ru.md">Русский</a> · <a href="docs/README.md">Documentation</a> · <a href="https://github.com/talweg-app/talweg/releases">Downloads</a>
</p>

<picture>
  <source media="(prefers-color-scheme: light)" srcset="docs/media/canvas-light.png" />
  <img src="docs/media/canvas-dark.png" width="1440" alt="A Talweg board showing services, labelled connections and a database" />
</picture>

Put a diagram, a checklist and the reasoning behind them on the same board. Add independent pages when a topic grows. Keep your projects as files on your computer, and invite someone into a live editing session when you want company.

## Start here

Desktop builds target Windows and Linux. Check [Releases](https://github.com/talweg-app/talweg/releases) for published installers; the current source is a **0.1.0-beta.1 candidate**. If a build is not published yet, run it from source:

```bash
git clone https://github.com/talweg-app/talweg.git
cd talweg
pnpm install --frozen-lockfile
pnpm dev
```

Requires **Node.js 22.12+** and **pnpm 12.14.0**. Open [localhost:5173](http://localhost:5173). The local server saves working projects in `projects/`, outside Git. See [development](docs/development.md) for the desktop app and packaging commands.

## A board with room to grow

Draw with the pen, connect shapes, paste images or build a mind map from the keyboard. Right-click an object to change its fill, border, text and connection style. Select a word to format that word or attach a link.

Notes support Markdown and LaTeX. Link a phrase to an object on another page to connect an explanation to its worked example. Tables and checklists stay editable on the canvas. Groups let you move related objects together; tidy previews help arrange a selection before applying the change.

<table>
  <tr>
    <td width="50%"><picture><source media="(prefers-color-scheme: light)" srcset="docs/media/planning-light.png" /><img src="docs/media/planning-dark.png" alt="Planning board with Now, Next and Later columns of task cards" /></picture></td>
    <td width="50%"><img src="docs/media/math-light.png" alt="Math lesson with rendered equations and separate lesson, practice and solutions pages" /></td>
  </tr>
  <tr><td>Plan the work and keep the context beside it.</td><td>Explain a formula, then link to practice and solutions.</td></tr>
</table>

The library includes **12 starting points**, including a research map, weekly planner, incident review and retrospective. Opening a template is a preview; editing it creates your own working copy. Browse without filling your recent boards with examples.

<details>
<summary>See the template library</summary>

![Searchable template library](docs/media/templates.png)

</details>

## Work together for a session

Open **Collaborate → Start a session**, copy the `talweg://` invitation, and send it to your guest. They open Talweg, choose **Join a session** and paste it. You approve the request before they can edit.

Participants see each other’s cursors, object selections, live movement, resizing and pen strokes. Text editors also show remote selections and carets. Each person navigates and switches pages independently.

![A guest selects a service, moves it, edits its label and draws on the host’s board](docs/media/collaboration.gif)

*[Watch or download the MP4](docs/media/collaboration.mp4). Recorded from two browser sessions on one computer using the local relay.*

The host must keep the session open. This is live collaboration, not an always-on cloud workspace. Discovery uses network services; some connections need TURN. A custom WebSocket relay is also supported. Read [the collaboration guide](docs/collaboration.md) for connection options, guest copies and privacy details.

## Your files, your workspace

The desktop app starts with a welcome setup for language, appearance, display name and projects folder. English and Russian are available throughout the interface. Light, dark and system appearance are supported, and interface scale is separate from canvas zoom.

![Talweg welcome setup in the browser; the desktop app also offers folder controls](docs/media/welcome.png)

Desktop projects default to the system Documents folder under `Talweg`. A `.talweg` file carries the board, its pages and embedded images. Open a project on another computer by transferring that file. PNG export is available for sharing an image; Markdown notes can be downloaded separately.

Local version history records automatic versions and named checkpoints when a writable project folder is available. Preview an older version, download it or restore it as a separate board. History has retention limits, so keep an external backup of important work.

**Hide** removes a board from your current list. **Delete** asks for confirmation and removes the project and its saved history. These are separate actions. [Files and recovery](docs/files-and-recovery.md) explains what to back up and how browser-only storage differs.

## Beta boundaries

The beta is being prepared for Windows and Linux. macOS is deferred until we have access to a Mac for building and testing. Windows installers are currently unsigned; a successful cross-build does not replace a real Windows test.

P2P has been exercised in independent browser sessions and over a real WebRTC data channel on one computer. Connections across separate physical networks still need field testing. There are no view-only roles or persistent hosted rooms. Simultaneous edits to the same rich-text formatting or structured list can still conflict.

Talweg can be used offline for local work. Starting or joining a session contacts discovery or relay services; do not treat collaboration as an offline feature. Keep invitation links private because they contain session credentials.

## Find your way

| I want to… | Read |
| --- | --- |
| Make a board, format text or use the pen | [User guide](docs/user-guide.md) |
| Host or join a session | [Collaboration](docs/collaboration.md) |
| Move projects, make backups or recover a version | [Files and recovery](docs/files-and-recovery.md) |
| Run tests or build the desktop app | [Development](docs/development.md) |
| Report a problem or contribute a fix | [Contributing](CONTRIBUTING.md) |
| Check what is in this beta candidate | [Changelog](CHANGELOG.md) |

Talweg is released under the [MIT license](LICENSE).
