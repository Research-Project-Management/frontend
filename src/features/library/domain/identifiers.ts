/**
 * Pure Domain Presentation Helpers: Identifiers (DOI, arXiv, PMID, ISBN)
 *
 * NOTE: Academic title capitalization, NLP normalization, and metadata cleaning
 * are strictly executed on the backend server pipeline (Single Source of Truth).
 */

import { stripLatexMarkup } from './metadata';

const BRACKET_PAIRS: ReadonlyArray<readonly [string, number, number]> = [
  [')', 41, 40], // ')' and '('
  [']', 93, 91], // ']' and '['
  ['}', 125, 123], // '}' and '{'
  ['>', 62, 60], // '>' and '<'
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

export function trimUnmatchedClosingBrackets(str: string): string {
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

  // Decode percent-encoded DOI characters (e.g. %28SICI%29, %2F, %3A, %3C, %3E, %3B)
  if (/%[0-9A-Fa-f]{2}/.test(clean)) {
    try {
      clean = decodeURIComponent(clean);
    } catch {
      // ignore malformed URI sequence
    }
  }

  // Strip trailing sentence punctuation and unmatched closing brackets repeatedly
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

  // Nature article URL: nature.com/articles/<slug>
  const natureMatch = clean.match(
    /^https?:\/\/(?:www\.)?nature\.com\/articles\/([a-z0-9._-]+)(?:[?#].*)?$/i,
  );
  if (natureMatch && natureMatch[1]) return `10.1038/${ stripTrailingJunk(natureMatch[1])}`;

  // Zenodo record URL: zenodo.org/records/<id>
  const zenodoMatch = clean.match(
    /^https?:\/\/zenodo\.org\/records?\/(\d+)(?:[?#].*)?$/i,
  );
  if (zenodoMatch && zenodoMatch[1]) return `10.5281/zenodo.${zenodoMatch[1]}`;

  // BioRxiv / MedRxiv preprint URL
  const biorxivMatch = clean.match(
    /^https?:\/\/(?:www\.)?(?:biorxiv|medrxiv)\.org\/content\/(10\.\d{4,9}\/[^?#\s]+?)(?:v\d+)?(?:\.full|\.abstract|\.pdf)?(?:[?#].*)?$/i,
  );
  if (biorxivMatch && biorxivMatch[1]) return stripTrailingJunk(biorxivMatch[1].replace(/v\d+$/, ''));

  // PLOS article URL
  const plosMatch = clean.match(
    /^https?:\/\/journals\.plos\.org\/[^/]+\/article\?(?:[^#]*&)?id=(10\.\d{4,9}\/[^&#\s]+)/i,
  );
  if (plosMatch && plosMatch[1]) return stripTrailingJunk(decodeURIComponent(plosMatch[1]));

  // Embedded /doi/ or /article/ in publisher URLs
  const embeddedMatch = clean.match(
    /^https?:\/\/[^/]+(?:\/[^/]+)*\/(?:doi\/|article\/)(?:abs\/|full\/|epdf\/|pdf\/)?(10\.\d{4,9}\/[-._;()/:A-Za-z0-9<>+=[\]~]+)(?:[?#].*)?$/i,
  );
  if (embeddedMatch && embeddedMatch[1]) {
    clean = embeddedMatch[1];
  }

  // Strip standard resolver prefixes (doi.org, dx.doi.org, http, https)
  clean = clean
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '')
    .replace(/^doi:\s*/i, '')
    .replace(/^doi\//i, '')
    .replace(/[?#].*$/, '')
    .trim();

  clean = stripTrailingJunk(clean);

  // Canonical DOI format: starts with 10.NNNN/
  const doiRegex = /\b(10\.\d{4,9}\/[-._;()/:A-Za-z0-9<>+=[\]~]+)/;
  const match = clean.match(doiRegex);
  if (match) {
    return stripTrailingJunk(match[1]);
  }

  return clean.startsWith('10.') ? clean : '';
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
    .replace(/[.,;:\s"')\]>]+$/, '');

  const match =
    clean.match(/arxiv\.org\/(?:abs|pdf|html)\/([a-z-]+\/\d{7}(?:v\d+)?|\d{4}\.\d{4,5}(?:v\d+)?)/i) ||
    clean.match(/10\.48550\/arxiv\.(\d{4}\.\d{4,5}(?:v\d+)?)/i) ||
    clean.match(/arxiv[.:]\s*([a-z-]+\/\d{7}(?:v\d+)?|\d{4}\.\d{4,5}(?:v\d+)?)/i) ||
    clean.match(/\b([a-z]{2,}(?:-[a-z]{2,})?\/\d{7}(?:v\d+)?)\b/i) ||
    clean.match(/\b(\d{4}\.\d{4,5}(?:v\d+)?)\b/);

  return match ? match[1] : null;
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

export type BatchIdentifierType = 'doi' | 'arxiv' | 'pmid' | 'pmcid' | 'isbn' | 'url' | 'bibtex' | 'ris';

export interface ParsedBatchIdentifier {
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

  // Raw BibTeX block
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

  // Raw RIS block
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

  // Normalize prefixes with spaces so they stay attached to their value during tokenization
  // e.g. "PMID: 26017312" -> "PMID:26017312", "arXiv: 1706.03762v5" -> "arXiv:1706.03762v5", "ISBN-13: 978-0-262-03384-8" -> "ISBN:978-0-262-03384-8"
  let normalized = trimmed
    .replace(/\b(pmid|pmcid|arxiv|doi)\s*[:#]\s*/gi, '$1:')
    .replace(/\bisbn(?:-?1[03])?\s*[:#]?\s*((?:97[89][-\s]?)?(?:\d[-\s]?){9}[\dXx])\b/gi, (_, isbnDigits: string) => {
      return `ISBN:${isbnDigits.replace(/\s+/g, '-')}`;
    });

  // Protect semicolons inside SICI DOIs (e.g. 10.1002/(SICI)1097-0258(19980815)17:15<1661::AID-SIM868>3.0.CO;2-2)
  const SICI_SEMI_PLACEHOLDER = '__FLUX_SICI_SEMI__';
  normalized = normalized.replace(
    /(10\.\d{4,9}\/[^\s,;]+);(\d+-\d+[A-Za-z0-9]*)/g,
    `$1${SICI_SEMI_PLACEHOLDER}$2`,
  );

  // Split by newlines, commas, semicolons, or whitespace
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
    // 1. Check arXiv first (including arxiv.org URLs, 10.48550/arXiv..., arXiv:..., or bare NNNN.NNNNN)
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

    // 2. Check PMCID
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

    // 3. Check PMID
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

    // 4. Check ISBN-10 / ISBN-13 before bare numbers
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

    // 5. Check DOI (including doi.org, nature/zenodo/biorxiv/plos URLs, SICI DOIs)
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

    // 6. Check generic HTTP/HTTPS URL
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
 * Normalizes title string by stripping LaTeX markup, collapsing whitespace, and fixing spaced hyphens (e.g. "Large - Scale" -> "Large-Scale").
 */
export function cleanPaperTitle(raw?: string | null): string {
  if (!raw || typeof raw !== 'string') return '';
  let cleaned = stripLatexMarkup(raw.trim());
  cleaned = cleaned.replace(/\s+/g, ' ');
  // Normalize spaced hyphens: e.g. "Large - Scale" -> "Large-Scale", "Auto - Encoding" -> "Auto-Encoding"
  cleaned = cleaned.replace(/(\p{L})\s+-\s+(\p{L})/gu, '$1-$2');
  return cleaned.trim();
}

const TITLE_CASE_STOP_WORDS: ReadonlySet<string> = new Set([
  'a',
  'an',
  'the',
  'and',
  'but',
  'or',
  'for',
  'nor',
  'on',
  'at',
  'to',
  'from',
  'by',
  'with',
  'in',
  'of',
  'over',
  'into',
  'onto',
]);

/**
 * Converts a title to standard academic title case, lowercasing common prepositions/articles
 * except when at the start or end of the title.
 */
export function normalizeAcademicTitleCase(title?: string | null): string {
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
