import { test, expect, type Page } from "@playwright/test";

async function blank(page: Page) {
  await page.addInitScript(() => localStorage.setItem("talweg_lang", "en"));
  await page.goto("/");
  await page.locator(".workspace-templates").getByRole("button", { name: /^Blank Canvas/ }).click();
  await expect(page.getByTestId("canvas")).toBeVisible();
}
async function rectangle(page: Page, text: string) {
  await page.getByRole("button", { name: "Add to canvas", exact: true }).click();
  await page.getByRole("dialog", { name: "Add to canvas", exact: true }).getByRole("button", { name: "Rectangle", exact: true }).click();
  const node = page.getByTestId("canvas-node").last();
  await node.dblclick({ position: { x: 70, y: 30 } });
  const editor = node.getByRole("textbox", { name: "Label", exact: true });
  await editor.fill(text);
  return { node, editor };
}
async function selectBeta(editor: ReturnType<Page["getByRole"]>) {
  await editor.press("Home");
  for (let index = 0; index < 6; index++) await editor.press("ArrowRight");
  for (let index = 0; index < 4; index++) await editor.press("Shift+ArrowRight");
}

test("the empty hint dismisses on right click and stays dismissed", async ({ page }) => {
  await blank(page);
  const hint = page.getByRole("heading", { name: "Start with one idea", exact: true });
  await expect(hint).toBeVisible();
  await page.getByTestId("canvas").click({ button: "right", position: { x: 100, y: 100 } });
  await expect(hint).toBeHidden();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(hint).toBeHidden();
});

