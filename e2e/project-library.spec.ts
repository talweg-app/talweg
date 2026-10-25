import { test, expect, type BrowserContext } from "@playwright/test";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createServer, type ViteDevServer } from "../apps/web/node_modules/vite/dist/node/index.js";
import { createBlankCanvas } from "../apps/web/src/utils/starterTemplates.js";
import { createSceneDoc, applyDocumentToYDoc, serializeTalwegFile } from "../packages/storage/src/index.js";

test.describe.configure({ mode: "serial" });
let server: ViteDevServer;
let directory: string;
let cache: string;
const previousDirectory = process.env.TALWEG_PROJECTS_DIR;
async function start() {
  process.env.TALWEG_PROJECTS_DIR = directory;
  server = await createServer({ root: resolve("apps/web"), configFile: resolve("apps/web/vite.config.ts"), cacheDir: cache, logLevel: "error", server: { port: 5198, strictPort: true, host: "127.0.0.1" } });
  await server.listen();
}
test.beforeAll(async () => { directory = await mkdtemp(join(tmpdir(), "talweg-project-e2e-")); cache = await mkdtemp(join(resolve("apps/web/node_modules"), ".vite-library-test-")); await start(); });
test.afterAll(async () => { await server?.close(); await rm(directory, { recursive: true, force: true }); await rm(cache, { recursive: true, force: true }); if (previousDirectory === undefined) delete process.env.TALWEG_PROJECTS_DIR; else process.env.TALWEG_PROJECTS_DIR = previousDirectory; });

