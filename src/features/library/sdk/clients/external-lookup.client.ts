import type { UnifiedIngestionPayload } from '@/features/library/types/core.types';
import {
  cleanDoi,
  extractArxivId,
  extractPmid,
  cleanIsbn,
} from '@/features/library/domain/identifiers';
import {
  mapOpenAlexWorksToFeedEntries,
  mapCrossRefWorksToFeedEntries,
  mapEuropePmcWorksToFeedEntries,
  type FeedEntryApiItem,
} from '@/features/library/domain/feed-parser';

// ── Identifier / Link Ingestion & Polling Orchestration ───────────────────────

const DIRECT_LOOKUP_SELECT =
  'id,doi,title,display_name,publication_date,publication_year,authorships,primary_location,open_access,biblio,abstract_inverted_index,ids,is_retracted';

const DATACITE_PRIMARY_PREFIXES = /^10\.(?:5281|6084|5061|17605|7910|13140|48550|21227|5282|18150|1594|4121|25921)\//i;
const DIRECT_LOOKUP_CACHE_TTL_MS = 10 * 60_000;
const DIRECT_LOOKUP_CACHE_MAX = 200;
const directLookupCache = new Map<string, { expiresAt: number; value: Record<string, unknown> | null }>();

function setBoundedDirectLookupCache(
  key: string,
  value: Record<string, unknown> | null,
): void {
  const now = Date.now();
  if (directLookupCache.has(key)) {
    directLookupCache.delete(key);
  } else if (directLookupCache.size >= DIRECT_LOOKUP_CACHE_MAX) {
    // Evict expired entries first, then oldest LRU entry
    for (const [k, entry] of directLookupCache) {
      if (entry.expiresAt <= now) {
        directLookupCache.delete(k);
      }
    }
    if (directLookupCache.size >= DIRECT_LOOKUP_CACHE_MAX) {
      const oldestKey = directLookupCache.keys().next().value;
      if (oldestKey !== undefined) {
        directLookupCache.delete(oldestKey);
      }
    }
  }
  directLookupCache.set(key, { expiresAt: now + DIRECT_LOOKUP_CACHE_TTL_MS, value });
}
const directLookupInFlight = new Map<string, Promise<Record<string, unknown> | null>>();
let activeDirectLookups = 0;
const directLookupWaitQueue: Array<() => void> = [];

async function withDirectLookupBudget<T>(fn: () => Promise<T>): Promise<T> {
  if (activeDirectLookups >= 3) {
    await new Promise<void>((resolve) => directLookupWaitQueue.push(resolve));
  }
  activeDirectLookups++;
  try {
    return await fn();
  } finally {
    activeDirectLookups--;
    const next = directLookupWaitQueue.shift();
    if (next) next();
  }
}

