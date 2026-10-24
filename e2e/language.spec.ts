import { test, expect } from "@playwright/test";

test.use({ locale: "ru-RU" });

test("English is the default; the selected language follows navigation and survives reload", async ({ page }) => {
  await page.goto("/");
  const language = page.getByRole("combobox", { name: "Language / Язык", exact: true });
  await expect(language).toHaveValue("en");
  await expect(page.getByRole("heading", { name: "Give your ideas room.", exact: true })).toBeVisible();
  await language.selectOption("ru");
  await expect(page.getByRole("heading", { name: "Мысли обретают форму.", exact: true })).toBeVisible();
  await page.getByRole("button", { name: /^Чистый холст/ }).click();
  await expect(language).toHaveValue("ru");
  await expect(page.getByRole("button", { name: "Добавить страницу", exact: true })).toBeVisible();
  await language.selectOption("en");
  await expect(page.getByRole("button", { name: "Add page", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add to canvas", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Talweg", exact: true }).click();
  await expect(language).toHaveValue("en");
  await language.selectOption("ru");
  await page.reload();
  await expect(language).toHaveValue("ru");
  await expect(page.locator("html")).toHaveAttribute("lang", "ru");
});

test("clicking a connector label does not outline the SVG viewport", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^Microservices Architecture/ }).click();
  await page.getByTestId("connector-label").filter({ hasText: "UserEvents" }).click();
  await expect(page.getByTestId("canvas-label-layer")).toHaveCSS("outline-style", "none");
  await expect(page.getByRole("button", { name: "Reconnect arrow source", exact: true })).toBeVisible();
});
