import { Page, Locator, expect } from '@playwright/test';

/**
 * editor.po.ts
 *
 * Page Object Model for Flux Manuscript Editor.
 * Models official Overleaf layout:
 * - 3-pane cockpit (Sidebar, Code/Visual Editor, PDF Viewer)
 * - Topbar action controls (Compile, Review, File menu)
 * - Modal dialogues (Word Count, Shortcuts, Project Settings)
 *
 * Citation: Overleaf UI Architecture (https://www.overleaf.com/learn)
 */
export class EditorPageObject {
  readonly page: Page;

  // Topbar Locators
  readonly topbar: Locator;
  readonly fileMenuTrigger: Locator;
  readonly compileButton: Locator;
  readonly reviewToggle: Locator;
  readonly historyToggle: Locator;
  readonly layoutToggle: Locator;

  // File Menu Items
  readonly menuNewFile: Locator;
  readonly menuWordCount: Locator;
  readonly menuDownloadSubmenu: Locator;
  readonly menuDownloadArxiv: Locator;
  readonly menuDownloadPdf: Locator;
  readonly menuDownloadSource: Locator;

  // Sidebar Locators
  readonly sidebar: Locator;
  readonly filesTabTrigger: Locator;
  readonly outlineTabTrigger: Locator;
  readonly reviewTabTrigger: Locator;
  readonly chatTabTrigger: Locator;
  readonly fileTree: Locator;

  // CodeMirror 6 Editor Locators
  readonly cmEditor: Locator;
  readonly cmContent: Locator;
  readonly cmGutter: Locator;

  // PDF Viewer Locators
  readonly pdfViewer: Locator;
  readonly pdfToolbar: Locator;
  readonly pdfCanvas: Locator;

  // Modals & Panels
  readonly wordCountDialog: Locator;
  readonly shortcutsModal: Locator;
  readonly reviewPanel: Locator;

  constructor(page: Page) {
    this.page = page;

    // Topbar
    this.topbar = page.locator('header, [role="banner"]').first();
    this.fileMenuTrigger = page.locator('button:has-text("File"), [role="menuitem"]:has-text("File")').first();
    this.compileButton = page.locator('button:has-text("Recompile"), button:has-text("Compile")').first();
    this.reviewToggle = page.locator('button:has-text("Review"), button[aria-label*="Review"]').first();
    this.historyToggle = page.locator('button:has-text("History")').first();
    this.layoutToggle = page.locator('button:has-text("Layout")').first();

    // Menu Sub-items
    this.menuNewFile = page.locator('[role="menuitem"]:has-text("New file")');
    this.menuWordCount = page.locator('[role="menuitem"]:has-text("Word count")');
    this.menuDownloadSubmenu = page.locator('[role="menuitem"]:has-text("Download")');
    this.menuDownloadArxiv = page.locator('[role="menuitem"]:has-text("arXiv")');
    this.menuDownloadPdf = page.locator('[role="menuitem"]:has-text("PDF")');
    this.menuDownloadSource = page.locator('[role="menuitem"]:has-text("source")');

    // Sidebar
    this.sidebar = page.locator('aside, [data-testid="sidebar"]').first();
    this.filesTabTrigger = page.locator('button[aria-label*="File"], button[data-tab="files"]').first();
    this.outlineTabTrigger = page.locator('button[aria-label*="Outline"], button[data-tab="outline"]').first();
    this.reviewTabTrigger = page.locator('button[aria-label*="Review"], button[data-tab="review"]').first();
    this.chatTabTrigger = page.locator('button[aria-label*="Chat"], button[data-tab="chat"]').first();
    this.fileTree = page.locator('[role="tree"], [data-testid="file-tree"]');

    // Code Editor (CM6)
    this.cmEditor = page.locator('.cm-editor');
    this.cmContent = page.locator('.cm-content');
    this.cmGutter = page.locator('.cm-gutters');

    // PDF Viewer
    this.pdfViewer = page.locator('[aria-label="PDF document preview"], [data-testid="pdf-viewer"]').first();
    this.pdfToolbar = page.locator('[data-testid="pdf-toolbar"], [role="toolbar"]').first();
    this.pdfCanvas = page.locator('canvas').first();

    // Modals
    this.wordCountDialog = page.locator('[role="dialog"]:has-text("Word Count")');
    this.shortcutsModal = page.locator('[role="dialog"]:has-text("Keyboard Shortcuts")');
    this.reviewPanel = page.locator('[data-testid="review-tab"], div:has-text("Track Changes")').first();
  }

  /**
   * Navigate to the manuscript editor route
   */
  async goto(projectId: string, pageId: string) {
    await this.page.goto(`/editor/${pageId}`, { waitUntil: 'domcontentloaded' });
    // Wait for the main editor container to be visible
    await expect(this.cmEditor.or(this.page.locator('.cm-editor'))).toBeVisible({ timeout: 15000 });
  }

  /**
   * Verify that manuscript editor does NOT have a redundant project-sharing/invitation modal
   * SSOT Constraint: Manuscript belongs to project; member management is strictly at /projects/:id/settings/members.
   */
  async assertNoRedundantShareModal() {
    const shareButton = this.topbar.locator('button:has-text("Share"), [aria-label="Share project"]');
    await expect(shareButton).toHaveCount(0);
  }

  /**
   * Type text into CodeMirror 6
   */
  async typeIntoEditor(text: string) {
    await this.cmContent.click();
    await this.page.keyboard.type(text, { delay: 10 });
  }

  /**
   * Simulate pasting content into CodeMirror 6 to test Smart Paste
   */
  async pasteHtmlContent(html: string) {
    await this.cmContent.click();
    await this.page.evaluate((htmlContent) => {
      const dt = new DataTransfer();
      dt.setData('text/html', htmlContent);
      dt.setData('text/plain', 'Pasted content');
      const event = new ClipboardEvent('paste', {
        clipboardData: dt,
        bubbles: true,
        cancelable: true,
      });
      document.querySelector('.cm-content')?.dispatchEvent(event);
    }, html);
  }

  /**
   * Open the File Menu
   */
  async openFileMenu() {
    await this.fileMenuTrigger.click();
  }

  /**
   * Trigger Word Count dialog from File Menu
   */
  async openWordCount() {
    await this.openFileMenu();
    await this.menuWordCount.click();
    await expect(this.wordCountDialog).toBeVisible();
  }

  /**
   * Trigger Recompile via button or shortcut
   */
  async recompile() {
    await this.compileButton.click();
  }

  /**
   * Open the Keyboard Shortcuts Cheat Sheet modal
   */
  async openKeyboardShortcuts() {
    await this.page.keyboard.press('Control+/');
  }

  /**
   * Toggle the Review mode (Track Changes)
   */
  async toggleReviewMode() {
    await this.page.locator('#sidebar-tab-review, button[aria-label*="Review"]').first().click();
  }
}
