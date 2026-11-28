/**
 * latex-linter-core.ts
 *
 * Types, cache invalidation hooks, and retracted-citation scanner for LaTeX Linting.
 */

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
  code?: string;
}

export interface LinterOptions {
  projectId?: string;
  docId?: string;
  filePath?: string;
  knownBibKeys?: string[];
  knownLabels?: string[];
  retractedCitationsMap?: Map<string, RetractedItemInfo>;
}

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
      let retractedInfo =
        retractedCitationsMap.get(key) ??
        retractedCitationsMap.get(key.toLowerCase());
      if (!retractedInfo) {
        const lowerKey = key.toLowerCase();
        for (const [k, v] of retractedCitationsMap.entries()) {
          if (k.toLowerCase() === lowerKey) {
            retractedInfo = v;
            break;
          }
        }
      }
      if (retractedInfo) {
        const natureLabel = retractedInfo.nature || 'Retracted Publication';
        const titlePart = retractedInfo.title ? ` ("${retractedInfo.title}")` : '';
        const reasonStr = retractedInfo.reason ? ` — Reason: ${retractedInfo.reason}` : '';
        diagnostics.push({
          from: keyFrom,
          to: keyTo,
          severity: 'warning',
          message: `CRITICAL ACADEMIC WARNING: Cited work '${key}'${titlePart} is a ${natureLabel}${reasonStr}. Avoid citing retracted literature.`,
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
