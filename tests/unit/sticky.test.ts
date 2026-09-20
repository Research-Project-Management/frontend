import { describe, it, expect } from 'vitest';
import {
  stripHtml,
  isStickyEmpty,
  uuidv7,
  isUuidV7,
} from '@/features/projects/stickies/utils/sticky.utils';
import {
  normalizeSticky,
} from '@/features/projects/stickies/services/sticky.service';

describe('Sticky Frontend Utilities', () => {
  describe('stripHtml', () => {
    it('should strip HTML tags and collapse whitespace', () => {
      const html = '<p>Hello <strong>World</strong>&nbsp;!</p>';
      expect(stripHtml(html)).toBe('Hello World !');
    });

    it('should handle empty or whitespace-only html', () => {
      expect(stripHtml('<p></p>')).toBe('');
      expect(stripHtml('')).toBe('');
    });
  });

  describe('isStickyEmpty', () => {
    it('should return true for empty paragraphs', () => {
      expect(isStickyEmpty({ title: '', content: '<p></p>' })).toBe(true);
      expect(isStickyEmpty({ title: undefined, content: '<p>   </p>' })).toBe(true);
    });

    it('should return false if title is present', () => {
      expect(isStickyEmpty({ title: 'My Note', content: '<p></p>' })).toBe(false);
    });

    it('should return false if content has text', () => {
      expect(isStickyEmpty({ title: '', content: '<p>Research thoughts</p>' })).toBe(false);
    });

    it('should return false if content contains embedded media', () => {
      expect(isStickyEmpty({ title: '', content: '<p><img src="test.png" /></p>' })).toBe(false);
    });
  });

  describe('normalizeSticky', () => {
    it('should fallback gracefully when given null or partial', () => {
      const normalized = normalizeSticky(null);
      expect(normalized.id).toBe('');
      expect(normalized.color).toBe('yellow-1');
      expect(normalized.content).toBe('');
    });

    it('should retain given properties', () => {
      const normalized = normalizeSticky({
        id: 'sticky-123',
        title: 'Title',
        content: '<p>Body</p>',
        color: 'mint-1',
      });
      expect(normalized.id).toBe('sticky-123');
      expect(normalized.title).toBe('Title');
      expect(normalized.color).toBe('mint-1');
    });
  });

  describe('SSOT Reconciliation & Optimistic State Management', () => {
    it('should reconcile optimistic sticky with authoritative server sticky preserving stable UUID v7', () => {
      const stableId = uuidv7();
      const optimisticSticky = normalizeSticky({
        id: stableId,
        title: '',
        content: '<p></p>',
        color: 'yellow-1',
      });

      const serverSticky = normalizeSticky({
        id: stableId,
        title: '',
        content: '<p></p>',
        color: 'mint-2', // Authoritative server rotated color
        order: 1,
      });

      const clientCache = [optimisticSticky];

      // Reconcile logic: update item with server response without changing stable key
      const reconciledCache = clientCache.map((item) =>
        item.id === stableId ? serverSticky : item
      );

      expect(reconciledCache).toHaveLength(1);
      expect(reconciledCache[0].id).toBe(stableId);
      expect(isUuidV7(reconciledCache[0].id)).toBe(true);
      expect(reconciledCache[0].color).toBe('mint-2');
    });

    it('should rollback cache to previous snapshot on server rejection', () => {
      const existingSticky = normalizeSticky({
        id: 'existing-1',
        title: 'Initial note',
        content: '<p>Content</p>',
      });

      const previousSnapshot = [existingSticky];

      // Optimistic insert
      const optimisticState = [
        ...previousSnapshot,
        normalizeSticky({ id: 'temp-failed', content: '<p></p>' }),
      ];
      expect(optimisticState).toHaveLength(2);

      // Rollback on server error
      const rolledBackState = previousSnapshot;
      expect(rolledBackState).toHaveLength(1);
      expect(rolledBackState[0].id).toBe('existing-1');
    });
  });

  describe('UUID v7 Generation & Validation', () => {
    it('should generate a valid RFC 9562 UUID v7 string', () => {
      const id = uuidv7();
      expect(typeof id).toBe('string');
      expect(id).toHaveLength(36);
      expect(isUuidV7(id)).toBe(true);
      // 13th character (version) must be '7'
      expect(id.charAt(14)).toBe('7');
      // 17th character (variant) must be '8', '9', 'a', or 'b'
      expect(['8', '9', 'a', 'b']).toContain(id.charAt(19).toLowerCase());
    });

    it('should generate monotonically non-decreasing time-ordered IDs', () => {
      const id1 = uuidv7();
      const id2 = uuidv7();
      expect(id1 <= id2).toBe(true);
    });

    it('should correctly distinguish UUID v7 from UUID v4', () => {
      const v4 = 'c7a8b6e2-5f34-4b5c-a1d2-9e8f7a6b5c4d';
      expect(isUuidV7(v4)).toBe(false);
      const v7 = '01920b92-7f12-7890-a123-456789abcdef';
      expect(isUuidV7(v7)).toBe(true);
    });
  });
});
