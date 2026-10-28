/**
 * draft-diff.ts
 *
 * Lightweight line-based diff summary used by the draft recovery and conflict resolution dialogs
 * to show the user how a locally recovered draft differs from the current server version.
 */

export interface DraftDiffLine {
  type: 'added' | 'removed';
  /** 1-based line number in the draft (added) or server (removed) text. */
  lineNumber: number;
  text: string;
}

export interface DraftDiffSummary {
  identical: boolean;
  addedLines: number;
  removedLines: number;
  draftLineCount: number;
  serverLineCount: number;
  charDelta: number;
  /** First differing lines (bounded by `maxPreviewLines`). */
  preview: DraftDiffLine[];
}

const LCS_CELL_LIMIT = 4_000_000;

/**
 * Computes a line-level diff summary between `draft` and `server`.
 * Common prefix/suffix are trimmed first; the remaining middle section is diffed with LCS
 * when small enough, otherwise with a multiset approximation.
 */
export function computeDraftDiffSummary(
  draft: string,
  server: string,
  maxPreviewLines = 12
): DraftDiffSummary {
  if (draft === server) {
    let lineCount = 1;
    for (let i = 0; i < draft.length; i++) {
      if (draft.charCodeAt(i) === 10) lineCount++;
    }
    return {
      identical: true,
      addedLines: 0,
      removedLines: 0,
      preview: [],
      draftLineCount: lineCount,
      serverLineCount: lineCount,
      charDelta: 0,
    };
  }

  const a = server.split('\n');
  const b = draft.split('\n');
  const base = {
    draftLineCount: b.length,
    serverLineCount: a.length,
    charDelta: draft.length - server.length,
  };

  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length - 1;
  let endB = b.length - 1;
  while (endA >= start && endB >= start && a[endA] === b[endB]) {
    endA--;
    endB--;
  }
  const midA = a.slice(start, endA + 1);
  const midB = b.slice(start, endB + 1);

  const ops: DraftDiffLine[] = [];
  let addedLines = 0;
  let removedLines = 0;

  if (midA.length * midB.length <= LCS_CELL_LIMIT) {
    const n = midA.length;
    const m = midB.length;
    const stride = m + 1;
    const dp = new Uint32Array((n + 1) * stride);
    for (let i = n - 1; i >= 0; i--) {
      const rowOffset = i * stride;
      const nextRowOffset = (i + 1) * stride;
      const lineA = midA[i];
      for (let j = m - 1; j >= 0; j--) {
        if (lineA === midB[j]) {
          dp[rowOffset + j] = dp[nextRowOffset + j + 1] + 1;
        } else {
          const down = dp[nextRowOffset + j];
          const right = dp[rowOffset + j + 1];
          dp[rowOffset + j] = down > right ? down : right;
        }
      }
    }
    let i = 0;
    let j = 0;
    while (i < n || j < m) {
      if (i < n && j < m && midA[i] === midB[j]) {
        i++;
        j++;
      } else if (j < m && (i >= n || dp[i * stride + j + 1] >= dp[(i + 1) * stride + j])) {
        addedLines++;
        if (ops.length < maxPreviewLines) {
          ops.push({ type: 'added', lineNumber: start + j + 1, text: midB[j] });
        }
        j++;
      } else {
        removedLines++;
        if (ops.length < maxPreviewLines) {
          ops.push({ type: 'removed', lineNumber: start + i + 1, text: midA[i] });
        }
        i++;
      }
    }
  } else {
    const counts = new Map<string, number>();
    for (const line of midA) counts.set(line, (counts.get(line) ?? 0) + 1);
    for (let idx = 0; idx < midB.length; idx++) {
      const line = midB[idx];
      const c = counts.get(line) ?? 0;
      if (c > 0) {
        counts.set(line, c - 1);
      } else {
        addedLines++;
        if (ops.length < maxPreviewLines) {
          ops.push({ type: 'added', lineNumber: start + idx + 1, text: line });
        }
      }
    }
    // Re-sync remaining counts after matching midB
    for (let idx = 0; idx < midA.length; idx++) {
      const line = midA[idx];
      const c = counts.get(line) ?? 0;
      if (c > 0) {
        counts.set(line, c - 1);
        removedLines++;
        if (ops.length < maxPreviewLines) {
          ops.push({ type: 'removed', lineNumber: start + idx + 1, text: line });
        }
      }
    }
  }

  return {
    identical: false,
    addedLines,
    removedLines,
    preview: ops,
    ...base,
  };
}
