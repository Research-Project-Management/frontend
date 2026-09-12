import { describe, it, expect, vi, beforeEach } from 'vitest';
import { itemSchema } from '@/features/workspaces/library/schemas/item.schema';
import { sortFilterItems } from '@/features/workspaces/library/utils/filter.util';
import { ItemService } from '@/features/workspaces/library/services/item.service';
import type { Item } from '@/features/workspaces/library/types/library.types';

// Mock the HTTP client helper
vi.mock('@/shared/lib/api', () => ({
  apiPost: vi.fn(),
  apiDelete: vi.fn(),
  apiGet: vi.fn(),
  apiPatch: vi.fn(),
  apiPut: vi.fn(),
}));

import { apiPost, apiDelete } from '@/shared/lib/api';

describe('item.schema - my-publications fields', () => {
  it('defaults isMyPublication to false when omitted', () => {
    const item = itemSchema.parse({
      id: 'item-1',
      title: 'Sample Paper',
    });
    expect(item.isMyPublication).toBe(false);
    expect(item.publicationConfirmedAt).toBeUndefined();
  });

  it('validates isMyPublication = true and publicationConfirmedAt timestamp', () => {
    const timestamp = '2026-09-12T20:00:00.000Z';
    const item = itemSchema.parse({
      id: 'item-2',
      title: 'Authored Paper',
      isMyPublication: true,
      publicationConfirmedAt: timestamp,
    });
    expect(item.isMyPublication).toBe(true);
    expect(item.publicationConfirmedAt).toBe(timestamp);
  });
});

describe('filter.util - my-publications view', () => {
  const dummyItems: Item[] = [
    {
      id: 'item-1',
      workspaceId: 'ws-1',
      title: 'Colleague Paper',
      isMyPublication: false,
      deletedAt: null,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    } as unknown as Item,
    {
      id: 'item-2',
      workspaceId: 'ws-1',
      title: 'My First Author Paper',
      isMyPublication: true,
      publicationConfirmedAt: '2026-02-01T00:00:00.000Z',
      deletedAt: null,
      createdAt: '2026-01-02',
      updatedAt: '2026-01-02',
    } as unknown as Item,
    {
      id: 'item-3',
      workspaceId: 'ws-1',
      title: 'Trashed Authored Paper',
      isMyPublication: true,
      deletedAt: '2026-01-04T00:00:00.000Z',
      createdAt: '2026-01-03',
      updatedAt: '2026-01-03',
    } as unknown as Item,
  ];

  it('filters items correctly when activeFilter is my-publications', () => {
    const result = sortFilterItems({
      items: dummyItems,
      activeFilter: 'my-publications',
    });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('item-2');
    expect(result[0].title).toBe('My First Author Paper');
    expect(result[0].isMyPublication).toBe(true);
  });

  it('filters items correctly when activeFilter is publications alias', () => {
    const result = sortFilterItems({
      items: dummyItems,
      activeFilter: 'publications',
    });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('item-2');
  });

  it('returns empty array if no publications exist in library', () => {
    const clearItems = [dummyItems[0]];
    const result = sortFilterItems({
      items: clearItems,
      activeFilter: 'my-publications',
    });

    expect(result).toHaveLength(0);
  });
});

describe('ItemService.setMyPublication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends POST request to mark paper as my publication', async () => {
    const mockItem = {
      id: 'item-123',
      title: 'My Paper',
      isMyPublication: true,
      publicationConfirmedAt: '2026-09-12T12:00:00.000Z',
    };
    (apiPost as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      success: true,
      item: mockItem,
    });

    const result = await ItemService.setMyPublication('ws-abc', 'item-123', true);

    expect(apiPost).toHaveBeenCalledWith(
      '/api/v1/workspaces/ws-abc/library/items/item-123/my-publication',
      {},
    );
    expect(result).toEqual(mockItem);
  });

  it('sends DELETE request to remove paper from my publications', async () => {
    const mockItem = {
      id: 'item-123',
      title: 'Not My Paper',
      isMyPublication: false,
      publicationConfirmedAt: null,
    };
    (apiDelete as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      success: true,
      item: mockItem,
    });

    const result = await ItemService.setMyPublication('ws-abc', 'item-123', false);

    expect(apiDelete).toHaveBeenCalledWith(
      '/api/v1/workspaces/ws-abc/library/items/item-123/my-publication',
    );
    expect(result).toEqual(mockItem);
  });
});
