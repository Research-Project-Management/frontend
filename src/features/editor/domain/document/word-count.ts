/**
 * word-count.ts
 *
 * Pure LaTeX word count and statistical analyzer matching TeXcount extraction rules.
 * Layer 1: Domain Core / Document Layer.
 * Clean Architecture Guarantee: Pure Domain layer with ZERO outwards dependencies.
 */

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
}

export interface ProjectTeXcountStats extends TeXcountStats {
  rootFile: string;
  includedFiles: string[];
  byFile: Record<string, TeXcountStats>;
}

/**
 * Extracts all balanced `{...}` arguments following `prefixRegex` and returns both
 * the extracted inner contents and the text with all matched commands replaced by spaces.
 */
function extractAndStripBalancedCommandArgs(
  text: string,
  prefixRegex: RegExp,
): { extracted: string[]; strippedText: string } {
  const extracted: string[] = [];
  const flags = prefixRegex.flags.includes('g') ? prefixRegex.flags : prefixRegex.flags + 'g';
  const re = new RegExp(prefixRegex.source, flags);
  let out = '';
  let lastIdx = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    const openBraceIdx = match.index + match[0].length - 1;
    if (text[openBraceIdx] !== '{') continue;

    let depth = 1;
    let i = openBraceIdx + 1;
    const len = text.length;
    while (i < len && depth > 0) {
      const ch = text[i];
      if (ch === '\\') {
        i += 2;
        continue;
      }
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
      i++;
    }

    if (depth === 0) {
      const inner = text.slice(openBraceIdx + 1, i - 1);
      extracted.push(inner);
      out += text.slice(lastIdx, match.index) + ' ';
      lastIdx = i;
      re.lastIndex = i;
    }
  }

  out += text.slice(lastIdx);
  return { extracted, strippedText: out };
}

function countCleanedWords(raw: string): number {
  const cleaned = raw
    .replace(/\$(?:\\\$|[^\$])+\$/g, ' ')
    .replace(/\\\([\s\S]*?\\\)/g, ' ')
    .replace(
      /\\(?:(?:auto|paren|text|foot|no|new|short)?cite[a-z*]*|(?:C|c|auto|page|name|eq)?ref\*?|label|input|include|subfile|includegraphics|Includegraphics|bibliography|bibliographystyle|usepackage|documentclass)\s*(?:\[[^\]]*\])*\s*\{[^}]*\}/gi,
      ' ',
    )
    .replace(/\\looseness-?\d+/g, ' ')
    .replace(/\\[a-zA-Z@]+\*?(?:\[[^\]]*\])?/g, ' ')
    .replace(/[{}]/g, ' ');

  return cleaned
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0 && /[a-zA-Z0-9\u00C0-\u024F\u1EA0-\u1EF9]/.test(w)).length;
}

/**
 * Client-side fallback LaTeX word counter matching TeXcount extraction rules
 */
