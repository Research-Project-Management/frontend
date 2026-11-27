/**
 * bib-parser.ts
 *
 * Canonical BibTeX `BibEntry` domain model, balanced-brace form parser,
 * and `bibtex-tidy`-powered `.bib` formatter/serializer.
 */

import { tidy } from 'bibtex-tidy';

const BIBTEX_TIDY_OPTIONS = {
  space: 2,
  curly: true,
  align: false,
  blankLines: true,
  trailingCommas: false,
  escape: false,
  lowercase: true,
  removeEmptyFields: true,
  removeDuplicateFields: false,
  encodeUrls: false,
} as const;

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

export interface BibFormEntry {
  id: string;
  type: string;
  key: string;
  fields: Record<string, string>;
}

export interface ParsedBibDocument {
  /** Preserved non-entry blocks (`%` comments, `@string`, `@preamble`, `@comment`) */
  preambleBlocks: string[];
  entries: BibFormEntry[];
}

/**
 * Finds the matching closing delimiter (`}` or `)`) starting from `openIdx`.
 */
function findBibBlockEnd(text: string, openIdx: number): number {
  const openCh = text[openIdx];
  const closeCh = openCh === '(' ? ')' : '}';
  let depth = 0;
  let inQuotes = false;
  for (let i = openIdx; i < text.length; i++) {
    const ch = text[i];
    if (ch === '\\') {
      i++;
      continue;
    }
    if (ch === '"' && depth === 1) {
      inQuotes = !inQuotes;
      continue;
    }
    if (!inQuotes) {
      if (ch === openCh) depth++;
      else if (ch === closeCh) {
        depth--;
        if (depth === 0) return i;
      }
    }
  }
  return -1;
}

/**
 * Parses `field = value` pairs inside a single BibTeX entry body (handling nested braces and quotes).
 */
function extractRawBibFields(body: string): Array<{ name: string; value: string; bare: boolean }> {
  const fields: Array<{ name: string; value: string; bare: boolean }> = [];
  let i = 0;
  const len = body.length;

  while (i < len) {
    while (i < len && /[\s,]/.test(body[i])) i++;
    if (i >= len) break;

    if (body[i] === '%') {
      while (i < len && body[i] !== '\n') i++;
      continue;
    }

    const nameStart = i;
    while (i < len && /[a-zA-Z0-9_-]/.test(body[i])) i++;
    const name = body.slice(nameStart, i).trim().toLowerCase();
    while (i < len && /\s/.test(body[i])) i++;
    if (!name || body[i] !== '=') {
      while (i < len && body[i] !== ',' && body[i] !== '\n') i++;
      continue;
    }
    i++; // skip '='
    while (i < len && /\s/.test(body[i])) i++;
    if (i >= len) break;

    let value = '';
    let bare = false;
    if (body[i] === '{') {
      const end = findBibBlockEnd(body, i);
      if (end === -1) break;
      value = body.slice(i + 1, end).replace(/\s+/g, ' ').trim();
      i = end + 1;
    } else if (body[i] === '"') {
      const start = i + 1;
      i++;
      while (i < len && !(body[i] === '"' && body[i - 1] !== '\\')) i++;
      value = body.slice(start, i).replace(/\s+/g, ' ').trim();
      if (i < len) i++;
    } else {
      const start = i;
      while (i < len && body[i] !== ',' && body[i] !== '\n') i++;
      value = body.slice(start, i).trim();
      bare = true;
    }

    if (name === 'pages' || name === 'page') {
      value = value.replace(/\s*[\u2013\u2014]\s*/g, '--');
    }

    if (value) {
      fields.push({ name, value, bare });
    }
  }
  return fields;
}

/**
 * Parses a `.bib` file into structured `BibFormEntry[]` + preserved preamble/comment blocks
 * using the balanced-brace scanner (single canonical client-side parser).
 */
