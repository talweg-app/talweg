import { test, expect, type Page, type Locator } from "@playwright/test";
import { readFile } from "node:fs/promises";

async function diagram(page: Page) {
  await page.goto("/");
  await page
    .getByRole("button", { name: /^Microservices Architecture/ })
    .click();
  await expect(page.getByTestId("canvas-node")).toHaveCount(6);
}
function shape(page: Page, text: string) {
  return page.getByTestId("canvas-node").filter({ hasText: text });
}
async function select(page: Page, names: string[]) {
  await page.keyboard.press("Escape");
  for (const [index, name] of names.entries())
    await shape(page, name).click({
      position: { x: 35, y: 20 },
      modifiers: index ? ["Shift"] : [],
    });
}
async function position(node: Locator) {
  return node.evaluate((element) => {
    const matrix = new DOMMatrix(getComputedStyle(element).transform);
    return {
      x: matrix.e,
      y: matrix.f,
      width: (element as HTMLElement).offsetWidth,
      height: (element as HTMLElement).offsetHeight,
    };
  });
}

test("groups move together, duplicate internal connections, reload, export, ungroup and undo", async ({
  page,
}) => {
  test.setTimeout(60000);
  await diagram(page);
  const api = shape(page, "API Gateway");
  const auth = shape(page, "Auth Service");
  const order = shape(page, "Order Engine");
  const beforeApi = await position(api);
  const beforeAuth = await position(auth);
  const beforeOrder = await position(order);
  await select(page, ["API Gateway", "Auth Service"]);
  await page.getByRole("button", { name: "Group", exact: true }).click();
  const group = page.getByTestId("canvas-group");
  await expect(group).toHaveCount(1);
  expect(await position(api)).toEqual(beforeApi);
  expect(await position(auth)).toEqual(beforeAuth);
  await group
    .getByRole("textbox", { name: "Group name", exact: true })
    .fill("Request handling");
  const grip = group.getByRole("button", { name: "Move group", exact: true });
  const box = await grip.boundingBox();
  if (!box) throw new Error("Missing group handle");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width / 2 + 80,
    box.y + box.height / 2 + 50,
    { steps: 6 },
  );
  await page.mouse.up();
  const movedApi = await position(api);
  const dx = movedApi.x - beforeApi.x;
  const dy = movedApi.y - beforeApi.y;
  const zoom = await page
    .getByTestId("canvas-world")
    .evaluate(
      (element) => new DOMMatrix(getComputedStyle(element).transform).a,
    );
  expect(Math.abs(dx - 80 / zoom)).toBeLessThanOrEqual(1);
  expect(Math.abs(dy - 50 / zoom)).toBeLessThanOrEqual(1);
  expect((await position(auth)).x - beforeAuth.x).toBe(dx);
  expect((await position(auth)).y - beforeAuth.y).toBe(dy);
  expect(await position(order)).toEqual(beforeOrder);
  await page.keyboard.press("ControlOrMeta+d");
  await expect(group).toHaveCount(2);
  await expect(page.getByTestId("canvas-node")).toHaveCount(8);
  await expect(
    page.getByTestId("connector-label").filter({ hasText: "/auth" }),
  ).toHaveCount(2);
  await page.keyboard.press("Delete");
  await expect(group).toHaveCount(1);
  await expect(page.getByTestId("canvas-node")).toHaveCount(6);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PNG", exact: true }).click();
  const file = await (await download).path();
  if (!file) throw new Error("Missing PNG");
  expect((await readFile(file)).subarray(1, 4).toString()).toBe("PNG");
  await page.reload();
  await expect(
    group.getByRole("textbox", { name: "Group name", exact: true }),
  ).toHaveValue("Request handling");
  expect((await position(api)).x).toBe(beforeApi.x + dx);
  await page
    .getByRole("button", { name: "Find in project", exact: true })
    .click();
  await page
    .getByRole("complementary", { name: "Project navigator", exact: true })
    .getByRole("button", { name: "Request handling", exact: true })
    .click();
  await expect(group).toHaveAttribute("data-selected", "true");
  await page.screenshot({
    path: test.info().outputPath("groups-and-navigation.png"),
  });
  await page
    .getByRole("button", { name: "Close navigator", exact: true })
    .click();
  await page.getByRole("button", { name: "Ungroup", exact: true }).click();
  await expect(group).toHaveCount(0);
  expect((await position(api)).x).toBe(beforeApi.x + dx);
  expect((await position(auth)).y).toBe(beforeAuth.y + dy);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(group).toHaveCount(1);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(group).toHaveCount(0);
});

