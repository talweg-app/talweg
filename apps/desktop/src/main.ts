import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  nativeTheme,
  net,
  protocol,
  session,
  shell,
} from "electron";
import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { isAbsolute, join, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { ProjectLibrary } from "../../web/server/projectFiles.js";
import { parseInvitation } from "../../web/src/utils/invitation.js";
import type { DesktopInfo } from "../../web/src/types/desktop.js";

app.setName("Talweg");
if (process.env.TALWEG_DESKTOP_USER_DATA) {
  mkdirSync(process.env.TALWEG_DESKTOP_USER_DATA, { recursive: true });
  app.setPath("userData", resolve(process.env.TALWEG_DESKTOP_USER_DATA));
}
protocol.registerSchemesAsPrivileged([
  {
    scheme: "talweg-app",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);
const clientKeys = new Set([
  "talweg_preferences",
  "talweg_theme",
  "talweg_lang",
  "talweg_display_name",
  "talweg_snap_to_grid",
  "talweg_welcome_complete",
  "talweg_active_doc",
]);
const clientState: Record<string, string> = {};
let configuredDirectory = "",
  projectsDirectory = "",
  preferencesPath = "";
let preferenceWrites = Promise.resolve();
let mainWindow: BrowserWindow | null = null;
let pendingInvitation: string | undefined;
let allowClose = false,
  closing = false;
let closeTimer: ReturnType<typeof setTimeout> | undefined;
const trusted = (url: string) => {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "talweg-app:" && parsed.hostname === "local";
  } catch {
    return false;
  }
};
function info(): DesktopInfo {
  return {
    platform: process.platform,
    version: app.getVersion(),
    projectsDirectory,
    nextProjectsDirectory: configuredDirectory,
  };
}
function savePreferences() {
  preferenceWrites = preferenceWrites
    .catch(() => undefined)
    .then(async () => {
      await mkdir(app.getPath("userData"), { recursive: true });
      const temporary = preferencesPath + ".tmp";
      await writeFile(
        temporary,
        JSON.stringify(
          { version: 1, clientState, projectsDirectory: configuredDirectory },
          null,
          2,
        ),
        { mode: 0o600 },
      );
      await rename(temporary, preferencesPath);
    });
  return preferenceWrites;
}
function invite(text: string) {
  try {
    parseInvitation(text);
  } catch {
    return;
  }
  if (mainWindow && !mainWindow.webContents.isLoadingMainFrame())
    mainWindow.webContents.send("desktop:invitation", text);
  else pendingInvitation = text;
  mainWindow?.show();
  mainWindow?.focus();
}
function external(text: string) {
  try {
    const url = new URL(text);
    if (
      ["https:", "http:"].includes(url.protocol) &&
      !url.username &&
      !url.password
    )
      void shell.openExternal(url.href);
  } catch {
    /* malformed links remain closed */
  }
}
function json(value: unknown, status = 200) {
  return new Response(
    typeof value === "string" ? value : JSON.stringify(value),
    {
      status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}
function text(english: string, russian: string): string {
  return clientState.talweg_lang === "ru" ? russian : english;
}
function updateMenu(window: BrowserWindow) {
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: "Talweg",
        submenu: [
          {
            label: text("Settings…", "Настройки…"),
            accelerator: "CmdOrCtrl+,",
            click: () => { window.webContents.send("desktop:open-settings"); },
          },
          { type: "separator" },
          { role: "quit", label: text("Quit", "Выход") },
        ],
      },
      {
        label: text("View", "Вид"),
        submenu: [
          { role: "togglefullscreen", label: text("Full screen", "Полный экран") },
          ...(!app.isPackaged ? [{ role: "toggleDevTools" as const }] : []),
        ],
      },
    ]),
  );
}
async function confirmClose(error?: string) {
  if (!mainWindow) return;
  if (error) {
    const choice = await dialog.showMessageBox(mainWindow, {
      type: "warning",
      message: text("Talweg could not confirm that all changes were saved.", "Talweg не удалось проверить сохранение всех изменений."),
      detail:
        text("Keep Talweg open to retry, or close without waiting for the remaining writes.", "Оставьте Talweg открытым для повторной попытки или закройте его, не дожидаясь сохранения."),
      buttons: [text("Keep open", "Оставить открытым"), text("Close anyway", "Всё равно закрыть")],
      defaultId: 0,
      cancelId: 0,
    });
    if (choice.response === 0) {
      closing = false;
      return;
    }
  }
  allowClose = true;
  mainWindow.close();
}
async function start() {
  preferencesPath = join(app.getPath("userData"), "preferences.json");
  try {
    const saved = JSON.parse(await readFile(preferencesPath, "utf8")) as {
      clientState?: Record<string, unknown>;
      projectsDirectory?: unknown;
    };
    for (const [key, value] of Object.entries(saved.clientState ?? {}))
      if (
        clientKeys.has(key) &&
        typeof value === "string" &&
        value.length < 65536
      )
        clientState[key] = value;
    if (
      typeof saved.projectsDirectory === "string" &&
      isAbsolute(saved.projectsDirectory)
    )
      configuredDirectory = saved.projectsDirectory;
  } catch {
    /* the first launch has no preferences file */
  }
  projectsDirectory =
    process.env.TALWEG_DESKTOP_PROJECTS_DIR ??
    (configuredDirectory || join(app.getPath("documents"), "Talweg"));
  configuredDirectory = projectsDirectory;
  const library = new ProjectLibrary(projectsDirectory);
  const index = await library.scan().catch(() => undefined);
  if (index && !index.projects.some(project => project.documentId === clientState.talweg_active_doc))
    clientState.talweg_active_doc = "";
  const workspacePartition = "persist:workspace-" + createHash("sha256").update(resolve(projectsDirectory)).digest("hex").slice(0, 24);
  const webRoot = app.isPackaged
    ? join(process.resourcesPath, "web")
    : resolve(app.getAppPath(), "../web/dist");
  session.fromPartition(workspacePartition).protocol.handle("talweg-app", async (request) => {
    try {
      const url = new URL(request.url);
      if (!trusted(url.href)) return new Response(null, { status: 403 });
      if (url.pathname === "/api/peer-config")
        return json({ localRelay: false });
      if (url.pathname === "/api/projects" && request.method === "GET")
        return json(await library.scan());
      if (url.pathname.startsWith("/api/projects/")) {
        const id = decodeURIComponent(
          url.pathname.slice("/api/projects/".length),
        );
        if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(id))
          return json({ error: "Invalid project id" }, 400);
        if (request.method === "GET") {
          const value = await library.read(id);
          return value
            ? json(value)
            : json({ error: "Project not found" }, 404);
        }
        if (
          request.method === "PUT" &&
          request.headers.get("content-type")?.startsWith("application/json")
        ) {
          const value = await request.text();
          if (value.length > 100 * 1024 * 1024)
            return json({ error: "Project exceeds 100 MB" }, 413);
          return json(await library.save(id, value));
        }
        if (request.method === "DELETE") {
          await library.delete(id);
          return json({ deleted: id });
        }
        return json({ error: "Method not allowed" }, 405);
      }
      let filename = resolve(webRoot, "." + decodeURIComponent(url.pathname));
      if (!filename.startsWith(webRoot + sep) && filename !== webRoot)
        return new Response(null, { status: 403 });
      if (url.pathname === "/" || url.pathname.startsWith("/board/"))
        filename = join(webRoot, "index.html");
      if (!(await stat(filename).catch(() => null))?.isFile())
        return new Response(null, { status: 404 });
      const response = await net.fetch(pathToFileURL(filename).href);
      const headers = new Headers(response.headers);
      headers.set(
        "Content-Security-Policy",
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https: wss: ws://localhost:* ws://127.0.0.1:*; worker-src 'self' blob:; object-src 'none'; frame-src 'none'; base-uri 'self'",
      );
      return new Response(response.body, { status: response.status, headers });
    } catch {
      return json({ error: "The local file could not be read or saved" }, 500);
    }
  });
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 760,
    minHeight: 560,
    show: false,
    icon: join(app.getAppPath(), "build", "icon.png"),
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#101212" : "#f7f7f3",
    autoHideMenuBar: true,
    webPreferences: {
      partition: workspacePartition,
      preload: join(__dirname, "preload.cjs"),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      spellcheck: false,
    },
  });
  const window = mainWindow;
  const check = (event: Electron.IpcMainInvokeEvent) => {
    if (
      event.sender !== window.webContents ||
      event.senderFrame !== window.webContents.mainFrame ||
      !trusted(event.senderFrame.url)
    )
      throw new Error("Untrusted frame");
  };
  ipcMain.handle("desktop:bootstrap", (event) => {
    check(event);
    const invitation = pendingInvitation;
    pendingInvitation = undefined;
    return { info: info(), clientState, ...(invitation ? { invitation } : {}) };
  });
  ipcMain.handle("desktop:save-preferences", async (event, values: unknown) => {
    check(event);
    if (!values || typeof values !== "object" || Array.isArray(values))
      throw new Error("Invalid preferences");
    for (const [key, value] of Object.entries(values)) {
      if (
        !clientKeys.has(key) ||
        typeof value !== "string" ||
        value.length > 65536
      )
        throw new Error("Invalid preference");
      clientState[key] = value;
    }
    await savePreferences();
    if ("talweg_lang" in values) updateMenu(window);
  });
  ipcMain.handle("desktop:choose-projects", async (event) => {
    check(event);
    const selection = await dialog.showOpenDialog(window, {
      defaultPath: configuredDirectory,
      properties: ["openDirectory", "createDirectory"],
    });
    if (selection.canceled || !selection.filePaths[0]) return null;
    configuredDirectory = selection.filePaths[0];
    await savePreferences();
    return info();
  });
  ipcMain.handle("desktop:open-projects", async (event) => {
    check(event);
    const error = await shell.openPath(projectsDirectory);
    if (error) throw new Error(error);
  });
  ipcMain.handle("desktop:close-ready", async (event, error: unknown) => {
    check(event);
    if (!closing) return;
    clearTimeout(closeTimer);
    try {
      await preferenceWrites;
      await confirmClose(error ? "save" : undefined);
    } catch {
      await confirmClose("save");
    }
  });
  window.webContents.session.setPermissionRequestHandler(
    (contents, permission, callback) => { callback(
        contents === window.webContents &&
          window.isFocused() &&
          ["clipboard-read", "clipboard-sanitized-write"].includes(permission),
      ); },
  );
  window.webContents.session.setPermissionCheckHandler(
    (contents, permission, origin) =>
      contents === window.webContents &&
      trusted(origin) &&
      ["clipboard-read", "clipboard-sanitized-write"].includes(permission),
  );
  window.webContents.on("will-navigate", (event, url) => {
    if (!trusted(url)) {
      event.preventDefault();
      external(url);
    }
  });
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("talweg://")) invite(url);
    else external(url);
    return { action: "deny" };
  });
  window.on("close", (event) => {
    if (allowClose) return;
    event.preventDefault();
    if (closing) return;
    closing = true;
    window.webContents.send("desktop:before-close");
    closeTimer = setTimeout(() => {
      void confirmClose("unresponsive");
    }, 15000);
  });
  window.on("closed", () => {
    mainWindow = null;
  });
  updateMenu(window);
  window.once("ready-to-show", () => { if (!process.env.TALWEG_DESKTOP_TEST) window.show(); });
  await window.loadURL("talweg-app://local/");
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on("second-instance", (_event, argv) => {
    const value = argv.find((arg) => arg.startsWith("talweg://"));
    if (value) invite(value);
    else {
      mainWindow?.show();
      mainWindow?.focus();
    }
  });
  app.on("open-url", (event, url) => {
    event.preventDefault();
    invite(url);
  });
  const initial = process.argv.find((arg) => arg.startsWith("talweg://"));
  if (initial) invite(initial);
  app.on("window-all-closed", () => { app.quit(); });
  void app
    .whenReady()
    .then(start)
    .catch((error: unknown) => {
      dialog.showErrorBox(
        "Talweg could not start",
        error instanceof Error ? error.message : "Unknown error",
      );
      allowClose = true;
      app.quit();
    });
}
