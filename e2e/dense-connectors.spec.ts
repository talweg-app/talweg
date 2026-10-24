import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { createMicroservicesTemplate } from "../apps/web/src/utils/starterTemplates.js";
import { createSceneDoc, applyDocumentToYDoc, serializeTalwegFile } from "../packages/storage/src/index.js";

test("dense connectors remain visible after resizing a curved target and reloading", async ({ page }) => {
  const document = createMicroservicesTemplate();
  document.name = "Connector spacing review";
  const source = Object.values(document.nodes).find((node) => node.type === "capsule");
  const target = Object.values(document.nodes).find((node) => node.type === "diamond");
  const arrow = Object.values(document.nodes).find((node) => node.type === "arrow");
  if (!source || !target || !arrow) throw new Error("Missing template elements");
  for (let index = 0; index < 8; index++) {
    const id = `${arrow.id}-${String(index)}` as typeof arrow.id;
    document.nodes[id] = { ...arrow, id, style: { ...arrow.style, strokeColor: "#8caecc" }, data: { sourceId: source.id, targetId: target.id, sourceAnchor: "e", targetAnchor: "w" } };
    document.rootNodeIds = [...document.rootNodeIds, id];
  }
  const scene = createSceneDoc();
  applyDocumentToYDoc(document, scene);
  const content = serializeTalwegFile(document, scene);
  scene.destroy();
  await writeFile("/tmp/talweg-dense-connectors.talweg", content);
  await page.addInitScript(() => {
    localStorage.setItem("talweg_lang", "en");
    delete (window as Window & { showOpenFilePicker?: unknown }).showOpenFilePicker;
  });
  await page.goto("/");
  const picker = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Open from Computer", exact: true }).click();
  await (await picker).setFiles({ name: "dense.talweg", mimeType: "application/json", buffer: Buffer.from(content) });
  const connectors = page.locator("g[data-node-id]").filter({ has: page.locator("path") });
  await expect(connectors).toHaveCount(13);
  await page.getByRole("group", { name: "Decision", exact: true }).click();
  const handle = await page.locator('[data-handle="se"]').boundingBox();
  if (!handle) throw new Error("Missing resize handle");
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(handle.x + 90, handle.y + 45, { steps: 8 });
  await page.mouse.up();
  await page.reload();
  await expect(connectors).toHaveCount(13);
  const paths = await connectors.locator("path").evaluateAll((elements) => elements.map((element) => element.getAttribute("d")));
  expect(paths.every((path) => path && !/NaN|Infinity/.test(path))).toBe(true);
  await page.screenshot({ path: "/home/ivan/.codex/visualizations/2026/10/24/01a16efb-8b2a-7261-bb0f-6007ba1b9bfa/talweg-connectors-fixed.png" });
});
