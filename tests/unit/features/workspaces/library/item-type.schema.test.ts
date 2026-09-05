import { describe, expect, it } from 'vitest';
import {
  getItemTypeDefinition,
  mapRegistryItemTypes,
} from '@/features/workspaces/library/schemas/item-type.schema';

describe('Library item-type registry adapter', () => {
  it('uses backend field keys and excludes technical item types', () => {
    const types = mapRegistryItemTypes([
      {
        itemType: 'dataset',
        label: 'Dataset',
        category: 'academic',
        primaryCreatorType: 'author',
        isBibliographic: true,
        creatorTypes: [{ creatorType: 'author', label: 'Author', primary: true }],
        fields: [
          { key: 'title', label: 'Title', order: 1, type: 'text', category: 'core' },
          { key: 'identifier', label: 'Identifier', order: 2, type: 'text', category: 'identifiers', baseField: 'number' },
        ],
      },
      {
        itemType: 'attachment',
        label: 'Attachment',
        category: 'special',
        primaryCreatorType: 'author',
        isBibliographic: false,
        creatorTypes: [],
        fields: [],
      },
    ]);

    expect(types).toHaveLength(1);
    expect(types[0]).toMatchObject({ itemType: 'dataset', label: 'Dataset' });
    expect(types[0].fields).toEqual([
      expect.objectContaining({ field: 'title' }),
      expect.objectContaining({ field: 'identifier', baseField: 'number' }),
    ]);
  });

  it('does not retain fields that are absent from the backend registry', () => {
    expect(getItemTypeDefinition('statute')?.fields.map((field) => field.field))
      .not.toContain('nameOfAct');
    expect(getItemTypeDefinition('podcast')?.fields.map((field) => field.field))
      .not.toContain('audioFileType');
    expect(getItemTypeDefinition('email')?.fields.map((field) => field.field))
      .not.toContain('subject');
  });
});
