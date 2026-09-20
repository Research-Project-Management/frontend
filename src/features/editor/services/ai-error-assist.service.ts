/**
 * ai-error-assist.service.ts
 *
 * Overleaf-style AI LaTeX Error Assist:
 * Analyzes compiler diagnostic errors from Logs.tsx, explains the root cause
 * in natural language, and generates a visual diff with a 1-click apply action.
 */

import { API_BASE_URL } from '@/config/env';
import { getAuthToken } from '@/shared/lib/api';

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
function heuristicFallback(params: AiErrorFixParams): AiErrorFixResult {
  const { errorMessage, errorLine = 1, detail = '', surroundingCode = '' } = params;
  const lineNum = errorLine || 1;
  const lines = surroundingCode ? surroundingCode.split('\n') : [];
  const currentLineText = lines.length > 0 ? lines[Math.min(lines.length - 1, 2)] : '';

  // 1. Undefined control sequence
  if (/undefined control sequence/i.test(errorMessage) || /undefined control sequence/i.test(detail)) {
    const cmdMatch = detail.match(/\\([a-zA-Z]+)/) || errorMessage.match(/\\([a-zA-Z]+)/);
    const cmd = cmdMatch ? cmdMatch[1] : '';

    const packageMap: Record<string, string> = {
      toprule: 'booktabs',
      midrule: 'booktabs',
      bottomrule: 'booktabs',
      includegraphics: 'graphicx',
      mathbb: 'amssymb, amsmath',
      eqref: 'amsmath',
      align: 'amsmath',
      url: 'hyperref',
      href: 'hyperref',
      textcolor: 'xcolor',
      color: 'xcolor',
      SI: 'siunitx',
      qty: 'siunitx',
      unit: 'siunitx',
      tikz: 'tikz',
      tikzpicture: 'tikz',
      lipsum: 'lipsum',
    };

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

  // Generic fallback
  return {
    explanation: `Error on line ${lineNum}: ${errorMessage}. ${detail}`,
    originalSnippet: currentLineText || '% Error line',
    fixedSnippet: currentLineText || '% Suggested fix',
    startLine: lineNum,
    endLine: lineNum,
    confidence: 'low',
  };
}

/**
 * Request AI fix suggestion for a given compilation error.
 */
export async function suggestLatexFix(params: AiErrorFixParams): Promise<AiErrorFixResult> {
  const token = getAuthToken();

  const prompt = [
    'You are an expert LaTeX debugging assistant (Overleaf Error Assist).',
    'Analyze the following LaTeX compiler error and suggest an immediate, surgical fix.',
    `File: ${params.errorFile || 'main.tex'}`,
    `Line: ${params.errorLine || 'unknown'}`,
    `Error Message: ${params.errorMessage}`,
    params.detail ? `Detail: ${params.detail}` : '',
    params.surroundingCode ? `\nSurrounding Code:\n\`\`\`latex\n${params.surroundingCode}\n\`\`\`` : '',
    '',
    'Reply ONLY with a valid JSON object in this exact schema (no markdown fences, pure JSON):',
    '{',
    '  "explanation": "Brief 1-2 sentence description of what caused the error and how to fix it",',
    '  "originalSnippet": "Exact code line(s) that should be replaced",',
    '  "fixedSnippet": "The corrected code line(s)",',
    `  "startLine": ${params.errorLine || 1},`,
    `  "endLine": ${params.errorLine || 1},`,
    '  "confidence": "high"',
    '}',
  ].filter(Boolean).join('\n');

  try {
    const res = await fetch(`${API_BASE_URL}/api/ai/chat/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: prompt }],
        query: prompt,
        pageId: params.pageId,
        projectId: params.projectId,
      }),
    });

    if (!res.ok) {
      return heuristicFallback(params);
    }

    const data = (await res.json()) as any;
    const rawContent: string =
      typeof data === 'string'
        ? data
        : (data?.content || data?.reply || '');

    // Clean JSON text (strip markdown code blocks if returned)
    const jsonText = rawContent
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/, '')
      .replace(/\s*```$/, '')
      .trim();

    const parsed = JSON.parse(jsonText) as Record<string, any>;
    if (parsed && typeof parsed === 'object' && parsed.explanation && parsed.fixedSnippet !== undefined) {
      return {
        explanation: String(parsed.explanation),
        originalSnippet: String(parsed.originalSnippet || ''),
        fixedSnippet: String(parsed.fixedSnippet || ''),
        startLine: Number(parsed.startLine) || params.errorLine || 1,
        endLine: Number(parsed.endLine) || params.errorLine || 1,
        confidence:
          parsed.confidence === 'high' || parsed.confidence === 'medium' || parsed.confidence === 'low'
            ? parsed.confidence
            : 'high',
      };
    }
  } catch {
    // If AI network or parsing fails, seamlessly return heuristic fix
  }

  return heuristicFallback(params);
}
