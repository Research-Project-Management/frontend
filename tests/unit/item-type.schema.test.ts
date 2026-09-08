// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  LIBRARY_ITEM_TYPES,
  ALL_CREATOR_TYPES,
  ALL_ITEM_TYPES_FLAT,
  FIELD_DEFINITIONS,
  getItemTypeDefinition,
  mapRegistryItemTypes,
} from '@/features/workspaces/library/schemas/item-type.schema';

describe('Frontend Item-Type Schema (Zotero v42 Source of Truth)', () => {
  it('should load all 37 bibliographic item types from official schema', () => {
    const keys = Object.keys(LIBRARY_ITEM_TYPES);
    expect(keys.length).toBe(37);
    expect(keys).toContain('journalArticle');
    expect(keys).toContain('preprint');
    expect(keys).toContain('book');
    expect(keys).toContain('bookSection');
    expect(keys).toContain('conferencePaper');
    // Non-bibliographic types must be excluded
    expect(keys).not.toContain('attachment');
    expect(keys).not.toContain('note');
    expect(keys).not.toContain('annotation');
  });

  it('should verify preprint schema fidelity with Zotero desktop', () => {
    const preprint = getItemTypeDefinition('preprint');
    expect(preprint).toBeDefined();
    expect(preprint?.itemType).toBe('preprint');
    expect(preprint?.primaryCreatorType).toBe('author');

    const fieldKeys = preprint?.fields.map((f) => f.field);
    expect(fieldKeys).toContain('archiveID');
    expect(fieldKeys).toContain('repository');
    expect(fieldKeys).toContain('genre');
    expect(fieldKeys).toContain('rights');
    expect(fieldKeys).toContain('extra');

    const archiveIdField = preprint?.fields.find((f) => f.field === 'archiveID');
    expect(archiveIdField?.label).toBe('Archive ID');
    expect(archiveIdField?.baseField).toBe('number');
  });

  it('should provide complete creator roles', () => {
    expect(Object.keys(ALL_CREATOR_TYPES).length).toBeGreaterThanOrEqual(30);
    expect(ALL_CREATOR_TYPES.author).toBe('Author');
    expect(ALL_CREATOR_TYPES.editor).toBe('Editor');
    expect(ALL_CREATOR_TYPES.translator).toBe('Translator');
  });

  it('should sort flat item types alphabetically', () => {
    expect(ALL_ITEM_TYPES_FLAT.length).toBe(37);
    for (let i = 1; i < ALL_ITEM_TYPES_FLAT.length; i++) {
      expect(ALL_ITEM_TYPES_FLAT[i - 1].label.localeCompare(ALL_ITEM_TYPES_FLAT[i].label)).toBeLessThanOrEqual(0);
    }
  });

  it('should map server registry response correctly', () => {
    const mockRegistry = [
      {
        itemType: 'preprint',
        label: 'Preprint',
        category: 'academic',
        primaryCreatorType: 'author',
        creatorTypes: [{ creatorType: 'author', label: 'Author', primary: true }],
        fields: [
          { key: 'title', label: 'Title', order: 1 },
          { key: 'archiveID', label: 'Archive ID', order: 2, baseField: 'number' },
        ],
        isBibliographic: true,
      },
    ];

    const result = mapRegistryItemTypes(mockRegistry);
    expect(result.length).toBe(1);
    expect(result[0].itemType).toBe('preprint');
    expect(result[0].fields.length).toBe(2);
    expect(result[0].fields[1].field).toBe('archiveID');
    expect(result[0].fields[1].baseField).toBe('number');
  });
});
