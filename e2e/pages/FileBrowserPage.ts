import type { Page, Locator } from "@playwright/test";

export class FileBrowserPage {
  readonly page: Page;

  readonly selectors = {
    sidebarContainer: '[data-testid="div-sidebar-container"]',
    sidebarLoaded:
      '[data-testid="div-sidebar-container"][data-test-state="loaded"]',
    sidebarEmpty:
      '[data-testid="div-sidebar-container"][data-test-state="empty"]',

    openDirBtn: '[data-testid="btn-sidebar-open"]',
    closeDirBtn: '[data-testid="btn-sidebar-close"]',
    restoreBtn: '[data-testid="btn-sidebar-restore"]',
    dirName: '[data-testid="span-sidebar-dirname"]',

    treeNode: (sanitized: string) => `[data-testid="div-tree-${sanitized}"]`,
    treeToggle: (sanitized: string) =>
      `[data-testid="btn-tree-toggle-${sanitized}"]`,

    viewerContainer: '[data-testid="div-viewer-container"]',
    viewerLoaded:
      '[data-testid="div-viewer-container"][data-test-state="loaded"]',
    viewerEmpty:
      '[data-testid="div-viewer-container"][data-test-state="empty"]',
    viewerUnsupported:
      '[data-testid="div-viewer-container"][data-test-state="unsupported"]',
    viewerContent: '[data-testid="pre-viewer-content"]',
    breadcrumb: '[data-testid="nav-viewer-breadcrumb"]',
    unsupportedMsg: '[data-testid="p-viewer-unsupported"]',
  };

  constructor(page: Page) {
    this.page = page;
  }

  get openDirBtn(): Locator {
    return this.page.locator(this.selectors.openDirBtn);
  }

  get dirName(): Locator {
    return this.page.locator(this.selectors.dirName);
  }

  get viewerContent(): Locator {
    return this.page.locator(this.selectors.viewerContent);
  }

  get breadcrumb(): Locator {
    return this.page.locator(this.selectors.breadcrumb);
  }

  treeNode(sanitized: string): Locator {
    return this.page.locator(this.selectors.treeNode(sanitized));
  }

  treeToggle(sanitized: string): Locator {
    return this.page.locator(this.selectors.treeToggle(sanitized));
  }

  async goto(): Promise<void> {
    await this.page.goto("/");
    await this.page.locator(this.selectors.sidebarEmpty).waitFor();
  }

  async openDirectory(): Promise<void> {
    await this.openDirBtn.click();
    await this.page.locator(this.selectors.sidebarLoaded).waitFor();
  }

  async expandFolder(sanitizedPath: string): Promise<void> {
    await this.treeToggle(sanitizedPath).click();
  }

  async selectFile(sanitizedPath: string): Promise<void> {
    await this.treeNode(sanitizedPath).click();
    await this.page
      .locator(
        `${this.selectors.viewerLoaded}, ${this.selectors.viewerUnsupported}`,
      )
      .waitFor();
  }

  async getViewerState(): Promise<string> {
    return (
      (await this.page
        .locator(this.selectors.viewerContainer)
        .getAttribute("data-test-state")) ?? "unknown"
    );
  }

  async getFileContent(): Promise<string> {
    return (await this.viewerContent.textContent()) ?? "";
  }
}
