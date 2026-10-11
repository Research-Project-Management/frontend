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
export function countLatexWords(latex: string): TeXcountStats {
  if (!latex || !latex.trim()) {
    return {
      wordsInText: 0,
      wordsInHeaders: 0,
      wordsInCaptions: 0,
      headers: 0,
      floats: 0,
      mathInlines: 0,
      mathDisplayed: 0,
      totalWords: 0,
      charactersWithSpaces: 0,
      charactersNoSpaces: 0,
    };
  }

  // 1. Remove TeXcount ignored regions: %TC:ignore ... %TC:endignore
  let text = latex.replace(/%TC:ignore[\s\S]*?%TC:endignore/gi, '');

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

  // 6. Count headers & words in headers: \section{...}, \subsection{...}, \chapter{...}, etc.
  const headerRegex = /\\(?:part|chapter|section|subsection|subsubsection|paragraph|subparagraph)\*?\{([^}]+)\}/g;
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
  bodyText = bodyText.replace(/\\(?:part|chapter|section|subsection|subsubsection|paragraph|subparagraph)\*?\{[^}]+\}/g, ' ');
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
  const totalWords = wordsInText + wordsInHeaders + wordsInCaptions;
  const normalizedBody = bodyText.replace(/\s+/g, ' ').trim();
  const charactersWithSpaces = normalizedBody.length;
  const charactersNoSpaces = normalizedBody.replace(/\s/g, '').length;

  return {
    wordsInText,
    wordsInHeaders,
    wordsInCaptions,
    headers,
    floats,
    mathInlines,
    mathDisplayed,
    totalWords,
    charactersWithSpaces,
    charactersNoSpaces,
  };
}
