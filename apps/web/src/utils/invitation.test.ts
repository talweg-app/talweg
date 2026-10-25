import { expect, it } from "vitest";
import {
  createInvitation,
  invitationText,
  parseInvitation,
} from "./invitation.js";
it("creates a transferable invitation with a verifiable host and no machine address", async () => {
  const { invitation } = await createInvitation();
  const text = invitationText(invitation);
  expect(parseInvitation(text)).toEqual(invitation);
  expect(text).not.toContain("localhost");
  expect(text).not.toContain("document");
});
it("rejects commands, query secrets, incompatible versions and malformed keys", async () => {
  const { invitation } = await createInvitation();
  const text = invitationText(invitation);
  for (const invalid of [
    text.replace("join/", "open/"),
    text.replace("v=1", "v=2"),
    text.replace("#", "?"),
    text + "&key=abc",
    "https://example.org",
    "talweg://join/invalid#v=1",
    text + "&execute=bad",
  ])
    expect(() => parseInvitation(invalid)).toThrow();
});
