import { readFile } from "node:fs/promises";
import { test as base, expect, type Page } from "@playwright/test";

const test = base.extend<{ canvasPage: Page }>({
  canvasPage: async ({ page }, use) => {
    await page.addInitScript(() => localStorage.setItem("talweg_lang", "en"));
    await page.goto("/");
    await page.getByRole("button", { name: /^Blank Canvas/ }).click();
    await expect(page.getByTestId("canvas")).toBeVisible();
    await use(page);
  },
});

async function insert(page: Page, name: string, x = 420, y = 300) {
  await page
    .getByTestId("canvas")
    .click({ button: "right", position: { x, y } });
  await page
    .getByRole("dialog", { name: "Add to canvas", exact: true })
    .getByRole("button", { name, exact: true })
    .click();
}

test("right-click styles persist, and undo restores the previous appearance", async ({
  canvasPage: page,
}) => {
  await insert(page, "Rectangle");
  const node = page.getByRole("group", { name: "Rectangle", exact: true });
  await node.dblclick({ position: { x: 80, y: 35 } });
  await node.getByRole("textbox").fill("Architecture");
  await node.getByRole("textbox").press("Enter");
  await node.click({ button: "right", position: { x: 80, y: 35 } });
  const inspector = page.getByRole("dialog", {
    name: "Appearance",
    exact: true,
  });
  await inspector
    .getByRole("button", { name: "Fill #242729", exact: true })
    .click();
  await inspector
    .getByRole("button", { name: "Border #cb8584", exact: true })
    .click();
  await inspector.getByRole("button", { name: "3", exact: true }).click();
  await inspector.getByRole("button", { name: "Dashed", exact: true }).click();
  await inspector
    .getByRole("button", { name: "Text #8caecc", exact: true })
    .click();
  await inspector.getByLabel("Size", { exact: true }).selectOption("20");
  await expect(node.getByTestId("node-surface")).toHaveCSS(
    "border-style",
    "dashed",
  );
  await expect(node.getByTestId("node-surface")).toHaveCSS(
    "border-width",
    "3px",
  );
  await expect(node.getByText("Architecture")).toHaveCSS(
    "color",
    "rgb(140, 174, 204)",
  );
  await page.reload();
  await expect(node.getByTestId("node-surface")).toHaveCSS(
    "border-style",
    "dashed",
  );
  await expect(node.getByTestId("node-surface")).toHaveCSS(
    "border-color",
    "rgb(203, 133, 132)",
  );
  await expect(node.getByText("Architecture")).toHaveCSS("font-size", "20px");
  await node.click({ button: "right", position: { x: 80, y: 35 } });
  await inspector.getByRole("button", { name: "Dotted", exact: true }).click();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Control+z");
  await expect(node.getByTestId("node-surface")).toHaveCSS(
    "border-style",
    "dashed",
  );
  await page.reload();
  await expect(node.getByTestId("node-surface")).toHaveCSS(
    "border-style",
    "dashed",
  );
});

test("blank-canvas context ignores the previous selection and inserts at the click", async ({
  canvasPage: page,
}) => {
  await insert(page, "Rectangle", 250, 250);
  await page
    .getByTestId("canvas")
    .click({ button: "right", position: { x: 850, y: 480 } });
  const menu = page.getByRole("dialog", { name: "Add to canvas", exact: true });
  await expect(menu).toBeVisible();
  await menu.getByLabel("Find an element…", { exact: true }).fill("oval");
  await expect(menu.getByText("No matching elements")).toBeVisible();
  await menu.getByLabel("Find an element…", { exact: true }).fill("Ellipse");
  await menu.getByRole("button", { name: "Ellipse", exact: true }).click();
  const ellipse = page.getByRole("group", { name: "Ellipse", exact: true });
  await expect(ellipse).toBeVisible();
  const box = await ellipse.boundingBox();
  expect(box).not.toBeNull();
  expect(Math.round((box?.x ?? 0) + (box?.width ?? 0) / 2)).toBe(850);
  await page.reload();
  await expect(ellipse).toBeVisible();
});

