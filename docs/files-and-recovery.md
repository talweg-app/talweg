# Files, saving and recovery

[Documentation](README.md) · [Русская инструкция](user-guide.ru.md#сохранение-и-история)

## Where work lives

| How you run Talweg | Project location |
| --- | --- |
| Windows or Linux desktop app | System Documents folder, inside `Talweg`, unless changed in Settings |
| Local Vite development or preview server | Repository-root `projects/`, or `TALWEG_PROJECTS_DIR` |
| Static web files without the local project API | Browser storage for that origin and profile |

The desktop app keeps projects separate from installed application files. Updating the application does not require moving the project library into the installation directory.

A `.talweg` file contains a board’s pages, scene data, Yjs state and embedded images. PNG is an image export, not an editable backup. A Markdown download contains one note, not the entire project.

## Automatic saves

While you edit, IndexedDB keeps a working copy. When a writable library is connected, Talweg also writes project files to that folder. Check the status under the board title and wait for **Saved to projects folder** before shutting down.

If a file write fails, the browser copy is retained and writes are retried while the board is open. Treat an error status as a reason to export a `.talweg` copy and check disk space and folder permissions. Do not clear application or browser data while trying to recover unsaved work.

In a compatible browser, opening or saving through a native file picker can bind a project to that file for subsequent writes in the current session. Other browsers download a copy instead. Do not assume that a downloaded file will keep updating after you close or reopen the page; check the save status.

## Why another browser may look empty

Browser storage is scoped by profile and origin. `localhost:5173`, `127.0.0.1:5173` and `localhost:5176` are different origins. They do not share an IndexedDB database.

Browsers connected to the **same local project server and folder** can read the same project files. Already-open boards are not a live file-watching sync system: reopen a board to load outside changes. Use a collaboration session for simultaneous editing.

When you open the home screen with a project folder available, existing non-draft browser boards can migrate into it. Old work in a different origin will only be found when you visit that origin. Before changing addresses or clearing site data, save important boards as `.talweg` files.

## Bring files into the library

Open a `.talweg` file through **Open from Computer**, or copy project files into the configured project folder and refresh the home screen. Files are identified by their internal document ID, not just their filename. Renaming a file does not create a new board; duplicate IDs can produce a warning.

To change the desktop folder, choose **Settings → Files & application → Choose folder**, then restart. Existing project files are **not moved automatically**. Close Talweg and copy the old library to the new location if you want to bring everything with you.

## Version history

History requires a writable local project folder. Use **Version history** to inspect automatic versions or save a named checkpoint before a large change. You can preview pages, download a version, or restore it as a new board. Restoring leaves the current project intact.

History lives in the library’s hidden `.history/` directory. Its policy limits the number and total size of versions per project. The oldest versions, **including named checkpoints**, may be removed when those limits are exceeded. Turning off automatic history retains existing versions and still permits manual checkpoints.

## What to back up

Close the app after checking its save status, then copy the **whole project folder**, including hidden directories, to another disk or backup system.

```text
Talweg/
├── doc-….talweg       project files with embedded images
├── .history/         local versions and history policy
└── .deleted/         deletion markers that block stale cached copies
```

Copying only `.talweg` files transfers current boards but leaves their history behind. Settings export is separate: it does not include projects, invitations or TURN usernames/passwords.

## Hiding and deleting

**Hide** changes the current browser/profile’s list. You can find the board under hidden boards and show it again. The project file remains.

**Delete** requires confirmation, removes the project and its history, and records a deletion marker to stop an old browser cache from recreating it. There is no undo for deleting a project. Copying a file with a deleted document ID back into the same library may remain blocked by that marker; keep backups outside the live library and ask for recovery help before changing markers manually.

## Recovery checklist

1. Keep the current browser profile and project directory intact.
2. Check whether you are using the original host, port, folder and profile.
3. Look for the board in hidden boards and in the project folder.
4. If the current board opens, export a `.talweg` copy before making further changes.
5. If history is available, preview a previous version and restore it as a new board.
6. If a file is damaged, retain it and the history folder when reporting the problem. Share a private or redacted copy only when appropriate.
