import { describe, it, expect } from 'vitest';
import {
  formatBibtexContent,
  parseBibDocument,
  serializeBibDocument,
  parseBibContent,
} from '@/features/editor/domain/latex/bib-parser';
import { formatItemToBibtex } from '@/features/editor/subsystems/citation';
import type { Item } from '@/features/library/types/core.types';

describe('bib-parser (bibtex-tidy standardized)', () => {
  it('formats raw BibTeX cleanly via bibtex-tidy while preserving UTF-8 and comments', () => {
    const raw = `% Header comment
@ARTICLE{vaswani2017,
AUTHOR="Vaswani, Ashish and Shazeer, Noam",
TITLE = {Phân tích {Attention} Is All You Need},
PAGES = {10–20},
YEAR = {2017},
}`;

    const formatted = formatBibtexContent(raw);
    expect(formatted).toContain('% Header comment');
    expect(formatted).toContain('@article{vaswani2017,');
    expect(formatted).toContain('  author = {Vaswani, Ashish and Shazeer, Noam},');
    expect(formatted).toContain('  title = {Phân tích {Attention} Is All You Need},');
    expect(formatted).toContain('  pages = {10--20},');
    expect(formatted).not.toMatch(/,\n\}/);
  });

  it('round-trips parseBibDocument -> serializeBibDocument with nested braces and @string preserved', () => {
    const raw = `@string{NIPS = "NeurIPS"}

@inproceedings{devlin2019,
  title = {{BERT}: Pre-training of {Deep} Bidirectional Transformers},
  author = {Devlin, Jacob and Chang, Ming-Wei},
  booktitle = {NAACL},
  year = {2019}
}`;

    const doc = parseBibDocument(raw);
    expect(doc.preambleBlocks).toHaveLength(1);
    expect(doc.preambleBlocks[0]).toContain('@string{NIPS');
    expect(doc.entries).toHaveLength(1);
    expect(doc.entries[0].key).toBe('devlin2019');
    expect(doc.entries[0].fields.title).toBe('{BERT}: Pre-training of {Deep} Bidirectional Transformers');

    const serialized = serializeBibDocument(doc);
    expect(serialized).toContain('@string{');
    expect(serialized).toContain('@inproceedings{devlin2019,');
    expect(serialized).toContain('  booktitle = {NAACL},');
  });

  it('parses BibEntry list with nested braces and normalizes formatItemToBibtex types', () => {
    const entries = parseBibContent(
      `@incollection{smith2024, title = {Deep {NLP} Systems}, author = {Smith, Jane and Doe, John}, year = {2024}}`,
      'references.bib',
    );
    expect(entries).toHaveLength(1);
    expect(entries[0].title).toBe('Deep {NLP} Systems');
    expect(entries[0].authors).toEqual(['Smith, Jane', 'Doe, John']);

    const itemBib = formatItemToBibtex({
      id: 'item-1',
      citationKey: 'nguyen2025',
      itemType: 'bookSection',
      title: 'Chương 1',
      authors: ['Nguyễn, Văn A'],
      publicationTitle: 'Tuyển tập AI',
      year: 2025,
    } as unknown as Item);

    expect(itemBib).toContain('@incollection{nguyen2025,');
    expect(itemBib).toContain('  booktitle = {Tuyển tập AI},');
  });
});
