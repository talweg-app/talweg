import { test, expect } from "@playwright/test";
import { createStarterTemplate } from "../apps/web/src/utils/templateCatalog.js";
import { createSceneDoc, serializeTalwegFile } from "../packages/storage/src/index.js";
import AxeBuilder from "@axe-core/playwright";

for (const theme of ["dark", "light"]) test(`theme and language menus are styled, keyboard accessible and fit the viewport in ${theme}`, async ({ page }) => {
  await page.goto("/");
  const appearance = page.getByRole("combobox", { name: "Appearance", exact: true });
  await appearance.selectOption(theme);
  await appearance.click();
  const menu = page.getByRole("listbox", { name: "Appearance", exact: true });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("option", { name: theme === "dark" ? "Dark" : "Light", exact: true })).toHaveAttribute("aria-selected", "true");
  await page.screenshot({ path: test.info().outputPath(`menu-${theme}.png`), animations: "disabled" });
  const menuBounds = await menu.boundingBox(), triggerBounds = await appearance.boundingBox();
  if (!menuBounds || !triggerBounds) throw new Error("Missing menu geometry");
  const left = Math.max(0, Math.min(menuBounds.x, triggerBounds.x) - 8);
  const top = Math.max(0, triggerBounds.y - 8);
  await page.screenshot({ path: test.info().outputPath(`controls-${theme}.png`), animations: "disabled", clip: { x: left, y: top, width: Math.max(menuBounds.x + menuBounds.width, triggerBounds.x + triggerBounds.width) - left + 8, height: menuBounds.y + menuBounds.height - top + 8 } });
  const axe = await new AxeBuilder({ page }).include(".choice-menu").analyze();
  expect(axe.violations).toEqual([]);
  await appearance.press("Home");
  await appearance.press("Enter");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(menu).toBeHidden();
  const language = page.getByRole("combobox", { name: "Language / Язык", exact: true });
  await language.click();
  await page.getByRole("listbox", { name: "Language / Язык", exact: true }).getByRole("option", { name: "Русский", exact: true }).click();
  await expect(language).toHaveValue("ru");
  await page.setViewportSize({ width: 390, height: 844 });
  await language.click();
  const languages = page.getByRole("listbox", { name: "Language / Язык", exact: true });
  const bounds = await languages.boundingBox();
  if (!bounds) throw new Error("Missing choice menu");
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
  await language.press("Escape");
  await expect(languages).toBeHidden();
  await expect(language).toBeFocused();
});

test("tidy preserves roadmap columns, previews without saving, and supports undo", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Browse all 12 templates", exact: true }).click();
  await page.getByRole("button", { name: /Now, next, later/ }).click();
  await expect(page.locator(".canvas-document-title")).toHaveValue("Now, next, later");
  await page.getByTestId("canvas").click({ position: { x: 20, y: 20 } });
  await page.keyboard.press("ControlOrMeta+a");
  const cards = page.getByTestId("canvas-node").filter({ has: page.locator(".node-card") });
  const positions = () => cards.evaluateAll(elements => elements.map(element => { const m = new DOMMatrix(getComputedStyle(element).transform); return { x: m.e, y: m.f }; }));
  const before = await positions();
  const tidy = page.getByRole("button", { name: "Tidy selection", exact: true });
  await tidy.hover();
  await expect.poll(async () => new Set((await positions()).map(point => point.y)).size).toBe(3);
  await tidy.click();
  expect(new Set((await positions()).map(point => point.x)).size).toBe(3);
  expect(new Set((await positions()).map(point => point.y)).size).toBe(3);
  await page.screenshot({ path: test.info().outputPath("roadmap-tidy.png"), animations: "disabled" });
  await page.keyboard.press("ControlOrMeta+z");
  expect(await positions()).toEqual(before);
  await page.getByTestId("canvas").click({ position: { x: 20, y: 20 } });
  await page.keyboard.press("ControlOrMeta+a");
  await cards.first().click({ button: "right", position: { x: 8, y: 8 } });
  await page.getByRole("combobox", { name: "Align selection", exact: true }).click();
  await page.getByRole("listbox", { name: "Align selection", exact: true }).getByRole("option", { name: "Align left", exact: true }).click();
  await expect.poll(async () => new Set((await positions()).map(point => point.x)).size).toBe(1);
});

test("template notes display complete readable text and open in reading mode", async ({ page }) => {
  const document = createStarterTemplate("roadmap");
  for (const node of Object.values(document.nodes)) if (node.type === "markdown") node.height = 180;
  const scene = createSceneDoc(document);
  const content = serializeTalwegFile(document, scene); scene.destroy();
  await page.addInitScript(() => { delete (window as Window & { showOpenFilePicker?: unknown }).showOpenFilePicker; });
  await page.goto("/");
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Open from Computer", exact: true }).click();
  await (await chooser).setFiles({ name: "legacy-note.talweg", mimeType: "application/json", buffer: Buffer.from(content) });
  await page.getByRole("tab", { name: "Working example", exact: true }).click();
  const note = page.getByTestId("canvas-node").filter({ hasText: "Why this order?" });
  const preview = note.locator(".canvas-note-preview");
  await expect(preview).toContainText("not just because a date arrived");
  const before = await page.getByTestId("canvas-world").getAttribute("style");
  await preview.hover();
  await page.mouse.wheel(0, 200);
  await expect.poll(() => preview.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
  expect(await page.getByTestId("canvas-world").getAttribute("style")).toBe(before);
  await note.getByRole("button", { name: "Open note", exact: true }).click();
  const reader = page.getByRole("dialog", { name: "Node note", exact: true });
  await expect(reader.getByRole("tab", { name: "Preview", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(reader.locator(".markdown-preview")).toContainText("not just because a date arrived");
  await expect(reader.getByLabel("Markdown text", { exact: true })).toHaveCount(0);
  await page.screenshot({ path: test.info().outputPath("note-reader.png"), animations: "disabled" });
});

test("all new templates render readable notes on every page", async ({ page }) => {
  test.setTimeout(60000);
  await page.goto("/");
  for (const title of ["Project kickoff", "Research map", "Math lesson", "Team retrospective", "Decision tree", "Weekly focus", "Now, next, later", "SWOT workshop", "Incident review"]) {
    await page.getByRole("button", { name: "Browse all 12 templates", exact: true }).click();
    await page.getByRole("dialog", { name: "Template library", exact: true }).getByRole("button", { name: new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) }).click();
    await expect(page.locator(".canvas-document-title")).toHaveValue(title);
    const tabs = page.getByRole("tablist", { name: "Pages", exact: true }).getByRole("tab");
    for (let index = 0; index < await tabs.count(); index++) {
      await tabs.nth(index).click();
      for (const preview of await page.locator(".canvas-note-preview").all()) {
        await expect(preview).toHaveText(/\S/);
        await expect(preview).not.toContainText("Open to add a note");
        expect(await preview.innerText()).not.toMatch(/(^|\n)#{1,6}\s/);
      }
    }
    await page.getByRole("button", { name: "Talweg", exact: true }).click();
  }
});
