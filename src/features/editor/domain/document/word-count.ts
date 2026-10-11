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

  // 1.1 Process bibliography (extract words if %TC:incbib or includeBib is active, then strip from body)
  let wordsInBibliography = 0;
  const bibMatches = text.match(/\\begin\{thebibliography\}[\s\S]*?\\end\{thebibliography\}/gi) || [];
  for (const bibBlock of bibMatches) {
    const cleanedBib = bibBlock
      .replace(/\\begin\{thebibliography\}\{[^}]*\}/gi, '')
      .replace(/\\end\{thebibliography\}/gi, '')
      .replace(/\\bibitem\*?(?:\[[^\]]*\])?\{[^}]*\}/gi, ' ')
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

  // 2. Remove comments (% to end of line, avoiding escaped \%)
  text = text.replace(/(^|[^\\])%.*$/gm, '$1');

  // 3. Count math inlines: $...$ or \(...\)
  const mathInlineMatches = text.match(/\$(?:\\\$|[^\$])+\$/g) || [];
  const mathParenMatches = text.match(/\\\([\s\S]*?\\\)/g) || [];
  const mathInlines = mathInlineMatches.length + mathParenMatches.length;

  // 4. Count math displayed: \[...\], $$, or equation/align/gather/multline/flalign/alignat environments
  const mathBracketMatches = text.match(/\\\[[\s\S]*?\\\]/g) || [];
  const mathDoubleDollarMatches = text.match(/\$\$[\s\S]*?\$\$/g) || [];
  const mathEnvMatches =
    text.match(/\\begin\{(equation|align|gather|multline|flalign|alignat)\*?\}[\s\S]*?\\end\{\1\*?\}/g) || [];
  const mathDisplayed = mathBracketMatches.length + mathDoubleDollarMatches.length + mathEnvMatches.length;

  // 5. Count floats / tables / figures
  const floatMatches =
    text.match(/\\begin\{(figure|table|algorithm|table\*|figure\*)\*?\}[\s\S]*?\\end\{\1\*?\}/g) || [];
  const floats = floatMatches.length;

  // 6. Count headers & words in headers: \book{...}, \part{...}, \chapter{...}, \section{...}, etc.
  const headerRegex = /\\(?:book|part|chapter|section|subsection|subsubsection|paragraph|subparagraph)\*?\{([^}]+)\}/g;
  let headers = 0;
  let wordsInHeaders = 0;
  let match: RegExpExecArray | null;
  while ((match = headerRegex.exec(text)) !== null) {
    headers++;
    const words = match[1]
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 0 && /[a-zA-Z0-9\u00C0-\u024F\u1EA0-\u1EF9]/.test(w));
    wordsInHeaders += words.length;
  }

  // 7. Count captions & footnotes (words outside text)
  const captionRegex = /\\caption\*?(?:\[[^\]]*\])?\{([^}]+)\}/g;
  let wordsInCaptions = 0;
  while ((match = captionRegex.exec(text)) !== null) {
    const words = match[1]
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 0 && /[a-zA-Z0-9\u00C0-\u024F\u1EA0-\u1EF9]/.test(w));
    wordsInCaptions += words.length;
  }

  const footnoteRegex = /\\footnote\*?(?:\[[^\]]*\])?\{([^}]+)\}/g;
  while ((match = footnoteRegex.exec(text)) !== null) {
    const words = match[1]
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 0 && /[a-zA-Z0-9\u00C0-\u024F\u1EA0-\u1EF9]/.test(w));
    wordsInCaptions += words.length;
  }

  // 8. Strip math, headers, captions, footnotes, floats, commands to calculate words in body text
  let bodyText = text;
  bodyText = bodyText.replace(/\\begin\{(equation|align|gather|multline|flalign|alignat)\*?\}[\s\S]*?\\end\{\1\*?\}/g, ' ');
  bodyText = bodyText.replace(/\\\[[\s\S]*?\\\]/g, ' ');
  bodyText = bodyText.replace(/\$\$[\s\S]*?\$\$/g, ' ');
  bodyText = bodyText.replace(/\$(?:\\\$|[^\$])+\$/g, ' ');
  bodyText = bodyText.replace(/\\\([\s\S]*?\\\)/g, ' ');
  bodyText = bodyText.replace(/\\(?:book|part|chapter|section|subsection|subsubsection|paragraph|subparagraph)\*?\{[^}]+\}/g, ' ');
  bodyText = bodyText.replace(/\\caption\*?(?:\[[^\]]*\])?\{[^}]+\}/g, ' ');
  bodyText = bodyText.replace(/\\footnote\*?(?:\[[^\]]*\])?\{[^}]+\}/g, ' ');
  bodyText = bodyText.replace(/\\begin\{(figure|table|algorithm)\*?\}[\s\S]*?\\end\{\1\*?\}/g, ' ');
  bodyText = bodyText.replace(/\\[a-zA-Z]+\*?(?:\[[^\]]*\])?(?:\{([^}]*)\})?/g, '$1 ');
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
