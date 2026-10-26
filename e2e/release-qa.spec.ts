import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("Space activates a focused canvas button instead of entering pan mode", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^Blank Canvas/ }).click();
  await page
    .getByRole("button", { name: "Add page", exact: true })
    .press("Space");
  await expect(
    page.getByTestId("page-tabs-bar").getByText("Page 2", { exact: true }),
  ).toBeVisible();
  await page.keyboard.press("t");
  await expect(
    page.getByRole("button", { name: "Text", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("v");
  await expect(
    page.getByRole("button", { name: "Select", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("page tabs support arrow navigation and keyboard rename without moving selected objects", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: /^Microservices Architecture/ })
    .click();
  await page.getByRole("button", { name: "Add page", exact: true }).click();
  const second = page.getByRole("tab", { name: "Page 2", exact: true });
  await expect(second).toHaveAttribute("aria-selected", "true");
  await second.press("ArrowLeft");
  await expect(
    page.getByRole("tab", { name: "Page 1", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("canvas-node")).toHaveCount(6);
  const api = page
    .getByTestId("canvas-node")
    .filter({ hasText: "API Gateway" });
  await api.click({ position: { x: 30, y: 20 } });
  const placement = await api.getAttribute("style");
  await page
    .getByRole("tab", { name: "Page 1", exact: true })
    .press("ArrowRight");
  await expect(page.getByTestId("canvas-node")).toHaveCount(0);
  await page.keyboard.press("ArrowLeft");
  await expect(api).toHaveAttribute("style", placement ?? "");
  await page.keyboard.press("End");
  await expect(second).toBeFocused();
  await second.press("F2");
  await page
    .getByRole("textbox", { name: "Page name", exact: true })
    .fill("Ideas");
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("tab", { name: "Ideas", exact: true }),
  ).toBeFocused();
  await page.reload();
  await expect(
    page.getByRole("tab", { name: "Ideas", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
});

test("shrinking a Shift marquee removes newly covered objects and preserves the initial selection", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: /^Microservices Architecture/ })
    .click();
  const api = page
    .getByTestId("canvas-node")
    .filter({ hasText: "API Gateway" });
  const auth = page
    .getByTestId("canvas-node")
    .filter({ hasText: "Auth Service" });
  await api.click({ position: { x: 30, y: 20 } });
  const box = await auth.boundingBox();
  if (!box) throw new Error("Missing Auth Service");
  await page.keyboard.down("Shift");
  await page.mouse.move(box.x - 20, box.y - 20);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width + 10, box.y + box.height + 10, {
    steps: 5,
  });
  await expect(auth).toHaveClass(/ring-1 ring-amber/);
  await page.mouse.move(box.x - 10, box.y - 10, { steps: 5 });
  await expect(auth).not.toHaveClass(/ring-1 ring-amber/);
  await expect(api).toHaveClass(/ring-1 ring-amber/);
  await page.mouse.up();
  await page.keyboard.up("Shift");
});

for (const theme of ["dark", "light"] as const) {
  test(`welcome and canvas controls have no automatic WCAG A/AA findings in ${theme} mode`, async ({
    page,
  }) => {
    await page.addInitScript(
      (value) => localStorage.setItem("talweg_theme", value),
      theme,
    );
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Give your ideas room.", exact: true }),
    ).toBeVisible();
    const welcome = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      welcome.violations.map((v) => ({
        id: v.id,
        targets: v.nodes.map((n) => n.target),
      })),
    ).toEqual([]);
    await page.getByRole("button", { name: /^Blank Canvas/ }).click();
    await expect(page.getByTestId("page-tabs-bar")).toBeVisible();
    const canvas = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      canvas.violations.map((v) => ({
        id: v.id,
        targets: v.nodes.map((n) => n.target),
      })),
    ).toEqual([]);
  });
}

test("deleting a background page keeps the active page and deleting the active one updates its URL", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^Blank Canvas/ }).click();
  await page.getByRole("button", { name: "Add page", exact: true }).click();
  await page.getByRole("button", { name: "Add page", exact: true }).click();
  const activeUrl = page.url();
  await page
    .locator(".canvas-page-tab")
    .filter({ hasText: "Page 1" })
    .getByRole("button", { name: "Delete page", exact: true })
    .click();
  await expect(
    page.locator('.canvas-page-tab[data-active="true"]'),
  ).toContainText("Page 3");
  expect(page.url()).toBe(activeUrl);
  await page
    .locator(".canvas-page-tab")
    .filter({ hasText: "Page 3" })
    .getByRole("button", { name: "Delete page", exact: true })
    .click();
  await expect(
    page.locator('.canvas-page-tab[data-active="true"]'),
  ).toContainText("Page 2");
  await expect(page).not.toHaveURL(activeUrl);
  await page.reload();
  await expect(
    page.locator('.canvas-page-tab[data-active="true"]'),
  ).toContainText("Page 2");
});

test("the library uses singular element counts in English and Russian", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^Blank Canvas/ }).click();
  await expect(page.getByTestId("canvas")).toBeVisible();
  await page.keyboard.press("r");
  await page.getByTestId("canvas").click({ position: { x: 400, y: 240 } });
  await expect(page.getByTestId("canvas-node")).toHaveCount(1);
  await page.getByRole("button", { name: "Talweg", exact: true }).click();
  await expect(page.getByText("1 element", { exact: true })).toBeVisible();
  await page
    .getByRole("combobox", { name: "Language / Язык", exact: true })
    .selectOption("ru");
  await expect(page.getByText("1 элемент", { exact: true })).toBeVisible();
});
