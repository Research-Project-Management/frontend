/**
 * bib-parser.ts
 *
 * Canonical BibTeX parser and `BibEntry` domain model (Domain Layer).
 * Location: `features/editor/domain/latex/bib-parser.ts`
 *
 * Responsibilities:
 * - Balanced-brace and quote-aware parsing of BibTeX entries (@article, @book, @inproceedings, etc.).
 * - Handles nested braces (e.g. {PASCAL}, {\L}ukasz), escaped quotes, and @ in URLs/emails.
 * - Zero UI or DOM dependencies; shared by Web Worker symbol indexer (`latex-symbols-core.ts`)
 *   and Citation subsystem (`subsystems/citation/model/bib-parser.ts`).
 */

export interface BibEntry {
  key: string;
  type: string; // 'article' | 'book' | 'inproceedings' | ...
  title?: string;
  authors?: string[];
  author?: string;
  year?: string;
  journal?: string;
  booktitle?: string;
  doi?: string;
  abstract?: string;
  volume?: string;
  number?: string;
  pages?: string;
  publisher?: string;
  url?: string;
  source?: 'bib' | 'library' | 'server';
  sourceFile: string;
  raw?: string;
  rawText?: string;
  collectionId?: string | null;
  collectionIds?: string[];
  isRetracted?: boolean;
  retractionReason?: string;
  retractionNature?: string;
  retractionNoticeUrl?: string;
}

const AUTHOR_SPLIT_REGEX = /\s+and\s+/i;
const BRACES_STRIP_REGEX = /[{}]/g;

function isBibWhitespace(code: number): boolean {
  return code === 32 || code === 9 || code === 10 || code === 13;
}

function isBibWhitespaceOrComma(code: number): boolean {
  return code === 44 || code === 32 || code === 9 || code === 10 || code === 13;
}

function isBibIdentChar(code: number): boolean {
  return (
    (code >= 97 && code <= 122) || // a-z
    (code >= 65 && code <= 90) || // A-Z
    (code >= 48 && code <= 57) || // 0-9
    code === 95 || // _
    code === 45 // -
  );
}

export function parseBibFields(body: string, entry: BibEntry): void {
  let i = 0;
  const len = body.length;

  while (i < len) {
    // Skip whitespace and commas
    while (i < len && isBibWhitespaceOrComma(body.charCodeAt(i))) i++;
    if (i >= len) break;

    // Extract field name
    const nameStart = i;
    while (i < len && isBibIdentChar(body.charCodeAt(i))) i++;
    const fieldName = body.slice(nameStart, i).toLowerCase();
    if (!fieldName) {
      i++;
      continue;
    }

    // Skip whitespace to '='
    while (i < len && isBibWhitespace(body.charCodeAt(i))) i++;
    if (i >= len || body.charCodeAt(i) !== 61 /* '=' */) {
      continue;
    }
    i++; // Skip '='

    // Skip whitespace to value start
    while (i < len && isBibWhitespace(body.charCodeAt(i))) i++;
    if (i >= len) break;

    let value = '';
    const firstCode = body.charCodeAt(i);
    if (firstCode === 123 /* '{' */) {
      let depth = 1;
      i++;
      const valStart = i;
      while (i < len && depth > 0) {
        const c = body.charCodeAt(i);
        if (c === 123) depth++;
        else if (c === 125) depth--;
        i++;
      }
      value = body.slice(valStart, depth === 0 ? i - 1 : i);
    } else if (firstCode === 34 /* '"' */) {
      i++;
      const valStart = i;
      while (i < len) {
        if (body.charCodeAt(i) === 34 && body.charCodeAt(i - 1) !== 92 /* '\\' */) {
          i++;
          break;
        }
        i++;
      }
      value = body.slice(valStart, i > valStart ? i - 1 : i);
    } else {
      const valStart = i;
      while (i < len) {
        const c = body.charCodeAt(i);
        if (c === 44 /* ',' */ || c === 125 /* '}' */ || c === 41 /* ')' */) break;
        i++;
      }
      value = body.slice(valStart, i).trim();
    }

    const cleaned = value.replace(/\s+/g, ' ').trim();
    if (!cleaned) continue;

    switch (fieldName) {
      case 'title':
        entry.title = cleaned;
        break;
      case 'author':
        entry.author = cleaned;
        entry.authors = cleaned
          .split(AUTHOR_SPLIT_REGEX)
          .map((a) => a.replace(BRACES_STRIP_REGEX, '').trim())
          .filter(Boolean);
        break;
      case 'year': {
        const ym = cleaned.match(/\b(\d{4})\b/);
        entry.year = ym ? ym[1] : cleaned;
        break;
      }
      case 'journal':
        entry.journal = cleaned;
        break;
      case 'booktitle':
        entry.booktitle = cleaned;
        if (!entry.journal) entry.journal = cleaned;
        break;
      case 'doi':
        entry.doi = cleaned;
        break;
      case 'volume':
        entry.volume = cleaned;
        break;
      case 'number':
      case 'issue':
        entry.number = cleaned;
        break;
      case 'pages':
        entry.pages = cleaned;
        break;
      case 'publisher':
        entry.publisher = cleaned;
        break;
      case 'url':
        entry.url = cleaned;
        break;
      case 'abstract':
        entry.abstract = cleaned.slice(0, 5000);
        break;
    }
  }
}

