/**
 * citation-specs.ts
 *
 * Pure Specification predicates and source-merging helpers for the Citation Picker.
 */

import type { BibEntry } from '@/features/editor/domain/latex/bib-parser';
import type { BibEntryDto } from '@/features/editor/sdk/pages/types';
import { cleanBibtexTitle, parseBibtexAuthors } from './formatter';

export type CitationStyle =
  | 'latex-cite'
  | 'latex-citep'
  | 'latex-citet'
  | 'latex-autocite'
  | 'markdown-bracket'
  | 'markdown-inline';

export type CitationPredicate = (entry: BibEntry) => boolean;

export const CitationSpecs = {
  all: (): CitationPredicate => () => true,
  isLibrarySource: (): CitationPredicate => (item) =>
    item.source === 'library' || item.sourceFile === 'workspace-library',
  isBibSource: (): CitationPredicate => (item) =>
    item.source === 'bib' ||
    Boolean(item.sourceFile && item.sourceFile !== 'workspace-library'),
  isCitedInDoc: (citedKeysSet: ReadonlySet<string>): CitationPredicate => (item) =>
    Boolean(item.key && citedKeysSet.has(item.key.toLowerCase())),
  matchesQuery: (rawQuery: string): CitationPredicate => {
    const query = rawQuery.trim().toLowerCase();
    if (!query) return () => true;
    return (entry) => {
      const keyMatch = entry.key?.toLowerCase().includes(query);
      const titleMatch = entry.title?.toLowerCase().includes(query);
      const authorMatch = entry.authors?.some((a) => a.toLowerCase().includes(query));
      const yearMatch = entry.year?.toString().includes(query);
      const doiMatch = entry.doi?.toLowerCase().includes(query);
      const venueMatch =
        entry.journal?.toLowerCase().includes(query) ||
        entry.booktitle?.toLowerCase().includes(query) ||
        entry.publisher?.toLowerCase().includes(query);
      return Boolean(keyMatch || titleMatch || authorMatch || yearMatch || doiMatch || venueMatch);
    };
  },
} as const;

export interface IndexedCitationInput {
  key: string;
  type?: string;
  title?: string;
  author?: string;
  year?: string;
  journal?: string;
  booktitle?: string;
  doi?: string;
  sourceFile: string;
}

export interface LibraryCitationInput {
  id?: string;
  citationKey?: string | null;
  itemType?: string | null;
  title?: string | null;
  authors?: string | string[] | null;
  year?: string | number | null;
  publicationTitle?: string | null;
  doi?: string | null;
  url?: string | null;
  abstractNote?: string | null;
  collectionIds?: string[] | null;
}

export function mergeCitationSources(
  indexedCitations: readonly IndexedCitationInput[],
  libraryItems: readonly LibraryCitationInput[],
): BibEntry[] {
  const mapped: BibEntry[] = indexedCitations.map((c) => ({
    key: c.key,
    type: c.type || 'article',
    title: cleanBibtexTitle(c.title),
    authors: parseBibtexAuthors(c.author),
    author: c.author,
    year: c.year,
    journal: c.journal,
    booktitle: c.booktitle,
    doi: c.doi,
    sourceFile: c.sourceFile,
    source: c.sourceFile === 'workspace-library' ? 'library' : 'bib',
  }));

  const indexByKey = new Map<string, number>();
  mapped.forEach((m, idx) => {
    if (m.key) indexByKey.set(m.key.toLowerCase(), idx);
  });

  for (const lib of libraryItems) {
    const k = lib.citationKey || lib.id;
    if (!k) continue;
    const lowerKey = k.toLowerCase();
    const resolvedCollectionIds = lib.collectionIds ?? [];

    const existingIdx = indexByKey.get(lowerKey);
    if (existingIdx !== undefined) {
      const existing = mapped[existingIdx];
      mapped[existingIdx] = {
        ...existing,
        title: cleanBibtexTitle(existing.title || lib.title || undefined),
        authors: parseBibtexAuthors(
          existing.authors && existing.authors.length > 0 ? existing.authors : lib.authors,
        ),
        year: existing.year || (lib.year ? String(lib.year) : undefined),
        journal: existing.journal || lib.publicationTitle || undefined,
        doi: existing.doi || lib.doi || undefined,
        url: existing.url || lib.url || undefined,
        abstract: existing.abstract || lib.abstractNote || undefined,
        collectionId: resolvedCollectionIds[0],
        collectionIds: resolvedCollectionIds.length > 0 ? resolvedCollectionIds : undefined,
      };
    } else {
      indexByKey.set(lowerKey, mapped.length);
      mapped.push({
        key: k,
        type: lib.itemType || 'article',
        title: cleanBibtexTitle(lib.title || undefined),
        authors: parseBibtexAuthors(lib.authors),
        year: lib.year ? String(lib.year) : undefined,
        journal: lib.publicationTitle || undefined,
        doi: lib.doi || undefined,
        url: lib.url || undefined,
        abstract: lib.abstractNote || undefined,
        source: 'library',
        sourceFile: 'workspace-library',
        collectionId: resolvedCollectionIds[0],
        collectionIds: resolvedCollectionIds.length > 0 ? resolvedCollectionIds : undefined,
      });
    }
  }

  return mapped;
}

export function mapServerBibDtos(items: readonly BibEntryDto[]): BibEntry[] {
  return items.map((r) => ({
    key: r.key,
    type: r.type || 'article',
    title: cleanBibtexTitle(r.title),
    authors: Array.isArray(r.authors) ? r.authors : parseBibtexAuthors(r.author),
    author: Array.isArray(r.authors) ? r.authors.join(' and ') : r.author,
    year: r.year,
    journal: r.journal,
    doi: r.doi,
    source: 'server',
    sourceFile: r.sourceFile || 'references.bib',
  }));
}

export function mergeUniqueBibEntries(
  primary: readonly BibEntry[],
  secondary: readonly BibEntry[],
): BibEntry[] {
  const map = new Map<string, BibEntry>();
  for (const item of primary) {
    if (item.key) map.set(item.key.toLowerCase(), item);
  }
  for (const item of secondary) {
    if (item.key && !map.has(item.key.toLowerCase())) {
      map.set(item.key.toLowerCase(), item);
    }
  }
  return Array.from(map.values());
}
