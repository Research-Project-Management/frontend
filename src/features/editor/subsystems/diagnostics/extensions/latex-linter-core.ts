/**
 * latex-linter-core.ts
 *
 * Types, cache invalidation hooks, and retracted-citation scanner for LaTeX Linting.
 * Authoritative AST/state-machine linting (`FastSyntaxLinter`) runs on the backend in
 * `backend/src/modules/manuscripts/diagnostics/domain/fast-syntax.linter.ts`
 * via `POST /api/v1/manuscripts/diagnostics/projects/:projectId/lint-doc` and `/diagnostics/lint`.
 */

import type { DiagnosticItemDto } from '@/features/editor/sdk/pages/types';

export interface RetractedItemInfo {
  title?: string;
  reason?: string;
  nature?: string;
  noticeUrl?: string;
}

export interface LinterDiagnostic {
  from: number;
  to: number;
  severity: 'error' | 'warning' | 'info';
  message: string;
  source: string;
}

export type LatexLintDiagnostic = LinterDiagnostic;

export interface LinterOptions {
  projectId?: string;
  docId?: string;
  filePath?: string;
  knownBibKeys?: string[];
  knownLabels?: string[];
  retractedCitationsMap?: Map<string, RetractedItemInfo>;
}

export type LatexLinterOptions = LinterOptions;

const cacheResetCallbacks = new Set<() => void>();

export function registerLatexLinterCacheReset(callback: () => void): () => void {
  cacheResetCallbacks.add(callback);
  return () => {
    cacheResetCallbacks.delete(callback);
  };
}

export function clearLatexLinterCache(): void {
  for (const cb of cacheResetCallbacks) {
    try {
      cb();
    } catch {
      // Ignore callback error
    }
  }
}

/**
 * Converts backend `DiagnosticItemDto[]` (1-indexed line/column) into character-offset
 * `LinterDiagnostic[]` for CodeMirror 6.
 */
export function mapBackendDiagnosticsToOffsets(
  text: string,
  items: DiagnosticItemDto[],
): LinterDiagnostic[] {
  if (!text || !Array.isArray(items) || items.length === 0) return [];

  const lineStarts: number[] = [0];
  for (let idx = 0; idx < text.length; idx++) {
    if (text.charCodeAt(idx) === 10 /* '\n' */) {
      lineStarts.push(idx + 1);
    }
  }

  const results: LinterDiagnostic[] = [];
  for (const item of items) {
    const lineNum = Math.max(1, Math.min(item.line || 1, lineStarts.length));
    const lineStart = lineStarts[lineNum - 1] ?? 0;
    const lineEnd =
      lineNum < lineStarts.length
        ? Math.max(lineStart, (lineStarts[lineNum] ?? text.length) - 1)
        : text.length;

    const colOffset = item.column && item.column > 1 ? item.column - 1 : 0;
    const from = Math.min(lineStart + colOffset, lineEnd);

    // Highlight token at `from` or the non-whitespace span on that line
    let to = from;
    if (from < lineEnd) {
      const restOfLine = text.slice(from, lineEnd);
      const tokenMatch = restOfLine.match(/^(\\[a-zA-Z*]+(?:\{[^}]*\})?|\$\$?|\{[^{}\n]*\}|\S+)/);
      to = tokenMatch ? Math.min(from + tokenMatch[0].length, lineEnd) : Math.min(from + 1, lineEnd);
    } else {
      to = Math.min(from + 1, text.length);
    }

    const severity: 'error' | 'warning' | 'info' =
      item.severity === 'error'
        ? 'error'
        : item.severity === 'info'
          ? 'info'
          : 'warning';

    results.push({
      from,
      to: Math.max(from, to),
      severity,
      message: item.message,
      source: 'LaTeX Linter',
    });
  }

  return results;
}

/**
 * Scans cited keys against `retractedCitationsMap` to surface academic retraction alerts.
 */
export function scanRetractedCitations(
  text: string,
  retractedCitationsMap?: Map<string, RetractedItemInfo>,
): LinterDiagnostic[] {
  if (!text || !retractedCitationsMap || retractedCitationsMap.size === 0) return [];

  const diagnostics: LinterDiagnostic[] = [];
  const citeRegex =
    /\\(?:auto|paren|text|foot|no|new|short)?cite(?:p|t|alt|alp|author|year|date|num|a)?\*?(?:\[[^\]]*\])*\{([^}]*)\}/g;

  let match: RegExpExecArray | null;
  while ((match = citeRegex.exec(text)) !== null) {
    const rawArg = match[1] ?? '';
    const openBraceOffset = match.index + match[0].lastIndexOf('{') + 1;
    let cursor = 0;

    for (const part of rawArg.split(',')) {
      const key = part.trim();
      const keyOffsetInPart = part.indexOf(key);
      const keyFrom = openBraceOffset + cursor + (keyOffsetInPart >= 0 ? keyOffsetInPart : 0);
      const keyTo = keyFrom + key.length;
      cursor += part.length + 1;

      if (!key) continue;
      const retractedInfo = retractedCitationsMap.get(key.toLowerCase());
      if (retractedInfo) {
        const natureLabel = retractedInfo.nature || 'Retracted Publication';
        const reasonStr = retractedInfo.reason ? ` — Reason: ${retractedInfo.reason}` : '';
        diagnostics.push({
          from: keyFrom,
          to: keyTo,
          severity: 'error',
          message: `CRITICAL ACADEMIC WARNING: Cited work '${key}' is a ${natureLabel}${reasonStr}. Avoid citing retracted literature.`,
          source: 'Retraction Watch Guard',
        });
      }
    }
  }

  return diagnostics;
}

/**
 * Synchronous helper preserved for backwards compatibility; returns retracted citation
 * diagnostics synchronously while full AST linting is performed via backend `diagnostics.lint`.
 */
export function runLatexLinter(text: string, options: LinterOptions = {}): LinterDiagnostic[] {
  if (!text || !text.trim()) return [];
  return scanRetractedCitations(text, options.retractedCitationsMap);
}

export const lintLatexDocument = runLatexLinter;
