# Development and desktop builds

[Documentation](README.md) · [Contributing](../CONTRIBUTING.md)

## Requirements

- Node.js **22.12 or newer**.
- pnpm **12.14.0**, as pinned in the root `packageManager` field.
- A graphical desktop and platform libraries for Electron when running the desktop app.
- Google Chrome for the current Playwright configuration (`channel: "chrome"`).

## Run locally

```bash
git clone https://github.com/talweg-app/talweg.git
cd talweg
pnpm install --frozen-lockfile
pnpm dev
```

Open [localhost:5173](http://localhost:5173). The local server creates a project library at repository-root `projects/`. This directory is ignored by Git and contains user data; do not use it for destructive tests.

To keep a separate library on Linux:

```bash
TALWEG_PROJECTS_DIR=/absolute/path/to/talweg-projects pnpm dev
```

On PowerShell, set the variable before starting the command:

```powershell
$env:TALWEG_PROJECTS_DIR = 'C:\TalwegProjects'
pnpm dev
```

The Vite server is a development tool. It binds to network interfaces; use it on a trusted machine and network. It is not a production multi-user file server. Each desktop participant normally runs their own installed application.

## Repository layout

```text
apps/web/           React client and local project/history APIs
apps/desktop/       Electron main process, preload and packaging
packages/core/      Scene graph, transforms and geometry
packages/router/    Connector routing
packages/storage/   Yjs bindings, IndexedDB and .talweg files
e2e/                Playwright browser regression scenarios
docs/               User documentation and captured product media
assets/branding/    Existing logo and repository preview assets
```

The UI uses React 19, TypeScript, Vite and Tailwind CSS v4. Yjs holds shared state. The Electron app serves the built web client through its own protocol and exposes local file operations without requiring the development server.

## Checks

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

`pnpm test` runs package tests, including web utility and local API tests. Browser tests run separately:

```bash
pnpm exec playwright install chrome
pnpm exec playwright test
```

Playwright starts its own server on **5175**, uses isolated browser storage and retries zero times. Keep that port free. Run a focused scenario with, for example, `pnpm exec playwright test e2e/pages.spec.ts`. File-library tests create their own temporary directories.

Run the native Linux smoke suite against a packaged executable:

```bash
TALWEG_DESKTOP_EXECUTABLE=/absolute/path/to/Talweg.AppImage pnpm --filter @talweg/desktop test:smoke
```

The smoke script needs a working display and the Electron/Chromium runtime dependencies. A successful Linux smoke run does not verify the Windows installer or internet NAT traversal.

## Run the desktop app

```bash
pnpm desktop:start
```

This builds the workspace and launches Electron. The first-run setup selects preferences and the project directory. Avoid pointing development or smoke tests at a personal project library.

## Package

On Linux:

```bash
pnpm desktop:linux
```

On Windows:

```powershell
pnpm desktop:windows
```

Outputs go to ignored `release/`. Linux targets are AppImage and Debian packages. Windows uses an NSIS installer. `pnpm desktop:dir` produces an unpacked application for the host platform.

Cross-building Windows installers on Linux additionally needs a working Wine setup and downloads used by electron-builder. That is packaging evidence, not a substitute for installing and using the result on Windows. The current Windows candidate is unsigned. macOS packaging and validation are deferred.

## Configuration reference

These are process environment variables, not frontend secrets. Most users should use the Settings screen instead.

| Variable | Used by | Purpose |
| --- | --- | --- |
| `TALWEG_PROJECTS_DIR` | Local web server | Override the project-library directory. |
| `TALWEG_BROWSER_STORAGE_ONLY=1` | Local web server/tests | Disable file-library API and use browser storage; sessions use the local relay. |
| `TALWEG_ICE_SERVERS` | Local web server | JSON array of ICE servers offered to clients; device settings take precedence when non-empty. |
| `TALWEG_DESKTOP_PROJECTS_DIR` | Electron | Override the desktop project directory. |
| `TALWEG_DESKTOP_USER_DATA` | Electron | Isolate the Electron application profile for testing. |
| `TALWEG_DESKTOP_EXECUTABLE` | Native smoke runner | Path to the packaged executable under test. |

The local Vite preview server also supplies the project/history API. Deploying only the contents of `apps/web/dist` to a static host does not supply that API and falls back to browser storage. Keep that distinction visible when testing persistence.
