/**
 * word-count.ts
 *
 * Domain types and lightweight adapters for LaTeX word count statistics.
 * Authoritative TeXcount analysis is executed on the backend via
 * `POST /api/v1/manuscripts/word-count` (`TexWordCounter`).
 */

export interface WordCountSection {
  title: string;
  level: string;
  line: number;
  words: number;
}

interface WordCountFileStats {
  id: string;
  title: string;
  path?: string;
  words: number;
  wordsInText: number;
  wordsInHeaders: number;
  wordsInCaptions: number;
  wordsInBibliography?: number;
  headers: number;
  floats: number;
  math: number;
  mathInlines: number;
  mathDisplayed: number;
}

export interface TeXcountStats {
  wordsInText: number;
  wordsInHeaders: number;
  wordsInCaptions: number;
  wordsInBibliography?: number;
  headers: number;
  floats: number;
  mathInlines: number;
  mathDisplayed: number;
  totalWords?: number;
  charactersWithSpaces?: number;
  charactersNoSpaces?: number;
  cjkCharacters?: number;
  readingTimeMinutes?: number;
  sections?: WordCountSection[];
  perFileStats?: WordCountFileStats[];
  rawOutput?: string;
}

export type LatexWordCountResult = TeXcountStats;

export interface ProjectTeXcountStats extends TeXcountStats {
  rootFile: string;
  includedFiles: string[];
  byFile: Record<string, TeXcountStats>;
}

export const EMPTY_TEXCOUNT_STATS: TeXcountStats = {
  wordsInText: 0,
  wordsInHeaders: 0,
  wordsInCaptions: 0,
  wordsInBibliography: 0,
  headers: 0,
  floats: 0,
  mathInlines: 0,
  mathDisplayed: 0,
  totalWords: 0,
  charactersWithSpaces: 0,
  charactersNoSpaces: 0,
  cjkCharacters: 0,
  readingTimeMinutes: 0,
  sections: [],
};

function extractBalancedBlocks(
  text: string,
  commandsPattern: string,
  onExtract: (innerText: string) => void,
): string {
  const regex = new RegExp(
    `\\\\(?:${commandsPattern})\\*?(?:\\[[^\\]]*\\])*\\s*\\{`,
    'g',
  );
  let result = '';
  let lastIdx = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    result += text.slice(lastIdx, match.index);
    const openBraceIdx = match.index + match[0].length - 1;
    let depth = 1;
    let i = openBraceIdx + 1;
    while (i < text.length && depth > 0) {
      const ch = text[i];
      if (ch === '\\' && i + 1 < text.length) {
        i += 2;
        continue;
      }
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
      i++;
    }
    if (depth === 0) {
      onExtract(text.slice(openBraceIdx + 1, i - 1));
      result += ' ';
      lastIdx = i;
      regex.lastIndex = i;
    } else {
      result += match[0];
      lastIdx = match.index + match[0].length;
      regex.lastIndex = lastIdx;
    }
  }
  result += text.slice(lastIdx);
  return result;
}

