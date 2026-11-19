/**
 * latex-word-extractor.ts
 *
 * Pure LaTeX/BibTeX natural-language word extractor (Domain Layer).
 * Masks math, comments, verbatim blocks, macro names, and citation/label metadata.
 */

export interface ExtractedLatexWord {
  word: string;
  from: number;
  to: number;
  line: number;
  col: number;
}

function maskRangeWithSpaces(chars: string[], start: number, end: number): void {
  const limit = Math.min(chars.length, end);
  for (let i = Math.max(0, start); i < limit; i++) {
    if (chars[i] !== '\n') {
      chars[i] = ' ';
    }
  }
}

/**
 * Extracts natural-language words from LaTeX and BibTeX source text while masking
 * comments, math expressions, verbatim blocks, macro names, and citation/ref metadata.
 */
export function extractLatexWords(text: string): ExtractedLatexWord[] {
  if (!text) return [];
  const chars = text.split('');

  const maskMatches = (regex: RegExp) => {
    regex.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(text)) !== null) {
      if (m[0].length === 0) break;
      maskRangeWithSpaces(chars, m.index, m.index + m[0].length);
    }
  };

  // 1. Verbatim / code / math environments
  maskMatches(
    /\\begin\{(verbatim|lstlisting|minted|tikzpicture|equation|align|alignat|gather|multline|flalign|eqnarray)\*?\}[\s\S]*?\\end\{\1\*?\}/g,
  );

  // 2. Unescaped % comments (strip before inline math scanning)
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '%') {
      let backslashes = 0;
      for (let j = i - 1; j >= 0 && text[j] === '\\'; j--) backslashes++;
      if (backslashes % 2 === 0) {
        let end = i;
        while (end < text.length && text[end] !== '\n') end++;
        maskRangeWithSpaces(chars, i, end);
        i = end;
      } else if (i > 0) {
        chars[i - 1] = ' ';
        chars[i] = ' ';
      }
    } else if (text[i] === '$' && i > 0) {
      let backslashes = 0;
      for (let j = i - 1; j >= 0 && text[j] === '\\'; j--) backslashes++;
      if (backslashes % 2 === 1) {
        chars[i - 1] = ' ';
        chars[i] = ' ';
      }
    }
  }

  // 3. Display & inline math on remaining unmasked text
  const afterComments = chars.join('');
  const maskOnCurrent = (regex: RegExp) => {
    regex.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(afterComments)) !== null) {
      if (m[0].length === 0) break;
      maskRangeWithSpaces(chars, m.index, m.index + m[0].length);
    }
  };
  maskOnCurrent(/\$\$[\s\S]*?\$\$/g);
  maskOnCurrent(/\\\[[\s\S]*?\\\]/g);
  maskOnCurrent(/\\\([\s\S]*?\\\)/g);
  maskOnCurrent(/\$(?:\\\$|[^$\n])+\$/g);

  // 4. Mask non-prose macro arguments (cite, ref, label, usepackage, url, etc.)
  const afterMath = chars.join('');
  const maskArgMacros =
    /\\(?:[a-zA-Z]*cite[a-zA-Z]*|ref|eqref|pageref|autoref|nameref|cref|Cref|label|usepackage|documentclass|input|include|subfile|includegraphics|bibliography|bibliographystyle|addbibresource|url|href|begin|end)\*?(?:\[[^\]]*\])*\{[^}]*\}/g;
  let argMatch: RegExpExecArray | null;
  while ((argMatch = maskArgMacros.exec(afterMath)) !== null) {
    maskRangeWithSpaces(chars, argMatch.index, argMatch.index + argMatch[0].length);
  }

  // 5. Mask BibTeX entry headers and non-prose metadata fields (keep title/abstract/note prose)
  const afterMacros = chars.join('');
  const bibHeaderRegex = /@[a-zA-Z]+\s*\{[^,\s]+,/g;
  let bibMatch: RegExpExecArray | null;
  while ((bibMatch = bibHeaderRegex.exec(afterMacros)) !== null) {
    maskRangeWithSpaces(chars, bibMatch.index, bibMatch.index + bibMatch[0].length);
  }
  const bibNonProseFieldRegex =
    /\b(?:author|editor|journal|year|month|day|doi|url|eprint|archiveprefix|primaryclass|isbn|issn|volume|number|issue|pages|publisher|organization|institution|school|address|howpublished|key|crossref|keywords|language)\s*=\s*(?:\{(?:[^{}]|\{[^{}]*\})*\}|"[^"]*"|[a-zA-Z0-9._-]+)\s*,?/gi;
  while ((bibMatch = bibNonProseFieldRegex.exec(afterMacros)) !== null) {
    maskRangeWithSpaces(chars, bibMatch.index, bibMatch.index + bibMatch[0].length);
  }
  const bibProseFieldKeyRegex = /\b(?:title|booktitle|abstract|note)\s*=/gi;
  while ((bibMatch = bibProseFieldKeyRegex.exec(afterMacros)) !== null) {
    maskRangeWithSpaces(chars, bibMatch.index, bibMatch.index + bibMatch[0].length);
  }

  // 6. Mask remaining LaTeX command tokens (\textbf, \textit, etc.) while keeping brace contents
  const afterBib = chars.join('');
  const cmdNameRegex = /\\[a-zA-Z@]+\*?/g;
  let cmdMatch: RegExpExecArray | null;
  while ((cmdMatch = cmdNameRegex.exec(afterBib)) !== null) {
    maskRangeWithSpaces(chars, cmdMatch.index, cmdMatch.index + cmdMatch[0].length);
  }

  const finalMasked = chars.join('');
  const lineStarts: number[] = [0];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\n') lineStarts.push(i + 1);
  }

  const getLineCol = (offset: number): { line: number; col: number } => {
    let lo = 0;
    let hi = lineStarts.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (lineStarts[mid] <= offset) lo = mid + 1;
      else hi = mid - 1;
    }
    const lineIdx = Math.max(0, hi);
    return { line: lineIdx + 1, col: offset - lineStarts[lineIdx] + 1 };
  };

  const results: ExtractedLatexWord[] = [];
  const wordRegex = /[\p{L}]+(?:['’][\p{L}]+)*/gu;
  let wMatch: RegExpExecArray | null;
  while ((wMatch = wordRegex.exec(finalMasked)) !== null) {
    const word = wMatch[0];
    if (word.length < 2) continue;
    const { line, col } = getLineCol(wMatch.index);
    results.push({
      word,
      from: wMatch.index,
      to: wMatch.index + word.length,
      line,
      col,
    });
  }
  return results;
}
