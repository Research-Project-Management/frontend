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

import type { CreatorCredit } from '@/features/library/domain/types/core.types';
import type {
  SavedFeedSubscription,
  FeedRetentionDays,
} from '@/features/library/domain/types/ingestion.types';
import { safeHttpUrl } from '@/features/library/domain/system-views.policy';
import { parseCreatorName } from '@/features/library/domain/creators';
import {
  decodeXmlEntities,
  cleanText,
} from '@/features/library/domain/citations';
import {
  cleanDoi,
  normalizeArxivId,
} from '@/features/library/domain/identifiers';

export { decodeXmlEntities };

interface ServerFeedSubscriptionItem {
  id: string;
  feedId?: string;
  customTitle?: string | null;
  cleanupReadAfter?: number | null;
  cleanupUnreadAfter?: number | null;
  feed?: {
    title?: string | null;
    url?: string | null;
    lastFetchedAt?: string | null;
  } | null;
}

type FeedFormat = 'atom' | 'rss2' | 'rdf';

export function mapServerFeedSubscriptions(
  subs: ServerFeedSubscriptionItem[] | undefined | null,
): SavedFeedSubscription[] {
  if (!Array.isArray(subs) || subs.length === 0) return [];
  return subs.map((sub) => {
    const unreadDays = (sub.cleanupUnreadAfter ?? sub.cleanupReadAfter ?? 30) as FeedRetentionDays;
    const readDays = (sub.cleanupReadAfter ?? 7) as FeedRetentionDays;
    return {
      id: sub.feedId || sub.id,
      name: sub.customTitle || sub.feed?.title || 'Academic Feed',
      url: sub.feed?.url || '',
      lastRefreshed: sub.feed?.lastFetchedAt || undefined,
      retentionDays: unreadDays,
      cleanupReadAfter: readDays,
      cleanupUnreadAfter: unreadDays,
    };
  });
}

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
  isRead?: boolean;
  isSaved?: boolean;
  savedItemId?: string | null;
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
  categories?: string[];
  comment?: string;
  rights?: string;
  isRead?: boolean;
  isSaved?: boolean;
  savedItemId?: string | null;
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
    : (entry.authors || []).map((author, idx) => {
        const parsed = parseCreatorName(author);
        return {
          creatorType: 'author',
          firstName: parsed.firstName || undefined,
          lastName: parsed.lastName || undefined,
          fullName: parsed.fullName || author,
          orderIndex: idx,
          fieldMode: parsed.isInstitution ? 1 : 0,
        };
      });

  const normalizedDoi = entry.doi ? cleanDoi(entry.doi) || entry.doi : undefined;
  const normalizedArxiv = entry.arxivId
    ? normalizeArxivId(entry.arxivId) || entry.arxivId
    : undefined;

  return {
    title: cleanText(decodeXmlEntities(entry.title)) || entry.title,
    itemType: isPreprint ? 'preprint' : 'journalArticle',
    authors: entry.authors,
    creators,
    doi: normalizedDoi,
    arxivId: normalizedArxiv,
    url: safeHttpUrl(entry.url) || safeHttpUrl(entry.pdfUrl),
    publicationTitle: entry.publicationTitle
      ? cleanText(decodeXmlEntities(entry.publicationTitle))
      : undefined,
    volume: entry.volume,
    issue: entry.issue,
    pages: entry.pages,
    year: entry.year,
    publicationDate: entry.publishedAt,
    abstract: entry.abstract ? decodeXmlEntities(entry.abstract) : undefined,
    tags: entry.categories,
    collectionId,
    collectionIds: collectionId ? [collectionId] : [],
    scopeId,
  };
}

/**
 * Normalizes a publication date string (ISO 8601, RFC 2822, or YYYY-MM-DD) into
 * `{ publishedAt, year }`.
 */
