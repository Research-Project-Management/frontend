import { describe, it, expect } from 'vitest';
import {
  stripHtml,
  isStickyEmpty,
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
});
