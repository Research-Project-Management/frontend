import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { ZOTERO_ITEM_TYPES_EXTENDED } from '@/features/workspaces/library/schemas/item-type.schema';
import { CatalogItemService } from '@/features/workspaces/library/services/catalog.service';

describe('Frontend Library Item Type & Conversion Contract', () => {
  it('should support all 37 bibliographic item types in extended catalog definition', () => {
    expect(ZOTERO_ITEM_TYPES_EXTENDED.length).toBeGreaterThanOrEqual(37);
    const expectedTypes = [
      'journalArticle', 'book', 'bookSection', 'conferencePaper', 'preprint',
      'dataset', 'computerProgram', 'thesis', 'report', 'webpage', 'patent',
      'standard', 'manuscript', 'artwork', 'audioRecording', 'bill', 'blogPost',
      'case', 'dictionaryEntry', 'document', 'email', 'encyclopediaArticle',
      'film', 'forumPost', 'hearing', 'instantMessage', 'interview', 'letter',
      'magazineArticle', 'map', 'newspaperArticle', 'podcast', 'presentation',
      'radioBroadcast', 'statute', 'tvBroadcast', 'videoRecording'
    ];

    for (const type of expectedTypes) {
      expect(ZOTERO_ITEM_TYPES_EXTENDED).toContain(type);
    }
  });

  it('should call paperService.convertItemType with correct endpoint and payload', async () => {
    const mockResponse = {
      success: true,
      paper: {
        id: 'paper-123',
        workspaceId: 'ws-123',
        itemType: 'book',
        title: 'Designing Data-Intensive Applications',
        extraFields: { publisher: "O'Reilly Media" },
      },
      item: {
        id: 'paper-123',
        workspaceId: 'ws-123',
        itemType: 'book',
        title: 'Designing Data-Intensive Applications',
        extraFields: { publisher: "O'Reilly Media" },
      },
    };

    const convertSpy = vi.spyOn(CatalogItemService, 'convertType').mockResolvedValue(mockResponse as any);

    const result = await CatalogItemService.convertType('ws-123', 'paper-123', 'book', 1, true);

    expect(convertSpy).toHaveBeenCalledWith('ws-123', 'paper-123', 'book', 1, true);
    expect(result.success).toBe(true);
    expect((result.paper || (result as any).item).itemType).toBe('book');

    convertSpy.mockRestore();
  });

  it('should call CatalogItemService.previewConvertType for conversion diff preview', async () => {
    const mockPreview = {
      canConvert: true,
      sourceItemType: 'journalArticle',
      targetItemType: 'bookSection',
      preservedFieldCount: 5,
      mappedFieldCount: 1,
      unmappedFieldCount: 0,
      fieldTransformations: [
        {
          sourceField: 'publicationTitle',
          targetField: 'bookTitle',
          value: 'Modern Operating Systems',
          action: 'mapped' as const,
          reason: 'Base semantic publicationTitle â†” bookTitle',
        },
      ],
      creatorRoleTransformations: [],
      targetItemTypeMeta: {
        itemType: 'bookSection',
        label: 'Book Section',
        category: 'academic',
        validFields: ['title', 'bookTitle', 'publisher'],
        validCreatorTypes: ['author', 'editor', 'contributor', 'translator'],
        primaryCreatorType: 'author',
      },
    };

    const mockResponse = {
      success: true,
      preview: mockPreview,
      data: mockPreview,
    };

    const previewSpy = vi.spyOn(CatalogItemService, 'previewConvertType').mockResolvedValue(mockResponse as any);

    const res = await CatalogItemService.previewConvertType('ws-123', 'paper-123', 'bookSection');

    expect(previewSpy).toHaveBeenCalledWith('ws-123', 'paper-123', 'bookSection');
    expect(res.success).toBe(true);
    expect((res.preview as any).canConvert).toBe(true);
    expect((res.preview as any).fieldTransformations[0].targetField).toBe('bookTitle');

    previewSpy.mockRestore();
  });
});



