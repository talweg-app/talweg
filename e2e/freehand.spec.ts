import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

async function blank(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /^Blank Canvas/ }).click();
  await expect(page.getByTestId("canvas")).toBeVisible();
}
async function stroke(page: Page, x: number, y: number) {
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 80, y + 60, { steps: 8 });
  await page.mouse.move(x + 160, y, { steps: 8 });
  await page.mouse.up();
}
const drawings = (page: Page) =>
  page.locator('[data-testid="canvas-node"][data-node-type="freehand"]');

test("pen draws continuously, saves ink and supports whole-stroke undo and PNG export", async ({
  page,
}) => {
  await blank(page);
  await page.keyboard.press("p");
  await expect(
    page.getByRole("button", { name: "Pen", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page
    .getByRole("button", { name: "Ink color #cb8584", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Pen width", exact: true })
    .selectOption("5");
  await stroke(page, 300, 280);
  await stroke(page, 550, 430);
  await page.mouse.click(800, 350);
  await expect(drawings(page)).toHaveCount(3);
  await expect(
    drawings(page).first().getByTestId("freehand-path"),
  ).toHaveAttribute("stroke", "#cb8584");
  await expect(
    drawings(page).first().getByTestId("freehand-path"),
  ).toHaveAttribute("stroke-width", "5");
  await page.keyboard.press("ControlOrMeta+z");
  await expect(drawings(page)).toHaveCount(2);
  await page.keyboard.press("ControlOrMeta+Shift+z");
  await expect(drawings(page)).toHaveCount(3);
  await page.keyboard.press("Escape");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PNG", exact: true }).click();
  const file = await (await download).path();
  if (!file) throw new Error("Missing PNG");
  expect((await readFile(file)).subarray(1, 4).toString()).toBe("PNG");
  await page.reload();
  await expect(drawings(page)).toHaveCount(3);
  await expect(
    drawings(page).first().getByTestId("freehand-path"),
  ).toHaveAttribute("stroke", "#cb8584");
  await page.screenshot({ path: test.info().outputPath("pen-drawings.png") });
});

test("interrupted strokes are discarded and selection supports nudging, grouping and deletion", async ({
  page,
}) => {
  await blank(page);
  await page.keyboard.press("p");
  await page.mouse.move(300, 300);
  await page.mouse.down();
  await page.mouse.move(450, 350, { steps: 5 });
  await expect(page.getByTestId("stroke-preview")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expect(drawings(page)).toHaveCount(0);
  await expect(page.getByTestId("stroke-preview")).toHaveCount(0);
  await page.keyboard.press("p");
  await stroke(page, 300, 300);
  await stroke(page, 600, 400);
  await page.keyboard.press("Escape");
  await page.mouse.click(300, 300);
  await expect(drawings(page).first()).toHaveAttribute("data-selected", "true");
  const before = await drawings(page)
    .first()
    .evaluate(
      (element) => new DOMMatrix(getComputedStyle(element).transform).e,
    );
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Shift+ArrowDown");
  const after = await drawings(page)
    .first()
    .evaluate(
      (element) => new DOMMatrix(getComputedStyle(element).transform).e,
    );
  expect(after - before).toBe(1);
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.press("ControlOrMeta+g");
  await expect(page.getByTestId("canvas-group")).toHaveCount(1);
  await page.keyboard.press("Delete");
  await expect(drawings(page)).toHaveCount(0);
  await page.keyboard.press("ControlOrMeta+z");
  await expect(drawings(page)).toHaveCount(2);
  await page.keyboard.press("t");
  await expect(
    page.getByRole("button", { name: "Text", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});
