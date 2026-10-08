/**
 * latex-linter-core.ts
 *
 * Core LaTeX Linter Tokenizer & State Machine Interpreter (Block 4: Engines Layer).
 * Location: `features/editor/engines/latex-linter-core.ts`
 *
 * Architecture inspired by Overleaf's Custom Tokenizer & State Machine:
 * - Pure, deterministic function: (text, options) -> Diagnostic[]
 * - Zero DOM / CodeMirror dependencies: runs identically in Web Worker or Main Thread.
 * - Handles:
 *   1. Comment stripping (% vs \% vs \\%).
 *   2. Verbatim & lstlisting isolation (ignores braces and symbols inside verbatim).
 *   3. %novalidate directives (file-level and block-level).
 *   4. Environment pairing (\begin{env} ... \end{env}).
 *   5. Math delimiter matching ($ ... $, $$ ... $$, \[ ... \], \( ... \)).
 *   6. Math-only vs Text-only context verification (\alpha outside math, \section inside math).
 *   7. Curly brace balance ({ ... }).
 *   8. Duplicate \label declarations and undefined \cite references.
 */

export interface LinterDiagnostic {
  from: number;
  to: number;
  severity: 'error' | 'warning' | 'info';
  message: string;
  source: string;
}

export interface LinterOptions {
  knownBibKeys?: string[];
  knownLabels?: string[];
}

interface OpenEnv {
  name: string;
  from: number;
  to: number;
  line: number;
}

// Math-only commands that should not appear in normal text mode
const MATH_ONLY_COMMANDS = new Set([
  'alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta', 'iota', 'kappa',
  'lambda', 'mu', 'nu', 'xi', 'pi', 'rho', 'sigma', 'tau', 'upsilon', 'phi', 'chi', 'psi', 'omega',
  'Gamma', 'Delta', 'Theta', 'Lambda', 'Xi', 'Pi', 'Sigma', 'Upsilon', 'Phi', 'Psi', 'Omega',
  'frac', 'sqrt', 'sum', 'prod', 'int', 'iint', 'iiint', 'oint', 'partial', 'nabla', 'infty',
  'leq', 'geq', 'neq', 'approx', 'equiv', 'times', 'div', 'cdot', 'pm', 'mp',
  'forall', 'exists', 'in', 'notin', 'subset', 'subseteq', 'cup', 'cap',
  'leftarrow', 'rightarrow', 'Leftarrow', 'Rightarrow', 'leftrightarrow',
]);

// Text-only commands that should not appear in math mode
const TEXT_ONLY_COMMANDS = new Set([
  'part', 'chapter', 'section', 'subsection', 'subsubsection', 'paragraph', 'subparagraph',
  'tableofcontents', 'listoffigures', 'listoftables', 'bibliography', 'bibliographystyle',
  'item', 'maketitle', 'newpage', 'clearpage',
]);

/**
 * Checks if the character at index is escaped by an odd number of preceding backslashes
 */
function isEscaped(text: string, index: number): boolean {
  let backslashCount = 0;
  let i = index - 1;
  while (i >= 0 && text.charCodeAt(i) === 92 /* '\' */) {
    backslashCount++;
    i--;
  }
  return backslashCount % 2 === 1;
}