async function fetchJsonDirectWithTimeout(url: string, timeoutMs = 2000): Promise<unknown | null> {
  if (typeof window === 'undefined' || typeof window.fetch !== 'function') return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await window.fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function mapEntryToOverrides(
  entry: FeedEntryApiItem | undefined,
  extra?: { isRetracted?: boolean; publisher?: string; itemType?: string; isbn?: string },
): Record<string, unknown> | null {
  if (!entry || !entry.title || entry.title === 'Untitled Article') return null;
  const overrides: Record<string, unknown> = {
    title: entry.title,
    ...(Array.isArray(entry.authors) && entry.authors.length > 0 ? { authors: entry.authors } : {}),
    ...(Array.isArray(entry.creators) && entry.creators.length > 0 ? { creators: entry.creators } : {}),
    ...(entry.year ? { year: entry.year } : {}),
    ...(entry.publicationDate ? { publicationDate: entry.publicationDate } : {}),
    ...(entry.publicationTitle ? { publicationTitle: entry.publicationTitle } : {}),
    ...(extra?.publisher ? { publisher: extra.publisher } : {}),
    ...(extra?.itemType ? { itemType: extra.itemType } : {}),
    ...(extra?.isbn ? { isbn: extra.isbn } : {}),
    ...(entry.abstract ? { abstract: entry.abstract } : {}),
    ...(entry.doi ? { doi: entry.doi } : {}),
    ...(entry.arxivId ? { arxivId: entry.arxivId } : {}),
    ...(entry.url ? { url: entry.url } : {}),
    ...(entry.pdfUrl ? { pdfUrl: entry.pdfUrl, openAccessPdfUrl: entry.pdfUrl } : {}),
    ...(entry.volume ? { volume: entry.volume } : {}),
    ...(entry.issue ? { issue: entry.issue } : {}),
    ...(entry.pages ? { pages: entry.pages } : {}),
    ...(extra?.isRetracted !== undefined ? { isRetracted: extra.isRetracted } : {}),
  };
  return overrides;
}

function mapDataCiteDoiToOverrides(payload: unknown, cleanDoiStr: string): Record<string, unknown> | null {
  const attrs = (payload as { data?: { attributes?: Record<string, unknown> } } | null)?.data?.attributes;
  if (!attrs || typeof attrs !== 'object') return null;
  const titles = Array.isArray(attrs.titles) ? (attrs.titles as Array<{ title?: string }>) : [];
  const rawTitle = titles.find((t) => typeof t?.title === 'string' && t.title.trim())?.title?.trim();
  if (!rawTitle) return null;

  const rawCreators = Array.isArray(attrs.creators)
    ? (attrs.creators as Array<{ name?: string; givenName?: string; familyName?: string }>)
    : [];
  const authors = rawCreators
    .map((c) => ([c.givenName, c.familyName].filter(Boolean).join(' ') || c.name || '').trim())
    .filter(Boolean);
  const creators = rawCreators
    .map((c) => ({ firstName: c.givenName || '', lastName: c.familyName || c.name || '', creatorType: 'author' }))
    .filter((c) => Boolean(c.firstName || c.lastName));
  const pubYear = Number.parseInt(String(attrs.publicationYear ?? ''), 10);
  const publisher = typeof attrs.publisher === 'string' && attrs.publisher.trim() ? attrs.publisher.trim() : undefined;
  const descriptions = Array.isArray(attrs.descriptions)
    ? (attrs.descriptions as Array<{ description?: string; descriptionType?: string }>)
    : [];
  const rawAbstract =
    descriptions.find((d) => /abstract/i.test(String(d?.descriptionType || '')))?.description || descriptions[0]?.description;
  const abstract = typeof rawAbstract === 'string' ? rawAbstract.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : undefined;
  const resType = String((attrs.types as { resourceTypeGeneral?: string } | undefined)?.resourceTypeGeneral || '').toLowerCase();
  const itemType =
    resType === 'dataset' ? 'dataset' : resType === 'software' ? 'computerProgram' : resType === 'dissertation' ? 'thesis' : resType === 'preprint' ? 'preprint' : 'journalArticle';
  const landingUrl = (typeof attrs.url === 'string' && attrs.url.trim()) || `https://doi.org/${cleanDoiStr}`;

  return {
    title: rawTitle,
    ...(authors.length > 0 ? { authors } : {}),
    ...(creators.length > 0 ? { creators } : {}),
    ...(Number.isFinite(pubYear) ? { year: pubYear } : {}),
    ...(publisher ? { publisher, publicationTitle: publisher } : {}),
    ...(abstract ? { abstract } : {}),
    doi: cleanDoiStr,
    url: landingUrl,
    itemType,
  };
}

/**
 * Direct-from-User-IP Academic Identifier Virtualizer (Zotero RA-Aware Strategy):
 * Queries CORS-enabled academic APIs (OpenAlex, CrossRef, DataCite, EuropePMC, OpenLibrary, OpenReview)
 * directly from the user's browser to pre-enrich metadata before server ingestion.
 */
export async function lookupAcademicIdentifierDirect(
  payload: UnifiedIngestionPayload,
): Promise<Record<string, unknown> | null> {
  if (typeof window === 'undefined') return null;
  const cacheKey =
    payload.source === 'doi' && payload.doi ? `doi:${payload.doi.trim().toLowerCase()}` :
    payload.source === 'arxiv' && payload.arxivId ? `arxiv:${payload.arxivId.trim().toLowerCase()}` :
    payload.source === 'pmid' && payload.pmid ? `pmid:${payload.pmid.trim().toUpperCase()}` :
    payload.source === 'isbn' && payload.isbn ? `isbn:${payload.isbn.replace(/[-\s]/g, '').trim()}` :
    payload.source === 'url' && payload.url ? `url:${payload.url.trim()}` : '';
  if (!cacheKey) return null;

  const cached = directLookupCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value ? { ...cached.value } : null;
  const inflight = directLookupInFlight.get(cacheKey);
  if (inflight) return inflight;

  const task = withDirectLookupBudget(async (): Promise<Record<string, unknown> | null> => {
    if (payload.source === 'doi' && payload.doi) {
      const clean = payload.doi.trim();

      // 1. RA-Aware Primary: DataCite prefixes (Zenodo, Figshare, Dryad, OSF, Dataverse) route to DataCite first
      if (DATACITE_PRIMARY_PREFIXES.test(clean)) {
        const dcJson = await fetchJsonDirectWithTimeout(`https://api.datacite.org/dois/${encodeURIComponent(clean)}`);
        const dcOverrides = mapDataCiteDoiToOverrides(dcJson, clean);
        if (dcOverrides) return dcOverrides;
      }

      // 2. OpenAlex Primary (Covers 250M+ CrossRef & DataCite works + Abstract + OA PDF + Retraction in 1 hit)
      const oaUrl = `https://api.openalex.org/works/https://doi.org/${encodeURIComponent(clean)}?select=${DIRECT_LOOKUP_SELECT}`;
      const oaJson = await fetchJsonDirectWithTimeout(oaUrl);
      if (oaJson && typeof oaJson === 'object' && 'id' in oaJson) {
        const oaRec = oaJson as Record<string, unknown>;
        const mapped = mapOpenAlexWorksToFeedEntries({ results: [oaRec] })[0];
        const isRetracted = typeof oaRec.is_retracted === 'boolean' ? oaRec.is_retracted : undefined;
        const overrides = mapEntryToOverrides(mapped, { isRetracted });
        if (overrides) return overrides;
      }

      // 3. CrossRef Works API (Zero-day newly minted journal DOIs not yet indexed in OpenAlex)
      if (!DATACITE_PRIMARY_PREFIXES.test(clean)) {
        const crJson = await fetchJsonDirectWithTimeout(`https://api.crossref.org/works/${encodeURIComponent(clean)}`);
        const msg = (crJson as { message?: Record<string, unknown> } | null)?.message;
        if (msg) {
          const mapped = mapCrossRefWorksToFeedEntries({ message: { items: [msg] } })[0];
          const overrides = mapEntryToOverrides(mapped);
          if (overrides) return overrides;
        }
      }
      return null;
    }

    if (payload.source === 'arxiv' && payload.arxivId) {
      const cleanArxiv = payload.arxivId.replace(/v\d+$/i, '').trim();
      const oaUrl =
        `https://api.openalex.org/works?filter=ids.arxiv:https://arxiv.org/abs/${encodeURIComponent(cleanArxiv)}` +
        `&per-page=1&select=${DIRECT_LOOKUP_SELECT}`;
      const oaJson = await fetchJsonDirectWithTimeout(oaUrl);
      const firstOa = Array.isArray((oaJson as { results?: unknown[] })?.results)
        ? ((oaJson as { results: Array<Record<string, unknown>> }).results[0])
        : undefined;
      const mapped = mapOpenAlexWorksToFeedEntries(oaJson)[0];
      const isRetracted = typeof firstOa?.is_retracted === 'boolean' ? firstOa.is_retracted : undefined;
      const overrides = mapEntryToOverrides(mapped, { isRetracted, itemType: 'preprint' });
      if (overrides) {
        if (!overrides.pdfUrl) {
          const synthesizedPdf = `https://arxiv.org/pdf/${cleanArxiv}.pdf`;
          overrides.pdfUrl = synthesizedPdf;
          overrides.openAccessPdfUrl = synthesizedPdf;
        }
        return overrides;
      }
      return null;
    }

    if (payload.source === 'pmid' && payload.pmid) {
      const cleanId = payload.pmid.trim();
      const isPmc = /^PMC\d+/i.test(cleanId);
      const queryExpr = isPmc ? `PMCID:${cleanId.toUpperCase()}` : `EXT_ID:${cleanId} AND SRC:MED`;
      const epmcUrl =
        `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(queryExpr)}` +
        `&resultType=core&pageSize=1&format=json`;
      const epmcJson = await fetchJsonDirectWithTimeout(epmcUrl);
      const mapped = mapEuropePmcWorksToFeedEntries(epmcJson)[0];
      return mapEntryToOverrides(mapped);
    }

    if (payload.source === 'isbn' && payload.isbn) {
      const cleanIsbnStr = payload.isbn.replace(/[-\s]/g, '').trim();
      const bibKey = `ISBN:${cleanIsbnStr}`;
      const olUrl = `https://openlibrary.org/api/books?bibkeys=${encodeURIComponent(bibKey)}&format=json&jscmd=data`;
      const olJson = await fetchJsonDirectWithTimeout(olUrl);
      const book = (olJson as Record<string, Record<string, unknown>> | null)?.[bibKey];
      if (book && typeof book.title === 'string' && book.title.trim()) {
        const authors = Array.isArray(book.authors)
          ? (book.authors as Array<{ name?: string }>).map((a) => a?.name?.trim() || '').filter(Boolean)
          : [];
        const publishers = Array.isArray(book.publishers) ? (book.publishers as Array<{ name?: string }>) : [];
        const publisher = publishers[0]?.name?.trim() || undefined;
        const yearMatch = typeof book.publish_date === 'string' ? book.publish_date.match(/(\d{4})/) : null;
        const year = yearMatch ? Number.parseInt(yearMatch[1], 10) : undefined;
        return {
          title: book.title.trim(),
          ...(authors.length > 0 ? { authors } : {}),
          ...(publisher ? { publisher, publicationTitle: publisher } : {}),
          ...(year ? { year } : {}),
          isbn: cleanIsbnStr,
          itemType: 'book',
        };
      }
      return null;
    }

    if (payload.source === 'url' && payload.url) {
      const orMatch = payload.url.match(/openreview\.net\/(?:forum|pdf)\?id=([A-Za-z0-9_-]+)/i);
      if (orMatch?.[1]) {
        const forumId = orMatch[1];
        const orJson = await fetchJsonDirectWithTimeout(`https://api2.openreview.net/notes?id=${encodeURIComponent(forumId)}`);
        const content = (orJson as { notes?: Array<{ content?: Record<string, unknown> }> } | null)?.notes?.[0]?.content;
        const unwrap = (v: unknown): unknown =>
          v && typeof v === 'object' && !Array.isArray(v) && 'value' in v ? (v as Record<string, unknown>).value : v;
        const rawTitle = unwrap(content?.title);
        if (typeof rawTitle === 'string' && rawTitle.trim()) {
          const rawAuthors = unwrap(content?.authors);
          const authors = Array.isArray(rawAuthors) ? rawAuthors.filter((a): a is string => typeof a === 'string') : [];
          const rawAbstract = unwrap(content?.abstract);
          const pdfUrl = `https://openreview.net/pdf?id=${forumId}`;
          return {
            title: rawTitle.trim(),
            ...(authors.length > 0 ? { authors } : {}),
            ...(typeof rawAbstract === 'string' && rawAbstract.trim() ? { abstract: rawAbstract.trim() } : {}),
            publicationTitle: 'OpenReview',
            itemType: 'conferencePaper',
            pdfUrl,
            openAccessPdfUrl: pdfUrl,
          };
        }
      }
    }
    return null;
  });

  directLookupInFlight.set(cacheKey, task);
  try {
    const result = await task;
    setBoundedDirectLookupCache(cacheKey, result);
    return result ? { ...result } : null;
  } finally {
    directLookupInFlight.delete(cacheKey);
  }
}