function countProseWords(text: string): number {
  if (!text) return 0;
  const cleaned = text
    .replace(/\\[a-zA-Z]+\*?/g, ' ')
    .replace(/[{}\[\]()~^_\\.,;:?!'"`@#$%&*+=<>|/\\-]/g, ' ');
  let count = 0;
  const matches = cleaned.match(/[\p{L}\p{N}]+(?:['â€™][\p{L}\p{N}]+)*/gu) || [];
  for (const token of matches) {
    const cjkMatches = token.match(/[\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF\uAC00-\uD7AF]/g);
    if (cjkMatches) {
      count += cjkMatches.length;
      const nonCjk = token.replace(/[\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF\uAC00-\uD7AF]/g, ' ').trim();
      if (nonCjk) {
        count += nonCjk.split(/\s+/).filter(Boolean).length;
      }
    } else {
      count += 1;
    }
  }
  return count;
}

function stripIgnoreAndComments(source: string): string {
  const lines = source.split(/\r?\n/);
  const kept: string[] = [];
  let inIgnore = false;
  let iffalseDepth = 0;

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (/^%\s*TC:ignore\b/i.test(trimmed)) {
      inIgnore = true;
      continue;
    }
    if (/^%\s*TC:endignore\b/i.test(trimmed)) {
      inIgnore = false;
      continue;
    }
    if (inIgnore) continue;

    // Strip unescaped % comments (even number of preceding backslashes)
    let codeLine = '';
    for (let i = 0; i < rawLine.length; i++) {
      if (rawLine[i] === '%') {
        let bs = 0;
        for (let j = i - 1; j >= 0 && rawLine[j] === '\\'; j--) bs++;
        if (bs % 2 === 0) break;
      }
      codeLine += rawLine[i];
    }

    if (/\\iffalse\b/.test(codeLine)) iffalseDepth++;
    if (iffalseDepth > 0) {
      if (/\\fi\b/.test(codeLine)) iffalseDepth = Math.max(0, iffalseDepth - 1);
      continue;
    }
    kept.push(codeLine);
  }
  return kept.join('\n');
}

/**
 * Synchronous TeXcount-compatible analyzer for LaTeX manuscripts.
 */
export function countLatexWords(
  latex?: string,
  options?: { includeBib?: boolean },
): TeXcountStats {
  const emptyCore: TeXcountStats = {
    wordsInText: 0,
    wordsInHeaders: 0,
    wordsInCaptions: 0,
    wordsInBibliography: 0,
    headers: 0,
    floats: 0,
    mathInlines: 0,
    mathDisplayed: 0,
    totalWords: 0,
    charactersWithSpaces: 0,
    charactersNoSpaces: 0,
  };
  if (!latex || !latex.trim()) {
    return emptyCore;
  }

  const hasIncBib = /^\s*%\s*TC:incbib\b/im.test(latex);
  const includeBib = Boolean(options?.includeBib || hasIncBib);

  let processed = stripIgnoreAndComments(latex);
  const beginMatch = /\\begin\s*\{document\}/.exec(processed);
  if (beginMatch) {
    processed = processed.slice(beginMatch.index + beginMatch[0].length);
  }
  const endMatch = /\\end\s*\{document\}/.exec(processed);
  if (endMatch) {
    processed = processed.slice(0, endMatch.index);
  }

  let wordsInBibliography = 0;
  processed = processed.replace(
    /\\begin\{thebibliography\}(?:\{[^}]*\})?([\s\S]*?)\\end\{thebibliography\}/g,
    (_full, body: string) => {
      const stripped = body
        .replace(/\\bibitem(?:\[[^\]]*\])?\{[^}]*\}/g, ' ')
        .replace(/\\newblock\b/g, ' ');
      wordsInBibliography += countProseWords(stripped);
      return ' ';
    },
  );

  let floats = 0;
  const floatStartRegex = /\\begin\{(?:figure|table|algorithm|algorithm2e)\*?\}/g;
  while (floatStartRegex.exec(processed) !== null) {
    floats++;
  }

  let headers = 0;
  let wordsInHeaders = 0;
  processed = extractBalancedBlocks(
    processed,
    'book|title|part|chapter|section|subsection|subsubsection|paragraph|subparagraph',
    (inner) => {
      headers++;
      wordsInHeaders += countProseWords(inner);
    },
  );

  let wordsInCaptions = 0;
  processed = extractBalancedBlocks(
    processed,
    'caption|captionof|footnote|abstract',
    (inner) => {
      wordsInCaptions += countProseWords(inner);
    },
  );

  let mathDisplayed = 0;
  processed = processed.replace(
    /\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\\begin\{(?:equation|align|gather|multline|flalign|alignat|eqnarray)\*?\}[\s\S]*?\\end\{(?:equation|align|gather|multline|flalign|alignat|eqnarray)\*?\}/g,
    () => {
      mathDisplayed++;
      return ' ';
    },
  );

  let mathInlines = 0;
  processed = processed.replace(/\$(?:\\\$|[^\$])+\$|\\\([\s\S]*?\\\)/g, () => {
    mathInlines++;
    return ' ';
  });

  processed = processed.replace(
    /\\begin\{(?:tikzpicture|lstlisting|minted|verbatim|tabular|tabularx|longtable)\*?\}[\s\S]*?\\end\{(?:tikzpicture|lstlisting|minted|verbatim|tabular|tabularx|longtable)\*?\}/g,
    ' ',
  );
  processed = processed.replace(
    /\\begin\{[^}]+\}(?:\[[^\]]*\])?(?:\{[^}]*\})*|\\end\{[^}]+\}/g,
    ' ',
  );
  processed = processed.replace(
    /\\documentclass(?:\[[^\]]*\])?\{[^}]+\}|\\usepackage(?:\[[^\]]*\])?\{[^}]+\}/g,
    ' ',
  );
  processed = processed.replace(
    /\\(?:includegraphics|cite[a-zA-Z]*|newcite|shortcite|parencite|textcite|footcite|nocite|ref|eqref|pageref|autoref|nameref|cref|Cref|label|input|include|subfile|bibliography|bibliographystyle|addbibresource|url|href|pagestyle|thispagestyle|centering|maketitle|vspace|hspace|setlength|addtolength|newcommand|renewcommand|def)\*?(?:\[[^\]]*\])*(?:\{[^}]*\})?/g,
    ' ',
  );
  processed = processed.replace(/\[[^\]]*\]/g, ' ');
  processed = processed.replace(/\\[a-zA-Z]+\*?/g, ' ');
  processed = processed.replace(/[{}]/g, ' ');

  const wordsInText = countProseWords(processed);
  const totalWords =
    wordsInText +
    wordsInHeaders +
    wordsInCaptions +
    (includeBib ? wordsInBibliography : 0);
  const normalizedBody = processed.replace(/\s+/g, ' ').trim();
  const charactersWithSpaces = normalizedBody.length;
  const charactersNoSpaces = normalizedBody.replace(/\s/g, '').length;

  return {
    wordsInText,
    wordsInHeaders,
    wordsInCaptions,
    wordsInBibliography,
    headers,
    floats,
    mathInlines,
    mathDisplayed,
    totalWords,
    charactersWithSpaces,
    charactersNoSpaces,
  };
}