test("formats only a selected word and scales node text during resize", async ({ page }) => {
  await blank(page);
  const { node, editor } = await rectangle(page, "Alpha beta gamma");
  await selectBeta(editor);
  await page.getByRole("button", { name: "Bold", exact: true }).click();
  await page.getByRole("button", { name: "Italic", exact: true }).click();
  await page.getByRole("combobox", { name: "Text size", exact: true }).selectOption("24");
  await expect(editor.getByText("beta", { exact: true })).toHaveCSS("font-weight", "700");
  await expect(editor.getByText("beta", { exact: true })).toHaveCSS("font-style", "italic");
  await expect(editor.getByText("beta", { exact: true })).toHaveCSS("font-size", "24px");
  await expect(editor.getByText("Alpha", { exact: true })).not.toHaveCSS("font-weight", "700");
  await editor.press("Escape");
  await node.click();
  const before = await node.boundingBox();
  const handle = await page.locator('[data-handle="se"]').boundingBox();
  expect(before).not.toBeNull(); expect(handle).not.toBeNull();
  if (!before || !handle) return;
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(handle.x + before.width, handle.y + before.height, { steps: 8 });
  await page.mouse.up();
  const size = await node.getByText("beta", { exact: true }).evaluate((element) => parseFloat(getComputedStyle(element).fontSize));
  expect(size).toBeGreaterThan(40);
  await page.reload();
  await expect(page.getByText("beta", { exact: true })).toHaveCSS("font-weight", "700");
  expect(await page.getByText("beta", { exact: true }).evaluate((element) => parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThan(40);
});

test("descriptions are opt-in and can be removed", async ({ page }) => {
  await blank(page);
  const { node, editor } = await rectangle(page, "Process");
  await editor.press("Escape");
  await expect(node.getByRole("button", { name: "Open note", exact: true })).toHaveCount(0);
  await node.click({ button: "right" });
  await page.getByRole("button", { name: "Add description", exact: true }).click();
  const panel = page.getByRole("dialog", { name: "Node note", exact: true });
  await panel.getByLabel("Markdown text", { exact: true }).fill("Specific context");
  await panel.getByRole("button", { name: "Close", exact: true }).click();
  await expect(node.getByRole("button", { name: "Open note", exact: true })).toBeVisible();
  await node.click({ button: "right" });
  await page.getByRole("button", { name: "Remove description", exact: true }).click();
  await page.reload();
  await expect(node.getByRole("button", { name: "Open note", exact: true })).toHaveCount(0);
});

test("unused templates stay out of the working library; edited boards can be hidden and restored", async ({ page }) => {
  await blank(page);
  await page.getByRole("button", { name: "Talweg", exact: true }).click();
  await expect(page.locator(".workspace-board")).toHaveCount(0);
  await page.getByRole("button", { name: /^Microservices Architecture/ }).click();
  await page.getByRole("textbox").first().fill("Working plan");
  await page.getByRole("button", { name: "Talweg", exact: true }).click();
  await expect(page.locator(".workspace-board")).toHaveCount(1);
  await expect(page.locator(".workspace-board")).toContainText("Working plan");
  await page.getByRole("button", { name: "Hide board Working plan", exact: true }).click();
  await expect(page.locator(".workspace-board")).toHaveCount(0);
  await page.getByRole("button", { name: /Hidden boards/ }).click();
  await page.getByRole("button", { name: "Restore board Working plan", exact: true }).click();
  await page.getByRole("button", { name: "Working boards", exact: true }).click();
  await expect(page.locator(".workspace-board")).toContainText("Working plan");
});

test("a selected text fragment links to a node on another page", async ({ page }) => {
  await blank(page);
  const { editor: sourceEditor } = await rectangle(page, "Alpha beta gamma");
  await sourceEditor.press("Escape");
  await page.getByRole("button", { name: "Add page", exact: true }).click();
  const { node: destination, editor: destinationEditor } = await rectangle(page, "Destination");
  const destinationId = await destination.getAttribute("data-node-id");
  await destinationEditor.press("Escape");
  await page.getByTestId("page-tabs-bar").getByText("Page 1", { exact: true }).click();
  const source = page.getByTestId("canvas-node");
  await source.dblclick({ position: { x: 60, y: 30 } });
  const editor = source.getByRole("textbox", { name: "Label", exact: true });
  await selectBeta(editor);
  await page.getByRole("button", { name: "Add link", exact: true }).click();
  const picker = page.getByRole("combobox", { name: "Choose a page and node", exact: true });
  if (!destinationId) throw new Error("Missing destination ID");
  await picker.selectOption(destinationId);
  await editor.press("Escape");
  await page.getByRole("link", { name: "beta", exact: true }).click();
  await expect(page.getByTestId("canvas-node")).toContainText("Destination");
  await expect(page).toHaveURL(/\?node=/);
  await page.reload();
  await expect(page.getByTestId("canvas-node")).toContainText("Destination");
});

test("a linked local file auto-saves edits and is not overwritten by a different board", async ({ page, browser }) => {
  await page.addInitScript(() => {
    const saved: string[] = [];
    Object.assign(window, { nativeFileWrites: saved, nativeWriteFails: false });
    Object.assign(window, { showSaveFilePicker: async () => ({
      name: "Working.talweg",
      createWritable: async () => {
        let pending = "";
        return {
          write: (content: string) => {
            if ((window as unknown as { nativeWriteFails: boolean }).nativeWriteFails) throw new Error("Disk unavailable");
            pending = content;
            return Promise.resolve();
          },
          close: () => { saved.push(pending); return Promise.resolve(); },
        };
      },
    }) });
  });
  await blank(page);
  const { node, editor } = await rectangle(page, "First version");
  await editor.press("Escape");
  await page.getByRole("button", { name: "Save Document (Ctrl+S)", exact: true }).click();
  await expect(page.getByText("File autosave on", { exact: true })).toBeVisible();
  await node.dblclick({ position: { x: 60, y: 30 } });
  await node.getByRole("textbox", { name: "Label", exact: true }).fill("Latest version");
  await expect.poll(() => page.evaluate(() => (window as unknown as { nativeFileWrites: string[] }).nativeFileWrites.at(-1))).toContain("Latest version");
  await page.evaluate(() => { (window as unknown as { nativeWriteFails: boolean }).nativeWriteFails = true; });
  await node.getByRole("textbox", { name: "Label", exact: true }).fill("Disk error copy");
  await expect(page.getByText("File error · browser copy kept", { exact: true })).toBeVisible();
  await page.evaluate(() => { (window as unknown as { nativeWriteFails: boolean }).nativeWriteFails = false; });
  await node.getByRole("textbox", { name: "Label", exact: true }).fill("Recovered version");
  await expect(page.getByText("File autosave on", { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as unknown as { nativeFileWrites: string[] }).nativeFileWrites.at(-1))).toContain("Recovered version");
  await node.getByRole("textbox", { name: "Label", exact: true }).press("Escape");
  const fileContent = await page.evaluate(() => (window as unknown as { nativeFileWrites: string[] }).nativeFileWrites.at(-1));
  if (!fileContent) throw new Error("No local file content");
  const otherBrowser = await browser.newContext();
  const imported = await otherBrowser.newPage();
  await imported.addInitScript((content) => {
    localStorage.setItem("talweg_lang", "en");
    const handle = {
      name: "Working.talweg",
      getFile: () => Promise.resolve(new File([content], "Working.talweg", { type: "application/json" })),
      createWritable: () => Promise.resolve({ write: () => Promise.resolve(), close: () => Promise.resolve() }),
    };
    Object.assign(window, { showOpenFilePicker: () => Promise.resolve([handle]) });
  }, fileContent);
  await imported.goto("/");
  await imported.getByRole("button", { name: "Open from Computer", exact: true }).click();
  await expect(imported.getByTestId("canvas-node")).toContainText("Recovered version");
  await expect(imported.getByText("File autosave on", { exact: true })).toBeVisible();
  await otherBrowser.close();
  const count = await page.evaluate(() => (window as unknown as { nativeFileWrites: string[] }).nativeFileWrites.length);
  await page.getByRole("button", { name: "Talweg", exact: true }).click();
  await page.locator(".workspace-templates").getByRole("button", { name: /^Blank Canvas/ }).click();
  await rectangle(page, "Other board");
  await expect(page.getByText("Saved in this browser", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { nativeFileWrites: string[] }).nativeFileWrites.length)).toBe(count);
});

test("browser storage errors are visible and queued edits survive a later retry", async ({ page }) => {
  await blank(page);
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    Object.assign(window, { restoreStoragePut: () => { IDBObjectStore.prototype.put = original; } });
    IDBObjectStore.prototype.put = function (value: unknown, key?: IDBValidKey) {
      if (this.name === "deltas") throw new DOMException("Storage unavailable", "QuotaExceededError");
      return original.call(this, value, key);
    };
  });
  const { editor } = await rectangle(page, "Recover local edits");
  await expect(page.getByText("Browser storage failed · save a file", { exact: true })).toBeVisible();
  await page.evaluate(() => { (window as unknown as { restoreStoragePut: () => void }).restoreStoragePut(); });
  await editor.fill("Recovered local edits");
  await expect(page.getByText("Saved in this browser", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("canvas-node")).toContainText("Recovered local edits");
});

