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
import type {
  SavedFeedSubscription,
  FeedRetentionDays,
} from '@/features/library/domain/types/feeds.types';
import { safeHttpUrl } from '@/features/library/domain/retraction';
import { parseCreatorName } from '@/features/library/domain/creators';
import {
  decodeXmlEntities,
  cleanAcademicText,
} from '@/features/library/domain/academic-text';
import {
  cleanDoi,
  normalizeArxivId,
  getArxivPdfUrl,
} from '@/features/library/domain/identifiers';

export { decodeXmlEntities };

export interface ServerFeedSubscriptionItem {
  id: string;
  feedId?: string;
  customTitle?: string | null;
  cleanupDays?: number | null;
  cleanupReadAfter?: number | null;
  cleanupUnreadAfter?: number | null;
  feed?: {
    id?: string;
    url?: string;
    title?: string | null;
    lastFetchedAt?: string | null;
  };
}

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
  categories: string[];
  comment?: string;
  rights?: string;
  isRead?: boolean;
  isSaved?: boolean;
  savedItemId?: string | null;
  feedFormat: FeedFormat;
}

export type AcademicFeedEntry = ParsedFeedEntry;

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
    title: cleanAcademicText(decodeXmlEntities(entry.title)) || entry.title,
    itemType: isPreprint ? 'preprint' : 'journalArticle',
    authors: entry.authors,
    creators,
    doi: normalizedDoi,
    arxivId: normalizedArxiv,
    url: safeHttpUrl(entry.url) || safeHttpUrl(entry.pdfUrl),
    publicationTitle: entry.publicationTitle
      ? cleanAcademicText(decodeXmlEntities(entry.publicationTitle))
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

export interface OpmlFeedItem {
  name: string;
  url: string;
}

function stripCdataAndHtml(raw?: string | null): string {
  if (!raw || typeof raw !== 'string') return '';
  let text = raw.trim();
  text = text.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1');
  text = decodeXmlEntities(text);
  text = text
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/<\/?(?:p|div|br|li|ul|ol|blockquote|h[1-6])\b[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, '');
  text = decodeXmlEntities(text);
  return text.replace(/\s+/g, ' ').trim();
}

function extractXmlTagValue(xml: string, tagPatterns: readonly string[]): string | undefined {
  for (const pattern of tagPatterns) {
    const regex = new RegExp(
      `<${pattern}(?:\\s[^>]*?)?(?<!\\/)>([\\s\\S]*?)<\\/${pattern}>`,
      'i',
    );
    const match = xml.match(regex);
    if (match?.[1]) {
      const cleaned = stripCdataAndHtml(match[1]);
      if (cleaned) return cleaned;
    }
  }
  return undefined;
}