export function countLatexWords(latex: string, options?: { includeBib?: boolean }): TeXcountStats {
  if (!latex || !latex.trim()) {
    return {
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
  }

  // TeXcount %TC:incbib directive auto-detection or option flag
  const hasIncBibDirective = /%TC:incbib\b/i.test(latex);
  const includeBib = options?.includeBib ?? hasIncBibDirective;

  // 1. Remove TeXcount ignored regions: %TC:ignore ... %TC:endignore
  let text = latex.replace(/%TC:ignore[\s\S]*?%TC:endignore/gi, '');

  // 2. Remove comments (% to end of line, avoiding escaped \%) BEFORE structural scans
  text = text.replace(/(^|[^\\])%.*$/gm, '$1');

  // 2.1 Remove \iffalse ... \fi conditional blocks
  text = text.replace(/\\iffalse\b[\s\S]*?\\fi\b/g, ' ');

  // 2.2 Process bibliography (extract words if %TC:incbib or includeBib is active, then strip from body)
  let wordsInBibliography = 0;
  const bibMatches = text.match(/\\begin\{thebibliography\}[\s\S]*?\\end\{thebibliography\}/gi) || [];
  for (const bibBlock of bibMatches) {
    const cleanedBib = bibBlock
      .replace(/\\begin\{thebibliography\}\{[^}]*\}/gi, '')
      .replace(/\\end\{thebibliography\}/gi, '')
      .replace(/\\bibitem\*?(?:\[[\s\S]*?\])?\{[^}]*\}/gi, ' ')
      .replace(/\\[a-zA-Z]+/g, ' ')
      .replace(/[{}]/g, ' ');
    const bibWords = cleanedBib
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 0 && /[a-zA-Z0-9\u00C0-\u024F\u1EA0-\u1EF9]/.test(w));
    wordsInBibliography += bibWords.length;
  }
  // Strip thebibliography blocks from body text so they aren't double counted in wordsInText
  text = text.replace(/\\begin\{thebibliography\}[\s\S]*?\\end\{thebibliography\}/gi, ' ');

  // 2.3 Strip preamble before \begin{document} if \begin{document} is present
  const beginDocIdx = text.indexOf('\\begin{document}');
  if (beginDocIdx !== -1) {
    const preamblePart = text.slice(0, beginDocIdx);
    // Keep any \title{...} in preamble as header if needed, or strip macro definitions
    const cleanedPreamble = preamblePart
      .replace(/\\(?:re|provide)?newcommand\*?[\s\S]*$/gm, '')
      .replace(/\\DeclareMathOperator\*?[\s\S]*$/gm, '')
      .replace(/\\def\\[a-zA-Z@]+[\s\S]*$/gm, '')
      .replace(/\\usepackage(?:\[[^\]]*\])?\{[^}]*\}/g, '')
      .replace(/\\documentclass(?:\[[^\]]*\])?\{[^}]*\}/g, '');
    const endDocIdx = text.indexOf('\\end{document}');
    const bodyPart = endDocIdx !== -1
      ? text.slice(beginDocIdx + '\\begin{document}'.length, endDocIdx)
      : text.slice(beginDocIdx + '\\begin{document}'.length);
    text = cleanedPreamble + '\n' + bodyPart;
  }

  // 3. Count math displayed first: \[...\], $$, or equation/align/gather/multline/flalign/alignat environments
  const mathBracketMatches = text.match(/\\\[[\s\S]*?\\\]/g) || [];
  const mathDoubleDollarMatches = text.match(/\$\$[\s\S]*?\$\$/g) || [];
  const mathEnvMatches =
    text.match(/\\begin\{(equation|align|gather|multline|flalign|alignat)\*?\}[\s\S]*?\\end\{\1\*?\}/g) || [];
  const mathDisplayed = mathBracketMatches.length + mathDoubleDollarMatches.length + mathEnvMatches.length;

  // 4. Count math inlines: $...$ (excluding $$...$$) or \(...\)
  const textWithoutDoubleDollar = text.replace(/\$\$[\s\S]*?\$\$/g, ' ');
  const mathInlineMatches = textWithoutDoubleDollar.match(/\$(?:\\\$|[^\$])+\$/g) || [];
  const mathParenMatches = textWithoutDoubleDollar.match(/\\\([\s\S]*?\\\)/g) || [];
  const mathInlines = mathInlineMatches.length + mathParenMatches.length;

  // 5. Count floats / tables / figures
  const floatMatches =
    text.match(/\\begin\{(figure\*?|table\*?|algorithm\*?)\}[\s\S]*?\\end\{\1\}/g) || [];
  const floats = floatMatches.length;

  // 6. Count headers & words in headers with balanced braces (\section{... \textsc{...} ...})
  const headerResult = extractAndStripBalancedCommandArgs(
    text,
    /\\(?:book|part|chapter|section|subsection|subsubsection|paragraph|subparagraph)\*?(?:\[[^\]]*\])?\s*\{/g,
  );
  const headers = headerResult.extracted.length;
  let wordsInHeaders = 0;
  for (const h of headerResult.extracted) {
    wordsInHeaders += countCleanedWords(h);
  }

  // 7. Count captions & footnotes with balanced braces (words outside text)
  const captionResult = extractAndStripBalancedCommandArgs(
    headerResult.strippedText,
    /\\caption\*?(?:\s*\[[^\]]*\])?\s*\{/g,
  );
  let wordsInCaptions = 0;
  for (const cap of captionResult.extracted) {
    wordsInCaptions += countCleanedWords(cap);
  }

  const footnoteResult = extractAndStripBalancedCommandArgs(
    captionResult.strippedText,
    /\\footnote\*?(?:\s*\[[^\]]*\])?\s*\{/g,
  );
  for (const fn of footnoteResult.extracted) {
    wordsInCaptions += countCleanedWords(fn);
  }

  // 8. Strip math, floats, non-prose commands (citations/refs/labels/includes) to calculate words in body text
  let bodyText = footnoteResult.strippedText;
  bodyText = bodyText.replace(/\\begin\{(equation|align|gather|multline|flalign|alignat)\*?\}[\s\S]*?\\end\{\1\*?\}/g, ' ');
  bodyText = bodyText.replace(/\\\[[\s\S]*?\\\]/g, ' ');
  bodyText = bodyText.replace(/\$\$[\s\S]*?\$\$/g, ' ');
  bodyText = bodyText.replace(/\$(?:\\\$|[^\$])+\$/g, ' ');
  bodyText = bodyText.replace(/\\\([\s\S]*?\\\)/g, ' ');
  bodyText = bodyText.replace(/\\begin\{(figure\*?|table\*?|algorithm\*?|tabular\*?|tabularx)\}[\s\S]*?\\end\{\1\}/g, ' ');
  bodyText = bodyText.replace(
    /\\(?:(?:auto|paren|text|foot|no|new|short)?cite[a-z*]*|(?:C|c|auto|page|name|eq)?ref\*?|label|input|include|subfile|includegraphics|Includegraphics|bibliography|bibliographystyle|usepackage|documentclass)\s*(?:\[[^\]]*\])*\s*\{[^}]*\}/gi,
    ' ',
  );
  bodyText = bodyText.replace(/\\(?:begin|end)\{[^}]*\}/g, ' ');
  bodyText = bodyText.replace(/\\[a-zA-Z@]+\*?(?:\[[^\]]*\])?(?:\{([^}]*)\})?/g, '$1 ');
  bodyText = bodyText.replace(/[{}]/g, ' ');

  const bodyWords = bodyText
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0 && /[a-zA-Z0-9\u00C0-\u024F\u1EA0-\u1EF9]/.test(w));

  const wordsInText = bodyWords.length;
  const totalWords = wordsInText + wordsInHeaders + wordsInCaptions + (includeBib ? wordsInBibliography : 0);
  const normalizedBody = bodyText.replace(/\s+/g, ' ').trim();
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

