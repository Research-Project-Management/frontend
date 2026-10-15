/**
 * latex-linter.rules.ts
 *
 * Specific structural & syntax diagnostic rules and dictionaries for LaTeX documents.
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

// ── Deprecated LaTeX 2.09 Command Map ─────────────────────────────────────────
export const DEPRECATED_COMMANDS: Record<string, { replacement: string; desc: string }> = {
  '\\bf': { replacement: '\\textbf{...}', desc: 'Use modern \\textbf{...} instead of obsolete \\bf' },
  '\\it': { replacement: '\\textit{...}', desc: 'Use modern \\textit{...} instead of obsolete \\it' },
  '\\rm': { replacement: '\\textrm{...}', desc: 'Use modern \\textrm{...} instead of obsolete \\rm' },
  '\\tt': { replacement: '\\texttt{...}', desc: 'Use modern \\texttt{...} instead of obsolete \\tt' },
  '\\sf': { replacement: '\\textsf{...}', desc: 'Use modern \\textsf{...} instead of obsolete \\sf' },
  '\\sc': { replacement: '\\textsc{...}', desc: 'Use modern \\textsc{...} instead of obsolete \\sc' },
  '\\sl': { replacement: '\\textsl{...}', desc: 'Use modern \\textsl{...} instead of obsolete \\sl' },
};

// ── Common LaTeX Command Typos ────────────────────────────────────────────────
export const COMMAND_TYPOS: Record<string, string> = {
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

export const DEPRECATED_ENTRIES = Object.entries(DEPRECATED_COMMANDS);
export const TYPO_ENTRIES = Object.entries(COMMAND_TYPOS);
export const EMPTY_REF_REGEX = /\\(cite|ref|label|pageref|eqref)\{\s*\}/g;
export const ENV_MATCH_REGEX = /\\(begin|end)\{([a-zA-Z0-9*_-]+)\}/g;
export const UNESCAPED_PERCENT_REGEX = /([a-zA-Z0-9)\]])(\s*)%/g;
export const MASKED_COMMANDS_REGEX = /\\(cite|citep|citet|parencite|textcite|autocite|nocite|newcite|shortcite|citeauthor|citeyear|ref|autoref|cref|Cref|nameref|pageref|eqref|label|url|href|path|lstinline|includegraphics|Includegraphics|graphicspath|input|include|subfile|bibliography|bibliographystyle|usepackage|documentclass)\*?(?:\[[^\]]*\])*\{[^}]*\}/g;
export const LATEX_CITE_REGEX = /\\(cite|citep|citet|parencite|textcite|autocite|nocite|newcite|shortcite)(?:\[[^\]]*\])*\{([^}]+)\}/g;

/**
 * Normalizes string or string array into a string array without redundant splitting,
 * while blanking out \iffalse ... \fi conditional blocks (preserving 1-based line numbers).
 */
export function toLines(input: string | readonly string[]): readonly string[] {
  const rawLines = Array.isArray(input)
    ? input
    : typeof input === 'string'
      ? input.split(/\r?\n/)
      : [];
  let ifFalseDepth = 0;
  return rawLines.map((line) => {
    const clean = stripLineComment(line);
    if (/\\iffalse\b/.test(clean)) {
      ifFalseDepth++;
    }
    if (ifFalseDepth > 0) {
      if (/\\fi\b/.test(clean)) {
        ifFalseDepth = Math.max(0, ifFalseDepth - 1);
      }
      return '';
    }
    return line;
  });
}

// Alignment environments where unescaped & is valid (modern tables and math alignments)
export const ALIGNMENT_ENVIRONMENTS = new Set([
  'tabular', 'tabular*', 'tabularx', 'tabulary', 'longtable', 'longtable*', 'supertabular',
  'xltabular', 'tblr', 'longtblr', 'NiceTabular', 'NiceTabular*', 'NiceArray', 'nicematrix', 'array', 'align', 'align*', 'aligned',
  'gather', 'gather*', 'gathered', 'matrix', 'pmatrix', 'bmatrix',
  'Bmatrix', 'vmatrix', 'Vmatrix', 'cases', 'dcases', 'rcases',
  'alignat', 'alignat*', 'flalign', 'flalign*', 'split', 'multline', 'multline*', 'subarray',
]);

/**
 * Updates display-math state (\[ ... \]) for a line. A `[`/`]` counts as a delimiter only
 * when preceded by an odd run of backslashes, so `\\[6pt]` (line break + spacing) is ignored.
 */
