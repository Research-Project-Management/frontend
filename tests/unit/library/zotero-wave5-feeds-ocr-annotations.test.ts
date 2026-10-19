import { describe, it, expect } from 'vitest';
import { parseFeedXml, mapFeedEntryToCreateItemPayload } from '@/features/library/domain/feed-parser.domain';
import { resolveOpenAccessLicenseBadge } from '@/features/library/domain/academic-text';
import { filterItemsBySystemView } from '@/features/library/domain/system-views.policy';
import {
  ANNOTATION_COLORS,
  PdfAnnotationEngine,
  searchPdfPages,
  cyclePdfSearchMatch,
  filterPdfOutlineTree,
  type PdfOutlineNode,
} from '@/features/library/domain/reader.domain';
import type { ReaderAnnotation } from '@/features/library/domain/types/reader.types';

describe('Wave 5: Zotero 7 RSS/Atom Feed Reader & ArXiv Alerts, My Publications & License Workflow, PDF Reader Search/Outline Navigation, and Annotation Color/Tag Semantics', () => {
  // ===========================================================================
  // USER STORY 1: Zotero RSS / Atom Feed Entry Parsing & One-Click Save Payload
  // ===========================================================================
  describe('User Story 1: Zotero RSS / Atom Feed Entry Parsing & One-Click "Save to Library / Collection"', () => {
    it('parses Atom XML (arXiv API alert feed) with authors, categories, DOI, PDF link, and maps to CreateLibraryItemFromFeedPayload', () => {
      const arxivAtomXml = `<?xml version="1.0" encoding="UTF-8"?>
        <feed xmlns="http://www.w3.org/2005/Atom" xmlns:arxiv="http://arxiv.org/schemas/atom">
          <title>arXiv Query: cat:cs.CL</title>
          <entry>
            <id>http://arxiv.org/abs/2402.17764v2</id>
            <published>2024-02-27T18:55:00Z</published>
            <title><![CDATA[The Era of 1-bit LLMs: All Large Language Models are in 1.58 Bits (arXiv:2402.17764v2)]]></title>
            <summary><![CDATA[arXiv:2402.17764v2 Announce Type: new
Abstract: <p>Recent research on 1-bit &amp; ternary quantization opens a new scaling paradigm for Transformers.</p>]]></summary>
            <author><name>Shuming Ma</name></author>
            <author><name>Hongyu Wang</name></author>
            <author><name>Furu Wei</name></author>
            <arxiv:doi>10.48550/arXiv.2402.17764</arxiv:doi>
            <link href="http://arxiv.org/abs/2402.17764v2" rel="alternate" type="text/html"/>
            <link title="pdf" href="http://arxiv.org/pdf/2402.17764v2" rel="related" type="application/pdf"/>
            <arxiv:primary_category term="cs.CL"/>
            <category term="cs.LG"/>
          </entry>
        </feed>`;

      const entries = parseFeedXml(arxivAtomXml);
      expect(entries).toHaveLength(1);
      const entry = entries[0]!;

      expect(entry.feedFormat).toBe('atom');
      expect(entry.title).toBe('The Era of 1-bit LLMs: All Large Language Models are in 1.58 Bits');
      expect(entry.authors).toEqual(['Shuming Ma', 'Hongyu Wang', 'Furu Wei']);
      expect(entry.arxivId).toBe('2402.17764v2');
      expect(entry.doi).toBe('10.48550/arXiv.2402.17764');
      expect(entry.pdfUrl).toBe('http://arxiv.org/pdf/2402.17764v2');
      expect(entry.year).toBe(2024);
      expect(entry.categories).toEqual(['cs.CL', 'cs.LG']);
      expect(entry.abstract).toBe(
        'Recent research on 1-bit & ternary quantization opens a new scaling paradigm for Transformers.',
      );

      // Map to One-Click Save to Project Collection payload
      const payload = mapFeedEntryToCreateItemPayload(entry, {
        scopeId: 'proj-efficient-ai',
        collectionId: 'col-quantization',
      });
      expect(payload).toMatchObject({
        title: 'The Era of 1-bit LLMs: All Large Language Models are in 1.58 Bits',
        itemType: 'preprint',
        arxivId: '2402.17764v2',
        doi: '10.48550/arXiv.2402.17764',
        year: 2024,
        tags: ['cs.CL', 'cs.LG'],
        scopeId: 'proj-efficient-ai',
        collectionId: 'col-quantization',
        collectionIds: ['col-quantization'],
      });
      expect(payload.creators[0]).toMatchObject({
        firstName: 'Shuming',
        lastName: 'Ma',
        creatorType: 'author',
      });
    });

    it('parses RSS 1.0 RDF/PRISM & Dublin Core journal TOC feeds (Nature / Science style)', () => {
      const prismRdfXml = `<?xml version="1.0" encoding="UTF-8"?>
        <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
                 xmlns:dc="http://purl.org/dc/elements/1.1/"
                 xmlns:prism="http://prismstandard.org/namespaces/basic/2.0/">
          <channel>
            <title>Nature Machine Intelligence</title>
          </channel>
          <item>
            <title>AlphaFold 3 predicts the structure and interactions of all of life&#39;s molecules</title>
            <link>https://www.nature.com/articles/s41586-024-07487-w</link>
            <dc:creator>Josh Abramson</dc:creator>
            <dc:creator>Jonas Adler</dc:creator>
            <dc:identifier>doi:10.1038/s41586-024-07487-w</dc:identifier>
            <dc:date>2024-05-08</dc:date>
            <prism:publicationName>Nature</prism:publicationName>
            <prism:volume>630</prism:volume>
            <prism:number>8016</prism:number>
            <prism:startingPage>493</prism:startingPage>
            <prism:endingPage>500</prism:endingPage>
            <dc:subject>Computational Biology</dc:subject>
            <description><![CDATA[<p>Accurate biomolecular structure prediction across complexes.</p>]]></description>
          </item>
        </rdf:RDF>`;

      const entries = parseFeedXml(prismRdfXml);
      expect(entries).toHaveLength(1);
      const entry = entries[0]!;

      expect(entry.feedFormat).toBe('rdf');
      expect(entry.title).toBe(
        "AlphaFold 3 predicts the structure and interactions of all of life's molecules",
      );
      expect(entry.authors).toEqual(['Josh Abramson', 'Jonas Adler']);
      expect(entry.doi).toBe('10.1038/s41586-024-07487-w');
      expect(entry.publicationTitle).toBe('Nature');
      expect(entry.volume).toBe('630');
      expect(entry.issue).toBe('8016');
      expect(entry.pages).toBe('493-500');
      expect(entry.year).toBe(2024);

      const payload = mapFeedEntryToCreateItemPayload(entry);
      expect(payload.itemType).toBe('journalArticle');
      expect(payload.scopeId).toBe('user');
      expect(payload.pages).toBe('493-500');
    });
  });

  // ===========================================================================
  // USER STORY 2: Zotero "My Publications" Authorship, OA License & System Views
  // ===========================================================================
  describe('User Story 2: Zotero "My Publications" Authorship, Open Access License Badges & System Views', () => {
    const libraryItems = [
      {
        id: 'pub-mine-ccby',
        title: 'Flux: Collaborative LaTeX and Reference Management',
        year: 2026,
        doi: '10.1145/3600000.3600001',
        isInMyPublications: true,
        license: 'CC-BY-4.0',
        collectionIds: ['col-own'],
        isTrashed: false,
        isRetracted: false,
      },
      {
        id: 'item-unfiled-1',
        title: 'Unfiled Preprint on Speculative Decoding',
        year: 2025,
        doi: '10.48550/arXiv.2501.00001',
        isInMyPublications: false,
        license: 'CC0-1.0',
        collectionIds: [],
        collections: [],
        isTrashed: false,
        isRetracted: false,
      },
      {
        id: 'item-dup-a',
        title: 'Duplicate Paper on Mixture of Experts',
        year: 2024,
        doi: '10.1000/moe.2024',
        collectionIds: ['col-1'],
        isTrashed: false,
      },
      {
        id: 'item-dup-b',
        title: 'Duplicate Paper on Mixture of Experts',
        year: 2024,
        doi: '10.1000/MOE.2024',
        collectionIds: ['col-2'],
        isTrashed: false,
      },
      {
        id: 'item-retracted-1',
        title: 'Retracted Study on Room-Temperature Superconductors',
        year: 2023,
        doi: '10.1038/retracted.2023',
        isRetracted: true,
        collectionIds: ['col-physics'],
        isTrashed: false,
      },
      {
        id: 'item-trashed-my-pub',
        title: 'Deleted Draft in Trash (Was in My Publications & Unfiled)',
        year: 2022,
        isInMyPublications: true,
        isRetracted: true,
        collectionIds: [],
        collections: [],
        isTrashed: true,
        deletedAt: '2026-10-14T10:00:00Z',
      },
    ];

    it('resolves Open Access license badges (CC-BY-4.0, CC0-1.0) accurately', () => {
      const ccByBadge = resolveOpenAccessLicenseBadge(libraryItems[0]!);
      expect(ccByBadge).toEqual({
        code: 'CC-BY-4.0',
        label: 'CC BY 4.0',
        isOpenAccess: true,
        url: 'https://creativecommons.org/licenses/by/4.0/',
      });

      const cc0Badge = resolveOpenAccessLicenseBadge(libraryItems[1]!);
      expect(cc0Badge).toEqual({
        code: 'CC0-1.0',
        label: 'CC0 1.0 Public Domain',
        isOpenAccess: true,
        url: 'https://creativecommons.org/publicdomain/zero/1.0/',
      });

      expect(resolveOpenAccessLicenseBadge(libraryItems[2]!)).toBeNull();
    });

    it('strictly scopes My Publications to Personal Library and ensures trashed items never leak into all, my-publications, unfiled, duplicates, or retracted views', () => {
      const personalScope = { type: 'user' as const, id: 'user' };
      const projectScope = { type: 'project' as const, id: 'proj-lab-1' };

      // 1. All Items view (excludes trashed item)
      const allView = filterItemsBySystemView(libraryItems, 'all', personalScope);
      expect(allView.map((i) => i.id)).toEqual([
        'pub-mine-ccby',
        'item-unfiled-1',
        'item-dup-a',
        'item-dup-b',
        'item-retracted-1',
      ]);

      // 2. My Publications in Personal Library -> only non-trashed authored works
      const myPubsPersonal = filterItemsBySystemView(
        libraryItems,
        'my-publications',
        personalScope,
      );
      expect(myPubsPersonal.map((i) => i.id)).toEqual(['pub-mine-ccby']);

      // 3. My Publications in Project Library -> strictly empty (never leaked into project scope)
      const myPubsProject = filterItemsBySystemView(
        libraryItems,
        'my-publications',
        projectScope,
      );
      expect(myPubsProject).toEqual([]);

      // 4. Unfiled Items -> only non-trashed items with zero collections
      const unfiledView = filterItemsBySystemView(libraryItems, 'unfiled', personalScope);
      expect(unfiledView.map((i) => i.id)).toEqual(['item-unfiled-1']);

      // 5. Duplicate Items -> non-trashed items sharing canonical DOI or Title+Year
      const duplicatesView = filterItemsBySystemView(libraryItems, 'duplicates', personalScope);
      expect(duplicatesView.map((i) => i.id)).toEqual(['item-dup-a', 'item-dup-b']);

      // 6. Retracted Items -> non-trashed retracted items
      const retractedView = filterItemsBySystemView(libraryItems, 'retracted', personalScope);
      expect(retractedView.map((i) => i.id)).toEqual(['item-retracted-1']);

      // 7. Trash view -> only trashed items
      const trashView = filterItemsBySystemView(libraryItems, 'trash', personalScope);
      expect(trashView.map((i) => i.id)).toEqual(['item-trashed-my-pub']);
    });
  });

  // ===========================================================================
  // USER STORY 3: Zotero 7 PDF Reader — In-Document Search, Match Cycling & Outline Tree
  // ===========================================================================
  describe('User Story 3: Zotero 7 PDF Reader — In-Document Full-Text Search, Match Cycling, & Outline Tree', () => {
    const pdfPages = [
      {
        pageNumber: 1,
        text: 'Abstract: We introduce FlashAttention, an IO-aware exact transformer attention algorithm.',
      },
      {
        pageNumber: 2,
        text: 'Section 1: Standard Transformer implementations materialize the N x N attention matrix in HBM.',
      },
      {
        pageNumber: 5,
        text: 'Theorem 2 (Bézout & Łukasiewicz): FlashAttention reduces HBM accesses compared to standard Transformer layers.',
      },
    ];

    it('finds case- and diacritic-insensitive matches across PDF pages and cycles forward/backward with wrap-around', () => {
      const matches = searchPdfPages(pdfPages, 'transformer');
      expect(matches).toHaveLength(3);
      expect(matches.map((m) => m.pageNumber)).toEqual([1, 2, 5]);
      expect(matches[0]?.snippet).toContain('exact transformer attention');

      // Diacritic-insensitive search ("bezout" matches "Bézout", "lukasiewicz" matches "Łukasiewicz")
      const diacriticMatches = searchPdfPages(pdfPages, 'lukasiewicz');
      expect(diacriticMatches).toHaveLength(1);
      expect(diacriticMatches[0]?.pageNumber).toBe(5);

      // Cycling forward from match 0 (1 of 3) -> match 1 (2 of 3) -> match 2 (3 of 3) -> wraps to match 0 (1 of 3)
      const step1 = cyclePdfSearchMatch(matches, 0, 'next');
      expect(step1.activeMatchIndex).toBe(1);
      expect(step1.displayPosition).toBe('2 of 3');
      expect(step1.targetPageNumber).toBe(2);

      const step2 = cyclePdfSearchMatch(matches, step1.activeMatchIndex, 'next');
      expect(step2.activeMatchIndex).toBe(2);
      expect(step2.displayPosition).toBe('3 of 3');
      expect(step2.targetPageNumber).toBe(5);

      const wrapNext = cyclePdfSearchMatch(matches, step2.activeMatchIndex, 'next');
      expect(wrapNext.activeMatchIndex).toBe(0);
      expect(wrapNext.displayPosition).toBe('1 of 3');
      expect(wrapNext.targetPageNumber).toBe(1);

      // Cycling backward from match 0 (1 of 3) wraps around to match 2 (3 of 3, page 5)
      const wrapPrev = cyclePdfSearchMatch(matches, 0, 'prev');
      expect(wrapPrev.activeMatchIndex).toBe(2);
      expect(wrapPrev.displayPosition).toBe('3 of 3');
      expect(wrapPrev.targetPageNumber).toBe(5);
    });

    it('filters nested PDF Document Outline trees while preserving parent ancestor branches when a child chapter matches', () => {
      const outlineTree: PdfOutlineNode[] = [
        {
          title: '1. Introduction',
          pageNumber: 1,
          items: [
            { title: '1.1 Hardware Memory Hierarchy', pageNumber: 2 },
            { title: '1.2 Standard Attention Bottlenecks', pageNumber: 3 },
          ],
        },
        {
          title: '2. FlashAttention Algorithm',
          pageNumber: 4,
          items: [
            {
              title: '2.1 Tiling & Online Softmax',
              pageNumber: 5,
              items: [
                { title: '2.1.1 Backward Pass Recomputation', pageNumber: 7 },
              ],
            },
            { title: '2.2 IO Complexity Analysis', pageNumber: 9 },
          ],
        },
        {
          title: '3. Empirical Evaluation',
          pageNumber: 12,
        },
      ];

      const filtered = filterPdfOutlineTree(outlineTree, 'Recomputation');
      expect(filtered).toHaveLength(1);
      expect(filtered[0]?.title).toBe('2. FlashAttention Algorithm');
      expect(filtered[0]?.items).toHaveLength(1);
      expect(filtered[0]?.items?.[0]?.title).toBe('2.1 Tiling & Online Softmax');
      expect(filtered[0]?.items?.[0]?.items?.[0]?.title).toBe('2.1.1 Backward Pass Recomputation');
    });
  });

  // ===========================================================================
  // USER STORY 4: Zotero 7 Annotation Color Semantics, Tag Filtering & Area Bounds
  // ===========================================================================
  describe('User Story 4: Zotero 7 Annotation Color Semantics, Multi-Facet Filtering & Area Coordinate Clamping', () => {
    const annotations: ReaderAnnotation[] = [
      {
        id: 'ann-yellow-important',
        attachmentId: 'att-1',
        type: 'highlight',
        pageIndex: 0,
        pageNumber: 1,
        color: '#ffd400',
        quoteText: ' Core transformer complexity is quadratic in sequence length.',
        comment: 'Key motivation',
        tags: ['motivation', 'complexity'],
        version: 1,
        createdAt: '2026-10-14T10:00:00Z',
      },
      {
        id: 'ann-red-critique',
        attachmentId: 'att-1',
        type: 'underline',
        pageIndex: 2,
        pageNumber: 3,
        color: '#ff6666',
        quoteText: 'Baseline hyper-parameters were not tuned for long context.',
        comment: 'Methodological flaw in baseline comparison',
        tags: ['critique', 'baseline'],
        version: 1,
        createdAt: '2026-10-14T10:05:00Z',
      },
      {
        id: 'ann-green-method',
        attachmentId: 'att-1',
        type: 'highlight',
        pageIndex: 4,
        pageNumber: 5,
        color: '#5fb236',
        quoteText: 'We tile inputs into SRAM blocks of size B_r and B_c.',
        comment: 'Core kernel tiling strategy',
        tags: ['methodology', 'cuda'],
        version: 1,
        createdAt: '2026-10-14T10:10:00Z',
      },
      {
        id: 'ann-magenta-area',
        attachmentId: 'att-1',
        type: 'area',
        pageIndex: 7,
        pageNumber: 8,
        color: '#e56eee',
        comment: 'Figure 3: Speedup vs Sequence Length benchmark chart',
        tags: ['results', 'figure'],
        version: 1,
        createdAt: '2026-10-14T10:15:00Z',
      },
    ];

    it('maps Zotero 7 highlight colors to semantic research labels', () => {
      expect(PdfAnnotationEngine.getColorSemanticLabel('yellow')).toBe('General / Important');
      expect(PdfAnnotationEngine.getColorSemanticLabel('#ff6666')).toBe(
        'Disagreement / Critical Error',
      );
      expect(PdfAnnotationEngine.getColorSemanticLabel('green')).toBe(
        'Methodology / Supporting Evidence',
      );
      expect(PdfAnnotationEngine.getColorSemanticLabel('blue')).toBe('Definition / Background');
      expect(PdfAnnotationEngine.getColorSemanticLabel('purple')).toBe('Future Work / Follow-up');
      expect(PdfAnnotationEngine.getColorSemanticLabel('#e56eee')).toBe('Results / Key Findings');
      expect(ANNOTATION_COLORS.orange.semanticLabel).toBe('Metrics / Quantitative Data');
    });

    it('filters annotations by combined colors, types, tags, and search query', () => {
      // Filter by color = green and tag = cuda
      const greenCuda = PdfAnnotationEngine.filterAnnotations(annotations, {
        colors: ['green'],
        tags: ['cuda'],
      });
      expect(greenCuda.map((a) => a.id)).toEqual(['ann-green-method']);

      // Filter by multiple colors (red OR magenta) and types (underline OR area)
      const critiqueAndResults = PdfAnnotationEngine.filterAnnotations(annotations, {
        colors: ['red', 'magenta'],
        types: ['underline', 'area'],
      });
      expect(critiqueAndResults.map((a) => a.id)).toEqual([
        'ann-red-critique',
        'ann-magenta-area',
      ]);

      // Filter by query + pageRange
      const pageFiltered = PdfAnnotationEngine.filterAnnotations(annotations, {
        query: 'baseline',
        pageRange: [2, 4],
      });
      expect(pageFiltered.map((a) => a.id)).toEqual(['ann-red-critique']);
    });

    it('clamps out-of-bounds and inverted drag Area/Image selection coordinates to [0, 100] percentage bounds and [0, 1] unit bounds', () => {
      // Percentage space [0, 100]: user drags from bottom-right (115%, 108%) to top-left (-12%, 15%)
      const clampedPercent = PdfAnnotationEngine.clampAreaSelectionBounds(
        { x1: 115, y1: 108, x2: -12, y2: 15 },
        100,
      );
      expect(clampedPercent).toEqual({
        x1: 0,
        y1: 15,
        x2: 100,
        y2: 100,
        width: 100,
        height: 85,
      });

      // Unit space [0, 1]: user drags outside page bounds (-0.25, 0.9) to (1.4, 0.2)
      const clampedUnit = PdfAnnotationEngine.normalizeRect({
        x1: -0.25,
        y1: 0.9,
        x2: 1.4,
        y2: 0.2,
      });
      expect(clampedUnit).toEqual({
        x1: 0,
        y1: 0.2,
        x2: 1,
        y2: 0.9,
        width: 1,
        height: 0.7,
      });
    });
  });
});
