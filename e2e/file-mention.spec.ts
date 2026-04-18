import { test, expect } from "@playwright/test";
import { ChatPage } from "./tests/pages/ChatPage";
import { FileBrowserPage } from "./pages/FileBrowserPage";
import { installFsMock } from "./helpers/fs-mock";
import { FULL_MODEL_ID, getTestState } from "./tests/global-setup";

test.describe("File @-mention journey", () => {
  test("user @-mentions a vault file and the agent answers from its contents", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const { username, password, bodhiServerUrl } = getTestState();
    const browser = new FileBrowserPage(page);
    const chat = new ChatPage(page);

    await installFsMock(page);

    await test.step("Open app, log in, pick vault", async () => {
      await page.goto("/");
      await chat.waitServerReady(bodhiServerUrl);
      await chat.login({ username, password });
      await browser.openDirectory();
      await expect(browser.dirName).toHaveText("test-project");
    });

    await test.step("Vault mounts via ZenFS", async () => {
      await expect(
        page.locator(
          '[data-testid="span-vault-status"][data-test-state="ready"]',
        ),
      ).toBeVisible({ timeout: 10_000 });
    });

    await test.step("Pick a model", async () => {
      await chat.loadModels();
      await chat.selectModel(FULL_MODEL_ID);
    });

    await test.step("Typing @src/u opens the mention popup with utils.ts", async () => {
      await chat.typeMention("src/u");
      await expect(chat.mentionPopup()).toBeVisible({ timeout: 5_000 });
      await expect(chat.mentionOption("src/utils.ts")).toBeVisible();
    });

    await test.step("Pressing Enter inserts @src/utils.ts into the input", async () => {
      await page.locator('[data-testid="chat-input"]').press("Enter");
      await expect(chat.mentionPopup()).toBeHidden();
      const value = await page
        .locator('[data-testid="chat-input"]')
        .inputValue();
      expect(value).toContain("@src/utils.ts ");
    });

    await test.step("Finish the prompt and send", async () => {
      // Append the question after the already-inserted mention + trailing space.
      await page
        .locator('[data-testid="chat-input"]')
        .type("what does this file do? reply in one short sentence");
      await page.locator('[data-testid="send-button"]').click();
    });

    await test.step("Assistant answers referencing the inlined content", async () => {
      await chat.waitForAssistantTurn(0);
      const reply = (await chat.getAssistantText(0)).toLowerCase();
      const mentionsContent =
        reply.includes("add") ||
        reply.includes("a + b") ||
        reply.includes("42");
      expect(mentionsContent).toBe(true);
    });

    await test.step("No fs__read tool-call was issued (content was inlined)", async () => {
      await expect(
        page.locator('[data-testid="div-tool-call-fs__read"]'),
      ).toHaveCount(0);
    });
  });
});