test("alignment and distribution update the selection atomically and preserve connections", async ({
  page,
}) => {
  await diagram(page);
  const names = ["API Gateway", "Auth Service", "Order Engine"];
  const before = await Promise.all(
    names.map((name) => position(shape(page, name))),
  );
  await select(page, names);
  await page
    .getByRole("combobox", { name: "Align selection", exact: true })
    .selectOption("left");
  const aligned = await Promise.all(
    names.map((name) => position(shape(page, name))),
  );
  expect(new Set(aligned.map((point) => point.x)).size).toBe(1);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect(
    await Promise.all(names.map((name) => position(shape(page, name)))),
  ).toEqual(before);
  await select(page, names);
  await page
    .getByRole("combobox", { name: "Align selection", exact: true })
    .selectOption("horizontal");
  const distributed = (
    await Promise.all(names.map((name) => position(shape(page, name))))
  ).sort((a, b) => a.x - b.x);
  const [a, b, c] = distributed;
  if (!a || !b || !c) throw new Error("Missing selection");
  expect(b.x - a.x - a.width).toBeCloseTo(c.x - b.x - b.width, 3);
  await expect(page.getByTestId("connector-label")).toHaveCount(4);
  await page.reload();
  expect(
    (await Promise.all(names.map((name) => position(shape(page, name))))).sort(
      (a, b) => a.x - b.x,
    ),
  ).toEqual(distributed);
});

test("project search finds note content across pages and navigates to shapes and connections", async ({
  page,
}) => {
  await diagram(page);
  await page.getByRole("button", { name: "Add page", exact: true }).click();
  await page
    .getByRole("button", { name: "Add to canvas", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Add to canvas", exact: true })
    .getByRole("button", { name: "Markdown note", exact: true })
    .click();
  await page.getByRole("button", { name: "Open note", exact: true }).click();
  const note = page.getByRole("dialog", { name: "Node note", exact: true });
  await note
    .getByLabel("Markdown text", { exact: true })
    .fill(
      "# Integration exercise\n\nA hidden integral explanation for the second page.",
    );
  await note.getByRole("button", { name: "Close", exact: true }).click();
  await page
    .getByTestId("page-tabs-bar")
    .getByText("Page 1", { exact: true })
    .click();
  await page.keyboard.press("ControlOrMeta+f");
  const navigator = page.getByRole("complementary", {
    name: "Project navigator",
    exact: true,
  });
  const search = navigator.getByRole("searchbox");
  await expect(search).toBeFocused();
  await search.fill("hidden integral");
  const result = navigator
    .getByRole("button")
    .filter({ hasText: "A hidden integral explanation" });
  await expect(result).toHaveCount(1);
  await expect(result).toContainText("Page 2");
  await search.press("Enter");
  await expect(page.getByTestId("canvas-node")).toHaveCount(1);
  await expect(page.getByTestId("canvas-node")).toHaveClass(
    /(^|\s)ring-1(\s|$)/,
  );
  await search.fill("UserEvents");
  await navigator.getByRole("button").filter({ hasText: "UserEvents" }).click();
  await expect(page.getByTestId("canvas-node")).toHaveCount(6);
  await expect(
    page.getByTestId("connector-label").filter({ hasText: "UserEvents" }),
  ).toBeInViewport();
  await search.fill("no such phrase anywhere");
  await expect(navigator).toContainText("No matching content");
  await search.fill("");
  await navigator.getByRole("button", { name: "Page 2", exact: true }).click();
  await expect(page.getByTestId("canvas-node")).toHaveCount(1);
  await navigator
    .getByRole("button", { name: "Close navigator", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Find in project", exact: true }),
  ).toBeVisible();
});
