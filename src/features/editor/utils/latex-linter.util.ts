/**
 * latex-linter.util.ts
 *
 * Real-time LaTeX structural & syntax diagnostics engine (Overleaf Parity).
 * Detects classic LaTeX pitfalls before compilation:
 *  - Unmatched / unclosed environments (\begin{} without \end{})
 *  - Unmatched curly braces (missing { or })
 *  - Unescaped % causing accidental line comment-out (e.g. "95%")
 *  - Unescaped _ outside math mode (causing "Missing $ inserted")
 *  - Unescaped & outside tabular/alignment environments (causing "Misplaced alignment tab")
 *  - Unclosed inline math mode ($ ... $)
 *  - Duplicate \label{} definitions
 *  - Undefined \ref{} references
 *  - Deprecated LaTeX 2.09 commands (\bf, \it, etc.)
 *  - Common LaTeX command typos (\seciton, \beging, etc.)
 *
 * Fast, pure TypeScript, non-blocking, zero external dependencies.
 */

export interface LatexLintDiagnostic {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
  message: string;
  severity: 'error' | 'warning' | 'info';
  code: string;
  suggestions?: string[];
}

export interface RetractedItemInfo {
  title?: string;
  reason?: string;
  nature?: string;
  noticeUrl?: string;
}

export interface LatexLinterOptions {
  enableStructureLint?: boolean;
  enableSyntaxDiagnostics?: boolean;
  retractedItemsMap?: Map<string, RetractedItemInfo>;
}

// ── Deprecated LaTeX 2.09 Command Map ─────────────────────────────────────────
const DEPRECATED_COMMANDS: Record<string, { replacement: string; desc: string }> = {
  '\\bf': { replacement: '\\textbf{...}', desc: 'Use modern \\textbf{...} instead of obsolete \\bf' },
  '\\it': { replacement: '\\textit{...}', desc: 'Use modern \\textit{...} instead of obsolete \\it' },
  '\\rm': { replacement: '\\textrm{...}', desc: 'Use modern \\textrm{...} instead of obsolete \\rm' },
  '\\tt': { replacement: '\\texttt{...}', desc: 'Use modern \\texttt{...} instead of obsolete \\tt' },
  '\\sf': { replacement: '\\textsf{...}', desc: 'Use modern \\textsf{...} instead of obsolete \\sf' },
  '\\sc': { replacement: '\\textsc{...}', desc: 'Use modern \\textsc{...} instead of obsolete \\sc' },
  '\\sl': { replacement: '\\textsl{...}', desc: 'Use modern \\textsl{...} instead of obsolete \\sl' },
};

// ── Common LaTeX Command Typos ────────────────────────────────────────────────
const COMMAND_TYPOS: Record<string, string> = {
  '\\beging': '\\begin',
  '\\endd': '\\end',
  '\\seciton': '\\section',
  '\\subection': '\\subsection',
  '\\subsubection': '\\subsubsection',
  '\\textb': '\\textbf',
  '\\texti': '\\textit',
  '\\emphs': '\\emph',
  '\\centeringg': '\\centering',
  '\\includegraphic': '\\includegraphics',
  '\\documentclas': '\\documentclass',
  '\\usepackag': '\\usepackage',
  '\\bibliograph': '\\bibliography',
};

// Alignment environments where unescaped & is valid
const ALIGNMENT_ENVIRONMENTS = new Set([
  'tabular', 'tabular*', 'array', 'align', 'align*', 'aligned',
  'gather', 'gather*', 'gathered', 'matrix', 'pmatrix', 'bmatrix',
  'Bmatrix', 'vmatrix', 'Vmatrix', 'cases', 'dcases', 'rcases',
  'alignat', 'alignat*', 'flalign', 'flalign*', 'split', 'multline', 'multline*',
]);

