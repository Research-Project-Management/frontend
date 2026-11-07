/**
 * Pure Domain Presentation Helpers: Identifiers (DOI, arXiv, PMID, ISBN) & Item File URL Resolvers
 */

import { stripLatexMarkup } from './metadata-sanitizers.domain';

const BRACKET_PAIRS: ReadonlyArray<readonly [string, number, number]> = [
  [')', 41, 40],
  [']', 93, 91],
  ['}', 125, 123],
  ['>', 62, 60],
];

function hasMoreCloseThanOpen(str: string, closeCode: number, openCode: number): boolean {
  let closeCount = 0;
  let openCount = 0;
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code === closeCode) closeCount++;
    else if (code === openCode) openCount++;
  }
  return closeCount > openCount;
}

function trimUnmatchedClosingBrackets(str: string): string {
  let s = str;
  for (const [closeChar, closeCode, openCode] of BRACKET_PAIRS) {
    while (
      s.endsWith(closeChar) &&
      hasMoreCloseThanOpen(s, closeCode, openCode)
    ) {
      s = s.slice(0, -1);
    }
  }
  return s;
}

/**
 * Validates and extracts a canonical clean DOI string (10.NNNN/...)
 */
export function cleanDoi(doi?: string | null): string {
  if (!doi || typeof doi !== 'string') return '';
  let clean = doi.trim().replace(/^[([\s<"']+/, '');

  if (/%[0-9A-Fa-f]{2}/.test(clean)) {
    try {
      clean = decodeURIComponent(clean);
    } catch {
      // ignore malformed URI sequence
    }
  }

  const stripTrailingJunk = (s: string): string => {
    let cur = s.trim();
    let prev = '';
    while (cur !== prev) {
      prev = cur;
      cur = cur.replace(/[.,;:\s"']+$/, '');
      cur = trimUnmatchedClosingBrackets(cur);
    }
    return cur;
  };

  clean = stripTrailingJunk(clean);

  const natureMatch = clean.match(
    /^https?:\/\/(?:www\.)?nature\.com\/articles\/([a-z0-9._-]+)(?:[?#].*)?$/i,
  );
  if (natureMatch && natureMatch[1]) return `10.1038/${stripTrailingJunk(natureMatch[1])}`;

  const zenodoMatch = clean.match(
    /^https?:\/\/zenodo\.org\/records?\/(\d+)(?:[?#].*)?$/i,
  );
  if (zenodoMatch && zenodoMatch[1]) return `10.5281/zenodo.${zenodoMatch[1]}`;

  const biorxivMatch = clean.match(
    /^https?:\/\/(?:www\.)?(?:biorxiv|medrxiv)\.org\/content\/(10\.\d{4,9}\/[^?#\s]+?)(?:v\d+)?(?:\.full|\.abstract|\.pdf)?(?:[?#].*)?$/i,
  );
  if (biorxivMatch && biorxivMatch[1]) return stripTrailingJunk(biorxivMatch[1].replace(/v\d+$/, ''));

  const plosMatch = clean.match(
    /^https?:\/\/journals\.plos\.org\/[^/]+\/article\?(?:[^#]*&)?id=(10\.\d{4,9}\/[^&#\s]+)/i,
  );
  if (plosMatch && plosMatch[1]) return stripTrailingJunk(decodeURIComponent(plosMatch[1]));

  const aclMatch = clean.match(
    /^https?:\/\/(?:www\.)?aclanthology\.org\/([a-zA-Z0-9.-]+?)(?:\.pdf)?\/?(?:[?#].*)?$/i,
  );
  if (
    aclMatch &&
    aclMatch[1] &&
    !['anthology', 'events', 'venues', 'sigs', 'people', 'info'].includes(
      aclMatch[1].toLowerCase(),
    )
  ) {
    return `10.18653/v1/${stripTrailingJunk(aclMatch[1])}`;
  }

  const embeddedMatch = clean.match(
    /^https?:\/\/[^/]+(?:\/[^/]+)*\/(?:doi|article|chapter|book)\/(?:abs\/|full\/|epdf\/|pdf\/)?(10\.\d{4,9}\/[-._;()/:A-Za-z0-9<>+=[\]~]+)(?:[?#].*)?$/i,
  );
  if (embeddedMatch && embeddedMatch[1]) {
    clean = embeddedMatch[1]
      .replace(/\/+$/, '')
      .replace(/\.(?:pdf|html)$/i, '')
      .replace(/\/(?:full|abstract|pdf|epdf|html|fulltext|meta)\/?$/i, '');
  }

  clean = clean
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '')
    .replace(/^doi:\s*/i, '')
    .replace(/^doi\//i, '')
    .replace(/[?#].*$/, '')
    .trim();

  clean = stripTrailingJunk(clean);

  const doiRegex = /\b(10\.\d{4,9}\/[-._;()/:A-Za-z0-9<>+=[\]~]+)/;
  const match = clean.match(doiRegex);
  if (match) {
    return stripTrailingJunk(match[1])
      .replace(/\/(?:full|abstract|pdf|epdf|html|fulltext|meta)\/?$/i, '')
      .replace(/\.(?:pdf|html)$/i, '');
  }

  return clean.startsWith('10.')
    ? clean
        .replace(/\/(?:full|abstract|pdf|epdf|html|fulltext|meta)\/?$/i, '')
        .replace(/\.(?:pdf|html)$/i, '')
    : '';
}

export function isValidDoi(doi?: string | null): boolean {
  const cleaned = cleanDoi(doi);
  return Boolean(cleaned && /^10\.\d{4,9}\/.+/.test(cleaned));
}

/**
 * Extracts canonical arXiv ID from text, DOI or URL (e.g. "1706.03762", "2305.18290v1", or "hep-th/9901001v2")
 */
export function extractArxivId(input?: string | null): string | null {
  if (!input || typeof input !== 'string') return null;
  const clean = input
    .trim()
    .replace(/^[([\s<"']+/, '')
    .replace(/\s*\[.*?\]\s*$/, '')
    .replace(/[.,;:\s"')\]>]+$/, '')
    .replace(/\.pdf$/i, '');

  const explicitMatch =
    clean.match(/arxiv\.org\/(?:abs|pdf|html)\/([a-z-]+\/\d{7}(?:v\d+)?|\d{4}\.\d{4,5}(?:v\d+)?)/i) ||
    clean.match(/10\.48550\/arxiv\.(\d{4}\.\d{4,5}(?:v\d+)?)/i) ||
    clean.match(/arxiv[.:]\s*([a-z-]+\/\d{7}(?:v\d+)?|\d{4}\.\d{4,5}(?:v\d+)?)/i);
  if (explicitMatch) return explicitMatch[1];

  // Do not extract bare NNNN.NNNNN substrings from non-arXiv DOIs (e.g. 10.1000/2020.12345)
  if (/^(?:https?:\/\/(?:dx\.)?doi\.org\/|doi\s*:\s*)?10\.(?!48550\/arxiv\.)\d{4,9}\//i.test(clean)) {
    return null;
  }

  const match =
    clean.match(/\b([a-z]{2,}(?:-[a-z]{2,})?\/\d{7}(?:v\d+)?)\b/i) ||
    clean.match(/\b(\d{4}\.\d{4,5}(?:v\d+)?)\b/);

  return match ? match[1] : null;
}

/**
 * Normalizes an arXiv identifier from URLs, DOIs (`10.48550/arXiv.NNNN.NNNNN`),
 * `arXiv:` prefixes, or category suffixes (`[cs.CL]`).
 */
export function normalizeArxivId(
  input?: string | null,
  options?: { stripVersion?: boolean },
): string {
  const extracted = extractArxivId(input);
  if (!extracted) return '';
  return options?.stripVersion ? extracted.replace(/v\d+$/i, '') : extracted;
}

export function getArxivPdfUrl(arxivId?: string | null): string {
  const id = extractArxivId(arxivId);
  return id ? `https://arxiv.org/pdf/${id}.pdf` : '';
}

/**
 * Extracts a numeric PubMed ID (PMID) from raw strings or URLs (e.g. "PMID: 34265844", "https://pubmed.ncbi.nlm.nih.gov/34265844/")
 */
export function extractPmid(input?: string | null): string {
  if (!input || typeof input !== 'string') return '';
  const clean = input
    .trim()
    .replace(/^[([\s<"']+/, '')
    .replace(/[.,;:\s"')\]>]+$/, '');
  const urlMatch = clean.match(/(?:pubmed\.ncbi\.nlm\.nih\.gov|ncbi\.nlm\.nih\.gov\/pubmed)\/(\d{4,9})/i);
  if (urlMatch) return urlMatch[1];
  const prefixMatch = clean.match(/^(?:pmid\s*[:#]?\s*)?(\d{6,9})$/i);
  if (prefixMatch) return prefixMatch[1];
  const explicitShortMatch = clean.match(/^pmid\s*[:#]?\s*(\d{4,9})$/i);
  if (explicitShortMatch) return explicitShortMatch[1];
  return '';
}

/**
 * Extracts a PubMed Central ID (PMCID) from raw strings or URLs (e.g. "PMCID: PMC8284567", "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8284567/")
 */
export function extractPmcId(input?: string | null): string {
  if (!input || typeof input !== 'string') return '';
  const clean = input
    .trim()
    .replace(/^[([\s<"']+/, '')
    .replace(/[.,;:\s"')\]>]+$/, '');
  const match = clean.match(/\b(PMC\d{5,9})\b/i);
  return match ? match[1].toUpperCase() : '';
}

/**
 * Extracts and cleans ISBN-10 or ISBN-13 strings (e.g. "ISBN-13: 978-0-262-03561-3" -> "978-0-262-03561-3", "080442957X")
 */
export function cleanIsbn(input?: string | null): string {
  if (!input || typeof input !== 'string') return '';
  const stripped = input
    .trim()
    .replace(/^[([\s<"']+/, '')
    .replace(/[.,;:\s"')\]>]+$/, '')
    .replace(/^isbn(?:-?1[03])?\s*[:#]?\s*/i, '')
    .trim();
  const digitsOnly = stripped.replace(/[-\s]/g, '');
  if (/^(?:97[89]\d{10}|\d{9}[\dXx])$/.test(digitsOnly)) {
    return stripped.replace(/x$/, 'X');
  }
  return '';
}

type BatchIdentifierType = 'doi' | 'arxiv' | 'pmid' | 'pmcid' | 'isbn' | 'url' | 'bibtex' | 'ris';

interface ParsedBatchIdentifier {
  type: BatchIdentifierType;
  value: string;
  canonicalKey: string;
  raw: string;
}

/**
 * Parses, classifies, normalizes, and deduplicates a messy multi-line, comma-, semicolon-,
 * or whitespace-separated block of identifiers pasted into Zotero's "Add Item by Identifier"
 * Magic Wand input box (while preserving semicolons inside Wiley SICI DOIs and raw BibTeX/RIS snippets).
 */
export function parseBatchIdentifiersInput(rawInput?: string | null): ParsedBatchIdentifier[] {
  if (!rawInput || typeof rawInput !== 'string') return [];
  const trimmed = rawInput.trim();
  if (!trimmed) return [];

  if (/^@[a-zA-Z]+\s*\{/.test(trimmed)) {
    return [
      {
        type: 'bibtex',
        value: trimmed,
        canonicalKey: `bibtex:${trimmed.slice(0, 120).toLowerCase()}`,
        raw: trimmed,
      },
    ];
  }

  if (/^TY\s+-\s+/m.test(trimmed)) {
    return [
      {
        type: 'ris',
        value: trimmed,
        canonicalKey: `ris:${trimmed.slice(0, 120).toLowerCase()}`,
        raw: trimmed,
      },
    ];
  }

  let normalized = trimmed
    .replace(/\b(pmid|pmcid|arxiv|doi)\s*[:#]\s*/gi, '$1:')
    .replace(/\bisbn(?:-?1[03])?\s*[:#]?\s*((?:97[89][-\s]?)?(?:\d[-\s]?){9}[\dXx])\b/gi, (_, isbnDigits: string) => {
      return `ISBN:${isbnDigits.replace(/\s+/g, '-')}`;
    });

  const SICI_SEMI_PLACEHOLDER = '__FLUX_SICI_SEMI__';
  normalized = normalized.replace(
    /(10\.\d{4,9}\/[^\s,;]+);(\d+-\d+[A-Za-z0-9]*)/g,
    `$1${SICI_SEMI_PLACEHOLDER}$2`,
  );

  const rawTokens = normalized
    .split(/[\r\n,;]+|\s+/)
    .map((t) => t.replace(new RegExp(SICI_SEMI_PLACEHOLDER, 'g'), ';').trim())
    .filter(Boolean);

  const results: ParsedBatchIdentifier[] = [];
  const seenKeys = new Set<string>();

  const addUnique = (entry: ParsedBatchIdentifier) => {
    if (!seenKeys.has(entry.canonicalKey)) {
      seenKeys.add(entry.canonicalKey);
      results.push(entry);
    }
  };

  for (const token of rawTokens) {
    const arxivCandidate = extractArxivId(token);
    if (
      arxivCandidate &&
      (/arxiv/i.test(token) || /^\(?\[?(?:arxiv:\s*)?(\d{4}\.\d{4,5}|[a-z-]+\/\d{7})/i.test(token))
    ) {
      const baseArxiv = arxivCandidate.replace(/v\d+$/i, '').toLowerCase();
      addUnique({
        type: 'arxiv',
        value: arxivCandidate,
        canonicalKey: `arxiv:${baseArxiv}`,
        raw: token,
      });
      continue;
    }

    const pmcCandidate = extractPmcId(token);
    if (pmcCandidate) {
      addUnique({
        type: 'pmcid',
        value: pmcCandidate,
        canonicalKey: `pmcid:${pmcCandidate.toUpperCase()}`,
        raw: token,
      });
      continue;
    }

    const pmidCandidate = extractPmid(token);
    if (pmidCandidate) {
      addUnique({
        type: 'pmid',
        value: pmidCandidate,
        canonicalKey: `pmid:${pmidCandidate}`,
        raw: token,
      });
      continue;
    }

    const isbnCandidate = cleanIsbn(token);
    if (isbnCandidate) {
      const digitsOnly = isbnCandidate.replace(/[-\s]/g, '').toUpperCase();
      addUnique({
        type: 'isbn',
        value: isbnCandidate,
        canonicalKey: `isbn:${digitsOnly}`,
        raw: token,
      });
      continue;
    }

    const doiCandidate = cleanDoi(token);
    if (doiCandidate && /^10\.\d{4,9}\//.test(doiCandidate)) {
      addUnique({
        type: 'doi',
        value: doiCandidate,
        canonicalKey: `doi:${doiCandidate.toLowerCase()}`,
        raw: token,
      });
      continue;
    }

    const cleanedUrl = token
      .replace(/^[([\s<"']+/, '')
      .replace(/[.,;:\s"')\]>]+$/, '');
    if (/^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(cleanedUrl)) {
      addUnique({
        type: 'url',
        value: cleanedUrl,
        canonicalKey: `url:${cleanedUrl.toLowerCase()}`,
        raw: token,
      });
    }
  }

  return results;
}

/**
 * Normalizes title string by stripping LaTeX markup, collapsing whitespace, and fixing spaced hyphens.
 */
export function cleanPaperTitle(raw?: string | null): string {
  if (!raw || typeof raw !== 'string') return '';
  let cleaned = stripLatexMarkup(raw.trim());
  cleaned = cleaned.replace(/\s+/g, ' ');
  cleaned = cleaned.replace(/(\p{L})\s+-\s+(\p{L})/gu, '$1-$2');
  return cleaned.trim();
}

const TITLE_CASE_STOP_WORDS: ReadonlySet<string> = new Set([
  'a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor',
  'on', 'at', 'to', 'from', 'by', 'with', 'in', 'of', 'over', 'into', 'onto',
]);

/**
 * Converts a title to standard academic title case, lowercasing common prepositions/articles
 * except when at the start or end of the title.
 */
export function normalizeTitleCase(title?: string | null): string {
  if (!title || typeof title !== 'string') return '';
  const cleaned = cleanPaperTitle(title);
  if (!cleaned) return '';

  const words = cleaned.split(' ');
  return words
    .map((word, index) => {
      const lower = word.toLowerCase();
      if (index > 0 && index < words.length - 1 && TITLE_CASE_STOP_WORDS.has(lower)) {
        return lower;
      }
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}

// ── Item File URL & Storage Resolvers ───────────────────────────────────────

export function isProjectScope(scopeId?: string): scopeId is string {
  if (!scopeId) return false;
  const s = scopeId.trim().toLowerCase();
  return (
    s !== 'user' &&
    s !== 'me' &&
    s !== 'personal' &&
    s !== 'global' &&
    s !== 'default'
  );
}

type ItemFileSource = {
  fileUrl?: string | null;
  pdfUrl?: string | null;
  openAccessPdfUrl?: string | null;
  url?: string | null;
  filename?: string | null;
  doi?: string | null;
  arxivId?: string | null;
  fileId?: string | null;
  metadata?: unknown;
  primaryFile?: { url?: string | null; fileId?: string | null } | null;
  attachments?: Array<{
    id?: string;
    url?: string | null;
    fileUrl?: string | null;
    fileId?: string | null;
    filename?: string | null;
    mimeType?: string | null;
    attachmentType?: string | null;
  }> | null;
  [key: string]: unknown;
};

/**
 * Extracts the canonical PDF or reading file URL from an Item.
 * Strictly resolves canonical binary content URLs (/api/v1/library/files/:fileId/content)
 * and avoids falling back to DOI landing page URLs.
 */
export function getItemFileUrl(
  item?: ItemFileSource | null | undefined,
  scopeId?: string,
): string {
  if (!item) return '';

  const effectiveScope = isProjectScope(scopeId)
    ? scopeId
    : typeof item.projectId === 'string' && isProjectScope(item.projectId)
      ? item.projectId
      : undefined;

  const normalizeUrl = (
    url?: string | null,
    fileId?: string | null,
  ): string => {
    if (fileId) {
      return isProjectScope(effectiveScope)
        ? `/api/v1/projects/${encodeURIComponent(effectiveScope)}/library/files/${encodeURIComponent(fileId)}/content`
        : `/api/v1/library/files/${encodeURIComponent(fileId)}/content`;
    }
    if (!url || typeof url !== 'string') return '';
    const trimmed = url.trim();
    if (!trimmed) return '';
    if (
      trimmed.startsWith('/api/v1/storage/files/') &&
      !trimmed.includes('/r2/') &&
      !trimmed.endsWith('/content')
    ) {
      return `${trimmed}/content`;
    }
    return trimmed;
  };

  const attachments = Array.isArray(item.attachments) ? item.attachments : [];

  const primaryPdfAttachment =
    attachments.find((a) => a?.attachmentType === 'primary_pdf') ||
    attachments.find((a) => a?.mimeType === 'application/pdf') ||
    attachments.find(
      (a) =>
        Boolean(a?.fileId) &&
        typeof a?.filename === 'string' &&
        a.filename.toLowerCase().endsWith('.pdf'),
    );

  if (primaryPdfAttachment) {
    const url = normalizeUrl(
      primaryPdfAttachment.url,
      primaryPdfAttachment.fileId,
    );
    if (url) return url;
  }

  const metaObj =
    typeof item.metadata === 'object' && item.metadata !== null
      ? (item.metadata as Record<string, unknown>)
      : undefined;
  const resolvedDirectFileId =
    item.fileId ||
    (typeof metaObj?.fileId === 'string' ? metaObj.fileId : undefined) ||
    (typeof metaObj?.file_id === 'string' ? metaObj.file_id : undefined);
  if (resolvedDirectFileId) {
    return isProjectScope(effectiveScope)
      ? `/api/v1/projects/${encodeURIComponent(effectiveScope)}/library/files/${encodeURIComponent(resolvedDirectFileId)}/content`
      : `/api/v1/library/files/${encodeURIComponent(resolvedDirectFileId)}/content`;
  }

  if (item.primaryFile) {
    const url = normalizeUrl(item.primaryFile.url, item.primaryFile.fileId);
    if (url) return url;
  }

  const fallbackDirectUrl = item.fileUrl || item.pdfUrl || item.openAccessPdfUrl;
  if (fallbackDirectUrl) {
    const url = normalizeUrl(fallbackDirectUrl, item.fileId);
    if (url) return url;
  }

  const arxivId =
    item.arxivId ||
    (typeof metaObj?.arxivId === 'string' ? metaObj.arxivId : undefined) ||
    (typeof metaObj?.arxiv_id === 'string' ? metaObj.arxiv_id : undefined);
  if (typeof arxivId === 'string' && arxivId.trim()) {
    return getArxivPdfUrl(arxivId) || `https://arxiv.org/pdf/${arxivId.trim().replace(/^arxiv:/i, '')}.pdf`;
  }

  return '';
}

/**
 * Extracts all canonical file URLs (primary file + all attachments) associated with an Item.
 * Used during item deletion/purge/merge to deterministically evict every cached binary
 * and warm ObjectURL belonging to the item across Tier-1 RAM and Tier-4 OPFS/IndexedDB.
 */
export function resolveAllItemAttachmentUrls(
  item?: ItemFileSource | null | undefined,
  scopeId?: string,
): string[] {
  if (!item) return [];
  const urls = new Set<string>();
  const primary = getItemFileUrl(item, scopeId);
  if (primary) urls.add(primary);

  if (Array.isArray(item.attachments)) {
    for (const att of item.attachments) {
      if (!att) continue;
      const attUrl = getItemFileUrl(
        {
          fileUrl: att.fileUrl || att.url,
          url: att.url,
          fileId: att.fileId,
        },
        scopeId,
      );
      if (attUrl) urls.add(attUrl);
    }
  }
  return Array.from(urls);
}

/**
 * Computes WebCrypto SHA-256 hex digest of a browser File/Blob (for files <= 25 MB)
 * to deduplicate identical binary files before network upload.
 */
export async function computeEdgeFileSha256(file: Blob): Promise<string | null> {
  if (!file || file.size === 0 || file.size > 25 * 1024 * 1024) return null;
  if (typeof crypto === 'undefined' || !crypto.subtle?.digest) return null;
  try {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return null;
  }
}

export type EdgeSniffedIdentifier =
  | { type: 'doi'; value: string }
  | { type: 'arxiv'; value: string }
  | { type: 'pmid'; value: string }
  | { type: 'url'; value: string };

function extractIdentifierFromPdfSampleText(
  sample: string,
): EdgeSniffedIdentifier | null {
  // 1. Authoritative XMP / PDF Info Dict tags (<prism:doi>, <pdfx:doi>, <dc:identifier>, /DOI (...))
  const xmpDoiMatch =
    sample.match(
      /<(?:prism:doi|pdfx:doi|crossmark:doi)[^>]*>\s*(?:doi:\s*)?(10\.\d{4,9}\/[^\s<"'&]+)/i,
    )?.[1] ||
    sample.match(
      /<dc:identifier[^>]*>\s*(?:doi:\s*|https?:\/\/(?:dx\.)?doi\.org\/)(10\.\d{4,9}\/[^\s<"'&]+)/i,
    )?.[1] ||
    sample.match(/\/DOI\s*\(\s*(?:doi:\s*)?(10\.\d{4,9}\/[^)\s]+)\s*\)/i)?.[1] ||
    sample.match(/(?:doi\.org\/|doi:\s*)(10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+)/i)?.[1];
  if (xmpDoiMatch) {
    const cleaned = cleanDoi(xmpDoiMatch);
    if (cleaned && /^10\.\d{4,9}\//.test(cleaned)) {
      return { type: 'doi', value: cleaned };
    }
  }

  // 2. arXiv stamp or XMP arXiv identifier (e.g., arXiv:2303.08774v1 [cs.CL])
  const arxivMatch = sample.match(
    /arXiv:\s*(\d{4}\.\d{4,5}(?:v\d+)?|[a-z-]+(?:\.[a-z]{2})?\/\d{7}(?:v\d+)?)/i,
  )?.[1];
  if (arxivMatch) {
    const cleanedArxiv = extractArxivId(arxivMatch);
    if (cleanedArxiv) return { type: 'arxiv', value: cleanedArxiv };
  }

  // 3. Explicit PMID / PMCID in PDF front-matter
  const pmcMatch = sample.match(/\b(PMC\d{5,9})\b/i)?.[1];
  if (pmcMatch) return { type: 'pmid', value: pmcMatch.toUpperCase() };
  const pmidMatch = sample.match(/\bPMID\s*:\s*(\d{6,9})\b/i)?.[1];
  if (pmidMatch) return { type: 'pmid', value: pmidMatch };

  return null;
}

async function decompressFirstFlateStreams(
  rawBytes: Uint8Array,
  maxStreams = 3,
): Promise<string> {
  if (typeof DecompressionStream === 'undefined') return '';
  const latin1 = new TextDecoder('latin1').decode(rawBytes);
  const chunks: string[] = [];
  let searchPos = 0;
  let count = 0;

  while (count < maxStreams && searchPos < latin1.length) {
    const streamIdx = latin1.indexOf('stream', searchPos);
    if (streamIdx === -1) break;
    let dataStart = streamIdx + 6;
    if (latin1[dataStart] === '\r' && latin1[dataStart + 1] === '\n') dataStart += 2;
    else if (latin1[dataStart] === '\n' || latin1[dataStart] === '\r') dataStart += 1;
    else {
      searchPos = dataStart;
      continue;
    }

    const endIdx = latin1.indexOf('endstream', dataStart);
    if (endIdx === -1) break;
    searchPos = endIdx + 9;

    let streamEnd = endIdx;
    if (streamEnd > dataStart && latin1[streamEnd - 1] === '\n') streamEnd--;
    if (streamEnd > dataStart && latin1[streamEnd - 1] === '\r') streamEnd--;

    const sliceLen = streamEnd - dataStart;
    if (sliceLen < 8 || sliceLen > 64 * 1024) continue;
    const compressedSlice = rawBytes.subarray(dataStart, streamEnd);
    count++;

    for (const format of ['deflate', 'deflate-raw'] as const) {
      try {
        const ds = new DecompressionStream(format);
        const writer = ds.writable.getWriter();
        void writer.write(compressedSlice as unknown as BufferSource).catch(() => {});
        void writer.close().catch(() => {});
        const text = await new Response(ds.readable).text();
        if (text && text.length > 0) {
          chunks.push(text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ' '));
          break;
        }
      } catch {
        // Ignore non-zlib or truncated stream
      }
    }
  }
  return chunks.join('\n');
}

/**
 * Surgical 128KB PDF Front-Matter, XMP & FlateDecode Stream Sniffer:
 * Inspects the filename (DOI, arXiv, ACL Anthology, BioRxiv/MedRxiv, PMC/PMID, OpenReview)
 * and the first 128 KB + last 64 KB of a PDF file (including browser-native DecompressionStream
 * inflation of compressed LaTeX/pdfTeX page-1 streams) in < 3ms without loading the full PDF into RAM.
 */
export async function sniffPdfEdgeIdentifier(
  file: Pick<File, 'name' | 'size' | 'slice'>,
): Promise<EdgeSniffedIdentifier | null> {
  const filenameWithoutExt = (file.name || '').replace(/\.pdf$/i, '').trim();

  // A. Direct DOI in filename (10.xxxx/yyyy or 10.xxxx_yyyy)
  const fnDoiMatch = filenameWithoutExt.match(
    /10\.\d{4,9}[/_@][-._;()/:A-Za-z0-9]+/,
  )?.[0];
  if (fnDoiMatch) {
    const cleaned = cleanDoi(fnDoiMatch.replace(/^(10\.\d{4,9})[_@]/, '$1/'));
    if (cleaned) return { type: 'doi', value: cleaned };
  }

  // B. ACL Anthology filename pattern (e.g. 2023.acl-long.123.pdf, 2024.emnlp-main.45.pdf, 2023.naacl-main.12.pdf)
  const aclMatch = filenameWithoutExt.match(
    /\b(20\d{2}\.(?:acl|emnlp|naacl|eacl|coling|findings|tacl)-[a-z0-9-]+\.\d+)\b/i,
  )?.[1];
  if (aclMatch) {
    return { type: 'doi', value: `10.18653/v1/${aclMatch}` };
  }

  // C. BioRxiv / MedRxiv filename pattern (e.g. 2023.05.12.540123v1.full.pdf or 2023.05.12.540123.pdf)
  const biorxivMatch = filenameWithoutExt.match(
    /\b(20\d{2}\.\d{2}\.\d{2}\.\d{6,8})(?:v\d+)?(?:\.full)?$/i,
  )?.[1];
  if (biorxivMatch) {
    return { type: 'doi', value: `10.1101/${biorxivMatch}` };
  }

  // D. PubMed Central / PMID filename pattern (e.g. PMC9876543.pdf or pmid_36123456.pdf)
  const fnPmc = filenameWithoutExt.match(/\b(PMC\d{5,9})\b/i)?.[1];
  if (fnPmc) return { type: 'pmid', value: fnPmc.toUpperCase() };
  const fnPmid = filenameWithoutExt.match(/\bpmid[-_:\s]*(\d{6,9})\b/i)?.[1];
  if (fnPmid) return { type: 'pmid', value: fnPmid };

  // E. OpenReview filename pattern (e.g. openreview_id_k9Ps2abc.pdf)
  const fnOpenReview = filenameWithoutExt.match(
    /openreview[-_](?:id[-_])?([A-Za-z0-9_-]{8,14})\b/i,
  )?.[1];
  if (fnOpenReview) {
    return { type: 'url', value: `https://openreview.net/forum?id=${fnOpenReview}` };
  }

  // F. arXiv filename pattern (e.g. 2303.08774v2.pdf)
  const fnArxiv = extractArxivId(filenameWithoutExt);
  if (fnArxiv && (/arxiv/i.test(filenameWithoutExt) || /^\d{4}\.\d{4,5}/.test(fnArxiv))) {
    return { type: 'arxiv', value: fnArxiv };
  }

  if (typeof file.slice !== 'function' || file.size <= 0) return null;
  try {
    const headBytesCount = Math.min(file.size, 128 * 1024);
    const headBlob = file.slice(0, headBytesCount);
    const headBuffer = await headBlob.arrayBuffer();
    const headUint8 = new Uint8Array(headBuffer);
    const headText = new TextDecoder('utf-8', { fatal: false }).decode(headUint8);
    const tailText =
      file.size > 192 * 1024
        ? await file.slice(Math.max(headBytesCount, file.size - 64 * 1024), file.size).text()
        : '';

    const rawFound = extractIdentifierFromPdfSampleText(`${headText}\n${tailText}`);
    if (rawFound) return rawFound;

    // G. Browser-native DecompressionStream fallback for FlateDecode compressed LaTeX/pdfTeX streams
    const decompressedText = await decompressFirstFlateStreams(headUint8, 3);
    if (decompressedText) {
      return extractIdentifierFromPdfSampleText(decompressedText);
    }
  } catch {
    // Ignore binary slice read errors
  }
  return null;
}
