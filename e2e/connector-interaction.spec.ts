import { test, expect, type Page } from "@playwright/test";
import { createBlankCanvas } from "../apps/web/src/utils/starterTemplates.js";
import { createCanvasNode } from "../apps/web/src/utils/createCanvasNode.js";
import { createMicroservicesTemplate } from "../apps/web/src/utils/starterTemplates.js";
import {
  createSceneDoc,
  serializeTalwegFile,
} from "../packages/storage/src/index.js";

async function openFixture(page: Page, cyclic = false) {
  const document = createBlankCanvas();
  const source = createCanvasNode(
    "rectangle",
    { x: 260, y: 320 },
    "whiteboard",
  );
  const target = createCanvasNode(
    "rectangle",
    { x: 620, y: 320 },
    "whiteboard",
  );
  const arrow = Object.values(createMicroservicesTemplate().nodes).find(
    (node) => node.type === "arrow",
  );
  if (!source || !target || !arrow) throw new Error("Missing fixture");
  source.data = { label: "Idea" };
  target.data = { label: "Next step" };
  arrow.data = {
    sourceId: source.id,
    targetId: target.id,
    curveStyle: "bezier",
  };
  document.nodes = {
    [source.id]: source,
    [target.id]: target,
    [arrow.id]: arrow,
  };
  document.rootNodeIds = [source.id, target.id, arrow.id];
  if (cyclic) {
    const reverse = {
      ...arrow,
      id: `${arrow.id}-reverse` as typeof arrow.id,
      data: {
        sourceId: target.id,
        targetId: source.id,
        curveStyle: "bezier" as const,
      },
    };
    document.nodes[reverse.id] = reverse;
    document.rootNodeIds.push(reverse.id);
  }
  const scene = createSceneDoc(document);
  const content = serializeTalwegFile(document, scene);
  scene.destroy();
  await page.addInitScript(() => {
    delete (window as Window & { showOpenFilePicker?: unknown })
      .showOpenFilePicker;
  });
  await page.goto("/");
  const chooser = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "Open from Computer", exact: true })
    .click();
  await (
    await chooser
  ).setFiles({
    name: "connections.talweg",
    mimeType: "application/json",
    buffer: Buffer.from(content),
  });
  await expect(page.getByTestId("canvas-node")).toHaveCount(2);
  await page.evaluate(() => {
    location.hash = "#cam=0,400,1";
  });
  await expect
    .poll(() =>
      page
        .getByTestId("canvas-world")
        .evaluate(
          (element) => new DOMMatrix(getComputedStyle(element).transform).a,
        ),
    )
    .toBe(1);
  return {
    target: page.locator(
      `[data-testid="canvas-node"][data-node-id="${target.id}"]`,
    ),
    path: page.getByTestId("connector-hit"),
  };
}
async function point(page: Page) {
  return page.getByTestId("connector-hit").evaluate((element) => {
    const path = element as unknown as SVGPathElement;
    const position = path.getPointAtLength(path.getTotalLength() / 2);
    const matrix = path.getScreenCTM();
    if (!matrix) throw new Error("Missing matrix");
    const result = new DOMPoint(position.x, position.y).matrixTransform(matrix);
    return { x: result.x, y: result.y };
  });
}

test("moving a connected node keeps its existing attachment side and survives reload", async ({
  page,
}) => {
  const { target, path } = await openFixture(page);
  const start = await path.evaluate(
    (element) => (element as unknown as SVGPathElement).getPointAtLength(0).x,
  );
  const box = await target.boundingBox();
  if (!box) throw new Error("Missing target");
  await page.mouse.move(box.x + 30, box.y + 20);
  await page.mouse.down();
  await page.mouse.move(box.x + 30, box.y - 280, { steps: 10 });
  expect(
    await path.evaluate(
      (element) => (element as unknown as SVGPathElement).getPointAtLength(0).x,
    ),
  ).toBe(start);
  await page.mouse.up();
  await page.reload();
  await expect(path).toHaveCount(1);
  expect(
    await path.evaluate(
      (element) => (element as unknown as SVGPathElement).getPointAtLength(0).x,
    ),
  ).toBe(start);
  await page.screenshot({
    path: test.info().outputPath("fixed-attachment-side.png"),
  });
});

test("hover stays quiet and middle-button or space panning works over connections and handles", async ({
  page,
}) => {
  await openFixture(page);
  let at = await point(page);
  await page.mouse.move(at.x, at.y);
  await expect(page.locator("[data-arrow-endpoint]")).toHaveCount(0);
  for (const middle of [true, false]) {
    at = await point(page);
    const before = new URL(page.url()).hash;
    if (!middle) await page.keyboard.down("Space");
    await page.mouse.move(at.x, at.y);
    await page.mouse.down({ button: middle ? "middle" : "left" });
    await page.mouse.move(at.x + 40, at.y + 20, { steps: 5 });
    await page.mouse.up({ button: middle ? "middle" : "left" });
    if (!middle) await page.keyboard.up("Space");
    await expect.poll(() => new URL(page.url()).hash).not.toBe(before);
  }
  at = await point(page);
  await page.mouse.click(at.x, at.y);
  await expect(page.locator("[data-arrow-endpoint]")).toHaveCount(2);
  const before = new URL(page.url()).hash;
  const handle = await page
    .locator('[data-arrow-endpoint="source"]')
    .boundingBox();
  if (!handle) throw new Error("Missing handle");
  const path = page.getByTestId("connector-hit");
  const geometry = await path.getAttribute("d");
  await page.mouse.move(
    handle.x + handle.width / 2,
    handle.y + handle.height / 2,
  );
  await page.mouse.down({ button: "middle" });
  await page.mouse.move(handle.x + 55, handle.y + 35, { steps: 4 });
  await page.mouse.up({ button: "middle" });
  await expect.poll(() => new URL(page.url()).hash).not.toBe(before);
  await expect(path).toHaveAttribute("d", geometry ?? "");
});

test("adding a branch leaves the existing cyclic diagram where the user placed it", async ({
  page,
}) => {
  const { target } = await openFixture(page, true);
  const positions = () =>
    page
      .getByTestId("canvas-node")
      .evaluateAll((elements) =>
        Object.fromEntries(
          elements.map((element) => [
            element.getAttribute("data-node-id"),
            (element as HTMLElement).style.transform,
          ]),
        ),
      );
  const before = await positions();
  await page
    .getByRole("button", { name: "Canvas settings", exact: true })
    .click();
  await page.getByRole("menuitemradio", { name: /^Mindmap/ }).click();
  await target.click({ position: { x: 30, y: 20 } });
  await page.keyboard.press("Tab");
  await expect(page.getByTestId("canvas-node")).toHaveCount(3);
  const after = await positions();
  for (const [id, position] of Object.entries(before))
    expect(after[id]).toBe(position);
  await page.keyboard.press("ControlOrMeta+z");
  await expect(page.getByTestId("canvas-node")).toHaveCount(2);
  await page.keyboard.press("ControlOrMeta+Shift+z");
  await expect(page.getByTestId("canvas-node")).toHaveCount(3);
});
