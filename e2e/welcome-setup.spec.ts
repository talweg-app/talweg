import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function openSetup(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Open welcome setup", exact: true }).click();
  return page.getByRole("dialog", { name: "A space for your next idea.", exact: true });
}

for (const appearance of ["dark", "light"] as const) {
  test(`welcome setup remains accessible in ${appearance} appearance`, async ({ page }) => {
    const dialog = await openSetup(page);
    await dialog.getByRole("combobox", { name: "Appearance", exact: true }).selectOption(appearance);
    await expect(dialog.getByRole("textbox", { name: "Your name", exact: true })).toBeVisible();
    await dialog.evaluate(async element => {
      await Promise.all(element.getAnimations({ subtree: true }).filter(animation => animation.effect?.getComputedTiming().iterations !== Infinity).map(animation => animation.finished.catch(() => {})));
    });
    const result = await new AxeBuilder({ page }).include(".first-run").withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    expect(result.violations).toEqual([]);
    await dialog.getByRole("textbox", { name: "Your name", exact: true }).fill("Mira");
    await dialog.getByRole("checkbox", { name: "Reopen the last project", exact: true }).check();
    await dialog.getByRole("textbox", { name: "Your name", exact: true }).press("Enter");
    await expect(dialog).toBeHidden();
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await expect(page.getByRole("textbox", { name: "Your name", exact: true })).toHaveValue("Mira");
    await expect(page.getByRole("checkbox", { name: /^Reopen the last project/ })).toBeChecked();
  });
}

test("welcome fits a phone, follows language changes and respects reduced motion", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const dialog = await openSetup(page);
  await expect(dialog.getByRole("textbox", { name: "Your name", exact: true })).toBeFocused();
  expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await expect(page.locator(".first-run-intro")).toHaveCSS("animation-name", "none");
  await dialog.getByRole("combobox", { name: "Language / Язык", exact: true }).selectOption("ru");
  await expect(page.locator(".first-run").getByRole("heading", { level: 1 })).toHaveText("Место для вашей следующей идеи.");
  await page.getByRole("button", { name: "Начать работу", exact: true }).click();
  await expect(page.locator(".first-run")).toBeHidden();
});
