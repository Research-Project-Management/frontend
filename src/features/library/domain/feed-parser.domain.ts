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

import type { CreatorCredit } from '@/features/library/types/core.types';
import type {
  SavedFeedSubscription,
  FeedRetentionDays,
  FeedFormat,
  FeedCreatorApiItem,
  FeedEntryApiItem,
  FeedFetchApiResponse,
  ParsedFeedEntry,
} from '@/features/library/types/ingestion.types';
import { safeHttpUrl } from '@/features/library/domain/system-views.policy';
import { parseCreatorName } from '@/features/library/domain/creators.domain';
import {
  decodeXmlEntities,
  cleanText,
} from '@/features/library/domain/citations.domain';
import {
  cleanDoi,
  normalizeArxivId,
} from '@/features/library/domain/identifiers.domain';

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

export type {
  FeedFormat,
  FeedCreatorApiItem,
  FeedEntryApiItem,
  FeedFetchApiResponse,
  ParsedFeedEntry,
};

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

interface CreateLibraryItemFromFeedPayload {
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
function normalizeFeedDate(rawDate?: string | null): {
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
    if (e.isSaved || e.savedItemId) return true;
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
      (e.arxivId && e.arxivId.toLowerCase().includes(q)) ||
      (e.primaryCategory && e.primaryCategory.toLowerCase().includes(q)) ||
      (e.categories && e.categories.some((c) => c.toLowerCase().includes(q))),
  );
}

// ── Client-Side Feed Protocol Virtualizer (RSS-to-API Virtualization) ─────────

export type FeedVirtualizationStrategy =
  | {
      kind: 'openalex';
      endpointUrl: string;
      feedTitle: string;
      primaryCategory?: string;
    }
  | {
      kind: 'crossref';
      endpointUrl: string;
      feedTitle: string;
      primaryCategory?: string;
    }
  | {
      kind: 'europepmc';
      endpointUrl: string;
      feedTitle: string;
      primaryCategory?: string;
    }
  | {
      kind: 'server-fallback';
      endpointUrl: string;
      feedTitle?: string;
    };

const JOURNAL_DOMAIN_ISSN_MAP: Array<{
  pattern: RegExp;
  issn?: string;
  doiPrefix?: string;
  title: string;
}> = [
  { pattern: /nature\.com\/nature(?:\.rss|\/|$)/i, issn: '0028-0836', doiPrefix: '10.1038', title: 'Nature' },
  { pattern: /nature\.com\/nmeth/i, issn: '1548-7091', doiPrefix: '10.1038', title: 'Nature Methods' },
  { pattern: /nature\.com\/nbt/i, issn: '1087-0156', doiPrefix: '10.1038', title: 'Nature Biotechnology' },
  { pattern: /nature\.com\/nm(?:\.rss|\/|$)/i, issn: '1078-8956', doiPrefix: '10.1038', title: 'Nature Medicine' },
  { pattern: /nature\.com\/nphys/i, issn: '1745-2473', doiPrefix: '10.1038', title: 'Nature Physics' },
  { pattern: /nature\.com\/ncomms/i, issn: '2041-1723', doiPrefix: '10.1038', title: 'Nature Communications' },
  { pattern: /nature\.com\/srep/i, issn: '2045-2322', doiPrefix: '10.1038', title: 'Scientific Reports' },
  { pattern: /nature\.com/i, doiPrefix: '10.1038', title: 'Nature Portfolio' },
  { pattern: /science\.org.*jc=science|sciencemag\.org/i, issn: '0036-8075', doiPrefix: '10.1126', title: 'Science' },
  { pattern: /science\.org/i, doiPrefix: '10.1126', title: 'Science (AAAS)' },
  { pattern: /cell\.com/i, issn: '0092-8674', doiPrefix: '10.1016', title: 'Cell Press' },
  { pattern: /pnas\.org/i, issn: '0027-8424', doiPrefix: '10.1073', title: 'PNAS' },
  { pattern: /nejm\.org/i, issn: '0028-4793', doiPrefix: '10.1056', title: 'New England Journal of Medicine' },
  { pattern: /thelancet\.com/i, issn: '0140-6736', doiPrefix: '10.1016', title: 'The Lancet' },
  { pattern: /jamanetwork\.com/i, issn: '0098-7484', doiPrefix: '10.1001', title: 'JAMA Network' },
  { pattern: /bmj\.com/i, issn: '0959-8138', doiPrefix: '10.1136', title: 'The BMJ' },
  { pattern: /plos\.org|plosone\.org/i, issn: '1932-6203', doiPrefix: '10.1371', title: 'PLOS ONE' },
  { pattern: /mdpi\.com/i, doiPrefix: '10.3390', title: 'MDPI Open Access' },
  { pattern: /frontiersin\.org/i, doiPrefix: '10.3389', title: 'Frontiers' },
  { pattern: /ieeexplore\.ieee\.org|ieee\.org/i, doiPrefix: '10.1109', title: 'IEEE Xplore' },
  { pattern: /dl\.acm\.org|acm\.org/i, doiPrefix: '10.1145', title: 'ACM Digital Library' },
  { pattern: /springer\.com|link\.springer\.com/i, doiPrefix: '10.1007', title: 'SpringerLink' },
  { pattern: /oup\.com|academic\.oup\.com/i, doiPrefix: '10.1093', title: 'Oxford Academic' },
  { pattern: /aps\.org|journals\.aps\.org/i, doiPrefix: '10.1103', title: 'American Physical Society (APS)' },
  { pattern: /pubs\.acs\.org|acs\.org/i, doiPrefix: '10.1021', title: 'ACS Publications' },
  { pattern: /rsc\.org|pubs\.rsc\.org/i, doiPrefix: '10.1039', title: 'Royal Society of Chemistry' },
  { pattern: /wiley\.com|onlinelibrary\.wiley\.com/i, doiPrefix: '10.1002', title: 'Wiley Online Library' },
  { pattern: /tandfonline\.com/i, doiPrefix: '10.1080', title: 'Taylor & Francis' },
  { pattern: /elifesciences\.org/i, issn: '2050-084X', doiPrefix: '10.7554', title: 'eLife' },
];

