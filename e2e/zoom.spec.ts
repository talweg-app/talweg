import { test as base, expect, type Page } from "@playwright/test";

const test = base.extend<{ canvasPage: Page }>({
  canvasPage: async ({ page }, use) => {
    await page.addInitScript(() => localStorage.setItem("talweg_lang", "en"));
    await page.goto("/");
    await page.getByRole("button", { name: /^Blank Canvas/ }).click();
    await expect(page.getByTestId("canvas")).toBeVisible();
    await use(page);
  },
});

async function camera(page: Page) {
  return page.getByTestId("canvas-world").evaluate((world) => {
    // the world layer has no accessible counterpart; read the rendered camera
    const canvas = world.parentElement as HTMLElement;
    const matrix = new DOMMatrix(getComputedStyle(world).transform);
    const bounds = canvas.getBoundingClientRect();
    return {
      zoom: matrix.a,
      x: matrix.e / matrix.a,
      y: matrix.f / matrix.a,
      width: bounds.width,
      height: bounds.height,
      top: bounds.top,
    };
  });
}

async function wheel(page: Page, deltaY: number, ctrlKey: boolean, deltaX = 0) {
  await page
    .getByTestId("canvas")
    .dispatchEvent("wheel", {
      bubbles: true,
      cancelable: true,
      clientX: 500,
      clientY: 400,
      deltaX,
      deltaY,
      deltaMode: 0,
      ctrlKey,
    });
}

test("zoom buttons take small reversible steps around the viewport center", async ({
  canvasPage: page,
}) => {
  const before = await camera(page);
  await page.getByRole("button", { name: "Zoom In", exact: true }).click();
  await expect
    .poll(async () => (await camera(page)).zoom)
    .toBeCloseTo(before.zoom * 1.1, 5);
  const after = await camera(page);
  expect(after.width / (2 * after.zoom) - after.x).toBeCloseTo(
    before.width / (2 * before.zoom) - before.x,
    2,
  );
  expect(after.height / (2 * after.zoom) - after.y).toBeCloseTo(
    before.height / (2 * before.zoom) - before.y,
    2,
  );
  await page.getByRole("button", { name: "Zoom Out", exact: true }).click();
  await expect
    .poll(async () => (await camera(page)).zoom)
    .toBeCloseTo(before.zoom, 5);
});

test("coalesced pinch deltas keep the same sensitivity as smaller samples", async ({
  canvasPage: page,
}) => {
  const before = await camera(page);
  await wheel(page, -40, true);
  await expect
    .poll(async () => (await camera(page)).zoom)
    .toBeCloseTo(before.zoom * Math.exp(0.4), 5);
  const after = await camera(page);
  expect(500 / after.zoom - after.x).toBeCloseTo(
    500 / before.zoom - before.x,
    2,
  );
  expect((400 - after.top) / after.zoom - after.y).toBeCloseTo(
    (400 - before.top) / before.zoom - before.y,
    2,
  );
  await wheel(page, 40, true);
  await expect
    .poll(async () => (await camera(page)).zoom)
    .toBeCloseTo(before.zoom, 5);
});

test("native gesture events do not double-count accompanying wheel events", async ({
  canvasPage: page,
}) => {
  const canvas = page.getByTestId("canvas");
  const before = await camera(page);
  await canvas.evaluate((element) => {
    for (const [type, scale] of [
      ["gesturestart", 1],
      ["gesturechange", 1.2],
    ] as const) {
      element.dispatchEvent(
        Object.assign(new Event(type, { bubbles: true, cancelable: true }), {
          clientX: 500,
          clientY: 400,
          scale,
        }),
      );
    }
  });
  await expect
    .poll(async () => (await camera(page)).zoom)
    .toBeCloseTo(before.zoom * 1.2, 5);
  await wheel(page, -100 * Math.log(1.2), true);
  await expect
    .poll(async () => (await camera(page)).zoom)
    .toBeCloseTo(before.zoom * 1.2, 5);
  await canvas.dispatchEvent("gestureend", {
    bubbles: true,
    cancelable: true,
    scale: 1.2,
  });
  await wheel(page, 100 * Math.log(1.2), true);
  await expect
    .poll(async () => (await camera(page)).zoom)
    .toBeCloseTo(before.zoom, 5);
});

