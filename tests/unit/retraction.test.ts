import { describe, it, expect } from 'vitest';
import {
  retractionNatureSchema,
  flagRetractionInputSchema,
} from '@/features/workspaces/library/schemas/retraction.schema';
import { sortFilterItems } from '@/features/workspaces/library/utils/filter.util';
import type { Item } from '@/features/workspaces/library/types/library.types';

describe('retraction.schema', () => {
  it('validates supported retraction natures', () => {
    expect(retractionNatureSchema.parse('retraction')).toBe('retraction');
    expect(retractionNatureSchema.parse('expression_of_concern')).toBe('expression_of_concern');
    expect(retractionNatureSchema.parse('correction')).toBe('correction');
    expect(retractionNatureSchema.parse('manual')).toBe('manual');
    expect(() => retractionNatureSchema.parse('invalid_nature')).toThrow();
  });

  it('validates flagRetractionInputSchema with optional metadata', () => {
    const valid = flagRetractionInputSchema.parse({
      nature: 'retraction',
      reason: 'Falsified statistical evidence',
      noticeUrl: 'https://doi.org/10.1016/retraction-notice',
    });
    expect(valid.nature).toBe('retraction');
    expect(valid.reason).toBe('Falsified statistical evidence');
    expect(valid.noticeUrl).toBe('https://doi.org/10.1016/retraction-notice');
  });

  it('accepts defaults when optional fields are omitted', () => {
    const fallback = flagRetractionInputSchema.parse({});
    expect(fallback.nature).toBe('manual');
  });
});

describe('filter.util - retracted filter', () => {
  const dummyItems: Item[] = [
    {
      id: 'item-1',
      workspaceId: 'ws-1',
      title: 'Reliable Study',
      isRetracted: false,
      deletedAt: null,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    } as unknown as Item,
    {
      id: 'item-2',
      workspaceId: 'ws-1',
      title: 'Fabricated Data Paper',
      isRetracted: true,
      retractionNature: 'retraction',
      deletedAt: null,
      createdAt: '2026-01-02',
      updatedAt: '2026-01-02',
    } as unknown as Item,
    {
      id: 'item-3',
      workspaceId: 'ws-1',
      title: 'Deleted Retracted Paper',
      isRetracted: true,
      retractionNature: 'retraction',
      deletedAt: '2026-01-04T00:00:00Z',
      createdAt: '2026-01-03',
      updatedAt: '2026-01-03',
    } as unknown as Item,
  ];

  it('filters items correctly when activeFilter is retracted', () => {
    const result = sortFilterItems({
      items: dummyItems,
      activeFilter: 'retracted',
    });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('item-2');
    expect(result[0].title).toBe('Fabricated Data Paper');
  });

  it('returns empty array if no retracted items match', () => {
    const clearItems = [dummyItems[0]];
    const result = sortFilterItems({
      items: clearItems,
      activeFilter: 'retracted',
    });

    expect(result).toHaveLength(0);
  });
});