/**
 * Translates legacy RSS/Atom feed URLs or academic venue links into CORS-enabled
 * JSON API queries (OpenAlex, CrossRef, EuropePMC) executed directly from the
 * user's browser IP.
 */
export function resolveFeedVirtualizationPlan(
  rawUrl: string,
  rows = 30,
): FeedVirtualizationStrategy {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) {
    return { kind: 'server-fallback', endpointUrl: trimmed };
  }

  // 1. arXiv RSS / Atom / Category URLs (e.g., https://rss.arxiv.org/rss/cs.AI or export.arxiv.org/rss/cs.LG)
  const arxivRssMatch = trimmed.match(
    /(?:rss\.arxiv\.org\/(?:rss|atom)|export\.arxiv\.org\/rss|arxiv\.org\/rss)\/([A-Za-z0-9.-]+(?:\+[A-Za-z0-9.-]+)*)/i,
  );
  if (arxivRssMatch?.[1]) {
    const rawCat = arxivRssMatch[1].split('+')[0]!;
    const queryTerm = encodeURIComponent(rawCat);
    return {
      kind: 'openalex',
      endpointUrl: `https://api.openalex.org/works?filter= indexed_in:arxiv&search=${queryTerm}&sort=publication_date:desc&per-page=${rows}`,
      feedTitle: `arXiv: ${rawCat}`,
      primaryCategory: rawCat,
    };
  }

  // 2. bioRxiv & medRxiv Preprint Feeds (e.g., connect.biorxiv.org/biorxiv_xml.php?subject=neuroscience)
  if (/biorxiv\.org|medrxiv\.org/i.test(trimmed)) {
    const isMedrxiv = /medrxiv\.org/i.test(trimmed);
    const repoTitle = isMedrxiv ? 'medRxiv Preprints' : 'bioRxiv Preprints';
    let subject = '';
    try {
      const parsed = new URL(trimmed);
      subject = (parsed.searchParams.get('subject') || '').replace(/[_-]+/g, ' ').trim();
    } catch {
      // ignore invalid URL
    }
    const queryPart = subject && subject.toLowerCase() !== 'all'
      ? `&query.bibliographic=${encodeURIComponent(subject)}`
      : '';
    const displaySubject = subject && subject.toLowerCase() !== 'all'
      ? `${repoTitle}: ${subject.charAt(0).toUpperCase() + subject.slice(1)}`
      : repoTitle;
    return {
      kind: 'crossref',
      endpointUrl: `https://api.crossref.org/works?filter=prefix:10.1101,type:posted-content${queryPart}&sort=published&order=desc&rows=${rows}`,
      feedTitle: displaySubject,
      primaryCategory: subject || (isMedrxiv ? 'medRxiv' : 'bioRxiv'),
    };
  }

  // 3. PubMed / NCBI / EuropePMC Feeds
  if (/pubmed\.ncbi\.nlm\.nih\.gov|ncbi\.nlm\.nih\.gov\/rss|ebi\.ac\.uk\/europepmc/i.test(trimmed)) {
    let term = 'OPEN_ACCESS:Y';
    try {
      const parsed = new URL(trimmed);
      const q = parsed.searchParams.get('term') || parsed.searchParams.get('query') || parsed.searchParams.get('q');
      if (q && q.trim()) term = q.trim();
    } catch {
      // default term
    }
    return {
      kind: 'europepmc',
      endpointUrl: `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(term)}&resultType=core&sort=P_PDATE_D+desc&pageSize=${rows}&format=json`,
      feedTitle: term === 'OPEN_ACCESS:Y' ? 'PubMed / EuropePMC Recent Papers' : `PubMed: ${term}`,
    };
  }

  // 4. Explicit ISSN in URL (e.g., /issn/0028-0836 or ?issn=1234-567X)
  const issnMatch = trimmed.match(/\b(\d{4}-\d{3}[\dXx])\b/);
  if (issnMatch?.[1]) {
    const issn = issnMatch[1].toUpperCase();
    return {
      kind: 'crossref',
      endpointUrl: `https://api.crossref.org/journals/${encodeURIComponent(issn)}/works?sort=published&order=desc&rows=${rows}`,
      feedTitle: `Journal Feed (ISSN ${issn})`,
    };
  }

  // 5. Known Academic Publishers & Journals (Nature, Science, Cell, IEEE, ACM, Springer, MDPI, PLOS, etc.)
  for (const entry of JOURNAL_DOMAIN_ISSN_MAP) {
    if (entry.pattern.test(trimmed)) {
      if (entry.issn) {
        return {
          kind: 'crossref',
          endpointUrl: `https://api.crossref.org/journals/${encodeURIComponent(entry.issn)}/works?sort=published&order=desc&rows=${rows}`,
          feedTitle: entry.title,
        };
      }
      if (entry.doiPrefix) {
        let extraQuery = '';
        if (/mdpi\.com\/rss\/journal\/([a-z0-9_-]+)/i.test(trimmed)) {
          const jMatch = trimmed.match(/mdpi\.com\/rss\/journal\/([a-z0-9_-]+)/i);
          if (jMatch?.[1]) {
            extraQuery = `&query.container-title=${encodeURIComponent(jMatch[1])}`;
          }
        }
        return {
          kind: 'crossref',
          endpointUrl: `https://api.crossref.org/works?filter=prefix:${encodeURIComponent(entry.doiPrefix)}${extraQuery}&sort=published&order=desc&rows=${rows}`,
          feedTitle: entry.title,
        };
      }
    }
  }

  // 6. Direct OpenAlex or CrossRef API URLs pasted by power users
  if (/^https?:\/\/api\.openalex\.org\/works/i.test(trimmed)) {
    return { kind: 'openalex', endpointUrl: trimmed, feedTitle: 'OpenAlex Feed' };
  }
  if (/^https?:\/\/api\.crossref\.org\/(?:works|journals)/i.test(trimmed)) {
    return { kind: 'crossref', endpointUrl: trimmed, feedTitle: 'CrossRef Feed' };
  }

  // 7. Generic RSS/Atom blog or custom server URL -> Fallback
  return { kind: 'server-fallback', endpointUrl: trimmed };
}

