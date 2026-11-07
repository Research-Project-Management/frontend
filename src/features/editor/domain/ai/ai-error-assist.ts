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

  if (/undefined control sequence/i.test(errorMessage) && /toprule|bottomrule|midrule/i.test(errorMessage + detail)) {
    return {
      explanation: "Undefined control sequence for booktabs table rule. Include '\\usepackage{booktabs}' in your preamble.",
      originalSnippet: currentLineText,
      fixedSnippet: '\\usepackage{booktabs}',
      startLine: lineNum,
      endLine: lineNum,
      confidence: 'high',
    };
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

export { fixLatexError as heuristicLatexErrorFix };
