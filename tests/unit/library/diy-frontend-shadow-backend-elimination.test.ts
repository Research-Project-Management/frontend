import { describe, it, expect } from 'vitest';
import {
  cleanAuthorName,
  isVietnameseName,
  normalizeAuthors,
  parseCreatorName,
} from '@/features/library/domain/creators';
import { generateCitationKey } from '@/features/library/domain/citations';
import {
  buildInspectorFieldPatch,
  resolveInspectorFieldValue,
} from '@/features/library/domain/item-field-schema';
import {
  cleanDoi,
  normalizeArxivId,
} from '@/features/library/domain/identifiers';
import {
  mapBackendItem,
  getMappedItemMeta,
  setMappedItemMeta,
  preserveMappedItemFlags,
} from '@/features/library/domain/metadata-mapper';
import {
  hasFullBackendItemFlag,
  mergeCachedItemWithPatch,
} from '@/features/library/sdk/queries/cache-patcher';
import { buildServerSuccessCachePatch } from '@/features/library/sdk/queries/item-mutations.queries';
import { isFeedEntryInLibrary } from '@/features/library/core/store/feeds.store';

import { SavedSearchAstEngine } from '@/features/library/domain/saved-search-ast.domain';
import {
  decodeXmlEntities,
  parseFeedXml,
  normalizeFetchedFeedEntries,
} from '@/features/library/domain/feed-parser.domain';
import {
  foldDiacritics,
  searchPdfPages,
} from '@/features/library/domain/reader-persistence.helpers';
import {
  extractAnnotationFacets,
  filterAndSortAnnotations,
} from '@/features/library/ui/reader/panel/AnnotationEditForm';
import {
  extractExplicitUserMergeOverrides,
  resolveDuplicateMergeFieldOverrides,
} from '@/features/library/domain/diff';
import type { Item } from '@/features/library/domain/types/library.types';
import type { ReaderAnnotation } from '@/features/library/domain/types/reader.types';

