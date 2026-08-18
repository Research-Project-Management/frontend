/**
 * Resilient clipboard operations with multi-tier fallback support.
 * Supports modern Clipboard API with fallback to document.execCommand and in-memory mock.
 */

import { logger } from '@/shared/lib/logger';

export interface ClipboardAdapter {
  writeText(text: string): Promise<boolean>;
  readText?(): Promise<string>;
}

/**
 * Modern Browser Clipboard API Adapter.
 */
export class NavigatorClipboardAdapter implements ClipboardAdapter {
  public async writeText(text: string): Promise<boolean> {
    if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
      return false;
    }
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      logger.warn('Navigator clipboard writeText failed, will try fallback', { err });
      return false;
    }
  }

  public async readText(): Promise<string> {
    if (typeof navigator === 'undefined' || !navigator.clipboard?.readText) {
      return '';
    }
    try {
      return await navigator.clipboard.readText();
    } catch {
      return '';
    }
  }
}

/**
 * Legacy DOM Selection Fallback Adapter (execCommand).
 * Used when running on HTTP origins, iframes, or environments without clipboard permissions.
 */
export class LegacyDomClipboardAdapter implements ClipboardAdapter {
  public async writeText(text: string): Promise<boolean> {
    if (typeof document === 'undefined') return false;

    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      textarea.style.top = '0';
      textarea.style.opacity = '0';

      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();

      const successful = document.execCommand('copy');
      document.body.removeChild(textarea);
      return successful;
    } catch (err) {
      logger.error('Legacy DOM copy fallback failed', err);
      return false;
    }
  }
}

/**
 * In-Memory Clipboard Adapter for unit tests and headless environments.
 */
export class InMemoryClipboardAdapter implements ClipboardAdapter {
  private content = '';

  public async writeText(text: string): Promise<boolean> {
    this.content = text;
    return true;
  }

  public async readText(): Promise<string> {
    return this.content;
  }
}

/**
 * Deep Clipboard Seam Manager.
 */
export class ClipboardClient {
  private modernAdapter: ClipboardAdapter;
  private fallbackAdapter: ClipboardAdapter;

  constructor(
    modernAdapter: ClipboardAdapter = new NavigatorClipboardAdapter(),
    fallbackAdapter: ClipboardAdapter = new LegacyDomClipboardAdapter(),
  ) {
    this.modernAdapter = modernAdapter;
    this.fallbackAdapter = fallbackAdapter;
  }

  public async copy(text: string): Promise<boolean> {
    // 1. Try modern clipboard API
    const modernOk = await this.modernAdapter.writeText(text);
    if (modernOk) return true;

    // 2. Fallback to legacy execCommand
    return await this.fallbackAdapter.writeText(text);
  }
}

/**
 * Singleton global clipboard client.
 */
export const clipboardClient = new ClipboardClient();

/**
 * Ergonomic standalone copy helper.
 *
 * @example
 * const success = await copyToClipboard("https://example.com");
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  return clipboardClient.copy(text);
}
