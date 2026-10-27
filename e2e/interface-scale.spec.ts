import { test, expect } from "@playwright/test";

for (const viewport of [{ width: 1280, height: 900 }, { width: 800, height: 600 }, { width: 390, height: 844 }]) {
  test(`interface scale fits ${String(viewport.width)}px without changing canvas objects`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await page.getByRole("button", { name: /^Microservices Architecture/ }).click();
    const node = page.locator('[data-node-id]').filter({ hasText: "Auth Service" }).first();
    await expect(node).toBeVisible();
    const before = await node.boundingBox();
    await page.keyboard.press("Control+Comma");
    const settings = page.getByRole("dialog", { name: "Settings", exact: true });
    const slider = settings.getByRole("slider", { name: "Interface scale", exact: true });
    await slider.fill("150");
    await expect(settings.locator("output")).toHaveText("150%");
    const done = settings.getByRole("button", { name: "Done", exact: true });
    const bounds = await done.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width);
    await done.click();
    const after = await node.boundingBox();
    expect(after!.width).toBeCloseTo(before!.width, 0);
    expect(after!.height).toBeCloseTo(before!.height, 0);
    const panels = [".canvas-toolbar", ".canvas-pages-panel", ".canvas-zoom-panel"];
    const boxes = await Promise.all(panels.map(selector => page.locator(selector).boundingBox()));
    for (const box of boxes) {
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width + 1);
      expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height + 1);
    }
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i]!, b = boxes[j]!;
      expect(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y).toBe(true);
    }
    const canvas = page.getByTestId("canvas");
    const area = await canvas.boundingBox();
    await page.mouse.click(Math.min(viewport.width - 12, area!.x + area!.width - 12), area!.y + 100, { button: "right" });
    const menu = page.getByTestId("canvas-context-menu");
    await expect(menu).toBeVisible();
    const menuBox = await menu.boundingBox();
    expect(menuBox!.x + menuBox!.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(menuBox!.y + menuBox!.height).toBeLessThanOrEqual(viewport.height + 1);
    await page.keyboard.press("Escape");
    await page.reload();
    await page.keyboard.press("Control+Comma");
    await expect(slider).toHaveValue("150");
    await settings.getByRole("button", { name: "Reset", exact: true }).click();
    await expect(slider).toHaveValue("100");
  });
}

test("scaled Russian settings and light dashboard stay within a short window", async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 600 });
  await page.goto("/");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const settings = page.getByRole("dialog");
  await settings.getByRole("slider", { name: "Interface scale", exact: true }).fill("150");
  await settings.getByRole("combobox", { name: "Appearance", exact: true }).selectOption("light");
  await settings.getByRole("combobox", { name: "Language / Язык", exact: true }).selectOption("ru");
  await expect(settings.getByRole("slider", { name: "Масштаб интерфейса", exact: true })).toHaveValue("150");
  await settings.getByRole("button", { name: "Готово", exact: true }).click();
  const dashboard = page.locator(".workspace-home");
  expect(await dashboard.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  const bounds = await dashboard.boundingBox();
  expect(bounds!.height).toBeLessThanOrEqual(601);
  await page.getByRole("button", { name: "Настройки", exact: true }).click();
  await settings.getByRole("button", { name: "Файлы и приложение", exact: true }).click();
  const buttons = settings.locator(".settings-portable button");
  const a = await buttons.nth(0).boundingBox(), b = await buttons.nth(1).boundingBox();
  expect(a!.x + a!.width <= b!.x || a!.y + a!.height <= b!.y).toBe(true);
});

