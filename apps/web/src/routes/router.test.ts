import { describe, expect, it } from "vitest";
import { parseRoute } from "./router.js";

describe("router", () => {
  it("parses root path as dashboard", () => {
    const route = parseRoute("/");
    expect(route).toEqual({ type: "dashboard" });
  });

  it("parses empty path as dashboard", () => {
    const route = parseRoute("");
    expect(route).toEqual({ type: "dashboard" });
  });

  it("parses /board/:boardId", () => {
    const route = parseRoute("/board/arch-doc");
    expect(route).toEqual({
      type: "board",
      boardId: "arch-doc",
    });
  });

  it("parses /board/:boardId/page/:pageId", () => {
    const route = parseRoute("/board/arch-doc/page/page-2");
    expect(route).toEqual({
      type: "board",
      boardId: "arch-doc",
      pageId: "page-2",
    });
  });

  it("decodes URL encoded boardId and pageId", () => {
    const route = parseRoute("/board/my%20board/page/special%20page");
    expect(route).toEqual({
      type: "board",
      boardId: "my board",
      pageId: "special page",
    });
  });

  it("prioritizes ?room= query param for collaborative sessions", () => {
    const route = parseRoute("/", "?room=team-sync");
    expect(route).toEqual({
      type: "board",
      boardId: "room-team-sync",
    });
  });

  it("supports legacy ?doc= query param", () => {
    const route = parseRoute("/", "?doc=legacy-doc");
    expect(route).toEqual({
      type: "board",
      boardId: "legacy-doc",
    });
  });

  it("falls back to dashboard on unrecognized route", () => {
    const route = parseRoute("/unknown/route/here");
    expect(route).toEqual({ type: "dashboard" });
  });
});
