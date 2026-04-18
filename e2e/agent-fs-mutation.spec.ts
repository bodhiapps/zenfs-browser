import { test, expect } from "@playwright/test";
import { ChatPage } from "./tests/pages/ChatPage";
import { FileBrowserPage } from "./pages/FileBrowserPage";
import { installFsMock } from "./helpers/fs-mock";
import { FULL_MODEL_ID, getTestState } from "./tests/global-setup";

test.describe("Agent filesystem mutation journey", () => {
  test("agent writes, lists, and edits a vault file through chat", async ({
    page,
  }) => {
    test.setTimeout(180_000);
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

    await test.step("Ask the agent to write notes.md", async () => {
      await chat.send(
        "Use fs__write to create a file notes.md at the vault root with exactly the content: # My Notes",
      );
    });

    await test.step("fs__write tool-result reaches success", async () => {
      await expect(
        chat.toolResultBubble("fs__write", "success"),
      ).toBeVisible({ timeout: 60_000 });
      await chat.waitForAssistantTurn(0);
    });

    await test.step("Virtual file reflects the write", async () => {
      const content = await browser.readVirtualFile("notes.md");
      expect(content ?? "").toContain("# My Notes");
    });

    await test.step("Ask the agent to list files at the vault root", async () => {
      await chat.send(
        "List the files at the vault root using fs__ls (not recursive).",
      );
    });

    await test.step("fs__ls tool-result reaches success and lists both files", async () => {
      await expect(
        chat.toolResultBubble("fs__ls", "success"),
      ).toBeVisible({ timeout: 60_000 });
      const lsText =
        (await chat
          .toolResultContent("fs__ls")
          .first()
          .textContent()) ?? "";
      expect(lsText).toContain("README.md");
      expect(lsText).toContain("notes.md");
      await chat.waitForAssistantTurn(1);
    });

    await test.step("Ask the agent to edit line 1 of notes.md", async () => {
      await chat.send(
        "Use fs__edit on notes.md to replace line 1 with '# Updated notes'.",
      );
    });

    await test.step("fs__edit tool-result reaches success", async () => {
      await expect(
        chat.toolResultBubble("fs__edit", "success"),
      ).toBeVisible({ timeout: 60_000 });
      await chat.waitForAssistantTurn(2);
    });

    await test.step("Virtual file reflects the edit", async () => {
      const content = await browser.readVirtualFile("notes.md");
      expect(content ?? "").toContain("Updated notes");
    });
  });
});
