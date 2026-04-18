import { Page, expect } from "@playwright/test";

export class ChatPage {
  constructor(private page: Page) {}

  selectors = {
    authBar: '[data-testid="div-auth-bar"]',
    setupBodhiButton: '[data-testid="btn-setup-bodhi"]',
    loginButton: '[data-testid="btn-auth-login"]',
    authenticated: '[data-testid="section-auth"][data-teststate="authenticated"]',
    serverReady: '[data-testid="badge-server-status"][data-teststate="ready"]',
    setupOverlay: '[data-testid="div-setup-overlay-v2"]',
    setupIframe: '[data-testid="iframe-setup-v2"]',
    chatInput: '[data-testid="chat-input"]',
    sendButton: '[data-testid="send-button"]',
    modelSelector: '[data-testid="model-selector"]',
    modelSearchInput: '[data-testid="model-search-input"]',
    refreshModels: '[data-testid="btn-refresh-models"]',
    chatProcessing: '[data-testid="chat-processing"]',
    message: (turn: number, role: string) =>
      `[data-testid="chat-message-turn-${turn}"][data-messagetype="${role}"]`,
  };

  async waitServerReady(bodhiServerUrl: string): Promise<void> {
    await this.page.locator(this.selectors.authBar).waitFor();
    await this.page.locator(this.selectors.setupBodhiButton).click();
    await this.walkSetupModal(bodhiServerUrl);
    await this.page.locator(this.selectors.serverReady).waitFor();
  }

  private async walkSetupModal(bodhiServerUrl: string): Promise<void> {
    await this.page.locator(this.selectors.setupIframe).waitFor({ state: "attached" });
    const iframe = this.page.frameLocator(this.selectors.setupIframe);

    await iframe.getByTestId("div-setup-screen").waitFor();

    const urlInput = iframe.getByTestId("input-server-url");
    await urlInput.fill(bodhiServerUrl);
    await iframe.getByTestId("btn-connect").click();

    await iframe
      .getByTestId("text-probe-status-message")
      .filter({ hasText: "Server is connected" })
      .waitFor();
    await iframe.getByTestId("btn-continue").click();

    await this.page.locator(this.selectors.setupOverlay).waitFor({ state: "hidden" });
  }

  async login(credentials: { username: string; password: string }): Promise<void> {
    await this.page.locator(this.selectors.loginButton).click();

    await this.page.waitForURL(/\/ui\/login/);
    await this.page.getByRole("button", { name: "Login", exact: true }).click();

    await this.page.waitForURL(/\/realms\/bodhi\//);
    await this.page.locator("#username").waitFor();
    await this.page.fill("#username", credentials.username);
    await this.page.fill("#password", credentials.password);
    await this.page.click("#kc-login");

    await this.page.waitForURL(/\/access-requests\/review/);
    const checkboxes = this.page.locator('[role="checkbox"]');
    const count = await checkboxes.count();
    for (let i = 0; i < count; i++) {
      const checkbox = checkboxes.nth(i);
      if (await checkbox.isChecked().catch(() => false)) {
        await checkbox.click();
      }
    }
    await this.page.getByRole("button", { name: /Approve/ }).click();

    await this.page.waitForURL(/localhost:5173/);
    await this.page.locator(this.selectors.authenticated).waitFor();
  }

  async loadModels(): Promise<void> {
    await this.page.locator(this.selectors.refreshModels).click();
    await expect(this.page.locator(this.selectors.modelSelector)).toBeEnabled();
  }

  async selectModel(modelId: string): Promise<void> {
    const trigger = this.page.locator(this.selectors.modelSelector);
    await expect(trigger).toBeEnabled();
    await trigger.click();
    await this.page.locator(this.selectors.modelSearchInput).fill(modelId);
    await this.page.getByTestId(`model-option-${modelId}`).click();
    await expect(trigger).toContainText(modelId);
  }

  async send(prompt: string): Promise<void> {
    await this.page.locator(this.selectors.chatInput).fill(prompt);
    await this.page.locator(this.selectors.sendButton).click();
  }

  async waitForAssistantTurn(turn: number): Promise<void> {
    await this.page.locator(this.selectors.message(turn, "assistant")).waitFor();
    await this.page.locator(this.selectors.chatProcessing).waitFor({ state: "hidden" });
  }

  async getAssistantText(turn: number): Promise<string> {
    return (await this.page.locator(this.selectors.message(turn, "assistant")).textContent()) ?? "";
  }

  // --- Tool-call / tool-result helpers (Phase 2+) ---

  toolCallBubble(toolName: string, state?: "pending" | "executing" | "complete") {
    const base = `[data-testid="div-tool-call-${toolName}"]`;
    return this.page.locator(state ? `${base}[data-test-state="${state}"]` : base);
  }

  toolResultBubble(toolName: string, state?: "success" | "error") {
    const base = `[data-testid="div-tool-result-${toolName}"]`;
    return this.page.locator(state ? `${base}[data-test-state="${state}"]` : base);
  }

  toolResultContent(toolName: string) {
    return this.page
      .locator(`[data-testid="div-tool-result-${toolName}"]`)
      .locator('[data-testid="div-tool-result-content"]');
  }
}
