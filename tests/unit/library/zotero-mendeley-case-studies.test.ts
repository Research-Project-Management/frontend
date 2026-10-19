/**
 * Real-World Zotero & Mendeley Datasets + User Case-Study Stress Test Suite
 *
 * Tests the Frontend Library & Reader domain, utilities, hooks, and inspector components
 * against 4 real-world datasets and end-to-end researcher workflows:
 * - Dataset 1: Dirty & Heterogeneous Metadata from Zotero, Mendeley, CrossRef, ArXiv & PubMed
 * - Dataset 2: Zotero 7 Item Type Conversion & Inspector Field Mapping
 * - Dataset 3: Duplicate Merge Resolution (3-way Mendeley + ArXiv + CrossRef merge)
 * - Dataset 4: Table Sorting, Multi-Facet Filtering, Quick Copy & PdfAnnotationEngine
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  isValidValue,
  cleanValue,
  stripLatexMarkup,
  cleanAbstractText,
  normalizeTags,
  getPublicationVenue,
  getItemDisplayDate,
} from '@/features/library/domain/metadata';
import {
  cleanDoi,
  extractArxivId,
  extractPmid,
  cleanIsbn,
  cleanPaperTitle,
} from '@/features/library/domain/identifiers';
import {
  parseCreatorName,
  splitAuthorString,
  normalizeAuthors,
  formatAuthorsText,
} from '@/features/library/domain/creators';
import {
  generateCitationKey,
  toBibTeXEntry,
} from '@/features/library/domain/citations';
import {
  inspectItemDifferences,
  aggregateItemAssets,
} from '@/features/library/domain/diff';
import {
  getItemTypeDefinition,
  getVenueFieldForType,
  getPublisherFieldForType,
  getPrimaryCreatorType,
  normalizeCanonicalItemType,
} from '@/features/library/domain/types/item-types.types';
import { useDuplicateMergeState } from '@/features/library/core/coordinator/curation.coordinator';
import { sortLibraryItems } from '@/features/library/domain/sort-items.domain';
import {
  PdfAnnotationEngine,
  formatInTextCitation,
  formatAnnotationCitation,
  generateReaderCitationKey,
} from '@/features/library/domain/reader.domain';
import type { Item } from '@/features/library/domain/types/library.types';
import type { ReaderDocument, ReaderAnnotation } from '@/features/library/domain/types/reader.types';

describe('Real-World Zotero & Mendeley Datasets & User Case-Study Stress Tests', () => {
  // ===========================================================================
  // DATASET 1: Dirty & Heterogeneous Metadata (Zotero, Mendeley, CrossRef, ArXiv, PubMed)
  // ===========================================================================
  describe('Dataset 1: Dirty & Heterogeneous Metadata Sanitization & Normalization', () => {
    it('filters dirty placeholder tokens ("null", "undefined", "N/A", "none", "unknown") across metadata and tags', () => {
      const dirtyTokens = [null, undefined, '', '   ', 'null', 'NULL', 'undefined', 'N/A', 'n/a', 'na', 'none', 'nil', 'unknown', '[]', '{}'];
      for (const token of dirtyTokens) {
        expect(isValidValue(token)).toBe(false);
        expect(cleanValue(token)).toBe('');
      }

      const tagsInput = [
        'deep-learning',
        'null',
        'N/A',
        'undefined',
        'none',
        '#Transformers; "Attention Mechanism"',
        { name: 'NLP' },
        { tag: 'unknown' },
      ];
      expect(normalizeTags(tagsInput)).toEqual(['deep-learning', 'Transformers', 'Attention Mechanism', 'NLP']);
    });

    it('cleans JATS XML, HTML tags, and HTML entities in PubMed/CrossRef abstracts', () => {
      const pubmedAbstract =
        '<jats:title>Abstract</jats:title><jats:p>We study <i>deep learning</i> &amp; AI models with &lt;10% error &mdash; achieving &quot;state-of-the-art&quot; results&#39;s accuracy.</jats:p>';
      expect(cleanAbstractText(pubmedAbstract)).toBe(
        'We study deep learning & AI models with <10% error \u2014 achieving "state-of-the-art" results\'s accuracy.',
      );

      expect(cleanAbstractText('N/A')).toBe('');
      expect(cleanAbstractText('null')).toBe('');
      expect(cleanAbstractText('Abstract: Multi-modal learning in healthcare.')).toBe(
        'Multi-modal learning in healthcare.',
      );
    });

    it('decodes escaped LaTeX accents, macros, and braces in BibTeX/Zotero titles and author names', () => {
      const latexTitle = "On \\textbf{Schr{\\\"o}dinger}'s Cat and {Na{\\\"\\i}ve} Bayes in C{\\'e}zanne--Erd{\\H{o}}s Graphs";
      const cleanedTitle = cleanPaperTitle(latexTitle);
      expect(cleanedTitle).toBe("On Schrödinger's Cat and Naïve Bayes in Cézanne--Erdős Graphs");

      const polishAndNordic = stripLatexMarkup('{\\L}ukasz {\\O}stergaard and {\\AA}ke G{\\"o}del and Karel {\\v{C}}apek');
      expect(polishAndNordic).toBe('Łukasz Østergaard and Åke Gödel and Karel Čapek');
    });

    it('normalizes messy DOIs, ArXiv IDs (modern + legacy hep-th), PMIDs, and ISBNs', () => {
      expect(cleanDoi('doi:10.1038/s41586-021-03819-2')).toBe('10.1038/s41586-021-03819-2');
      expect(cleanDoi('https://dx.doi.org/10.1145/3442188.3445922?utm_source=mendeley& ref=pdf#page=2')).toBe(
        '10.1145/3442188.3445922',
      );
      expect(cleanDoi('https://doi.org/10.1016/j.cell.2023.01.001.')).toBe('10.1016/j.cell.2023.01.001');
      expect(cleanDoi('N/A')).toBe('');

      expect(extractArxivId('arXiv:2303.08774v2 [cs.CL]')).toBe('2303.08774v2');
      expect(extractArxivId('https://arxiv.org/pdf/2303.08774.pdf')).toBe('2303.08774');
      expect(extractArxivId('arXiv:hep-th/9901001v2')).toBe('hep-th/9901001v2');

      expect(extractPmid('PMID: 34265844')).toBe('34265844');
      expect(extractPmid('https://pubmed.ncbi.nlm.nih.gov/34265844/')).toBe('34265844');

      expect(cleanIsbn('ISBN-13: 978-0-262-03561-3')).toBe('978-0-262-03561-3');
      expect(cleanIsbn('ISBN 0-262-53205-0')).toBe('0-262-53205-0');
    });

    it('normalizes heterogeneous creator formats (Zotero, CSL, institutional fieldMode:1, compound surnames, Vietnamese/Spanish/Dutch)', () => {
      // Compound surname parsing
      expect(parseCreatorName('Laurens van der Maaten')).toEqual({
        firstName: 'Laurens',
        lastName: 'van der Maaten',
        fullName: 'Laurens van der Maaten',
        isInstitution: false,
      });
      expect(parseCreatorName('van der Maaten, Laurens')).toEqual({
        firstName: 'Laurens',
        lastName: 'van der Maaten',
        fullName: 'Laurens van der Maaten',
        isInstitution: false,
      });
      expect(parseCreatorName('García Márquez, Gabriel')).toEqual({
        firstName: 'Gabriel',
        lastName: 'García Márquez',
        fullName: 'Gabriel García Márquez',
        isInstitution: false,
      });
      expect(parseCreatorName('Gabriel de la Cruz')).toEqual({
        firstName: 'Gabriel',
        lastName: 'de la Cruz',
        fullName: 'Gabriel de la Cruz',
        isInstitution: false,
      });
      expect(parseCreatorName('Đặng, Văn Phúc')).toEqual({
        firstName: 'Văn Phúc',
        lastName: 'Đặng',
        fullName: 'Văn Phúc Đặng',
        isInstitution: false,
      });

      // Multi-format array normalization
      const mixedCreators = [
        { firstName: 'Ashish', lastName: 'Vaswani', creatorType: 'author' },
        { given: 'Léon', family: 'Bottou' },
        { name: 'OpenAI', fieldMode: 1 },
        'van der Maaten, Laurens',
        "K{\\\"o}hler, Thomas and M{\\'a}rquez, Luis",
        'null',
        'N/A',
      ];
      const normalized = normalizeAuthors(mixedCreators);
      expect(normalized).toEqual([
        'Ashish Vaswani',
        'Léon Bottou',
        'OpenAI',
        'Laurens van der Maaten',
        'Thomas Köhler',
        'Luis Márquez',
      ]);
      expect(formatAuthorsText(mixedCreators, 3)).toBe('Ashish Vaswani, Léon Bottou, OpenAI et al.');
    });
  });

  // ===========================================================================
  // DATASET 2: Zotero 7 Item Type Conversion & Inspector Field Mapping
  // ===========================================================================
  describe('Dataset 2: Zotero 7 Item Type Conversion & Inspector Field Mapping', () => {
    it('resolves CSL type aliases to canonical Zotero Schema v42 item types and venue/publisher fields', () => {
      expect(normalizeCanonicalItemType('article-journal')).toBe('journalArticle');
      expect(normalizeCanonicalItemType('paper-conference')).toBe('conferencePaper');
      expect(normalizeCanonicalItemType('chapter')).toBe('bookSection');
      expect(normalizeCanonicalItemType('post-weblog')).toBe('blogPost');

      expect(getVenueFieldForType('article-journal')).toBe('publicationTitle');
      expect(getVenueFieldForType('journalArticle')).toBe('publicationTitle');
      expect(getVenueFieldForType('paper-conference')).toBe('proceedingsTitle');
      expect(getVenueFieldForType('conferencePaper')).toBe('proceedingsTitle');
      expect(getVenueFieldForType('bookSection')).toBe('bookTitle');
      expect(getVenueFieldForType('chapter')).toBe('bookTitle');
      expect(getVenueFieldForType('preprint')).toBe('repository');
      expect(getVenueFieldForType('webpage')).toBe('websiteTitle');

      expect(getPublisherFieldForType('thesis')).toBe('university');
      expect(getPublisherFieldForType('report')).toBe('institution');
      expect(getPublisherFieldForType('book')).toBe('publisher');

      expect(getPrimaryCreatorType('patent')).toBe('inventor');
      expect(getPrimaryCreatorType('computerProgram')).toBe('programmer');
      expect(getPrimaryCreatorType('presentation')).toBe('presenter');
    });

    it('preserves publication venue across item type conversions (journalArticle <-> conferencePaper <-> bookSection <-> preprint <-> thesis)', () => {
      const baseItem: Partial<Item> & Record<string, unknown> = {
        id: 'conv-1',
        title: 'Attention Is All You Need',
        itemType: 'conferencePaper',
        proceedingsTitle: 'Advances in Neural Information Processing Systems (NeurIPS)',
        publisher: 'Curran Associates',
        eventPlace: 'Long Beach, CA',
        publicationDate: '2017-12-04',
      };

      expect(getPublicationVenue(baseItem)).toBe('Advances in Neural Information Processing Systems (NeurIPS)');
      expect(getItemDisplayDate(baseItem)).toBe(2017);

      // Simulate conversion to journalArticle where publicationTitle is read from proceedingsTitle/containerTitle
      const asJournal: Partial<Item> & Record<string, unknown> = {
        ...baseItem,
        itemType: 'journalArticle',
        publicationTitle: baseItem.proceedingsTitle as string,
      };
      expect(getPublicationVenue(asJournal)).toBe('Advances in Neural Information Processing Systems (NeurIPS)');

      // Simulate conversion to thesis where university maps from publisher
      const asThesis: Partial<Item> & Record<string, unknown> = {
        id: 'conv-2',
        title: 'Deep Variational Inference',
        itemType: 'thesis',
        university: 'Stanford University',
        year: 2022,
      };
      expect(getPublicationVenue(asThesis)).toBe('Stanford University');
      expect(getItemTypeDefinition('thesis')?.fields.some((f) => f.field === 'university')).toBe(true);
    });
  });

  // ===========================================================================
  // DATASET 3: Duplicate Merge Resolution (3-way Mendeley + ArXiv + CrossRef)
  // ===========================================================================
  describe('Dataset 3: 3-Way Duplicate Merge Resolution (Mendeley PDF + ArXiv Preprint + CrossRef Published)', () => {
    const mendeleyPdfImport: Item = {
      id: 'dup-mendeley',
      title: 'Attention is all you need',
      itemType: 'journalArticle',
      authors: ['Vaswani, A.'],
      year: 0, // dirty missing year
      publicationTitle: 'N/A', // dirty placeholder venue
      doi: 'null', // dirty placeholder DOI
      abstractNote: 'none',
      tags: ['mendeley-import', 'to-read', 'null'],
      collectionIds: ['col-reading-list'],
      attachments: [{ id: 'att-pdf-1', name: 'vaswani2017_annotated.pdf', url: '/files/v1.pdf' }],
      notes: [{ id: 'n-1', content: 'Check multi-head attention equations' }],
    };

    const arxivPreprint: Item = {
      id: 'dup-arxiv',
      title: 'Attention Is All You Need',
      itemType: 'preprint',
      authors: [
        'Ashish Vaswani',
        'Noam Shazeer',
        'Niki Parmar',
        'Jakob Uszkoreit',
        'Llion Jones',
        'Aidan N. Gomez',
        'Łukasz Kaiser',
        'Illia Polosukhin',
      ],
      year: 2017,
      arxivId: '1706.03762',
      repository: 'arXiv',
      abstractNote:
        'The dominant sequence transduction models are based on complex recurrent or convolutional neural networks that include an encoder and a decoder.',
      url: 'https://arxiv.org/abs/1706.03762',
      tags: ['arxiv', 'transformers', 'deep-learning'],
      collections: [{ id: 'col-nlp', name: 'NLP Core' }],
      attachments: [{ id: 'att-pdf-2', name: '1706.03762v5.pdf', url: 'https://arxiv.org/pdf/1706.03762.pdf' }],
      notes: [{ id: 'n-2', content: 'ArXiv v5 includes positional encoding ablation' }],
    };

    const crossrefPublished: Item = {
      id: 'dup-crossref',
      title: 'Attention Is All You Need',
      itemType: 'conferencePaper',
      creators: [
        { firstName: 'Ashish', lastName: 'Vaswani', creatorType: 'author' },
        { firstName: 'Noam', lastName: 'Shazeer', creatorType: 'author' },
      ],
      year: 2017,
      proceedingsTitle: 'Advances in Neural Information Processing Systems 30 (NIPS 2017)',
      volume: '30',
      pages: '5998-6008',
      publisher: 'Curran Associates, Inc.',
      doi: '10.5555/3295222.3295349',
      tags: ['neurips-2017', 'transformers'],
      collections: [{ id: 'col-published', name: 'Published Papers' }],
      attachments: [],
      notes: [],
    };

    const duplicateGroup = [mendeleyPdfImport, arxivPreprint, crossrefPublished];

    it('accurately detects conflicts, treats dirty placeholders as empty, and recommends richest field values', () => {
      const diff = inspectItemDifferences(duplicateGroup, 'dup-mendeley');
      expect(diff.hasConflicts).toBe(true);

      // DOI is "null" in Mendeley (treated as empty), missing in ArXiv, present in CrossRef -> MISSING_IN_MASTER
      const doiDiff = diff.fields.find((f) => f.key === 'doi')!;
      expect(doiDiff.status).toBe('MISSING_IN_MASTER');
      expect(doiDiff.recommendedItemId).toBe('dup-crossref');
      expect(doiDiff.recommendedValue).toBe('10.5555/3295222.3295349');

      // Year is 0 in Mendeley (treated as empty), 2017 in ArXiv and CrossRef -> MISSING_IN_MASTER
      const yearDiff = diff.fields.find((f) => f.key === 'year')!;
      expect(yearDiff.status).toBe('MISSING_IN_MASTER');
      expect(yearDiff.recommendedValue).toBe(2017);

      // Abstract is "none" in Mendeley (treated as empty), rich in ArXiv -> MISSING_IN_MASTER
      const abstractDiff = diff.fields.find((f) => f.key === 'abstract')!;
      expect(abstractDiff.status).toBe('MISSING_IN_MASTER');
      expect(abstractDiff.recommendedItemId).toBe('dup-arxiv');

      // Authors has 1 in Mendeley, 8 in ArXiv, 2 in CrossRef -> CONFLICT, recommends ArXiv (8 authors)
      const authorsDiff = diff.fields.find((f) => f.key === 'authors')!;
      expect(authorsDiff.status).toBe('CONFLICT');
      expect(authorsDiff.recommendedItemId).toBe('dup-arxiv');

      // PublicationTitle resolves proceedingsTitle from CrossRef and repository from ArXiv
      const venueDiff = diff.fields.find((f) => f.key === 'publicationTitle')!;
      expect(venueDiff.recommendedItemId).toBe('dup-crossref');
      expect(venueDiff.recommendedValue).toBe('Advances in Neural Information Processing Systems 30 (NIPS 2017)');
    });

    it('computes non-destructive asset union (tags without dirty tokens, collections, PDFs, notes) and supports useDuplicateMergeState workflow', () => {
      const assets = aggregateItemAssets(duplicateGroup);
      expect(assets.tags).toEqual([
        'mendeley-import',
        'to-read',
        'arxiv',
        'transformers',
        'deep-learning',
        'neurips-2017',
      ]);
      expect(assets.collections).toEqual(['col-reading-list', 'col-nlp', 'col-published']);
      expect(assets.totalFiles).toBe(2);
      expect(assets.totalNotes).toBe(2);

      // Test interactive merge hook workflow: smart master selection automatically picks published CrossRef record
      const { result } = renderHook(() => useDuplicateMergeState(duplicateGroup));
      expect(result.current.selectedMasterId).toBe('dup-crossref');
      expect(result.current.hasTypeMismatch).toBe(true);

      // User can also manually switch master to Mendeley record and run Recommend Best
      act(() => {
        result.current.handleSelectMaster('dup-mendeley');
      });
      expect(result.current.selectedMasterId).toBe('dup-mendeley');

      // Auto-recommend fills all missing/conflicting fields on the master item
      act(() => {
        result.current.handleAutoRecommend();
      });
      expect(result.current.fieldOverrides.doi).toBe('10.5555/3295222.3295349');
      expect(result.current.fieldOverrides.year).toBe(2017);
      expect(result.current.fieldOverrides.arxivId).toBe('1706.03762');
      expect(result.current.fieldOverrides.pages).toBe('5998-6008');

      // Switch master back to CrossRef published record and pick ArXiv's 8-author list + abstract
      act(() => {
        result.current.handleSelectMaster('dup-crossref');
      });
      expect(result.current.selectedMasterId).toBe('dup-crossref');
      expect(result.current.fieldOverrides).toEqual({});

      act(() => {
        result.current.handleAutoRecommend();
      });
      expect(result.current.fieldOverrides.arxivId).toBe('1706.03762');
      expect(result.current.fieldOverrides.abstract).toContain('dominant sequence transduction models');
      expect((result.current.fieldOverrides.authors as string[]).length).toBe(8);
    });
  });

  // ===========================================================================
  // DATASET 4: Table Sorting, Quick Copy Citations & PdfAnnotationEngine
  // ===========================================================================
  describe('Dataset 4: International Table Sorting, Quick Copy Citations & PDF Annotation Engine', () => {
    const mixedItems: Item[] = [
      {
        id: 'sort-1',
        title: '"Attention Is All You Need"',
        authors: ['Vaswani, Ashish'],
        year: 2017,
        publicationTitle: 'NeurIPS',
      },
      {
        id: 'sort-2',
        title: '[Preprint] Deep Residual Learning for Image Recognition',
        creators: [{ firstName: 'Kaiming', lastName: 'He', creatorType: 'author' }],
        year: 2016,
        proceedingsTitle: 'CVPR',
      },
      {
        id: 'sort-3',
        title: 'A Survey on Large Language Models',
        authors: ['Đặng, Văn Phúc'],
        year: 0, // missing year
        publicationTitle: 'N/A',
      },
      {
        id: 'sort-4',
        title: 'bert: Pre-training of Deep Bidirectional Transformers',
        authors: ['Ávila, Carlos'],
        year: 2019,
        publicationTitle: 'NAACL',
      },
      {
        id: 'sort-5',
        title: 'Scaling Laws for Neural Language Models',
        authors: ['Öztürk, Elif'],
        year: 2020,
        repository: 'arXiv',
      },
      {
        id: 'sort-proc',
        title: 'Uploading Paper...',
        authors: [],
        _isProcessing: true,
      } as Item & { _isProcessing: boolean },
    ];

    it('sorts items by title (ignoring leading quotes/brackets & case), international authors, and year (pinning _isProcessing first and empty years last)', () => {
      // Title sort ascending: A Survey... -> "Attention..." -> bert... -> [Preprint] Deep... -> Scaling Laws...
      const byTitleAsc = sortLibraryItems(mixedItems, 'title', 'asc', false);
      expect(byTitleAsc.map((i) => i.id)).toEqual([
        'sort-proc',
        'sort-3', // A Survey...
        'sort-1', // "Attention..."
        'sort-4', // bert...
        'sort-2', // [Preprint] Deep...
        'sort-5', // Scaling Laws...
      ]);

      // Authors sort ascending: Ávila -> Đặng (D) -> He -> Öztürk (O) -> Vaswani
      const byAuthorAsc = sortLibraryItems(mixedItems, 'authors', 'asc', false);
      expect(byAuthorAsc.map((i) => i.id)).toEqual([
        'sort-proc',
        'sort-4', // Ávila
        'sort-3', // Đặng
        'sort-2', // He
        'sort-5', // Öztürk
        'sort-1', // Vaswani
      ]);

      // Year sort descending: 2020 -> 2019 -> 2017 -> 2016 -> 0 (missing always last!)
      const byYearDesc = sortLibraryItems(mixedItems, 'year', 'desc', false);
      expect(byYearDesc.map((i) => i.id)).toEqual([
        'sort-proc',
        'sort-5', // 2020
        'sort-4', // 2019
        'sort-1', // 2017
        'sort-2', // 2016
        'sort-3', // missing year (0) sorted to bottom
      ]);
    });

    it('generates clean ASCII BibTeX citation keys and BibTeX entries for international & compound authors with collision disambiguation', () => {
      const vietPaper = mixedItems.find((i) => i.id === 'sort-3')!;
      expect(generateCitationKey({ ...vietPaper, year: 2024 })).toBe('dang2024survey');

      const turkishPaper = mixedItems.find((i) => i.id === 'sort-5')!;
      expect(generateCitationKey(turkishPaper)).toBe('ozturk2020scaling');

      const dutchPaper = {
        title: 'Visualizing Data using t-SNE',
        authors: ['Laurens van der Maaten', 'Geoffrey Hinton'],
        year: 2008,
        journal: 'Journal of Machine Learning Research',
      };
      const key1 = generateCitationKey(dutchPaper);
      expect(key1).toBe('vandermaaten2008visualizing');

      // Collision disambiguation
      const existing = new Set([key1, `${key1}a`]);
      expect(generateCitationKey(dutchPaper, existing)).toBe('vandermaaten2008visualizingb');

      // BibTeX entry generation with conference proceedings fallback and creators normalization
      const bib = toBibTeXEntry({
        title: 'Attention Is All You Need',
        creators: [
          { firstName: 'Ashish', lastName: 'Vaswani' },
          { firstName: 'Noam', lastName: 'Shazeer' },
        ],
        year: 2017,
        itemType: 'paper-conference',
        proceedingsTitle: 'Advances in Neural Information Processing Systems',
        doi: '10.5555/3295222.3295349',
      });
      expect(bib).toContain('@inproceedings{vaswani2017attention,');
      expect(bib).toContain('author = {Ashish Vaswani and Noam Shazeer}');
      expect(bib).toContain('booktitle = {Advances in Neural Information Processing Systems}');
    });

    it('formats accurate Reader in-text and Markdown deep-link citations for inverted, compound, and multi-author papers', () => {
      const docInverted: ReaderDocument = {
        id: 'doc-1',
        title: 'Attention Is All You Need',
        authors: ['Vaswani, Ashish', 'Shazeer, Noam'],
        year: 2017,
      };
      expect(formatInTextCitation(docInverted, 4)).toBe('(Vaswani & Shazeer, 2017, p. 4)');

      const docCompound: ReaderDocument = {
        id: 'doc-2',
        title: 'Visualizing Data using t-SNE',
        authors: ['Laurens van der Maaten', 'Geoffrey Hinton', 'Yoshua Bengio'],
        year: 2008,
      };
      expect(formatInTextCitation(docCompound, 12)).toBe('(van der Maaten et al., 2008, p. 12)');
      expect(generateReaderCitationKey(docCompound)).toBe('vandermaaten2008visualizing');

      const annotCit = formatAnnotationCitation(docCompound, 'att-99', 12, 'ann-42');
      expect(annotCit).toEqual({
        label: '(van der Maaten et al., 2008, p. 12)',
        url: 'flux://open-pdf/library/items/att-99?page=12&annotation=ann-42',
        markdown: '[(van der Maaten et al., 2008, p. 12)](flux://open-pdf/library/items/att-99?page=12&annotation=ann-42)',
      });
    });

    it('normalizes out-of-bounds PDF coordinates and sorts/filters annotations spatially', () => {
      const clamped = PdfAnnotationEngine.normalizeRect({
        x1: -0.05,
        y1: 0.2,
        x2: 0.5,
        y2: 1.2,
        width: undefined as unknown as number,
        height: undefined as unknown as number,
      });
      expect(clamped.x1).toBe(0);
      expect(clamped.y1).toBe(0.2);
      expect(clamped.width).toBeCloseTo(0.5, 5);
      expect(clamped.height).toBeCloseTo(0.8, 5);
      expect(clamped.x2).toBeCloseTo(0.5, 5);
      expect(clamped.y2).toBeCloseTo(1.0, 5);

      const annotations: ReaderAnnotation[] = [
        {
          id: 'a-page2',
          documentId: 'doc-1',
          type: 'highlight',
          pageNumber: 2,
          color: '#ffd400',
          quoteText: 'Second page insight',
          boundingRect: { x1: 0.1, y1: 0.1, x2: 0.5, y2: 0.15, width: 0.4, height: 0.05 },
          rects: [],
        },
        {
          id: 'a-page1-bottom',
          documentId: 'doc-1',
          type: 'highlight',
          pageNumber: 1,
          color: 'green',
          quoteText: 'Transformer architecture diagram',
          boundingRect: { x1: 0.1, y1: 0.7, x2: 0.5, y2: 0.75, width: 0.4, height: 0.05 },
          rects: [],
        },
        {
          id: 'a-page1-top',
          documentId: 'doc-1',
          type: 'highlight',
          pageNumber: 1,
          color: '#ffd400',
          quoteText: 'Self-attention mechanism',
          boundingRect: { x1: 0.1, y1: 0.15, x2: 0.5, y2: 0.2, width: 0.4, height: 0.05 },
          rects: [],
        },
      ];

      const sorted = PdfAnnotationEngine.sortAnnotations(annotations);
      expect(sorted.map((a) => a.id)).toEqual(['a-page1-top', 'a-page1-bottom', 'a-page2']);

      const filteredYellow = PdfAnnotationEngine.filterAnnotations(sorted, 'attention', 'yellow');
      expect(filteredYellow.map((a) => a.id)).toEqual(['a-page1-top']);
    });
  });
});

