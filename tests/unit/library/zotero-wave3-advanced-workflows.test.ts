import { describe, it, expect, beforeEach } from 'vitest';
import {
  useReaderStore,
  normalizeReaderZoom,
} from '@/features/library/store/reader.store';
import { useLibraryUIStore } from '@/features/library/store/library-ui.store';
import {
  savedSearchConditionGroupSchema,
  evaluateSavedSearch,
  filterItemsBySavedSearch,
  type SavedSearchConditionGroup,
} from '@/features/library/types/saved-searches.types';
import {
  PdfAnnotationEngine,
  formatAnnotationCitation,
} from '@/features/library/domain/reader.domain';
import {
  getLibraryPermissions,
  getScopeTarget,
} from '@/features/library/domain/library-permissions.policy';
import type { ReaderAnnotation, ReaderDocument } from '@/features/library/types/reader.types';
import type { LibraryScope } from '@/features/library/types/core.types';

describe('Zotero 7 Wave 3 — Advanced Researcher Workflows & Edge-Case Verification', () => {
  beforeEach(() => {
    useReaderStore.setState({
      tabs: [{ id: 'library', title: 'My Library', type: 'library' }],
      activeTabId: 'library',
      readingPaperId: null,
      activeColor: '#ffd400',
      activeTool: 'highlight',
      bookmarks: {},
    });

    useLibraryUIStore.setState({
      activeScope: { type: 'user', id: 'user', name: 'Library' },
      selectedIds: new Set<string>(),
      activeItemId: null,
      activeCollectionId: null,
      activeSavedSearchId: null,
      activeModal: null,
      modalProps: {},
    });
  });

  // ===========================================================================
  // USER STORY 1: Multi-Tab PDF Reader & Reading Position Persistence
  // ===========================================================================
  describe('User Story 1: Multi-Tab PDF Reader & Reading Position Persistence', () => {
    it('normalizes zoom whether provided as float (1.25) or percentage (125) and clamps to [0.25, 5.0]', () => {
      expect(normalizeReaderZoom(1.25)).toBe(1.25);
      expect(normalizeReaderZoom(125)).toBe(1.25);
      expect(normalizeReaderZoom(150)).toBe(1.5);
      expect(normalizeReaderZoom(0.1)).toBe(0.25);
      expect(normalizeReaderZoom(900)).toBe(5.0);
      expect(normalizeReaderZoom(undefined)).toBe(1.0);
      expect(normalizeReaderZoom(NaN)).toBe(1.0);
    });

    it('opens multiple papers in tabs, persists per-tab page/zoom/fitMode/rotation/theme, and avoids duplicate tabs', () => {
      const store = useReaderStore.getState();

      store.openTab({
        id: 'paper-vaswani-2017',
        title: 'Attention Is All You Need',
        type: 'paper',
        currentPage: 5,
        zoom: 125, // percentage input normalized to 1.25
        fitMode: 'page-width',
      });

      store.openTab({
        id: 'paper-dao-2022',
        title: 'FlashAttention',
        type: 'paper',
        currentPage: 12,
        zoom: 1.5,
        fitMode: 'page-fit',
        theme: 'sepia',
      });

      let state = useReaderStore.getState();
      expect(state.tabs).toHaveLength(3); // 'library' + 2 papers
      expect(state.activeTabId).toBe('paper-dao-2022');
      expect(state.readingPaperId).toBe('paper-dao-2022');

      const vaswaniTab = state.tabs.find((t) => t.id === 'paper-vaswani-2017');
      const daoTab = state.tabs.find((t) => t.id === 'paper-dao-2022');
      expect(vaswaniTab?.currentPage).toBe(5);
      expect(vaswaniTab?.zoom).toBe(1.25);
      expect(daoTab?.currentPage).toBe(12);
      expect(daoTab?.zoom).toBe(1.5);
      expect(daoTab?.theme).toBe('sepia');

      // Re-opening an already open paper updates title/state without creating a duplicate tab
      store.openReader('paper-vaswani-2017', 'Attention Is All You Need (NeurIPS 2017)');
      state = useReaderStore.getState();
      expect(state.tabs).toHaveLength(3);
      expect(state.activeTabId).toBe('paper-vaswani-2017');
      const updatedVaswani = state.tabs.find((t) => t.id === 'paper-vaswani-2017');
      expect(updatedVaswani?.title).toBe('Attention Is All You Need (NeurIPS 2017)');
      expect(updatedVaswani?.currentPage).toBe(5); // Preserves page 5!

      // Updating page & state on active tab does not affect other open tabs
      store.updateTabPage('paper-vaswani-2017', 9);
      store.updateTabState('paper-vaswani-2017', { zoom: 175, rotation: 90 });

      state = useReaderStore.getState();
      expect(state.tabs.find((t) => t.id === 'paper-vaswani-2017')?.currentPage).toBe(9);
      expect(state.tabs.find((t) => t.id === 'paper-vaswani-2017')?.zoom).toBe(1.75);
      expect(state.tabs.find((t) => t.id === 'paper-vaswani-2017')?.rotation).toBe(90);
      expect(state.tabs.find((t) => t.id === 'paper-dao-2022')?.currentPage).toBe(12);
    });

    it('manages per-paper bookmarks without cross-paper leakage and sorts bookmarked pages ascending', () => {
      const store = useReaderStore.getState();

      expect(store.toggleBookmark('paper-1', 8)).toBe(true);
      expect(store.toggleBookmark('paper-1', 3)).toBe(true);
      expect(store.toggleBookmark('paper-2', 14)).toBe(true);

      expect(useReaderStore.getState().getBookmarks('paper-1')).toEqual([3, 8]);
      expect(useReaderStore.getState().getBookmarks('paper-2')).toEqual([14]);

      // Toggling page 3 again removes it from paper-1
      expect(store.toggleBookmark('paper-1', 3)).toBe(false);
      expect(useReaderStore.getState().getBookmarks('paper-1')).toEqual([8]);
      expect(useReaderStore.getState().getBookmarks('paper-2')).toEqual([14]);
    });

    it('selects adjacent paper tab when closing the active paper tab, falling back to library tab when last paper closes', () => {
      const store = useReaderStore.getState();
      store.openReader('paper-1', 'Paper 1');
      store.openReader('paper-2', 'Paper 2');
      store.openReader('paper-3', 'Paper 3');

      // Switch to paper-1 (index 1, right after 'library') and close it -> should select adjacent 'paper-2'
      store.setActiveTab('paper-1');
      expect(useReaderStore.getState().activeTabId).toBe('paper-1');

      store.closeTab('paper-1');
      expect(useReaderStore.getState().activeTabId).toBe('paper-2');
      expect(useReaderStore.getState().readingPaperId).toBe('paper-2');

      // Close paper-2 -> should select adjacent 'paper-3'
      store.closeTab('paper-2');
      expect(useReaderStore.getState().activeTabId).toBe('paper-3');

      // Close last remaining paper-3 -> falls back to 'library' with readingPaperId = null
      store.closeTab('paper-3');
      expect(useReaderStore.getState().activeTabId).toBe('library');
      expect(useReaderStore.getState().readingPaperId).toBeNull();
    });
  });

  // ===========================================================================
  // USER STORY 2: Zotero Saved Search Condition Builder & Smart View Filtering
  // ===========================================================================
  describe('User Story 2: Zotero Saved Search Condition Builder & Cross-Scope Isolation', () => {
    const sampleCorpus = [
      {
        id: 'item-1',
        title: 'Attention Is All You Need: Transformer Architecture',
        year: 2023,
        readStatus: 'unread',
        hasFile: true,
        itemType: 'journalArticle',
        tags: [{ name: 'deep-learning' }, { name: 'nlp' }],
        creators: [{ firstName: 'Ashish', lastName: 'Vaswani' }],
        doi: '10.48550/arXiv.1706.03762',
      },
      {
        id: 'item-2',
        title: 'Scaling Laws for Neural Language Models',
        year: 2020,
        readStatus: 'unread',
        hasFile: true,
        itemType: 'preprint',
        tags: [{ name: 'scaling' }],
        creators: [{ firstName: 'Jared', lastName: 'Kaplan' }],
        doi: '',
      },
      {
        id: 'item-3',
        title: 'Vision Transformer (ViT) at Scale',
        year: 2022,
        readStatus: 'read',
        hasFile: true,
        itemType: 'conferencePaper',
        tags: [{ name: 'vision' }, { name: 'deep-learning' }],
        creators: [{ firstName: 'Alexey', lastName: 'Dosovitskiy' }],
        doi: '10.1109/CVPR.2022.001',
      },
      {
        id: 'item-4',
        title: 'Graph Transformer Networks without PDF',
        year: 2024,
        readStatus: 'unread',
        hasFile: false,
        itemType: 'journalArticle',
        tags: [{ name: 'graphs' }],
        creators: [{ firstName: 'Seongjun', lastName: 'Yun' }],
        doi: '10.1000/gtn.2024',
      },
    ];

    it('evaluates multi-condition AND/OR Saved Search trees with Zotero operators', () => {
      const searchGroup: SavedSearchConditionGroup = savedSearchConditionGroupSchema.parse({
        conjunction: 'AND',
        conditions: [
          { field: 'title', operator: 'contains', value: 'transformer' },
          { field: 'year', operator: 'isGreaterThan', value: 2020 },
          { field: 'readStatus', operator: 'is', value: 'unread' },
          { field: 'hasFile', operator: 'is', value: 'true' },
        ],
      });

      const matches = filterItemsBySavedSearch(sampleCorpus, searchGroup);
      expect(matches.map((m) => m.id)).toEqual(['item-1']);
    });

    it('supports nested OR groups, isBetween, isPresent, isAbsent, beginsWith, and tag matching', () => {
      const nestedGroup: SavedSearchConditionGroup = {
        conjunction: 'AND',
        conditions: [
          { field: 'doi', operator: 'isPresent' },
          { field: 'year', operator: 'isBetween', value: [2021, 2023] },
          {
            conjunction: 'OR',
            conditions: [
              { field: 'tag', operator: 'is', value: 'vision' },
              { field: 'authors', operator: 'contains', value: 'Vaswani' },
            ],
          },
        ],
      };

      const matches = filterItemsBySavedSearch(sampleCorpus, nestedGroup);
      expect(matches.map((m) => m.id)).toEqual(['item-1', 'item-3']);
      expect(
        evaluateSavedSearch(sampleCorpus[1]!, {
          conjunction: 'AND',
          conditions: [{ field: 'doi', operator: 'isAbsent' }],
        }),
      ).toBe(true);
    });

    it('clears stale selectedIds, activeItemId, activeCollectionId, and activeSavedSearchId when switching activeScope', () => {
      const uiStore = useLibraryUIStore.getState();

      // Set up state inside Project Library
      uiStore.setActiveScope({
        type: 'project',
        id: 'proj-quantum-ai',
        projectId: 'proj-quantum-ai',
        name: 'Quantum AI Lab',
        role: 'coordinator',
      });
      uiStore.selectAll(['proj-item-1', 'proj-item-2']);
      uiStore.setActiveItem('proj-item-1');
      uiStore.setActiveCollectionId('proj-col-99');
      uiStore.setActiveSavedSearchId('proj-search-42');

      let state = useLibraryUIStore.getState();
      expect(state.selectedIds.size).toBe(2);
      expect(state.activeItemId).toBe('proj-item-1');
      expect(state.activeSavedSearchId).toBe('proj-search-42');
      // Setting savedSearchId automatically clears activeCollectionId so both cannot conflict
      expect(state.activeCollectionId).toBeNull();

      // Switch to Personal Library ('user') -> all project selections and filters must be reset!
      uiStore.setActiveScope({
        type: 'user',
        id: 'user',
        name: 'My Library',
      });

      state = useLibraryUIStore.getState();
      expect(state.activeScope.type).toBe('user');
      expect(state.selectedIds.size).toBe(0);
      expect(state.activeItemId).toBeNull();
      expect(state.activeCollectionId).toBeNull();
      expect(state.activeSavedSearchId).toBeNull();
    });
  });

  // ===========================================================================
  // USER STORY 3: PDF Annotation Highlighting, Reading-Order Sort & Note Synthesis
  // ===========================================================================
  describe('User Story 3: PDF Annotation Reading-Order Sort & Markdown Note Synthesis', () => {
    const paper: ReaderDocument = {
      id: 'paper-vaswani',
      title: 'Attention Is All You Need',
      authors: ['Vaswani, Ashish', 'Shazeer, Noam', 'Parmar, Niki'],
      year: 2017,
    };

    const outOfOrderAnnotations: ReaderAnnotation[] = [
      {
        id: 'ann-p3-bottom',
        attachmentId: 'att-pdf-1',
        type: 'highlight',
        pageIndex: 2, // Page 3
        pageNumber: 3,
        quoteText: 'We call our particular attention "Scaled Dot-Product Attention".',
        comment: 'Core formula definition at bottom of Page 3',
        color: '#ffd400',
        rects: [{ x1: 0.12, y1: 0.8, x2: 0.88, y2: 0.84 }],
        boundingRect: { x1: 0.12, y1: 0.8, x2: 0.88, y2: 0.84 },
        version: 1,
        createdAt: '2026-10-14T10:00:00.000Z', // Created FIRST
      },
      {
        id: 'ann-p3-top',
        attachmentId: 'att-pdf-1',
        type: 'highlight',
        pageIndex: 2, // Page 3
        pageNumber: 3,
        quoteText: 'An attention function can be described as mapping a query and a set of key-value pairs to an output.',
        comment: 'High-level intuition at top of Page 3',
        color: '#5fb236',
        rects: [{ x1: 0.12, y1: 0.15, x2: 0.88, y2: 0.2 }],
        boundingRect: { x1: 0.12, y1: 0.15, x2: 0.88, y2: 0.2 },
        version: 1,
        createdAt: '2026-10-14T10:05:00.000Z', // Created SECOND
      },
      {
        id: 'ann-p1-middle',
        attachmentId: 'att-pdf-1',
        type: 'highlight',
        pageIndex: 0, // Page 1
        pageNumber: 1,
        quoteText: 'The Transformer is the first transduction model relying entirely on self-attention.',
        comment: 'Key abstract claim on Page 1',
        color: '#2ea8e5',
        rects: [{ x1: 0.1, y1: 0.5, x2: 0.9, y2: 0.55 }],
        boundingRect: { x1: 0.1, y1: 0.5, x2: 0.9, y2: 0.55 },
        version: 1,
        createdAt: '2026-10-14T10:10:00.000Z', // Created THIRD
      },
    ];

    it('sorts annotations in natural reading order (Page 1 y=0.5 -> Page 3 y=0.15 -> Page 3 y=0.8) regardless of creation time', () => {
      const sorted = PdfAnnotationEngine.sortAnnotationsInReadingOrder(outOfOrderAnnotations);
      expect(sorted.map((a) => a.id)).toEqual([
        'ann-p1-middle',
        'ann-p3-top',
        'ann-p3-bottom',
      ]);
    });

    it('synthesizes a structured Markdown note in reading order with blockquotes, comments, and deep-link PDF citations', () => {
      const markdown = PdfAnnotationEngine.synthesizeMarkdownNote(
        outOfOrderAnnotations,
        paper,
        'att-pdf-1',
      );

      const blocks = markdown.split('\n\n---\n\n');
      expect(blocks).toHaveLength(3);

      // Block 0: Page 1 (y = 0.5)
      expect(blocks[0]).toContain(
        '> "The Transformer is the first transduction model relying entirely on self-attention."',
      );
      expect(blocks[0]).toContain(
        '[(Vaswani et al., 2017, p. 1)](flux://open-pdf/library/items/att-pdf-1?page=1&annotation=ann-p1-middle)',
      );
      expect(blocks[0]).toContain('**Note:** Key abstract claim on Page 1');

      // Block 1: Page 3 top (y = 0.15)
      expect(blocks[1]).toContain(
        '> "An attention function can be described as mapping a query and a set of key-value pairs to an output."',
      );
      expect(blocks[1]).toContain(
        '[(Vaswani et al., 2017, p. 3)](flux://open-pdf/library/items/att-pdf-1?page=3&annotation=ann-p3-top)',
      );

      // Block 2: Page 3 bottom (y = 0.8)
      expect(blocks[2]).toContain(
        '> "We call our particular attention "Scaled Dot-Product Attention"."',
      );
      expect(blocks[2]).toContain(
        '[(Vaswani et al., 2017, p. 3)](flux://open-pdf/library/items/att-pdf-1?page=3&annotation=ann-p3-bottom)',
      );

      // Verify formatAnnotationCitation standalone contract
      const cit = formatAnnotationCitation(paper, 'att-pdf-1', 3, 'ann-p3-top');
      expect(cit.label).toBe('(Vaswani et al., 2017, p. 3)');
      expect(cit.url).toBe('flux://open-pdf/library/items/att-pdf-1?page=3&annotation=ann-p3-top');
    });
  });

  // ===========================================================================
  // USER STORY 4: Project Role Permission Matrix & API Target Resolution
  // ===========================================================================
  describe('User Story 4: Project Role Permission Policies (Case-Insensitive & Alias Roles)', () => {
    it('grants full unrestricted permissions in Personal Library (user scope)', () => {
      const perms = getLibraryPermissions({ type: 'user', id: 'user', name: 'My Library' });
      expect(perms).toEqual({
        canRead: true,
        canCreateItem: true,
        canEditItem: true,
        canDeleteItem: true,
        canManageCollections: true,
        canImport: true,
        canExport: true,
      });
    });

    it('enforces exact capability matrix across the 4 canonical roles: owner, coordinator, contributor, and reviewer', () => {
      const managementRoles = ['owner', 'coordinator'] as const;
      for (const role of managementRoles) {
        const scope: LibraryScope = {
          type: 'project',
          id: 'proj-1',
          name: 'Lab',
          role,
        };
        const perms = getLibraryPermissions(scope);
        expect(perms.canCreateItem).toBe(true);
        expect(perms.canEditItem).toBe(true);
        expect(perms.canDeleteItem).toBe(true);
        expect(perms.canManageCollections).toBe(true);
        expect(perms.canImport).toBe(true);
        expect(perms.canExport).toBe(true);
      }

      const contributorScope: LibraryScope = {
        type: 'project',
        id: 'proj-1',
        name: 'Lab',
        role: 'contributor',
      };
      const contributorPerms = getLibraryPermissions(contributorScope);
      expect(contributorPerms.canRead).toBe(true);
      expect(contributorPerms.canCreateItem).toBe(true);
      expect(contributorPerms.canEditItem).toBe(true);
      expect(contributorPerms.canDeleteItem).toBe(false); // Cannot permanently delete/purge project items
      expect(contributorPerms.canManageCollections).toBe(true);
      expect(contributorPerms.canImport).toBe(true);
      expect(contributorPerms.canExport).toBe(true);

      const reviewerScope: LibraryScope = {
        type: 'project',
        id: 'proj-1',
        name: 'Lab',
        role: 'reviewer',
      };
      const reviewerPerms = getLibraryPermissions(reviewerScope);
      expect(reviewerPerms).toEqual({
        canRead: true,
        canCreateItem: false,
        canEditItem: false,
        canDeleteItem: false,
        canManageCollections: false,
        canImport: false,
        canExport: true,
      });

      const target = getScopeTarget({
        type: 'project',
        id: 'proj-alpha-1',
        name: 'Alpha',
        role: 'owner',
      });
      expect(target).toEqual({
        isProject: true,
        projectId: 'proj-alpha-1',
        itemsApiUrl: '/api/v1/projects/proj-alpha-1/library/items',
      });
    });
  });
});
