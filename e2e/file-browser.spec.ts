import { test, expect } from "@playwright/test";
import { FileBrowserPage } from "./pages/FileBrowserPage";
import { installFsMock } from "./helpers/fs-mock";

test.describe("File browser journey", () => {
  let browser: FileBrowserPage;

  test.beforeEach(async ({ page }) => {
    await installFsMock(page);
    browser = new FileBrowserPage(page);
  });

  test("browse directory and view file contents", async ({ page }) => {
    await test.step("Navigate to the app and see empty sidebar", async () => {
      await browser.goto();
      await expect(
        page.locator(browser.selectors.sidebarEmpty),
      ).toBeVisible();
      await expect(browser.openDirBtn).toBeVisible();
    });

    await test.step("Open a directory via picker", async () => {
      await browser.openDirectory();
      await expect(
        page.locator(browser.selectors.sidebarLoaded),
      ).toBeVisible();
      await expect(browser.dirName).toHaveText("test-project");
    });

    await test.step("Root directory entries are visible", async () => {
      await expect(browser.treeNode("src")).toBeVisible();
      await expect(browser.treeNode("docs")).toBeVisible();
      await expect(browser.treeNode("README-md")).toBeVisible();
      await expect(browser.treeNode("image-png")).toBeVisible();
      await expect(browser.treeNode("package-json")).toBeVisible();
    });

    await test.step("Expand src/ folder and see children", async () => {
      await browser.expandFolder("src");
      await expect(browser.treeNode("src-index-ts")).toBeVisible();
      await expect(browser.treeNode("src-utils-ts")).toBeVisible();
    });

    await test.step("Click README.md and view its content in the markdown editor", async () => {
      await browser.selectFile("README-md");
      const state = await browser.getViewerState();
      expect(state).toBe("editor");
      await expect(browser.markdownEditor).toBeVisible();
      await expect(browser.markdownEditable).toContainText("Test Project");
      await expect(browser.breadcrumb).toContainText("README.md");
    });

    await test.step("Click package.json and view its raw content", async () => {
      await browser.selectFile("package-json");
      const state = await browser.getViewerState();
      expect(state).toBe("loaded");
      const content = await browser.getFileContent();
      expect(content).toContain('"name": "test-project"');
    });

    await test.step("Click src/index.ts and view its content", async () => {
      await browser.selectFile("src-index-ts");
      const content = await browser.getFileContent();
      expect(content).toContain("console.log('hello world')");
    });

    await test.step("Click image.png shows unsupported message", async () => {
      await browser.selectFile("image-png");
      const state = await browser.getViewerState();
      expect(state).toBe("unsupported");
      await expect(
        page.locator(browser.selectors.unsupportedMsg),
      ).toBeVisible();
    });
  });

  test("edit markdown file and auto-save on blur", async ({ page }) => {
    await browser.goto();
    await browser.openDirectory();
    await browser.selectFile("README-md");

    await expect(browser.markdownEditor).toBeVisible();
    await expect(browser.markdownEditable).toContainText("Test Project");

    // Focus editor, move to end, type new content
    await browser.markdownEditable.click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await page.keyboard.type("Edited via Milkdown.");

    // Blur by focusing another element outside ProseMirror
    await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      el?.blur();
    });

    // Wait for save to complete — editor container flips to data-test-state=saved
    await expect(browser.markdownEditor).toHaveAttribute(
      "data-test-state",
      "saved",
      { timeout: 10000 },
    );

    // Verify the virtual file was updated
    const saved = await browser.readVirtualFile("README.md");
    expect(saved).not.toBeNull();
    expect(saved).toContain("Test Project");
    expect(saved).toContain("Edited via Milkdown.");
  });
});