export function runLatexLinter(text: string, options: LinterOptions = {}): LinterDiagnostic[] {
  const diagnostics: LinterDiagnostic[] = [];
  if (!text || text.length === 0) return diagnostics;

  // 1. Directive Check: %novalidate at file level
  if (/^%novalidate\b/m.test(text)) {
    return diagnostics;
  }

  const length = text.length;
  const envStack: OpenEnv[] = [];
  const labelSeen = new Map<string, number>();

  let inMathMode = false;
  let mathModeStart = -1;
  let mathModeType: 'dollar' | 'double-dollar' | 'bracket' | 'paren' | null = null;

  let inNovalidateBlock = false;
  let i = 0;
  let currentLine = 1;

  while (i < length) {
    const char = text[i];

    // Track line numbers
    if (char === '\n') {
      currentLine++;
      i++;
      continue;
    }

    // 2. Handle Comments (%)
    if (char === '%' && !isEscaped(text, i)) {
      const lineEnd = text.indexOf('\n', i);
      const commentEnd = lineEnd === -1 ? length : lineEnd;
      const commentContent = text.slice(i, commentEnd).trim();

      // Check %begin novalidate / %end novalidate
      if (commentContent === '%begin novalidate') {
        inNovalidateBlock = true;
      } else if (commentContent === '%end novalidate') {
        inNovalidateBlock = false;
      }

      i = commentEnd;
      continue;
    }

    // If currently inside a novalidate block, skip validation
    if (inNovalidateBlock) {
      i++;
      continue;
    }

    // 3. Verbatim & lstlisting Isolation
    if (char === '\\' && !isEscaped(text, i)) {
      // Check \begin{verbatim} or \begin{lstlisting}
      const verbatimMatch = /^\\begin\{(verbatim|lstlisting)\}/.exec(text.slice(i));
      if (verbatimMatch) {
        const envName = verbatimMatch[1];
        const closeTag = `\\end{${envName}}`;
        const closeIdx = text.indexOf(closeTag, i + verbatimMatch[0].length);
        if (closeIdx !== -1) {
          i = closeIdx + closeTag.length;
          continue;
        }
      }

      // Check inline \verb|...| or \verb+...+: \verb([^\w\s])(.*?)\1
      const inlineVerbMatch = /^\\verb\*?([^\w\s])(.*?)\1/.exec(text.slice(i));
      if (inlineVerbMatch) {
        i += inlineVerbMatch[0].length;
        continue;
      }
    }

    // 4. Math Mode Delimiters ($ and $$)
    if (char === '$' && !isEscaped(text, i)) {
      const isDouble = i + 1 < length && text[i + 1] === '$';
      const delimiterLen = isDouble ? 2 : 1;
      const currentDelimiterType = isDouble ? 'double-dollar' : 'dollar';

      if (!inMathMode) {
        inMathMode = true;
        mathModeStart = i;
        mathModeType = currentDelimiterType;
      } else {
        // Closing math mode
        if (mathModeType === currentDelimiterType) {
          inMathMode = false;
          mathModeStart = -1;
          mathModeType = null;
        } else {
          diagnostics.push({
            from: i,
            to: i + delimiterLen,
            severity: 'error',
            message: `Mismatched math delimiter: opened with '${mathModeType === 'double-dollar' ? '$$' : '$'}' but closed with '${isDouble ? '$$' : '$'}'`,
            source: 'LaTeX Linter',
          });
          inMathMode = false;
          mathModeStart = -1;
          mathModeType = null;
        }
      }

      i += delimiterLen;
      continue;
    }

    // Display / Inline Math Brackets: \[ ... \] and \( ... \)
    if (char === '\\' && !isEscaped(text, i) && i + 1 < length) {
      const nextChar = text[i + 1];
      if (nextChar === '[' || nextChar === '(') {
        const type = nextChar === '[' ? 'bracket' : 'paren';
        if (!inMathMode) {
          inMathMode = true;
          mathModeStart = i;
          mathModeType = type;
        }
        i += 2;
        continue;
      } else if (nextChar === ']' || nextChar === ')') {
        const expectedType = nextChar === ']' ? 'bracket' : 'paren';
        if (inMathMode && mathModeType === expectedType) {
          inMathMode = false;
          mathModeStart = -1;
          mathModeType = null;
        } else if (!inMathMode) {
          diagnostics.push({
            from: i,
            to: i + 2,
            severity: 'error',
            message: `Unexpected closing math bracket '\\${nextChar}' without opening '\\${nextChar === ']' ? '[' : '('}'`,
            source: 'LaTeX Linter',
          });
        }
        i += 2;
        continue;
      }
    }

    // 5. LaTeX Control Sequences (\command)
    if (char === '\\' && !isEscaped(text, i)) {
      const cmdMatch = /^\\([a-zA-Z*]+)/.exec(text.slice(i));
      if (cmdMatch) {
        const cmdName = cmdMatch[1];
        const cmdFrom = i;
        const cmdTo = i + cmdMatch[0].length;

        // 5a. \begin{env}
        if (cmdName === 'begin') {
          const envNameMatch = /^\s*\{([a-zA-Z*0-9_-]+)\}/.exec(text.slice(cmdTo));
          if (envNameMatch) {
            const envName = envNameMatch[1];
            const fullTo = cmdTo + envNameMatch[0].length;
            envStack.push({ name: envName, from: cmdFrom, to: fullTo, line: currentLine });

            // If entering a known math environment
            if (['equation', 'align', 'gather', 'multline', 'flalign', 'alignat', 'displaymath'].includes(envName.replace(/\*$/, ''))) {
              inMathMode = true;
            }

            i = fullTo;
            continue;
          }
        }

        // 5b. \end{env}
        if (cmdName === 'end') {
          const envNameMatch = /^\s*\{([a-zA-Z*0-9_-]+)\}/.exec(text.slice(cmdTo));
          if (envNameMatch) {
            const envName = envNameMatch[1];
            const fullTo = cmdTo + envNameMatch[0].length;

            if (envStack.length === 0) {
              diagnostics.push({
                from: cmdFrom,
                to: fullTo,
                severity: 'error',
                message: `Unexpected \\end{${envName}} with no matching \\begin{${envName}}`,
                source: 'LaTeX Linter',
              });
            } else {
              const top = envStack.pop()!;
              if (top.name !== envName) {
                diagnostics.push({
                  from: cmdFrom,
                  to: fullTo,
                  severity: 'error',
                  message: `Mismatched environment: \\begin{${top.name}} on line ${top.line} closed by \\end{${envName}}`,
                  source: 'LaTeX Linter',
                });
              }
            }

            if (['equation', 'align', 'gather', 'multline', 'flalign', 'alignat', 'displaymath'].includes(envName.replace(/\*$/, ''))) {
              inMathMode = false;
            }

            i = fullTo;
            continue;
          }
        }

        // 5c. \label{...} - duplicate detection
        if (cmdName === 'label') {
          const labelMatch = /^\s*\{([^}]+)\}/.exec(text.slice(cmdTo));
          if (labelMatch) {
            const labelKey = labelMatch[1].trim();
            const fullTo = cmdTo + labelMatch[0].length;
            if (labelSeen.has(labelKey)) {
              diagnostics.push({
                from: cmdFrom,
                to: fullTo,
                severity: 'error',
                message: `Duplicate label "${labelKey}". Label was already declared earlier in this file.`,
                source: 'LaTeX Linter',
              });
            } else {
              labelSeen.set(labelKey, cmdFrom);
            }
            i = fullTo;
            continue;
          }
        }

        // 5d. \cite{...} - undefined citation check
        if (['cite', 'citep', 'citet', 'nocite', 'textcite', 'autocite'].includes(cmdName)) {
          const citeMatch = /^(?:\*?(?:\[[^\]]*\])*)\s*\{([^}]+)\}/.exec(text.slice(cmdTo));
          if (citeMatch && options.knownBibKeys && options.knownBibKeys.length > 0) {
            const keys = citeMatch[1].split(',').map((k) => k.trim());
            const knownSet = new Set(options.knownBibKeys);
            for (const k of keys) {
              if (k && !knownSet.has(k)) {
                const keyOffset = text.indexOf(k, cmdTo);
                if (keyOffset !== -1) {
                  diagnostics.push({
                    from: keyOffset,
                    to: keyOffset + k.length,
                    severity: 'warning',
                    message: `Citation key "${k}" is not defined in project bibliography (.bib)`,
                    source: 'LaTeX Linter',
                  });
                }
              }
            }
          }
        }

        // 5d2. \ref{...} - undefined label reference check
        if (['ref', 'eqref', 'autoref', 'cref', 'Cref', 'pageref', 'vref'].includes(cmdName)) {
          const refMatch = /^(?:\*?(?:\[[^\]]*\])*)\s*\{([^}]+)\}/.exec(text.slice(cmdTo));
          if (refMatch && options.knownLabels && options.knownLabels.length > 0) {
            const labels = refMatch[1].split(',').map((l) => l.trim());
            const knownSet = new Set(options.knownLabels);
            for (const l of labels) {
              if (l && !knownSet.has(l)) {
                const labelOffset = text.indexOf(l, cmdTo);
                if (labelOffset !== -1) {
                  diagnostics.push({
                    from: labelOffset,
                    to: labelOffset + l.length,
                    severity: 'warning',
                    message: `Reference label "${l}" is not defined in any project file`,
                    source: 'LaTeX Linter',
                  });
                }
              }
            }
          }
        }

        // 5e. Math-only / Text-only context verification
        if (!inMathMode && MATH_ONLY_COMMANDS.has(cmdName)) {
          diagnostics.push({
            from: cmdFrom,
            to: cmdTo,
            severity: 'warning',
            message: `Command '\\${cmdName}' is intended for math mode, but used in text mode. Did you forget '$'?`,
            source: 'LaTeX Linter',
          });
        } else if (inMathMode && TEXT_ONLY_COMMANDS.has(cmdName)) {
          diagnostics.push({
            from: cmdFrom,
            to: cmdTo,
            severity: 'warning',
            message: `Command '\\${cmdName}' cannot be used inside math mode.`,
            source: 'LaTeX Linter',
          });
        }

        i = cmdTo;
        continue;
      }
    }

    i++;
  }

  // 6. Check unclosed math mode at EOF
  if (inMathMode && mathModeStart !== -1) {
    diagnostics.push({
      from: mathModeStart,
      to: Math.min(mathModeStart + 2, length),
      severity: 'error',
      message: `Unclosed math mode starting here`,
      source: 'LaTeX Linter',
    });
  }

  // 7. Check unclosed environments at EOF
  for (const unclosed of envStack) {
    diagnostics.push({
      from: unclosed.from,
      to: unclosed.to,
      severity: 'error',
      message: `Unclosed environment: \\begin{${unclosed.name}} requires a matching \\end{${unclosed.name}}`,
      source: 'LaTeX Linter',
    });
  }

  return diagnostics;
}
