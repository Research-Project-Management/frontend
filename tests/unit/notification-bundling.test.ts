import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  formatRemainingTime,
  formatDigestBadgeText,
  DEFAULT_BUNDLING_SETTINGS,
  type NotificationDigest,
  type NotificationBundle,
} from '@/features/editor/utils/notification-digest.util';
import { notificationBundlerService } from '@/features/editor/services/notification-bundler.service';
import { notificationBundlerKeys } from '@/features/editor/hooks/use-notification-bundler';
import * as api from '@/shared/lib/api';

vi.mock('@/shared/lib/api', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPut: vi.fn(),
  apiPatch: vi.fn(),
  apiDelete: vi.fn(),
}));

describe('Notification Bundling (10-Minute Digest - Overleaf Parity)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Countdown and Text Formatting Helpers', () => {
    it('formats remaining seconds properly', () => {
      expect(formatRemainingTime(0)).toBe('flushing...');
      expect(formatRemainingTime(-5)).toBe('flushing...');
      expect(formatRemainingTime(45)).toBe('45s');
      expect(formatRemainingTime(60)).toBe('1m');
      expect(formatRemainingTime(125)).toBe('2m 5s');
      expect(formatRemainingTime(600)).toBe('10m');
    });

    it('formats digest badge label with proper singular/plural items', () => {
      expect(formatDigestBadgeText(1, 600)).toBe('1 update (flushing in 10m)');
      expect(formatDigestBadgeText(3, 125)).toBe(
        '3 updates (flushing in 2m 5s)',
      );
      expect(formatDigestBadgeText(5, 0)).toBe(
        '5 updates (flushing in flushing...)',
      );
    });

    it('provides default settings with 10-minute window', () => {
      expect(DEFAULT_BUNDLING_SETTINGS.enabled).toBe(true);
      expect(DEFAULT_BUNDLING_SETTINGS.windowMinutes).toBe(10);
    });
  });

  describe('Frontend Service API Calls', () => {
    it('calls getPendingBundles and handles response', async () => {
      const mockBundles = [
        {
          bundle: {
            recipientId: 'user-1',
            projectId: 'proj-1',
            items: [],
            createdAt: '2026-09-21T09:00:00.000Z',
            flushAt: '2026-09-21T09:10:00.000Z',
          },
          itemCount: 2,
          remainingSeconds: 480,
        },
      ];

      vi.mocked(api.apiGet).mockResolvedValueOnce({ bundles: mockBundles });

      const res = await notificationBundlerService.getPendingBundles();
      expect(api.apiGet).toHaveBeenCalledWith(
        '/api/documents/notifications/bundles',
      );
      expect(res).toEqual(mockBundles);
    });

    it('calls flushBundle and returns digest', async () => {
      const mockDigest: NotificationDigest = {
        id: 'digest-1',
        recipientId: 'user-1',
        summary: 'Alice left 2 comments in "main.tex"',
        itemCount: 2,
        mentionCount: 0,
        commentCount: 2,
        replyCount: 0,
        suggestionCount: 0,
        authorSummaries: [
          {
            authorId: 'alice',
            authorName: 'Alice',
            mentionCount: 0,
            commentCount: 2,
            replyCount: 0,
            suggestionCount: 0,
          },
        ],
        items: [],
        createdAt: '2026-09-21T09:10:00.000Z',
        windowMinutes: 10,
      };

      vi.mocked(api.apiPost).mockResolvedValueOnce({ digest: mockDigest });

      const res = await notificationBundlerService.flushBundle(
        'proj-1',
        'proj-1',
      );
      expect(api.apiPost).toHaveBeenCalledWith(
        '/api/documents/notifications/bundles/flush',
        { scopeId: 'proj-1', projectId: 'proj-1' },
      );
      expect(res).toEqual(mockDigest);
    });

    it('calls updateSettings with custom window duration', async () => {
      const updated = { enabled: true, windowMinutes: 15 };
      vi.mocked(api.apiPut).mockResolvedValueOnce({ settings: updated });

      const res = await notificationBundlerService.updateSettings({
        windowMinutes: 15,
      });
      expect(api.apiPut).toHaveBeenCalledWith(
        '/api/documents/notifications/settings',
        { windowMinutes: 15 },
      );
      expect(res).toEqual(updated);
    });
  });

  describe('React Query Cache Keys', () => {
    it('defines distinct hierarchical cache keys', () => {
      expect(notificationBundlerKeys.bundles()).toEqual([
        'notification-bundler',
        'bundles',
      ]);
      expect(notificationBundlerKeys.digests()).toEqual([
        'notification-bundler',
        'digests',
      ]);
      expect(notificationBundlerKeys.settings()).toEqual([
        'notification-bundler',
        'settings',
      ]);
    });
  });
});
