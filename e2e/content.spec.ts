import { test as base, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

const test = base.extend<{ canvasPage: Page }>({
  canvasPage: async ({ page }, use) => {
    await page.addInitScript(() => localStorage.setItem("talweg_lang", "en"));
    await page.goto("/");
    await page.getByRole("button", { name: /^Blank Canvas/ }).click();
    await expect(page.getByTestId("canvas")).toBeVisible();
    await use(page);
  },
});
async function insert(page: Page, name: string) {
  await page
    .getByRole("button", { name: "Add to canvas", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Add to canvas", exact: true })
    .getByRole("button", { name, exact: true })
    .click();
}

test("colors a selected phrase, preserves other text, and survives reload", async ({
  canvasPage: page,
}) => {
  await insert(page, "Rectangle");
  const node = page.getByRole("group", { name: "Rectangle", exact: true });
  await node.dblclick({ position: { x: 80, y: 30 } });
  const editor = node.getByRole("textbox", { name: "Label", exact: true });
  await editor.fill("Alpha beta gamma");
  await editor.press("Home");
  for (let i = 0; i < 6; i++) await editor.press("ArrowRight");
  for (let i = 0; i < 4; i++) await editor.press("Shift+ArrowRight");
  const toolbar = page.getByRole("toolbar", {
    name: "Selected text formatting",
    exact: true,
  });
  await expect(toolbar).toBeVisible();
  await toolbar
    .getByRole("button", { name: "Selection color #cb8584", exact: true })
    .click();
  await expect(editor.getByText("beta", { exact: true })).toHaveCSS(
    "color",
    "rgb(203, 133, 132)",
  );
  await expect(editor.getByText("Alpha", { exact: true })).not.toHaveCSS(
    "color",
    "rgb(203, 133, 132)",
  );
  await page.reload();
  await expect(node.getByText("beta", { exact: true })).toHaveCSS(
    "color",
    "rgb(203, 133, 132)",
  );
  await expect(node).toContainText("Alpha beta gamma");
});

test("table fill targets a cell or the whole table with readable text", async ({
  canvasPage: page,
}) => {
  await insert(page, "Table");
  await page.getByLabel("Cell 1, 1", { exact: true }).fill("Milestone");
  await page.getByLabel("Cell 1, 2", { exact: true }).fill("Owner");
  await page
    .getByLabel("Cell 1, 1", { exact: true })
    .click({ button: "right" });
  const inspector = page.getByRole("dialog", {
    name: "Appearance",
    exact: true,
  });
  await expect(
    inspector.getByRole("button", { name: "Whole table", exact: true }),
  ).toBeVisible();
  await inspector
    .getByRole("button", { name: "Fill #e9dda7", exact: true })
    .click();
  await expect(
    page
      .getByRole("cell")
      .filter({ has: page.getByLabel("Cell 1, 1", { exact: true }) }),
  ).toHaveCSS("background-color", "rgb(233, 221, 167)");
  await expect(page.getByLabel("Cell 1, 1", { exact: true })).toHaveCSS(
    "color",
    "rgb(32, 34, 35)",
  );
  await inspector
    .getByRole("button", { name: "Whole table", exact: true })
    .click();
  await inspector
    .getByRole("button", { name: "Fill #eeeeeb", exact: true })
    .click();
  await expect(page.getByLabel("Cell 1, 2", { exact: true })).toHaveCSS(
    "color",
    "rgb(32, 34, 35)",
  );
  await page.reload();
  await expect(
    page
      .getByRole("cell")
      .filter({ has: page.getByLabel("Cell 1, 1", { exact: true }) }),
  ).toHaveCSS("background-color", "rgb(233, 221, 167)");
  await expect(page.getByLabel("Cell 1, 2", { exact: true })).toHaveCSS(
    "color",
    "rgb(32, 34, 35)",
  );
});

test("Markdown notes preview safely and retain content on reload", async ({
  canvasPage: page,
}) => {
  await insert(page, "Markdown note");
  await page.getByRole("button", { name: "Open note", exact: true }).click();
  const panel = page.getByRole("dialog", { name: "Node note", exact: true });
  await panel
    .getByLabel("Markdown text", { exact: true })
    .fill(
      "# Release\n\nKeep **important** details here.\n\n<script>window.hacked=true</script>",
    );
  await panel.getByRole("tab", { name: "Preview", exact: true }).click();
  await expect(
    panel.getByRole("heading", { name: "Release", exact: true, level: 1 }),
  ).toBeVisible();
  await expect(panel.getByText("important", { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Open note", exact: true }).click();
  await expect(
    panel.getByLabel("Markdown text", { exact: true }),
  ).toContainText("# Release");
  const download = page.waitForEvent("download");
  await panel
    .getByRole("button", { name: "Download Markdown", exact: true })
    .click();
  const file = await download;
  const path = test.info().outputPath("note.md");
  await file.saveAs(path);
  expect(await readFile(path, "utf8")).toContain("# Release");
});

test("labels stay visible on a free middle section of the connector", async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem("talweg_lang", "en"));
  await page.goto("/");
  await page
    .getByRole("button", { name: /^Microservices Architecture/ })
    .click();
  const label = page
    .getByTestId("connector-label")
    .filter({ hasText: "UserEvents" });
  await expect(label).toBeVisible();
  const text = await label.boundingBox();
  const node = await page
    .getByRole("group", { name: "Terminator", exact: true })
    .boundingBox();
  expect(text).not.toBeNull();
  expect(node).not.toBeNull();
  const intersects =
    !!text &&
    !!node &&
    text.x < node.x + node.width &&
    text.x + text.width > node.x &&
    text.y < node.y + node.height &&
    text.y + text.height > node.y;
  expect(intersects).toBe(false);
});

const imageFile = {
  name: "sample.png",
  mimeType: "image/png",
  buffer: Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAACAAAAAYCAIAAAAUMWhjAAAAJElEQVR4nGPoWXeGpohh1IJRC0YtGLVg1IJRC0YtGLVgaFgAAL8eElvxwJm3AAAAAElFTkSuQmCC",
    "base64",
  ),
};

test("image imports are included in PNG and portable native files", async ({
  canvasPage: page,
  browser,
}) => {
  const chooser = page.waitForEvent("filechooser");
  await insert(page, "Image");
  await (await chooser).setFiles(imageFile);
  await expect(
    page.getByRole("group", { name: "Image", exact: true }).getByRole("img"),
  ).toBeVisible();
  const pngDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PNG", exact: true }).click();
  const png = await pngDownload;
  const pngPath = test.info().outputPath("image.png");
  await png.saveAs(pngPath);
  const pixels = await page.evaluate(
    async (base64) => {
      const image = new Image();
      image.src = `data:image/png;base64,${base64}`;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("No canvas");
      ctx.drawImage(image, 0, 0);
      return Array.from(
        ctx.getImageData(canvas.width / 2, canvas.height / 2, 1, 1).data,
      );
    },
    (await readFile(pngPath)).toString("base64"),
  );
  expect(pixels).toEqual([140, 174, 204, 255]);
  await page.evaluate(() => {
    delete (window as Window & { showSaveFilePicker?: unknown })
      .showSaveFilePicker;
  });
  const nativeDownload = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Save Document (Ctrl+S)", exact: true })
    .click();
  const file = await nativeDownload;
  const path = test.info().outputPath("with-image.talweg");
  await file.saveAs(path);
  const doc = JSON.parse(await readFile(path, "utf8"));
  expect(Object.keys(doc.assets)).toHaveLength(1);
  expect(Object.values(doc.assets)).toEqual([
    expect.objectContaining({
      mimeType: "image/png",
      base64Data: imageFile.buffer.toString("base64"),
    }),
  ]);
  const context = await browser.newContext();
  try {
    const imported = await context.newPage();
    await imported.addInitScript(() => {
      localStorage.setItem("talweg_lang", "en");
      delete (window as Window & { showOpenFilePicker?: unknown })
        .showOpenFilePicker;
    });
    await imported.goto("/");
    const open = imported.waitForEvent("filechooser");
    await imported
      .getByRole("button", { name: "Open from Computer", exact: true })
      .click();
    await (await open).setFiles(path);
    await expect(
      imported
        .getByRole("group", { name: "Image", exact: true })
        .getByRole("img"),
    ).toBeVisible();
  } finally {
    await context.close();
  }
});

test("Markdown images survive reload and export with their note", async ({
  canvasPage: page,
}) => {
  await insert(page, "Markdown note");
  await page.getByRole("button", { name: "Open note", exact: true }).click();
  const panel = page.getByRole("dialog", { name: "Node note", exact: true });
  await panel
    .getByLabel("Markdown text", { exact: true })
    .fill("# Reference\n");
  const chooser = page.waitForEvent("filechooser");
  await panel
    .getByRole("button", { name: "Add image to note", exact: true })
    .click();
  await (await chooser).setFiles(imageFile);
  await expect(panel.getByLabel("Markdown text", { exact: true })).toHaveValue(
    /asset:[a-f\d]{64}/,
  );
  await panel.getByRole("tab", { name: "Preview", exact: true }).click();
  await expect(
    panel.getByRole("img", { name: "sample.png", exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Open note", exact: true }).click();
  const download = page.waitForEvent("download");
  await panel
    .getByRole("button", { name: "Download Markdown", exact: true })
    .click();
  const path = test.info().outputPath("note-with-image.md");
  await (await download).saveAs(path);
  expect(await readFile(path, "utf8")).toContain(
    `data:image/png;base64,${imageFile.buffer.toString("base64")}`,
  );
  const open = page.waitForEvent("filechooser");
  await panel
    .getByRole("button", { name: "Import Markdown", exact: true })
    .click();
  await (await open).setFiles(path);
  await expect(panel.getByLabel("Markdown text", { exact: true })).toHaveValue(
    /data:image\/png;base64,/,
  );
  await panel.getByRole("tab", { name: "Preview", exact: true }).click();
  await expect(
    panel.getByRole("img", { name: "sample.png", exact: true }),
  ).toBeVisible();
});

test("multiline rich text keeps line breaks after typing and reloading", async ({
  canvasPage: page,
}) => {
  await insert(page, "Sticky Note");
  const note = page
    .getByRole("group", { name: "Sticky Note", exact: true })
    .getByRole("textbox");
  await note.fill("First line");
  await note.press("End");
  await note.press("Enter");
  await note.pressSequentially("Second line");
  await page.reload();
  await expect(note).toHaveText("First line\nSecond line");
});

test("connector descriptions can be edited, removed, added again and restored after reload", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("talweg_lang", "en"));
  await page.goto("/");
  await page.getByRole("button", { name: /^Microservices Architecture/ }).click();
  const original = page.getByTestId("connector-label").filter({ hasText: "UserEvents" });
  await original.click({ button: "right" });
  const field = page.getByRole("textbox", { name: "Connector description", exact: true });
  await expect(field).toHaveValue("UserEvents");
  await field.fill("");
  await expect(original).toHaveCount(0);
  await field.fill("Account created");
  await page.getByRole("button", { name: "Text #cb8584", exact: true }).click();
  const label = page.getByTestId("connector-label").filter({ hasText: "Account created" });
  await expect(label).toBeVisible();
  await expect(label.locator("text")).toHaveAttribute("fill", "#cb8584");
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await label.dblclick();
  await expect(field).toHaveValue("Account created");
  await field.fill("Dispatch event");
  await page.reload();
  await expect(page.getByTestId("connector-label").filter({ hasText: "Dispatch event" })).toBeVisible();
});
