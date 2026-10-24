/**
 * Domain & Integration Module: Academic Feed Models & Ingestion Mapping
 *
 * NOTE: Feeds are fetched, scheduled, and parsed authoritatively by the backend
 * `FeedsService` and `UrlCaptureService`.
 *
 * This module provides:
 * - Domain interfaces for parsed feed entries and API payloads
 * - One-click "Save to Library" payload mapper (`mapFeedEntryToCreateItemPayload`)
 * - Pure OPML 1.0/2.0 XML parser for client-side OPML file uploads
 */

import type { CreatorCredit } from '@/features/library/domain/types/library.types';

export type FeedFormat = 'rss2' | 'rdf' | 'atom' | 'unknown';

export interface FeedCreatorApiItem {
  firstName?: string;
  lastName?: string;
  creatorType?: string;
}

export interface FeedEntryApiItem {
  id?: string;
  title: string;
  authors: string[];
  creators?: FeedCreatorApiItem[];
  doi?: string;
  arxivId?: string;
  primaryCategory?: string;
  url?: string;
  link?: string;
  pdfUrl?: string;
  publicationDate?: string;
  published?: string;
  updated?: string;
  year?: number | null;
  publicationTitle?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  abstract?: string;
  summary?: string;
  keywords?: string[];
  comment?: string;
  rights?: string;
}

export interface FeedFetchApiResponse {
  feedTitle?: string;
  entries?: FeedEntryApiItem[];
  data?: FeedFetchApiResponse;
}

export interface ParsedFeedEntry {
  id: string;
  title: string;
  authors: string[];
  creators?: FeedCreatorApiItem[];
  doi?: string;
  arxivId?: string;
  primaryCategory?: string;
  url?: string;
  pdfUrl?: string;
  publishedAt?: string;
  updatedAt?: string;
  year?: number;
  publicationTitle?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  abstract?: string;
  categories: string[];
  comment?: string;
  rights?: string;
  feedFormat: FeedFormat;
}

export interface CreateLibraryItemFromFeedPayload {
  title: string;
  itemType: string;
  authors: string[];
  creators: CreatorCredit[];
  doi?: string;
  arxivId?: string;
  url?: string;
  publicationTitle?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  year?: number;
  publicationDate?: string;
  abstract?: string;
  tags?: string[];
  collectionId?: string;
  collectionIds: string[];
  scopeId: string;
}

/**
 * Maps a `ParsedFeedEntry` into a normalized `CreateLibraryItemFromFeedPayload`
 * for one-click "Save to Library / Collection" in Personal or Project Libraries.
 */
export function mapFeedEntryToCreateItemPayload(
  entry: ParsedFeedEntry,
  options?: { scopeId?: string; collectionId?: string },
): CreateLibraryItemFromFeedPayload {
  const scopeId = options?.scopeId || 'user';
  const collectionId = options?.collectionId || undefined;
  const isPreprint = Boolean(
    entry.arxivId && (!entry.doi || entry.doi.toLowerCase().includes('arxiv')),
  );

  const creators: CreatorCredit[] = (entry.creators && entry.creators.length > 0)
    ? entry.creators.map((c, idx) => ({
        creatorType: c.creatorType || 'author',
        firstName: c.firstName,
        lastName: c.lastName,
        fullName: [c.firstName, c.lastName].filter(Boolean).join(' ') || (c.lastName || 'Unknown Author'),
        orderIndex: idx,
        fieldMode: 0,
      }))
    : (entry.authors || []).map((author, idx) => ({
        creatorType: 'author',
        fullName: author,
        orderIndex: idx,
        fieldMode: 0,
      }));

  return {
    title: entry.title,
    itemType: isPreprint ? 'preprint' : 'journalArticle',
    authors: entry.authors,
    creators,
    doi: entry.doi,
    arxivId: entry.arxivId,
    url: entry.url || entry.pdfUrl,
    publicationTitle: entry.publicationTitle,
    volume: entry.volume,
    issue: entry.issue,
    pages: entry.pages,
    year: entry.year,
    publicationDate: entry.publishedAt,
    abstract: entry.abstract,
    tags: entry.categories,
    collectionId,
    collectionIds: collectionId ? [collectionId] : [],
    scopeId,
  };
}

