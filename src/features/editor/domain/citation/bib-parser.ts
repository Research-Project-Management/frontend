/**
 * bib-parser.ts
 *
 * Parses BibTeX content to extract citation entries.
 * Used by the editor to provide \cite{} autocomplete from project .bib files.
 * Follows Overleaf's approach: read local .bib files in project, no external API calls.
 */

export interface BibEntry {
  key: string;
  type: string; // article, book, inproceedings, etc.
  title?: string;
  authors?: string[];
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
  raw?: string;
  collectionId?: string | null;
  collectionIds?: string[];
}

function parseBibFields(body: string, entry: BibEntry): void {
  let i = 0;
  const len = body.length;

  while (i < len) {
    // Skip whitespace and commas
    while (i < len && /[\s,]/.test(body[i])) i++;
    if (i >= len) break;

    // Extract field name
    const nameStart = i;
    while (i < len && /[a-zA-Z0-9_-]/.test(body[i])) i++;
    const fieldName = body.slice(nameStart, i).toLowerCase();
    if (!fieldName) {
      i++;
      continue;
    }

    // Skip whitespace to '='
    while (i < len && /\s/.test(body[i])) i++;
    if (i >= len || body[i] !== '=') {
      continue;
    }
    i++; // Skip '='

    // Skip whitespace to value start
    while (i < len && /\s/.test(body[i])) i++;
    if (i >= len) break;

    let value = '';
    if (body[i] === '{') {
      let depth = 1;
      i++;
      const valStart = i;
      while (i < len && depth > 0) {
        if (body[i] === '{') depth++;
        else if (body[i] === '}') depth--;
        i++;
      }
      value = body.slice(valStart, depth === 0 ? i - 1 : i);
    } else if (body[i] === '"') {
      i++;
      const valStart = i;
      while (i < len) {
        if (body[i] === '"' && body[i - 1] !== '\\') {
          i++;
          break;
        }
        i++;
      }
      value = body.slice(valStart, i > valStart ? i - 1 : i);
    } else {
      const valStart = i;
      while (i < len && body[i] !== ',' && body[i] !== '}' && body[i] !== ')') {
        i++;
      }
      value = body.slice(valStart, i).trim();
    }

    value = value.trim();

    switch (fieldName) {
      case 'title':
        entry.title = value;
        break;
      case 'author':
        entry.authors = value
          .split(/\s+and\s+/i)
          .map((a) => a.replace(/[{}]/g, '').trim())
          .filter(Boolean);
        break;
      case 'year':
        entry.year = value;
        break;
      case 'journal':
        entry.journal = value;
        break;
      case 'booktitle':
        entry.booktitle = value;
        break;
      case 'doi':
        entry.doi = value;
        break;
      case 'volume':
        entry.volume = value;
        break;
      case 'number':
      case 'issue':
        entry.number = value;
        break;
      case 'pages':
        entry.pages = value;
        break;
      case 'publisher':
        entry.publisher = value;
        break;
      case 'url':
        entry.url = value;
        break;
      case 'abstract':
        entry.abstract = value.slice(0, 5000);
        break;
    }
  }
}

/**
 * Parse BibTeX content and extract all entries.
 * Supports standard @article{key, ...}, @book{key, ...}, nested braces, and email addresses.
 */
export function parseBibContent(content: string): BibEntry[] {
  if (!content) return [];
  const entries: BibEntry[] = [];
  const len = content.length;
  let pos = 0;

  while (pos < len) {
    const atIdx = content.indexOf('@', pos);
    if (atIdx === -1) break;

    let typeStart = atIdx + 1;
    while (typeStart < len && /\s/.test(content[typeStart])) typeStart++;
    let typeEnd = typeStart;
    while (typeEnd < len && /[a-zA-Z0-9_-]/.test(content[typeEnd])) typeEnd++;

    const type = content.slice(typeStart, typeEnd).toLowerCase();
    if (!type) {
      pos = atIdx + 1;
      continue;
    }

    let openBraceIdx = typeEnd;
    while (openBraceIdx < len && /\s/.test(content[openBraceIdx])) openBraceIdx++;
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
    if (!citationKey) continue;

    const entry: BibEntry = {
      key: citationKey,
      type,
      source: 'bib',
      raw: rawBlock.trim(),
    };

    const fieldsBody = inner.slice(firstComma + 1);
    parseBibFields(fieldsBody, entry);

    entries.push(entry);
  }

  return entries;
}

/**
 * Parse multiple BibTeX file contents into a flat list of entries.
 */
export function parseMultipleBibContents(bibFiles: { filename: string; content: string }[]): BibEntry[] {
  const allEntries: BibEntry[] = [];
  const seenKeys = new Set<string>();

  for (const { content } of bibFiles) {
    const entries = parseBibContent(content);
    for (const entry of entries) {
      if (!seenKeys.has(entry.key)) {
        seenKeys.add(entry.key);
        allEntries.push(entry);
      }
    }
  }

  return allEntries;
}
