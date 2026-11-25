/**
 * local-latex-linter.ts
 *
 * Pure, synchronous, zero-network real-time LaTeX syntax linter.
 * Runs locally in-browser on every debounced edit without hitting the database or backend API.
 */

import {
  scanRetractedCitations,
  type LinterDiagnostic,
  type LinterOptions,
} from './latex-linter-core';

const HARD_SYNTAX_ERROR_CODES = new Set([
  'UNBALANCED_BRACES',
  'ENVIRONMENT_MISMATCH',
  'MISSING_MATH_DELIMITER',
]);

const VERBATIM_ENVS = new Set([
  'verbatim',
  'verbatim*',
  'lstlisting',
  'minted',
  'comment',
  'filecontents',
  'filecontents*',
]);

function countPrecedingBackslashes(line: string, index: number): number {
  let count = 0;
  for (let j = index - 1; j >= 0 && line[j] === '\\'; j--) {
    count++;
  }
  return count;
}

function stripCommentPreservingEscapes(line: string): string {
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '%' && countPrecedingBackslashes(line, i) % 2 === 0) {
      return line.slice(0, i);
    }
  }
  return line;
}

function maskVerbInLine(line: string): string {
  return line.replace(/\\verb\*?([^a-zA-Z\s])([\s\S]*?)\1/g, (m) => ' '.repeat(m.length));
}

export function hasHardSyntaxErrors(
  diagnostics: ReadonlyArray<{ severity?: string; code?: string; source?: string }>,
): boolean {
  return diagnostics.some(
    (d) =>
      d.severity === 'error' &&
      (d.code ? HARD_SYNTAX_ERROR_CODES.has(d.code) : true),
  );
}

