import { test, expect, type Page } from "@playwright/test";

async function hostSession(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /^Blank Canvas/ }).click();
  await expect(page.getByTestId("canvas")).toBeVisible();
  await page
    .getByTestId("canvas")
    .click({ button: "right", position: { x: 400, y: 300 } });
  await page
    .getByRole("dialog", { name: "Add to canvas", exact: true })
    .getByRole("button", { name: "Rectangle", exact: true })
    .click();
  await page.getByRole("button", { name: "Collaborate", exact: true }).click();
  await page
    .getByRole("button", { name: "Start a session", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Waiting for a guest" }),
  ).toBeVisible();
  return page
    .getByRole("textbox", { name: "Invitation link", exact: true })
    .inputValue();
}

async function enterInvitation(guest: Page, invite: string) {
  await guest.goto("/");
  await guest
    .getByRole("button", { name: "Join a session", exact: true })
    .click();
  await guest
    .getByRole("dialog", { name: "Join a session", exact: true })
    .getByRole("textbox", { name: "Invitation link", exact: true })
    .fill(invite);
  await guest.getByRole("button", { name: "Connect", exact: true }).click();
}
async function collaboration(page: Page) {
  await page.getByRole("button", { name: "Collaborate", exact: true }).click();
  return page.getByRole("dialog", { name: "Work together", exact: true });
}

test("a fresh guest joins over WebRTC, edits both ways, reloads, and keeps local undo separate", async ({
  page,
  browser,
}) => {
  test.setTimeout(60000);
  const invite = await hostSession(page);
  expect(new URL(page.url()).searchParams.has("room")).toBe(false);
  const guestContext = await browser.newContext();
  try {
    const guest = await guestContext.newPage();
    await enterInvitation(guest, invite);
    await page.getByRole("button", { name: "Allow", exact: true }).click();
    await expect(guest.getByTestId("canvas-node")).toHaveCount(1);
    await expect(
      page.getByRole("status").filter({ hasText: "Connected · P2P" }),
    ).toBeVisible();
    const guestNode = guest.getByTestId("canvas-node");
    await guestNode.dblclick({ position: { x: 80, y: 30 } });
    await guestNode.getByRole("textbox").fill("Shared work");
    await guestNode.getByRole("textbox").press("Enter");
    await expect(page.getByTestId("canvas-node")).toContainText("Shared work");
    await guest.keyboard.press("p");
    await guest.mouse.move(650, 400);
    await guest.mouse.down();
    await guest.mouse.move(780, 460, { steps: 8 });
    await guest.mouse.up();
    await expect(page.locator('[data-node-type="freehand"]')).toHaveCount(1);
    await guest.keyboard.press("ControlOrMeta+z");
    await expect(page.locator('[data-node-type="freehand"]')).toHaveCount(0);
    await expect(page.getByTestId("canvas-node")).toContainText("Shared work");
    await guest.reload();
    await expect(guest.getByTestId("canvas-node")).toContainText("Shared work");
    const rejoinedPanel = await collaboration(guest);
    await expect(rejoinedPanel).toContainText("Connected · P2P", {
      timeout: 20000,
    });
    await guest
      .getByRole("button", { name: "Collaborate", exact: true })
      .click();
    if (
      (await page
        .getByRole("button", { name: "Collaborate", exact: true })
        .getAttribute("aria-expanded")) === "true"
    )
      await page
        .getByRole("button", { name: "Collaborate", exact: true })
        .click();
    await page
      .getByTestId("canvas-node")
      .dblclick({ position: { x: 80, y: 30 } });
    await page
      .getByTestId("canvas-node")
      .getByRole("textbox")
      .fill("Host update");
    await page.getByTestId("canvas-node").getByRole("textbox").press("Enter");
    await expect(guest.getByTestId("canvas-node")).toContainText("Host update");
    await collaboration(page);
    await page
      .getByRole("button", { name: "End session", exact: true })
      .click();
    const panel = await collaboration(guest);
    await expect(panel).toContainText("The host ended this session");
    await expect(guest.getByTestId("canvas-node")).toContainText("Host update");
    await guest.reload();
    await expect(guest.getByTestId("canvas-node")).toContainText("Host update");
    const savedPanel = await collaboration(guest);
    await savedPanel
      .getByRole("button", { name: "Save an independent copy", exact: true })
      .click();
    const link = savedPanel.getByRole("link", {
      name: "Open saved copy",
      exact: true,
    });
    await expect(link).toBeVisible();
    const copyUrl = await link.getAttribute("href");
    expect(copyUrl).toMatch(/^\/board\/doc-/);
    const independent = await guestContext.newPage();
    await independent.goto(copyUrl ?? "");
    await expect(independent.getByTestId("canvas-node")).toContainText(
      "Host update",
    );
    await independent
      .getByTestId("canvas-node")
      .dblclick({ position: { x: 80, y: 30 } });
    await independent
      .getByTestId("canvas-node")
      .getByRole("textbox")
      .fill("Private copy");
    await independent
      .getByTestId("canvas-node")
      .getByRole("textbox")
      .press("Enter");
    await expect(guest.getByTestId("canvas-node")).toContainText("Host update");
    await independent.reload();
    await expect(independent.getByTestId("canvas-node")).toContainText(
      "Private copy",
    );
    await page.reload();
    await expect(page.getByTestId("canvas-node")).toContainText("Host update");
  } finally {
    await guestContext.close();
  }
});

