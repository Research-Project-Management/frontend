/**
 * clipboard.test.ts
 *
 * Unit tests for the Deep Clipboard Seam and fallback cascade.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ClipboardClient,
  InMemoryClipboardAdapter,
  NavigatorClipboardAdapter,
  LegacyDomClipboardAdapter,
} from '@/shared/lib/clipboard';

describe('Clipboard Seam', () => {
  let inMemoryAdapter: InMemoryClipboardAdapter;

  beforeEach(() => {
    inMemoryAdapter = new InMemoryClipboardAdapter();
  });

  it('writes and reads text using InMemoryClipboardAdapter', async () => {
    const success = await inMemoryAdapter.writeText('Hello World');
    expect(success).toBe(true);
    const text = await inMemoryAdapter.readText();
    expect(text).toBe('Hello World');
  });

  it('uses modern adapter when write succeeds', async () => {
    const mockModern = {
      writeText: vi.fn().mockResolvedValue(true),
    };
    const mockFallback = {
      writeText: vi.fn().mockResolvedValue(false),
    };

    const client = new ClipboardClient(mockModern, mockFallback);
    const result = await client.copy('https://example.com');

    expect(result).toBe(true);
    expect(mockModern.writeText).toHaveBeenCalledWith('https://example.com');
    expect(mockFallback.writeText).not.toHaveBeenCalled();
  });

  it('falls back to legacy adapter when modern adapter fails', async () => {
    const mockModern = {
      writeText: vi.fn().mockResolvedValue(false),
    };
    const mockFallback = {
      writeText: vi.fn().mockResolvedValue(true),
    };

    const client = new ClipboardClient(mockModern, mockFallback);
    const result = await client.copy('Fallback token');

    expect(result).toBe(true);
    expect(mockModern.writeText).toHaveBeenCalledWith('Fallback token');
    expect(mockFallback.writeText).toHaveBeenCalledWith('Fallback token');
  });

  it('returns false when both modern and fallback adapters fail', async () => {
    const mockModern = {
      writeText: vi.fn().mockResolvedValue(false),
    };
    const mockFallback = {
      writeText: vi.fn().mockResolvedValue(false),
    };

    const client = new ClipboardClient(mockModern, mockFallback);
    const result = await client.copy('Failed payload');

    expect(result).toBe(false);
  });
});