export function runLocalLatexSyntaxLinter(
  text: string,
  options: LinterOptions = {},
): LinterDiagnostic[] {
  if (!text || !text.trim()) return [];
  if (/^%novalidate\b/m.test(text)) {
    return scanRetractedCitations(text, options.retractedCitationsMap);
  }

  const diagnostics: LinterDiagnostic[] = [];
  const lines = text.split('\n');
  const lineStarts: number[] = new Array(lines.length);
  let cursorOffset = 0;
  for (let i = 0; i < lines.length; i++) {
    lineStarts[i] = cursorOffset;
    cursorOffset += lines[i].length + 1;
  }

  const knownBibSet =
    options.knownBibKeys && options.knownBibKeys.length > 0
      ? new Set(options.knownBibKeys.flatMap((k) => [k, k.toLowerCase()]))
      : null;
  const knownLabelSet =
    options.knownLabels && options.knownLabels.length > 0
      ? new Set(options.knownLabels)
      : null;

  const seenLabels = new Set<string>();
  const envStack: Array<{ name: string; offset: number; len: number }> = [];
  const braceStack: Array<{ offset: number }> = [];

  let inInlineDollar = false;
  let inlineDollarStart = -1;
  let inInlineParen = false;
  let inlineParenStart = -1;
  let inDisplayBracket = false;
  let displayBracketStart = -1;
  let inDisplayDollar = false;
  let displayDollarStart = -1;

  let activeVerbatimEnv: string | null = null;
  let inNovalidate = false;
  let ifFalseDepth = 0;

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const rawLine = lines[lineIdx];
    const lineStart = lineStarts[lineIdx];
    const trimmed = rawLine.trim();

    if (trimmed === '%begin novalidate') {
      inNovalidate = true;
      continue;
    }
    if (trimmed === '%end novalidate') {
      inNovalidate = false;
      continue;
    }
    if (inNovalidate) continue;

    if (activeVerbatimEnv) {
      const endMatch = rawLine.match(/\\end\{([^}]+)\}/);
      if (endMatch?.[1]?.trim() === activeVerbatimEnv) {
        activeVerbatimEnv = null;
      }
      continue;
    }

    if (!trimmed) {
      if (inInlineDollar && inlineDollarStart >= 0) {
        diagnostics.push({
          from: inlineDollarStart,
          to: Math.min(inlineDollarStart + 1, text.length),
          severity: 'error',
          message: 'Unclosed inline math delimiter "$" before blank line.',
          source: 'LaTeX Linter',
          code: 'MISSING_MATH_DELIMITER',
        });
        inInlineDollar = false;
        inlineDollarStart = -1;
      }
      if (inInlineParen && inlineParenStart >= 0) {
        diagnostics.push({
          from: inlineParenStart,
          to: Math.min(inlineParenStart + 2, text.length),
          severity: 'error',
          message: 'Unclosed inline math delimiter "\\(" before blank line.',
          source: 'LaTeX Linter',
          code: 'MISSING_MATH_DELIMITER',
        });
        inInlineParen = false;
        inlineParenStart = -1;
      }
      continue;
    }

    const codeOnly = maskVerbInLine(stripCommentPreservingEscapes(rawLine));
    if (!codeOnly) continue;

    if (/\\iffalse\b/.test(codeOnly)) {
      ifFalseDepth++;
    }
    if (ifFalseDepth > 0) {
      if (/\\fi\b/.test(codeOnly)) {
        ifFalseDepth = Math.max(0, ifFalseDepth - 1);
      }
      continue;
    }

    // Macro definition lines legitimately use asymmetric braces/math tokens
    if (/^\s*\\(?:newcommand|renewcommand|providecommand|def|edef|gdef|xdef)\b/.test(codeOnly)) {
      continue;
    }

    // Track single-line vs multi-line verbatim
    const singleVerbatim = codeOnly.match(/\\begin\{([a-zA-Z0-9*]+)\}[\s\S]*?\\end\{\1\}/);
    if (singleVerbatim?.[1] && VERBATIM_ENVS.has(singleVerbatim[1])) {
      continue;
    }

    // Smart quotes warning
    const smartQuoteMatch = codeOnly.match(/[â€œâ€â€˜â€™]/);
    if (smartQuoteMatch && smartQuoteMatch.index !== undefined) {
      const quoteFrom = lineStart + smartQuoteMatch.index;
      diagnostics.push({
        from: quoteFrom,
        to: quoteFrom + 1,
        severity: 'warning',
        message: "Unicode smart quote detected. Use standard LaTeX `` or '' quotes.",
        source: 'LaTeX Linter',
        code: 'SMART_QUOTES',
      });
    }

    // Track \label declarations and check undefined \cite / \ref against known index
    for (const labelMatch of codeOnly.matchAll(/\\label\{([^}]+)\}/g)) {
      const label = labelMatch[1]?.trim();
      if (label) seenLabels.add(label);
    }

    if (knownBibSet) {
      for (const citeMatch of codeOnly.matchAll(
        /\\(?:auto|paren|text|foot|no|new|short)?cite(?:p|t|alt|alp|author|year|date|num|a)?\*?(?:\[[^\]]*\])*\{([^}]*)\}/g,
      )) {
        const rawKeys = citeMatch[1] ?? '';
        const openBraceOffset = lineStart + (citeMatch.index ?? 0) + citeMatch[0].lastIndexOf('{') + 1;
        let partOffset = 0;
        for (const rawPart of rawKeys.split(',')) {
          const key = rawPart.trim();
          const tokenOffset = rawPart.indexOf(key);
          const keyFrom = openBraceOffset + partOffset + (tokenOffset >= 0 ? tokenOffset : 0);
          partOffset += rawPart.length + 1;
          if (!key || key === '*') continue;
          if (!knownBibSet.has(key) && !knownBibSet.has(key.toLowerCase())) {
            diagnostics.push({
              from: keyFrom,
              to: keyFrom + key.length,
              severity: 'warning',
              message: `Citation key "${key}" not found in project bibliography (.bib).`,
              source: 'LaTeX Linter',
              code: 'UNDEFINED_CITATION',
            });
          }
        }
      }
    }

    if (knownLabelSet) {
      for (const refMatch of codeOnly.matchAll(
        /\\(?:eq|page|auto|name|v)?[cC]?ref\*?\{([^}]+)\}/g,
      )) {
        const rawLabels = refMatch[1] ?? '';
        const openBraceOffset = lineStart + (refMatch.index ?? 0) + refMatch[0].lastIndexOf('{') + 1;
        let partOffset = 0;
        for (const rawPart of rawLabels.split(',')) {
          const label = rawPart.trim();
          const tokenOffset = rawPart.indexOf(label);
          const labelFrom = openBraceOffset + partOffset + (tokenOffset >= 0 ? tokenOffset : 0);
          partOffset += rawPart.length + 1;
          if (!label) continue;
          if (!knownLabelSet.has(label) && !seenLabels.has(label)) {
            diagnostics.push({
              from: labelFrom,
              to: labelFrom + label.length,
              severity: 'warning',
              message: `Reference label "${label}" is not defined in project files.`,
              source: 'LaTeX Linter',
              code: 'UNDEFINED_REFERENCE',
            });
          }
        }
      }
    }

    // Character-level scan for braces, environments, and math delimiters
    let i = 0;
    while (i < codeOnly.length) {
      const char = codeOnly[i];
      const next = codeOnly[i + 1] ?? '';

      if (char === '\\') {
        if (next === '(') {
          inInlineParen = true;
          inlineParenStart = lineStart + i;
          i += 2;
          continue;
        }
        if (next === ')') {
          inInlineParen = false;
          inlineParenStart = -1;
          i += 2;
          continue;
        }
        if (next === '[') {
          inDisplayBracket = true;
          displayBracketStart = lineStart + i;
          i += 2;
          continue;
        }
        if (next === ']') {
          inDisplayBracket = false;
          displayBracketStart = -1;
          i += 2;
          continue;
        }

        const slice = codeOnly.slice(i);
        const beginMatch = slice.match(/^\\begin\{([^}]+)\}/);
        if (beginMatch?.[1]) {
          const envName = beginMatch[1].trim();
          if (VERBATIM_ENVS.has(envName)) {
            activeVerbatimEnv = envName;
            break;
          }
          envStack.push({
            name: envName,
            offset: lineStart + i,
            len: beginMatch[0].length,
          });
          i += beginMatch[0].length;
          continue;
        }

        const endMatch = slice.match(/^\\end\{([^}]+)\}/);
        if (endMatch?.[1]) {
          const endName = endMatch[1].trim();
          const endFrom = lineStart + i;
          const endTo = endFrom + endMatch[0].length;
          const top = envStack[envStack.length - 1];
          if (!top) {
            diagnostics.push({
              from: endFrom,
              to: endTo,
              severity: 'error',
              message: `Stray \\end{${endName}} with no matching \\begin{${endName}}.`,
              source: 'LaTeX Linter',
              code: 'ENVIRONMENT_MISMATCH',
            });
          } else if (top.name === endName) {
            envStack.pop();
          } else {
            const matchIdx = envStack.map((entry) => entry.name).lastIndexOf(endName);
            if (matchIdx === -1) {
              diagnostics.push({
                from: endFrom,
                to: endTo,
                severity: 'error',
                message: `\\begin{${top.name}} ended by \\end{${endName}}.`,
                source: 'LaTeX Linter',
                code: 'ENVIRONMENT_MISMATCH',
              });
            } else {
              while (envStack.length - 1 > matchIdx) {
                const unclosed = envStack.pop()!;
                diagnostics.push({
                  from: unclosed.offset,
                  to: unclosed.offset + unclosed.len,
                  severity: 'error',
                  message: `Unclosed environment \\begin{${unclosed.name}} before \\end{${endName}}.`,
                  source: 'LaTeX Linter',
                  code: 'ENVIRONMENT_MISMATCH',
                });
              }
              envStack.pop();
            }
          }
          i += endMatch[0].length;
          continue;
        }

        // Skip escaped char (\$, \{, \}, \\, etc.) or command name
        if (next && !/[a-zA-Z]/.test(next)) {
          i += 2;
        } else {
          i++;
          while (i < codeOnly.length && /[a-zA-Z@*]/.test(codeOnly[i])) i++;
        }
        continue;
      }

      if (char === '$' && next === '$') {
        inDisplayDollar = !inDisplayDollar;
        displayDollarStart = inDisplayDollar ? lineStart + i : -1;
        i += 2;
        continue;
      }

      if (char === '$') {
        inInlineDollar = !inInlineDollar;
        inlineDollarStart = inInlineDollar ? lineStart + i : -1;
        i++;
        continue;
      }

      if (char === '{') {
        braceStack.push({ offset: lineStart + i });
      } else if (char === '}') {
        if (braceStack.length === 0) {
          diagnostics.push({
            from: lineStart + i,
            to: lineStart + i + 1,
            severity: 'error',
            message: 'Unmatched closing brace "}".',
            source: 'LaTeX Linter',
            code: 'UNBALANCED_BRACES',
          });
        } else {
          braceStack.pop();
        }
      }

      i++;
    }
  }

  for (const unclosedBrace of braceStack.slice(-5)) {
    diagnostics.push({
      from: unclosedBrace.offset,
      to: Math.min(unclosedBrace.offset + 1, text.length),
      severity: 'error',
      message: 'Unclosed opening brace "{".',
      source: 'LaTeX Linter',
      code: 'UNBALANCED_BRACES',
    });
  }

  for (const unclosedEnv of envStack) {
    diagnostics.push({
      from: unclosedEnv.offset,
      to: unclosedEnv.offset + unclosedEnv.len,
      severity: 'error',
      message: `Unclosed environment \\begin{${unclosedEnv.name}}.`,
      source: 'LaTeX Linter',
      code: 'ENVIRONMENT_MISMATCH',
    });
  }

  if (inDisplayDollar && displayDollarStart >= 0) {
    diagnostics.push({
      from: displayDollarStart,
      to: Math.min(displayDollarStart + 2, text.length),
      severity: 'error',
      message: 'Unclosed display math delimiter "$$".',
      source: 'LaTeX Linter',
      code: 'MISSING_MATH_DELIMITER',
    });
  }
  if (inDisplayBracket && displayBracketStart >= 0) {
    diagnostics.push({
      from: displayBracketStart,
      to: Math.min(displayBracketStart + 2, text.length),
      severity: 'error',
      message: 'Unclosed display math delimiter "\\[".',
      source: 'LaTeX Linter',
      code: 'MISSING_MATH_DELIMITER',
    });
  }
  if (inInlineDollar && inlineDollarStart >= 0) {
    diagnostics.push({
      from: inlineDollarStart,
      to: Math.min(inlineDollarStart + 1, text.length),
      severity: 'error',
      message: 'Unclosed inline math delimiter "$".',
      source: 'LaTeX Linter',
      code: 'MISSING_MATH_DELIMITER',
    });
  }
  if (inInlineParen && inlineParenStart >= 0) {
    diagnostics.push({
      from: inlineParenStart,
      to: Math.min(inlineParenStart + 2, text.length),
      severity: 'error',
      message: 'Unclosed inline math delimiter "\\(".',
      source: 'LaTeX Linter',
      code: 'MISSING_MATH_DELIMITER',
    });
  }

  const retracted = scanRetractedCitations(text, options.retractedCitationsMap);
  return [...diagnostics, ...retracted];
}
