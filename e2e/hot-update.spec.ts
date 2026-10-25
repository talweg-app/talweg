import { test, expect } from "@playwright/test";
import { mkdtemp, rm } from "node:fs/promises";
import { resolve, join } from "node:path";
import { createServer, type ViteDevServer } from "../apps/web/node_modules/vite/dist/node/index.js";

test.describe.configure({ mode: "serial" });

let server: ViteDevServer;
let cache: string;
let address: string;
const previousStorageMode = process.env.TALWEG_BROWSER_STORAGE_ONLY;
const providerPath = resolve("apps/web/src/i18n.tsx");

test.beforeAll(async () => {
  process.env.TALWEG_BROWSER_STORAGE_ONLY = "1";
  cache = await mkdtemp(join(resolve("apps/web/node_modules"), ".vite-hmr-test-"));
  server = await createServer({
    root: resolve("apps/web"),
    configFile: resolve("apps/web/vite.config.ts"),
    cacheDir: cache,
    logLevel: "error",
    server: { port: 5197, strictPort: true, host: "127.0.0.1" },
    plugins: [{
      name: "test-hmr-observer",
      transform(code, id) {
        if (id === resolve("apps/web/src/App.tsx")) return {
          code: code.replace("export function App() {", "export function App() { if (document.documentElement.dataset.testRenderFailure === 'true') throw new Error('Test render failure');"),
          map: null,
        };
        if (id !== providerPath) return;
        return { code: `${code}\nrequestAnimationFrame(() => requestAnimationFrame(() => window.__talwegHmrProbe?.()));`, map: null };
      },
    }],
  });
  await server.listen();
  address = "http://127.0.0.1:5197";
});

test.afterAll(async () => {
  if (previousStorageMode === undefined) delete process.env.TALWEG_BROWSER_STORAGE_ONLY; else process.env.TALWEG_BROWSER_STORAGE_ONLY = previousStorageMode;
  await server?.close();
  if (cache) await rm(cache, { recursive: true, force: true });
});

test("hot updates preserve the canvas, language and edits without remount errors", async ({ page }) => {
  const errors: string[] = [];
  let evaluations = 0;
  let loads = 0;
  page.on("load", () => { loads += 1; });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.exposeFunction("__talwegHmrProbe", () => { evaluations += 1; });
  await page.goto(address);
  await page.getByRole("button", { name: /^Blank Canvas/ }).click();
  await page.locator(".canvas-document-title").fill("HMR retained board");
  await page.getByRole("combobox", { name: "Language / Язык", exact: true }).selectOption("ru");
  await page.getByRole("button", { name: "Добавить на холст", exact: true }).click();
  await page.getByRole("dialog", { name: "Добавить на холст", exact: true }).getByRole("button", { name: "Прямоугольник", exact: true }).click();
  const node = page.getByTestId("canvas-node");
  await node.dblclick({ position: { x: 60, y: 30 } });
  const editor = node.getByRole("textbox");
  await editor.fill("Правки остаются на доске");
  await editor.press("Escape");

  const initialLoads = loads;
  for (let update = 0; update < 3; update++) {
    const previous = evaluations;
    const paths = update === 0 ? [providerPath] : [resolve("apps/web/src/locales/en.json"), resolve("apps/web/src/locales/ru.json")];
    const modules = paths.map((path) => server.moduleGraph.getModuleById(path));
    for (const module of modules) {
      if (!module) throw new Error("Translation module has not loaded");
      await server.reloadModule(module);
    }
    await expect.poll(() => evaluations).toBeGreaterThan(previous);
    expect(errors).toEqual([]);
    expect(loads).toBe(initialLoads);
    await expect(page.getByTestId("canvas")).toBeVisible();
    await expect(node).toContainText("Правки остаются на доске");
    await expect(page.getByRole("combobox", { name: "Language / Язык", exact: true })).toHaveValue("ru");
  }
  await page.getByRole("button", { name: "Talweg", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Мысли обретают форму.", exact: true })).toBeVisible();
  await page.locator(".workspace-board").filter({ hasText: "HMR retained board" }).click();
  await expect(node).toContainText("Правки остаются на доске");
  expect(errors).toEqual([]);
});


test("a render failure offers recovery and reopening retains the board", async ({ page }) => {
  await page.goto(address);
  await page.getByRole("button", { name: /^Blank Canvas/ }).click();
  await page.locator(".canvas-document-title").fill("Recovery retained board");
  await page.evaluate(() => { document.documentElement.dataset.testRenderFailure = "true"; });
  const app = server.moduleGraph.getModuleById(resolve("apps/web/src/App.tsx"));
  if (!app) throw new Error("App has not loaded");
  await server.reloadModule(app);
  await expect(page.getByRole("alert")).toContainText("The board could not be displayed");
  await page.getByRole("button", { name: "Reload board", exact: true }).click();
  await expect(page.getByTestId("canvas")).toBeVisible();
  await expect(page.locator(".canvas-document-title")).toHaveValue("Recovery retained board");
  await expect(page.getByRole("alert")).toHaveCount(0);
});
