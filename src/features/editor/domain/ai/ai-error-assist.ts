/**
 * ai-error-assist.ts
 *
 * Types and thin offline fallback for AI LaTeX Error Assist.
 * Authoritative compiler diagnostic classification, package suggestion table, and LLM/AutoFix
 * remediation live on the backend in `backend/src/modules/manuscripts/clsi/domain/latex-ai-assistant.ts`
 * via `POST /api/v1/manuscripts/clsi/ai/fix-error`.
 */

export interface AiErrorFixParams {
  errorMessage: string;
  errorLine?: number;
  errorFile?: string;
  detail?: string;
  surroundingCode?: string;
  fullCode?: string;
  pageId?: string;
  spaceId?: string;
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
 * Lightweight fallback error descriptor when backend AI Error Assist is unreachable.
 */
export function fixLatexError(params: AiErrorFixParams): AiErrorFixResult {
  const { errorMessage, errorLine = 1, detail = '', surroundingCode = '' } = params;
  const lineNum = errorLine || 1;
  const lines = surroundingCode ? surroundingCode.split('\n') : [];
  const currentLineText = lines.length > 0 ? lines[Math.min(lines.length - 1, 2)] : '';

  const envMismatch = errorMessage.match(/\\begin\{([^}]+)\} ended by \\end\{([^}]+)\}/i);
  if (envMismatch) {
    return {
      explanation: `Mismatched environment: started with '\\begin{${envMismatch[1]}}' but closed with '\\end{${envMismatch[2]}}'.`,
      originalSnippet: `\\end{${envMismatch[2]}}`,
      fixedSnippet: `\\end{${envMismatch[1]}}`,
      startLine: lineNum,
      endLine: lineNum,
      confidence: 'high',
    };
  }

  const packageMap: Record<string, string> = {
    includegraphics: 'graphicx',
    textcolor: 'xcolor',
    color: 'xcolor',
    colorbox: 'xcolor',
    toprule: 'booktabs',
    midrule: 'booktabs',
    bottomrule: 'booktabs',
    cmidrule: 'booktabs',
    multirow: 'multirow',
    mathbb: 'amssymb, amsmath',
    mathcal: 'amsmath',
    mathfrak: 'amssymb',
    text: 'amsmath',
    align: 'amsmath',
    dfrac: 'amsmath',
    tfrac: 'amsmath',
    boldsymbol: 'amsmath',
    url: 'hyperref',
    href: 'hyperref',
    SI: 'siunitx',
    si: 'siunitx',
    num: 'siunitx',
    tikz: 'tikz',
    begin: 'amsmath',
    lstinputlisting: 'listings',
    lstlisting: 'listings',
    FloatBarrier: 'placeins',
    subfloat: 'subfig',
    subfigure: 'subcaption',
    captionof: 'caption',
    rotatebox: 'graphicx',
    scalebox: 'graphicx',
  };

  if (/undefined control sequence/i.test(errorMessage)) {
    const cmdMatch = `${errorMessage} ${detail} ${surroundingCode}`.match(
      /\\([a-zA-Z]+)/,
    );
    const cmdName = cmdMatch?.[1];
    if (cmdName && packageMap[cmdName]) {
      const pkg = packageMap[cmdName];
      const primaryPkg = pkg.split(',')[0].trim();
      return {
        explanation: `Undefined control sequence \\${cmdName}. Include '\\usepackage{${primaryPkg}}'${pkg.includes(',') ? ` (or ${pkg})` : ''} in your preamble.`,
        originalSnippet: currentLineText,
        fixedSnippet: `\\usepackage{${primaryPkg}}`,
        startLine: lineNum,
        endLine: lineNum,
        confidence: 'high',
      };
    }
  }

  if (/perhaps a missing \\item/i.test(errorMessage) || /missing \\item/i.test(errorMessage)) {
    return {
      explanation: "List environment (itemize, enumerate) contains text before any '\\item' declaration.",
      originalSnippet: currentLineText,
      fixedSnippet: '\\item',
      startLine: lineNum,
      endLine: lineNum,
      confidence: 'high',
    };
  }

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