export function countProjectLatexWords(
  files: Record<string, string> | Map<string, string>,
  options?: { rootFile?: string; includeBib?: boolean },
): ProjectTeXcountStats {
  const entries =
    files instanceof Map ? Array.from(files.entries()) : Object.entries(files);
  const rootFile = options?.rootFile || 'main.tex';
  const includedFiles: string[] = [];
  const byFile: Record<string, TeXcountStats> = {};
  const acc = {
    wordsInText: 0,
    wordsInHeaders: 0,
    wordsInCaptions: 0,
    wordsInBibliography: 0,
    headers: 0,
    floats: 0,
    mathInlines: 0,
    mathDisplayed: 0,
    totalWords: 0,
    charactersWithSpaces: 0,
    charactersNoSpaces: 0,
  };

  for (const [filePath, content] of entries) {
    if (!/\.(tex|latex|bbl|md|txt)$/i.test(filePath)) continue;
    includedFiles.push(filePath);
    const stats = countLatexWords(content, { includeBib: options?.includeBib });
    byFile[filePath] = stats;
    acc.wordsInText += stats.wordsInText;
    acc.wordsInHeaders += stats.wordsInHeaders;
    acc.wordsInCaptions += stats.wordsInCaptions;
    acc.wordsInBibliography += stats.wordsInBibliography ?? 0;
    acc.headers += stats.headers;
    acc.floats += stats.floats;
    acc.mathInlines += stats.mathInlines;
    acc.mathDisplayed += stats.mathDisplayed;
    acc.totalWords += stats.totalWords ?? 0;
    acc.charactersWithSpaces += stats.charactersWithSpaces ?? 0;
    acc.charactersNoSpaces += stats.charactersNoSpaces ?? 0;
  }

  return {
    ...acc,
    rootFile,
    includedFiles,
    byFile,
  };
}
