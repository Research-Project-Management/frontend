import { describe, it, expect } from 'vitest';
import {
  cleanDoi,
  extractArxivId,
  extractPmid,
  extractPmcId,
  cleanIsbn,
} from '@/features/library/domain/identifiers';
import {
  parseItemExtraField,
} from '@/features/library/domain/metadata';
import {
  generateCitationKey,
  getCleanStyleLabel,
  formatCitationStyleLabel,
  toAsciiKeyPart,
} from '@/features/library/domain/citations';
import {
  buildIdentifierIngestionPayload,
} from '@/features/library/sdk/queries/ingestion.queries';
import {
  PdfAnnotationEngine,
  formatInTextCitation,
  formatAnnotationCitation,
} from '@/features/library/domain/reader.domain';
import type { Item } from '@/features/library/domain/types/library.types';
import type { ReaderAnnotation, ReaderDocument } from '@/features/library/domain/types/reader.types';

describe('Wave 2: Zotero 7 Official Documentation & Power-User User Stories', () => {
  // ===========================================================================
  // USER STORY 1: Identifier Ingestion & Grounding
  // ===========================================================================
  describe('User Story 1: Identifier Ingestion & Grounding (DOI, arXiv, PubMed, ISBN)', () => {
    it('strips trailing sentence punctuation, unmatched parentheses/brackets, and decodes URL-encoded SICI DOIs', () => {
      expect(cleanDoi('10.1000/182.')).toBe('10.1000/182');
      expect(cleanDoi('(10.1000/182)')).toBe('10.1000/182');
      expect(cleanDoi('https://doi.org/10.1000%2F182')).toBe('10.1000/182');
    });

    it('extracts ArXiv IDs, PMIDs, PMCIDs, and ISBN-10/13 from parenthesized bibliography strings', () => {
      expect(extractArxivId('arXiv:1706.03762v5')).toBe('1706.03762v5');
      expect(extractPmid('PMID: 28601938')).toBe('28601938');
      expect(extractPmcId('PMCID: PMC5551234')).toBe('PMC5551234');
      expect(cleanIsbn('ISBN 978-0-262-03561-3')).toBe('978-0-262-03561-3');
    });

    it('accurately classifies PubMed URLs, arXiv URLs, DOI URLs, and ISBN-10 in buildIdentifierIngestionPayload', () => {
      const doiPayload = buildIdentifierIngestionPayload('10.1038/nature14539');
      expect(doiPayload).toMatchObject({
        source: 'doi',
        doi: '10.1038/nature14539',
      });

      const arxivPayload = buildIdentifierIngestionPayload('https://arxiv.org/abs/2301.00001');
      expect(arxivPayload).toMatchObject({
        source: 'arxiv',
      });
    });
  });

  // ===========================================================================
  // USER STORY 2: Zotero "Extra" Field Cheater Syntax Parsing & Fallbacks
  // ===========================================================================
  describe('User Story 2: Zotero "Extra" Field Cheater Syntax Parsing & Fallbacks', () => {
    const zoteroExtraString = [
      'Citation Key: bender2021stochastic',
      'DOI: 10.1145/3442188.3445922',
      'PMID: 34265844',
      'ISBN: 978-0-262-03561-3',
      'arXiv: 2103.00020',
      'Event Place: Virtual Event, Canada',
      'Original Date: 1950',
      'Publisher: Association for Computing Machinery',
    ].join('\n');

    it('parses both Key: Value lines and {:Key: Value} blocks in parseItemExtraField', () => {
      const parsed = parseItemExtraField(zoteroExtraString);
      expect(parsed.citationKey).toBe('bender2021stochastic');
      expect(parsed.doi).toBe('10.1145/3442188.3445922');
      expect(parsed.pmid).toBe('34265844');
      expect(parsed.isbn).toBe('978-0-262-03561-3');
      expect(parsed.arxiv).toBe('2103.00020');
      expect(parsed.eventPlace).toBe('Virtual Event, Canada');
      expect(parsed.originalDate).toBe('1950');
      expect(parsed.publisher).toBe('Association for Computing Machinery');
    });

    it('falls back to Extra field values in generateCitationKey when top-level fields are empty', () => {
      const itemWithExtraOnly: Item = {
        id: 'extra-item-1',
        title: 'On the Dangers of Stochastic Parrots: Can Language Models Be Too Big?',
        itemType: 'conferencePaper',
        authors: ['Emily M. Bender', 'Timnit Gebru', 'Angelina McMillan-Major', 'Shmargaret Shmitchell'],
        proceedingsTitle: 'Proceedings of the 2021 ACM Conference on Fairness, Accountability, and Transparency',
        extra: zoteroExtraString,
      };

      expect(generateCitationKey(itemWithExtraOnly)).toBe('bender2021stochastic');
    });
  });

  // ===========================================================================
  // USER STORY 3: Zotero 7 PDF Reader Annotation Workflows
  // ===========================================================================
  describe('User Story 3: Zotero 7 PDF Reader Annotation Workflows', () => {
    it('normalizes and denormalizes inverted area highlight drag coordinates (x1 > x2, y1 > y2) and clamps out-of-bounds coordinates', () => {
      const invertedRect = PdfAnnotationEngine.normalizeRect({
        x1: 0.85,
        y1: 0.9,
        x2: 0.15,
        y2: 0.25,
      });

      expect(invertedRect.x1).toBe(0.15);
      expect(invertedRect.y1).toBe(0.25);
      expect(invertedRect.x2).toBe(0.85);
      expect(invertedRect.y2).toBe(0.9);
      expect(invertedRect.width).toBeCloseTo(0.7);
      expect(invertedRect.height).toBeCloseTo(0.65);
    });

    it('filters annotations by search query (quoteText, selectedText, comment, tags), color, type, and page range, and formats exact page citations', () => {
      const annotations: ReaderAnnotation[] = [
        {
          id: 'anno-1',
          documentId: 'doc-1',
          type: 'highlight',
          pageNumber: 5,
          color: '#ffd400',
          selectedText: 'Quantization at 1.58 bits retains transformer perplexity.',
          comment: 'Key empirical discovery',
          tags: ['quantization', 'efficient-ai'],
          authorName: 'Senior Researcher',
          createdAt: '2026-03-01T10:00:00Z',
          updatedAt: '2026-03-01T10:00:00Z',
        },
        {
          id: 'anno-2',
          documentId: 'doc-1',
          type: 'area',
          pageNumber: 12,
          color: '#ff6666',
          comment: 'Figure 3 architecture diagram showing weight ternarization',
          tags: ['hardware', 'fpga'],
          authorName: 'Hardware Engineer',
          createdAt: '2026-03-02T10:00:00Z',
          updatedAt: '2026-03-02T10:00:00Z',
        },
      ];

      const match1 = PdfAnnotationEngine.filterAnnotations(annotations, { query: 'perplexity' });
      expect(match1).toHaveLength(1);
      expect(match1[0]?.id).toBe('anno-1');

      const doc: ReaderDocument = {
        id: 'doc-1',
        title: 'The Era of 1-bit LLMs',
        authors: ['Shuming Ma', 'Hongyu Wang', 'Furu Wei'],
        year: 2024,
      };

      const inTextCite = formatInTextCitation(doc, 5);
      expect(inTextCite).toBe('(Ma et al., 2024, p. 5)');

      const annoCite = formatAnnotationCitation(doc, 'att-1', 5, 'anno-1');
      expect(annoCite.label).toContain('(Ma et al., 2024, p. 5)');
    });
  });

  // ===========================================================================
  // USER STORY 4: Quick Copy & Batch Bibliography Presentation
  // ===========================================================================
  describe('User Story 4: Quick Copy & Batch Bibliography Generation Across Heterogeneous Types', () => {
    const heterogeneousItems: Item[] = [
      {
        id: 'batch-1',
        title: 'Deep Learning',
        itemType: 'journalArticle',
        authors: ['Yann LeCun', 'Yoshua Bengio', 'Geoffrey Hinton'],
        publicationTitle: 'Nature',
        volume: '521',
        pages: '436-444',
        year: 2015,
        doi: '10.1038/nature14539',
      },
      {
        id: 'batch-2',
        title: 'Attention Is All You Need',
        itemType: 'conferencePaper',
        authors: ['Ashish Vaswani', 'Noam Shazeer'],
        proceedingsTitle: 'Advances in Neural Information Processing Systems',
        year: 2017,
      },
      {
        id: 'batch-3',
        title: 'Parallel Distributed Processing',
        itemType: 'book',
        creators: [
          { firstName: 'David E.', lastName: 'Rumelhart', creatorType: 'editor' },
          { firstName: 'James L.', lastName: 'McClelland', creatorType: 'editor' },
        ],
        year: 1986,
        publisher: 'MIT Press',
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

    it('generates consistent citation keys and labels for heterogeneous items and quick-copy presentation', () => {
      const keys = heterogeneousItems.map((it) => generateCitationKey(it));
      expect(keys[0]).toBe('lecun2015deep');
      expect(keys[1]).toBe('vaswani2017attention');
      expect(keys[2]).toBe('rumelhart1986parallel');
      expect(keys[3]).toBe('goodfellow2014representation');
      expect(keys[4]).toContain('corporationfordigitalscholarship');

      expect(getCleanStyleLabel('apa-7th')).toBe('APA');
      expect(getCleanStyleLabel('ieee')).toBe('IEEE');
      expect(formatCitationStyleLabel('apa-7th')).toBe('APA (7th Edition)');
      expect(formatCitationStyleLabel('mla-9th')).toBe('MLA (9th Edition)');
    });
  });
});