// Math environments where unescaped _ and ^ are valid
const MATH_ENVIRONMENTS = new Set([
  'equation', 'equation*', 'align', 'align*', 'aligned', 'gather',
  'gather*', 'gathered', 'multline', 'multline*', 'split', 'math',
  'displaymath', 'matrix', 'pmatrix', 'bmatrix', 'cases', 'dcases',
]);

/**
 * Strips comments from a single line while respecting escaped \%
 */
export function stripLineComment(line: string): string {
  let inEscape = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '\\') {
      inEscape = !inEscape;
    } else {
      if (ch === '%' && !inEscape) {
        return line.slice(0, i);
      }
      inEscape = false;
    }
  }
  return line;
}

/**
 * 1. Lint Unmatched Curly Braces {}
 */
export function lintUnmatchedBraces(text: string): LatexLintDiagnostic[] {
  const diagnostics: LatexLintDiagnostic[] = [];
  const lines = text.split(/\r?\n/);
  const stack: Array<{ line: number; col: number }> = [];

  lines.forEach((lineText, lineIdx) => {
    const lineNum = lineIdx + 1;
    const cleanLine = stripLineComment(lineText);

    let inEscape = false;
    for (let colIdx = 0; colIdx < cleanLine.length; colIdx++) {
      const ch = cleanLine[colIdx];
      if (ch === '\\') {
        inEscape = !inEscape;
        continue;
      }

      if (!inEscape) {
        if (ch === '{') {
          stack.push({ line: lineNum, col: colIdx + 1 });
        } else if (ch === '}') {
          if (stack.length === 0) {
            diagnostics.push({
              startLineNumber: lineNum,
              startColumn: colIdx + 1,
              endLineNumber: lineNum,
              endColumn: colIdx + 2,
              message: "Unmatched closing brace '}'. Found '}' without matching '{'",
              severity: 'error',
              code: 'UNMATCHED_CLOSING_BRACE',
            });
          } else {
            stack.pop();
          }
        }
      }

      inEscape = false;
    }
  });

  // Any remaining unclosed {
  for (const unclosed of stack) {
    diagnostics.push({
      startLineNumber: unclosed.line,
      startColumn: unclosed.col,
      endLineNumber: unclosed.line,
      endColumn: unclosed.col + 1,
      message: "Unclosed opening brace '{'. Missing matching '}'",
      severity: 'error',
      code: 'UNCLOSED_OPENING_BRACE',
      suggestions: ['}'],
    });
  }

  return diagnostics;
}

/**
 * 2. Lint LaTeX Environments (\begin{} and \end{})
 */
export function lintEnvironments(text: string): LatexLintDiagnostic[] {
  const diagnostics: LatexLintDiagnostic[] = [];
  const lines = text.split(/\r?\n/);
  const envStack: Array<{ name: string; line: number; col: number }> = [];
  const beginEndRegex = /\\(begin|end)\{([a-zA-Z0-9*_-]+)\}/g;

  lines.forEach((lineText, lineIdx) => {
    const lineNum = lineIdx + 1;
    const activeText = stripLineComment(lineText);

    let match: RegExpExecArray | null;
    beginEndRegex.lastIndex = 0;
    while ((match = beginEndRegex.exec(activeText)) !== null) {
      const type = match[1];
      const envName = match[2];
      const colNum = match.index + 1;

      if (type === 'begin') {
        envStack.push({ name: envName, line: lineNum, col: colNum });
      } else if (type === 'end') {
        if (envStack.length === 0) {
          diagnostics.push({
            startLineNumber: lineNum,
            startColumn: colNum,
            endLineNumber: lineNum,
            endColumn: colNum + match[0].length,
            message: `Found \\end{${envName}} without matching \\begin{${envName}}`,
            severity: 'error',
            code: 'EXTRA_END_ENV',
          });
        } else {
          const last = envStack[envStack.length - 1];
          if (last.name === envName) {
            envStack.pop();
          } else {
            diagnostics.push({
              startLineNumber: lineNum,
              startColumn: colNum,
              endLineNumber: lineNum,
              endColumn: colNum + match[0].length,
              message: `Mismatched environment: \\begin{${last.name}} (line ${last.line}) closed by \\end{${envName}}`,
              severity: 'error',
              code: 'MISMATCHED_ENV',
              suggestions: [`\\end{${last.name}}`],
            });
            envStack.pop();
          }
        }
      }
    }
  });

  for (const unclosed of envStack) {
    diagnostics.push({
      startLineNumber: unclosed.line,
      startColumn: unclosed.col,
      endLineNumber: unclosed.line,
      endColumn: unclosed.col + `\\begin{${unclosed.name}}`.length,
      message: `Unclosed environment: \\begin{${unclosed.name}} is missing closing \\end{${unclosed.name}}`,
      severity: 'error',
      code: 'UNCLOSED_ENV',
      suggestions: [`\\end{${unclosed.name}}`],
    });
  }

  return diagnostics;
}

