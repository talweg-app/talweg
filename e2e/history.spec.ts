import { test, expect, type Page } from "@playwright/test";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createServer, type ViteDevServer } from "../apps/web/node_modules/vite/dist/node/index.js";
import AxeBuilder from "@axe-core/playwright";

test.describe.configure({ mode: "serial" });
let server: ViteDevServer;
let directory: string;
let cache: string;
const previousDirectory = process.env.TALWEG_PROJECTS_DIR;
async function start() {
  process.env.TALWEG_PROJECTS_DIR = directory;
  server = await createServer({ root: resolve("apps/web"), configFile: resolve("apps/web/vite.config.ts"), cacheDir: cache, logLevel: "error", server: { port: 5196, strictPort: true, host: "127.0.0.1" } });
  await server.listen();
}
test.beforeAll(async () => { directory = await mkdtemp(join(tmpdir(), "talweg-history-e2e-")); cache = await mkdtemp(join(resolve("apps/web/node_modules"), ".vite-history-test-")); await start(); });
test.afterAll(async () => { await server?.close(); await rm(directory, { recursive: true, force: true }); await rm(cache, { recursive: true, force: true }); if (previousDirectory === undefined) delete process.env.TALWEG_PROJECTS_DIR; else process.env.TALWEG_PROJECTS_DIR = previousDirectory; });
async function createBoard(page: Page, title: string) {
  await page.goto("http://127.0.0.1:5196/");
  await page.locator(".workspace-templates").getByRole("button", { name: /^Blank Canvas/ }).click();
  await page.locator(".canvas-document-title").fill(title);
  await expect(page.getByRole("status")).toHaveText("Saved to projects folder");
  const id = new URL(page.url()).pathname.split("/")[2]; if (!id) throw new Error("Missing board id"); return id;
}
async function openHistory(page: Page) {
  await page.getByRole("button", { name: "Canvas settings", exact: true }).click();
  await page.getByRole("menuitem", { name: "Version history", exact: true }).click();
  return page.getByRole("dialog", { name: "Version history", exact: true });
}

