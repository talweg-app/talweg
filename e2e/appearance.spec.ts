import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { contrastRatio } from "../apps/web/src/utils/colorContrast.js";

async function blank(page: Page) {
  await page.goto("/");
  await page.locator(".workspace-templates").getByRole("button", { name: /^Blank Canvas/ }).click();
  await expect(page.getByTestId("canvas")).toBeVisible();
}
async function insert(page: Page, name: string) {
  await page.getByRole("button", { name: "Add to canvas", exact: true }).click();
  await page.getByRole("dialog", { name: "Add to canvas", exact: true }).getByRole("button", { name, exact: true }).click();
  return page.getByTestId("canvas-node").last();
}

test("system appearance follows the OS and an explicit choice persists across screens, tabs and reloads", async ({ page, context }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  const appearance = page.getByRole("combobox", { name: "Appearance", exact: true });
  await expect(appearance).toHaveValue("system");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await appearance.selectOption("light");
  await blank(page);
  await expect(page.getByTestId("canvas")).toHaveCSS("background-color", "rgb(247, 247, 244)");
  await page.getByRole("button", { name: "Canvas settings", exact: true }).click();
  const selectedMode = page.getByTestId("mode-picker-menu").getByText("Whiteboard", { exact: true });
  expect(contrastRatio(await selectedMode.evaluate(element => getComputedStyle(element).color), "#ffffff")).toBeGreaterThanOrEqual(4.5);
  await page.getByRole("button", { name: "Canvas settings", exact: true }).click();
  const node = await insert(page, "Rectangle");
  await expect(node.getByTestId("node-surface")).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await page.reload();
  await expect(appearance).toHaveValue("light");
  await expect(node.getByTestId("node-surface")).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await page.getByRole("button", { name: "Talweg", exact: true }).click();
  await expect(appearance).toHaveValue("light");
  const secondTab = await context.newPage();
  await secondTab.goto("/");
  await secondTab.getByRole("combobox", { name: "Appearance", exact: true }).selectOption("dark");
  await expect(appearance).toHaveValue("dark");
  await secondTab.close();
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    for (const control of [appearance, page.getByRole("combobox", { name: "Language / Язык", exact: true }), page.getByRole("button", { name: "Open from Computer", exact: true })]) {
      await expect(control).toBeVisible();
      const box = await control.boundingBox();
      expect(box).not.toBeNull();
      if (box) { expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(width); }
    }
  }
});

test("text blocks stay legible on white fills, align in both directions and export the same placement", async ({ page }) => {
  await blank(page);
  const node = await insert(page, "Text");
  await node.dblclick();
  const editor = node.getByRole("textbox", { name: "Text", exact: true });
  await editor.fill("Readable text");
  await editor.press("Escape");
  await node.click({ button: "right" });
  const inspector = page.getByRole("dialog", { name: "Appearance", exact: true });
  await inspector.getByRole("button", { name: "Fill #eeeeeb", exact: true }).click();
  await inspector.getByRole("button", { name: "Align center", exact: true }).click();
  await inspector.getByRole("button", { name: "Middle", exact: true }).click();
  await expect(node.locator(".node-text")).toHaveCSS("align-items", "center");
  await expect(node.locator(".rich-text")).toHaveCSS("text-align", "center");
  await expect(node.locator(".rich-text")).toHaveCSS("color", "rgb(32, 34, 35)");
  await page.keyboard.press("Escape");
  const box = await node.boundingBox();
  const text = await node.locator(".rich-text").boundingBox();
  expect(box).not.toBeNull(); expect(text).not.toBeNull();
  if (box && text) expect(Math.abs(text.y + text.height / 2 - box.y - box.height / 2)).toBeLessThan(1);
  await page.reload();
  await expect(node.locator(".node-text")).toHaveCSS("align-items", "center");
  await page.getByRole("combobox", { name: "Appearance", exact: true }).selectOption("light");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PNG", exact: true }).click();
  const path = test.info().outputPath("light-text.png");
  await (await download).saveAs(path);
  const pixels = await page.evaluate(async base64 => {
    const image = new Image(); image.src = `data:image/png;base64,${base64}`; await image.decode();
    const canvas = document.createElement("canvas"); canvas.width = image.width; canvas.height = image.height;
    const context = canvas.getContext("2d"); if (!context) throw new Error("Canvas is unavailable");
    context.drawImage(image, 0, 0);
    const data = context.getImageData(120, 120, 400, 160).data;
    const rows: number[] = [];
    for (let y = 0; y < 160; y++) for (let x = 0; x < 400; x++) {
      const offset = (y * 400 + x) * 4;
      if ((data[offset] ?? 255) < 80 && (data[offset + 1] ?? 255) < 80 && (data[offset + 2] ?? 255) < 80) rows.push(y);
    }
    return { corner: Array.from(context.getImageData(4, 4, 1, 1).data), min: Math.min(...rows), max: Math.max(...rows) };
  }, (await readFile(path)).toString("base64"));
  expect(pixels.corner).toEqual([247, 247, 244, 255]);
  expect(pixels.min).toBeGreaterThan(35); expect(pixels.max).toBeLessThan(120);
  expect(Math.abs((pixels.min + pixels.max) / 2 - 80)).toBeLessThan(12);
});