/**
 * 3. Lint Unescaped Special Characters: %, _, & outside expected contexts
 */
export function lintSpecialCharacters(text: string): LatexLintDiagnostic[] {
  const diagnostics: LatexLintDiagnostic[] = [];
  const lines = text.split(/\r?\n/);

  // Track active environments
  const activeEnvs: string[] = [];
  let inDisplayMath = false;

  lines.forEach((lineText, lineIdx) => {
    const lineNum = lineIdx + 1;

    // Check display math delimiters
    if (lineText.includes('\\[') && !lineText.includes('\\]')) inDisplayMath = true;
    if (lineText.includes('\\]')) inDisplayMath = false;

    // Track \begin and \end on this line to update activeEnvs
    const envMatches = lineText.matchAll(/\\(begin|end)\{([a-zA-Z0-9*_-]+)\}/g);
    for (const m of envMatches) {
      if (m[1] === 'begin') activeEnvs.push(m[2]);
      else if (m[1] === 'end') {
        const idx = activeEnvs.lastIndexOf(m[2]);
        if (idx !== -1) activeEnvs.splice(idx, 1);
      }
    }

    const currentEnv = activeEnvs[activeEnvs.length - 1] || '';
    const isInsideMathEnv = inDisplayMath || MATH_ENVIRONMENTS.has(currentEnv);
    const isInsideAlignEnv = ALIGNMENT_ENVIRONMENTS.has(currentEnv);

    // ── Check A: Unescaped % after alphanumeric characters ──────────────────
    // e.g. "95% of data", "accuracy: 100%"
    const unescapedPercentRegex = /([a-zA-Z0-9)\]])(\s*)%/g;
    let pctMatch: RegExpExecArray | null;
    while ((pctMatch = unescapedPercentRegex.exec(lineText)) !== null) {
      const matchIndex = pctMatch.index + pctMatch[1].length + pctMatch[2].length;
      if (lineText[matchIndex - 1] !== '\\') {
        diagnostics.push({
          startLineNumber: lineNum,
          startColumn: matchIndex + 1,
          endLineNumber: lineNum,
          endColumn: matchIndex + 2,
          message: "Unescaped '%' comments out the rest of this line. Did you mean '\\%'?",
          severity: 'warning',
          code: 'UNESCAPED_PERCENT',
          suggestions: ['\\%'],
        });
      }
    }

    // Now work with clean line (without comments) for _ and & checks
    const cleanLine = stripLineComment(lineText);

    // ── Check B: Unescaped & outside alignment environments ─────────────────
    if (!isInsideAlignEnv) {
      let inEscape = false;
      let inInlineMath = false;

      for (let colIdx = 0; colIdx < cleanLine.length; colIdx++) {
        const ch = cleanLine[colIdx];
        if (ch === '\\') {
          inEscape = !inEscape;
          continue;
        }

        if (ch === '$' && !inEscape) {
          inInlineMath = !inInlineMath;
        } else if (ch === '&' && !inEscape && !inInlineMath) {
          diagnostics.push({
            startLineNumber: lineNum,
            startColumn: colIdx + 1,
            endLineNumber: lineNum,
            endColumn: colIdx + 2,
            message: "Unescaped '&' outside tabular/alignment environment. Use '\\&' for ampersand.",
            severity: 'error',
            code: 'UNESCAPED_AMPERSAND',
            suggestions: ['\\&'],
          });
        }

        inEscape = false;
      }
    }

    // ── Check C: Unescaped _ outside math mode and outside URL/cite/label ────
    if (!isInsideMathEnv) {
      // Mask allowed commands like \cite{...}, \label{...}, \ref{...}, \url{...}, \href{...}, \includegraphics{...}
      let maskedLine = cleanLine.replace(/\\(cite|citep|citet|ref|pageref|eqref|label|url|href|includegraphics|input|include)(?:\[[^\]]*\])?\{[^}]*\}/g, (m) => ' '.repeat(m.length));

      let inEscape = false;
      let inInlineMath = false;

      for (let colIdx = 0; colIdx < maskedLine.length; colIdx++) {
        const ch = maskedLine[colIdx];
        if (ch === '\\') {
          inEscape = !inEscape;
          continue;
        }

        if (ch === '$' && !inEscape) {
          inInlineMath = !inInlineMath;
        } else if (ch === '_' && !inEscape && !inInlineMath) {
          diagnostics.push({
            startLineNumber: lineNum,
            startColumn: colIdx + 1,
            endLineNumber: lineNum,
            endColumn: colIdx + 2,
            message: "Unescaped '_' outside math mode causes 'Missing $ inserted'. Use '\\_' or wrap in math '$...$'.",
            severity: 'error',
            code: 'UNESCAPED_UNDERSCORE',
            suggestions: ['\\_'],
          });
        }

        inEscape = false;
      }
    }
  });

  return diagnostics;
}