test("checkpoint preview includes images and restores independently after restarting the server", async ({ browser }) => {
  test.setTimeout(90000);
  const context = await browser.newContext(); const page = await context.newPage();
  let fresh: import("@playwright/test").BrowserContext | undefined;
  try {
    const id = await createBoard(page, "History original");
    await page.getByRole("button", { name: "Add to canvas", exact: true }).click();
    await page.getByRole("dialog", { name: "Add to canvas", exact: true }).getByRole("button", { name: "Rectangle", exact: true }).click();
    const node = page.getByTestId("canvas-node").first();
    await node.dblclick();
    await node.getByRole("textbox", { name: "Label", exact: true }).fill("Keep this version");
    await node.getByRole("textbox", { name: "Label", exact: true }).press("Escape");
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Add to canvas", exact: true }).click();
    await page.getByRole("dialog", { name: "Add to canvas", exact: true }).getByRole("button", { name: "Image", exact: true }).click();
    await (await chooser).setFiles({ name: "proof.svg", mimeType: "image/svg+xml", buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#c1ae74"/></svg>') });
    const history = await openHistory(page);
    await history.getByRole("textbox", { name: "Checkpoint name (optional)", exact: true }).fill("Before review");
    await history.getByRole("button", { name: "Save checkpoint", exact: true }).click();
    await expect(history.getByRole("button", { name: /^Before review/ })).toBeVisible();
    await expect(history.getByRole("img", { name: "Version preview", exact: true })).toBeVisible();
    const download = page.waitForEvent("download");
    await history.getByRole("button", { name: "Download version", exact: true }).click();
    const file = await (await download).path(); if (!file) throw new Error("Missing history export");
    const snapshot = JSON.parse(await readFile(file, "utf8")) as { assets: Record<string, unknown> };
    expect(Object.keys(snapshot.assets)).toHaveLength(1);
    const result = await new AxeBuilder({ page }).include(".version-history").withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    expect(result.violations).toEqual([]);
    await history.getByRole("button", { name: "Close", exact: true }).click();
    await page.locator(".canvas-document-title").fill("Current title");
    await expect(page.getByRole("status")).toHaveText("Saved to projects folder");
    const original = await readFile(join(directory, `${id}.talweg`), "utf8");
    await context.close(); await server.close(); await start();
    fresh = await browser.newContext(); const other = await fresh.newPage();
    await other.goto(`http://127.0.0.1:5196/board/${id}`);
    const restoredHistory = await openHistory(other);
    await restoredHistory.getByRole("button", { name: /^Before review/ }).click();
    await expect(restoredHistory.getByRole("img", { name: "Version preview", exact: true })).toBeVisible();
    await restoredHistory.getByRole("button", { name: "Restore as a new board", exact: true }).click();
    await expect(other.locator(".canvas-document-title")).toHaveValue("History original (restored)");
    expect(new URL(other.url()).pathname).not.toContain(id);
    await expect(other.getByText("Keep this version", { exact: true })).toBeVisible();
    await expect(other.getByRole("group", { name: "Image", exact: true }).getByRole("img")).toBeVisible();
    const unchanged = JSON.parse(await readFile(join(directory, `${id}.talweg`), "utf8")) as { sceneSnapshot: unknown; assets: unknown; metadata: { title: string } };
    const before = JSON.parse(original) as typeof unchanged;
    expect(unchanged.sceneSnapshot).toEqual(before.sceneSnapshot);
    expect(unchanged.assets).toEqual(before.assets);
    expect(unchanged.metadata.title).toBe("Current title");
  } finally { await context.close(); await fresh?.close(); }
});

test("a damaged current file can be recovered from history without replacing its original bytes", async ({ browser }) => {
  const context = await browser.newContext(); let fresh: import("@playwright/test").BrowserContext | undefined;
  try {
    const page = await context.newPage(); const id = await createBoard(page, "Recover this project");
    const history = await openHistory(page);
    await history.getByRole("textbox", { name: "Checkpoint name (optional)", exact: true }).fill("Safe point");
    await history.getByRole("button", { name: "Save checkpoint", exact: true }).click();
    await expect(history.getByRole("button", { name: /^Safe point/ })).toBeVisible();
    await context.close();
    await writeFile(join(directory, `${id}.talweg`), "Damaged original file");
    fresh = await browser.newContext(); const other = await fresh.newPage();
    await other.goto(`http://127.0.0.1:5196/board/${id}`);
    await expect(other.getByRole("alert")).toContainText("This project could not be opened");
    await other.getByRole("button", { name: "Version history", exact: true }).click();
    const recovery = other.getByRole("dialog", { name: "Version history", exact: true });
    await recovery.getByRole("button", { name: /^Safe point/ }).click();
    await recovery.getByRole("button", { name: "Restore as a new board", exact: true }).click();
    await expect(other.locator(".canvas-document-title")).toHaveValue("Recover this project (restored)");
    expect(await readFile(join(directory, `${id}.talweg`), "utf8")).toBe("Damaged original file");
  } finally { await context.close(); await fresh?.close(); }
});

test("history policy persists in the shared folder and errors keep the dialog usable", async ({ page }) => {
  const id = await createBoard(page, "History settings check");
  await page.keyboard.press("Control+Comma");
  const settings = page.getByRole("dialog", { name: "Settings", exact: true });
  await settings.getByRole("button", { name: "Files & application", exact: true }).click();
  await settings.getByRole("checkbox", { name: "Automatic version history", exact: true }).uncheck();
  await settings.getByRole("spinbutton", { name: "Versions per project", exact: true }).fill("5");
  await settings.getByRole("button", { name: "Apply history settings", exact: true }).click();
  await expect(settings.getByRole("status")).toHaveText("History settings saved.");
  const policy = JSON.parse(await readFile(join(directory, ".history", "settings.json"), "utf8")) as { enabled: boolean; maxVersions: number };
  expect(policy).toMatchObject({ enabled: false, maxVersions: 5 });
  await settings.getByRole("button", { name: "Done", exact: true }).click();
  const history = await openHistory(page);
  await page.route(`**/api/history/projects/${id}`, route => route.request().method() === "POST" ? route.fulfill({ status: 503, contentType: "application/json", body: '{}' }) : route.continue());
  await history.getByRole("button", { name: "Save checkpoint", exact: true }).click();
  await expect(history.getByRole("alert")).toContainText("The checkpoint could not be saved");
  await page.unroute(`**/api/history/projects/${id}`);
  await history.getByRole("textbox", { name: "Checkpoint name (optional)", exact: true }).fill("Retry succeeds");
  await history.getByRole("button", { name: "Save checkpoint", exact: true }).click();
  await expect(history.getByRole("button", { name: /^Retry succeeds/ })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await history.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
});