export function parseBibDocument(raw: string): ParsedBibDocument {
  const preambleBlocks: string[] = [];
  const entries: BibFormEntry[] = [];
  if (!raw || !raw.trim()) return { preambleBlocks, entries };

  let i = 0;
  const len = raw.length;
  let seq = 0;

  while (i < len) {
    while (i < len && /\s/.test(raw[i])) i++;
    if (i >= len) break;

    if (raw[i] === '%') {
      const start = i;
      while (i < len && raw[i] !== '\n') i++;
      preambleBlocks.push(raw.slice(start, i).trimEnd());
      continue;
    }

    if (raw[i] !== '@') {
      const nextAt = raw.indexOf('@', i);
      const chunk = (nextAt === -1 ? raw.slice(i) : raw.slice(i, nextAt)).trim();
      if (chunk) preambleBlocks.push(chunk);
      if (nextAt === -1) break;
      i = nextAt;
      continue;
    }

    const entryStart = i;
    const headerMatch = /^@([a-zA-Z]+)\s*([{(])/.exec(raw.slice(i));
    if (!headerMatch) {
      preambleBlocks.push(raw.slice(i).trim());
      break;
    }

    const type = headerMatch[1].toLowerCase();
    const openIdx = i + headerMatch[0].length - 1;
    const closeIdx = findBibBlockEnd(raw, openIdx);
    if (closeIdx === -1) {
      preambleBlocks.push(raw.slice(entryStart).trim());
      break;
    }

    if (type === 'string' || type === 'preamble' || type === 'comment') {
      preambleBlocks.push(raw.slice(entryStart, closeIdx + 1).trim());
      i = closeIdx + 1;
      continue;
    }

    const inner = raw.slice(openIdx + 1, closeIdx);
    const commaIdx = inner.indexOf(',');
    if (commaIdx === -1) {
      preambleBlocks.push(raw.slice(entryStart, closeIdx + 1).trim());
      i = closeIdx + 1;
      continue;
    }

    const key = inner.slice(0, commaIdx).trim();
    const body = inner.slice(commaIdx + 1);
    const rawFields = extractRawBibFields(body);
    const fields: Record<string, string> = {};
    for (const f of rawFields) {
      fields[f.name] = f.value;
    }

    entries.push({
      id: `bib-${seq++}-${key || 'entry'}`,
      type,
      key,
      fields,
    });
    i = closeIdx + 1;
  }

  return { preambleBlocks, entries };
}

/**
 * Serializes a `ParsedBibDocument` back into clean, `bibtex-tidy`-standardized BibTeX source.
 */
export function serializeBibDocument(doc: ParsedBibDocument): string {
  const blocks: string[] = [...doc.preambleBlocks.filter((b) => b.trim().length > 0)];

  for (const entry of doc.entries) {
    const cleanType = (entry.type || 'article').trim().toLowerCase() || 'article';
    const cleanKey = (entry.key || 'untitled').trim() || 'untitled';
    const fieldLines: string[] = [];

    for (const [k, rawVal] of Object.entries(entry.fields)) {
      const name = k.trim().toLowerCase();
      let val = (rawVal ?? '').replace(/\s+/g, ' ').trim();
      if (!name || !val) continue;
      if (name === 'pages' || name === 'page') {
        val = val.replace(/\s*[\u2013\u2014]\s*/g, '--');
      }
      fieldLines.push(`  ${name} = {${val}}`);
    }

    const lines = [`@${cleanType}{${cleanKey},`];
    for (let idx = 0; idx < fieldLines.length; idx++) {
      const suffix = idx < fieldLines.length - 1 ? ',' : '';
      lines.push(`${fieldLines[idx]}${suffix}`);
    }
    lines.push('}');
    blocks.push(lines.join('\n'));
  }

  const raw = blocks.length > 0 ? `${blocks.join('\n\n')}\n` : '';
  return raw ? formatBibtexContent(raw) : '';
}

/**
 * Formats a `.bib` document using the standard `bibtex-tidy` library.
 * Safely falls back to the original input if the buffer has incomplete syntax while typing.
 */
export function formatBibtexContent(raw: string): string {
  if (!raw || !raw.trim()) return raw;
  try {
    const normalizedDashes = raw.replace(
      /(pages?\s*=\s*[{"])([^}"]*?)([}"])/gi,
      (_m, pre: string, body: string, post: string) =>
        `${pre}${body.replace(/\s*[\u2013\u2014]\s*/g, '--')}${post}`,
    );
    return tidy(normalizedDashes, BIBTEX_TIDY_OPTIONS).bibtex;
  } catch {
    return raw;
  }
}

/**
 * Parses `.bib` content into `BibEntry[]` for client-side autocomplete & index hydration.
 */
export function parseBibContent(content: string, sourceFile = ''): BibEntry[] {
  if (!content) return [];
  const { entries: formEntries } = parseBibDocument(content);

  return formEntries
    .filter((e) => Boolean(e.key))
    .map((e) => {
      const f = e.fields;
      const authorStr = f.author;
      const authors = authorStr
        ? authorStr
            .split(/\s+and\s+/i)
            .map((a) => a.replace(/[{}]/g, '').trim())
            .filter(Boolean)
        : undefined;
      const year = f.year ? (f.year.match(/\b(\d{4})\b/)?.[1] ?? f.year) : undefined;
      const entry: BibEntry = {
        key: e.key,
        type: e.type,
        source: 'bib',
        sourceFile,
        raw: serializeBibDocument({ preambleBlocks: [], entries: [e] }).trim(),
        ...(f.title ? { title: f.title } : {}),
        ...(authorStr ? { author: authorStr, authors } : {}),
        ...(year ? { year } : {}),
        ...(f.journal ? { journal: f.journal } : f.booktitle ? { journal: f.booktitle } : {}),
        ...(f.booktitle ? { booktitle: f.booktitle } : {}),
        ...(f.doi ? { doi: f.doi } : {}),
        ...(f.volume ? { volume: f.volume } : {}),
        ...(f.number || f.issue ? { number: f.number || f.issue } : {}),
        ...(f.pages ? { pages: f.pages } : {}),
        ...(f.publisher ? { publisher: f.publisher } : {}),
        ...(f.url ? { url: f.url } : {}),
        ...(f.abstract ? { abstract: f.abstract.slice(0, 5000) } : {}),
      };
      return entry;
    });
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
