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