test("header controls and session popovers follow scale and window resizing", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^Blank Canvas/ }).click();
  await page.keyboard.press("Control+Comma");
  const settings = page.getByRole("dialog", { name: "Settings", exact: true });
  await settings.getByRole("slider", { name: "Interface scale", exact: true }).fill("150");
  await settings.getByRole("button", { name: "Done", exact: true }).click();
  for (const width of [1280, 1000, 800, 600, 390]) {
    await page.setViewportSize({ width, height: 700 });
    const controls = page.locator('.canvas-header-actions > button, .canvas-header-actions > label, .canvas-mode-picker > button');
    const boxes = await controls.evaluateAll(elements => elements.filter(element => element.getClientRects().length).map(element => {
      const b = element.getBoundingClientRect(); return { x: b.x, y: b.y, right: b.right, bottom: b.bottom };
    }));
    for (const a of boxes) { expect(a.x).toBeGreaterThanOrEqual(0); expect(a.right).toBeLessThanOrEqual(width + 1); }
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i]!, b = boxes[j]!;
      expect(a.right <= b.x || b.right <= a.x || a.bottom <= b.y || b.bottom <= a.y).toBe(true);
    }
    await page.getByRole("button", { name: "Collaborate", exact: true }).click();
    const panel = page.locator(".canvas-header-actions > .collaboration-panel");
    await expect(panel).toBeVisible();
    const p = await panel.boundingBox(), h = await page.locator(".canvas-header").boundingBox();
    expect(p!.y).toBeGreaterThanOrEqual(h!.y + h!.height);
    expect(p!.x).toBeGreaterThanOrEqual(0);
    expect(p!.x + p!.width).toBeLessThanOrEqual(width + 1);
    expect(p!.y + p!.height).toBeLessThanOrEqual(701);
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Canvas settings", exact: true }).click();
    const menu = await page.getByTestId("mode-picker-menu").boundingBox();
    expect(menu!.y).toBeGreaterThanOrEqual(h!.y + h!.height);
    expect(menu!.x).toBeGreaterThanOrEqual(0);
    expect(menu!.x + menu!.width).toBeLessThanOrEqual(width + 1);
    await page.keyboard.press("Escape");
  }
  await page.getByRole("button", { name: "Collaborate", exact: true }).click();
  for (const width of [1000, 600, 1280, 390]) {
    await page.setViewportSize({ width, height: 700 });
    await expect.poll(async () => {
      const p = await page.locator(".canvas-header-actions > .collaboration-panel").boundingBox();
      const h = await page.locator(".canvas-header").boundingBox();
      return !!p && !!h && p.y >= h.y + h.height && p.y + p.height <= 701 && p.x >= 0 && p.x + p.width <= width + 1;
    }).toBe(true);
  }
});

test("Ctrl plus, minus and zero change only interface scale, including while settings are open", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^Blank Canvas/ }).click();
  const original = new URL(page.url()).hash;
  await page.keyboard.press("Control+Equal");
  await expect(page.locator(".canvas-header")).toHaveCSS("zoom", "1.05");
  await page.keyboard.press("Control+Comma");
  const slider = page.getByRole("slider", { name: "Interface scale", exact: true });
  await expect(slider).toHaveValue("105");
  await page.keyboard.press("Control+Minus");
  await expect(slider).toHaveValue("100");
  await page.keyboard.press("Control+Shift+Equal");
  await expect(slider).toHaveValue("105");
  await page.keyboard.press("Control+0");
  await expect(slider).toHaveValue("100");
  expect(new URL(page.url()).hash).toBe(original);
});

test("dashboard preferences and join dialog fit each scale after resizing", async ({ page }) => {
  await page.goto("/");
  for (const scale of [80, 100, 150]) {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await page.getByRole("slider", { name: "Interface scale", exact: true }).fill(String(scale));
    await page.getByRole("button", { name: "Done", exact: true }).click();
    for (const width of [1280, 1000, 800, 600, 390]) {
      await page.setViewportSize({ width, height: 800 });
      const boxes = await page.locator('.workspace-preferences > button, .workspace-preferences > label, .workspace-open-file').evaluateAll(elements => elements.map(element => {
        const b = element.getBoundingClientRect(); return { x: b.x, y: b.y, right: b.right, bottom: b.bottom };
      }));
      for (const a of boxes) { expect(a.x).toBeGreaterThanOrEqual(0); expect(a.right).toBeLessThanOrEqual(width + 1); }
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]!, b = boxes[j]!;
        expect(a.right <= b.x || b.right <= a.x || a.bottom <= b.y || b.bottom <= a.y).toBe(true);
      }
      await page.getByRole("button", { name: "Join a session", exact: true }).click();
      const join = page.getByRole("dialog", { name: "Join a session", exact: true });
      await expect(join).toBeVisible();
      const bounds = await join.boundingBox();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width + 1);
      expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(801);
      await join.getByRole("button", { name: "Close", exact: true }).click();
    }
  }
});
