/**
 * ClientMetadataResolverService
 *
 * Implements Tier 2 Client-Assisted Ingestion:
 * Resolves academic metadata directly in the user's browser using the user's own IP.
 * Bypasses central server IP aggregation, eliminating HTTP 429 rate limits,
 * offloading network bandwidth, and drastically reducing ingestion latency.
 */

import { cleanDoi, extractArxivId, extractPmid, extractPmcId, cleanIsbn } from '@/features/library/domain/identifiers';

export interface ClientResolvedRecord {
  success: boolean;
  provider: 'CrossRef' | 'PubMed' | 'arXiv' | 'OpenLibrary';
  sourceFormat: 'csl_json';
  cslJson: Record<string, unknown>;
  title?: string;
  doi?: string;
  pmid?: string;
  arxivId?: string;
  durationMs: number;
  error?: string;
}

export class ClientMetadataResolverService {
  private static readonly TIMEOUT_MS = 4000;
  private static readonly CONTACT_MAILTO = 'support@flux.study';

  /**
   * Identifies and pre-resolves academic metadata client-side via CORS-friendly registries.
   * Returns null if the identifier is unsupported or if client-side resolution fails/times out,
   * triggering graceful Tier 3 fallback to server-side ingestion.
   */
  static async resolveIdentifier(rawInput: string): Promise<ClientResolvedRecord | null> {
    const raw = (rawInput || '').trim();
    if (!raw) return null;

    // 1. Check DOI
    const doiCandidate = cleanDoi(raw);
    if (doiCandidate && /^10\.\d{4,9}\//.test(doiCandidate)) {
      return this.resolveDoi(doiCandidate);
    }

    // 2. Check PubMed PMID / PMCID
    const pmidCandidate = extractPmid(raw);
    if (pmidCandidate && /^\d{4,10}$/.test(pmidCandidate)) {
      return this.resolvePmid(pmidCandidate);
    }

    return null;
  }

  /**
   * Direct browser fetch to CrossRef REST API using the user's IP.
   * CrossRef fully supports CORS and requests email via mailto parameter for polite pool.
   */
  static async resolveDoi(doi: string): Promise<ClientResolvedRecord | null> {
    const start = Date.now();
    try {
      const clean = doi.trim().toLowerCase();
      const url = `https://api.crossref.org/works/${encodeURIComponent(clean)}?mailto=${encodeURIComponent(this.CONTACT_MAILTO)}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(this.TIMEOUT_MS),
      });

      if (!response.ok) {
        return null;
      }

      const json = (await response.json()) as { message?: unknown };
      const message = json?.message;
      if (!message || typeof message !== 'object') {
        return null;
      }

      const rawTitle = (message as { title?: unknown }).title;
      const title = Array.isArray(rawTitle)
        ? rawTitle[0]
        : typeof rawTitle === 'string'
          ? rawTitle
          : undefined;

      const durationMs = Date.now() - start;
      if (process.env.NODE_ENV !== 'production') {
        console.debug(`[ClientResolver] Resolved DOI "${clean}" in ${durationMs}ms via user IP`);
      }

      return {
        success: true,
        provider: 'CrossRef',
        sourceFormat: 'csl_json',
        cslJson: message as Record<string, unknown>,
        title: title ? String(title).trim() : undefined,
        doi: clean,
        durationMs,
      };
    } catch (err: unknown) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`[ClientResolver] CrossRef client resolve failed, falling back to server:`, err);
      }
      return null;
    }
  }

  /**
   * Direct browser fetch to NCBI E-utilities (PubMed) using the user's IP.
   */
  static async resolvePmid(pmid: string): Promise<ClientResolvedRecord | null> {
    const start = Date.now();
    try {
      const clean = pmid.trim();
      const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${encodeURIComponent(clean)}&retmode=json&tool=flux&email=${encodeURIComponent(this.CONTACT_MAILTO)}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(this.TIMEOUT_MS),
      });

      if (!response.ok) {
        return null;
      }

      const json = (await response.json()) as { result?: Record<string, unknown> };
      const doc = json?.result?.[clean] as Record<string, unknown> | undefined;
      if (!doc || typeof doc !== 'object') {
        return null;
      }

      const title = typeof doc.title === 'string' ? doc.title.replace(/\.$/, '').trim() : undefined;
      const authors = Array.isArray(doc.authors)
        ? doc.authors.map((a: { name?: string }) => ({
            literal: a?.name || '',
          }))
        : [];

      const durationMs = Date.now() - start;

      // Wrap in lightweight CSL-JSON compatible format
      const cslJson: Record<string, unknown> = {
        type: 'article-journal',
        title: title || `PubMed Article ${clean}`,
        author: authors,
        'container-title': doc.source || doc.fulljournalname,
        volume: doc.volume,
        issue: doc.issue,
        page: doc.pages,
        PMID: clean,
        issued: doc.pubdate ? { 'raw': doc.pubdate } : undefined,
      };

      if (Array.isArray(doc.articleids)) {
        for (const aid of doc.articleids) {
          if (aid?.idtype === 'doi' && aid?.value) {
            cslJson.DOI = aid.value;
          }
        }
      }

      return {
        success: true,
        provider: 'PubMed',
        sourceFormat: 'csl_json',
        cslJson,
        title,
        pmid: clean,
        doi: typeof cslJson.DOI === 'string' ? cslJson.DOI : undefined,
        durationMs,
      };
    } catch (err: unknown) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`[ClientResolver] PubMed client resolve failed, falling back to server:`, err);
      }
      return null;
    }
  }

  /**
   * Sniffs a File (e.g. dropped PDF) for potential academic identifiers.
   * 1. Inspects filename for DOI regex (`10.NNNN/...`).
   * 2. Inspects first 32KB of the file stream for embedded DOI strings.
   */
  static async sniffFileForIdentifier(file: File): Promise<string | null> {
    if (!file) return null;

    // 1. Filename inspection
    const nameMatch = file.name.match(/10\.\d{4,9}[/_@][-._;()/:A-Za-z0-9]+/);
    if (nameMatch) {
      const candidate = nameMatch[0].replace(/^(10\.\d{4,9})[_@]/, '$1/').replace(/[.,;:)\]]+$/, '');
      if (/^10\.\d{4,9}\//.test(candidate)) {
        return candidate;
      }
    }

    // 2. First 32KB byte buffer inspection
    try {
      const slice = file.slice(0, 32768);
      const text = await slice.text();
      const textMatch = text.match(/10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+/);
      if (textMatch) {
        const candidate = textMatch[0].replace(/[.,;:)\]]+$/, '');
        if (/^10\.\d{4,9}\//.test(candidate)) {
          return candidate;
        }
      }
    } catch {
      // Non-blocking: slice.text() failure falls through
    }

    return null;
  }
}