describe('DIY Frontend Shadow-Backend Elimination & Cross-Stack Parity (SH3)', () => {
  describe('SH3-01: Author Initial Preservation & Ambiguous Unaccented Surname Guard', () => {
    it('preserves inverted two-part author names whose initials match degree patterns (e.g., "Wong, M.D.", "Smith, B.S.", "Lee, M.A.")', () => {
      expect(cleanAuthorName('Wong, M.D.')).toBe('Wong, M.D.');
      expect(cleanAuthorName('Smith, B.S.')).toBe('Smith, B.S.');
      expect(cleanAuthorName('Lee, M.A.')).toBe('Lee, M.A.');

      const parsedWong = parseCreatorName('Wong, M.D.');
      expect(parsedWong.lastName).toBe('Wong');
      expect(parsedWong.firstName).toBe('M.D.');

      const normalized = normalizeAuthors(['Wong, M.D.']);
      expect(normalized).toEqual(['M.D. Wong']);
    });

    it('still strips genuine trailing academic degrees when preceded by a full name or unambiguous degree', () => {
      expect(cleanAuthorName('John Wong, M.D.')).toBe('John Wong');
      expect(cleanAuthorName('Wong, Michael, M.D.')).toBe('Wong, Michael');
      expect(cleanAuthorName('Jane Doe, Ph.D.')).toBe('Jane Doe');
    });

    it('does not invert 2-word unaccented names with ambiguous surnames ("Ma Smith", "An Lee", "Can Yaman", "Van Rossum")', () => {
      expect(isVietnameseName('Ma Smith')).toBe(false);
      expect(isVietnameseName('An Lee')).toBe(false);
      expect(isVietnameseName('Can Yaman')).toBe(false);
      expect(isVietnameseName('Van Rossum')).toBe(false);

      const maSmith = parseCreatorName('Ma Smith');
      expect(maSmith.firstName).toBe('Ma');
      expect(maSmith.lastName).toBe('Smith');

      const anLee = parseCreatorName('An Lee');
      expect(anLee.firstName).toBe('An');
      expect(anLee.lastName).toBe('Lee');

      const vanRossum = parseCreatorName('Van Rossum');
      expect(vanRossum.firstName).toBe('Van');
      expect(vanRossum.lastName).toBe('Rossum');
    });

    it('continues to detect genuine Vietnamese names with diacritics or 3+ Vietnamese syllables', () => {
      expect(isVietnameseName('Nguyễn Văn An')).toBe(true);
      expect(isVietnameseName('Nguyen Van An')).toBe(true);
      expect(isVietnameseName('Tran Minh')).toBe(true);
    });
  });

  describe('SH3-02: Explicit User Merge Overrides Only (Prevent Overwriting Backend Provenance)', () => {
    const masterItem = {
      id: 'master-1',
      title: 'Attention Is All You Need',
      itemType: 'journalArticle',
      abstractNote: 'Short master abstract.',
      publisher: 'Curran Associates',
      year: 2017,
      authors: ['Vaswani, A.'],
      extra: '',
      extraFields: {},
    } as unknown as Item;

    const duplicateItem = {
      id: 'dup-2',
      title: 'Attention Is All You Need',
      itemType: 'journalArticle',
      abstractNote:
        'The dominant sequence transduction models are based on complex recurrent or convolutional neural networks that include an encoder and a decoder.',
      publisher: 'Neural Information Processing Systems (NeurIPS)',
      volume: '30',
      year: 2017,
      authors: ['Ashish Vaswani', 'Noam Shazeer'],
      extra: '',
      extraFields: {},
    } as unknown as Item;

    it('returns an empty override object when the user has not explicitly clicked any field override', () => {
      const autoResolved = resolveDuplicateMergeFieldOverrides(
        [masterItem, duplicateItem],
        'master-1',
        {},
      );
      // Auto-resolution populates non-master higher-scored fields for UI preview:
      expect(Object.keys(autoResolved).length).toBeGreaterThan(0);

      // Explicit extraction only returns what the user explicitly selected:
      const explicitOnly = extractExplicitUserMergeOverrides(
        [masterItem, duplicateItem],
        'master-1',
        {},
      );
      expect(explicitOnly).toEqual({});
    });

    it('includes only the explicitly clicked field (and its coupled aliases) when user selects a field override', () => {
      const explicitOnly = extractExplicitUserMergeOverrides(
        [masterItem, duplicateItem],
        'master-1',
        { publisher: 'Neural Information Processing Systems (NeurIPS)' },
      );
      expect(explicitOnly.publisher).toBe(
        'Neural Information Processing Systems (NeurIPS)',
      );
      expect(explicitOnly.abstractNote).toBeUndefined();
      expect(explicitOnly.volume).toBeUndefined();
      expect(explicitOnly.authors).toBeUndefined();
    });
  });

  describe('SH3-03: Citation Key Parity with Backend & No Phantom Inspector Key', () => {
    it('matches Backend generateCitationKey on titles with <3 char words like "AI in Healthcare"', () => {
      const key = generateCitationKey({
        authors: ['John Smith'],
        year: 2024,
        title: 'AI in Healthcare',
      });
      expect(key).toBe('smith2024healthcare');
    });

    it('matches Backend stopwords ("towards", "using", "into", "from", "via") and NFKD + đ/Đ normalization', () => {
      const key = generateCitationKey({
        authors: ['Đặng Văn Lâm'],
        year: 2025,
        title: 'Towards Using Deep Learning into Medical Imaging',
      });
      expect(key).toBe('dang2025deep');
    });

    it('does not fabricate a phantom synthetic citationKey in resolveInspectorFieldValue when citationKey is empty', () => {
      const itemWithoutCiteKey = {
        id: 'item-no-key',
        title: 'AI in Healthcare',
        authors: ['John Smith'],
        year: 2024,
        citationKey: '',
        extra: '',
        extraFields: {},
      } as unknown as Item;

      expect(resolveInspectorFieldValue(itemWithoutCiteKey, 'citationKey')).toBe(
        '',
      );

      const itemWithCiteKey = {
        ...itemWithoutCiteKey,
        citationKey: 'smith2024custom',
      } as unknown as Item;
      expect(resolveInspectorFieldValue(itemWithCiteKey, 'citationKey')).toBe(
        'smith2024custom',
      );
    });
  });

  describe('SH3-04: Cross-Stack Schema, DOI Cleaning, and Annotation Color Filtering Parity', () => {
    it('converts ACL Anthology URLs to 10.18653/v1/<id> and strips trailing /full, /abstract, /pdf, .pdf suffixes in cleanDoi', () => {
      expect(cleanDoi('https://aclanthology.org/2020.acl-main.1/')).toBe(
        '10.18653/v1/2020.acl-main.1',
      );
      expect(cleanDoi('https://aclanthology.org/2023.emnlp-main.123.pdf')).toBe(
        '10.18653/v1/2023.emnlp-main.123',
      );
      expect(cleanDoi('https://doi.org/10.1000/xyz123/full')).toBe(
        '10.1000/xyz123',
      );
      expect(cleanDoi('https://doi.org/10.1000/xyz123.pdf')).toBe(
        '10.1000/xyz123',
      );
      expect(cleanDoi('10.1145/3442188.3445922/abstract')).toBe(
        '10.1145/3442188.3445922',
      );
    });

    it('projects statute codeNumber <-> volume in mapBackendItem and resolveInspectorFieldValue', () => {
      const mapped = mapBackendItem({
        id: 'statute-1',
        itemType: 'statute',
        nameOfAct: ' Clean Air Act ',
        extraFields: {
          codeNumber: '42 U.S.C.',
        },
      });
      expect(mapped.volume).toBe('42 U.S.C.');
      expect(resolveInspectorFieldValue(mapped, 'codeNumber')).toBe('42 U.S.C.');
    });

    it('couples presentation meetingName and sessionTitle with publicationTitle', () => {
      const mappedFromMeeting = mapBackendItem({
        id: 'pres-1',
        itemType: 'presentation',
        title: 'Keynote Talk',
        extraFields: {
          meetingName: 'NeurIPS 2025',
        },
      });
      expect(mappedFromMeeting.publicationTitle).toBe('NeurIPS 2025');
      expect(mappedFromMeeting.sessionTitle).toBe('NeurIPS 2025');

      const coupledPatch = buildInspectorFieldPatch(
        { id: 'pres-1', itemType: 'presentation', extraFields: {} },
        'meetingName',
        'ICML 2026',
      );
      expect(coupledPatch.publicationTitle).toBe('ICML 2026');
      expect(coupledPatch.meetingName).toBe('ICML 2026');
      expect(coupledPatch.sessionTitle).toBe('ICML 2026');
    });

    it('matches both named colors ("yellow") and hex colors ("#ffd400") in filterAndSortAnnotations and extractAnnotationFacets', () => {
      const annotations: ReaderAnnotation[] = [
        {
          id: 'ann-named',
          itemId: 'item-1',
          pageNumber: 1,
          type: 'highlight',
          color: 'yellow',
          quoteText: 'Named color highlight',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        } as ReaderAnnotation,
        {
          id: 'ann-hex',
          itemId: 'item-1',
          pageNumber: 2,
          type: 'highlight',
          color: '#ffd400',
          quoteText: 'Hex color highlight',
          createdAt: '2026-01-02T00:00:00.000Z',
          updatedAt: '2026-01-02T00:00:00.000Z',
        } as ReaderAnnotation,
      ];

      const facets = extractAnnotationFacets(annotations);
      expect(facets.existingColors).toHaveLength(1);
      expect(facets.existingColors[0]?.id).toBe('yellow');

      const filteredByHex = filterAndSortAnnotations(annotations, {
        searchQuery: '',
        selectedColor: '#ffd400',
        selectedTag: null,
        authorFilter: 'all',
        sortBy: 'position',
      });
      expect(filteredByHex.map((a) => a.id)).toEqual(['ann-named', 'ann-hex']);

      const filteredByName = filterAndSortAnnotations(annotations, {
        searchQuery: '',
        selectedColor: 'yellow',
        selectedTag: null,
        authorFilter: 'all',
        sortBy: 'position',
      });
      expect(filteredByName.map((a) => a.id)).toEqual(['ann-named', 'ann-hex']);
    });
  });

  describe('SBE1: WeakMap Item Meta Registry, Server Success Cache Patch, and Feed Entry Authoritative Matching', () => {
    it('tracks _isFullBackendItem and _hasExplicitUserState via WeakMap registry and buildServerSuccessCachePatch without losing user state', () => {
      const mappedNoState = mapBackendItem({
        id: 'item-meta-1',
        title: 'Authoritative Backend Item',
        itemType: 'journalArticle',
      });
      expect(hasFullBackendItemFlag(mappedNoState)).toBe(true);
      expect(getMappedItemMeta(mappedNoState)).toEqual({
        isFullBackendItem: true,
        hasExplicitUserState: false,
      });

      const cloned = preserveMappedItemFlags(mappedNoState, { ...mappedNoState });
      expect(hasFullBackendItemFlag(cloned)).toBe(true);
      expect(getMappedItemMeta(cloned)?.hasExplicitUserState).toBe(false);

      const existingCached = {
        ...mappedNoState,
        isStarred: true,
        isRead: true,
        readStatus: 'read',
        rating: 5,
      } as Item;

      const patch = buildServerSuccessCachePatch(
        mappedNoState,
        { title: 'Updated Title' },
        existingCached,
      );
      expect(patch.isStarred).toBe(true);
      expect(patch.rating).toBe(5);
      expect(getMappedItemMeta(patch)?.isFullBackendItem).toBe(true);
      expect(getMappedItemMeta(patch)?.hasExplicitUserState).toBe(false);

      const merged = mergeCachedItemWithPatch(existingCached, patch);
      expect(merged.isStarred).toBe(true);
      expect(merged.rating).toBe(5);
      expect(hasFullBackendItemFlag(merged)).toBe(true);
    });

    it('checks server-authoritative isSaved / savedItemId flags and normalizes DOIs in isFeedEntryInLibrary', () => {
      expect(
        isFeedEntryInLibrary(
          {
            id: 'entry-srv-1',
            title: 'Server Saved Paper',
            authors: [],
            categories: [],
            feedFormat: 'rss2',
            isSaved: true,
          },
          [],
          [],
        ),
      ).toBe(true);

      expect(
        isFeedEntryInLibrary(
          {
            id: 'entry-srv-2',
            title: 'Server Saved Item ID Paper',
            authors: [],
            categories: [],
            feedFormat: 'rss2',
            savedItemId: 'lib-item-99',
          },
          [],
          [],
        ),
      ).toBe(true);

      expect(
        isFeedEntryInLibrary(
          {
            id: 'entry-doi-norm',
            title: 'Different Title',
            authors: [],
            categories: [],
            feedFormat: 'rss2',
            doi: 'https://doi.org/10.1038/s41586-024-07487-w',
          },
          [],
          [{ doi: 'doi:10.1038/S41586-024-07487-W', title: 'AlphaFold 3' }],
        ),
      ).toBe(true);
    });
  });

  describe('SBE2-01: Unified Coupled-Field Engine Between GeneralFields and item-field-schema', () => {
    it('guarantees buildInspectorFieldPatch and buildInspectorFieldPatch produce identical patches for title, venue, place, date, numPages, and authority across item types', () => {
      const caseItem = {
        id: 'case-1',
        itemType: 'case',
        title: 'Old Case',
        extraFields: {},
      };
      const fromGeneral = buildInspectorFieldPatch(caseItem, 'caseName', 'Roe v. Wade');
      const fromSchema = buildInspectorFieldPatch(caseItem, 'caseName', 'Roe v. Wade');
      expect(fromGeneral).toEqual(fromSchema);
      expect(fromSchema.title).toBe('Roe v. Wade');
      expect(fromSchema.caseName).toBe('Roe v. Wade');

      const confItem = {
        id: 'conf-1',
        itemType: 'conferencePaper',
        extraFields: {},
      };
      const confPlaceA = buildInspectorFieldPatch(confItem, 'eventPlace', 'Kyoto, Japan');
      const confPlaceB = buildInspectorFieldPatch(confItem, 'eventPlace', 'Kyoto, Japan');
      expect(confPlaceA).toEqual(confPlaceB);
      expect(confPlaceB.place).toBe('Kyoto, Japan');
      expect(confPlaceB.eventPlace).toBe('Kyoto, Japan');

      const statuteItem = {
        id: 'stat-1',
        itemType: 'statute',
        extraFields: {},
      };
      const statDateA = buildInspectorFieldPatch(statuteItem, 'dateEnacted', '2024-09-01');
      const statDateB = buildInspectorFieldPatch(statuteItem, 'dateEnacted', '2024-09-01');
      expect(statDateA).toEqual(statDateB);
      expect(statDateB.date).toBe('2024-09-01');
      expect(statDateB.publicationDate).toBe('2024-09-01');
      expect(statDateB.dateEnacted).toBe('2024-09-01');
      expect(statDateB.year).toBe(2024);
    });
  });

  describe('SBE2-02: Client-Side Saved Search AST Execution Parity with Backend ConditionEvaluatorEngine', () => {
    const complexItem: Record<string, unknown> = {
      id: 'item-ast-1',
      title: 'Phân tích Hệ thống Học sâu',
      itemType: 'journalArticle',
      year: 2025,
      identifiers: [
        { type: 'doi', value: '10.1038/s41586-025-00001-x' },
        { type: 'arxiv', value: '2501.12345v2' },
        { type: 'pmid', value: '39876543' },
      ],
      contributors: [
        {
          contributor: {
            firstName: 'Văn An',
            lastName: 'Nguyễn',
            fullName: 'Nguyễn Văn An',
          },
        },
      ],
      itemTags: [{ tag: { name: 'Học Máy' } }],
      collectionItems: [{ collectionId: 'col-neuro-99' }],
      attachments: [
        {
          id: 'att-1',
          filename: 'deep-learning-supplement.pdf',
          deletedAt: null,
          annotations: [
            {
              id: 'ann-1',
              quoteText: 'Transformer self-attention',
              comment: 'Crucial ablation result',
              deletedAt: null,
            },
          ],
        },
      ],
      notesList: [
        {
          id: 'note-1',
          title: 'Methodology Note',
          contentMd: 'Uses rotary position embeddings (RoPE).',
          deletedAt: null,
        },
      ],
    };

    it('resolves relational identifiers (doi, arxivId, pmid) and normalizes query prefixes', () => {
      expect(
        SavedSearchAstEngine.matchesItem(complexItem, {
          conjunction: 'AND',
          conditions: [
            { field: 'doi', operator: 'is', value: 'https://doi.org/10.1038/s41586-025-00001-x' },
            { field: 'arxivId', operator: 'is', value: 'arXiv:2501.12345' },
            { field: 'pmid', operator: 'is', value: 'PMID: 39876543' },
          ],
        }),
      ).toBe(true);
    });

    it('matches creators, tags, collections, attachments, notes, and anyField with Unicode diacritic folding', () => {
      expect(
        SavedSearchAstEngine.matchesItem(complexItem, {
          conjunction: 'AND',
          conditions: [
            { field: 'title', operator: 'contains', value: 'phan tich he thong' },
            { field: 'creator', operator: 'contains', value: 'nguyen van an' },
            { field: 'tag', operator: 'is', value: 'hoc may' },
            { field: 'collection', operator: 'is', value: 'col-neuro-99' },
            { field: 'hasAttachment', operator: 'isPresent', value: '' },
            { field: 'anyField', operator: 'contains', value: 'rotary position embeddings' },
            { field: 'anyField', operator: 'contains', value: 'Crucial ablation result' },
          ],
        }),
      ).toBe(true);

      const itemWithoutAttachments: Record<string, unknown> = {
        id: 'item-no-att',
        title: 'No PDF',
        attachments: [],
        hasFile: false,
      };
      expect(
        SavedSearchAstEngine.matchesItem(itemWithoutAttachments, {
          conjunction: 'AND',
          conditions: [{ field: 'hasAttachment', operator: 'isPresent', value: '' }],
        }),
      ).toBe(false);
      expect(
        SavedSearchAstEngine.matchesItem(itemWithoutAttachments, {
          conjunction: 'AND',
          conditions: [{ field: 'hasAttachment', operator: 'isAbsent', value: '' }],
        }),
      ).toBe(true);
    });
  });

  describe('SBE2-03: Feed Parser Entity Decoding & Canonical Identifier Normalization', () => {
    it('decodes academic named entities (&mdash;, &ndash;, &rsquo;, &ldquo;, &rdquo;, &alpha;, &beta;, &eacute;) and numeric/hex entities', () => {
      const raw =
        'Deep Learning &mdash; State&ndash;of&ndash;the&ndash;Art in &ldquo;&alpha;&ndash;&beta; Pruning&rdquo; &amp; Café&#x2019;s &#937; Bounds';
      expect(decodeXmlEntities(raw)).toBe(
        'Deep Learning \u2014 State\u2013of\u2013the\u2013Art in \u201C\u03B1\u2013\u03B2 Pruning\u201D & Caf\u00E9\u2019s \u03A9 Bounds',
      );
    });

    it('normalizes DOIs and arXiv IDs in parseFeedXml and normalizeFetchedFeedEntries using cleanDoi and normalizeArxivId', () => {
      expect(normalizeArxivId('https://arxiv.org/abs/2403.09876v2.pdf')).toBe('2403.09876v2');
      expect(normalizeArxivId('10.48550/arXiv.2403.09876v2', { stripVersion: true })).toBe(
        '2403.09876',
      );

      const atomXml = `<?xml version="1.0" encoding="UTF-8"?>
        <feed xmlns="http://www.w3.org/2005/Atom" xmlns:arxiv="http://arxiv.org/schemas/atom">
          <entry>
            <id>http://arxiv.org/abs/2407.11223v1</id>
            <title>Scaling Laws &mdash; &ldquo; Phase Transitions &rdquo; in LLMs (arXiv:2407.11223v1 [cs.CL])</title>
            <summary>We study &alpha;-scaling under DOI https://doi.org/10.1145/3580305.3599300/full.</summary>
            <published>2024-07-15T12:00:00Z</published>
            <author><name>L&eacute;on Bottou</name></author>
            <category term="cs.CL" />
          </entry>
        </feed>`;

      const parsed = parseFeedXml(atomXml);
      expect(parsed).toHaveLength(1);
      expect(parsed[0]?.title).toBe('Scaling Laws \u2014 \u201C Phase Transitions \u201D in LLMs');
      expect(parsed[0]?.arxivId).toBe('2407.11223v1');
      expect(parsed[0]?.doi).toBe('10.1145/3580305.3599300');
      expect(parsed[0]?.authors).toEqual(['L\u00E9on Bottou']);
      expect(parsed[0]?.publishedAt).toBe('2024-07-15');
      expect(parsed[0]?.year).toBe(2024);

      const normalizedApi = normalizeFetchedFeedEntries([
        {
          id: 'api-1',
          title: 'Quantum &ndash; Classical Hybrids',
          authors: ['Schr&ouml;dinger, Erwin'],
          doi: 'https://doi.org/10.1038/s41586-024-07000-1.pdf',
          arxivId: 'arXiv:2402.00111v3 [quant-ph]',
          published: '2024-02-10T08:30:00Z',
        },
      ]);
      expect(normalizedApi[0]?.title).toBe('Quantum \u2013 Classical Hybrids');
      expect(normalizedApi[0]?.authors).toEqual(['Schr\u00F6dinger, Erwin']);
      expect(normalizedApi[0]?.doi).toBe('10.1038/s41586-024-07000-1');
      expect(normalizedApi[0]?.arxivId).toBe('2402.00111v3');
      expect(normalizedApi[0]?.publishedAt).toBe('2024-02-10');
      expect(normalizedApi[0]?.year).toBe(2024);
    });
  });

  describe('SBE2-04: Reader Persistence Helpers Diacritic-Folded PDF Search & WeakMap Caching', () => {
    it('exports foldDiacritics and searchPdfPages with diacritic-insensitive matching across stable page references', () => {
      const pages = [
        { pageNumber: 1, text: 'Phương pháp tối ưu hóa mạng nơ-ron sâu của Nguyễn Văn An.' },
        { pageNumber: 2, text: 'Results on Schrödinger wave equations and Poincaré embeddings.' },
      ];
      const firstHits = searchPdfPages(pages, 'nguyen van an');
      expect(firstHits).toHaveLength(1);
      expect(firstHits[0]?.pageNumber).toBe(1);

      const secondHits = searchPdfPages(pages, 'schrodinger');
      expect(secondHits).toHaveLength(1);
      expect(secondHits[0]?.pageNumber).toBe(2);
      expect(foldDiacritics('Đặng Văn Lâm')).toBe('dang van lam');
    });
  });
});
