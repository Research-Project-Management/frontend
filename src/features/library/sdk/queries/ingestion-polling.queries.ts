'use client';

import type { QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { IngestionService } from '../clients/curation.client';
import type { UnifiedIngestionPayload } from '@/features/library/types/core.types';
import { itemKeys, invalidateCollections } from '@/features/library/sdk/query-keys';
import {
  cleanDoi,
  extractArxivId,
  extractPmid,
  extractPmcId,
  cleanIsbn,
} from '@/features/library/domain/identifiers.domain';
import {
  mapOpenAlexWorksToFeedEntries,
  mapCrossRefWorksToFeedEntries,
  mapEuropePmcWorksToFeedEntries,
  type FeedEntryApiItem,
} from '@/features/library/domain/feed-parser.domain';

export interface PollRunOutcome {
  ok: boolean;
  status?: string;
  timedOut?: boolean;
  title?: string;
  itemId?: string;
  error?: string;
}

export interface PollIngestionRunOptions {
  fallbackTitle?: string;
  initialItemId?: string;
  pollIntervalMs?: number;
  maxWaitMs?: number;
  slowPollThresholdMs?: number;
  onSlowPollThreshold?: () => void;
  signal?: AbortSignal;
  adaptiveBackoff?: boolean;
}

function computeNextPollDelayMs(
  baseIntervalMs: number,
  attempt: number,
  adaptiveBackoff: boolean,
): number {
  if (!adaptiveBackoff || attempt < 3) {
    return baseIntervalMs;
  }
  const maxIntervalMs = Math.max(baseIntervalMs, 4000);
  const multiplier = Math.min(3.5, Math.pow(1.35, attempt - 2));
  const rawDelay = Math.min(maxIntervalMs, Math.round(baseIntervalMs * multiplier));
  const jitterFactor = 0.9 + Math.random() * 0.2;
  return Math.max(baseIntervalMs, Math.round(rawDelay * jitterFactor));
}

function abortableSleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (!signal) {
    return new Promise((r) => setTimeout(r, ms));
  }
  if (signal.aborted) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const onAbort = () => {
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

export async function pollIngestionRunCompletion(
  scopeId: string,
  runId: string,
  opts: PollIngestionRunOptions = {},
): Promise<PollRunOutcome> {
  const startTime = Date.now();
  const maxWaitMs = opts.maxWaitMs ?? 120000;
  const pollIntervalMs = opts.pollIntervalMs ?? 1200;
  const useAdaptiveBackoff =
    opts.adaptiveBackoff ?? opts.pollIntervalMs === undefined;
  let finalTitle = opts.fallbackTitle || 'Document';
  let finalItemId = opts.initialItemId;
  let slowThresholdTriggered = false;
  let attempt = 0;
  let consecutiveErrors = 0;

  while (Date.now() - startTime < maxWaitMs) {
    if (opts.signal?.aborted) {
      return { ok: false, error: 'Polling aborted' };
    }
    const nextDelayMs = computeNextPollDelayMs(
      pollIntervalMs,
      attempt,
      useAdaptiveBackoff,
    );
    attempt++;
    await abortableSleep(nextDelayMs, opts.signal);
    if (opts.signal?.aborted) {
      return { ok: false, error: 'Polling aborted' };
    }

    if (
      !slowThresholdTriggered &&
      opts.slowPollThresholdMs !== undefined &&
      opts.onSlowPollThreshold &&
      Date.now() - startTime >= opts.slowPollThresholdMs
    ) {
      slowThresholdTriggered = true;
      opts.onSlowPollThreshold();
    }

    try {
      const runStatus = await IngestionService.getRunStatus(scopeId, runId);
      consecutiveErrors = 0;
      const statusPayload = runStatus as {
        data?: {
          status?: string;
          ingestionStatus?: string;
          resolutionStatus?: string;
          title?: string;
          itemId?: string;
          lastError?: string;
          errorMessage?: string;
        };
        status?: string;
        ingestionStatus?: string;
        resolutionStatus?: string;
        title?: string;
        itemId?: string;
        lastError?: string;
        errorMessage?: string;
      } | null;
      const currentRun = statusPayload?.data || statusPayload;
      const currentStatus = (currentRun?.status || '').toUpperCase();
      const currentIngestionStatus = (currentRun?.ingestionStatus || '').toUpperCase();
      const currentResolutionStatus = (currentRun?.resolutionStatus || '').toUpperCase();

      if (
        currentStatus === 'BLOCKED' ||
        currentIngestionStatus === 'BLOCKED' ||
        currentResolutionStatus === 'BLOCKED'
      ) {
        return {
          ok: false,
          status: 'BLOCKED',
          error:
            currentRun?.lastError ||
            currentRun?.errorMessage ||
            'Publisher blocked automated access — please download and upload the PDF directly.',
        };
      }

      if (
        currentStatus === 'COMPLETED' ||
        currentStatus === 'READY' ||
        currentStatus === 'SUCCEEDED' ||
        currentStatus === 'PARTIAL' ||
        currentRun?.resolutionStatus === 'NEEDS_REVIEW' ||
        currentResolutionStatus === 'NEEDS_REVIEW' ||
        currentStatus === 'NEEDS_REVIEW'
      ) {
        if (currentRun?.title && currentRun.title !== 'Uploaded Document') {
          finalTitle = currentRun.title;
        }
        if (currentRun?.itemId) {
          finalItemId = currentRun.itemId;
        }
        return { ok: true, status: currentStatus || 'COMPLETED', title: finalTitle, itemId: finalItemId };
      }

      if (
        currentStatus === 'FAILED_FINAL' ||
        currentStatus === 'FAILED_RETRYABLE' ||
        currentStatus === 'CANCELLED' ||
        currentStatus === 'CANCELED' ||
        currentStatus === 'FAILED'
      ) {
        return {
          ok: false,
          status: 'FAILED',
          error: currentRun?.lastError || currentRun?.errorMessage || 'Extraction failed',
        };
      }
    } catch (err: unknown) {
      consecutiveErrors += 1;
      const errObj = err as { status?: number; statusCode?: number; response?: { status?: number } } | null;
      const status = errObj?.status ?? errObj?.statusCode ?? errObj?.response?.status;
      if (status === 401 || status === 403 || status === 404 || consecutiveErrors >= 5) {
        throw err;
      }
      // Retry on transient poll network glitch
    }
  }

  // Non-blocking graceful handoff: file was safely stored and queued on server
  return { ok: true, timedOut: true, title: finalTitle, itemId: finalItemId };
}

// ── Identifier / Link Ingestion & Polling Orchestration ───────────────────────

const DIRECT_LOOKUP_SELECT =
  'id,doi,title,display_name,publication_date,publication_year,authorships,primary_location,open_access,biblio,abstract_inverted_index,ids,is_retracted';

const DATACITE_PRIMARY_PREFIXES = /^10\.(?:5281|6084|5061|17605|7910|13140|48550|21227|5282|18150|1594|4121|25921)\//i;
const DIRECT_LOOKUP_CACHE_TTL_MS = 10 * 60_000;
const directLookupCache = new Map<string, { expiresAt: number; value: Record<string, unknown> | null }>();
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
    directLookupCache.set(cacheKey, { expiresAt: Date.now() + DIRECT_LOOKUP_CACHE_TTL_MS, value: result });
    return result ? { ...result } : null;
  } finally {
    directLookupInFlight.delete(cacheKey);
  }
}