test("projects and photos survive a server restart and load in an independent browser origin", async ({ browser }) => {
  test.setTimeout(60000);
  const first = await browser.newContext({ baseURL: "http://127.0.0.1:5198" });
  let second: BrowserContext | undefined;
  try {
    const page = await first.newPage();
    await page.goto("/");
    await expect(page.getByText(directory, { exact: true })).toBeVisible();
    await page.locator(".workspace-templates").getByRole("button", { name: /^Blank Canvas/ }).click();
    await page.getByRole("textbox", { name: "Untitled Canvas", exact: true }).fill("Disk library check");
    await page.getByRole("button", { name: "Add to canvas", exact: true }).click();
    await page.getByRole("dialog", { name: "Add to canvas", exact: true }).getByRole("button", { name: "Rectangle", exact: true }).click();
    const node = page.getByTestId("canvas-node").first();
    await node.dblclick();
    await node.getByRole("textbox", { name: "Label", exact: true }).fill("Survives a restart");
    await node.getByRole("textbox", { name: "Label", exact: true }).press("Escape");
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Add to canvas", exact: true }).click();
    await page.getByRole("dialog", { name: "Add to canvas", exact: true }).getByRole("button", { name: "Image", exact: true }).click();
    await (await chooser).setFiles({ name: "photo.svg", mimeType: "image/svg+xml", buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#8caecc"/></svg>') });
    await expect(page.getByRole("group", { name: "Image", exact: true }).getByRole("img")).toBeVisible();
    await expect(page.getByRole("status")).toHaveText("Saved to projects folder");
    const id = new URL(page.url()).pathname.split("/")[2];
    if (!id) throw new Error("Missing project route");
    const disk = JSON.parse(await readFile(join(directory, `${id}.talweg`), "utf8")) as { assets: Record<string, unknown> };
    expect(Object.keys(disk.assets)).toHaveLength(1);
    await server.close(); await start();
    second = await browser.newContext({ baseURL: "http://localhost:5198" });
    const other = await second.newPage();
    await other.goto("/");
    await other.getByRole("button", { name: /^Disk library check/ }).click();
    await expect(other.getByText("Survives a restart", { exact: true })).toBeVisible();
    await expect(other.getByRole("group", { name: "Image", exact: true }).getByRole("img")).toBeVisible();
    const response = await other.request.put(`/api/projects/${id}`, { headers: { Origin: "https://example.com" }, data: disk });
    expect(response.status()).toBe(403);
  } finally { await first.close(); await second?.close(); }
});

test("files copied into the projects folder appear without import and damaged files remain untouched", async ({ page }) => {
  const doc = createBlankCanvas("doc-dropped-file"); doc.name = "Dropped file";
  const scene = createSceneDoc(); applyDocumentToYDoc(doc, scene);
  try { await writeFile(join(directory, "A project from another computer.talweg"), serializeTalwegFile(doc, scene)); }
  finally { scene.destroy(); }
  await writeFile(join(directory, "Damaged file.talweg"), "original damaged data");
  await page.goto("http://127.0.0.1:5198/");
  await expect(page.getByRole("alert")).toContainText("Damaged file.talweg");
  await page.getByRole("button", { name: /^Dropped file/ }).click();
  await expect(page.getByTestId("canvas")).toBeVisible();
  expect(await readFile(join(directory, "Damaged file.talweg"), "utf8")).toBe("original damaged data");
  await expect(page.getByRole("status")).toHaveText("Saved to projects folder");
  await page.goto("http://127.0.0.1:5198/board/doc-unknown");
  await expect(page.getByRole("alert")).toContainText("This project could not be opened");
  await rm(join(directory, "A project from another computer.talweg"));
  await page.goto("http://127.0.0.1:5198/");
  await expect(page.getByRole("button", { name: /^Dropped file/ })).toHaveCount(0);
  await expect(readFile(join(directory, "A project from another computer.talweg"))).rejects.toMatchObject({ code: "ENOENT" });
});

test("a failed disk write keeps a browser copy and retries when the folder becomes available", async ({ browser }) => {
  const context = await browser.newContext({ baseURL: "http://127.0.0.1:5198" });
  try {
    const page = await context.newPage(); await page.goto("/");
    await page.route("**/api/projects/*", route => route.request().method() === "PUT" ? route.fulfill({ status: 503, contentType: "application/json", body: '{}' }) : route.continue());
    await page.locator(".workspace-templates").getByRole("button", { name: /^Blank Canvas/ }).click();
    await page.getByRole("textbox", { name: "Untitled Canvas", exact: true }).fill("Retry this file");
    await expect(page.getByRole("status")).toHaveText("Browser copy saved; projects folder needs a retry");
    await page.unroute("**/api/projects/*");
    await expect(page.getByRole("status")).toHaveText("Saved to projects folder", { timeout: 10000 });
    await page.reload();
    await expect(page.getByRole("textbox", { name: "Untitled Canvas", exact: true })).toHaveValue("Retry this file");
    await page.route("**/api/projects/*", route => route.request().method() === "PUT" ? route.fulfill({ status: 503, contentType: "application/json", body: '{}' }) : route.continue());
    await page.getByRole("textbox", { name: "Untitled Canvas", exact: true }).fill("Recovered browser changes");
    await expect(page.getByRole("status")).toHaveText("Browser copy saved; projects folder needs a retry");
    await page.reload();
    await expect(page.getByRole("textbox", { name: "Untitled Canvas", exact: true })).toHaveValue("Recovered browser changes");
    await page.unroute("**/api/projects/*");
    await expect(page.getByRole("status")).toHaveText("Saved to projects folder", { timeout: 10000 });
    const id = new URL(page.url()).pathname.split("/")[2];
    const saved = JSON.parse(await readFile(join(directory, `${id}.talweg`), "utf8")) as { metadata: { title: string } };
    expect(saved.metadata.title).toBe("Recovered browser changes");
  } finally { await context.close(); }
});

test("hide preserves the file; confirmed deletion removes it and stale browsers cannot restore it", async ({ browser }) => {
  const first = await browser.newContext({ baseURL: "http://127.0.0.1:5198" });
  const second = await browser.newContext({ baseURL: "http://localhost:5198" });
  try {
    const page = await first.newPage();
    await page.goto("/");
    await page.locator(".workspace-templates").getByRole("button", { name: /^Blank Canvas/ }).click();
    await page.locator(".canvas-document-title").fill("Delete this board");
    await expect(page.getByRole("status")).toHaveText("Saved to projects folder");
    const id = new URL(page.url()).pathname.split("/")[2];
    const filename = join(directory, `${id}.talweg`);
    const stale = await readFile(filename, "utf8");
    const other = await second.newPage();
    await other.goto("/");
    await expect(other.getByRole("button", { name: /^Delete this board 0/ })).toBeVisible();
    await page.getByRole("button", { name: "Talweg", exact: true }).click();
    await page.getByRole("button", { name: "Hide board Delete this board", exact: true }).click();
    await expect(page.getByRole("button", { name: /^Delete this board 0/ })).toHaveCount(0);
    expect(await readFile(filename, "utf8")).toBe(stale);
    await page.getByRole("button", { name: /^Hidden boards/ }).click();
    await page.getByRole("button", { name: "Restore board Delete this board", exact: true }).click();
    await page.getByRole("button", { name: "Working boards", exact: true }).click();
    page.once("dialog", dialog => dialog.dismiss());
    await page.getByRole("button", { name: "Delete board Delete this board", exact: true }).click();
    await expect(page.getByRole("button", { name: /^Delete this board 0/ })).toBeVisible();
    await page.route("**/api/projects/*", route => route.request().method() === "DELETE" ? route.fulfill({ status: 503 }) : route.continue());
    page.once("dialog", dialog => dialog.accept());
    await page.getByRole("button", { name: "Delete board Delete this board", exact: true }).click();
    await expect(page.getByRole("alert").filter({ hasText: "The project could not be deleted" })).toBeVisible();
    expect(await readFile(filename, "utf8")).toBe(stale);
    await page.unroute("**/api/projects/*");
    page.once("dialog", dialog => dialog.accept());
    await page.getByRole("button", { name: "Delete board Delete this board", exact: true }).click();
    await expect(page.getByRole("button", { name: /^Delete this board 0/ })).toHaveCount(0);
    await expect(readFile(filename)).rejects.toMatchObject({ code: "ENOENT" });
    await page.reload(); await other.reload();
    await expect(page.getByRole("button", { name: /^Delete this board 0/ })).toHaveCount(0);
    await expect(other.getByRole("button", { name: /^Delete this board 0/ })).toHaveCount(0);
    const response = await other.request.put(`/api/projects/${id}`, { headers: { "Content-Type": "application/json" }, data: stale });
    expect(response.ok()).toBe(false);
    await other.goto(`/board/${id}`);
    await expect(other.getByRole("alert")).toContainText("This project could not be opened");
    await expect(readFile(filename)).rejects.toMatchObject({ code: "ENOENT" });
  } finally { await first.close(); await second.close(); }
});
