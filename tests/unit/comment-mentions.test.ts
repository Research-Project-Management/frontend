import { describe, it, expect, vi } from 'vitest';
import {
  detectMentionQuery,
  extractMentions,
  parseMentionTokens,
  formatMention,
  filterMentionMembers,
  type MentionMember,
} from '@/features/editor/utils/mention.util';
import { EditorEventBus } from '@/features/editor/utils/editor.util';

describe('@mention Autocomplete & Parsing (Overleaf Parity S)', () => {
  const mockMembers: MentionMember[] = [
    {
      id: 'u-1',
      name: 'Alice Johnson',
      email: 'alice@flux.latex',
      role: 'owner',
    },
    {
      id: 'u-2',
      name: 'Nguyễn Văn An',
      email: 'an.nguyen@flux.latex',
      role: 'coordinator',
    },
    {
      id: 'u-3',
      name: 'Bob Miller',
      email: 'bob@example.com',
      role: 'contributor',
    },
  ];

  describe('detectMentionQuery', () => {
    it('detects active mention right after typing @', () => {
      const text = 'Hello @';
      const result = detectMentionQuery(text, text.length);
      expect(result.active).toBe(true);
      expect(result.query).toBe('');
      expect(result.startIndex).toBe(6);
      expect(result.endIndex).toBe(7);
    });

    it('detects active mention with query characters', () => {
      const text = 'Please review this @Ali';
      const result = detectMentionQuery(text, text.length);
      expect(result.active).toBe(true);
      expect(result.query).toBe('Ali');
      expect(result.startIndex).toBe(19);
      expect(result.endIndex).toBe(23);
    });

    it('detects active mention with Vietnamese query characters', () => {
      const text = 'Nhờ @Nguyễn';
      const result = detectMentionQuery(text, text.length);
      expect(result.active).toBe(true);
      expect(result.query).toBe('Nguyễn');
    });

    it('ignores emails to prevent false positives (e.g. user@test.com)', () => {
      const text = 'Contact us at user@test.com';
      // Cursor right after 'user@test'
      const result = detectMentionQuery(text, 14);
      expect(result.active).toBe(false);
    });

    it('handles mention at the very beginning of the input', () => {
      const text = '@Bob check line 40';
      const result = detectMentionQuery(text, 4);
      expect(result.active).toBe(true);
      expect(result.query).toBe('Bob');
      expect(result.startIndex).toBe(0);
      expect(result.endIndex).toBe(4);
    });

    it('returns inactive when cursor is not in mention context', () => {
      const text = 'Just some regular text without triggers';
      const result = detectMentionQuery(text, 10);
      expect(result.active).toBe(false);
    });
  });

  describe('extractMentions', () => {
    it('extracts rich format mentions with user IDs', () => {
      const text = 'Can @[Alice Johnson](u-1) and @[Nguyễn Văn An](u-2) verify equation (3)?';
      const mentions = extractMentions(text);

      expect(mentions).toHaveLength(2);
      expect(mentions[0]).toEqual({
        name: 'Alice Johnson',
        id: 'u-1',
        raw: '@[Alice Johnson](u-1)',
      });
      expect(mentions[1]).toEqual({
        name: 'Nguyễn Văn An',
        id: 'u-2',
        raw: '@[Nguyễn Văn An](u-2)',
      });
    });

    it('extracts plain format mentions without IDs', () => {
      const text = 'Hey @BobMiller please review this line!';
      const mentions = extractMentions(text);

      expect(mentions).toHaveLength(1);
      expect(mentions[0].name).toBe('BobMiller');
      expect(mentions[0].id).toBeUndefined();
    });

    it('deduplicates identical mentions in the same message', () => {
      const text = '@[Alice](u-1) please see @[Alice](u-1) again';
      const mentions = extractMentions(text);

      expect(mentions).toHaveLength(1);
      expect(mentions[0].id).toBe('u-1');
    });

    it('returns empty array when no mentions are present', () => {
      expect(extractMentions('No mentions here')).toEqual([]);
      expect(extractMentions('')).toEqual([]);
    });
  });

  describe('parseMentionTokens', () => {
    it('tokenizes text containing rich mentions into chunks', () => {
      const text = 'Hello @[Alice Johnson](u-1), please check this!';
      const tokens = parseMentionTokens(text);

      expect(tokens).toEqual([
        { type: 'text', content: 'Hello ' },
        {
          type: 'mention',
          content: '@[Alice Johnson](u-1)',
          name: 'Alice Johnson',
          id: 'u-1',
        },
        { type: 'text', content: ', please check this!' },
      ]);
    });

    it('tokenizes plain mentions and text properly', () => {
      const text = 'Call @bob tomorrow';
      const tokens = parseMentionTokens(text);

      expect(tokens).toEqual([
        { type: 'text', content: 'Call ' },
        { type: 'mention', content: '@bob', name: 'bob' },
        { type: 'text', content: ' tomorrow' },
      ]);
    });

    it('handles text with consecutive mentions', () => {
      const text = '@[Alice](u-1) @[Bob](u-3)';
      const tokens = parseMentionTokens(text);

      expect(tokens).toHaveLength(3);
      expect(tokens[0].type).toBe('mention');
      expect(tokens[1].type).toBe('text'); // space
      expect(tokens[2].type).toBe('mention');
    });
  });

  describe('formatMention', () => {
    it('formats rich mention token when ID is provided', () => {
      expect(formatMention({ name: 'Alice', id: 'u-1' }, 'rich')).toBe('@[Alice](u-1)');
    });

    it('formats plain mention token when requested or missing ID', () => {
      expect(formatMention({ name: 'Alice', id: 'u-1' }, 'plain')).toBe('@Alice');
      expect(formatMention({ name: 'Bob' }, 'rich')).toBe('@Bob');
    });
  });

  describe('filterMentionMembers', () => {
    it('filters members by name (case-insensitive)', () => {
      const results = filterMentionMembers(mockMembers, 'ali');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Alice Johnson');
    });

    it('filters members by Vietnamese accented characters', () => {
      const results = filterMentionMembers(mockMembers, 'Nguyễn');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Nguyễn Văn An');
    });

    it('filters members by email address', () => {
      const results = filterMentionMembers(mockMembers, 'example.com');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Bob Miller');
    });

    it('returns all members when query is empty', () => {
      expect(filterMentionMembers(mockMembers, '')).toHaveLength(3);
      expect(filterMentionMembers(mockMembers, '   ')).toHaveLength(3);
    });
  });

  describe('EditorEventBus Mention Notifications', () => {
    it('dispatches and receives comment:mention review events', () => {
      const listener = vi.fn();
      const unsubscribe = EditorEventBus.on('flux:review-event', listener);

      const payload = {
        pageId: 'page-101',
        commentId: 'comment-55',
        mentionedUserIds: ['u-1', 'u-2'],
        content: 'Hey @[Alice](u-1) and @[An](u-2) take a look!',
      };

      EditorEventBus.emit('flux:review-event', {
        pageId: 'page-101',
        event: 'comment:mention',
        payload,
      });

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith({
        pageId: 'page-101',
        event: 'comment:mention',
        payload,
      });

      unsubscribe();
    });
  });
});
