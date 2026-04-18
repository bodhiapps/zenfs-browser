import { test, expect } from "@playwright/test";
import { ChatPage } from "./tests/pages/ChatPage";
import { FileBrowserPage } from "./pages/FileBrowserPage";
import { installFsMock } from "./helpers/fs-mock";
import { FULL_MODEL_ID, getTestState } from "./tests/global-setup";

test.describe("Chat persistence journey", () => {
  test("history survives reload and sessions are isolated", async ({
    page,
  }) => {
    test.setTimeout(240_000);
    const { username, password, bodhiServerUrl } = getTestState();
    const browser = new FileBrowserPage(page);
    const chat = new ChatPage(page);

    await installFsMock(page);

    await test.step("Open app, log in, pick vault, select model", async () => {
      await page.goto("/");
      await chat.waitServerReady(bodhiServerUrl);
      await chat.login({ username, password });
      await browser.openDirectory();
      await expect(
        page.locator(
          '[data-testid="span-vault-status"][data-test-state="ready"]',
        ),
      ).toBeVisible({ timeout: 10_000 });
      await chat.loadModels();
      await chat.selectModel(FULL_MODEL_ID);
    });

    await test.step("Send two messages in the initial session", async () => {
      await chat.send("say hi in one short word");
      await chat.waitForAssistantTurn(0);
      await chat.send("what day comes after monday? answer in one word");
      await chat.waitForAssistantTurn(1);
    });

    // Record the initial session id by reading the first active session row.
    const initialSessionLocator = page
      .locator('[data-testid^="btn-chat-session-"][data-test-state="active"]')
      .first();
    await expect(initialSessionLocator).toBeVisible({ timeout: 10_000 });
    const initialSessionTestid =
      await initialSessionLocator.getAttribute("data-testid");
    expect(initialSessionTestid).toMatch(/^btn-chat-session-/);
    const initialId = initialSessionTestid!.replace("btn-chat-session-", "");

    let chatCompletionsHits = 0;
    await page.route("**/v1/chat/completions", (route) => {
      chatCompletionsHits += 1;
      return route.continue();
    });

    await test.step("Reload and restore without hitting the LLM", async () => {
      await page.reload();
      // After reload, Bodhi auth cookie + setup state + selected model are
      // persisted. The setup modal does NOT appear, so do not call
      // waitServerReady here — instead wait directly for the post-reload
      // ready state (server ready + authenticated).
      await expect(
        page.locator(
          '[data-testid="badge-server-status"][data-teststate="ready"]',
        ),
      ).toBeVisible({ timeout: 30_000 });
      await expect(
        page.locator(
          '[data-testid="section-auth"][data-teststate="authenticated"]',
        ),
      ).toBeVisible({ timeout: 15_000 });
      // Session list re-hydrates from Dexie with the previously active session.
      await expect(
        page.locator(
          `[data-testid="btn-chat-session-${initialId}"][data-test-state="active"]`,
        ),
      ).toBeVisible({ timeout: 15_000 });
      // Both prior turns rendered, without any new chat completion calls.
      await expect(
        page.locator('[data-testid="chat-message-turn-0"]').first(),
      ).toBeVisible({ timeout: 15_000 });
      await expect(
        page.locator('[data-testid="chat-message-turn-1"]').first(),
      ).toBeVisible();
      expect(chatCompletionsHits).toBe(0);
    });

    await test.step("Start a fresh session and send a message", async () => {
      await page.locator('[data-testid="btn-chat-session-new"]').click();
      // Chat area should be empty for the new session.
      await expect(
        page.locator('[data-testid="chat-message-turn-0"]'),
      ).toHaveCount(0);
      await chat.send("reply with the single word: fresh");
      await chat.waitForAssistantTurn(0);
      const reply = await chat.getAssistantText(0);
      expect(reply.toLowerCase()).toContain("fresh");
    });

    await test.step("Switch back to the original session and see both turns", async () => {
      await page
        .locator(`[data-testid="btn-chat-session-${initialId}"]`)
        .click();
      await expect(
        page.locator('[data-testid="chat-message-turn-0"]').first(),
      ).toBeVisible({ timeout: 10_000 });
      await expect(
        page.locator('[data-testid="chat-message-turn-1"]').first(),
      ).toBeVisible();
    });
  });
});
