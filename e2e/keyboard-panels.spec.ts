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
