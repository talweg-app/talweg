import { _electron as electron } from "playwright";
import electronPath from "electron";
import { strict as assert } from "node:assert";
import { mkdtemp, readFile, mkdir, access, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const directory = await mkdtemp(join(tmpdir(), "talweg-desktop-smoke-"));
const projects = join(directory, "projects");
const nextProjects = join(directory, "other-projects");
await mkdir(projects);
await mkdir(nextProjects);
const env = {
  ...process.env,
  TALWEG_DESKTOP_TEST: "1",
  TALWEG_DESKTOP_USER_DATA: join(directory, "profile"),
  TALWEG_DESKTOP_PROJECTS_DIR: projects,
};
try {
  await access("/opt/google/chrome/chrome-sandbox");
  env.CHROME_DEVEL_SANDBOX = "/opt/google/chrome/chrome-sandbox";
} catch {
  // Use the platform's configured Chromium sandbox.
}
let application;
async function launch() {
  application = await electron.launch({
    executablePath: process.env.TALWEG_DESKTOP_EXECUTABLE || electronPath,
    args: process.env.TALWEG_DESKTOP_EXECUTABLE ? [] : [resolve(".")],
    env,
    chromiumSandbox: true,
    timeout: 30000,
  });
  application.process().stderr?.on("data", (data) => {
    const text = String(data);
    if (/ERROR|Error|failed/i.test(text)) process.stderr.write(text);
  });
  const page = await application.firstWindow();
  page.on("pageerror", (error) => process.stderr.write(error.stack + "\n"));
  return page;
}
async function close() {
  const closed = application.waitForEvent("close", { timeout: 15000 });
  await application.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0]?.close();
  });
  await closed;
  application = undefined;
}
try {
  let page = await launch();
  const setup = page.getByRole("dialog", {
    name: "A space for your next idea.", exact: true,
  });
  await setup.waitFor({ timeout: 15000 });
  await setup.getByRole("textbox", { name: "Your name", exact: true }).fill("Native User");
  await setup.getByRole("combobox", { name: "Appearance", exact: true }).selectOption("light");
  await page.screenshot({ path: join(directory, "welcome-light.png") });
  await setup.getByRole("combobox", { name: "Appearance", exact: true }).selectOption("dark");
  await page.screenshot({ path: join(directory, "welcome-dark.png") });
  await setup.getByRole("button", { name: "Start using Talweg", exact: true }).click();
  await page.getByRole("button", { name: /^Blank Canvas/ }).click();
  await page.locator(".canvas-document-title").fill("Native QA");
  await page.getByTestId("canvas").click({ position: { x: 200, y: 180 } });
  await page.keyboard.press("r");
  await page.getByTestId("canvas").click({ position: { x: 400, y: 240 } });
  await page.getByTestId("canvas-node").waitFor();
  assert.equal(await page.evaluate(() => window.isSecureContext), true);
  assert.equal(await page.evaluate(() => typeof window.require), "undefined");
  const security = await application.evaluate(({ BrowserWindow }) => {
    const prefs = BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences();
    return { sandbox: prefs.sandbox, isolation: prefs.contextIsolation, node: prefs.nodeIntegration };
  });
  assert.deepEqual(security, { sandbox: true, isolation: true, node: false });
  assert.equal(await application.evaluate(({ app }) => app.commandLine.hasSwitch("no-sandbox")), false);
  await page.keyboard.press("Control+z");
  await page.getByTestId("canvas-node").waitFor({ state: "detached" });
  await page.keyboard.press("Control+Shift+z");
  await page.getByTestId("canvas-node").waitFor();
  await close();
  const preferences = JSON.parse(await readFile(join(directory, "profile", "preferences.json"), "utf8"));
  assert.equal(preferences.clientState.talweg_welcome_complete, "1");
  assert.equal(preferences.clientState.talweg_display_name, "Native User");
  assert.equal(preferences.clientState.talweg_theme, "dark");

  page = await launch();
  await page.getByRole("button", { name: /^Native QA/ }).click();
  await page.getByTestId("canvas-node").waitFor();
  assert.equal(await page.getByTestId("canvas-node").count(), 1);
  await application.evaluate(({ Menu }) => {
    Menu.getApplicationMenu().items[0].submenu.items[0].click();
  });
  const settings = page.getByRole("dialog", { name: "Settings", exact: true });
  await settings.waitFor();
  await settings.getByRole("button", { name: "Files & application", exact: true }).click();
  await application.evaluate(({ dialog }, folder) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [folder] });
  }, nextProjects);
  await settings.getByRole("button", { name: "Choose folder", exact: true }).click();
  await page.getByText("New location saved.", { exact: false }).waitFor();
  assert.deepEqual(await page.evaluate(() => ({
    current: window.talwegDesktopInfo.projectsDirectory,
    next: window.talwegDesktopInfo.nextProjectsDirectory,
  })), { current: projects, next: nextProjects });
  await close();

  delete env.TALWEG_DESKTOP_PROJECTS_DIR;
  page = await launch();
  await page.getByRole("button", { name: /^Blank Canvas/ }).waitFor();
  assert.equal(await page.evaluate(() => window.talwegDesktopInfo.projectsDirectory), nextProjects);
  assert.equal((await readdir(projects)).filter((file) => file.endsWith(".talweg")).length, 1);
  await close();
  assert.equal((await readdir(nextProjects)).filter((file) => file.endsWith(".talweg")).length, 0);
  process.stdout.write(JSON.stringify({
    result: "passed", directory,
    checks: ["secure local protocol", "sandboxed renderer without Node integration", "first-run setup in both themes", "file-backed preferences", "canvas undo and redo", "project save on close", "reopen with saved shape", "native Settings menu", "folder chooser IPC", "folder change after restart without moving existing files"],
  }) + "\n");
} catch (error) {
  if (application) {
    try { await application.evaluate(({ app }) => app.exit(1)); }
    catch {
      try { application.process().kill(); } catch { /* The process already exited. */ }
    }
  }
  throw error;
}
