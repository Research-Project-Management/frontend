/**
 * latex-visual-citations.parser.ts
 *
 * Pure LaTeX citation, cross-reference, hyperlink, URL, and footnote parser/scanner
 * for CodeMirror Visual Mode badge widgets.
 */

import { latexSymbolsIndex } from '@/features/editor/domain/latex/latex-symbols-index';
import { cleanInlineLatexText, findMatchingBrace } from './latex-visual-headings';

export interface ParsedCiteCommand {
  prefix: string;
  command: string;
  prenote: string;
  postnote: string;
  keys: string[];
}

export function parseCiteCommand(rawText: string, fallbackKeys: string[]): ParsedCiteCommand {
  const m = /^(~?)(\\[a-zA-Z]+\*?)(?:\[([^\]]*)\])?(?:\[([^\]]*)\])?\{([^}]*)\}$/.exec(rawText);
  if (!m) {
    return { prefix: '', command: '\\cite', prenote: '', postnote: '', keys: fallbackKeys };
  }
  const prefix = m[1] || '';
  const command = m[2] || '\\cite';
  const opt1 = m[3];
  const opt2 = m[4];
  // In LaTeX: \cite[postnote]{k} has 1 optional arg; \cite[prenote][postnote]{k} has 2.
  const prenote = opt2 !== undefined ? (opt1 ?? '') : '';
  const postnote = opt2 !== undefined ? opt2 : (opt1 ?? '');
  const keys = (m[5] || '')
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);
  return { prefix, command, prenote, postnote, keys: keys.length > 0 ? keys : fallbackKeys };
}

export function buildCiteCommand(parsed: ParsedCiteCommand): string {
  const cleanKeys = parsed.keys.map((k) => k.trim()).filter(Boolean).join(', ');
  const pre = parsed.prenote.trim();
  const post = parsed.postnote.trim();
  let opts = '';
  if (pre && post) opts = `[${pre}][${post}]`;
  else if (pre) opts = `[${pre}][]`;
  else if (post) opts = `[${post}]`;
  return `${parsed.prefix}${parsed.command}${opts}{${cleanKeys}}`;
}

export function formatVisualCitationLabel(
  keys: string[],
  prenote: string,
  postnote: string,
): string {
  const parts = keys.map((key) => {
    const entry = latexSymbolsIndex.getCitationByKey(key);
    if (!entry) return key;
    const authors =
      entry.authors && entry.authors.length > 0
        ? entry.authors
        : entry.author
          ? entry.author.split(/\s+and\s+/i).map((a) => a.trim()).filter(Boolean)
          : [];
    let authorLabel = '';
    if (authors.length > 0) {
      const first = authors[0];
      const surname = first.includes(',')
        ? first.split(',')[0].trim()
        : first.split(/\s+/).pop() || first;
      authorLabel =
        authors.length > 2
          ? `${surname} et al.`
          : authors.length === 2
            ? `${surname} & ${authors[1].includes(',') ? authors[1].split(',')[0].trim() : authors[1].split(/\s+/).pop() || authors[1]}`
            : surname;
    }
    const year = entry.year || '';
    if (authorLabel && year) return `${authorLabel}, ${year}`;
    if (authorLabel) return authorLabel;
    return key;
  });
  const body = parts.join('; ');
  const pre = prenote.trim() ? `${prenote.trim()} ` : '';
  const post = postnote.trim() ? `, ${postnote.trim()}` : '';
  return `[${pre}${body}${post}]`;
}

export type ScannedVisualBadge =
  | { kind: 'cite'; from: number; to: number; keys: string[]; rawText: string }
  | { kind: 'ref'; from: number; to: number; label: string; rawText: string; isEq: boolean }
  | { kind: 'link'; from: number; to: number; url: string; label: string; rawText: string; editOffsetInRaw: number }
  | { kind: 'footnote'; from: number; to: number; preview: string; rawText: string; editOffsetInRaw: number };

const CITE_REGEX =
  /~?\\(?:auto|paren|text|foot|no|new|short)?cite(?:p|t|alt|alp|author|year|date|num)?\*?(?:\[[^\]]*\])*(?:\[[^\]]*\])*\{([^}]+)\}/gi;
