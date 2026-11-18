/**
 * compiler-logs-parser.ts
 *
 * Domain types, path normalization utilities, and structured diagnostic adapters
 * for LaTeX compiler logs.
 * Authoritative TeX paren-tree log parsing and error classification are executed
 * on the backend (`CompileLogAnalyzer`).
 */

import type {
  LogEntry,
  ParsedLog,
  LogSeverity,
  CompilerDiagnostic,
  DiagnosticItemDto,
} from '@/features/editor/domain/types/compiler.types';

export type { LogEntry, ParsedLog, LogSeverity };

export const DEFAULT_OUTPUT_FILES = [
  'output.aux',
  'output.chktex',
  'output.log',
  'output.out',
  'output.stderr',
  'output.stdout',
  'output.toc',
];

const LOG_WRAP_LIMIT = 79;
const PARSED_LOG_CACHE_MAX = 5;
const parsedLogCache = new Map<string, ParsedLog>();

export function unwrapLatexLogLines(raw: string): string[] {
  const rawLines = raw.replace(/\r\n|\r/g, '\n').split('\n');
  if (rawLines.length === 0) return [];
  const wrappedLines: string[] = [rawLines[0]];
  for (let i = 1; i < rawLines.length; i++) {
    const prevLine = rawLines[i - 1];
    const currentLine = rawLines[i];
    if (
      prevLine.length === LOG_WRAP_LIMIT &&
      prevLine.slice(-3) !== '...' &&
      currentLine.charAt(0) !== '!'
    ) {
      wrappedLines[wrappedLines.length - 1] += currentLine;
    } else {
      wrappedLines.push(currentLine);
    }
  }
  return wrappedLines;
}

export function normalizeCompilerLogPath(rawPath: string): string {
  if (!rawPath) return '';
  let clean = rawPath
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/\\/g, '/')
    .replace(/\/+/g, '/');
  clean = clean.replace(
    /^(?:.*\/)?compiles\/[0-9a-zA-Z_-]+(?:-[0-9a-zA-Z_-]+)?\/(?:\.\/)?/,
    '',
  );
  clean = clean.replace(/^\/?compile\//, '');
  clean = clean.replace(/^(\.\/)+/, '').replace(/^\/+/, '');
  return clean;
}

/**
 * Converts structured backend diagnostics (`CompilerDiagnostic[]` or `DiagnosticItemDto[]`)
 * into the frontend `ParsedLog` contract consumed by `CompilerLogs` and `PdfViewer`.
 */
export function diagnosticsToParsedLog(
  diagnostics?: Array<CompilerDiagnostic | DiagnosticItemDto>,
): ParsedLog {
  const errors: LogEntry[] = [];
  const warnings: LogEntry[] = [];
  const badBoxes: LogEntry[] = [];

  if (!Array.isArray(diagnostics) || diagnostics.length === 0) {
    return { errors, warnings, badBoxes };
  }

  for (const item of diagnostics) {
    const file = item.file ? normalizeCompilerLogPath(item.file) : undefined;
    const line =
      typeof item.line === 'number' && !isNaN(item.line) ? item.line : undefined;
    const rawExcerpt = item.context || undefined;
    const entry: LogEntry = {
      message: (item.message || '').replace(/—/g, '-'),
      file: file || undefined,
      line,
      rawExcerpt: rawExcerpt ? rawExcerpt.replace(/—/g, '-') : undefined,
      quickFix: item.quickFix,
      explanation: item.explanation
        ? {
            code: (item.explanation as any).code,
            title: item.explanation.title,
            whyItHappened:
              'whyItHappened' in item.explanation
                ? (item.explanation as any).whyItHappened
                : (item.explanation as any).explanation || (item.explanation as any).summary || '',
            howToFix:
              'howToFix' in item.explanation
                ? (item.explanation as any).howToFix
                : (item.explanation as any).suggestedFix || '',
          }
        : undefined,
    };

    const category = item.category || item.severity;
    if (
      category === 'badbox' ||
      item.warningSubtype === 'badbox' ||
      /^(Overfull|Underfull)\s*\\[hv]box/i.test(entry.message)
    ) {
      badBoxes.push(entry);
    } else if (category === 'error') {
      errors.push(entry);
    } else if (category === 'warning') {
      warnings.push(entry);
    }
  }

  return { errors, warnings, badBoxes };
}

/**
 * Registers a backend-parsed log in the in-memory cache so synchronous callers
 * of `parseLatexLog(raw)` receive the backend's structured diagnostics.
 */
export function cacheBackendParsedLog(raw: string, parsed: ParsedLog): void {
  if (!raw) return;
  if (parsedLogCache.size >= PARSED_LOG_CACHE_MAX) {
    const firstKey = parsedLogCache.keys().next().value;
    if (firstKey) parsedLogCache.delete(firstKey);
  }
  parsedLogCache.set(raw, parsed);
}

/**
 * Parses raw TeX/LaTeX compiler logs synchronously (using cache when hydrated by backend)
 * and extracts structured errors, warnings, and bad boxes within <100ms for 5k+ lines.
 */