/**
 * 4. Lint Inline Math Mode ($ count per line / block)
 */
export function lintInlineMath(text: string): LatexLintDiagnostic[] {
  const diagnostics: LatexLintDiagnostic[] = [];
  const lines = text.split(/\r?\n/);

  lines.forEach((lineText, lineIdx) => {
    const lineNum = lineIdx + 1;
    const cleanLine = stripLineComment(lineText);

    // Count unescaped single $ (ignore $$ and \$)
    let dollarCount = 0;
    let lastDollarCol = -1;
    let inEscape = false;

    for (let i = 0; i < cleanLine.length; i++) {
      const ch = cleanLine[i];
      if (ch === '\\') {
        inEscape = !inEscape;
        continue;
      }

      if (ch === '$' && !inEscape) {
        // Skip if double $$
        if (i + 1 < cleanLine.length && cleanLine[i + 1] === '$') {
          i++; // skip next $
        } else {
          dollarCount++;
          lastDollarCol = i + 1;
        }
      }

      inEscape = false;
    }

    if (dollarCount % 2 !== 0 && lastDollarCol !== -1) {
      diagnostics.push({
        startLineNumber: lineNum,
        startColumn: lastDollarCol,
        endLineNumber: lineNum,
        endColumn: lastDollarCol + 1,
        message: "Unclosed inline math mode '$'. Missing closing '$' on this line.",
        severity: 'error',
        code: 'UNCLOSED_INLINE_MATH',
        suggestions: ['$'],
      });
    }
  });

  return diagnostics;
}

/**
 * 5. Lint Duplicate Labels & Undefined References
 */