const REF_REGEX = /~?\\(?:eq|auto|c|page|name)?ref\*?\{([^}]+)\}/gi;
const HREF_PREFIX_REGEX = /\\href\*?(?:\[[^\]]*\])?\{/g;
const URL_PREFIX_REGEX = /\\url\*?\{/g;
const FOOTNOTE_PREFIX_REGEX = /\\footnote(?:\[[^\]]*\])?\{/g;

export function scanVisualCitationBadges(
  text: string,
  lineFrom: number,
  selection: { from: number; to: number },
): ScannedVisualBadge[] {
  const badges: ScannedVisualBadge[] = [];
  const overlapsSelection = (from: number, to: number) =>
    selection.from <= to && selection.to >= from;

  // 1. Citations
  CITE_REGEX.lastIndex = 0;
  let citeMatch: RegExpExecArray | null;
  while ((citeMatch = CITE_REGEX.exec(text)) !== null) {
    const matchFrom = lineFrom + citeMatch.index;
    const matchTo = matchFrom + citeMatch[0].length;
    if (overlapsSelection(matchFrom, matchTo)) continue;

    const keys = citeMatch[1]
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);
    badges.push({ kind: 'cite', from: matchFrom, to: matchTo, keys, rawText: citeMatch[0] });
  }

  // 2. Cross-references
  REF_REGEX.lastIndex = 0;
  let refMatch: RegExpExecArray | null;
  while ((refMatch = REF_REGEX.exec(text)) !== null) {
    const matchFrom = lineFrom + refMatch.index;
    const matchTo = matchFrom + refMatch[0].length;
    if (overlapsSelection(matchFrom, matchTo)) continue;

    const isEq = refMatch[0].replace(/^~/, '').startsWith('\\eqref');
    const label = refMatch[1].trim();
    badges.push({ kind: 'ref', from: matchFrom, to: matchTo, label, rawText: refMatch[0], isEq });
  }

  // 3. Hyperlinks (\href{url}{label})
  HREF_PREFIX_REGEX.lastIndex = 0;
  let hrefMatch: RegExpExecArray | null;
  while ((hrefMatch = HREF_PREFIX_REGEX.exec(text)) !== null) {
    const openUrlBrace = hrefMatch.index + hrefMatch[0].length - 1;
    const closeUrlBrace = findMatchingBrace(text, openUrlBrace);
    if (closeUrlBrace === null) continue;

    let labelOpenBrace = closeUrlBrace + 1;
    while (labelOpenBrace < text.length && /\s/.test(text[labelOpenBrace]!)) {
      labelOpenBrace++;
    }
    if (text[labelOpenBrace] !== '{') continue;

    const closeLabelBrace = findMatchingBrace(text, labelOpenBrace);
    if (closeLabelBrace === null) continue;

    const matchFrom = lineFrom + hrefMatch.index;
    const matchTo = lineFrom + closeLabelBrace + 1;
    HREF_PREFIX_REGEX.lastIndex = closeLabelBrace + 1;
    if (overlapsSelection(matchFrom, matchTo)) continue;

    const url = text.slice(openUrlBrace + 1, closeUrlBrace).trim();
    const rawLabel = text.slice(labelOpenBrace + 1, closeLabelBrace);
    const label = cleanInlineLatexText(rawLabel) || url;
    const rawText = text.slice(hrefMatch.index, closeLabelBrace + 1);
    const editOffsetInRaw = labelOpenBrace + 1 - hrefMatch.index;

    badges.push({ kind: 'link', from: matchFrom, to: matchTo, url, label, rawText, editOffsetInRaw });
  }

  // 4. Standalone URLs (\url{url})
  URL_PREFIX_REGEX.lastIndex = 0;
  let urlMatch: RegExpExecArray | null;
  while ((urlMatch = URL_PREFIX_REGEX.exec(text)) !== null) {
    const openBrace = urlMatch.index + urlMatch[0].length - 1;
    const closeBrace = findMatchingBrace(text, openBrace);
    if (closeBrace === null) continue;

    const matchFrom = lineFrom + urlMatch.index;
    const matchTo = lineFrom + closeBrace + 1;
    URL_PREFIX_REGEX.lastIndex = closeBrace + 1;
    if (overlapsSelection(matchFrom, matchTo)) continue;

    const url = text.slice(openBrace + 1, closeBrace).trim();
    const rawText = text.slice(urlMatch.index, closeBrace + 1);
    const editOffsetInRaw = openBrace + 1 - urlMatch.index;

    badges.push({ kind: 'link', from: matchFrom, to: matchTo, url, label: url, rawText, editOffsetInRaw });
  }

  // 5. Footnotes (\footnote{...})
  FOOTNOTE_PREFIX_REGEX.lastIndex = 0;
  let fnMatch: RegExpExecArray | null;
  while ((fnMatch = FOOTNOTE_PREFIX_REGEX.exec(text)) !== null) {
    const openBrace = fnMatch.index + fnMatch[0].length - 1;
    const closeBrace = findMatchingBrace(text, openBrace);
    if (closeBrace === null) continue;

    const matchFrom = lineFrom + fnMatch.index;
    const matchTo = lineFrom + closeBrace + 1;
    FOOTNOTE_PREFIX_REGEX.lastIndex = closeBrace + 1;
    if (overlapsSelection(matchFrom, matchTo)) continue;

    const rawBody = text.slice(openBrace + 1, closeBrace);
    const cleaned = cleanInlineLatexText(rawBody);
    const preview = cleaned.length > 120 ? `${cleaned.slice(0, 117)}...` : cleaned;
    const rawText = text.slice(fnMatch.index, closeBrace + 1);
    const editOffsetInRaw = openBrace + 1 - fnMatch.index;

    badges.push({ kind: 'footnote', from: matchFrom, to: matchTo, preview, rawText, editOffsetInRaw });
  }

  return badges;
}
