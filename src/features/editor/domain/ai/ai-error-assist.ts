/**
 * ai-error-assist.ts
 *
 * Domain logic for Overleaf-style AI LaTeX Error Assist:
 * - Parsing and classifying LaTeX compiler diagnostic errors
 * - Expert heuristic rules for common TeX compilation failures (undefined control sequence,
 *   missing math delimiters, missing item, mismatched environments, file not found, unmatched braces)
 *
 * Domain: Layer 1 (Pure Domain Model & AI Error Remediation).
 */

export interface AiErrorFixParams {
  errorMessage: string;
  errorLine?: number;
  errorFile?: string;
  detail?: string;
  surroundingCode?: string;
  fullCode?: string;
  pageId?: string;
  projectId?: string;
}

export interface AiErrorFixResult {
  explanation: string;
  originalSnippet: string;
  fixedSnippet: string;
  startLine: number;
  endLine: number;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Common LaTeX error heuristic fix patterns when offline or AI call fails.
 */
export function heuristicLatexErrorFix(params: AiErrorFixParams): AiErrorFixResult {
  const { errorMessage, errorLine = 1, detail = '', surroundingCode = '' } = params;
  const lineNum = errorLine || 1;
  const lines = surroundingCode ? surroundingCode.split('\n') : [];
  const currentLineText = lines.length > 0 ? lines[Math.min(lines.length - 1, 2)] : '';

  // 1. Undefined control sequence
  if (/undefined control sequence/i.test(errorMessage) || /undefined control sequence/i.test(detail)) {
    const packageMap: Record<string, string> = {
      toprule: 'booktabs',
      midrule: 'booktabs',
      bottomrule: 'booktabs',
      cmidrule: 'booktabs',
      specialrule: 'booktabs',
      addlinespace: 'booktabs',
      multirow: 'multirow',
      includegraphics: 'graphicx',
      mathbb: 'amssymb, amsmath',
      mathcal: 'amssymb, amsmath',
      mathfrak: 'amssymb, amsmath',
      leqslant: 'amssymb, amsmath',
      geqslant: 'amssymb, amsmath',
      triangleq: 'amssymb, amsmath',
      intercal: 'amssymb, amsmath',
      eqref: 'amsmath',
      align: 'amsmath',
      DeclareMathOperator: 'amsmath',
      binom: 'amsmath',
      tfrac: 'amsmath',
      dfrac: 'amsmath',
      bm: 'bm',
      citet: 'natbib',
      citep: 'natbib',
      citealp: 'natbib',
      citealt: 'natbib',
      citeauthor: 'natbib',
      citeyear: 'natbib',
      newcite: 'natbib',
      shortcite: 'natbib',
      parencite: 'biblatex',
      textcite: 'biblatex',
      autocite: 'biblatex',
      cref: 'cleveref',
      Cref: 'cleveref',
      crefrange: 'cleveref',
      autoref: 'hyperref',
      nameref: 'hyperref',
      url: 'hyperref',
      href: 'hyperref',
      textcolor: 'xcolor',
      color: 'xcolor',
      SI: 'siunitx',
      qty: 'siunitx',
      unit: 'siunitx',
      tikz: 'tikz',
      tikzpicture: 'tikz',
      subfloat: 'subfig',
      subfigure: 'subcaption',
      lstinline: 'listings',
      lstlisting: 'listings',
      lipsum: 'lipsum',
    };

    const allCmds = [
      ...Array.from(detail.matchAll(/\\([a-zA-Z]+)/g), (m) => m[1]),
      ...Array.from(errorMessage.matchAll(/\\([a-zA-Z]+)/g), (m) => m[1]),
    ];
    const mappedCmd = allCmds.find((c) => Boolean(packageMap[c]));
    const cmd = mappedCmd || allCmds[allCmds.length - 1] || '';

    if (cmd && packageMap[cmd]) {
      const pkg = packageMap[cmd];
      return {
        explanation: `The command '\\${cmd}' requires the '${pkg}' package. Add \\usepackage{${pkg}} to your preamble.`,
        originalSnippet: currentLineText || `\\${cmd}`,
        fixedSnippet: `% Ensure \\usepackage{${pkg}} is in your preamble\n${currentLineText || `\\${cmd}`}`,
        startLine: lineNum,
        endLine: lineNum,
        confidence: 'high',
      };
    }

    return {
      explanation: `LaTeX encountered an unknown command ${cmd ? `'\\${cmd}'` : ''}. Check for spelling errors or missing package imports.`,
      originalSnippet: currentLineText || (cmd ? `\\${cmd}` : ''),
      fixedSnippet: currentLineText.replace(new RegExp(`\\\\${cmd}\\b`), '') || '% Fixed command',
      startLine: lineNum,
      endLine: lineNum,
      confidence: 'medium',
    };
  }

  // 2. Missing $ inserted
  if (/missing \$ inserted/i.test(errorMessage)) {
    return {
      explanation: 'Mathematical symbol, subscript, or superscript used outside of math mode. Wrap the formula in $...$.',
      originalSnippet: currentLineText,
      fixedSnippet: currentLineText ? `$${currentLineText.trim()}$` : '$x$',
      startLine: lineNum,
      endLine: lineNum,
      confidence: 'medium',
    };
  }

  // 3. Missing \item
  if (/perhaps a missing \\item/i.test(errorMessage)) {
    return {
      explanation: "List environment (itemize/enumerate) contains text without an '\\item' command.",
      originalSnippet: currentLineText,
      fixedSnippet: currentLineText ? `  \\item ${currentLineText.trim()}` : '  \\item Content',
      startLine: lineNum,
      endLine: lineNum,
      confidence: 'high',
    };
  }

  // 4. Environment mismatch
  const envMismatch = errorMessage.match(/\\begin\{([^}]+)\} ended by \\end\{([^}]+)\}/i);
  if (envMismatch) {
    const beginEnv = envMismatch[1];
    const endEnv = envMismatch[2];
    return {
      explanation: `Mismatched environment: started with '\\begin{${beginEnv}}' but closed with '\\end{${endEnv}}'.`,
      originalSnippet: `\\end{${endEnv}}`,
      fixedSnippet: `\\end{${beginEnv}}`,
      startLine: lineNum,
      endLine: lineNum,
      confidence: 'high',
    };
  }

  // 5. Missing \begin{document}
  if (/missing \\begin\{document\}/i.test(errorMessage) || /missing \\begin\{document\}/i.test(detail)) {
    return {
      explanation: "The document environment has not been opened. Add '\\begin{document}' after your preamble before document content, or verify the main root document.",
      originalSnippet: currentLineText || '',
      fixedSnippet: '\\begin{document}',
      startLine: lineNum,
      endLine: lineNum,
      confidence: 'high',
    };
  }

  // 6. File not found
  const fileNotFoundMatch = errorMessage.match(/File ['`"]?([^'`"]+)['`"]? not found/i);
  if (fileNotFoundMatch) {
    const missingFile = fileNotFoundMatch[1];
    return {
      explanation: `Referenced file or package '${missingFile}' cannot be found. Verify that the file exists in the project hierarchy or update the \\input path.`,
      originalSnippet: currentLineText || `\\input{${missingFile}}`,
      fixedSnippet: currentLineText ? `% Verify file exists: ${missingFile}\n${currentLineText}` : '',
      startLine: lineNum,
      endLine: lineNum,
      confidence: 'high',
    };
  }

  // 7. Unmatched braces
  if (/missing \} inserted/i.test(errorMessage) || /extra \}, or forgotten \\endgroup/i.test(errorMessage) || /too many \}'s/i.test(errorMessage)) {
    return {
      explanation: "Unbalanced curly braces. Check for an unclosed '{' or an extra closing '}' in this block.",
      originalSnippet: currentLineText || '',
      fixedSnippet: currentLineText ? currentLineText.replace(/\}+$/, '') : '',
      startLine: lineNum,
      endLine: lineNum,
      confidence: 'medium',
    };
  }

  // Generic fallback: direct and concise, without repeating error prefix or stray symbols
  const cleanMsg = errorMessage
    .replace(/^!/g, '')
    .replace(/^LaTeX Error:\s*/i, '')
    .replace(/^Error:\s*/i, '')
    .trim();
  const cleanDetail = detail && !/^[@^~.?!\s]+$/.test(detail) && detail.length > 1 ? ` (${detail})` : '';

  return {
    explanation: cleanMsg
      ? `${cleanMsg}${cleanDetail}. Review the syntax at line ${lineNum}.`
      : `LaTeX syntax issue detected at line ${lineNum}. Check surrounding commands.`,
    originalSnippet: currentLineText || '',
    fixedSnippet: '',
    startLine: lineNum,
    endLine: lineNum,
    confidence: 'medium',
  };
}
