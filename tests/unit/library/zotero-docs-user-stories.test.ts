/**
 * Wave 2: Zotero 7 Official Documentation & Power-User User Stories Stress Test Suite
 *
 * Tests the Frontend Library & Reader against 4 Zotero 7 Official Documentation
 * (`zotero.org/support/*`) & Power-User Workflows:
 * - User Story 1: "Add Item by Identifier" Multi-Identifier & Messy Copy-Paste Parsing
 * - User Story 2: Zotero "Extra" Field Cheater Syntax in Inspector & Quick Copy
 * - User Story 3: Zotero 7 PDF Reader Annotation Workflows (Inverted Drag, Out-of-Bounds, Multi-Facet Filter)
 * - User Story 4: Quick Copy & Batch Bibliography Generation across 5 Heterogeneous Item Types
 */

import { describe, it, expect } from 'vitest';
import {
  cleanDoi,
  extractArxivId,
  extractPmid,
  extractPmcId,
  cleanIsbn,
} from '@/features/library/domain/identifiers';
import {
  parseZoteroExtraField,
} from '@/features/library/domain/metadata';
import {
  generateCitationKey,
  formatBibTeX,
  formatRis,
  formatCslJson,
} from '@/features/library/domain/citations';
import {
  buildIdentifierIngestionPayload,
} from '@/features/library/sdk/queries/ingestion.queries';
import {
  PdfAnnotationEngine,
  formatInTextCitation,
  formatAnnotationCitation,
} from '@/features/library/domain/reader.domain';
import {
  buildFallbackCitation,
  buildFallbackBibtex,
} from '@/features/library/core/coordinator/batch-action.coordinator';
import type { Item } from '@/features/library/domain/types/library.types';
import type { ReaderAnnotation, ReaderDocument } from '@/features/library/domain/types/reader.types';

