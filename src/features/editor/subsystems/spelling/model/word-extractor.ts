/**
 * subsystems/spelling/model/word-extractor.ts
 *
 * O(N) LaTeX/BibTeX natural-language word extractor using a length-preserving Masking Pipeline.
 * Replaces non-prose spans with equal-length spaces so every token's [from, to) offset
 * remains mathematically identical to the original source without char-array allocation.
 */

export interface ExtractedWord {
  word: string;
  from: number;
  to: number;
}

type MaskStage = (source: string) => string;

const maskSpaces = (match: string): string => ' '.repeat(match.length);

const RE_ENVIRONMENTS =
  /\\begin\{(verbatim|lstlisting|minted|tikzpicture|equation|align|alignat|gather|multline|flalign|eqnarray)\*?\}[\s\S]*?\\end\{\1\*?\}/g;
const RE_DISPLAY_MATH_DOLLAR = /\$\$[\s\S]*?\$\$/g;
const RE_DISPLAY_MATH_BRACKET = /\\\[[\s\S]*?\\\]/g;
const RE_INLINE_MATH_PAREN = /\\\([\s\S]*?\\\)/g;
const RE_INLINE_MATH_DOLLAR = /\$(?:\\\$|[^$\n])+\$/g;
const RE_TECHNICAL_MACROS =
  /\\(?:(?:begin|end)\*?\{[^}]*\}(?:\[[^\]]*\])?(?:\{[^}]*\})?|(?:[a-zA-Z]*cite[a-zA-Z]*|ref|eqref|pageref|autoref|nameref|cref|Cref|label|usepackage|documentclass|input|include|subfile|includegraphics|bibliography|bibliographystyle|addbibresource|url|href)\*?(?:\[[^\]]*\])*\{[^}]*\})/g;
const RE_BIB_HEADER = /@[a-zA-Z]+\s*\{[^,\s]+,/g;
const RE_BIB_NON_PROSE =
  /\b(?:author|editor|journal|year|month|day|doi|url|eprint|archiveprefix|primaryclass|isbn|issn|volume|number|issue|pages|publisher|organization|institution|school|address|howpublished|key|crossref|keywords|language)\s*=\s*(?:\{(?:[^{}]|\{[^{}]*\})*\}|"[^"]*"|[a-zA-Z0-9._-]+)\s*,?/gi;
const RE_BIB_PROSE_KEY = /\b(?:title|booktitle|abstract|note)\s*=/gi;
const RE_URLS = /https?:\/\/[^\s{}]+/g;
const RE_EMAILS = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const RE_COMMANDS = /\\[a-zA-Z@]+\*?/g;
const RE_WORD = /[\p{L}]+(?:['’][\p{L}]+)*/gu;

const maskEnvironments: MaskStage = (source) =>
  source.replace(RE_ENVIRONMENTS, maskSpaces);

function countPrecedingBackslashes(source: string, index: number): number {
  let count = 0;
  for (let j = index - 1; j >= 0 && source.charCodeAt(j) === 92; j--) count++;
  return count;
}

/**
 * Single-pass O(N) comment (%) and escaped-delimiter (\%, \$) masker.
 * Uses native C++ slice/repeat chunks instead of char-by-char array allocation.
 */
const maskCommentsAndEscapes: MaskStage = (source) => {
  if (!source.includes('%') && !source.includes('\\$')) return source;

  const chunks: string[] = [];
  let cursor = 0;
  const len = source.length;

  for (let i = 0; i < len; i++) {
    const ch = source.charCodeAt(i);
    if (ch === 37 /* '%' */) {
      if (countPrecedingBackslashes(source, i) % 2 === 0) {
        let end = source.indexOf('\n', i);
        if (end === -1) end = len;
        chunks.push(source.slice(cursor, i), ' '.repeat(end - i));
        cursor = end;
        i = end;
      } else if (i - 1 >= cursor) {
        chunks.push(source.slice(cursor, i - 1), '  ');
        cursor = i + 1;
      }
    } else if (
      ch === 36 /* '$' */ &&
      countPrecedingBackslashes(source, i) % 2 === 1 &&
      i - 1 >= cursor
    ) {
      chunks.push(source.slice(cursor, i - 1), '  ');
      cursor = i + 1;
    }
  }

  if (cursor === 0) return source;
  chunks.push(source.slice(cursor));
  return chunks.join('');
};

const maskMath: MaskStage = (source) =>
  source
    .replace(RE_DISPLAY_MATH_DOLLAR, maskSpaces)
    .replace(RE_DISPLAY_MATH_BRACKET, maskSpaces)
    .replace(RE_INLINE_MATH_PAREN, maskSpaces)
    .replace(RE_INLINE_MATH_DOLLAR, maskSpaces);

const maskTechnicalMacros: MaskStage = (source) =>
  source.replace(RE_TECHNICAL_MACROS, maskSpaces);

const maskBibtexMetadata: MaskStage = (source) =>
  source
    .replace(RE_BIB_HEADER, maskSpaces)
    .replace(RE_BIB_NON_PROSE, maskSpaces)
    .replace(RE_BIB_PROSE_KEY, maskSpaces);

const maskUrlsEmailsAndCommands: MaskStage = (source) =>
  source
    .replace(RE_URLS, maskSpaces)
    .replace(RE_EMAILS, maskSpaces)
    .replace(RE_COMMANDS, maskSpaces);

const MASK_PIPELINE: readonly MaskStage[] = [
  maskCommentsAndEscapes,
  maskEnvironments,
  maskMath,
  maskTechnicalMacros,
  maskBibtexMetadata,
  maskUrlsEmailsAndCommands,
];

export function extractLatexWords(text: string): ExtractedWord[] {
  if (!text) return [];

  let masked = text;
  for (const stage of MASK_PIPELINE) {
    masked = stage(masked);
  }

  const results: ExtractedWord[] = [];
  RE_WORD.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = RE_WORD.exec(masked)) !== null) {
    const word = match[0];
    if (word.length < 2) continue;
    results.push({
      word,
      from: match.index,
      to: match.index + word.length,
    });
  }

  return results;
}
