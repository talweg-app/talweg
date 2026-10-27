import { describe, expect, it } from "vitest";
import { applyDocumentToYDoc, createSceneDoc, deserializeTalwegFile, serializeTalwegFile } from "@talweg/storage";
import { TEMPLATE_CATALOG, createStarterTemplate } from "./templateCatalog.js";

describe("starter template catalog", () => {
  for (const template of TEMPLATE_CATALOG) for (const language of ["en", "ru"] as const) {
    it(`${template.id} creates a valid portable board in ${language}`, () => {
      const doc = createStarterTemplate(template.id, language);
      expect(doc.id).toMatch(/^doc-/);
      expect(new Set(Object.keys(doc.nodes)).size).toBe(Object.keys(doc.nodes).length);
      for (const node of Object.values(doc.nodes)) {
        expect([node.x, node.y, node.width, node.height].every(Number.isFinite)).toBe(true);
        if (node.type === "arrow") {
          expect(node.data.sourceId && doc.nodes[node.data.sourceId]).toBeDefined();
          expect(node.data.targetId && doc.nodes[node.data.targetId]).toBeDefined();
        } else {
          expect(node.width).toBeGreaterThan(0); expect(node.height).toBeGreaterThan(0);
          expect(doc.rootNodeIds).toContain(node.id);
        }
        if (doc.pages) expect(node.pageId && doc.pages[node.pageId]).toBeDefined();
      }
      const scene = createSceneDoc();
      applyDocumentToYDoc(doc, scene);
      const recovered = deserializeTalwegFile(serializeTalwegFile(doc, scene));
      try {
        expect(Object.keys(recovered.doc.nodes).sort()).toEqual(Object.keys(doc.nodes).sort());
        expect(recovered.doc.name).toBe(doc.name);
        if (doc.pages) expect(recovered.doc.pages).toEqual(doc.pages);
        for (const node of Object.values(doc.nodes)) if (node.note) expect(recovered.doc.nodes[node.id]?.note).toBe(node.note);
      } finally { recovered.ydoc.destroy(); scene.destroy(); }
    });
  }
  for (const template of TEMPLATE_CATALOG.filter(template => !["blank", "micro", "sprint"].includes(template.id))) {
    it(`${template.id} contains a worked example with at least ten objects and two pages`, () => {
      const doc = createStarterTemplate(template.id);
      expect(Object.values(doc.nodes).filter(node => node.type !== "arrow").length).toBeGreaterThanOrEqual(10);
      expect(Object.keys(doc.pages ?? {}).length).toBeGreaterThanOrEqual(2);
    });
  }
  it("keeps generated projects and checklist items independent", () => {
    const a = createStarterTemplate("weekly"), b = createStarterTemplate("weekly");
    expect(a.id).not.toBe(b.id);
    expect(Object.keys(a.nodes).some(id => id in b.nodes)).toBe(false);
    const first = Object.values(a.nodes).find(node => node.type === "checklist");
    const second = Object.values(b.nodes).find(node => node.type === "checklist");
    if (first?.type !== "checklist" || second?.type !== "checklist") throw new Error("Missing checklist");
    expect(first.data.items[0]?.id).not.toBe(second.data.items[0]?.id);
    const item = first.data.items[0];
    if (!item) throw new Error("Missing checklist item");
    item.text = "Changed task";
    expect(second.data.items[0]?.text).toBe("Choose one project");
  });
  it("links the math lesson to its own separate practice page", () => {
    const doc = createStarterTemplate("lesson", "ru");
    expect(Object.values(doc.pages ?? {}).map(page => page.name)).toEqual(["Урок", "Практика", "Решения"]);
    const formula = Object.values(doc.nodes).find(node => node.type === "markdown" && node.note?.includes("$$a^2"));
    expect(formula?.note).toContain(`/board/${doc.id}/page/page-practice?node=`);
    const target = formula?.note?.match(/\?node=([^)]*)/)?.[1];
    expect(target && Object.values(doc.nodes).find(node => node.id === target)?.pageId).toBe("page-practice");
    const lesson = Object.values(doc.nodes).filter(node => node.pageId === doc.activePageId);
    expect(lesson.every(node => !node.note?.includes("c = \\sqrt{5^2+12^2}"))).toBe(true);
  });
});
