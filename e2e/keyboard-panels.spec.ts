import { test, expect } from "@playwright/test";

test("Tab keeps page and zoom controls anchored when a selected node is outside the viewport", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: /^Microservices Architecture/ })
    .click();
  const node = page
    .getByTestId("canvas-node")
    .filter({ hasText: "API Gateway" });
  await node.click({ position: { x: 30, y: 20 } });
  await page.evaluate(() => {
    window.location.hash = "cam=4000,3000,1";
  });
  const panels = page.locator(".canvas-zoom-panel, .canvas-pages-panel");
  const boxes = await panels.evaluateAll((elements) =>
    elements.map((element) => {
      const box = element.getBoundingClientRect();
      return { x: box.x, y: box.y };
    }),
  );
  for (let index = 0; index < 35; index++) {
    await page.keyboard.press("Tab");
    expect(
      await panels.evaluateAll((elements) =>
        elements.map((element) => {
          const box = element.getBoundingClientRect();
          return { x: box.x, y: box.y };
        }),
      ),
    ).toEqual(boxes);
  }
});

test("undo and redo use the physical shortcut with a Russian keyboard layout", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^Blank Canvas/ }).click();
  const canvas = page.getByTestId("canvas");
  await canvas.click({ button: "right", position: { x: 400, y: 250 } });
  await page
    .getByRole("dialog", { name: "Add to canvas", exact: true })
    .getByRole("button", { name: "Rectangle", exact: true })
    .click();
  await expect(page.getByTestId("canvas-node")).toHaveCount(1);
  await page.evaluate(() =>
    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "я",
        code: "KeyZ",
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      }),
    ),
  );
  await expect(page.getByTestId("canvas-node")).toHaveCount(0);
  await page.evaluate(() =>
    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Я",
        code: "KeyZ",
        ctrlKey: true,
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      }),
    ),
  );
  await expect(page.getByTestId("canvas-node")).toHaveCount(1);
});

test("undo and redo restore rich text while its editor remains focused", async ({
  page,
}) => {
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
  let editor = node.getByRole("textbox");
  await editor.fill("Before");
  await editor.press("Enter");
  await node.dblclick();
  editor = node.getByRole("textbox");
  await editor.fill("After");
  await editor.press("ControlOrMeta+z");
  await expect(node).toContainText("Before");
  await editor.press("ControlOrMeta+Shift+z");
  await expect(node).toContainText("After");
  await expect(node).toHaveCount(1);
});