export interface OpmlFeedItem {
  name: string;
  url: string;
}

/**
 * Pure domain parser for OPML 1.0 / 2.0 XML feeds.
 * Deduplicates feeds and robustly handles both xmlUrl/url and title/text attributes.
 */
export function parseOpmlFeeds(opmlContent: string): OpmlFeedItem[] {
  if (!opmlContent || typeof opmlContent !== 'string') return [];

  const feeds: OpmlFeedItem[] = [];
  const seenUrls = new Set<string>();

  const outlineRegex = /<outline\b([^>]*?)\/?>/gi;
  let match: RegExpExecArray | null;

  while ((match = outlineRegex.exec(opmlContent)) !== null) {
    const attrs = match[1] || '';
    const xmlUrlMatch = attrs.match(/\b(?:xmlUrl|url)=["']([^"']+)["']/i);
    if (xmlUrlMatch?.[1]) {
      const feedUrl = xmlUrlMatch[1].trim();
      if (!feedUrl || seenUrls.has(feedUrl)) continue;

      const titleMatch = attrs.match(/\b(?:title|text)=["']([^"']+)["']/i);
      const feedName = titleMatch?.[1]?.trim() || '';

      feeds.push({
        name: feedName,
        url: feedUrl,
      });
      seenUrls.add(feedUrl);
    }
  }

  return feeds;
}

export function normalizeFetchedFeedEntries(entries: FeedEntryApiItem[]): ParsedFeedEntry[] {
  return entries.map((e: FeedEntryApiItem, idx: number) => ({
    id: e.id || e.url || e.link || `feed-item-${idx}`,
    title: e.title,
    authors: e.authors || [],
    creators: (e.creators || []).map((c: FeedCreatorApiItem) => ({
      firstName: c.firstName || '',
      lastName: c.lastName || '',
      creatorType: 'author' as const,
    })),
    doi: e.doi,
    arxivId: e.arxivId,
    primaryCategory: e.primaryCategory || e.keywords?.[0],
    url: e.url || e.link,
    pdfUrl: e.pdfUrl,
    publishedAt: e.publicationDate || e.published || e.updated,
    updatedAt: e.updated,
    year: e.year ?? undefined,
    publicationTitle: e.publicationTitle,
    volume: e.volume,
    issue: e.issue,
    pages: e.pages,
    abstract: e.abstract || e.summary,
    categories: e.keywords || [],
    comment: e.comment,
    rights: e.rights,
    feedFormat: 'rss2',
  }));
}

export function filterFeedEntriesByRetention(
  entries: ParsedFeedEntry[],
  retentionDays?: number | null,
): ParsedFeedEntry[] {
  const days = retentionDays ?? 30;
  if (!days || days <= 0) return entries;
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return entries.filter((e) => {
    if (!e.publishedAt) return true;
    const t = Date.parse(e.publishedAt);
    if (isNaN(t)) return true;
    return t >= cutoff;
  });
}

export function filterFeedEntriesByReadAndQuery(
  entries: ParsedFeedEntry[],
  readFilter: 'all' | 'unread' | 'read',
  readEntryIds: ReadonlySet<string>,
  searchQuery: string,
): ParsedFeedEntry[] {
  let list = entries;
  if (readFilter === 'unread') {
    list = list.filter((e) => !readEntryIds.has(e.id));
  } else if (readFilter === 'read') {
    list = list.filter((e) => readEntryIds.has(e.id));
  }
  if (!searchQuery) return list;
  const q = searchQuery.toLowerCase();
  return list.filter(
    (e) =>
      e.title.toLowerCase().includes(q) ||
      e.authors.some((a) => a.toLowerCase().includes(q)) ||
      (e.abstract && e.abstract.toLowerCase().includes(q)) ||
      (e.doi && e.doi.toLowerCase().includes(q)) ||
      (e.arxivId && e.arxivId.toLowerCase().includes(q)),
  );
}
