import { describe, it, expect } from 'vitest';
import {
  normalizeSearchStr,
  calculateFilterMatchScore,
  KNOWN_TYPE_ALIASES,
} from '@/features/library/domain/filter-matcher.domain';
import {
  getFieldConfig,
  parseDurationParts,
  formatConditionValue,
} from '@/features/library/domain/saved-search-schema.domain';
import {
  calculateEffectiveViewportDimensions,
  computeSpreadPairs,
  isPageInVirtualWindow,
  calculatePageAspectRatio,
  normalizeRectCoordinates,
} from '@/features/library/domain/pdf-viewport.model';

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
        '@/features/library/sdk/library.client'
      );

      expect(resolveLibraryUrl('catalog', '/items')).toBe('/api/v1/library/items');
      expect(resolveLibraryUrl('catalog', '/items', 'user')).toBe('/api/v1/library/items');
      expect(resolveLibraryUrl('catalog', '/items', 'proj-42', 'counts')).toBe(
        '/api/v1/projects/proj-42/library/items/counts',
      );
      expect(resolveLibraryRawPath('/api/v1/library/citation/resolve', 'citation')).toBe(
        '/api/v1/library/citation/resolve',
      );
    });

    it('dynamically routes to standalone Library Microservice host when NEXT_PUBLIC_LIBRARY_SERVICES_URL is configured', async () => {
      const prevEnv = process.env.NEXT_PUBLIC_LIBRARY_SERVICES_URL;
      process.env.NEXT_PUBLIC_LIBRARY_SERVICES_URL = 'https://library-service.flux.io/api/v1/library';

      try {
        const { resolveLibraryUrl, resolveLibraryRawPath, getLibraryServiceHost } = await import(
          '@/features/library/sdk/library.client'
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
  });
});
