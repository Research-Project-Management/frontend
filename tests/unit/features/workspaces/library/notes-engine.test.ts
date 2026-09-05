import { describe, it, expect } from 'vitest';
import { normalizeNotes } from '@/features/workspaces/library/utils/library.util';

describe('normalizeNotes Engine', () => {
  it('should return an empty array when given null, undefined, or empty list', () => {
    expect(normalizeNotes(null)).toEqual([]);
    expect(normalizeNotes(undefined)).toEqual([]);
    expect(normalizeNotes([])).toEqual([]);
  });

  it('should normalize legacy string notes into Note objects with stable fallback IDs', () => {
    // String notes get deterministic content-based hash IDs (local-{contentHash})
    // to avoid collision across re-renders. The hash is derived from the first
    // 32 chars of the note content, lowercased and stripped of non-alphanumeric chars.
    // 'Note 1' → 'note1' → id: 'local-note1'
    // 'Note 2' → 'note2' → id: 'local-note2'
    const raw = ['Note 1', 'Note 2'];
    const result = normalizeNotes(raw);

    expect(result).toHaveLength(2);
    expect(result[0]!.id).toBe('local-note1');
    expect(result[0]!.content).toBe('Note 1');
    expect(result[1]!.id).toBe('local-note2');
    expect(result[1]!.content).toBe('Note 2');
  });

  it('should normalize object notes carrying id', () => {
    const raw = [
      { id: 'note-id-1', content: 'Detailed note 1' },
      { id: 'note-id-2', content: 'Detailed note 2' },
    ];
    const result = normalizeNotes(raw);

    expect(result).toHaveLength(2);
    expect(result[0]!.id).toBe('note-id-1');
    expect(result[0]!.content).toBe('Detailed note 1');
    expect(result[1]!.id).toBe('note-id-2');
    expect(result[1]!.content).toBe('Detailed note 2');
  });

  it('should preserve createdAt and updatedAt timestamps when provided', () => {
    const createdAt = '2026-08-17T12:00:00Z';
    const updatedAt = '2026-08-17T12:30:00Z';
    const raw = [{ id: 'n-1', content: 'Timestamped', createdAt, updatedAt }];

    const result = normalizeNotes(raw);
    expect(result[0]!.createdAt).toBe(createdAt);
    expect(result[0]!.updatedAt).toBe(updatedAt);
  });
});
