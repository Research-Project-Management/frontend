import { describe, it, expect } from 'vitest';
import { formatAndSanitizeExtraMetadata } from '@/features/library/domain/metadata';
import {
  isDedicatedFieldForType,
  DEDICATED_FIELDS_BY_TYPE_MAP,
} from '@/features/library/domain/metadata-extra.constants';
import type { Item } from '@/features/library/domain/types/library.types';

describe('Extra metadata deduplication and dedicated field recognition', () => {
  it('correctly identifies license and journalAbbr as dedicated fields on journalArticle via aliases', () => {
    const journalArticleFields = DEDICATED_FIELDS_BY_TYPE_MAP.get('journalArticle')!;
    expect(journalArticleFields).toBeDefined();

    expect(isDedicatedFieldForType('license', journalArticleFields)).toBe(true);
    expect(isDedicatedFieldForType('rights', journalArticleFields)).toBe(true);
    expect(isDedicatedFieldForType('journalAbbr', journalArticleFields)).toBe(true);
    expect(isDedicatedFieldForType('journalAbbreviation', journalArticleFields)).toBe(true);

    // Non-dedicated arbitrary key
    expect(isDedicatedFieldForType('someCustomVariable', journalArticleFields)).toBe(false);
  });

  it('filters out duplicate dedicated fields (license, journalAbbr) from Extra display on journalArticle', () => {
    const mockItem: Partial<Item> = {
      itemType: 'journalArticle',
      rights: 'http://creativecommons.org/licenses/by/4.0/',
      journalAbbreviation: 'J Applied Clin Med Phys',
      extra: 'license: http://creativecommons.org/licenses/by/4.0/\njournalAbbr: J Applied Clin Med Phys\ncustomField: customValue',
      extraFields: {
        license: 'http://creativecommons.org/licenses/by/4.0/',
        journalAbbr: 'J Applied Clin Med Phys',
        customField: 'customValue',
      },
    };

    const formatted = formatAndSanitizeExtraMetadata(
      mockItem.extra,
      mockItem.extraFields as Record<string, unknown>,
      mockItem,
    );

    // Dedicated fields license and journalAbbr must be filtered out
    expect(formatted).not.toContain('license:');
    expect(formatted).not.toContain('journalAbbr:');
    // True unmapped / extra fields must be preserved
    expect(formatted).toContain('customField: customValue');
  });

  it('keeps raw Extra clean when only dedicated fields are present', () => {
    const mockItem: Partial<Item> = {
      itemType: 'journalArticle',
      rights: 'http://creativecommons.org/licenses/by/4.0/',
      journalAbbreviation: 'J Applied Clin Med Phys',
      extra: 'license: http://creativecommons.org/licenses/by/4.0/\njournalAbbr: J Applied Clin Med Phys',
      extraFields: {
        license: 'http://creativecommons.org/licenses/by/4.0/',
        journalAbbr: 'J Applied Clin Med Phys',
      },
    };

    const formatted = formatAndSanitizeExtraMetadata(
      mockItem.extra,
      mockItem.extraFields as Record<string, unknown>,
      mockItem,
    );

    expect(formatted).toBe('');
  });
});
