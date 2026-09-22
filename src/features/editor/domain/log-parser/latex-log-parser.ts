/**
 * latex-log-parser.ts
 *
 * Pure domain logic: Parses raw LaTeX compiler output (pdflatex, xelatex, tectonic)
 * into structured error lists, warnings, and bad boxes.
 * Dependency Rule: ZERO framework dependencies, ZERO DOM/React imports.
 */

export interface LogEntry {
  message: string;
  file?: string;
  line?: number;
  detail?: string;
}

export interface ParsedLog {
  errors: LogEntry[];
  warnings: LogEntry[];
  badBoxes: LogEntry[];
}

export interface ParsedCompileError {
  line: number | null;
  message: string;
  context: string;
  file?: string;
  severity?: 'error' | 'warning' | 'info';
  code?: string;
  suggestion?: string;
}

/**
 * Parses raw terminal compiler output into classified categories: errors, warnings, bad boxes.
 */
export function parseLatexLog(raw: string): ParsedLog {
  const lines = raw.split('\n');
  const errors: LogEntry[] = [];
  const warnings: LogEntry[] = [];
  const badBoxes: LogEntry[] = [];
  const seen = new Set<string>();

  const tryAdd = (arr: LogEntry[], entry: LogEntry) => {
    const key = `${entry.file ?? ''}|${entry.line ?? ''}|${entry.message}`;
    if (!seen.has(key)) {
      seen.add(key);
      arr.push(entry);
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Hard errors: lines starting with !
    if (line.startsWith('!')) {
      const message = line.slice(1).trim();
      let lineNum: number | undefined;
      let detail: string | undefined;
      for (let j = i + 1; j < Math.min(i + 15, lines.length); j++) {
        const m = lines[j].match(/^l\.(\d+)\s*(.*)/);
        if (m) {
          lineNum = parseInt(m[1], 10);
          detail = m[2].trim() || undefined;
          break;
        }
      }
      tryAdd(errors, { message, line: lineNum, detail });
    }

    // File:line: format errors (e.g. ./main.tex:10: Undefined control sequence)
    const fle = line.match(/^(\.{1,2}\/[^\s:!]*\.(?:tex|sty|cls|bib)):(\d+):\s*(.+)$/);
    if (fle) {
      tryAdd(errors, {
        message: fle[3].trim(),
        file: fle[1].replace(/^\.\//, ''),
        line: parseInt(fle[2], 10),
      });
    }

    // Warnings: LaTeX Warning:, Package X Warning:, Class X Warning:, pdfTeX warning:
    if (/(?:LaTeX|(?:Package|Class)\s+\S+|pdfTeX|xdvipdfmx)\s+[Ww]arning:/.test(line)) {
      let msg = line.trim();
      for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
        if (/^\s{2,}/.test(lines[j])) msg += ' ' + lines[j].trim();
        else break;
      }
      const lineRef = msg.match(/input line (\d+)/);
      tryAdd(warnings, {
        message: msg,
        line: lineRef ? parseInt(lineRef[1], 10) : undefined,
      });
    }

    // Bad boxes: Overfull/Underfull \hbox or \vbox
    if (/^(Overfull|Underfull)\s*\\[hv]box/.test(line)) {
      const lineRef = line.match(/lines? (\d+)/);
      tryAdd(badBoxes, {
        message: line.trim(),
        line: lineRef ? parseInt(lineRef[1], 10) : undefined,
      });
    }
  }

  return { errors, warnings, badBoxes };
}

/**
 * Parses compiler log lines into structured compile error objects with line numbers and snippets.
 */
export function parseCompileErrors(log: string): ParsedCompileError[] {
  const errors: ParsedCompileError[] = [];
  const lines = log.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // File:line error: ./main.tex:14: Undefined control sequence
    const fileLineMatch = line.match(
      /^(\.{0,2}\/?[^\s:!]+\.(?:tex|bib|sty|cls)):(\d+):\s*(.+)$/i,
    );
    if (fileLineMatch) {
      const file = fileLineMatch[1].replace(/^\.\//, '');
      const lineNum = parseInt(fileLineMatch[2], 10);
      const message = fileLineMatch[3].trim();
      if (!errors.find((e) => e.message === message && e.line === lineNum && e.file === file)) {
        errors.push({
          file,
          line: lineNum,
          message,
          context: line,
          severity: 'error',
        });
      }
      continue;
    }

    // LaTeX hard error: ! Error message
    if (line.startsWith('!')) {
      const message = line.slice(1).trim();
      let errorLine: number | null = null;
      let context = '';
      for (let j = i + 1; j < Math.min(i + 8, lines.length); j++) {
        const m = lines[j].match(/^l\.(\d+)/);
        if (m) {
          errorLine = parseInt(m[1], 10);
          context = lines.slice(i, j + 2).join('\n');
          break;
        }
      }
      if (!context) context = lines.slice(i, i + 4).join('\n');

      if (!errors.find((e) => e.message === message && e.line === errorLine)) {
        errors.push({ line: errorLine, message, context, severity: 'error' });
      }
      continue;
    }

    // Warning: Undefined reference / citation / LaTeX Warning
    const warnMatch = line.match(
      /(?:LaTeX|Package [^\s]+) Warning:.*?(?:on input line (\d+)|input line (\d+))/i,
    );
    if (warnMatch) {
      const warnLine = parseInt(warnMatch[1] || warnMatch[2], 10);
      const message = line.replace(/^(?:LaTeX|Package [^\s]+) Warning:\s*/i, '').trim();
      if (!errors.find((e) => e.message === message && e.line === warnLine)) {
        errors.push({ line: warnLine, message, context: line, severity: 'warning' });
      }
    }
  }

  return errors.slice(0, 50);
}
