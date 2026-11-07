import { describe, it, expect } from 'vitest';
import {
  normalizeSearchStr,
  calculateFilterMatchScore,
  KNOWN_TYPE_ALIASES,
} from '@/features/library/domain/extra-metadata.mapper';
import {
  getFieldConfig,
  parseDurationParts,
  formatConditionValue,
} from '@/features/library/domain/saved-search-ast.domain';
import {
  calculateEffectiveViewportDimensions,
  computeSpreadPairs,
  isPageInVirtualWindow,
  calculatePageAspectRatio,
  normalizeRectCoordinates,
} from '@/features/library/domain/reader-search-outline.domain';

describe('Library Deep Domain Models (Pure In-Process)', () => {
  describe('filter-matcher.domain', () => {
    it('normalizes accents and whitespace correctly', () => {
      expect(normalizeSearchStr('Báo cáo khoa học & công nghệ!')).toBe('bao cao khoa hoc cong nghe');
      expect(normalizeSearchStr('  Zotero   7   Reader  ')).toBe('zotero 7 reader');
    });

    it('matches exact tokens and aliases with scoring', () => {
      const match = calculateFilterMatchScore('Journal Article', 'journal', KNOWN_TYPE_ALIASES['journalarticle']);
      expect(match.matches).toBe(true);
      expect(match.score).toBeGreaterThanOrEqual(85);

      const nomatch = calculateFilterMatchScore('Journal Article', 'patent', []);
      expect(nomatch.matches).toBe(false);
      expect(nomatch.score).toBe(0);
    });

    it('handles fuzzy subsequence matching', () => {
      const fuzzy = calculateFilterMatchScore('preprint', 'prprnt', []);
      expect(fuzzy.matches).toBe(true);
      expect(fuzzy.score).toBeGreaterThan(0);
    });
  });

  describe('saved-search-schema.domain', () => {
    it('provides operators and configurations for fields', () => {
      const anyField = getFieldConfig('anyField');
      expect(anyField.operators.some((op) => op.value === 'contains')).toBe(true);

      const dateAdded = getFieldConfig('dateAdded');
      expect(dateAdded.operators.some((op) => op.value === 'isInTheLast')).toBe(true);

      const itemType = getFieldConfig('itemType');
      expect(itemType.defaultValue).toBe('journalArticle');
    });

    it('parses duration strings accurately', () => {
      expect(parseDurationParts('7d')).toEqual({ count: '7', unit: 'days' });
      expect(parseDurationParts('2 weeks')).toEqual({ count: '2', unit: 'weeks' });
      expect(parseDurationParts('3m')).toEqual({ count: '3', unit: 'months' });
      expect(parseDurationParts('')).toEqual({ count: '30', unit: 'days' });
    });

    it('formats condition values based on schema type', () => {
      expect(formatConditionValue('year', '2024')).toBe(2024);
      expect(formatConditionValue('rating', '4')).toBe(4);
      expect(formatConditionValue('hasAttachment', 'true')).toBe(true);
      expect(formatConditionValue('title', 'Quantum Computing')).toBe('Quantum Computing');
    });
  });

  describe('pdf-viewport.model', () => {
    it('calculates page dimensions across fit and view modes', () => {
      const fitWidth = calculateEffectiveViewportDimensions({
        containerWidth: 1000,
        containerHeight: 800,
        zoom: 1.0,
        fitMode: 'fit-width',
        viewMode: 'continuous',
      });
      expect(fitWidth.effectivePageWidth).toBe(984); // 1000 - 16

      const fitPage = calculateEffectiveViewportDimensions({
        containerWidth: 1000,
        containerHeight: 800,
        zoom: 1.0,
        fitMode: 'fit-page',
        viewMode: 'continuous',
      });
      expect(fitPage.effectivePageWidth).toBe(Math.round((800 - 72) / 1.414));

      const spread = calculateEffectiveViewportDimensions({
        containerWidth: 1000,
        containerHeight: 800,
        zoom: 1.0,
        viewMode: 'spread',
      });
      expect(spread.effectivePageWidth).toBe(Math.round((1000 - 32) / 2));
    });

    it('computes spread pairs correctly', () => {
      expect(computeSpreadPairs(5)).toEqual([
        [1, 2],
        [3, 4],
        [5, null],
      ]);
      expect(computeSpreadPairs(0)).toEqual([]);
    });

    it('determines virtual rendering window membership', () => {
      expect(
        isPageInVirtualWindow({
          pageNum: 4,
          visiblePage: 3,
          totalPages: 20,
          viewMode: 'continuous',
        })
      ).toBe(true);

      expect(
        isPageInVirtualWindow({
          pageNum: 8,
          visiblePage: 3,
          totalPages: 20,
          viewMode: 'continuous',
        })
      ).toBe(false);

      expect(
        isPageInVirtualWindow({
          pageNum: 8,
          visiblePage: 3,
          totalPages: 20,
          viewMode: 'continuous',
          pinnedPage: 8,
        })
      ).toBe(true);
    });

    it('calculates aspect ratio with rotation', () => {
      expect(calculatePageAspectRatio({ width: 600, height: 800 }, 0)).toBeCloseTo(800 / 600);
      expect(calculatePageAspectRatio({ width: 600, height: 800 }, 90)).toBeCloseTo(600 / 800);
    });

    it('normalizes drag coordinates to [0, 1] relative rects', () => {
      const rect = normalizeRectCoordinates(50, 100, 250, 300, 500, 1000);
      expect(rect).not.toBeNull();
      expect(rect?.x1).toBe(0.1);
      expect(rect?.y1).toBe(0.1);
      expect(rect?.width).toBe(0.4);
      expect(rect?.height).toBe(0.2);
    });
  });

  describe('sdk/library.client (Standalone Microservice Routing & Transport)', () => {
    it('resolves relative Monolith/Gateway paths when no microservice env var is set', async () => {
      const { resolveLibraryUrl, resolveLibraryRawPath } = await import(
        '@/features/library/sdk/clients/http.client'
      );

      expect(resolveLibraryUrl('catalog', '/items')).toBe('/api/v1/library/items');
      expect(resolveLibraryUrl('catalog', '/items', 'user')).toBe('/api/v1/library/items');
      expect(resolveLibraryUrl('catalog', '/items', 'proj-42', 'counts')).toBe(
        '/api/v1/projects/proj-42/library/items/counts',
      );
      expect(resolveLibraryRawPath('/api/v1/library/citation/resolve', 'citation')).toBe(
        '/api/v1/library/citation/resolve',
      );
    }, 30000);

    it('dynamically routes to standalone Library Microservice host when NEXT_PUBLIC_LIBRARY_SERVICES_URL is configured', async () => {
      const prevEnv = process.env.NEXT_PUBLIC_LIBRARY_SERVICES_URL;
      process.env.NEXT_PUBLIC_LIBRARY_SERVICES_URL = 'https://library-service.flux.io/api/v1/library';

      try {
        const { resolveLibraryUrl, resolveLibraryRawPath, getLibraryServiceHost } = await import(
          '@/features/library/sdk/clients/http.client'
        );

        expect(getLibraryServiceHost('catalog')).toBe('https://library-service.flux.io');
        expect(resolveLibraryUrl('catalog', '/items')).toBe(
          'https://library-service.flux.io/api/v1/library/items',
        );
        expect(resolveLibraryUrl('catalog', '/items', 'proj-99')).toBe(
          'https://library-service.flux.io/api/v1/projects/proj-99/library/items',
        );
        expect(resolveLibraryRawPath('/api/v1/library/files/f-1/content', 'extraction')).toBe(
          'https://library-service.flux.io/api/v1/library/files/f-1/content',
        );
      } finally {
        if (prevEnv === undefined) {
          delete process.env.NEXT_PUBLIC_LIBRARY_SERVICES_URL;
        } else {
          process.env.NEXT_PUBLIC_LIBRARY_SERVICES_URL = prevEnv;
        }
      }
    });

    it('supports independent per-subdomain service hosts and origin trust verification', async () => {
      const prevCatalog = process.env.NEXT_PUBLIC_LIBRARY_CATALOG_URL;
      const prevCitation = process.env.NEXT_PUBLIC_LIBRARY_CITATION_URL;
      const prevServices = process.env.NEXT_PUBLIC_LIBRARY_SERVICES_URL;
      process.env.NEXT_PUBLIC_LIBRARY_CATALOG_URL = 'https://catalog-svc.flux.io/api/v1';
      process.env.NEXT_PUBLIC_LIBRARY_CITATION_URL = 'https://citation-svc.flux.io';
      process.env.NEXT_PUBLIC_LIBRARY_SERVICES_URL = 'https://fallback-svc.flux.io';

      try {
        const { resolveLibraryUrl, getLibraryServiceHost, isTrustedOrigin } = await import(
          '@/features/library/sdk/clients/http.client'
        );

        expect(getLibraryServiceHost('catalog')).toBe('https://catalog-svc.flux.io');
        expect(getLibraryServiceHost('citation')).toBe('https://citation-svc.flux.io');
        expect(getLibraryServiceHost('reader')).toBe('https://fallback-svc.flux.io');
        expect(resolveLibraryUrl('catalog', '/items', 'user')).toBe(
          'https://catalog-svc.flux.io/api/v1/library/items',
        );
        expect(resolveLibraryUrl('citation', '/items', 'user', 'citations/parse')).toBe(
          'https://citation-svc.flux.io/api/v1/library/items/citations/parse',
        );
        expect(isTrustedOrigin('https://catalog-svc.flux.io')).toBe(true);
        expect(isTrustedOrigin('https://citation-svc.flux.io')).toBe(true);
        expect(isTrustedOrigin('https://fallback-svc.flux.io')).toBe(true);
        expect(isTrustedOrigin('https://untrusted-external.example.com')).toBe(false);
      } finally {
        if (prevCatalog === undefined) delete process.env.NEXT_PUBLIC_LIBRARY_CATALOG_URL;
        else process.env.NEXT_PUBLIC_LIBRARY_CATALOG_URL = prevCatalog;
        if (prevCitation === undefined) delete process.env.NEXT_PUBLIC_LIBRARY_CITATION_URL;
        else process.env.NEXT_PUBLIC_LIBRARY_CITATION_URL = prevCitation;
        if (prevServices === undefined) delete process.env.NEXT_PUBLIC_LIBRARY_SERVICES_URL;
        else process.env.NEXT_PUBLIC_LIBRARY_SERVICES_URL = prevServices;
      }
    });
  });

  describe('bibliographic-schema.domain (Candidate 1 Deep Module)', () => {
    it('returns an immutable versioned BibliographicSchemaSnapshot and hydrates atomically', async () => {
      const {
        getBibliographicSchema,
        hydrateBibliographicSchema,
        resolveBibliographicField,
        buildBibliographicFieldPatch,
      } = await import('@/features/library/domain/bibliographic-schema.domain');

      const initialSnap = getBibliographicSchema();
      expect(initialSnap.version).toBeGreaterThanOrEqual(1);
      expect(initialSnap.itemTypes.journalArticle).toBeDefined();
      expect(initialSnap.dedicatedFieldsByType.get('conferencePaper')?.has('proceedingstitle')).toBe(true);

      const nextSnap = hydrateBibliographicSchema(
        {
          baseFieldMappings: {
            conferencePaper: { publicationTitle: 'proceedingsTitle' },
          },
        },
        { persist: false },
      );
      expect(nextSnap.version).toBeGreaterThan(initialSnap.version);

      const item = {
        id: 'item-1',
        itemType: 'conferencePaper',
        title: 'Deep Modules in Practice',
        publicationTitle: 'Proc. ICSE 2026',
        extraFields: {},
      };
      expect(resolveBibliographicField(item, 'proceedingsTitle')).toBe('Proc. ICSE 2026');

      const patch = buildBibliographicFieldPatch(item, 'proceedingsTitle', 'IEEE ICSE 2026');
      expect(patch.proceedingsTitle).toBe('IEEE ICSE 2026');
      expect(patch.publicationTitle).toBe('IEEE ICSE 2026');
    });
  });

  describe('library-local-storage.adapter (Candidate 2 Local-Substitutable Adapter)', () => {
    it('persists and hydrates Reader tabs, bookmarks, and Feed read IDs using an injected in-memory StorageLike adapter', async () => {
      const {
        setLibraryStorageProvider,
        saveReaderTabsToStorage,
        loadReaderStorageState,
        saveFeedReadEntryIdsToStorage,
        loadFeedReadEntryIdsFromStorage,
      } = await import('@/features/library/core/adapters/library-local-storage.adapter');

      const memoryMap = new Map<string, string>();
      const memoryStorage = {
        getItem: (key: string) => memoryMap.get(key) ?? null,
        setItem: (key: string, value: string) => {
          memoryMap.set(key, value);
        },
        removeItem: (key: string) => {
          memoryMap.delete(key);
        },
      };

      setLibraryStorageProvider(memoryStorage);
      try {
        saveReaderTabsToStorage(
          [
            { id: 'library', label: 'My Library', type: 'library' },
            { id: 'paper-1', label: 'Paper 1', type: 'paper', zoom: 1.25 },
          ],
          'paper-1',
        );
        const loadedTabs = loadReaderStorageState();
        expect(loadedTabs.activeTabId).toBe('paper-1');
        expect(loadedTabs.tabs).toHaveLength(2);
        expect(loadedTabs.tabs[1]?.id).toBe('paper-1');

        saveFeedReadEntryIdsToStorage(['entry-a', 'entry-b']);
        const readSet = loadFeedReadEntryIdsFromStorage();
        expect(readSet.has('entry-a')).toBe(true);
        expect(readSet.has('entry-b')).toBe(true);
      } finally {
        setLibraryStorageProvider(null);
      }
    });
  });

  describe('library-command.manager Undo/Redo Arbitration (Candidate 3)', () => {
    it('arbitrates Undo and Redo between contextual Reader annotation history and global LibraryCommandStore by timestamp', async () => {
      const {
        useLibraryCommandStore,
        dispatchContextualOrCommandUndo,
        dispatchContextualOrCommandRedo,
      } = await import('@/features/library/core/manager/library-command.manager');

      useLibraryCommandStore.getState().clearHistory();
      const events: string[] = [];

      useLibraryCommandStore.getState().pushExecutedCommand(
        {
          id: 'cmd-1',
          description: 'Test command',
          timestamp: 1000,
          execute: async () => {
            events.push('cmd-exec');
          },
          undo: async () => {
            events.push('cmd-undo');
          },
          redo: async () => {
            events.push('cmd-redo');
          },
        },
        { silentToast: true },
      );

      // Contextual source has a newer undo timestamp (2000 > 1000)
      const contextualHandled = dispatchContextualOrCommandUndo({
        latestUndoTimestamp: 2000,
        latestRedoTimestamp: 0,
        undo: () => {
          events.push('ctx-undo');
        },
        redo: () => {
          events.push('ctx-redo');
        },
      });
      expect(contextualHandled).toBe(true);
      expect(events).toEqual(['ctx-undo']);

      // Contextual source has an older undo timestamp (500 < 1000) -> global command store wins
      const globalHandled = dispatchContextualOrCommandUndo({
        latestUndoTimestamp: 500,
        latestRedoTimestamp: 0,
        undo: () => {
          events.push('ctx-undo-2');
        },
        redo: () => {
          events.push('ctx-redo-2');
        },
      });
      expect(globalHandled).toBe(true);

      // Contextual redo when global redo is older/empty
      useLibraryCommandStore.getState().clearHistory();
      const redoHandled = dispatchContextualOrCommandRedo({
        latestUndoTimestamp: 0,
        latestRedoTimestamp: 3000,
        undo: () => {},
        redo: () => {
          events.push('ctx-redo');
        },
      });
      expect(redoHandled).toBe(true);
      expect(events).toContain('ctx-redo');
    });
  });
});
