import { test, expect } from "@playwright/test";
import { ChatPage } from "./tests/pages/ChatPage";
import { FileBrowserPage } from "./pages/FileBrowserPage";
import { installFsMock } from "./helpers/fs-mock";
import { FULL_MODEL_ID, getTestState } from "./tests/global-setup";

test.describe("Agent filesystem journey", () => {
  test("agent reads a vault file on request and answers using its content", async ({
    page,
  }) => {
    test.setTimeout(90_000);
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

    await test.step("Ask the agent to read README.md", async () => {
      await chat.send(
        "Please read the file README.md using fs__read and reply in one short sentence with the project title.",
      );
    });

    await test.step("fs__read tool bubble reaches a terminal state", async () => {
      await expect(
        chat.toolResultBubble("fs__read", "success"),
      ).toBeVisible({ timeout: 30_000 });
    });

    await test.step("Tool-result content shows the seeded README", async () => {
      const content = await chat
        .toolResultContent("fs__read")
        .first()
        .textContent();
      expect(content ?? "").toContain("Test Project");
    });

    await test.step("Assistant message references the file contents", async () => {
      await chat.waitForAssistantTurn(0);
      const reply = await chat.getAssistantText(0);
      expect(reply.toLowerCase()).toContain("test project");
    });
  });
});
