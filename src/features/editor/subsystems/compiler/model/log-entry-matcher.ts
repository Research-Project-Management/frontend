/**
 * log-entry-matcher.ts
 * Pure matching & scoring helpers locating a focused diagnostic row inside parsed compiler logs.
 */

import type {
  LogEntry,
  CompilerLogFocusTarget,
} from '@/features/editor/domain/types/compiler.types';

export interface MatchedLogEntry {
  type: 'error' | 'warning' | 'badbox';
  index: number;
  domId: string;
}

export function normalizeLogPath(filePath?: string): string {
  return (filePath || '').replace(/^\.\//, '').replace(/^\/+/, '').toLowerCase();
}

export function scoreLogEntryMatch(entry: LogEntry, target: CompilerLogFocusTarget): number {
  let score = 0;
  if (typeof target.line === 'number' && entry.line === target.line) {
    score += 10;
  }

  const targetMsg = target.message?.trim().toLowerCase() || '';
  const entryMsg = entry.message?.trim().toLowerCase() || '';
  if (targetMsg && entryMsg) {
    if (entryMsg === targetMsg) score += 8;
    else if (entryMsg.includes(targetMsg) || targetMsg.includes(entryMsg)) score += 5;
  }

  const targetFile = normalizeLogPath(target.file);
  const entryFile = normalizeLogPath(entry.file);
  if (targetFile && entryFile) {
    if (targetFile === entryFile) {
      score += 4;
    } else {
      const targetBase = targetFile.split('/').pop() || '';
      const entryBase = entryFile.split('/').pop() || '';
      if (targetBase && entryBase && targetBase === entryBase) {
        score += 2;
      }
    }
  }

  return score;
}

export function findMatchingLogEntry(
  target: CompilerLogFocusTarget,
  errors: LogEntry[],
  warnings: LogEntry[],
  badBoxes: LogEntry[],
): MatchedLogEntry | null {
  const buckets: Array<{ type: 'error' | 'warning' | 'badbox'; prefix: string; items: LogEntry[] }> =
    target.severity === 'warning'
      ? [
          { type: 'warning', prefix: 'warn', items: warnings },
          { type: 'error', prefix: 'err', items: errors },
          { type: 'badbox', prefix: 'info', items: badBoxes },
        ]
      : [
          { type: 'error', prefix: 'err', items: errors },
          { type: 'warning', prefix: 'warn', items: warnings },
          { type: 'badbox', prefix: 'info', items: badBoxes },
        ];

  let best: (MatchedLogEntry & { score: number }) | null = null;

  for (const bucket of buckets) {
    for (let i = 0; i < bucket.items.length; i += 1) {
      const s = scoreLogEntryMatch(bucket.items[i], target);
      if (s >= 8 && (!best || s > best.score)) {
        best = {
          type: bucket.type,
          index: i,
          domId: `log-entry-${bucket.prefix}-${i}`,
          score: s,
        };
      }
    }
  }

  if (best) return { type: best.type, index: best.index, domId: best.domId };
  if (target.severity === 'warning' && warnings.length > 0) {
    return { type: 'warning', index: 0, domId: 'log-entry-warn-0' };
  }
  if (errors.length > 0) return { type: 'error', index: 0, domId: 'log-entry-err-0' };
  if (warnings.length > 0) return { type: 'warning', index: 0, domId: 'log-entry-warn-0' };
  return null;
}