test("table cells, added rows, and removed columns survive reload", async ({
  canvasPage: page,
}) => {
  await insert(page, "Table");
  await page.getByLabel("Cell 1, 1", { exact: true }).fill("Milestone");
  await page.reload();
  await expect(page.getByLabel("Cell 1, 1", { exact: true })).toHaveValue(
    "Milestone",
  );
  await page.getByRole("button", { name: "Row", exact: true }).click();
  await page.getByLabel("Cell 4, 1", { exact: true }).fill("Ship alpha");
  await page.reload();
  await expect(page.getByLabel("Cell 4, 1", { exact: true })).toHaveValue(
    "Ship alpha",
  );
  await page
    .getByRole("button", { name: "Remove last column", exact: true })
    .click();
  await page.reload();
  await expect(page.getByLabel("Cell 1, 3", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Cell 4, 2", { exact: true })).toBeVisible();
});

test("checklist completion and empty state survive reload", async ({
  canvasPage: page,
}) => {
  await insert(page, "Checklist");
  await page.getByLabel("Plan title", { exact: true }).fill("Release");
  await page.getByLabel("Task", { exact: true }).fill("Review canvas");
  await page
    .getByRole("checkbox", { name: "Complete Review canvas", exact: true })
    .check();
  await page.reload();
  await expect(page.getByLabel("Plan title", { exact: true })).toHaveValue(
    "Release",
  );
  await expect(
    page.getByRole("checkbox", { name: "Complete Review canvas", exact: true }),
  ).toBeChecked();
  await page.getByRole("button", { name: "Remove task", exact: true }).click();
  await page.reload();
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  await expect(page.getByLabel("Task", { exact: true })).toHaveValue("");
});

test("context menu stays in view and closes with Escape", async ({
  canvasPage: page,
}) => {
  await page.setViewportSize({ width: 640, height: 480 });
  await page
    .getByTestId("canvas")
    .click({ button: "right", position: { x: 625, y: 330 } });
  const menu = page.getByRole("dialog", { name: "Add to canvas", exact: true });
  await expect(menu).toBeVisible();
  const box = await menu.boundingBox();
  expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(632);
  expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(472);
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
});

test("duplicates can be styled independently and deleted", async ({
  canvasPage: page,
}) => {
  await insert(page, "Rectangle");
  await page
    .getByRole("group", { name: "Rectangle", exact: true })
    .click({ button: "right", position: { x: 20, y: 20 } });
  await page.getByRole("button", { name: "Duplicate", exact: true }).click();
  const nodes = page.getByRole("group", { name: "Rectangle", exact: true });
  await expect(nodes).toHaveCount(2);
  await nodes.nth(1).click({ button: "right", position: { x: 30, y: 30 } });
  await page.getByRole("button", { name: "Fill #e9dda7", exact: true }).click();
  await expect(nodes.nth(0).getByTestId("node-surface")).toHaveCSS(
    "background-color",
    "rgb(36, 39, 41)",
  );
  await expect(nodes.nth(1).getByTestId("node-surface")).toHaveCSS(
    "background-color",
    "rgb(233, 221, 167)",
  );
  await page
    .getByRole("dialog", { name: "Appearance", exact: true })
    .getByRole("button", { name: "Delete", exact: true })
    .click();
  await expect(nodes).toHaveCount(1);
  await page.reload();
  await expect(nodes).toHaveCount(1);
});

test("a table exports to a valid PNG and native file", async ({
  canvasPage: page,
}) => {
  await insert(page, "Table");
  await page.getByLabel("Cell 1, 1", { exact: true }).fill("Schedule");
  const pngDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PNG", exact: true }).click();
  const png = await pngDownload;
  expect(png.suggestedFilename()).toMatch(/\.png$/);
  expect(await png.failure()).toBeNull();
  const pngPath = test.info().outputPath("table.png");
  await png.saveAs(pngPath);
  expect((await readFile(pngPath)).subarray(0, 8).toString("hex")).toBe(
    "89504e470d0a1a0a",
  );
  await page.evaluate(() => {
    delete (window as Window & { showSaveFilePicker?: unknown })
      .showSaveFilePicker;
  });
  const fileDownload = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Save Document (Ctrl+S)", exact: true })
    .click();
  const file = await fileDownload;
  expect(file.suggestedFilename()).toMatch(/\.talweg$/);
  expect(await file.failure()).toBeNull();
  const filePath = test.info().outputPath("table.talweg");
  await file.saveAs(filePath);
  const document = JSON.parse(await readFile(filePath, "utf8"));
  expect(Object.values(document.sceneSnapshot.nodes)).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        type: "table",
        data: {
          cells: [
            ["Schedule", "", ""],
            ["", "", ""],
            ["", "", ""],
          ],
        },
      }),
    ]),
  );
});

for (const name of ["Decision", "Terminator", "Data"]) {
  test(`${name} respects independent text and line styles`, async ({
    canvasPage: page,
  }) => {
    await insert(page, name);
    const node = page.getByRole("group", { name, exact: true });
    await node.dblclick({ position: { x: 100, y: 30 } });
    await node.getByRole("textbox").fill("Review");
    await node.getByRole("textbox").press("Enter");
    await node.click({ button: "right", position: { x: 100, y: 30 } });
    const inspector = page.getByRole("dialog", {
      name: "Appearance",
      exact: true,
    });
    await inspector
      .getByRole("button", { name: "Text #cb8584", exact: true })
      .click();
    await inspector
      .getByRole("button", { name: "Dotted", exact: true })
      .click();
    await inspector
      .getByRole("button", { name: "Align right", exact: true })
      .click();
    await expect(node.getByText("Review", { exact: true })).toHaveCSS(
      "color",
      "rgb(203, 133, 132)",
    );
    await expect(node.getByText("Review", { exact: true })).toHaveCSS(
      "text-align",
      "right",
    );
    await page.reload();
    await expect(node.getByText("Review", { exact: true })).toHaveCSS(
      "color",
      "rgb(203, 133, 132)",
    );
  });
}