describe('Wave 2: Zotero 7 Official Documentation & Power-User User Stories', () => {
  // ===========================================================================
  // USER STORY 1: "Add Item by Identifier" Multi-Identifier & Messy Copy-Paste Parsing
  // ===========================================================================
  describe('User Story 1: "Add Item by Identifier" Magic Wand & Messy Copy-Paste Parsing', () => {
    it('strips trailing sentence punctuation, unmatched parentheses/brackets, and decodes URL-encoded SICI DOIs', () => {
      expect(cleanDoi('10.1038/nature14539.')).toBe('10.1038/nature14539');
      expect(cleanDoi('https://doi.org/10.1145/3442188.3445922).')).toBe('10.1145/3442188.3445922');
      expect(cleanDoi('(doi:10.1016/j.cell.2023.01.001);')).toBe('10.1016/j.cell.2023.01.001');

      // URL-encoded Wiley SICI DOI containing balanced parentheses, colons, angle brackets, and semicolons
      const encodedSiciDoi =
        'https://doi.org/10.1002/%28SICI%291097-0258%2819980815%2917%3A15%3C1661%3A%3AAID-SIM871%3E3.0.CO%3B2-2.';
      expect(cleanDoi(encodedSiciDoi)).toBe(
        '10.1002/(SICI)1097-0258(19980815)17:15<1661::AID-SIM871>3.0.CO;2-2',
      );
    });

    it('extracts ArXiv IDs, PMIDs, PMCIDs, and ISBN-10/13 (including X check digits) from parenthesized bibliography strings', () => {
      expect(extractArxivId('(arXiv:2305.18290v2).')).toBe('2305.18290v2');
      expect(extractArxivId('https://doi.org/10.48550/arXiv.2303.08774')).toBe('2303.08774');

      expect(extractPmid('https://pubmed.ncbi.nlm.nih.gov/34265844/')).toBe('34265844');
      expect(extractPmid('(PMID: 34265844).')).toBe('34265844');

      expect(extractPmcId('PMCID: PMC8284567')).toBe('PMC8284567');
      expect(extractPmcId('https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8284567/')).toBe('PMC8284567');

      expect(cleanIsbn('ISBN: 978-3-16-148410-0')).toBe('978-3-16-148410-0');
      expect(cleanIsbn('0-306-40615-2')).toBe('0-306-40615-2');
      expect(cleanIsbn('080442957X')).toBe('080442957X');
      expect(cleanIsbn('(ISBN 0-8044-2957-x).')).toBe('0-8044-2957-X');
    });

    it('accurately classifies PubMed URLs, arXiv URLs, DOI URLs, and ISBN-10 with X check digit in buildIdentifierIngestionPayload', () => {
      expect(
        buildIdentifierIngestionPayload('https://pubmed.ncbi.nlm.nih.gov/34265844/', {
          collectionId: 'col-bio',
        }),
      ).toEqual({
        source: 'pmid',
        pmid: '34265844',
        collectionId: 'col-bio',
        overrides: undefined,
      });

      expect(buildIdentifierIngestionPayload('https://arxiv.org/abs/2305.18290v2')).toEqual({
        source: 'arxiv',
        arxivId: '2305.18290v2',
        collectionId: undefined,
        overrides: undefined,
      });

      expect(buildIdentifierIngestionPayload('(arXiv:2305.18290v2).')).toEqual({
        source: 'arxiv',
        arxivId: '2305.18290v2',
        collectionId: undefined,
        overrides: undefined,
      });

      expect(
        buildIdentifierIngestionPayload(
          'https://doi.org/10.1002/%28SICI%291097-0258%2819980815%2917%3A15%3C1661%3A%3AAID-SIM871%3E3.0.CO%3B2-2).',
        ),
      ).toEqual({
        source: 'doi',
        doi: '10.1002/(SICI)1097-0258(19980815)17:15<1661::AID-SIM871>3.0.CO;2-2',
        collectionId: undefined,
        overrides: undefined,
      });

      expect(buildIdentifierIngestionPayload('080442957X')).toEqual({
        source: 'isbn',
        isbn: '080442957X',
        collectionId: undefined,
        overrides: undefined,
      });

      expect(buildIdentifierIngestionPayload('ISBN: 978-3-16-148410-0')).toEqual({
        source: 'isbn',
        isbn: '978-3-16-148410-0',
        collectionId: undefined,
        overrides: undefined,
      });
    });
  });

  // ===========================================================================
  // USER STORY 2: Zotero "Extra" Field Cheater Syntax in Inspector & Quick Copy
  // ===========================================================================
  describe('User Story 2: Zotero "Extra" Field Cheater Syntax Parsing & Fallbacks', () => {
    const zoteroExtraString = [
      'DOI: 10.1145/3442188.3445922',
      'Citation Key: bender2021stochastic',
      'arXiv: 2103.00020',
      'PMID: 34265844',
      'ISBN: 978-0-262-03561-3',
      'Event Place: Virtual Event, Canada',
      'Original Date: 1950',
      '{:Publisher: Association for Computing Machinery}',
    ].join('\n');

    it('parses both Key: Value lines and {:Key: Value} blocks in parseZoteroExtraField', () => {
      const parsed = parseZoteroExtraField(zoteroExtraString);
      expect(parsed.doi).toBe('10.1145/3442188.3445922');
      expect(parsed.DOI).toBe('10.1145/3442188.3445922');
      expect(parsed.citationKey).toBe('bender2021stochastic');
      expect(parsed.arxivId).toBe('2103.00020');
      expect(parsed.pmid).toBe('34265844');
      expect(parsed.isbn).toBe('978-0-262-03561-3');
      expect(parsed.eventPlace).toBe('Virtual Event, Canada');
      expect(parsed.originalDate).toBe('1950');
      expect(parsed.publisher).toBe('Association for Computing Machinery');
    });

    it('falls back to Extra field values in generateCitationKey, formatBibTeX, formatRis, and formatCslJson when top-level fields are empty', () => {
      const itemWithExtraOnly: Item = {
        id: 'extra-item-1',
        title: 'On the Dangers of Stochastic Parrots: Can Language Models Be Too Big?',
        itemType: 'conferencePaper',
        authors: ['Emily M. Bender', 'Timnit Gebru', 'Angelina McMillan-Major', 'Shmargaret Shmitchell'],
        proceedingsTitle: 'Proceedings of the 2021 ACM Conference on Fairness, Accountability, and Transparency',
        extra: zoteroExtraString,
      };

      expect(generateCitationKey(itemWithExtraOnly)).toBe('bender2021stochastic');

      const bibtex = formatBibTeX(itemWithExtraOnly);
      expect(bibtex).toContain('@inproceedings{bender2021stochastic,');
      expect(bibtex).toContain('doi = {10.1145/3442188.3445922}');
      expect(bibtex).toContain('eprint = {2103.00020}');
      expect(bibtex).toContain('address = {Virtual Event, Canada}');
      expect(bibtex).toContain('publisher = {Association for Computing Machinery}');
      expect(bibtex).toContain('year = {1950}');

      const ris = formatRis(itemWithExtraOnly);
      expect(ris).toContain('TY  - CONF');
      expect(ris).toContain('DO  - 10.1145/3442188.3445922');
      expect(ris).toContain('CY  - Virtual Event, Canada');
      expect(ris).toContain('PB  - Association for Computing Machinery');

      const csl = formatCslJson(itemWithExtraOnly);
      expect(csl.id).toBe('bender2021stochastic');
      expect(csl.type).toBe('paper-conference');
      expect(csl.DOI).toBe('10.1145/3442188.3445922');
      expect(csl.PMID).toBe('34265844');
      expect(csl.ISBN).toBe('978-0-262-03561-3');
      expect(csl['publisher-place']).toBe('Virtual Event, Canada');
      expect(csl.publisher).toBe('Association for Computing Machinery');
    });
  });

  // ===========================================================================
  // USER STORY 3: Zotero 7 PDF Reader Annotation Workflows
  // ===========================================================================
  describe('User Story 3: Zotero 7 PDF Reader Annotation Workflows', () => {
    it('normalizes and denormalizes inverted area highlight drag coordinates (x1 > x2, y1 > y2) and clamps out-of-bounds coordinates', () => {
      // User drags from bottom-right (0.85, 0.90) to top-left (0.15, 0.25)
      const invertedRect = PdfAnnotationEngine.normalizeRect({
        x1: 0.85,
        y1: 0.9,
        x2: 0.15,
        y2: 0.25,
        width: undefined as unknown as number,
        height: undefined as unknown as number,
      });
      expect(invertedRect.x1).toBeCloseTo(0.15, 5);
      expect(invertedRect.y1).toBeCloseTo(0.25, 5);
      expect(invertedRect.x2).toBeCloseTo(0.85, 5);
      expect(invertedRect.y2).toBeCloseTo(0.9, 5);
      expect(invertedRect.width).toBeCloseTo(0.7, 5);
      expect(invertedRect.height).toBeCloseTo(0.65, 5);

      // User drags with negative width/height and out-of-bounds end coordinates
      const negativeSizeRect = PdfAnnotationEngine.normalizeRect({
        x: 0.6,
        y: 0.7,
        width: -0.8, // drags left past 0 to -0.2
        height: -0.5, // drags up to 0.2
      });
      expect(negativeSizeRect.x1).toBeCloseTo(0, 5);
      expect(negativeSizeRect.x2).toBeCloseTo(0.6, 5);
      expect(negativeSizeRect.width).toBeCloseTo(0.6, 5);
      expect(negativeSizeRect.y1).toBeCloseTo(0.2, 5);
      expect(negativeSizeRect.y2).toBeCloseTo(0.7, 5);
      expect(negativeSizeRect.height).toBeCloseTo(0.5, 5);

      const pixelRect = PdfAnnotationEngine.denormalizeRect(invertedRect, 800, 1000);
      expect(pixelRect.x).toBeCloseTo(120, 3);
      expect(pixelRect.y).toBeCloseTo(250, 3);
      expect(pixelRect.width).toBeCloseTo(560, 3);
      expect(pixelRect.height).toBeCloseTo(650, 3);
    });

    it('filters annotations by search query (quoteText, selectedText, comment, tags), color, type, and page range, and formats exact page citations', () => {
      const annotations: Array<ReaderAnnotation & { selectedText?: string; tags?: string[] }> = [
        {
          id: 'ann-1',
          documentId: 'doc-1',
          type: 'highlight',
          pageNumber: 3,
          color: 'yellow',
          selectedText: 'scaled dot-product attention',
          comment: 'Core formula in Section 3.2',
          tags: ['equation', 'attention'],
        },
        {
          id: 'ann-2',
          documentId: 'doc-1',
          type: 'area',
          pageNumber: 7,
          color: 'blue',
          quoteText: 'Figure 2: Multi-Head Attention',
          comment: 'Architecture diagram',
          tags: ['diagram', 'figure'],
        },
        {
          id: 'ann-3',
          documentId: 'doc-1',
          type: 'note',
          pageNumber: 14,
          color: 'red',
          comment: 'Verify BLEU score on WMT 2014 English-to-German',
          tags: ['evaluation', 'bleu'],
        },
      ];

      // Search by tag
      expect(PdfAnnotationEngine.filterAnnotations(annotations, 'bleu').map((a) => a.id)).toEqual(['ann-3']);
      // Search by selectedText
      expect(PdfAnnotationEngine.filterAnnotations(annotations, 'scaled dot-product').map((a) => a.id)).toEqual([
        'ann-1',
      ]);
      // Filter by type and pageRange
      expect(
        PdfAnnotationEngine.filterAnnotations(annotations, '', 'all', {
          type: 'area',
          pageRange: [5, 10],
        }).map((a) => a.id),
      ).toEqual(['ann-2']);

      const doc: ReaderDocument = {
        id: 'doc-1',
        title: 'Attention Is All You Need',
        authors: ['Ashish Vaswani', 'Noam Shazeer', 'Niki Parmar'],
        year: 2017,
      };
      expect(formatInTextCitation(doc, 14)).toBe('(Vaswani et al., 2017, p. 14)');
      expect(formatAnnotationCitation(doc, 'att-1', 14, 'ann-3').label).toBe('(Vaswani et al., 2017, p. 14)');
    });
  });

  // ===========================================================================
  // USER STORY 4: Quick Copy & Batch Bibliography Generation (5 Heterogeneous Items)
  // ===========================================================================
  describe('User Story 4: Quick Copy & Batch Bibliography Generation Across Heterogeneous Types', () => {
    const heterogeneousItems: Item[] = [
      {
        id: 'batch-1',
        title: 'Deep Learning',
        itemType: 'journalArticle',
        authors: ['Yann LeCun', 'Yoshua Bengio', 'Geoffrey Hinton'],
        year: 2015,
        journal: 'Nature',
        volume: '521',
        pages: '436-444',
        doi: '10.1038/nature14539',
      },
      {
        id: 'batch-2',
        title: 'Attention Is All You Need',
        itemType: 'conferencePaper',
        authors: ['Ashish Vaswani', 'Noam Shazeer'],
        year: 2017,
        proceedingsTitle: 'Advances in Neural Information Processing Systems',
        pages: '5998-6008',
      },
      {
        id: 'batch-3',
        title: 'Parallel Distributed Processing: Explorations in the Microstructure of Cognition',
        itemType: 'book',
        creators: [
          { firstName: 'David E.', lastName: 'Rumelhart', creatorType: 'editor' },
          { firstName: 'James L.', lastName: 'McClelland', creatorType: 'editor' },
        ],
        year: 1986,
        publisher: 'MIT Press',
        place: 'Cambridge, MA',
        isbn: '978-0-262-68053-0',
      },
      {
        id: 'batch-4',
        title: 'Representation Learning: A Review and New Perspectives',
        itemType: 'thesis',
        authors: ['Ian Goodfellow'],
        year: 2014,
        university: 'Université de Montréal',
      },
      {
        id: 'batch-5',
        title: 'Zotero 7 Official Documentation: Adding Items by Identifier',
        itemType: 'webpage',
        creators: [{ name: 'Corporation for Digital Scholarship', fieldMode: 1 }],
        year: 2024,
        websiteTitle: 'Zotero Documentation',
        url: 'https://www.zotero.org/support/adding_items_to_zotero',
        accessDate: '2026-10-14T12:00:00Z',
      },
    ];

    it('maps all Zotero/CSL item types to accurate BibTeX entry types (@article, @inproceedings, @book with editor, @phdthesis with school, @misc with urldate, @incollection, @techreport)', () => {
      const batchBibtex = buildFallbackBibtex(heterogeneousItems);

      // 1. Journal Article -> @article + journal
      expect(batchBibtex).toContain('@article{lecun2015deep,');
      expect(batchBibtex).toContain('journal = {Nature}');

      // 2. Conference Paper -> @inproceedings + booktitle
      expect(batchBibtex).toContain('@inproceedings{vaswani2017attention,');
      expect(batchBibtex).toContain('booktitle = {Advances in Neural Information Processing Systems}');

      // 3. Book with Editors -> @book + editor + publisher + isbn
      expect(batchBibtex).toContain('@book{rumelhart1986parallel,');
      expect(batchBibtex).toContain('editor = {David E. Rumelhart and James L. McClelland}');
      expect(batchBibtex).toContain('publisher = {MIT Press}');
      expect(batchBibtex).toContain('isbn = {978-0-262-68053-0}');

      // 4. PhD Thesis -> @phdthesis + school
      expect(batchBibtex).toContain('@phdthesis{goodfellow2014representation,');
      expect(batchBibtex).toContain('school = {Université de Montréal}');

      // 5. Webpage -> @misc + url + urldate
      expect(batchBibtex).toContain('@misc{corporationfordigitalscholarship2024zotero,');
      expect(batchBibtex).toContain('url = {https://www.zotero.org/support/adding_items_to_zotero}');
      expect(batchBibtex).toContain('urldate = {2026-10-14}');

      // Also verify bookSection -> @incollection and report -> @techreport
      const bookChapterBib = formatBibTeX({
        title: 'Learning Internal Representations by Error Propagation',
        itemType: 'bookSection',
        authors: ['David E. Rumelhart', 'Geoffrey E. Hinton', 'Ronald J. Williams'],
        bookTitle: 'Parallel Distributed Processing',
        publisher: 'MIT Press',
        year: 1986,
      });
      expect(bookChapterBib).toContain('@incollection{rumelhart1986learning,');
      expect(bookChapterBib).toContain('booktitle = {Parallel Distributed Processing}');

      const techReportBib = formatBibTeX({
        title: 'GPT-4 Technical Report',
        itemType: 'report',
        creators: [{ name: 'OpenAI', fieldMode: 1 }],
        institution: 'OpenAI',
        year: 2023,
      });
      expect(techReportBib).toContain('@techreport{openai2023gpt4,');
      expect(techReportBib).toContain('institution = {OpenAI}');
    });

    it('maps all Zotero/CSL item types to accurate RIS tags (JOUR, CONF, BOOK, CHAP, THES, RPRT, ELEC)', () => {
      expect(formatRis(heterogeneousItems[0])).toContain('TY  - JOUR');
      expect(formatRis(heterogeneousItems[1])).toContain('TY  - CONF');
      expect(formatRis(heterogeneousItems[2])).toContain('TY  - BOOK');
      expect(formatRis(heterogeneousItems[3])).toContain('TY  - THES');
      expect(formatRis(heterogeneousItems[4])).toContain('TY  - ELEC');
      expect(
        formatRis({
          title: 'Chapter 1',
          itemType: 'bookSection',
          bookTitle: 'Collected Works',
          year: 2020,
        }),
      ).toContain('TY  - CHAP');
      expect(
        formatRis({
          title: 'Technical Memo',
          itemType: 'report',
          institution: 'MIT',
          year: 2021,
        }),
      ).toContain('TY  - RPRT');
    });

    it('builds APA and IEEE fallback citations for quick copy across heterogeneous items', () => {
      const apaArticle = buildFallbackCitation(heterogeneousItems[0], 'apa');
      expect(apaArticle).toBe(
        'LeCun, Y., Bengio, Y., Hinton, G. (2015). Deep Learning. Nature, 521, 436-444. https://doi.org/10.1038/nature14539',
      );

      const ieeeArticle = buildFallbackCitation(heterogeneousItems[0], 'ieee');
      expect(ieeeArticle).toBe(
        'Y. LeCun, Y. Bengio, G. Hinton, "Deep Learning," Nature, vol. 521, pp. 436-444, 2015. doi: 10.1038/nature14539.',
      );
    });
  });
});