test("a declined guest cannot see the board", async ({ page, browser }) => {
  const invite = await hostSession(page);
  const context = await browser.newContext();
  try {
    const guest = await context.newPage();
    await enterInvitation(guest, invite);
    await page.getByRole("button", { name: "Decline", exact: true }).click();
    await expect(guest.getByRole("alert")).toContainText(
      "The host declined your request",
    );
    await expect(guest.getByTestId("canvas-node")).toHaveCount(0);
  } finally {
    await context.close();
  }
});

test("images transfer in chunks, pages stay navigable, and another guest can join after a departure", async ({
  page,
  browser,
}) => {
  test.setTimeout(60000);
  const invite = await hostSession(page);
  await page.getByRole("button", { name: "Collaborate", exact: true }).click();
  const chooser = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "Add to canvas", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Add to canvas", exact: true })
    .getByRole("button", { name: "Image", exact: true })
    .click();
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAACAAAAAYCAIAAAAUMWhjAAAAJElEQVR4nGPoWXeGpohh1IJRC0YtGLVg1IJRC0YtGLVgaFgAAL8eElvxwJm3AAAAAElFTkSuQmCC",
    "base64",
  );
  await (
    await chooser
  ).setFiles({
    name: "shared.png",
    mimeType: "image/png",
    buffer: Buffer.concat([png, Buffer.alloc(800000)]),
  });
  await expect(
    page.getByRole("group", { name: "Image", exact: true }).getByRole("img"),
  ).toBeVisible();
  await collaboration(page);
  const first = await browser.newContext();
  const second = await browser.newContext();
  try {
    const guest = await first.newPage();
    await enterInvitation(guest, invite);
    await page.getByRole("button", { name: "Allow", exact: true }).click();
    const image = guest
      .getByRole("group", { name: "Image", exact: true })
      .getByRole("img");
    await expect(image).toBeVisible();
    expect(
      await image.evaluate(
        (element) => (element as HTMLImageElement).naturalWidth,
      ),
    ).toBe(32);
    await guest.getByRole("button", { name: "Add page", exact: true }).click();
    await guest.keyboard.press("t");
    await guest.getByTestId("canvas").click({ position: { x: 420, y: 300 } });
    await guest
      .getByTestId("canvas-node")
      .dblclick({ position: { x: 50, y: 20 } });
    const text = guest.getByTestId("canvas-node").getByRole("textbox");
    await text.fill("On the second page");
    await text.press("Escape");
    await guest
      .getByTestId("page-tabs-bar")
      .getByText("Page 1", { exact: true })
      .click();
    await expect(
      guest.getByRole("group", { name: "Image", exact: true }),
    ).toBeVisible();
    await guest
      .getByTestId("page-tabs-bar")
      .getByText("Page 2", { exact: true })
      .click();
    await expect(guest.getByTestId("canvas-node")).toHaveCount(1);
    await expect(guest.getByTestId("canvas-node")).toContainText(
      "On the second page",
    );
    await page
      .getByTestId("page-tabs-bar")
      .getByText("Page 2", { exact: true })
      .click();
    await expect(page.getByTestId("canvas-node")).toContainText(
      "On the second page",
    );
    await first.close();
    if (
      (await page
        .getByRole("button", { name: "Collaborate", exact: true })
        .getAttribute("aria-expanded")) !== "true"
    )
      await collaboration(page);
    await expect(
      page.getByRole("dialog", { name: "Work together", exact: true }),
    ).toContainText("Waiting for a guest", { timeout: 12000 });
    const replacement = await second.newPage();
    await enterInvitation(replacement, invite);
    await page.getByRole("button", { name: "Allow", exact: true }).click();
    await replacement
      .getByTestId("page-tabs-bar")
      .getByText("Page 1", { exact: true })
      .click();
    await expect(
      replacement
        .getByRole("group", { name: "Image", exact: true })
        .getByRole("img"),
    ).toBeVisible();
    await page.screenshot({
      path: test.info().outputPath("collaboration-connected.png"),
    });
  } finally {
    await first.close();
    await second.close();
  }
});

test("three guests share one host, see cursors, and a fourth request is refused", async ({
  page,
  browser,
}) => {
  test.setTimeout(90000);
  const invite = await hostSession(page);
  const contexts = [];
  try {
    for (let index = 0; index < 3; index++) {
      const context = await browser.newContext();
      contexts.push(context);
      const guest = await context.newPage();
      await enterInvitation(guest, invite);
      await page.getByRole("button", { name: "Allow", exact: true }).click();
      await expect(guest.getByTestId("canvas-node")).toHaveCount(1);
      await guest.mouse.move(400 + index * 50, 350);
    }
    await expect(
      page.getByRole("dialog", { name: "Work together", exact: true }),
    ).toContainText("Connected · P2P · 4");
    await expect(page.getByTestId("remote-cursor")).toHaveCount(3);
    const returning = contexts[0]?.pages()[0];
    if (!returning) throw new Error("Missing guest");
    await returning.reload();
    await expect(returning.getByTestId("canvas-node")).toHaveCount(1);
    await expect(await collaboration(returning)).toContainText(
      "Connected · P2P",
      { timeout: 20000 },
    );
    await expect(
      page.getByRole("dialog", { name: "Work together", exact: true }),
    ).toContainText("Connected · P2P · 4");
    const overflow = await browser.newContext();
    contexts.push(overflow);
    const extra = await overflow.newPage();
    await enterInvitation(extra, invite);
    await expect(extra.getByRole("alert")).toContainText(
      "This session is full",
    );
    await page.screenshot({
      path: test.info().outputPath("four-collaborators.png"),
    });
  } finally {
    for (const context of contexts) await context.close();
  }
});