/**
 * Aggregates TeXcount statistics across a multi-file LaTeX project by resolving
 * \input{}, \include{}, and \subfile{} starting from the root .tex document.
 */
export function countProjectLatexWords(
  files: Record<string, string> | Map<string, string>,
  options?: { rootFile?: string; includeBib?: boolean },
): ProjectTeXcountStats {
  const fileMap = new Map<string, string>();
  if (files instanceof Map) {
    for (const [k, v] of files.entries()) {
      fileMap.set(k.replace(/\\/g, '/').replace(/^\.\//, ''), v);
    }
  } else {
    for (const [k, v] of Object.entries(files)) {
      fileMap.set(k.replace(/\\/g, '/').replace(/^\.\//, ''), v);
    }
  }

  // Detect root file
  let rootFile = options?.rootFile?.replace(/\\/g, '/').replace(/^\.\//, '');
  if (!rootFile || !fileMap.has(rootFile)) {
    const texKeys = Array.from(fileMap.keys()).filter((k) => k.toLowerCase().endsWith('.tex'));
    rootFile =
      texKeys.find((k) => k.toLowerCase() === 'main.tex') ||
      texKeys.find((k) => {
        const c = fileMap.get(k) || '';
        return /\\documentclass\b/.test(c) && !/\\documentclass\s*(?:\[[^\]]*\])?\s*\{\s*subfiles\s*\}/.test(c);
      }) ||
      texKeys[0] ||
      'main.tex';
  }

  const visited = new Set<string>();
  const includedFiles: string[] = [];
  const byFile: Record<string, TeXcountStats> = {};

  const resolveIncludeKey = (rawInc: string): string | null => {
    const normalized = rawInc.trim().replace(/\\/g, '/').replace(/^\.\//, '');
    if (fileMap.has(normalized)) return normalized;
    if (!normalized.toLowerCase().endsWith('.tex') && fileMap.has(`${normalized}.tex`)) {
      return `${normalized}.tex`;
    }
    const lowerTarget = normalized.toLowerCase().endsWith('.tex')
      ? normalized.toLowerCase()
      : `${normalized.toLowerCase()}.tex`;
    for (const k of fileMap.keys()) {
      if (k.toLowerCase() === lowerTarget || k.toLowerCase() === normalized.toLowerCase()) {
        return k;
      }
    }
    return null;
  };

  const traverse = (fileKey: string) => {
    if (visited.has(fileKey)) return;
    const content = fileMap.get(fileKey);
    if (content === undefined) return;
    visited.add(fileKey);
    includedFiles.push(fileKey);

    byFile[fileKey] = countLatexWords(content, { includeBib: options?.includeBib });

    // Strip comments and \iffalse before scanning \input / \include
    const active = content
      .replace(/(^|[^\\])%.*$/gm, '$1')
      .replace(/\\iffalse\b[\s\S]*?\\fi\b/g, ' ');

    const incRegex = /\\(?:input|include|subfile)\s*\{([^}]+)\}/g;
    let m: RegExpExecArray | null;
    while ((m = incRegex.exec(active)) !== null) {
      const targetKey = resolveIncludeKey(m[1]);
      if (targetKey) {
        traverse(targetKey);
      }
    }
  };

  traverse(rootFile);

  // Also count .bbl files if includeBib is requested
  if (options?.includeBib) {
    for (const [k, v] of fileMap.entries()) {
      if (k.toLowerCase().endsWith('.bbl') && !visited.has(k)) {
        visited.add(k);
        includedFiles.push(k);
        byFile[k] = countLatexWords(v, { includeBib: true });
      }
    }
  }

  const total: ProjectTeXcountStats = {
    rootFile,
    includedFiles,
    byFile,
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

  for (const stats of Object.values(byFile)) {
    total.wordsInText += stats.wordsInText;
    total.wordsInHeaders += stats.wordsInHeaders;
    total.wordsInCaptions += stats.wordsInCaptions;
    total.wordsInBibliography = (total.wordsInBibliography || 0) + (stats.wordsInBibliography || 0);
    total.headers += stats.headers;
    total.floats += stats.floats;
    total.mathInlines += stats.mathInlines;
    total.mathDisplayed += stats.mathDisplayed;
    total.totalWords = (total.totalWords || 0) + (stats.totalWords || 0);
    total.charactersWithSpaces = (total.charactersWithSpaces || 0) + (stats.charactersWithSpaces || 0);
    total.charactersNoSpaces = (total.charactersNoSpaces || 0) + (stats.charactersNoSpaces || 0);
  }

  return total;
}