/**
 * Parse BibTeX content and extract all entries.
 * Supports standard @article{key, ...}, @book{key, ...}, nested braces, and email addresses.
 */
export function parseBibContent(content: string, sourceFile = ''): BibEntry[] {
  if (!content) return [];
  const entries: BibEntry[] = [];
  const len = content.length;
  let pos = 0;

  while (pos < len) {
    const atIdx = content.indexOf('@', pos);
    if (atIdx === -1) break;

    let typeStart = atIdx + 1;
    while (typeStart < len && isBibWhitespace(content.charCodeAt(typeStart))) typeStart++;
    let typeEnd = typeStart;
    while (typeEnd < len && isBibIdentChar(content.charCodeAt(typeEnd))) typeEnd++;

    const type = content.slice(typeStart, typeEnd).toLowerCase();
    if (!type) {
      pos = atIdx + 1;
      continue;
    }

    let openBraceIdx = typeEnd;
    while (openBraceIdx < len && isBibWhitespace(content.charCodeAt(openBraceIdx))) openBraceIdx++;
    if (openBraceIdx >= len || (content[openBraceIdx] !== '{' && content[openBraceIdx] !== '(')) {
      pos = typeEnd;
      continue;
    }

    const openChar = content[openBraceIdx];
    const closeChar = openChar === '{' ? '}' : ')';

    let depth = 1;
    let scanPos = openBraceIdx + 1;
    let inQuote = false;

    while (scanPos < len && depth > 0) {
      const ch = content[scanPos];
      if (ch === '"' && content[scanPos - 1] !== '\\') {
        inQuote = !inQuote;
      } else if (!inQuote) {
        if (ch === openChar) depth++;
        else if (ch === closeChar) depth--;
      }
      scanPos++;
    }

    const rawBlock = content.slice(atIdx, scanPos);
    pos = scanPos;

    if (type === 'string' || type === 'preamble' || type === 'comment') {
      continue;
    }

    const inner = content.slice(openBraceIdx + 1, scanPos > openBraceIdx + 1 ? scanPos - 1 : openBraceIdx + 1);
    const firstComma = inner.indexOf(',');
    if (firstComma === -1) continue;

    const citationKey = inner.slice(0, firstComma).trim();
    if (!citationKey || /\s/.test(citationKey)) continue;

    const entry: BibEntry = {
      key: citationKey,
      type,
      source: 'bib',
      sourceFile,
      raw: rawBlock.trim(),
    };

    const fieldsBody = inner.slice(firstComma + 1);
    parseBibFields(fieldsBody, entry);

    entries.push(entry);
  }

  return entries;
}

/**
 * Parse multiple BibTeX file contents into a flat deduplicated list of entries.
 */
export function parseMultipleBibContents(bibFiles: { filename: string; content: string }[]): BibEntry[] {
  const allEntries: BibEntry[] = [];
  const seenKeys = new Set<string>();

  for (const { filename, content } of bibFiles) {
    const entries = parseBibContent(content, filename);
    for (const entry of entries) {
      if (!seenKeys.has(entry.key)) {
        seenKeys.add(entry.key);
        allEntries.push(entry);
      }
    }
  }

  return allEntries;
}