test("changing a fill adjusts fragment contrast without losing its original colour or formatting", async ({ page }) => {
  await blank(page);
  const node = await insert(page, "Rectangle");
  await node.dblclick();
  const editor = node.getByRole("textbox", { name: "Label", exact: true });
  await editor.fill("Alpha beta gamma");
  await editor.press("Home");
  for (let index = 0; index < 6; index++) await editor.press("ArrowRight");
  for (let index = 0; index < 4; index++) await editor.press("Shift+ArrowRight");
  await page.getByRole("button", { name: "Bold", exact: true }).click();
  await page.getByRole("button", { name: "Selection color #cb8584", exact: true }).click();
  await editor.press("Escape");
  await node.click({ button: "right" });
  const inspector = page.getByRole("dialog", { name: "Appearance", exact: true });
  await inspector.getByRole("button", { name: "Fill #eeeeeb", exact: true }).click();
  const word = node.getByText("beta", { exact: true });
  const color = await word.evaluate(element => getComputedStyle(element).color);
  expect(contrastRatio(color, "#eeeeeb")).toBeGreaterThanOrEqual(4.5);
  await expect(word).toHaveAttribute("data-text-color", "#cb8584");
  await expect(word).toHaveCSS("font-weight", "700");
  await page.reload();
  await expect(word).toHaveCSS("color", color);
  await node.click({ button: "right" });
  await inspector.getByRole("button", { name: "Fill #242729", exact: true }).click();
  await expect(word).toHaveCSS("color", "rgb(203, 133, 132)");
});

test("a table cell keeps readable fragments and does not change neighbouring cell fills", async ({ page }) => {
  await blank(page);
  const node = await insert(page, "Table");
  const cell = node.getByLabel("Cell 1, 1", { exact: true });
  await cell.fill("Owner");
  await cell.press("Control+a");
  await page.getByRole("button", { name: "Selection color #8caecc", exact: true }).click();
  await expect(cell).toContainText("Owner");
  await cell.press("Escape");
  await expect(page.getByRole("toolbar", { name: "Selected text formatting", exact: true })).toBeHidden();
  await cell.click({ button: "right" });
  const inspector = page.getByRole("dialog", { name: "Appearance", exact: true });
  await inspector.getByRole("button", { name: "Fill #eeeeeb", exact: true }).click();
  const word = cell.getByText("Owner", { exact: true });
  expect(contrastRatio(await word.evaluate(element => getComputedStyle(element).color), "#eeeeeb")).toBeGreaterThanOrEqual(4.5);
  await expect(node.locator('[data-table-cell="0:1"]')).not.toHaveCSS("background-color", "rgb(238, 238, 235)");
  await page.reload();
  expect(contrastRatio(await word.evaluate(element => getComputedStyle(element).color), "#eeeeeb")).toBeGreaterThanOrEqual(4.5);
  const pngDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PNG", exact: true }).click();
  const path = test.info().outputPath("table-cell.png");
  await (await pngDownload).saveAs(path);
  const sample = await page.evaluate(async base64 => {
    const image = new Image(); image.src = `data:image/png;base64,${base64}`; await image.decode();
    const canvas = document.createElement("canvas"); canvas.width = image.width; canvas.height = image.height;
    const context = canvas.getContext("2d"); if (!context) throw new Error("Canvas is unavailable");
    context.drawImage(image, 0, 0);
    return { filled: Array.from(context.getImageData(350, 180, 1, 1).data), next: Array.from(context.getImageData(450, 180, 1, 1).data) };
  }, (await readFile(path)).toString("base64"));
  expect(sample.filled).toEqual([238, 238, 235, 255]);
  expect(sample.next).toEqual([36, 39, 41, 255]);
});

