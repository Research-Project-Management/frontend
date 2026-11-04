/**
 * bib-parser.ts
 *
 * Canonical BibTeX `BibEntry` domain model and lightweight fallback parser (Domain Layer).
 * Authoritative `.bib` parsing and validation are performed by the backend `BibtexParser`
 * (`/citations` & `/structure/symbols`).
 */

export interface BibEntry {
  key: string;
  type: string;
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

export interface BibParseResult {
  entries: BibEntry[];
}

export function parseBibFields(body: string, entry: BibEntry): void {
  const fieldRegex = /\b(title|author|year|journal|booktitle|doi|volume|number|issue|pages|publisher|url|abstract)\s*=\s*(?:\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}|"([^"]*)"|([^,\s}\n]+))/gi;
  let match: RegExpExecArray | null;
  while ((match = fieldRegex.exec(body)) !== null) {
    const field = match[1].toLowerCase();
    const val = (match[2] ?? match[3] ?? match[4] ?? '').replace(/\s+/g, ' ').trim();
    if (!val) continue;
    if (field === 'title') entry.title = val;
    else if (field === 'author') {
      entry.author = val;
      entry.authors = val.split(/\s+and\s+/i).map((a) => a.replace(/[{}]/g, '').trim()).filter(Boolean);
    } else if (field === 'year') entry.year = val.match(/\b(\d{4})\b/)?.[1] ?? val;
    else if (field === 'journal') entry.journal = val;
    else if (field === 'booktitle') {
      entry.booktitle = val;
      if (!entry.journal) entry.journal = val;
    } else if (field === 'doi') entry.doi = val;
    else if (field === 'volume') entry.volume = val;
    else if (field === 'number' || field === 'issue') entry.number = val;
    else if (field === 'pages') entry.pages = val;
    else if (field === 'publisher') entry.publisher = val;
    else if (field === 'url') entry.url = val;
    else if (field === 'abstract') entry.abstract = val.slice(0, 5000);
  }
}

export function parseBibContent(content: string, sourceFile = ''): BibEntry[] {
  if (!content) return [];
  const entries: BibEntry[] = [];
  const entryRegex = /@([a-zA-Z]+)\s*[{(]\s*([^,\s]+)\s*,([\s\S]*?)(?=\n\s*@[a-zA-Z]+\s*[{(]|$)/g;
  let match: RegExpExecArray | null;
  while ((match = entryRegex.exec(content)) !== null) {
    const type = match[1].toLowerCase();
    if (type === 'string' || type === 'preamble' || type === 'comment') continue;
    const key = match[2].trim();
    if (!key) continue;
    const entry: BibEntry = { key, type, source: 'bib', sourceFile, raw: match[0].trim() };
    parseBibFields(match[3] || '', entry);
    entries.push(entry);
  }
  return entries;
}

export function parseMultipleBibContents(bibFiles: { filename: string; content: string }[]): BibEntry[] {
  const seen = new Set<string>();
  const result: BibEntry[] = [];
  for (const { filename, content } of bibFiles) {
    for (const entry of parseBibContent(content, filename)) {
      if (!seen.has(entry.key)) {
        seen.add(entry.key);
        result.push(entry);
      }
    }
  }
  return result;
}
