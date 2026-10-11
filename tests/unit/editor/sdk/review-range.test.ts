import { describe, it, expect } from 'vitest';
import { offsetsToRange, resolveRange } from '@/features/editor/sdk/manuscript/review.api';

describe('review range conversion', () => {
  const doc = 'line0\nline1\nabc';

  it('converts offsets across lines', () => {
    expect(offsetsToRange(doc, 2, 8)).toEqual({ startLine: 0, startCol: 2, endLine: 1, endCol: 2 });
    expect(offsetsToRange(doc, 12, 15)).toEqual({ startLine: 2, startCol: 0, endLine: 2, endCol: 3 });
  });

  it('prefers explicit range, then line/col, then offsets+content', () => {
    const r = { startLine: 1, startCol: 1, endLine: 1, endCol: 2 };
    expect(resolveRange({ range: r })).toBe(r);
    expect(resolveRange({ startLine: 3, startCol: 4 })).toEqual({ startLine: 3, startCol: 4, endLine: 3, endCol: 4 });
    expect(resolveRange({ fromIndex: 6, toIndex: 11, content: doc })).toEqual({
      startLine: 1, startCol: 0, endLine: 1, endCol: 5,
    });
  });

  it('rejects offsets without content instead of sending a wrong range', () => {
    expect(() => resolveRange({ fromIndex: 3, toIndex: 5 })).toThrow();
  });
});