export function lintLabelsAndReferences(text: string): LatexLintDiagnostic[] {
  const diagnostics: LatexLintDiagnostic[] = [];
  const lines = text.split(/\r?\n/);

  const definedLabels = new Map<string, { line: number; col: number }>();
  const references: Array<{ key: string; cmd: string; line: number; col: number; len: number }> = [];

  const labelRegex = /\\label\{([^}]+)\}/g;
  const refRegex = /\\(ref|pageref|eqref|autoref|nameref)\{([^}]+)\}/g;

  lines.forEach((lineText, lineIdx) => {
    const lineNum = lineIdx + 1;
    const cleanLine = stripLineComment(lineText);

    // Find \label{...}
    let lMatch: RegExpExecArray | null;
    labelRegex.lastIndex = 0;
    while ((lMatch = labelRegex.exec(cleanLine)) !== null) {
      const key = lMatch[1].trim();
      const col = lMatch.index + 1;
      if (definedLabels.has(key)) {
        const first = definedLabels.get(key)!;
        diagnostics.push({
          startLineNumber: lineNum,
          startColumn: col,
          endLineNumber: lineNum,
          endColumn: col + lMatch[0].length,
          message: `Duplicate label '\\label{${key}}'. Previously defined at line ${first.line}.`,
          severity: 'warning',
          code: 'DUPLICATE_LABEL',
        });
      } else {
        definedLabels.set(key, { line: lineNum, col });
      }
    }

    // Find \ref{...}
    let rMatch: RegExpExecArray | null;
    refRegex.lastIndex = 0;
    while ((rMatch = refRegex.exec(cleanLine)) !== null) {
      const cmd = rMatch[1];
      const key = rMatch[2].trim();
      const col = rMatch.index + 1;
      references.push({ key, cmd, line: lineNum, col, len: rMatch[0].length });
    }
  });

  // Check undefined references (if document defines any labels at all)
  if (definedLabels.size > 0) {
    for (const ref of references) {
      if (!definedLabels.has(ref.key)) {
        diagnostics.push({
          startLineNumber: ref.line,
          startColumn: ref.col,
          endLineNumber: ref.line,
          endColumn: ref.col + ref.len,
          message: `Reference '\\${ref.cmd}{${ref.key}}' references an undefined label '${ref.key}'.`,
          severity: 'warning',
          code: 'UNDEFINED_REFERENCE',
        });
      }
    }
  }

  return diagnostics;
}

/**
 * 6. Lint Deprecated Commands & Command Typos
 */
export function lintCommandsAndTypos(text: string): LatexLintDiagnostic[] {
  const diagnostics: LatexLintDiagnostic[] = [];
  const lines = text.split(/\r?\n/);

  lines.forEach((lineText, lineIdx) => {
    const lineNum = lineIdx + 1;
    const cleanLine = stripLineComment(lineText);

    // A. Check Deprecated LaTeX 2.09 commands (\bf, \it, etc.)
    for (const [cmd, info] of Object.entries(DEPRECATED_COMMANDS)) {
      const idx = cleanLine.indexOf(cmd);
      if (idx !== -1) {
        const afterChar = cleanLine[idx + cmd.length];
        if (!afterChar || /[^a-zA-Z]/.test(afterChar)) {
          diagnostics.push({
            startLineNumber: lineNum,
            startColumn: idx + 1,
            endLineNumber: lineNum,
            endColumn: idx + 1 + cmd.length,
            message: info.desc,
            severity: 'warning',
            code: 'DEPRECATED_COMMAND',
            suggestions: [info.replacement],
          });
        }
      }
    }

    // B. Check Command Typos
    for (const [typo, correct] of Object.entries(COMMAND_TYPOS)) {
      const idx = cleanLine.indexOf(typo);
      if (idx !== -1) {
        const afterChar = cleanLine[idx + typo.length];
        if (!afterChar || /[^a-zA-Z]/.test(afterChar) || afterChar === '{') {
          diagnostics.push({
            startLineNumber: lineNum,
            startColumn: idx + 1,
            endLineNumber: lineNum,
            endColumn: idx + 1 + typo.length,
            message: `Unknown or mistyped LaTeX command '${typo}'. Did you mean '${correct}'?`,
            severity: 'error',
            code: 'COMMAND_TYPO',
            suggestions: [correct],
          });
        }
      }
    }

    // C. Check Empty \ref{}, \cite{}, \label{}
    const emptyRefRegex = /\\(cite|ref|label|pageref|eqref)\{\s*\}/g;
    let emptyMatch: RegExpExecArray | null;
    while ((emptyMatch = emptyRefRegex.exec(cleanLine)) !== null) {
      diagnostics.push({
        startLineNumber: lineNum,
        startColumn: emptyMatch.index + 1,
        endLineNumber: lineNum,
        endColumn: emptyMatch.index + 1 + emptyMatch[0].length,
        message: `Empty argument in \\${emptyMatch[1]}{}. Provide a reference/cite key.`,
        severity: 'warning',
        code: 'EMPTY_REFERENCE',
      });
    }
  });

  return diagnostics;
}

