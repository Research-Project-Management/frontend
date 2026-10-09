/**
 * latex-linter.ts
 *
 * Real-time LaTeX structural & syntax diagnostics engine (Overleaf Parity).
 * Orchestrates sub-linters with LRU memoization caching.
 *
 * Rule implementations and constants reside in `./latex-linter.rules`.
 */

import {
  type LatexLintDiagnostic,
  type RetractedItemInfo,
  lintEnvironments,
  lintUnmatchedBraces,
  lintSpecialCharacters,
  lintInlineMath,
  lintLabelsAndReferences,
  lintCommandsAndTypos,
  lintRetractedCitations,
} from './latex-linter.rules';

export * from './latex-linter.rules';

export interface LatexLinterOptions {
  enableStructureLint?: boolean;
  enableSyntaxDiagnostics?: boolean;
  retractedItemsMap?: Map<string, RetractedItemInfo>;
}

interface LinterCacheEntry {
  key: string;
  content: string;
  diagnostics: LatexLintDiagnostic[];
}

const LINTER_CACHE_MAX = 5;
const linterCache: LinterCacheEntry[] = [];

function getRetractedMapFingerprint(map?: Map<string, RetractedItemInfo>): string {
  if (!map || map.size === 0) return '0';
  let sample = `${map.size}:`;
  let count = 0;
  for (const key of map.keys()) {
    sample += key + ',';
    count++;
    if (count >= 5) break;
  }
  return sample;
}

export function clearLatexLinterCache(): void {
  linterCache.length = 0;
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

  const retractedFingerprint = getRetractedMapFingerprint(retractedItemsMap);
  const cacheKey = `${content.length}:${content.slice(0, 40)}:${content.slice(-40)}:${enableStructureLint}:${enableSyntaxDiagnostics}:${retractedFingerprint}`;

  // LRU memoization check
  for (let i = 0; i < linterCache.length; i++) {
    const entry = linterCache[i];
    if (entry.key === cacheKey && entry.content === content) {
      if (i > 0) {
        linterCache.splice(i, 1);
        linterCache.unshift(entry);
      }
      return entry.diagnostics.slice();
    }
  }

  // Pre-split content once to share across all sub-linters
  const lines = content.split(/\r?\n/);
  const results: LatexLintDiagnostic[] = [];

  if (enableStructureLint) {
    results.push(...lintEnvironments(lines));
    results.push(...lintUnmatchedBraces(lines));
  }

  if (enableSyntaxDiagnostics) {
    results.push(...lintSpecialCharacters(lines));
    results.push(...lintInlineMath(lines));
    results.push(...lintLabelsAndReferences(lines));
    results.push(...lintCommandsAndTypos(lines));
  }

  if (retractedItemsMap && retractedItemsMap.size > 0) {
    results.push(...lintRetractedCitations(lines, retractedItemsMap));
  }

  // Sort by line number, then column
  results.sort((a, b) => {
    if (a.startLineNumber !== b.startLineNumber) {
      return a.startLineNumber - b.startLineNumber;
    }
    return a.startColumn - b.startColumn;
  });

  if (linterCache.length >= LINTER_CACHE_MAX) {
    linterCache.pop();
  }
  linterCache.unshift({
    key: cacheKey,
    content,
    diagnostics: results,
  });

  return results.slice();
}
