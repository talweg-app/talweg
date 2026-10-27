import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function openLibrary(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Browse all 12 templates", exact: true }).click();
  const library = page.getByRole("dialog", { name: "Template library", exact: true });
  await expect(library).toBeVisible();
  return library;
}

test("template library filters, searches, restores focus and opens a lesson with independent pages", async ({ page }) => {
  await page.goto("/");
  let library = await openLibrary(page);
  await expect(library.locator(".template-library-card")).toHaveCount(12);
  await expect(library.getByRole("searchbox")).toBeFocused();
  await page.screenshot({ path: test.info().outputPath("template-library.png"), animations: "disabled" });
  await library.getByRole("button", { name: "Learning", exact: true }).click();
  await expect(library.locator(".template-library-card")).toHaveCount(1);
  await library.getByRole("searchbox").fill("no such template");
  await expect(library.getByText("No templates match your search.", { exact: true })).toBeVisible();
  await library.getByRole("button", { name: "Clear filters", exact: true }).click();
  await expect(library.locator(".template-library-card")).toHaveCount(12);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Browse all 12 templates", exact: true })).toBeFocused();
  library = await openLibrary(page);
  await library.getByRole("searchbox").fill("math");
  await library.getByRole("button", { name: /Math lesson/ }).click();
  await expect(page.locator(".canvas-document-title")).toHaveValue("Math lesson");
  await expect(page.getByRole("tab", { name: "Lesson", exact: true })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Practice", exact: true })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Solutions", exact: true })).toBeVisible();
  await expect(page.getByTestId("canvas-node").filter({ hasText: "Formula and explanation" }).locator(".katex")).not.toHaveCount(0);
  await expect(page.getByText("Pythagorean theorem", { exact: true })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("math-lesson.png"), animations: "disabled" });
  const solutionsLink = page.getByRole("link", { name: "Solutions", exact: true });
  const preview = page.getByTestId("canvas-node").filter({ hasText: "Formula and explanation" }).locator(".canvas-note-preview");
  await expect.poll(async () => {
    const linkBounds = await solutionsLink.boundingBox(), previewBounds = await preview.boundingBox();
    return !!linkBounds && !!previewBounds && linkBounds.y + linkBounds.height <= previewBounds.y + previewBounds.height + 1;
  }).toBe(true);
  await solutionsLink.click();
  await expect(page.getByRole("tab", { name: "Solutions", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("link", { name: "Back to practice", exact: true })).toHaveCount(4);
  await page.screenshot({ path: test.info().outputPath("math-solutions.png"), animations: "disabled" });
  await page.getByRole("tab", { name: "Practice", exact: true }).click();
  await expect(page.getByText("Pythagorean theorem", { exact: true })).toBeHidden();
  await expect(page.getByText(/Try it: a = 5/)).toBeVisible();
  await page.getByRole("tab", { name: "Lesson", exact: true }).click();
  await page.getByTestId("canvas-node").filter({ hasText: "Formula and explanation" }).getByRole("button").click();
  await expect(page.locator(".note-editor")).toBeVisible();
  await page.getByRole("tab", { name: "Preview", exact: true }).click();
  await expect(page.locator(".note-editor .katex")).not.toHaveCount(0);
});