function extractAllXmlTagValues(xml: string, tagPatterns: readonly string[]): string[] {
  const results: string[] = [];
  for (const pattern of tagPatterns) {
    const regex = new RegExp(
      `<${pattern}(?:\\s[^>]*?)?(?<!\\/)>([\\s\\S]*?)<\\/${pattern}>`,
      'gi',
    );
    for (const match of xml.matchAll(regex)) {
      if (match[1]) {
        const cleaned = stripCdataAndHtml(match[1]);
        if (cleaned) results.push(cleaned);
      }
    }
  }
  return results;
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

/**
 * Pure domain parser for Atom 1.0, RSS 2.0, and RDF/PRISM 1.0 XML feeds.
 * Delegates entity decoding to `decodeXmlEntities` and identifier normalization to
 * canonical `cleanDoi` and `normalizeArxivId` helpers from `./identifiers`.
 */
export function parseFeedXml(xml: string, _feedUrl?: string): ParsedFeedEntry[] {
  if (!xml || typeof xml !== 'string') return [];

  const isAtom = /<feed[\s>]/i.test(xml) && /<entry[\s>]/i.test(xml);
  const isRdf = /<rdf:RDF[\s>]/i.test(xml) || /xmlns:prism=/i.test(xml);
  const format: FeedFormat = isAtom ? 'atom' : isRdf ? 'rdf' : 'rss2';
  const tag = isAtom ? 'entry' : 'item';
  const entryRegex = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'gi');
  const entries: ParsedFeedEntry[] = [];

  let idx = 0;
  for (const match of xml.matchAll(entryRegex)) {
    const entryXml = match[0] || '';
    const rawTitle = extractXmlTagValue(entryXml, ['title', 'dc:title']);
    if (!rawTitle || rawTitle.toLowerCase() === 'error') continue;
    const title =
      cleanAcademicText(rawTitle.replace(/\s*\(arXiv:[^)]+\)\s*$/i, '').trim()) || rawTitle;

    let url = extractXmlTagValue(entryXml, ['link', 'prism:url']);
    let pdfUrl: string | undefined;

    for (const linkMatch of entryXml.matchAll(/<link\b([^>]*)\/?>/gi)) {
      const attrs = linkMatch[1] || '';
      const hrefMatch = attrs.match(/\bhref=["']([^"']+)["']/i);
      if (!hrefMatch?.[1]) continue;
      const href = decodeXmlEntities(hrefMatch[1].trim());
      const relMatch = attrs.match(/\brel=["']([^"']+)["']/i);
      const typeMatch = attrs.match(/\btype=["']([^"']+)["']/i);
      const titleAttrMatch = attrs.match(/\btitle=["']([^"']+)["']/i);

      if (
        typeMatch?.[1]?.toLowerCase() === 'application/pdf' ||
        titleAttrMatch?.[1]?.toLowerCase() === 'pdf'
      ) {
        pdfUrl = href;
      } else if (!url || relMatch?.[1]?.toLowerCase() === 'alternate') {
        url = href;
      }
    }

    const rawId =
      extractXmlTagValue(entryXml, ['id', 'guid']) ||
      entryXml.match(/<item[^>]*\brdf:about=["']([^"']+)["']/i)?.[1] ||
      url ||
      `feed-entry-${idx}`;

    const atomAuthors = Array.from(
      entryXml.matchAll(/<author>\s*<name>([\s\S]*?)<\/name>[\s\S]*?<\/author>/gi),
      (m) => stripCdataAndHtml(m[1]),
    ).filter(Boolean);
    const dcCreators = extractAllXmlTagValues(entryXml, ['dc:creator', 'creator']);
    const plainAuthors =
      atomAuthors.length === 0 && dcCreators.length === 0
        ? extractAllXmlTagValues(entryXml, ['author'])
        : [];
    const rawAuthorList = [...atomAuthors, ...dcCreators, ...plainAuthors];
    const authors: string[] = [];
    const creators: FeedCreatorApiItem[] = [];
    const seenAuthors = new Set<string>();
    for (const rawAuthor of rawAuthorList) {
      const parsed = parseCreatorName(rawAuthor);
      const display = parsed.fullName || rawAuthor;
      const key = display.toLowerCase();
      if (!display || seenAuthors.has(key)) continue;
      seenAuthors.add(key);
      authors.push(display);
      creators.push({
        firstName: parsed.firstName || '',
        lastName: parsed.lastName || display,
        creatorType: 'author',
      });
    }

    const rawAbstract = extractXmlTagValue(entryXml, [
      'summary',
      'content:encoded',
      'description',
      'content',
      'dc:description',
    ]);
    const abstract = rawAbstract
      ? rawAbstract
          .replace(/^arXiv:\S+\s+Announce Type:\s*\S+\s*(?:Abstract:\s*)?/i, '')
          .replace(/^Abstract:\s*/i, '')
          .trim()
      : undefined;

    const rawDoi = extractXmlTagValue(entryXml, ['prism:doi', 'arxiv:doi', 'dc:doi']);
    const dcIdentifiers = extractAllXmlTagValues(entryXml, ['dc:identifier']);
    let doi = cleanDoi(rawDoi) || undefined;
    let arxivId = normalizeArxivId(rawId) || normalizeArxivId(url) || undefined;

    for (const idVal of dcIdentifiers) {
      if (!doi) {
        const candidateDoi = cleanDoi(idVal);
        if (candidateDoi) doi = candidateDoi;
      }
      if (!arxivId) {
        const candidateArxiv = normalizeArxivId(idVal);
        if (candidateArxiv) arxivId = candidateArxiv;
      }
    }
    if (!doi && url) {
      const doiFromUrl = cleanDoi(url);
      if (doiFromUrl) doi = doiFromUrl;
    }
    if (!doi && abstract) {
      const doiInAbstract = cleanDoi(abstract);
      if (doiInAbstract) doi = doiInAbstract;
    }
    if (!arxivId && abstract) {
      const arxivInAbstract = normalizeArxivId(abstract);
      if (arxivInAbstract) arxivId = arxivInAbstract;
    }
    if (!pdfUrl && arxivId) {
      pdfUrl = getArxivPdfUrl(arxivId) || undefined;
    }

    const publicationTitle = extractXmlTagValue(entryXml, [
      'prism:publicationName',
      'arxiv:journal_ref',
      'dc:source',
    ]);
    const volume = extractXmlTagValue(entryXml, ['prism:volume']);
    const issue = extractXmlTagValue(entryXml, ['prism:number', 'prism:issue']);
    const startingPage = extractXmlTagValue(entryXml, ['prism:startingPage']);
    const endingPage = extractXmlTagValue(entryXml, ['prism:endingPage']);
    const pages =
      startingPage && endingPage
        ? `${startingPage}-${endingPage}`
        : startingPage || extractXmlTagValue(entryXml, ['prism:pageRange']);

    const rawDate = extractXmlTagValue(entryXml, [
      'published',
      'prism:coverDate',
      'prism:publicationDate',
      'dc:date',
      'pubDate',
      'updated',
    ]);
    const rawUpdated = extractXmlTagValue(entryXml, ['updated']);
    const { publishedAt, year } = normalizeFeedDate(rawDate);
    const { publishedAt: updatedAt } = normalizeFeedDate(rawUpdated);

    const atomCategories = Array.from(
      entryXml.matchAll(/<category[^>]*\bterm=["']([^"']+)["'][^>]*>/gi),
      (m) => decodeXmlEntities(m[1]!.trim()),
    ).filter(Boolean);
    const rssCategories = extractAllXmlTagValues(entryXml, ['category', 'dc:subject']);
    const primaryCatMatch = entryXml.match(
      /<arxiv:primary_category[^>]*\bterm=["']([^"']+)["'][^>]*>/i,
    );
    const primaryCategory = primaryCatMatch?.[1]
      ? decodeXmlEntities(primaryCatMatch[1].trim())
      : atomCategories[0] || rssCategories[0];
    const categories = Array.from(
      new Set([...atomCategories, ...rssCategories, ...(primaryCategory ? [primaryCategory] : [])]),
    );

    const comment = extractXmlTagValue(entryXml, ['arxiv:comment']);
    const rights = extractXmlTagValue(entryXml, ['rights', 'dc:rights', 'prism:copyright']);

    entries.push({
      id: stripCdataAndHtml(rawId),
      title,
      authors,
      creators,
      doi,
      arxivId,
      primaryCategory,
      url: safeHttpUrl(url),
      pdfUrl: safeHttpUrl(pdfUrl),
      publishedAt,
      updatedAt,
      year,
      publicationTitle,
      volume,
      issue,
      pages,
      abstract,
      categories,
      comment,
      rights,
      feedFormat: format,
    });
    idx++;
  }

  return entries;
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
      const feedUrl = decodeXmlEntities(xmlUrlMatch[1].trim());
      if (!feedUrl || seenUrls.has(feedUrl)) continue;

      const titleMatch = attrs.match(/\b(?:title|text)=["']([^"']+)["']/i);
      const feedName = titleMatch?.[1] ? decodeXmlEntities(titleMatch[1].trim()) : '';

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
  return entries.map((e: FeedEntryApiItem, idx: number) => {
    const rawDate = e.publicationDate || e.published || e.updated;
    const { publishedAt, year: parsedYear } = normalizeFeedDate(rawDate);
    const cleanedDoi = e.doi ? cleanDoi(e.doi) || e.doi : undefined;
    const cleanedArxiv = e.arxivId ? normalizeArxivId(e.arxivId) || e.arxivId : undefined;
    return {
      id: e.id || e.url || e.link || `feed-item-${idx}`,
      title: cleanAcademicText(decodeXmlEntities(e.title)) || e.title,
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
        ? cleanAcademicText(decodeXmlEntities(e.publicationTitle))
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

/**
 * Centralized domain orchestrator for saving an RSS/Atom feed entry to the Library:
 * 1. Marks the entry as read and enters the saving state.
 * 2. When the entry has an authoritative identifier (DOI or arXiv ID) and an `ingestItem`
 *    executor is provided, attempts full pipeline ingestion first (enriching metadata & OA PDF).
 * 3. Falls back to `createItem` with `mapFeedEntryToCreateItemPayload`.
 */
export async function executeSaveFeedEntryToLibrary<TCreatePayload extends Record<string, unknown>>(params: {
  entry: ParsedFeedEntry;
  scopeId: string;
  targetCollectionId?: string;
  createItem: (payload: TCreatePayload) => Promise<unknown>;
  ingestItem?: (
    payload:
      | {
          source: 'doi';
          doi: string;
          collectionId?: string;
          overrides?: Record<string, unknown>;
        }
      | {
          source: 'arxiv';
          arxivId: string;
          collectionId?: string;
          overrides?: Record<string, unknown>;
        },
  ) => Promise<unknown>;
}): Promise<void> {
  const { entry, scopeId, targetCollectionId, createItem, ingestItem } = params;
  const createPayload = mapFeedEntryToCreateItemPayload(entry, {
    scopeId,
    collectionId: targetCollectionId,
  });

  let savedViaPipeline = false;
  if (ingestItem && (entry.doi || entry.arxivId)) {
    try {
      await ingestItem({
        ...(entry.doi
          ? { source: 'doi' as const, doi: entry.doi }
          : { source: 'arxiv' as const, arxivId: entry.arxivId! }),
        collectionId: targetCollectionId,
        overrides: {
          title: entry.title,
          abstract: entry.abstract,
          publicationTitle: entry.publicationTitle,
          year: entry.year,
          url: createPayload.url,
          tags: entry.categories,
          attachOaPdf: true,
          saveSnapshot: false,
        },
      });
      savedViaPipeline = true;
    } catch {
      savedViaPipeline = false;
    }
  }

  if (!savedViaPipeline) {
    await createItem({ ...createPayload, silent: true } as unknown as TCreatePayload);
  }
}

