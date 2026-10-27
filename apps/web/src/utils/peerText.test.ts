import { expect, it } from "vitest";
import { rebaseTextOffset } from "./peerText.js";
it("keeps a local caret attached to its text when a peer inserts or removes earlier characters", () => {
  expect(rebaseTextOffset("abc", "Xabc", 2)).toBe(3);
  expect(rebaseTextOffset("abc", "abcX", 1)).toBe(1);
  expect(rebaseTextOffset("abcdef", "abef", 5)).toBe(3);
  expect(rebaseTextOffset("abcdef", "abXYZef", 3)).toBe(5);
  expect(rebaseTextOffset("abc", "", 3)).toBe(0);
  expect(rebaseTextOffset("", "new", 0)).toBe(3);
});
