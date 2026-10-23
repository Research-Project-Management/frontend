import { describe, it, expect } from 'vitest';
import {
  formatAndSanitizeExtraMetadata,
  formatExtraDisplay,
  isAllowedItemExtraKey,
} from '@/features/library/domain/metadata';
import {
  generateCitationKey,
  getCleanStyleLabel,
  formatCitationStyleLabel,
  DEFAULT_CITATION_STYLES,
} from '@/features/library/domain/citations';
import type { Item } from '@/features/library/domain/types/library.types';

describe('Zotero Wave 8: Citation, Export & Metadata Format Grounding & Accuracy Remediation', () => {
  // ===========================================================================
  // Case Study 1: Zero Internal Metadata Leakage in Zotero `Extra` Field
  // ===========================================================================
  describe('Case Study 1: Zero Internal Metadata Leakage in Zotero Extra Field', () => {
    it('strips internal system/audit keys and dedicated first-class Inspector fields while preserving genuine Zotero 7 Extra lines', () => {
      const pollutedExtraFields: Record<string, unknown> = {
        // Internal audit / duplicate / retraction state that used to leak into the Extra box
        dismissedDuplicateIds: ['dup-991', 'dup-992'],
        mergedCitationKeys: ['vaswani2017old'],
        isRetracted: false,
        retractionDate: '2024-01-15',
        retractionReasons: ['Data integrity concern'],
        retractionNoticeDoi: '10.1000/retract.1',
        provenance: { sourceProvider: 'crossref', confidence: 0.99 },
        sourceProvider: 'crossref',
        extractionStatus: 'COMPLETED',
        _version: 4,
        deletedAt: null,
        // First-class Inspector fields that already have dedicated inputs
        title: 'Attention Is All You Need',
        publicationTitle: 'Advances in Neural Information Processing Systems',
        volume: '30',
        issue: '1',
        pages: '5998-6008',
        doi: '10.5555/3295222.3295349',
        isbn: '978-1-5108-6096-4',
        issn: '1049-5258',
        url: 'https://papers.nips.cc/paper/7181-attention-is-all-you-need',
        year: 2017,
        itemType: 'conferencePaper',
        // Genuine Zotero 7 Extra fields that MUST be preserved
        PMID: '28601938',
        PMCID: 'PMC5551234',
        'Original Date': '1925',
        'tex.ids': 'vaswani2017old, vaswani2017nips',
        NIHMSID: 'NIHMS12345',
        OCLC: '1029384756',
      };

      const rawExtra =
        'PMID: 28601938\ndismissedDuplicateIds: ["dup-991"]\ntitle: Duplicate Title\nReviewed by Clinical Panel A';

      const sanitized = formatAndSanitizeExtraMetadata(rawExtra, pollutedExtraFields);

      // Genuine Zotero Extra key-values and free-text notes are preserved without duplication
      expect(sanitized).toContain('PMID: 28601938');
      expect(sanitized.match(/PMID:\s*28601938/g)?.length).toBe(1);
      expect(sanitized).toContain('PMCID: PMC5551234');
      expect(sanitized).toContain('Original Date: 1925');
      expect(sanitized).toContain('tex.ids: vaswani2017old, vaswani2017nips');
      expect(sanitized).toContain('NIHMSID: NIHMS12345');
      expect(sanitized).toContain('OCLC: 1029384756');
      expect(sanitized).toContain('Reviewed by Clinical Panel A');

      // Zero leakage of internal system keys or dedicated first-class Inspector fields
      expect(sanitized).not.toContain('dismissedDuplicateIds');
      expect(sanitized).not.toContain('mergedCitationKeys');
      expect(sanitized).not.toContain('isRetracted');
      expect(sanitized).not.toContain('retractionReasons');
      expect(sanitized).not.toContain('provenance');
      expect(sanitized).not.toContain('extractionStatus');
      expect(sanitized).not.toContain('_version');
      expect(sanitized).not.toContain('title:');
      expect(sanitized).not.toContain('publicationTitle');
      expect(sanitized).not.toContain('volume:');
      expect(sanitized).not.toContain('pages:');
      expect(sanitized).not.toContain('doi:');

      // Verify formatExtraDisplay also renders clean inline summary without internal keys
      const itemWithPollutedExtra: Item = {
        id: 'item-extra-1',
        title: 'Attention Is All You Need',
        itemType: 'conferencePaper',
        authors: ['Vaswani, Ashish'],
        tags: [],
        collections: [],
        notes: [],
        attachments: [],
        extra: JSON.stringify(pollutedExtraFields),
        extraFields: pollutedExtraFields,
      };

      const display = formatExtraDisplay(itemWithPollutedExtra);
      expect(display).toContain('PMID: 28601938');
      expect(display).toContain('PMCID: PMC5551234');
      expect(display).not.toContain('dismissedDuplicateIds');
      expect(display).not.toContain('publicationTitle');
      expect(isAllowedItemExtraKey('PMID')).toBe(true);
      expect(isAllowedItemExtraKey('tex.ids')).toBe(true);
      expect(isAllowedItemExtraKey('dismissedDuplicateIds')).toBe(false);
      expect(isAllowedItemExtraKey('volume')).toBe(false);
    });
  });

  // ===========================================================================
  // Case Study 2: Citation Key Generation & Suffix Disambiguation
  // ===========================================================================
  describe('Case Study 2: Citation Key Generation & Disambiguation', () => {
    it('generates standard author-year-title keys and resolves collisions with letter suffixes', () => {
      const key1 = generateCitationKey({
        title: 'Attention Is All You Need',
        authors: ['Vaswani, Ashish'],
        year: 2017,
      });
      expect(key1).toBe('vaswani2017attention');

      // Suffix collision
      const existing = new Set(['vaswani2017attention']);
      const key2 = generateCitationKey(
        {
          title: 'Attention Is All You Need',
          authors: ['Vaswani, Ashish'],
          year: 2017,
        },
        existing,
      );
      expect(key2).toBe('vaswani2017attentiona');
    });

    it('respects explicitly pinned citationKey or extra citekey', () => {
      const pinned = generateCitationKey({
        title: 'Some Paper',
        citationKey: 'custom_pin_2026',
      });
      expect(pinned).toBe('custom_pin_2026');

      const fromExtra = generateCitationKey({
        title: 'Another Paper',
        extra: 'Citation Key: my_extra_key',
      });
      expect(fromExtra).toBe('my_extra_key');
    });
  });

  // ===========================================================================
  // Case Study 3: UI Citation Style Presentation & Clean Labeling
  // ===========================================================================
  describe('Case Study 3: UI Citation Style Presentation & Clean Labeling', () => {
    it('formats clean, compact toolbar button labels without breaking layout', () => {
      expect(getCleanStyleLabel('apa-7th')).toBe('APA');
      expect(getCleanStyleLabel('mla-9th')).toBe('MLA');
      expect(getCleanStyleLabel('ieee')).toBe('IEEE');
      expect(getCleanStyleLabel('bibtex')).toBe('BibTeX');
      expect(getCleanStyleLabel('ris')).toBe('RIS');
      expect(getCleanStyleLabel('chicago-author-date')).toBe('Chicago');
    });

    it('formats human-friendly dropdown style names', () => {
      expect(formatCitationStyleLabel('apa-7th')).toBe('APA (7th Edition)');
      expect(formatCitationStyleLabel('ieee')).toBe('IEEE Style');
      expect(formatCitationStyleLabel('mla-9th')).toBe('MLA (9th Edition)');
      expect(formatCitationStyleLabel('chicago-author-date')).toBe('Chicago (Author-Date)');
      expect(formatCitationStyleLabel('harvard1')).toBe('Harvard');
      expect(formatCitationStyleLabel('vancouver')).toBe('Vancouver');
      expect(formatCitationStyleLabel('tcvn')).toBe('TCVN (Tiêu chuẩn Việt Nam)');
      expect(formatCitationStyleLabel({ id: 'nature', shortTitle: 'Nature Style' })).toBe('Nature');
    });

    it('provides standard default citation styles list for pickers', () => {
      expect(DEFAULT_CITATION_STYLES.length).toBeGreaterThanOrEqual(5);
      expect(DEFAULT_CITATION_STYLES.map((s) => s.id)).toContain('apa-7th');
      expect(DEFAULT_CITATION_STYLES.map((s) => s.id)).toContain('ieee');
    });
  });
});