export function buildIdentifierIngestionPayload(
  rawInput: string,
  options?: {
    collectionId?: string;
    title?: string;
    attachOaPdf?: boolean;
    saveSnapshot?: boolean;
  },
): UnifiedIngestionPayload {
  const raw = rawInput.trim();
  const collectionId = options?.collectionId || undefined;
  const userTitle = options?.title?.trim() || undefined;
  const overridesObj: Record<string, unknown> = {
    ...(userTitle ? { title: userTitle } : {}),
    ...(options?.attachOaPdf !== undefined ? { attachOaPdf: options.attachOaPdf } : {}),
    ...(options?.saveSnapshot !== undefined ? { saveSnapshot: options.saveSnapshot } : {}),
  };
  const overrides = Object.keys(overridesObj).length > 0 ? overridesObj : undefined;

  if (raw.startsWith('@') || /^(?:%[^\r\n]*[\r\n]+\s*)*@[a-zA-Z]+\s*\{/.test(raw)) {
    return { source: 'bibtex', content: raw, collectionId, ...(overrides ? { overrides } : {}) };
  }
  if (raw.startsWith('TY  -') || /^(?:\uFEFF)?\s*TY\s+-/m.test(raw)) {
    return { source: 'ris', content: raw, collectionId, ...(overrides ? { overrides } : {}) };
  }
  if (
    (raw.startsWith('[') && raw.endsWith(']')) ||
    (raw.startsWith('{') && raw.endsWith('}') && /"(?:title|type|author|DOI|issued)"/i.test(raw))
  ) {
    return { source: 'csl_json', content: raw, collectionId, ...(overrides ? { overrides } : {}) };
  }

  const lines = raw.split(/[\r\n]+/).map((l) => l.trim()).filter(Boolean);
  if (lines.length > 1) return { source: 'bibtex', content: lines.join('\n'), collectionId, ...(overrides ? { overrides } : {}) };

  const arxivCandidate = extractArxivId(raw);
  if (arxivCandidate && (/arxiv/i.test(raw) || /^\(?\[?(?:arxiv:\s*)?(\d{4}\.\d{4,5}|[a-z-]+\/\d{7})/i.test(raw))) {
    return { source: 'arxiv', arxivId: arxivCandidate, collectionId, overrides };
  }
  const pmcCandidate = extractPmcId(raw);
  if (pmcCandidate) return { source: 'pmid', pmid: pmcCandidate, collectionId, overrides };
  const pmidCandidate = extractPmid(raw);
  if (pmidCandidate) return { source: 'pmid', pmid: pmidCandidate, collectionId, overrides };
  const doiCandidate = cleanDoi(raw);
  if (doiCandidate && /^10\.\d{4,9}\//.test(doiCandidate)) return { source: 'doi', doi: doiCandidate, collectionId, overrides };
  const isbnCandidate = cleanIsbn(raw);
  if (isbnCandidate) return { source: 'isbn', isbn: isbnCandidate, collectionId, overrides };

  return { source: 'url', url: raw, collectionId, overrides };
}

export interface TrackedIdentifierIngestionOptions {
  scopeId: string;
  rawInput: string;
  title?: string;
  attachOaPdf?: boolean;
  saveSnapshot?: boolean;
  collectionId?: string;
  rethrowOnError?: boolean;
  queryClient: QueryClient;
  onCloseModal: () => void;
  onAddProvisionalItem: (item: {
    id: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    scopeId: string;
    collectionId?: string;
    status: 'PROCESSING';
    progress: number;
    extractedTitle: string;
    createdAt: string;
  }) => void;
  onDismissProvisionalItem: (id: string) => void;
}

/**
 * Submits an identifier/URL/BibTeX/RIS payload and orchestrates fast-path completion,
 * background polling, provisional item display, and scoped cache synchronization.
 */
export async function executeTrackedIdentifierIngestion({
  scopeId,
  rawInput,
  title,
  attachOaPdf,
  saveSnapshot,
  collectionId,
  rethrowOnError = false,
  queryClient,
  onCloseModal,
  onAddProvisionalItem,
  onDismissProvisionalItem,
}: TrackedIdentifierIngestionOptions): Promise<void> {
  const raw = rawInput.trim();
  if (!raw) return;

  const targetCollectionId = collectionId || undefined;
  const userTitle = title?.trim() || undefined;
  const initialDisplayTitle = userTitle || raw;
  const ingestionPayload = buildIdentifierIngestionPayload(raw, {
    collectionId: targetCollectionId,
    title: userTitle,
    attachOaPdf,
    saveSnapshot,
  });

  const provisionalId = `provisional-link-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const toastId = `add-identifier-${provisionalId}`;
  toast.loading(`Adding ${initialDisplayTitle ? `"${initialDisplayTitle}"` : 'reference'}...`, { id: toastId });
  let provisionalAdded = false;

  // Attempt fast direct browser CORS lookup from user's IP (OpenAlex / CrossRef / EuropePMC)
  const directOverrides = await lookupAcademicIdentifierDirect(ingestionPayload);
  const directTitle =
    typeof directOverrides?.title === 'string' && directOverrides.title.trim()
      ? directOverrides.title.trim()
      : undefined;
  const effectiveDisplayTitle = userTitle || directTitle || raw;
  if (
    directOverrides &&
    (ingestionPayload.source === 'doi' ||
      ingestionPayload.source === 'arxiv' ||
      ingestionPayload.source === 'pmid' ||
      ingestionPayload.source === 'isbn' ||
      ingestionPayload.source === 'url')
  ) {
    ingestionPayload.overrides = {
      ...directOverrides,
      _clientResolved: true,
      ...(ingestionPayload.overrides || {}),
      ...(userTitle ? { title: userTitle, _userTitle: true } : {}),
    };
    if (directTitle && !userTitle) {
      toast.loading(`Adding "${directTitle}"...`, { id: toastId });
    }
  }

  const syncLibraryQueries = async () => {
    await Promise.all([
      queryClient.refetchQueries({ queryKey: itemKeys.all(scopeId) }),
      queryClient.refetchQueries({ queryKey: itemKeys.counts(scopeId) }),
      targetCollectionId
        ? queryClient.refetchQueries({
            queryKey: itemKeys.byCollection(scopeId, targetCollectionId),
          })
        : Promise.resolve(),
    ]);
    invalidateCollections(queryClient, scopeId);
  };

  try {
    const ingestRes = await IngestionService.ingest(scopeId, ingestionPayload);
    const ingestData = ingestRes?.data;
    const runId = ingestData?.runId;
    const initialStatus = (ingestData?.status || '').toUpperCase();
    const isAlreadyDone =
      initialStatus === 'COMPLETED' ||
      initialStatus === 'SUCCEEDED' ||
      initialStatus === 'READY' ||
      Boolean(ingestData?.deduplicated);

    const itemObj = ingestData?.item as Record<string, unknown> | undefined;
    let finalTitle =
      userTitle ||
      (typeof itemObj?.title === 'string' && itemObj.title ? itemObj.title : '') ||
      directTitle ||
      '';

    if (isAlreadyDone || !runId) {
      await syncLibraryQueries();
      toast.success(
        ingestData?.deduplicated ? 'Reference already in library' : 'Document imported',
        {
          description: finalTitle
            ? `"${finalTitle}" is ready in your library.`
            : 'Successfully added to your library.',
          id: toastId,
        },
      );
      onCloseModal();
      return;
    }

    let modalClosed = false;
    let handedOffToBackground = false;
    const pollOutcome = await pollIngestionRunCompletion(scopeId, runId, {
      fallbackTitle: finalTitle,
      pollIntervalMs: 700,
      maxWaitMs: 60000,
      slowPollThresholdMs: 3500,
      onSlowPollThreshold: () => {
        handedOffToBackground = true;
        if (!modalClosed) {
          modalClosed = true;
          onCloseModal();
        }
        provisionalAdded = true;
        onAddProvisionalItem({
          id: provisionalId,
          fileName: effectiveDisplayTitle,
          fileSize: 0,
          mimeType: 'text/html',
          scopeId,
          collectionId: targetCollectionId,
          status: 'PROCESSING',
          progress: 50,
          extractedTitle: effectiveDisplayTitle,
          createdAt: new Date().toISOString(),
        });
        toast.loading('Processing document in background...', {
          id: toastId,
          description: 'Extracting metadata. Your library will update automatically once ready.',
        });
      },
    });

    if (!pollOutcome.ok) {
      throw new Error(pollOutcome.error || 'Extraction failed');
    }

    finalTitle = pollOutcome.title || finalTitle;
    await syncLibraryQueries();
    if (provisionalAdded) {
      onDismissProvisionalItem(provisionalId);
    }
    if (!handedOffToBackground && !modalClosed) {
      modalClosed = true;
      onCloseModal();
    }

    if (pollOutcome.timedOut) {
      toast.info('Ingestion queued', {
        description: 'Document is taking longer than usual to process. It will appear once finished.',
        id: toastId,
      });
      return;
    }

    toast.success('Document imported', {
      description: finalTitle
        ? `"${finalTitle}" has been added to your library.`
        : 'Successfully added to your library.',
      id: toastId,
    });
  } catch (err: unknown) {
    if (provisionalAdded) {
      onDismissProvisionalItem(provisionalId);
    }
    toast.error('Import failed', {
      description: err instanceof Error ? err.message : 'Could not import reference.',
      id: toastId,
    });
    if (rethrowOnError && !provisionalAdded) {
      throw err instanceof Error ? err : new Error('Could not import reference.');
    }
  }
}