test("browsing and unchanged templates stay out of recents; edited copies are independent", async ({ page }) => {
  await page.goto("/");
  let library = await openLibrary(page);
  await library.getByRole("button", { name: /Weekly focus/ }).click();
  await expect(page.locator(".canvas-document-title")).toHaveValue("Weekly focus");
  await expect(page.getByText("Capture new requests here before adding them to a full day.", { exact: true })).toBeVisible();
  for (const list of await page.locator(".checklist-items").all()) expect(await list.evaluate(element => element.scrollHeight <= element.clientHeight + 1)).toBe(true);
  await page.screenshot({ path: test.info().outputPath("weekly-focus.png"), animations: "disabled" });
  await page.getByRole("button", { name: "Talweg", exact: true }).click();
  await expect(page.locator(".workspace-recents .workspace-board")).toHaveCount(0);
  library = await openLibrary(page);
  await library.getByRole("button", { name: /Weekly focus/ }).click();
  await expect(page.locator(".canvas-document-title")).toHaveValue("Weekly focus");
  const firstId = new URL(page.url()).pathname;
  const task = page.getByRole("textbox", { name: "Task", exact: true }).first();
  await task.fill("Read chapter three");
  await task.press("Tab");
  await page.getByRole("button", { name: "Talweg", exact: true }).click();
  await expect(page.locator(".workspace-recents .workspace-board")).toHaveCount(1);
  library = await openLibrary(page);
  await library.getByRole("button", { name: /Weekly focus/ }).click();
  await expect(page.locator(".canvas-document-title")).toHaveValue("Weekly focus");
  expect(new URL(page.url()).pathname).not.toBe(firstId);
  await expect(page.getByText("Read chapter three", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Choose one project", { exact: true })).toHaveCount(1);
  await page.getByRole("button", { name: "Talweg", exact: true }).click();
  await page.getByRole("combobox", { name: "Language / Язык", exact: true }).selectOption("ru");
  await page.getByRole("button", { name: "Все 12 шаблонов", exact: true }).click();
  await page.getByRole("button", { name: /Фокус на неделю/ }).click();
  await expect(page.getByRole("textbox", { name: "Задача", exact: true })).toHaveCount(20);
  for (const list of await page.locator(".checklist-items").all()) expect(await list.evaluate(element => element.scrollHeight <= element.clientHeight + 1)).toBe(true);
});

for (const theme of ["dark", "light"]) test(`template library fits a scaled phone and passes accessibility checks in ${theme}`, async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const settings = page.getByRole("dialog", { name: "Settings", exact: true });
  await settings.getByRole("slider", { name: "Interface scale", exact: true }).fill("150");
  await settings.getByRole("combobox", { name: "Appearance", exact: true }).selectOption(theme);
  await settings.getByRole("button", { name: "Done", exact: true }).click();
  const library = await openLibrary(page);
  const bounds = await library.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0); expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(391);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(845);
  expect(await library.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  const result = await new AxeBuilder({ page }).include(".template-library").withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(result.violations).toEqual([]);
  await page.keyboard.press("Escape");
  await page.getByRole("combobox", { name: "Language / Язык", exact: true }).selectOption("ru");
  await page.getByRole("button", { name: "Все 12 шаблонов", exact: true }).click();
  await page.getByRole("button", { name: "Обучение", exact: true }).click();
  await page.getByRole("button", { name: /Урок математики/ }).click();
  await expect(page.locator(".canvas-document-title")).toHaveValue("Урок математики");
  await expect(page.getByRole("tab", { name: "Практика", exact: true })).toBeVisible();
});

test("Markdown preview links remain clickable after middle-button and Space panning", async ({ page, context }) => {
  await page.goto("/");
  const library = await openLibrary(page);
  await library.getByRole("button", { name: /Math lesson/ }).click();
  const link = page.getByRole("link", { name: "Solutions", exact: true });
  await expect(link).toBeVisible();
  const board = new URL(page.url()).pathname;
  for (const button of ["middle", "left"] as const) {
    const bounds = await link.boundingBox();
    if (!bounds) throw new Error("Missing preview link");
    const previousCamera = new URL(page.url()).hash;
    if (button === "left") await page.keyboard.down("Space");
    await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    await page.mouse.down({ button });
    await page.mouse.move(bounds.x + bounds.width / 2 + 40, bounds.y + bounds.height / 2 + 25, { steps: 4 });
    await page.mouse.up({ button });
    if (button === "left") await page.keyboard.up("Space");
    await expect.poll(() => new URL(page.url()).hash).not.toBe(previousCamera);
    expect(new URL(page.url()).pathname).toBe(board);
    expect(context.pages()).toHaveLength(1);
  }
  await link.click();
  await expect(page.getByRole("tab", { name: "Solutions", exact: true })).toHaveAttribute("aria-selected", "true");
});