export function scanDisplayMath(line: string, inDisplayMath: boolean): boolean {
  let state = inDisplayMath;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '%') {
      let bs = 0;
      for (let j = i - 1; j >= 0 && line[j] === '\\'; j--) bs++;
      if (bs % 2 === 0) break;
    }
    if (ch !== '[' && ch !== ']') continue;
    let bs = 0;
    for (let j = i - 1; j >= 0 && line[j] === '\\'; j--) bs++;
    if (bs % 2 !== 1) continue;
    if (ch === '[') state = true;
    else state = false;
  }
  return state;
}

/**
 * Counts unescaped `$$` display-math delimiter pairs on a comment-stripped line.
 */
export function countDoubleDollars(cleanLine: string): number {
  let count = 0;
  let inEscape = false;
  for (let i = 0; i < cleanLine.length; i++) {
    const ch = cleanLine[i];
    if (ch === '\\') {
      inEscape = !inEscape;
      continue;
    }
    if (ch === '$' && !inEscape && cleanLine[i + 1] === '$') {
      count++;
      i++;
    }
    inEscape = false;
  }
  return count;
}

// Math environments where unescaped _ and ^ are valid
export const MATH_ENVIRONMENTS = new Set([
  'equation', 'equation*', 'align', 'align*', 'aligned', 'gather',
  'gather*', 'gathered', 'multline', 'multline*', 'split', 'math',
  'displaymath', 'matrix', 'pmatrix', 'bmatrix', 'Bmatrix', 'vmatrix', 'Vmatrix',
  'cases', 'dcases', 'rcases', 'alignat', 'alignat*', 'flalign', 'flalign*', 'subarray', ' array', 'array',
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
export function lintUnmatchedBraces(input: string | readonly string[]): LatexLintDiagnostic[] {
  const diagnostics: LatexLintDiagnostic[] = [];
  const lines = toLines(input);
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
export function lintEnvironments(input: string | readonly string[]): LatexLintDiagnostic[] {
  const diagnostics: LatexLintDiagnostic[] = [];
  const lines = toLines(input);
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
export function lintSpecialCharacters(input: string | readonly string[]): LatexLintDiagnostic[] {
  const diagnostics: LatexLintDiagnostic[] = [];
  const lines = toLines(input);

  // Track active environments
  const activeEnvs: string[] = [];
  let inDisplayMath = false;
  let inDoubleDollarMath = false;
  // Inline-math state carried across lines within a paragraph (reset on blank line)
  let paraInlineMath = false;

  lines.forEach((lineText, lineIdx) => {
    const lineNum = lineIdx + 1;

    if (lineText.trim() === '') {
      paraInlineMath = false;
    }

    // Check display math delimiters \[ ... \] (ignoring \\[6pt] line-break spacing)
    const displayMathAtStart = inDisplayMath;
    inDisplayMath = scanDisplayMath(lineText, inDisplayMath);
    // A line touches display math if it starts/ends inside it or contains a closing \] (e.g. single-line \[ x_1 \])
    const lineTouchesDisplayMath = displayMathAtStart || inDisplayMath || !scanDisplayMath(lineText, true);

    // Track \begin and \end on this line to update activeEnvs
    ENV_MATCH_REGEX.lastIndex = 0;
    let envMatch: RegExpExecArray | null;
    while ((envMatch = ENV_MATCH_REGEX.exec(lineText)) !== null) {
      if (envMatch[1] === 'begin') activeEnvs.push(envMatch[2]);
      else if (envMatch[1] === 'end') {
        const idx = activeEnvs.lastIndexOf(envMatch[2]);
        if (idx !== -1) activeEnvs.splice(idx, 1);
      }
    }

    const cleanLine = stripLineComment(lineText);
    const doubleDollarAtStart = inDoubleDollarMath;
    const ddCount = countDoubleDollars(cleanLine);
    if (ddCount % 2 === 1) {
      inDoubleDollarMath = !inDoubleDollarMath;
    }
    const lineTouchesDoubleDollar = doubleDollarAtStart || inDoubleDollarMath || ddCount > 0;

    const isInsideMathEnv =
      lineTouchesDisplayMath ||
      lineTouchesDoubleDollar ||
      activeEnvs.some((e) => MATH_ENVIRONMENTS.has(e));
    const isInsideAlignEnv = activeEnvs.some((e) => ALIGNMENT_ENVIRONMENTS.has(e));

    // ── Check A: Unescaped % immediately after alphanumeric characters ───────
    UNESCAPED_PERCENT_REGEX.lastIndex = 0;
    let pctMatch: RegExpExecArray | null;
    while ((pctMatch = UNESCAPED_PERCENT_REGEX.exec(lineText)) !== null) {
      const matchIndex = pctMatch.index + pctMatch[1].length + pctMatch[2].length;
      if (lineText[matchIndex - 1] !== '\\') {
        const restOfLine = lineText.slice(matchIndex + 1).trim();
        const isPrecededByDigit = /[0-9]/.test(pctMatch[1]);
        const hasNoSpaceBeforePct = pctMatch[2].length === 0;
        if (hasNoSpaceBeforePct && (isPrecededByDigit || restOfLine.length > 0)) {
          diagnostics.push({
            startLineNumber: lineNum,
            startColumn: matchIndex + 1,
            endLineNumber: lineNum,
            endColumn: matchIndex + 2,
            message: restOfLine.length > 0
              ? "Unescaped '%' comments out the rest of this line. Did you mean '\\%'?"
              : "Unescaped '%' used after a number. Did you mean '\\%'?",
            severity: 'warning',
            code: 'UNESCAPED_PERCENT',
            suggestions: ['\\%'],
          });
        }
      }
    }

    // ── Check B: Unescaped & outside alignment environments ─────────────────
    if (!isInsideAlignEnv && !lineTouchesDoubleDollar) {
      MASKED_COMMANDS_REGEX.lastIndex = 0;
      const maskedLineForAmp = cleanLine
        .replace(MASKED_COMMANDS_REGEX, (m) => ' '.repeat(m.length))
        .replace(/\\verb([^a-zA-Z0-9\s])[\s\S]*?\1/g, (m) => ' '.repeat(m.length));

      let inEscape = false;
      let inInlineMath = paraInlineMath;

      for (let colIdx = 0; colIdx < maskedLineForAmp.length; colIdx++) {
        const ch = maskedLineForAmp[colIdx];
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
      MASKED_COMMANDS_REGEX.lastIndex = 0;
      const maskedLine = cleanLine
        .replace(MASKED_COMMANDS_REGEX, (m) => ' '.repeat(m.length))
        .replace(/\\verb([^a-zA-Z0-9\s])[\s\S]*?\1/g, (m) => ' '.repeat(m.length));

      let inEscape = false;
      let inInlineMath = paraInlineMath;

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

    // Carry inline-math state to the next line of the same paragraph
    if (countInlineDollars(cleanLine.replace(MASKED_COMMANDS_REGEX, (m) => ' '.repeat(m.length))) % 2 === 1) {
      paraInlineMath = !paraInlineMath;
    }
  });

  return diagnostics;
}

/**
 * Counts single unescaped `$` delimiters (each `$$` pair is skipped) in a comment-stripped line.
 */
export function countInlineDollars(cleanLine: string): number {
  let count = 0;
  let inEscape = false;
  for (let i = 0; i < cleanLine.length; i++) {
    const ch = cleanLine[i];
    if (ch === '\\') {
      inEscape = !inEscape;
      continue;
    }
    if (ch === '$' && !inEscape) {
      if (cleanLine[i + 1] === '$') i++;
      else count++;
    }
    inEscape = false;
  }
  return count;
}

/**
 * 4. Lint Inline Math Mode ($ balance per paragraph). TeX allows inline math to span
 * line breaks within a paragraph, but a blank line (\par) inside $...$ is an error.
 */
export function lintInlineMath(input: string | readonly string[]): LatexLintDiagnostic[] {
  const diagnostics: LatexLintDiagnostic[] = [];
  const lines = toLines(input);

  let openDollar: { line: number; col: number } | null = null;

  const flushUnclosed = () => {
    if (openDollar) {
      diagnostics.push({
        startLineNumber: openDollar.line,
        startColumn: openDollar.col,
        endLineNumber: openDollar.line,
        endColumn: openDollar.col + 1,
        message: "Unclosed inline math mode '$'. Missing closing '$' before the end of the paragraph.",
        severity: 'error',
        code: 'UNCLOSED_INLINE_MATH',
        suggestions: ['$'],
      });
      openDollar = null;
    }
  };

  lines.forEach((lineText, lineIdx) => {
    const lineNum = lineIdx + 1;
    if (lineText.trim() === '') {
      flushUnclosed();
      return;
    }
    const cleanLine = stripLineComment(lineText);
    let inEscape = false;

    for (let i = 0; i < cleanLine.length; i++) {
      const ch = cleanLine[i];
      if (ch === '\\') {
        inEscape = !inEscape;
        continue;
      }

      if (ch === '$' && !inEscape) {
        if (i + 1 < cleanLine.length && cleanLine[i + 1] === '$') {
          i++; // skip display-math $$
        } else if (openDollar) {
          openDollar = null;
        } else {
          openDollar = { line: lineNum, col: i + 1 };
        }
      }

      inEscape = false;
    }
  });

  flushUnclosed();
  return diagnostics;
}

/**
 * 5. Lint Duplicate Labels & Undefined References
 */
export function lintLabelsAndReferences(
  input: string | readonly string[],
  projectLabels?: Set<string> | string[]
): LatexLintDiagnostic[] {
  const diagnostics: LatexLintDiagnostic[] = [];
  const lines = toLines(input);

  const definedLabels = new Map<string, { line: number; col: number }>();
  const externalLabels = new Set<string>();

  if (projectLabels) {
    for (const l of projectLabels) externalLabels.add(l);
  }

  const references: Array<{ key: string; cmd: string; line: number; col: number; len: number }> = [];

  const labelRegex = /\\label\{([^}]+)\}/g;
  const refRegex = /\\(ref|pageref|eqref|autoref|nameref|cref|Cref)\*?\{([^}]+)\}/g;

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

    // Find \ref{...} / \cref{key1,key2}
    let rMatch: RegExpExecArray | null;
    refRegex.lastIndex = 0;
    while ((rMatch = refRegex.exec(cleanLine)) !== null) {
      const cmd = rMatch[1];
      const rawKeys = rMatch[2];
      const col = rMatch.index + 1;
      for (const part of rawKeys.split(',')) {
        const key = part.trim();
        if (key) {
          references.push({ key, cmd, line: lineNum, col, len: rMatch[0].length });
        }
      }
    }
  });

  // Undefined references: labels may live in sibling files of a multi-file project. Only
  // report when the full project label set is supplied, or the file is a standalone
  // document (has \documentclass, i.e. single-file / root compile unit).
  const hasDocumentClass = lines.some((l) => /\\documentclass\b/.test(stripLineComment(l)));
  const includesOtherFiles = lines.some((l) => /\\(input|include|subfile|import|subimport|externaldocument)\b/.test(stripLineComment(l)));
  const isSingleFile = hasDocumentClass && !includesOtherFiles;
  const canCheckUndefined = externalLabels.size > 0 || isSingleFile;
  if (canCheckUndefined) {
    for (const ref of references) {
      if (!definedLabels.has(ref.key) && !externalLabels.has(ref.key)) {
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
export function lintCommandsAndTypos(input: string | readonly string[]): LatexLintDiagnostic[] {
  const diagnostics: LatexLintDiagnostic[] = [];
  const lines = toLines(input);

  lines.forEach((lineText, lineIdx) => {
    const lineNum = lineIdx + 1;
    const cleanLine = stripLineComment(lineText);

    // A. Check Deprecated LaTeX 2.09 commands (\bf, \it, etc.)
    for (const [cmd, info] of DEPRECATED_ENTRIES) {
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
    for (const [typo, correct] of TYPO_ENTRIES) {
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
    EMPTY_REF_REGEX.lastIndex = 0;
    let emptyMatch: RegExpExecArray | null;
    while ((emptyMatch = EMPTY_REF_REGEX.exec(cleanLine)) !== null) {
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
  input: string | readonly string[],
  retractedMap: Map<string, RetractedItemInfo>,
): LatexLintDiagnostic[] {
  if (!input || !retractedMap || retractedMap.size === 0) return [];
  const diagnostics: LatexLintDiagnostic[] = [];
  const lines = toLines(input);

  lines.forEach((lineText, lineIdx) => {
    const lineNum = lineIdx + 1;
    const cleanLine = stripLineComment(lineText);

    let match: RegExpExecArray | null;
    LATEX_CITE_REGEX.lastIndex = 0;
    while ((match = LATEX_CITE_REGEX.exec(cleanLine)) !== null) {
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
            message: `Retracted Paper Warning: Citation '${trimmedKey}' (${info?.title ? `"${info.title}"` : 'Untitled'}) has been officially retracted${info?.reason ? `: ${info.reason}` : '.'}`,
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
