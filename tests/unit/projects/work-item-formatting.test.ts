import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ItemHelpers } from '@/features/projects/project-id/work-items/utils/work-item.utils';
import { formatBytes } from '@/shared/utils/format';

describe('Work-Item Information Formatting Standards', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Freeze time at 2026-10-14T12:00:00Z
    vi.setSystemTime(new Date('2026-10-14T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('1. Date & Time Formatting', () => {
    it('formats date-only string accurately without timezone day-shift', () => {
      // 2026 is current year under fake timer
      expect(ItemHelpers.formatDate('2026-10-14')).toBe('14/10');
      expect(ItemHelpers.formatDate('2026-01-05')).toBe('05/01');
      // Previous year includes the full year
      expect(ItemHelpers.formatDate('2025-12-31')).toBe('31/12/2025');
    });

    it('returns empty string for null, undefined, or invalid dates', () => {
      expect(ItemHelpers.formatDate(null)).toBe('');
      expect(ItemHelpers.formatDate(undefined)).toBe('');
      expect(ItemHelpers.formatDate('')).toBe('');
      expect(ItemHelpers.formatDate('not-a-valid-date')).toBe('');
    });

    it('formats date ranges cohesively', () => {
      expect(ItemHelpers.formatDateRange('2026-10-10', '2026-10-14')).toBe('10/10 - 14/10');
      // When start and due are the same day
      expect(ItemHelpers.formatDateRange('2026-10-14', '2026-10-14')).toBe('14/10');
      // When only due date is provided
      expect(ItemHelpers.formatDateRange(null, '2026-10-14')).toBe('14/10');
      // When only start date is provided (no due date), returns empty according to standard
      expect(ItemHelpers.formatDateRange('2026-10-10', null)).toBe('');
    });

    it('formats relative activity times cleanly in English', () => {
      // 30 seconds ago
      const thirtySecAgo = new Date(Date.now() - 30 * 1000).toISOString();
      expect(ItemHelpers.formatActivityTime(thirtySecAgo)).toBe('Just now');

      // 15 minutes ago
      const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      expect(ItemHelpers.formatActivityTime(fifteenMinAgo)).toBe('15m ago');

      // 3 hours ago
      const threeHoursAgo = new Date(Date.now() - 3 * 3600 * 1000).toISOString();
      expect(ItemHelpers.formatActivityTime(threeHoursAgo)).toBe('3h ago');

      // Older than 24 hours (Oct 10, 2026)
      expect(ItemHelpers.formatActivityTime('2026-10-10T10:00:00Z')).toBe('Oct 10');

      // Previous year (Oct 10, 2025)
      expect(ItemHelpers.formatActivityTime('2025-10-10T10:00:00Z')).toBe('Oct 10, 2025');
    });
  });

  describe('2. Git Branch & Slug Formatting', () => {
    it('generates clean kebab-case slugs from English titles', () => {
      expect(ItemHelpers.toBranchSlug('Add CPM Critical Path Engine')).toBe('add-cpm-critical-path-engine');
    });

    it('normalizes Vietnamese Unicode diacritics into standard ASCII slugs', () => {
      expect(ItemHelpers.toBranchSlug('Tối ưu hoá hiệu năng truy vấn dữ liệu')).toBe(
        'toi-uu-hoa-hieu-nang-truy-van-du-lieu',
      );
      expect(ItemHelpers.toBranchSlug('Sửa lỗi phân quyền người dùng')).toBe(
        'sua-loi-phan-quyen-nguoi-dung',
      );
    });

    it('strips redundant identifier prefixes from titles to prevent duplicate IDs in branches', () => {
      expect(ItemHelpers.toBranchSlug('[FLUX-42] Implement Cache Layer', 'FLUX-42')).toBe(
        'implement-cache-layer',
      );
      expect(ItemHelpers.toBranchSlug('FLUX-42: Fix relation cycle bug', 'FLUX-42')).toBe(
        'fix-relation-cycle-bug',
      );
    });

    it('generates standard git branch names with identifier or feature fallback', () => {
      expect(
        ItemHelpers.formatGitBranch({
          identifier: 'FLUX-42',
          title: 'Tối ưu hoá hiệu năng truy vấn',
        }),
      ).toBe('flux-42-toi-uu-hoa-hieu-nang-truy-van');

      expect(
        ItemHelpers.formatGitBranch({
          identifier: undefined,
          title: 'Implement OAuth Login',
        }),
      ).toBe('feature/implement-oauth-login');
    });
  });

  describe('3. Work-Item Identifier Formatting', () => {
    it('resolves explicit identifiers cleanly', () => {
      expect(ItemHelpers.resolveIdentifier({ identifier: 'PROJ-101' })).toBe('PROJ-101');
    });

    it('formats sequential numbers with project prefix fallback', () => {
      expect(ItemHelpers.resolveIdentifier({ sequenceNumber: 42 }, 'FLUX')).toBe('FLUX-42');
      expect(ItemHelpers.resolveIdentifier({ sequenceNumber: 15 }, 'AI')).toBe('AI-15');
    });

    it('formats short ID slice when only UUID is available', () => {
      expect(ItemHelpers.resolveIdentifier({ id: 'c1234567-89ab-cdef' }, 'FLUX')).toBe('FLUX-C123');
    });
  });

  describe('4. File Size & Attachment Formatting', () => {
    it('formats bytes into clean human-readable units (B, KB, MB, GB)', () => {
      expect(formatBytes(0)).toBe('0 B');
      expect(formatBytes(512)).toBe('512 B');
      expect(formatBytes(1024)).toBe('1 KB');
      expect(formatBytes(1536)).toBe('1.5 KB');
      expect(formatBytes(10485760)).toBe('10 MB');
      expect(formatBytes(2684354560)).toBe('2.5 GB');
    });
  });
});
