/**
 * unsynced-edit-diff.ts
 *
 * Line-level diff summary powered by `diff` (`diffArrays`) used by unsynced-edit recovery
 * and conflict dialogs to preview how local uncommitted text differs from the server baseline.
 */

import { diffArrays } from 'diff';

interface UnsyncedEditDiffLine {
  type: 'added' | 'removed';
  lineNumber: number;
  text: string;
}

export interface UnsyncedEditDiffSummary {
  identical: boolean;
  hasChanges?: boolean;
  addedLines: number;
  removedLines: number;
  localLineCount: number;
  serverLineCount: number;
  charDelta: number;
  preview: UnsyncedEditDiffLine[];
  previewLines?: UnsyncedEditDiffLine[];
}

export function computeUnsyncedEditDiffSummary(
  localContent: string,
  serverContent: string,
  maxPreviewLines = 12,
): UnsyncedEditDiffSummary {
  if (localContent === serverContent) {
    const lineCount = localContent ? localContent.split('\n').length : 1;
    return {
      identical: true,
      hasChanges: false,
      addedLines: 0,
      removedLines: 0,
      localLineCount: lineCount,
      serverLineCount: lineCount,
      charDelta: 0,
      preview: [],
      previewLines: [],
    };
  }

  const serverLines = serverContent.split('\n');
  const localLines = localContent.split('\n');
  const changes = diffArrays(serverLines, localLines);

  const preview: UnsyncedEditDiffLine[] = [];
  let addedLines = 0;
  let removedLines = 0;
  let serverLineNum = 1;
  let localLineNum = 1;

  for (const part of changes) {
    if (part.added) {
      for (const text of part.value) {
        addedLines++;
        if (preview.length < maxPreviewLines) {
          preview.push({ type: 'added', lineNumber: localLineNum, text });
        }
        localLineNum++;
      }
    } else if (part.removed) {
      for (const text of part.value) {
        removedLines++;
        if (preview.length < maxPreviewLines) {
          preview.push({ type: 'removed', lineNumber: serverLineNum, text });
        }
        serverLineNum++;
      }
    } else {
      serverLineNum += part.value.length;
      localLineNum += part.value.length;
    }
  }

  return {
    identical: false,
    hasChanges: true,
    addedLines,
    removedLines,
    localLineCount: localLines.length,
    serverLineCount: serverLines.length,
    charDelta: localContent.length - serverContent.length,
    preview,
    previewLines: preview,
  };
}
