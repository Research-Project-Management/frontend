/**
 * Pure Domain Presentation Helpers: Identifiers (DOI, arXiv, PMID, ISBN)
 * 100% Pure TypeScript - 0% React, 0% DOM dependencies
 *
 * NOTE: Academic title capitalization, NLP normalization, and metadata cleaning
 * are strictly executed on the backend server pipeline (Single Source of Truth).
 */

export function trimUnmatchedClosingBrackets(str: string): string {
  let s = str;
  const pairs: Array<[string, string]> = [[')', '('], [']', '['], ['}', '{'], ['>', '<']];
  for (const [closeChar, openChar] of pairs) {
    while (
      s.endsWith(closeChar) &&
      (s.match(new RegExp(`\\${closeChar}`, 'g')) || []).length >
      (s.match(new RegExp(`\\${openChar}`, 'g')) || []).length
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
  let clean = doi.trim();

  // Nature article URL: nature.com/articles/<slug>
  const natureMatch = clean.match(
    /^https?:\/\/(?:www\.)?nature\.com\/articles\/([a-z0-9._-]+)(?:[?#].*)?$/i,
  );
  if (natureMatch && natureMatch[1]) return `10.1038/${natureMatch[1]}`;

  // Zenodo record URL: zenodo.org/records/<id>
  const zenodoMatch = clean.match(
    /^https?:\/\/zenodo\.org\/records?\/(\d+)(?:[?#].*)?$/i,
  );
  if (zenodoMatch && zenodoMatch[1]) return `10.5281/zenodo.${zenodoMatch[1]}`;

  // BioRxiv / MedRxiv preprint URL
  const biorxivMatch = clean.match(
    /^https?:\/\/(?:www\.)?(?:biorxiv|medrxiv)\.org\/content\/(10\.\d{4,9}\/[^?#\s]+?)(?:v\d+)?(?:\.full|\.abstract|\.pdf)?(?:[?#].*)?$/i,
  );
  if (biorxivMatch && biorxivMatch[1]) return biorxivMatch[1].replace(/v\d+$/, '');

  // PLOS article URL
  const plosMatch = clean.match(
    /^https?:\/\/journals\.plos\.org\/[^/]+\/article\?(?:[^#]*&)?id=(10\.\d{4,9}\/[^&#\s]+)/i,
  );
  if (plosMatch && plosMatch[1]) return decodeURIComponent(plosMatch[1]);

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
    .trim();

  // Strip trailing punctuation
  clean = clean.replace(/[.,;:\s]+$/, '');
  clean = trimUnmatchedClosingBrackets(clean);

  // Canonical DOI format: starts with 10.NNNN/
  const doiRegex = /\b(10\.\d{4,9}\/[-._;()/:A-Za-z0-9<>+=[\]~]+)/;
  const match = clean.match(doiRegex);
  if (match) {
    let extracted = match[1].replace(/[.,;:\s]+$/, '');
    extracted = trimUnmatchedClosingBrackets(extracted);
    return extracted;
  }

  return clean.startsWith('10.') ? clean : '';
}

export function isValidDoi(doi?: string | null): boolean {
  const cleaned = cleanDoi(doi);
  return Boolean(cleaned && /^10\.\d{4,9}\/.+/.test(cleaned));
}

/**
 * Extracts canonical arXiv ID from text, DOI or URL (e.g. "1706.03762" or "2305.18290v1")
 */
export function extractArxivId(input?: string | null): string | null {
  if (!input || typeof input !== 'string') return null;
  const clean = input.trim();

  const match =
    clean.match(/arxiv\.org\/(?:abs|pdf)\/(\d{4}\.\d{4,5}(?:v\d+)?)/i) ||
    clean.match(/arxiv\.(\d{4}\.\d{4,5}(?:v\d+)?)/i) ||
    clean.match(/\b(\d{4}\.\d{4,5}(?:v\d+)?)\b/);

  return match ? match[1] : null;
}

export function getArxivPdfUrl(arxivId?: string | null): string {
  const id = extractArxivId(arxivId);
  return id ? `https://arxiv.org/pdf/${id}.pdf` : '';
}
