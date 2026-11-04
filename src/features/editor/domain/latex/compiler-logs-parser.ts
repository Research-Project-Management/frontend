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
} from '@/features/editor/domain/types/compiler.types';
import type {
  CompilerDiagnostic,
  DiagnosticItemDto,
} from '@/features/editor/sdk/manuscript/types';

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
            title: item.explanation.title,
            whyItHappened:
              'whyItHappened' in item.explanation
                ? item.explanation.whyItHappened
                : item.explanation.explanation || item.explanation.summary || '',
            howToFix:
              'howToFix' in item.explanation
                ? item.explanation.howToFix
                : item.explanation.suggestedFix || '',
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
 * Synchronous adapter returning cached backend `ParsedLog` for `raw` if available,
 * or empty buckets until the backend `diagnostics.parseLog` / compile response resolves.
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
  if (!raw) return { errors: [], warnings: [], badBoxes: [] };
  const cached = parsedLogCache.get(raw);
  if (cached) return cached;
  return { errors: [], warnings: [], badBoxes: [] };
}
