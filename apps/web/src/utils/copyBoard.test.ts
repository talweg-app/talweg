import { expect, it } from "vitest";
import type { DocumentId } from "@talweg/core";
import { createMicroservicesTemplate } from "./starterTemplates.js";
import { copyBoard } from "./copyBoard.js";

it("creates an independent board and rewrites only its own links", () => {
  const source = createMicroservicesTemplate();
  const node = Object.values(source.nodes)[0];
  if (!node) throw new Error("Missing node");
  node.note = `[Local](/board/room-session/page/page-1?node=${node.id}&room=session) [Other](/board/other?node=elsewhere)`;
  node.textRuns = {
    label: [
      { text: "Own", href: `/board/${source.id}/page/page-1?node=${node.id}` },
      { text: "External", href: "https://example.com/" },
    ],
  };
  const before = structuredClone(source);
  const copy = copyBoard(source, "independent" as DocumentId, "session");
  expect(copy.id).toBe("independent");
  expect(copy.name).toBe(`${source.name} (copy)`);
  expect(copy.nodes[node.id]?.note).toBe(
    `[Local](/board/independent/page/page-1?node=${node.id}) [Other](/board/other?node=elsewhere)`,
  );
  expect(copy.nodes[node.id]?.textRuns?.label?.[0]?.href).toBe(
    `/board/independent/page/page-1?node=${node.id}`,
  );
  expect(copy.nodes[node.id]?.textRuns?.label?.[1]?.href).toBe(
    "https://example.com/",
  );
  expect(source).toEqual(before);
});
