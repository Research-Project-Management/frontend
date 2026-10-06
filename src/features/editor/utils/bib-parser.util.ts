/**
 * bib-parser.util.ts
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

/**
 * Parse BibTeX content and extract all entries.
 * Supports standard @article{key, ...}, @book{key, ...}, etc.
 */
export function parseBibContent(content: string): BibEntry[] {
  const entries: BibEntry[] = [];
  // Match @type{key, ...} blocks
  const entryRegex = /@(\w+)\s*\{\s*([^,\s]+)\s*,([^@]*)(?=@|$)/gs;
  let match: RegExpExecArray | null;

  while ((match = entryRegex.exec(content)) !== null) {
    const rawMatch = match[0];
    const type = match[1].toLowerCase();
    const key = match[2].trim();
    const body = match[3];

    if (!key || type === 'string' || type === 'preamble' || type === 'comment') {
      continue;
    }

    const entry: BibEntry = { key, type, source: 'bib', raw: rawMatch.trim() };

    // Extract field values
    const fieldRegex = /(\w+)\s*=\s*(?:\{([^{}]*)\}|"([^"]*)"|([\d]+))/gs;
    let fieldMatch: RegExpExecArray | null;

    while ((fieldMatch = fieldRegex.exec(body)) !== null) {
      const fieldName = fieldMatch[1].toLowerCase();
      const value = (fieldMatch[2] ?? fieldMatch[3] ?? fieldMatch[4] ?? '').trim();

      switch (fieldName) {
        case 'title':
          entry.title = value;
          break;
        case 'author':
          // Split authors: "Last, First and Last2, First2"
          entry.authors = value
            .split(/\s+and\s+/i)
            .map((a) => a.trim())
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
