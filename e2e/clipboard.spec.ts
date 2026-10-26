import { test, expect } from "@playwright/test";

test("copies a diagram into another board, keeps connections, and undoes the entire paste", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
  await page
    .getByRole("button", { name: /^Microservices Architecture/ })
    .click();
  await expect(page.getByTestId("canvas-node")).toHaveCount(6);
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.press("ControlOrMeta+c");
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toMatch(/^talweg-fragment:1/);
  await page.getByRole("button", { name: "Talweg", exact: true }).click();
  await page.getByRole("button", { name: /^Blank Canvas/ }).click();
  await expect(page.getByTestId("canvas")).toBeVisible();
  await page.mouse.move(300, 250);
  await page.keyboard.press("ControlOrMeta+v");
  await expect(page.getByTestId("canvas-node")).toHaveCount(6);
  await expect(page.getByTestId("connector-label")).toHaveCount(4);
  await page.keyboard.press("ControlOrMeta+z");
  await expect(page.getByTestId("canvas-node")).toHaveCount(0);
  await page.keyboard.press("ControlOrMeta+Shift+z");
  await expect(page.getByTestId("canvas-node")).toHaveCount(6);
  await page.reload();
  await expect(page.getByTestId("canvas-node")).toHaveCount(6);
  await expect(page.getByTestId("connector-label")).toHaveCount(4);
});

test("pastes a tabular range, expands the table, and persists it", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
  await page.getByRole("button", { name: /^Blank Canvas/ }).click();
  const canvas = page.getByTestId("canvas");
  await canvas.click({ button: "right", position: { x: 400, y: 250 } });
  await page
    .getByRole("dialog", { name: "Add to canvas", exact: true })
    .getByRole("button", { name: "Table", exact: true })
    .click();
  const table = page.getByTestId("canvas-node");
  const first = table.locator("td").first();
  await first.dblclick();
  await page.evaluate(() =>
    navigator.clipboard.writeText(
      "One\tTwo\nThree\tFour\nFive\tSix\nSeven\tEight",
    ),
  );
  await first.getByRole("textbox").press("ControlOrMeta+v");
  await expect(table).toContainText("Eight");
  await canvas.click({ position: { x: 100, y: 160 } });
  await page.reload();
  await expect(table.locator("tr")).toHaveCount(4);
  await expect(table.locator("td").first()).toHaveText("One");
  await expect(table).toContainText("Eight");
});

test("middle-button panning cancels native paste over nodes and text editors", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
  await page.getByRole("button", { name: /^Blank Canvas/ }).click();
  const canvas = page.getByTestId("canvas");
  await canvas.click({ button: "right", position: { x: 400, y: 250 } });
  await page
    .getByRole("dialog", { name: "Add to canvas", exact: true })
    .getByRole("button", { name: "Rectangle", exact: true })
    .click();
  const node = page.getByTestId("canvas-node");
  await node.dblclick();
  await node.getByRole("textbox").fill("Original text");
  await node.getByRole("textbox").press("Enter");
  await page.evaluate(() => {
    window.addEventListener(
      "pointerdown",
      (event) => {
        if (event.button === 1)
          setTimeout(() => {
            document.documentElement.dataset.middlePastePrevented = String(
              event.defaultPrevented,
            );
          }, 0);
      },
      { capture: true },
    );
    return navigator.clipboard.writeText("Clipboard text");
  });
  for (const editing of [false, true]) {
    if (editing) await node.dblclick();
    const box = await node.boundingBox();
    if (!box) throw new Error("Missing node");
    const before = new URL(page.url()).hash;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down({ button: "middle" });
    await expect(page.locator("html")).toHaveAttribute(
      "data-middle-paste-prevented",
      "true",
    );
    await page.mouse.move(
      box.x + box.width / 2 + 100,
      box.y + box.height / 2 + 60,
      { steps: 5 },
    );
    await page.mouse.up({ button: "middle" });
    await page.evaluate(() => {
      const data = new DataTransfer();
      data.setData("text/plain", "Unwanted primary selection");
      document.activeElement?.dispatchEvent(
        new ClipboardEvent("paste", {
          clipboardData: data,
          bubbles: true,
          cancelable: true,
        }),
      );
    });
    await expect.poll(() => new URL(page.url()).hash).not.toBe(before);
    await expect(node).toHaveCount(1);
    await expect(node).toContainText("Original text");
  }
  const editor = node.getByRole("textbox");
  await editor.click();
  await editor.press("ControlOrMeta+a");
  await editor.press("ControlOrMeta+v");
  await expect(editor).toHaveText("Clipboard text");
});
