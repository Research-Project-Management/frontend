/**
 * draft-diff.ts
 *
 * Lightweight line-based diff summary used by the draft recovery dialog to show the user
 * how a locally recovered draft differs from the current server version.
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
  const a = server.split('\n');
  const b = draft.split('\n');
  const base = {
    draftLineCount: b.length,
    serverLineCount: a.length,
    charDelta: draft.length - server.length,
  };
  if (draft === server) {
    return { identical: true, addedLines: 0, removedLines: 0, preview: [], ...base };
  }

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
  if (midA.length * midB.length <= LCS_CELL_LIMIT) {
    const n = midA.length;
    const m = midB.length;
    const dp: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        dp[i][j] = midA[i] === midB[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
    let i = 0;
    let j = 0;
    while (i < n || j < m) {
      if (i < n && j < m && midA[i] === midB[j]) {
        i++;
        j++;
      } else if (j < m && (i >= n || dp[i][j + 1] >= dp[i + 1][j])) {
        ops.push({ type: 'added', lineNumber: start + j + 1, text: midB[j] });
        j++;
      } else {
        ops.push({ type: 'removed', lineNumber: start + i + 1, text: midA[i] });
        i++;
      }
    }
  } else {
    const counts = new Map<string, number>();
    for (const line of midA) counts.set(line, (counts.get(line) ?? 0) + 1);
    midB.forEach((line, idx) => {
      const c = counts.get(line) ?? 0;
      if (c > 0) counts.set(line, c - 1);
      else ops.push({ type: 'added', lineNumber: start + idx + 1, text: line });
    });
    const remaining = new Map(counts);
    midA.forEach((line, idx) => {
      const c = remaining.get(line) ?? 0;
      if (c > 0) {
        remaining.set(line, c - 1);
        ops.push({ type: 'removed', lineNumber: start + idx + 1, text: line });
      }
    });
  }

  return {
    identical: false,
    addedLines: ops.filter((o) => o.type === 'added').length,
    removedLines: ops.filter((o) => o.type === 'removed').length,
    preview: ops.slice(0, maxPreviewLines),
    ...base,
  };
}
