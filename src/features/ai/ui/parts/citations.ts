import type { SourceItem } from '../../types/message';

export interface GroupedExcerpt {
  page?: number;
  snippet: string;
}

export interface GroupedRagSource {
  key: string;
  label: string;
  pages: number[];
  excerpts: GroupedExcerpt[];
}

export interface CitationLookup {
  byIndex: Map<number, SourceItem>;
  isMultiDocument: boolean;
}

export const CITATION_HREF_PREFIX = '#flux-cite-';

const TRAILING_OPEN_TAG_RE = /<[a-zA-Z/][^>]*$/;
const BR_TAG_RE = /<br\s*\/?>/gi;
const INLINE_HTML_RE = /<\/?(?:b|i|em|strong|sup|sub|span|p|div|code)\b[^>]*>/gi;
const TABLE_SEP_RE = /^\s*\|?(?:\s*:?-{2,}:?\s*\|)+\s*(?::?-{2,}:?\s*\|?)?\s*$/;
const COL_PLACEHOLDER_RE = /^col\d+$/i;
const HEADING_PREFIX_RE = /^#{1,6}\s+/;
const MULTI_SPACE_RE = /[ \t]{2,}/g;
const SOURCE_PAGE_SUFFIX_RE = /\s*\(p\.\s*(\d+)\)\s*$/i;
const DOC_EXT_RE = /\.(pdf|docx?|txt|md|tex|csv|xlsx?)$/i;