export function parseLatexLog(
  raw: string,
  diagnostics?: Array<CompilerDiagnostic | DiagnosticItemDto>,
): ParsedLog {
  if (diagnostics && diagnostics.length > 0) {
    const converted = diagnosticsToParsedLog(diagnostics);
    if (raw) cacheBackendParsedLog(raw, converted);
    return converted;
  }
  if (!raw || !raw.trim()) return { errors: [], warnings: [], badBoxes: [] };
  const cached = parsedLogCache.get(raw);
  if (cached) return cached;

  const lines = unwrapLatexLogLines(raw);
  const errors: LogEntry[] = [];
  const warnings: LogEntry[] = [];
  const badBoxes: LogEntry[] = [];
  const fileStack: Array<string | null> = [];
  let mainFile: string | undefined;

  const currentFile = (): string | undefined => {
    for (let k = fileStack.length - 1; k >= 0; k--) {
      if (fileStack[k]) return fileStack[k]!;
    }
    return mainFile;
  };

  const trackParens = (line: string): void => {
    if (!line.includes('(') && !line.includes(')')) return;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '(') {
        const rest = line.slice(i + 1);
        const fMatch = rest.match(
          /^"?((?:[a-zA-Z]:[\\/]|[./\\])?[^\s()"]+\.(?:tex|sty|cls|bib|bbl|ltx|aux|def|cfg|fd))(?=["\s()]|$)/i,
        );
        if (fMatch?.[1]) {
          const norm = normalizeCompilerLogPath(fMatch[1]);
          fileStack.push(norm || null);
          if (!mainFile && norm && /\.tex$/i.test(norm)) {
            mainFile = norm;
          }
          i += fMatch[0].length;
        } else {
          fileStack.push(null);
        }
      } else if (ch === ')') {
        if (fileStack.length > 0) fileStack.pop();
      }
    }
  };

  const fileLineErrRegex =
    /^((?:[a-zA-Z]:[\\/])?[^\s:()\[\]"]+\.(?:tex|sty|cls|bib|bbl|ltx)):(\d+):\s*(.+)$/i;
  const warningRegex =
    /^(?:LaTeX3?|LaTeX\s+Font|(?:Package|Class|Module)\s+[\w-]+|pdfTeX|xdvipdfmx)\s+[Ww]arning:\s*(.+)$/;
  const badBoxRegex = /^((?:Overfull|Underfull)\s+\\[hv]box\s+.*)$/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    if (line.startsWith('!')) {
      const msg = line.slice(1).trim();
      let errLine: number | undefined;
      let excerpt: string | undefined;
      for (let look = i + 1; look <= Math.min(lines.length - 1, i + 8); look++) {
        const lMatch = lines[look].match(/^l\.(\d+)\s*(.*)$/);
        if (lMatch) {
          errLine = Number(lMatch[1]);
          const nextLine = lines[look + 1] ?? '';
          const continuation = /^\s{4,}\S/.test(nextLine) ? ` ${nextLine.trim()}` : '';
          excerpt = `${lMatch[2] || ''}${continuation}`.trim() || undefined;
          break;
        }
      }
      errors.push({
        message: msg,
        file: currentFile(),
        line: errLine,
        rawExcerpt: excerpt,
        ...(excerpt ? { detail: excerpt } : {}),
      });
      continue;
    }

    const flMatch = line.match(fileLineErrRegex);
    if (flMatch) {
      const file = normalizeCompilerLogPath(flMatch[1]);
      const lineNum = Number(flMatch[2]);
      let excerpt: string | undefined;
      const next = lines[i + 1];
      if (next) {
        const lNext = next.match(/^l\.(\d+)\s*(.*)$/);
        if (lNext) {
          const cont = /^\s{4,}\S/.test(lines[i + 2] ?? '') ? ` ${(lines[i + 2] ?? '').trim()}` : '';
          excerpt = `${lNext[2] || ''}${cont}`.trim() || undefined;
        }
      }
      errors.push({
        message: flMatch[3].trim(),
        file: file || currentFile(),
        line: lineNum,
        rawExcerpt: excerpt,
        ...(excerpt ? { detail: excerpt } : {}),
      });
      continue;
    }

    const wMatch = line.match(warningRegex);
    if (wMatch) {
      let fullMsg = wMatch[1].trim();
      while (
        i + 1 < lines.length &&
        (/^\((?:LaTeX|[a-zA-Z0-9_-]+)\)\s+/.test(lines[i + 1]) ||
          /^\s+on input line \d+/.test(lines[i + 1]))
      ) {
        i++;
        fullMsg += ' ' + lines[i].replace(/^\([^)]+\)\s*/, '').trim();
      }
      const lineMatch = fullMsg.match(/on input line (\d+)/i);
      warnings.push({
        message: fullMsg,
        file: currentFile(),
        line: lineMatch ? Number(lineMatch[1]) : undefined,
      });
      continue;
    }

    if (line.startsWith('Warning--')) {
      warnings.push({
        message: line.slice('Warning--'.length).trim(),
        file: currentFile(),
      });
      continue;
    }

    const bbMatch = line.match(badBoxRegex);
    if (bbMatch) {
      const msg = bbMatch[1].trim();
      const lineMatch = msg.match(/at lines? (\d+)/i);
      badBoxes.push({
        message: msg,
        file: currentFile(),
        line: lineMatch ? Number(lineMatch[1]) : undefined,
      });
      continue;
    }

    trackParens(line);
  }

  const parsed: ParsedLog = { errors, warnings, badBoxes };
  cacheBackendParsedLog(raw, parsed);
  return parsed;
}