/**
 * 7. Scans document for citations referencing known retracted publications.
 */
export function lintRetractedCitations(
  text: string,
  retractedMap: Map<string, RetractedItemInfo>,
): LatexLintDiagnostic[] {
  if (!text || !retractedMap || retractedMap.size === 0) return [];
  const diagnostics: LatexLintDiagnostic[] = [];
  const lines = text.split(/\r?\n/);

  const latexCiteRegex = /\\(cite|citep|citet|parencite|textcite|nocite)(?:\[[^\]]*\])*\{([^}]+)\}/g;

  lines.forEach((lineText, lineIdx) => {
    const lineNum = lineIdx + 1;
    const cleanLine = stripLineComment(lineText);

    let match: RegExpExecArray | null;
    latexCiteRegex.lastIndex = 0;
    while ((match = latexCiteRegex.exec(cleanLine)) !== null) {
      const fullCmd = match[0];
      const keysRaw = match[2];
      const keysStartOffset = match.index + fullCmd.indexOf(keysRaw);

      let currentOffset = 0;
      const rawParts = keysRaw.split(',');
      for (const part of rawParts) {
        const trimmedKey = part.trim();
        const partIndexInRaw = keysRaw.indexOf(part, currentOffset);
        currentOffset = partIndexInRaw + part.length;

        if (trimmedKey && retractedMap.has(trimmedKey)) {
          const info = retractedMap.get(trimmedKey);
          const keyLeadingSpaces = part.indexOf(trimmedKey);
          const startCol = keysStartOffset + partIndexInRaw + keyLeadingSpaces + 1;
          const endCol = startCol + trimmedKey.length;

          diagnostics.push({
            startLineNumber: lineNum,
            startColumn: startCol,
            endLineNumber: lineNum,
            endColumn: endCol,
            message: `⚠️ Retracted Paper Warning: Citation '${trimmedKey}' (${info?.title ? `"${info.title}"` : 'Untitled'}) has been officially retracted${info?.reason ? `: ${info.reason}` : '.'}`,
            severity: 'warning',
            code: 'RETRACTED_CITATION',
            suggestions: [`% Retracted: ${trimmedKey}`],
          });
        }
      }
    }
  });

  return diagnostics;
}

/**
 * Main linter entry point: orchestrates all real-time LaTeX diagnostics.
 */
export function runLatexLinter(
  content: string,
  options: LatexLinterOptions = {},
): LatexLintDiagnostic[] {
  if (!content || typeof content !== 'string') return [];

  const {
    enableStructureLint = true,
    enableSyntaxDiagnostics = true,
    retractedItemsMap,
  } = options;

  const results: LatexLintDiagnostic[] = [];

  if (enableStructureLint) {
    results.push(...lintEnvironments(content));
    results.push(...lintUnmatchedBraces(content));
  }

  if (enableSyntaxDiagnostics) {
    results.push(...lintSpecialCharacters(content));
    results.push(...lintInlineMath(content));
    results.push(...lintLabelsAndReferences(content));
    results.push(...lintCommandsAndTypos(content));
  }

  if (retractedItemsMap && retractedItemsMap.size > 0) {
    results.push(...lintRetractedCitations(content, retractedItemsMap));
  }

  // Sort by line number, then column
  return results.sort((a, b) => {
    if (a.startLineNumber !== b.startLineNumber) {
      return a.startLineNumber - b.startLineNumber;
    }
    return a.startColumn - b.startColumn;
  });
}

