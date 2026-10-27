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
  await application.evaluate(({ BrowserWindow }) => { BrowserWindow.getAllWindows()[0]?.show(); });
  page.on("pageerror", (error) => process.stderr.write(error.stack + "\n"));
  return page;
}
async function close() {
  const child = application.process();
  const exited = new Promise(resolveExit => { if (child.exitCode !== null) resolveExit(); else child.once("exit", resolveExit); });
  const closed = application.waitForEvent("close", { timeout: 15000 });
  await application.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0]?.close();
  });
  await closed;
  await exited;
  application = undefined;
}
try {
  let page = await launch();
  const setup = page.getByRole("dialog", {
    name: "A space for your next idea.", exact: true,
  });
  await setup.waitFor({ timeout: 15000 });
  await setup.getByRole("textbox", { name: "Your name", exact: true }).fill("Native User");
  await setup.getByRole("combobox", { name: "Appearance", exact: true }).click();
  await page.getByRole("listbox", { name: "Appearance", exact: true }).getByRole("option", { name: "Light", exact: true }).click();
  await page.screenshot({ path: join(directory, "welcome-light.png"), animations: "disabled" });
  await setup.getByRole("combobox", { name: "Appearance", exact: true }).selectOption("dark");
  await page.screenshot({ path: join(directory, "welcome-dark.png"), animations: "disabled" });
  assert.equal(await setup.evaluate(element => element.scrollHeight <= element.clientHeight + 1), true);
  await setup.getByRole("button", { name: "Start using Talweg", exact: true }).click();
  await page.getByRole("button", { name: "Browse all 12 templates", exact: true }).click();
  const templates = page.getByRole("dialog", { name: "Template library", exact: true });
  await templates.waitFor();
  assert.equal(await templates.locator(".template-library-card").count(), 12);
  await templates.getByRole("searchbox").fill("Math lesson");
  await templates.getByRole("button", { name: /Math lesson/ }).click();
  await page.getByRole("tab", { name: "Solutions", exact: true }).waitFor();
  await page.locator(".canvas-note-preview .katex").first().waitFor();
  await page.getByRole("button", { name: "Talweg", exact: true }).click();
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
  await page.keyboard.press("Control+Comma");
  const scaleSettings = page.getByRole("dialog", { name: "Settings", exact: true });
  await scaleSettings.getByRole("slider", { name: "Interface scale", exact: true }).fill("125");
  await scaleSettings.getByRole("button", { name: "Done", exact: true }).click();
  assert.equal((await page.locator(".canvas-header").boundingBox()).height, 70);
  await page.keyboard.press("Control+Equal");
  assert.equal(await page.locator(".canvas-header").evaluate(element => getComputedStyle(element).zoom), "1.3");
  assert.equal(await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.getZoomFactor()), 1);
  await page.keyboard.press("Control+Minus");
  assert.equal(await page.locator(".canvas-header").evaluate(element => getComputedStyle(element).zoom), "1.25");

  const originalId = new URL(page.url()).pathname.split("/")[2];
  await page.getByRole("button", { name: "Canvas settings", exact: true }).click();
  await page.getByRole("menuitem", { name: "Version history", exact: true }).click();
  const history = page.getByRole("dialog", { name: "Version history", exact: true });
  await history.getByRole("textbox", { name: "Checkpoint name (optional)", exact: true }).fill("Native checkpoint");
  await history.getByRole("button", { name: "Save checkpoint", exact: true }).click();
  await history.getByRole("button", { name: /^Native checkpoint/ }).waitFor();
  await history.getByRole("img", { name: "Version preview", exact: true }).waitFor();
  await history.getByRole("button", { name: "Restore as a new board", exact: true }).click();
  await page.waitForURL(url => url.pathname.split("/")[2] !== originalId);
  await page.locator(".canvas-document-title").waitFor();
  await page.getByTestId("canvas-node").waitFor();
  assert.notEqual(new URL(page.url()).pathname.split("/")[2], originalId);
  assert.equal(await page.locator(".canvas-document-title").inputValue(), "Native QA (restored)");
  await close();
  const preferences = JSON.parse(await readFile(join(directory, "profile", "preferences.json"), "utf8"));
  assert.equal(preferences.clientState.talweg_welcome_complete, "1");
  assert.equal(preferences.clientState.talweg_display_name, "Native User");
  assert.equal(preferences.clientState.talweg_theme, "dark");
  assert.equal(JSON.parse(preferences.clientState.talweg_preferences).interfaceScale, 1.25);

  page = await launch();
  await page.getByRole("button", { name: /^Native QA 1 element/ }).click();
  await page.getByTestId("canvas-node").waitFor();
  assert.equal(await page.getByTestId("canvas-node").count(), 1);
  assert.equal((await page.locator(".canvas-header").boundingBox()).height, 70);
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
  assert.equal((await readdir(projects)).filter((file) => file.endsWith(".talweg")).length, 2);
  await close();
  assert.equal((await readdir(nextProjects)).filter((file) => file.endsWith(".talweg")).length, 0);
  process.stdout.write(JSON.stringify({
    result: "passed", directory,
    checks: ["secure local protocol", "sandboxed renderer without Node integration", "first-run setup in both themes", "template gallery and multi-page math preview", "file-backed preferences", "canvas undo and redo", "project save on close", "reopen with saved shape", "native version history and independent restoration", "native Settings menu", "interface scale survives restart", "Ctrl plus and minus resize UI without Chromium zoom", "folder chooser IPC", "folder change after restart without moving existing files"],
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