const CANONICAL_CITE_GLOBAL_RE = /\[\[cite:\s*(\d+(?:\s*,\s*\d+)*)\s*\]\]/gi;
const CANONICAL_CITE_DETECT_RE = /\[\[cite:/i;
const TRAILING_PARTIAL_CITE_RE = /\[\[(?:c(?:i(?:t(?:e(?::[\d,\s]*)?)?)?)?)?$/i;
const LEGACY_BRACKET_CITE_RE = /(?<!\[)\[(\d+)\](?!\()/g;
const PROTECTED_MARKDOWN_RE =
  /(```[\s\S]*?(?:```|$)|~~~[\s\S]*?(?:~~~|$)|`[^`\n]+`|\$\$[\s\S]*?\$\$|\$(?!\s)(?:\\.|[^$\n\\])+?(?<!\s)\$|\[[^\]]+\]\([^)]+\))/g;
const CONSECUTIVE_CITE_CHAIN_RE =
  /\[\d+\]\(#flux-cite-\d+\)(?:(?:\s*,\s*|\s*)\[\d+\]\(#flux-cite-\d+\))+/g;
const SINGLE_CITE_LINK_RE = /\[(\d+)\]\(#flux-cite-\1\)/g;

export function cleanSourceSnippet(raw: string): string {
  let text = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!text) return '';

  text = text.replace(TRAILING_OPEN_TAG_RE, '');
  text = text.replace(BR_TAG_RE, '; ');
  text = text.replace(INLINE_HTML_RE, '');

  const cleanedLines: string[] = [];
  for (const rawLine of text.split('\n')) {
    const stripped = rawLine.trim();
    if (!stripped || TABLE_SEP_RE.test(stripped)) continue;

    if (
      stripped.includes('|') &&
      (stripped.startsWith('|') || stripped.endsWith('|'))
    ) {
      const cells: string[] = [];
      for (const cell of stripped.split('|')) {
        const normalizedCell = cell.trim().replace(MULTI_SPACE_RE, ' ');
        if (!normalizedCell || COL_PLACEHOLDER_RE.test(normalizedCell)) {
          continue;
        }
        if (cells.length > 0 && cells[cells.length - 1] === normalizedCell) {
          continue;
        }
        cells.push(normalizedCell);
      }
      if (cells.length > 0) {
        cleanedLines.push(cells.join(' · '));
      }
      continue;
    }

    const noHeading = stripped.replace(HEADING_PREFIX_RE, '');
    const normalizedLine = noHeading.replace(MULTI_SPACE_RE, ' ').trim();
    if (normalizedLine) {
      cleanedLines.push(normalizedLine);
    }
  }

  return cleanedLines.join('\n').trim();
}

export function extractSourceDocumentLabel(source: SourceItem): string {
  const rawTitle = (source.title || '').trim();
  if (rawTitle) return rawTitle;
  const rawSource = (source.source || '')
    .trim()
    .replace(SOURCE_PAGE_SUFFIX_RE, '')
    .trim();
  return rawSource || source.url?.trim() || 'Source';
}

export function extractSourcePage(source: SourceItem): number | undefined {
  if (typeof source.page === 'number' && Number.isFinite(source.page)) {
    return source.page;
  }
  const rawSource = (source.source || '').trim();
  if (!rawSource) return undefined;
  const match = rawSource.match(SOURCE_PAGE_SUFFIX_RE);
  return match ? Number(match[1]) : undefined;
}

export function groupRagSources(
  ragSources: readonly SourceItem[],
): GroupedRagSource[] {
  const groups = new Map<
    string,
    {
      key: string;
      label: string;
      pageSet: Set<number>;
      excerptSeen: Set<string>;
      excerpts: GroupedExcerpt[];
    }
  >();

  for (const s of ragSources) {
    const rawTitle = (s.title || '').trim();
    const rawSource = (s.source || '').trim();
    const strippedSource = rawSource.replace(SOURCE_PAGE_SUFFIX_RE, '').trim();
    const label = rawTitle || strippedSource || 'Source';
    const key = label.toLowerCase();
    const page = extractSourcePage(s);

    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        label,
        pageSet: new Set<number>(),
        excerptSeen: new Set<string>(),
        excerpts: [],
      };
      groups.set(key, group);
    }

    if (page !== undefined) {
      group.pageSet.add(page);
    }

    const cleanedSnippet = s.snippet ? cleanSourceSnippet(s.snippet) : '';
    if (cleanedSnippet) {
      const dedupeKey = `${page ?? ''}::${cleanedSnippet}`;
      if (!group.excerptSeen.has(dedupeKey)) {
        group.excerptSeen.add(dedupeKey);
        group.excerpts.push({ page, snippet: cleanedSnippet });
      }
    }
  }

  return Array.from(groups.values()).map((g) => {
    const pages = Array.from(g.pageSet).sort((a, b) => a - b);
    const excerpts = [...g.excerpts].sort((a, b) => {
      if (a.page !== undefined && b.page !== undefined) return a.page - b.page;
      if (a.page !== undefined) return -1;
      if (b.page !== undefined) return 1;
      return 0;
    });
    return { key: g.key, label: g.label, pages, excerpts };
  });
}

export function parseCitationHref(href?: string): number | null {
  if (!href || !href.startsWith(CITATION_HREF_PREFIX)) return null;
  const suffix = href.slice(CITATION_HREF_PREFIX.length);
  if (!/^\d+$/.test(suffix)) return null;
  const parsed = Number(suffix);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function getDistinctDocKey(source: SourceItem): string {
  const url = source.url?.trim();
  if (url) {
    try {
      const u = new URL(url);
      return `${u.origin}${u.pathname}`.toLowerCase();
    } catch {
      return url.toLowerCase();
    }
  }
  return extractSourceDocumentLabel(source).toLowerCase();
}

function isMultiDocumentCollection(sources: Iterable<SourceItem>): boolean {
  const distinctDocs = new Set<string>();
  for (const s of sources) {
    distinctDocs.add(getDistinctDocKey(s));
  }
  return distinctDocs.size > 1;
}

export function buildCitationLookup(
  sources?: readonly SourceItem[],
): CitationLookup {
  const byIndex = new Map<number, SourceItem>();
  if (!sources || sources.length === 0) {
    return { byIndex, isMultiDocument: false };
  }

  const hasExplicitIndex = sources.some(
    (s) =>
      typeof s.index === 'number' && Number.isInteger(s.index) && s.index > 0,
  );

  sources.forEach((s, idx) => {
    if (hasExplicitIndex) {
      if (
        typeof s.index === 'number' &&
        Number.isInteger(s.index) &&
        s.index > 0 &&
        !byIndex.has(s.index)
      ) {
        byIndex.set(s.index, s);
      }
    } else {
      byIndex.set(idx + 1, s);
    }
  });

  return {
    byIndex,
    isMultiDocument: isMultiDocumentCollection(sources),
  };
}

function truncateLabel(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return `${text.slice(0, Math.max(1, maxLen - 1)).trimEnd()}…`;
}

export function formatInlineCitationLabel(
  source: SourceItem,
  opts: { isMultiDocument: boolean; fallbackIndex: number },
): string {
  const url = source.url?.trim();
  if (url) {
    try {
      const host = new URL(url).hostname.replace(/^www\./i, '');
      if (host) return truncateLabel(host, 24);
    } catch {
      // fall through to label truncation
    }
    return truncateLabel(source.title?.trim() || url, 22);
  }

  const page = extractSourcePage(source);
  const cleanedDocName = extractSourceDocumentLabel(source)
    .replace(DOC_EXT_RE, '')
    .replace(/_/g, ' ')
    .replace(MULTI_SPACE_RE, ' ')
    .trim();
  const shortName = truncateLabel(cleanedDocName || 'Source', 18);

  if (!opts.isMultiDocument && page !== undefined) {
    return `p. ${page}`;
  }
  if (opts.isMultiDocument && page !== undefined) {
    return `${shortName} · p. ${page}`;
  }
  if (opts.isMultiDocument) {
    return shortName;
  }
  return `${opts.fallbackIndex}`;
}

export function preprocessCitationMarkdown(
  text: string,
  opts: { byIndex: ReadonlyMap<number, SourceItem>; isStreaming: boolean },
): string {
  if (!text) return text;

  const hasCanonical = CANONICAL_CITE_DETECT_RE.test(text);
  const canUseLegacy = !hasCanonical && opts.byIndex.size > 0;
  if (!hasCanonical && !canUseLegacy && !opts.isStreaming) {
    return text;
  }

  const isMultiDocument = isMultiDocumentCollection(opts.byIndex.values());

  const transformProseSegment = (segment: string, isLastSegment: boolean): string => {
    let working = segment;
    if (opts.isStreaming && isLastSegment) {
      working = working.replace(TRAILING_PARTIAL_CITE_RE, '');
    }

    let droppedOrphan = false;
    if (hasCanonical) {
      working = working.replace(
        CANONICAL_CITE_GLOBAL_RE,
        (_full, rawNums: string) => {
          const kept: number[] = [];
          const seen = new Set<number>();
          for (const part of rawNums.split(',')) {
            const n = Number.parseInt(part.trim(), 10);
            if (!Number.isInteger(n) || n <= 0 || seen.has(n)) continue;
            seen.add(n);
            if (opts.isStreaming || opts.byIndex.has(n)) {
              kept.push(n);
            }
          }
          if (kept.length === 0) {
            droppedOrphan = true;
            return '';
          }
          return kept
            .map((n) => `[${n}](${CITATION_HREF_PREFIX}${n})`)
            .join(' ');
        },
      );
    } else if (canUseLegacy) {
      working = working.replace(
        LEGACY_BRACKET_CITE_RE,
        (full, rawNum: string) => {
          const n = Number.parseInt(rawNum, 10);
          return opts.byIndex.has(n)
            ? `[${n}](${CITATION_HREF_PREFIX}${n})`
            : full;
        },
      );
    }

    working = working.replace(CONSECUTIVE_CITE_CHAIN_RE, (chain) => {
      const seenLabels = new Set<string>();
      const keptParts: string[] = [];
      let chainCursor = 0;
      let linkMatch: RegExpExecArray | null;
      SINGLE_CITE_LINK_RE.lastIndex = 0;
      while ((linkMatch = SINGLE_CITE_LINK_RE.exec(chain)) !== null) {
        const sep = chain.slice(chainCursor, linkMatch.index);
        chainCursor = linkMatch.index + linkMatch[0].length;
        const num = Number.parseInt(linkMatch[1], 10);
        const src = opts.byIndex.get(num);
        const dedupeKey = src
          ? `lbl:${formatInlineCitationLabel(src, { isMultiDocument, fallbackIndex: num })}`
          : `idx:${num}`;
        if (seenLabels.has(dedupeKey)) {
          continue;
        }
        seenLabels.add(dedupeKey);
        if (keptParts.length > 0) {
          keptParts.push(sep.includes(',') ? ', ' : sep);
        }
        keptParts.push(linkMatch[0]);
      }
      return keptParts.join('');
    });

    working = working.replace(
      /(\[\d+\]\(#flux-cite-\d+\))[ \t]+([.,;:!?])/g,
      '$1$2',
    );
    if (droppedOrphan) {
      working = working
        .replace(/[ \t]{2,}/g, ' ')
        .replace(/[ \t]+([.,;:!?])/g, '$1');
    }
    return working;
  };

  const chunks: Array<{ protected: boolean; value: string }> = [];
  let cursor = 0;
  PROTECTED_MARKDOWN_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = PROTECTED_MARKDOWN_RE.exec(text)) !== null) {
    if (match.index > cursor) {
      chunks.push({ protected: false, value: text.slice(cursor, match.index) });
    }
    chunks.push({ protected: true, value: match[0] });
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) {
    chunks.push({ protected: false, value: text.slice(cursor) });
  }

  return chunks
    .map((chunk, idx) =>
      chunk.protected
        ? chunk.value
        : transformProseSegment(chunk.value, idx === chunks.length - 1),
    )
    .join('');
}
