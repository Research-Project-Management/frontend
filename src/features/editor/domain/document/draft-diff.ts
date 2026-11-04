/**
 * draft-diff.ts
 *
 * Lightweight O(N) line-set / prefix-suffix diff summary used by draft recovery and conflict dialogs
 * to show how a locally recovered draft differs from the server version.
 */

export interface DraftDiffLine {
  type: 'added' | 'removed';
  lineNumber: number;
  text: string;
}

export interface DraftDiffSummary {
  identical: boolean;
   hasChanges?: boolean;
  addedLines: number;
  removedLines: number;
  draftLineCount: number;
  serverLineCount: number;
  charDelta: number;
  preview: DraftDiffLine[];
  previewLines?: DraftDiffLine[];
}

export function computeDraftDiffSummary(
  draft: string,
  server: string,
  maxPreviewLines = 12,
): DraftDiffSummary {
  if (draft === server) {
    const lineCount = draft ? draft.split('\n').length : 1;
    return {
      identical: true,
      hasChanges: false,
      addedLines: 0,
      removedLines: 0,
      draftLineCount: lineCount,
      serverLineCount: lineCount,
      charDelta: 0,
      preview: [],
      previewLines: [],
    };
  }

  const a = server.split('\n');
  const b = draft.split('\n');
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
  const counts = new Map<string, number>();
  for (const line of midA) counts.set(line, (counts.get(line) ?? 0) + 1);

  const preview: DraftDiffLine[] = [];
  let addedLines = 0;
  let removedLines = 0;

  for (let idx = 0; idx < midB.length; idx++) {
    const line = midB[idx];
    const c = counts.get(line) ?? 0;
    if (c > 0) counts.set(line, c - 1);
    else {
      addedLines++;
      if (preview.length < maxPreviewLines) {
        preview.push({ type: 'added', lineNumber: start + idx + 1, text: line });
      }
    }
  }

  for (let idx = 0; idx < midA.length; idx++) {
    const line = midA[idx];
    const c = counts.get(line) ?? 0;
    if (c > 0) {
      counts.set(line, c - 1);
      removedLines++;
      if (preview.length < maxPreviewLines) {
        preview.push({ type: 'removed', lineNumber: start + idx + 1, text: line });
      }
    }
  }

  return {
    identical: false,
    hasChanges: true,
    addedLines,
    removedLines,
    draftLineCount: b.length,
    serverLineCount: a.length,
    charDelta: draft.length - server.length,
    preview,
    previewLines: preview,
  };
}