test("editing a node does not steal focus from the document title", async ({ page }) => {
  await blank(page);
  const { editor } = await rectangle(page, "Alpha beta gamma");
  await selectBeta(editor);
  const title = page.locator(".canvas-document-title");
  await title.fill("Renamed while editing");
  await expect(title).toBeFocused();
  await expect(title).toHaveValue("Renamed while editing");
  await expect(page.getByTestId("canvas-node")).toContainText("Alpha beta gamma");
});

test("external links apply to a selected word, persist and open in a new tab", async ({ page, context }) => {
  await blank(page);
  const { editor } = await rectangle(page, "Alpha beta gamma");
  await selectBeta(editor);
  await page.getByRole("button", { name: "Add link", exact: true }).click();
  const address = page.getByRole("textbox", { name: "Website address", exact: true });
  await address.fill("javascript:alert(1)");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Enter a valid");
  await expect(editor.getByRole("link")).toHaveCount(0);
  await address.fill("example.com/docs");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await editor.press("Escape");
  await page.reload();
  const link = page.getByRole("link", { name: "beta", exact: true });
  await expect(link).toHaveAttribute("href", "https://example.com/docs");
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(link).toHaveAttribute("rel", "noopener noreferrer");
  await context.route("https://example.com/docs", (route) => route.fulfill({ contentType: "text/html", body: "<h1>External reference</h1>" }));
  const opened = page.waitForEvent("popup");
  await link.click();
  const external = await opened;
  await expect(external.getByRole("heading", { name: "External reference", exact: true })).toBeVisible();
  await external.close();
});