test("appearance and file controls remain reachable on a narrow canvas", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await blank(page);
  for (const control of [
    page.getByRole("combobox", { name: "Appearance", exact: true }),
    page.getByRole("combobox", { name: "Language / Язык", exact: true }),
    page.getByRole("button", { name: "Save Document (Ctrl+S)", exact: true }),
    page.getByRole("button", { name: "Download PNG", exact: true }),
    page.getByRole("button", { name: "Canvas settings", exact: true }),
  ]) {
    const box = await control.boundingBox();
    expect(box).not.toBeNull();
    if (box) { expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(320); }
  }
  await page.getByRole("combobox", { name: "Appearance", exact: true }).selectOption("light");
  await expect(page.getByTestId("canvas")).toHaveCSS("background-color", "rgb(247, 247, 244)");
  await page.getByRole("button", { name: "Canvas settings", exact: true }).click();
  const menu = await page.getByTestId("mode-picker-menu").boundingBox();
  expect(menu).not.toBeNull();
  if (menu) { expect(menu.x).toBeGreaterThanOrEqual(0); expect(menu.x + menu.width).toBeLessThanOrEqual(320); }
});

test("starter diagrams adapt to paper, retain saved colours and export the light palette", async ({ page }) => {
  await page.addInitScript(() => { delete (window as Window & { showSaveFilePicker?: unknown }).showSaveFilePicker; });
  await page.goto("/");
  await page.locator(".workspace-templates").getByRole("button", { name: /^Microservices Architecture/ }).click();
  const gateway = page.getByTestId("canvas-node").filter({ hasText: "API Gateway" });
  const surface = gateway.getByTestId("node-surface");
  await expect(surface).toHaveCSS("background-color", "rgb(15, 20, 28)");
  const theme = page.getByRole("combobox", { name: "Appearance", exact: true });
  await theme.selectOption("light");
  await expect(surface).toHaveCSS("background-color", "rgb(240, 247, 250)");
  await expect(surface).toHaveCSS("border-color", "rgb(89, 134, 154)");
  await gateway.click({ button: "right" });
  await expect(page.getByRole("dialog", { name: "Appearance", exact: true }).getByRole("textbox", { name: "Fill", exact: true })).toHaveValue("#f0f7fa");
  await page.keyboard.press("Escape");
  await theme.selectOption("dark");
  await expect(surface).toHaveCSS("background-color", "rgb(15, 20, 28)");
  await expect(surface).toHaveCSS("border-color", "rgb(56, 189, 248)");
  await theme.selectOption("light");
  await page.reload();
  await expect(surface).toHaveCSS("background-color", "rgb(240, 247, 250)");
  const nativeDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save Document (Ctrl+S)", exact: true }).click();
  const nativePath = test.info().outputPath("original-colours.talweg");
  await (await nativeDownload).saveAs(nativePath);
  const saved = JSON.parse(await readFile(nativePath, "utf8")) as { sceneSnapshot: import("@talweg/core").CanvasDocument };
  const nodes = Object.values(saved.sceneSnapshot.nodes).filter(node => node.type !== "arrow");
  const gatewayData = nodes.find(node => node.type === "rectangle" && node.data.label.startsWith("API Gateway"));
  if (!gatewayData) throw new Error("The exported diagram is missing its gateway");
  expect(gatewayData.style.fillColor).toBe("#0f141c");
  expect(gatewayData.style.strokeColor).toBe("#38bdf8");
  const minX = Math.min(...nodes.map(node => node.x));
  const minY = Math.min(...nodes.map(node => node.y));
  const pngDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PNG", exact: true }).click();
  const pngPath = test.info().outputPath("paper-diagram.png");
  await (await pngDownload).saveAs(pngPath);
  const pixel = await page.evaluate(async ({ base64, x, y }) => {
    const image = new Image(); image.src = `data:image/png;base64,${base64}`; await image.decode();
    const canvas = document.createElement("canvas"); canvas.width = image.width; canvas.height = image.height;
    const context = canvas.getContext("2d"); if (!context) throw new Error("Canvas is unavailable");
    context.drawImage(image, 0, 0);
    return Array.from(context.getImageData(x, y, 1, 1).data);
  }, { base64: (await readFile(pngPath)).toString("base64"), x: 2 * (gatewayData.x - minX + 60 + gatewayData.width - 15), y: 2 * (gatewayData.y - minY + 75) });
  expect(pixel).toEqual([240, 247, 250, 255]);
});