export function normalizeFeedDate(rawDate?: string | null): {
  publishedAt?: string;
  year?: number;
} {
  if (!rawDate || typeof rawDate !== 'string') return {};
  const trimmed = rawDate.trim();
  if (!trimmed) return {};
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return {
      publishedAt: `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`,
      year: Number.parseInt(isoMatch[1]!, 10),
    };
  }
  const yearOnlyMatch = trimmed.match(/^(\d{4})$/);
  if (yearOnlyMatch) {
    return {
      publishedAt: yearOnlyMatch[1],
      year: Number.parseInt(yearOnlyMatch[1]!, 10),
    };
  }
  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    const y = parsed.getUTCFullYear();
    const m = String(parsed.getUTCMonth() + 1).padStart(2, '0');
    const d = String(parsed.getUTCDate()).padStart(2, '0');
    return {
      publishedAt: `${y}-${m}-${d}`,
      year: y,
    };
  }
  const fallbackYear = trimmed.match(/\b(19\d{2}|20\d{2})\b/);
  return {
    publishedAt: trimmed,
    year: fallbackYear ? Number.parseInt(fallbackYear[1]!, 10) : undefined,
  };
}

export function normalizeFetchedFeedEntries(entries: FeedEntryApiItem[]): ParsedFeedEntry[] {
  return entries.map((e: FeedEntryApiItem, idx: number) => {
    const rawDate = e.publicationDate || e.published || e.updated;
    const { publishedAt, year: parsedYear } = normalizeFeedDate(rawDate);
    const cleanedDoi = e.doi ? cleanDoi(e.doi) || e.doi : undefined;
    const cleanedArxiv = e.arxivId ? normalizeArxivId(e.arxivId) || e.arxivId : undefined;
    return {
      id: e.id || e.url || e.link || `feed-item-${idx}`,
      title: cleanText(decodeXmlEntities(e.title)) || e.title,
      authors: (e.authors || []).map((a) => decodeXmlEntities(a)),
      creators: (e.creators || []).map((c: FeedCreatorApiItem) => ({
        firstName: decodeXmlEntities(c.firstName || ''),
        lastName: decodeXmlEntities(c.lastName || ''),
        creatorType: 'author' as const,
      })),
      doi: cleanedDoi,
      arxivId: cleanedArxiv,
      primaryCategory: e.primaryCategory || e.keywords?.[0],
      url: safeHttpUrl(e.url || e.link),
      pdfUrl: safeHttpUrl(e.pdfUrl),
      publishedAt: publishedAt || rawDate,
      updatedAt: e.updated,
      year: e.year ?? parsedYear ?? undefined,
      publicationTitle: e.publicationTitle
        ? cleanText(decodeXmlEntities(e.publicationTitle))
        : undefined,
      volume: e.volume,
      issue: e.issue,
      pages: e.pages,
      abstract: e.abstract || e.summary ? decodeXmlEntities(e.abstract || e.summary) : undefined,
      categories: (e.keywords || []).map((k) => decodeXmlEntities(k)),
      comment: e.comment ? decodeXmlEntities(e.comment) : undefined,
      rights: e.rights ? decodeXmlEntities(e.rights) : undefined,
      ...(e.isRead !== undefined ? { isRead: Boolean(e.isRead) } : {}),
      ...(e.isSaved !== undefined ? { isSaved: e.isSaved } : {}),
      ...(e.savedItemId !== undefined ? { savedItemId: e.savedItemId } : {}),
      feedFormat: 'rss2',
    };
  });
}

export function filterFeedEntriesByRetention(
  entries: ParsedFeedEntry[],
  retentionDays?: number | null,
  options?: {
    cleanupReadAfter?: number | null;
    cleanupUnreadAfter?: number | null;
    readEntryIds?: ReadonlySet<string>;
  },
): ParsedFeedEntry[] {
  const defaultUnreadDays = retentionDays ?? 30;
  const unreadDays = options?.cleanupUnreadAfter ?? defaultUnreadDays;
  const readDays =
    options?.cleanupReadAfter !== undefined && options?.cleanupReadAfter !== null
      ? options.cleanupReadAfter
      : unreadDays;
  const readSet = options?.readEntryIds;
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  return entries.filter((e) => {
    const isRead = Boolean(readSet?.has(e.id));
    const activeDays = isRead ? readDays : unreadDays;
    if (!activeDays || activeDays <= 0) return true;
    if (!e.publishedAt) return true;
    const t = Date.parse(e.publishedAt);
    if (isNaN(t)) return true;
    return t >= now - activeDays * dayMs;
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