/**
 * Reconstructs a plain-text abstract from an OpenAlex `abstract_inverted_index`.
 */
function reconstructOpenAlexAbstract(
  invertedIndex?: Record<string, number[]> | null,
): string | undefined {
  if (!invertedIndex || typeof invertedIndex !== 'object') return undefined;
  const wordsByPosition: string[] = [];
  for (const [word, positions] of Object.entries(invertedIndex)) {
    if (!Array.isArray(positions)) continue;
    for (const pos of positions) {
      if (typeof pos === 'number' && pos >= 0 && pos < 10000) {
        wordsByPosition[pos] = word;
      }
    }
  }
  const text = wordsByPosition.filter(Boolean).join(' ').trim();
  return text || undefined;
}

export function mapOpenAlexWorksToFeedEntries(
  payload: unknown,
  defaultCategory?: string,
): FeedEntryApiItem[] {
  const results = Array.isArray((payload as { results?: unknown[] })?.results)
    ? ((payload as { results: Array<Record<string, unknown>> }).results)
    : [];
  return results.map((work, idx) => {
    const rawDoi = typeof work.doi === 'string' ? work.doi.replace(/^https?:\/\/doi\.org\//i, '') : undefined;
    const ids = (work.ids && typeof work.ids === 'object' ? work.ids : {}) as Record<string, unknown>;
    const rawArxiv = typeof ids.arxiv === 'string'
      ? ids.arxiv.replace(/^https?:\/\/arxiv\.org\/abs\//i, '')
      : rawDoi && /10\.48550\/arxiv\./i.test(rawDoi)
        ? rawDoi.replace(/^.*10\.48550\/arxiv\./i, '')
        : undefined;
    const authorships = Array.isArray(work.authorships)
      ? (work.authorships as Array<{ author?: { display_name?: string } }>)
      : [];
    const authors = authorships
      .map((a) => a?.author?.display_name?.trim() || '')
      .filter(Boolean);
    const primaryLoc = (work.primary_location && typeof work.primary_location === 'object'
      ? work.primary_location
      : {}) as {
      landing_page_url?: string;
      pdf_url?: string;
      source?: { display_name?: string };
    };
    const oa = (work.open_access && typeof work.open_access === 'object' ? work.open_access : {}) as {
      oa_url?: string;
    };
    const biblio = (work.biblio && typeof work.biblio === 'object' ? work.biblio : {}) as {
      volume?: string;
      issue?: string;
      first_page?: string;
      last_page?: string;
    };
    const pages = [biblio.first_page, biblio.last_page].filter(Boolean).join('-');
    const pubDate = typeof work.publication_date === 'string' ? work.publication_date : undefined;
    const pubYear = typeof work.publication_year === 'number' ? work.publication_year : null;
    const abstractText = reconstructOpenAlexAbstract(
      work.abstract_inverted_index as Record<string, number[]> | null | undefined,
    );
    const pdfUrl =
      primaryLoc.pdf_url ||
      oa.oa_url ||
      (rawArxiv ? `https://arxiv.org/pdf/${rawArxiv}.pdf` : undefined);
    const landingUrl =
      primaryLoc.landing_page_url ||
      (rawArxiv ? `https://arxiv.org/abs/${rawArxiv}` : undefined) ||
      (rawDoi ? `https://doi.org/${rawDoi}` : undefined);

    return {
      id: rawDoi ? `doi:${rawDoi}` : rawArxiv ? `arxiv:${rawArxiv}` : String(work.id || `oa-${idx}`),
      title: String(work.title || work.display_name || 'Untitled Article'),
      authors,
      doi: rawDoi,
      arxivId: rawArxiv,
      primaryCategory: defaultCategory,
      url: landingUrl,
      link: landingUrl,
      pdfUrl,
      publicationDate: pubDate,
      published: pubDate,
      year: pubYear,
      publicationTitle: primaryLoc.source?.display_name || (rawArxiv ? 'arXiv' : undefined),
      volume: biblio.volume || undefined,
      issue: biblio.issue || undefined,
      pages: pages || undefined,
      abstract: abstractText,
      summary: abstractText,
    };
  });
}

export function mapCrossRefWorksToFeedEntries(
  payload: unknown,
  defaultTitle?: string,
  defaultCategory?: string,
): FeedEntryApiItem[] {
  const msg = (payload && typeof payload === 'object' && 'message' in payload
    ? (payload as { message?: { items?: Array<Record<string, unknown>> } }).message
    : undefined);
  const items = Array.isArray(msg?.items) ? msg.items : [];
  return items.map((item, idx) => {
    const rawTitle = Array.isArray(item.title) ? String(item.title[0] || '') : String(item.title || 'Untitled Article');
    const doi = typeof item.DOI === 'string' ? item.DOI : undefined;
    const containerArr = item['container-title'];
    const journal = Array.isArray(containerArr) && containerArr[0]
      ? String(containerArr[0])
      : typeof containerArr === 'string' && containerArr
        ? containerArr
        : defaultTitle;
    const rawAuthors = Array.isArray(item.author)
      ? (item.author as Array<{ given?: string; family?: string; name?: string }>)
      : [];
    const authors = rawAuthors
      .map((a) => [a.given, a.family].filter(Boolean).join(' ') || a.name || '')
      .filter(Boolean);
    const creators: FeedCreatorApiItem[] = rawAuthors.map((a) => ({
      firstName: a.given || '',
      lastName: a.family || a.name || '',
      creatorType: 'author',
    }));
    const dateParts =
      (item.published as { 'date-parts'?: number[][] } | undefined)?.['date-parts']?.[0] ||
      (item['published-online'] as { 'date-parts'?: number[][] } | undefined)?.['date-parts']?.[0] ||
      (item.issued as { 'date-parts'?: number[][] } | undefined)?.['date-parts']?.[0] ||
      (item.created as { 'date-parts'?: number[][] } | undefined)?.['date-parts']?.[0];
    const pubDate = dateParts && dateParts[0]
      ? `${dateParts[0]}-${String(dateParts[1] || 1).padStart(2, '0')}-${String(dateParts[2] || 1).padStart(2, '0')}`
      : undefined;
    const links = Array.isArray(item.link)
      ? (item.link as Array<{ 'content-type'?: string; URL?: string }>)
      : [];
    const pdfUrl =
      links.find((l) => l['content-type'] === 'application/pdf')?.URL ||
      (doi && /^10\.1101\//.test(doi) ? `https://www.biorxiv.org/content/${doi}.full.pdf` : undefined);
    const rawAbstract = typeof item.abstract === 'string'
      ? item.abstract.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      : undefined;

    return {
      id: doi ? `doi:${doi}` : `cr-${idx}`,
      title: rawTitle || 'Untitled Article',
      authors,
      creators,
      doi,
      primaryCategory: defaultCategory,
      url: (typeof item.URL === 'string' ? item.URL : undefined) || (doi ? `https://doi.org/${doi}` : undefined),
      link: (typeof item.URL === 'string' ? item.URL : undefined) || (doi ? `https://doi.org/${doi}` : undefined),
      pdfUrl,
      publicationDate: pubDate,
      published: pubDate,
      year: dateParts?.[0] ?? null,
      publicationTitle: journal,
      volume: typeof item.volume === 'string' ? item.volume : undefined,
      issue: typeof item.issue === 'string' ? item.issue : undefined,
      pages: typeof item.page === 'string' ? item.page : undefined,
      abstract: rawAbstract,
      summary: rawAbstract,
    };
  });
}

export function mapEuropePmcWorksToFeedEntries(payload: unknown): FeedEntryApiItem[] {
  const resultList = (payload as { resultList?: { result?: Array<Record<string, unknown>> } })?.resultList;
  const items = Array.isArray(resultList?.result) ? resultList.result : [];
  return items.map((item, idx) => {
    const doi = typeof item.doi === 'string' ? item.doi : undefined;
    const pmid = typeof item.pmid === 'string' ? item.pmid : undefined;
    const pmcid = typeof item.pmcid === 'string' ? item.pmcid : undefined;
    const authorStr = typeof item.authorString === 'string' ? item.authorString : '';
    const authors = authorStr
      .split(',')
      .map((s) => s.replace(/\.$/, '').trim())
      .filter(Boolean);
    const pubDate = typeof item.firstPublicationDate === 'string' ? item.firstPublicationDate : undefined;
    const pubYear = typeof item.pubYear === 'string' ? Number.parseInt(item.pubYear, 10) : null;
    const landingUrl = doi
      ? `https://doi.org/${doi}`
      : pmid
        ? `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`
        : undefined;
    const pdfUrl = pmcid
      ? `https://europepmc.org/backend/ptpmcrender.fcgi?accid=${pmcid}&blobtype=pdf`
      : undefined;
    const abstractText = typeof item.abstractText === 'string'
      ? item.abstractText.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      : undefined;

    return {
      id: doi ? `doi:${doi}` : pmid ? `pmid:${pmid}` : `epmc-${idx}`,
      title: String(item.title || 'Untitled Article').replace(/\.$/, ''),
      authors,
      doi,
      url: landingUrl,
      link: landingUrl,
      pdfUrl,
      publicationDate: pubDate,
      published: pubDate,
      year: Number.isFinite(pubYear) ? pubYear : null,
      publicationTitle: typeof item.journalTitle === 'string' ? item.journalTitle : undefined,
      volume: typeof item.journalVolume === 'string' ? item.journalVolume : undefined,
      issue: typeof item.issue === 'string' ? item.issue : undefined,
      pages: typeof item.pageInfo === 'string' ? item.pageInfo : undefined,
      abstract: abstractText,
      summary: abstractText,
    };
  });
}