test("Chromium's native pinch changes the canvas instead of page zoom", async ({
  canvasPage: page,
}) => {
  const before = await camera(page);
  const session = await page.context().newCDPSession(page);
  await session.send("Input.synthesizePinchGesture", {
    x: 500,
    y: 400,
    scaleFactor: 1.4,
    gestureSourceType: "mouse",
  });
  await expect
    .poll(async () => (await camera(page)).zoom)
    .toBeCloseTo(before.zoom * 1.4, 3);
  expect(await page.evaluate(() => window.visualViewport?.scale)).toBe(1);
  const after = await camera(page);
  expect(500 / after.zoom - after.x).toBeCloseTo(
    500 / before.zoom - before.x,
    2,
  );
  expect((400 - after.top) / after.zoom - after.y).toBeCloseTo(
    (400 - before.top) / before.zoom - before.y,
    2,
  );
  await session.send("Input.synthesizePinchGesture", {
    x: 500,
    y: 400,
    scaleFactor: 1 / 1.4,
    gestureSourceType: "mouse",
  });
  await expect
    .poll(async () => (await camera(page)).zoom)
    .toBeCloseTo(before.zoom, 3);
  await session.detach();
});

test("ordinary two-finger scrolling pans while the mouse wheel zooms", async ({
  canvasPage: page,
}) => {
  const before = await camera(page);
  await wheel(page, 12.5, false, 8.5);
  await expect
    .poll(async () => (await camera(page)).y)
    .toBeCloseTo(before.y - 12.5 / before.zoom, 3);
  expect((await camera(page)).zoom).toBeCloseTo(before.zoom, 5);
  await wheel(page, 100, false);
  await expect
    .poll(async () => (await camera(page)).zoom)
    .toBeCloseTo(before.zoom * Math.exp(-0.15), 5);
});

test("zoom buttons clamp to limits and reset without shifting the center", async ({
  canvasPage: page,
}) => {
  await page.evaluate(() => {
    window.location.hash = "#cam=125,-50,7.9";
  });
  await expect.poll(async () => (await camera(page)).zoom).toBeCloseTo(7.9, 4);
  await page.getByRole("button", { name: "Zoom In", exact: true }).click();
  await expect.poll(async () => (await camera(page)).zoom).toBe(8);
  const maximum = await camera(page);
  await page.getByRole("button", { name: "Zoom In", exact: true }).click();
  expect(await camera(page)).toEqual(maximum);
  await page.evaluate(() => {
    window.location.hash = "#cam=125,-50,0.101";
  });
  await expect
    .poll(async () => (await camera(page)).zoom)
    .toBeCloseTo(0.101, 4);
  await page.getByRole("button", { name: "Zoom Out", exact: true }).click();
  await expect.poll(async () => (await camera(page)).zoom).toBe(0.1);
  const minimum = await camera(page);
  await page.getByRole("button", { name: "Zoom Out", exact: true }).click();
  expect(await camera(page)).toEqual(minimum);
  await page
    .getByRole("banner")
    .getByRole("button", { name: "100%", exact: true })
    .click();
  await expect.poll(async () => (await camera(page)).zoom).toBe(1);
  const reset = await camera(page);
  expect(reset.width / 2 - reset.x).toBeCloseTo(
    minimum.width / (2 * minimum.zoom) - minimum.x,
    2,
  );
  expect(reset.height / 2 - reset.y).toBeCloseTo(
    minimum.height / (2 * minimum.zoom) - minimum.y,
    2,
  );
});
