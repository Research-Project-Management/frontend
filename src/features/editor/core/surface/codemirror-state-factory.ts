/**
 * codemirror-state-factory.ts
 *
 * Pure EditorState builders, diff-application helpers, and LRU / WarmPool
 * view state flush & restoration utilities for CodeMirrorView.
 */

import type React from 'react';
import { EditorState, type Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { historyField } from '@codemirror/commands';
import { foldedRanges, foldEffect } from '@codemirror/language';
import type * as Y from 'yjs';

import { programmaticSyncAnnotation } from '@/features/editor/core/engine/adapters/codemirror.adapter';
import { createCodeMirrorPreset } from '@/features/editor/core/engine/codemirror/codemirror-preset';
import type {
  YjsCodeMirrorAdapter,
  YjsCollabOptions,
} from '@/features/editor/core/engine/collaboration/yjs-codemirror-adapter';
import { diffProposalField } from '@/features/editor/core/engine/extensions/inline-diff';
import { aiCoordinator } from '@/features/editor/subsystems/ai/coordinator/ai.coordinator';
import { createReviewExtension } from '@/features/editor/subsystems/review';
import { createDiagnosticsGutter } from '@/features/editor/subsystems/diagnostics/extensions/diagnostics-gutter';
import { createLatexLinterExtension } from '@/features/editor/subsystems/diagnostics/extensions/latex-linter';
import { lruDocumentCache } from '@/features/editor/domain/document/lru-document-cache';
import {
  warmEditorStatePool,
  type WarmEditorStateSnapshot,
  type WarmFoldRange,
} from '@/features/editor/domain/workspace/editor-tab-pool.domain';

export interface BuildEditorStateOptions {
  fileId: string;
  filePath: string;
  initialText: string;
  readOnly: boolean;
  lineNumbers: boolean;
  wordWrap: boolean;
  keybinding: 'standard' | 'vim' | 'emacs';
  errorLensEnabled: boolean;
  spellCheck: boolean;
  spellCheckLanguage: string;
  projectId?: string;
  editorTheme: string;
  fontSize: number;
  fontFamily?: string;
  lineHeight?: number;
  editorMode: string;
  trackChangesViewMode: string;
  reviewMode: boolean;
  autoCloseBrackets?: boolean;
  enableMathPreview?: boolean;
  enableAutocomplete?: boolean;
  enableLinter?: boolean;
  collabAdapter: YjsCodeMirrorAdapter;
  yText?: Y.Text | null;
  awareness?: YjsCollabOptions['awareness'];
  viewUpdateListener: Extension;
  warmSnapshot?: WarmEditorStateSnapshot;
}

/**
 * Pure state factory: builds a fresh CodeMirror EditorState configured with
 * presets, diagnostics gutter, track changes, collaboration, and update listeners.
 */
export function buildEditorState(options: BuildEditorStateOptions): EditorState {
  const presetExtensions = createCodeMirrorPreset({
    readOnly: options.readOnly,
    lineNumbers: options.lineNumbers,
    lineWrapping: options.wordWrap,
    keybinding: options.keybinding,
    vimMode: options.keybinding === 'vim',
    autoCloseBrackets: options.autoCloseBrackets ?? true,
    enableMathPreview: options.enableMathPreview ?? true,
    enableAutocomplete: options.enableAutocomplete ?? true,
    enableLinter: false,
    enableErrorLens: options.errorLensEnabled,
    enableSpellCheck: options.spellCheck,
    spellCheckLanguage: options.spellCheckLanguage,
    projectId: options.projectId,
    editorTheme: options.editorTheme,
    fontSize: options.fontSize,
    fontFamily: options.fontFamily,
    lineHeight: options.lineHeight,
    enableVisualMode: options.editorMode === 'visual',
  });

  const linterExtension =
    options.enableLinter ?? true ? createLatexLinterExtension(options.filePath) : [];

  const diagnosticsExtension = createDiagnosticsGutter({
    filePath: options.filePath,
    enabled: true,
  });

  const collabExtension = options.collabAdapter.getExtension({
    yText: options.yText ?? null,
    awareness: options.awareness,
  });

  const reviewExtension = createReviewExtension({
    pageId: options.fileId,
    initialViewMode:
      options.trackChangesViewMode === 'clean' ||
      options.trackChangesViewMode === 'original' ||
      options.trackChangesViewMode === 'changes'
        ? options.trackChangesViewMode
        : 'changes',
    initialReviewMode: Boolean(options.reviewMode),
  });

  const extensions: Extension[] = [
    ...presetExtensions,
    linterExtension,
    diagnosticsExtension,
    collabExtension,
    reviewExtension,
    options.viewUpdateListener,
  ];

  if (
    options.warmSnapshot?.stateJson &&
    options.warmSnapshot.content === options.initialText
  ) {
    try {
      const jsonObj =
        typeof options.warmSnapshot.stateJson === 'object' &&
        options.warmSnapshot.stateJson !== null
          ? {
              ...(options.warmSnapshot.stateJson as Record<string, unknown>),
              doc: options.initialText,
            }
          : options.warmSnapshot.stateJson;

      return EditorState.fromJSON(
        jsonObj,
        { extensions },
        { history: historyField },
      );
    } catch {
      // Fallback to fresh EditorState if serialized JSON or history schema is incompatible
    }
  }

  return EditorState.create({
    doc: options.initialText,
    extensions,
  });
}

function findDiffRange(
  currentDoc: string,
  nextText: string,
): { from: number; to: number; insert: string } | null {
  if (currentDoc === nextText) return null;
  let start = 0;
  const minLen = Math.min(currentDoc.length, nextText.length);
  while (start < minLen && currentDoc.charCodeAt(start) === nextText.charCodeAt(start)) {
    start++;
  }
  let endCur = currentDoc.length;
  let endNext = nextText.length;
  while (
    endCur > start &&
    endNext > start &&
    currentDoc.charCodeAt(endCur - 1) === nextText.charCodeAt(endNext - 1)
  ) {
    endCur--;
    endNext--;
  }
  return {
    from: start,
    to: endCur,
    insert: nextText.slice(start, endNext),
  };
}

export function applyDiffToYText(
  liveYText: Y.Text,
  nextContent: string,
  origin: string,
): void {
  const currentYDocText = liveYText.toString();
  const diff = findDiffRange(currentYDocText, nextContent);
  if (!diff) return;
  const applyYjsDiff = () => {
    if (diff.to > diff.from) {
      liveYText.delete(diff.from, diff.to - diff.from);
    }
    if (diff.insert.length > 0) {
      liveYText.insert(diff.from, diff.insert);
    }
  };
  if (liveYText.doc) {
    liveYText.doc.transact(applyYjsDiff, origin);
  } else {
    applyYjsDiff();
  }
}

export function applyExternalDiffToView(
  view: EditorView,
  nextContent: string,
): void {
  const currentDoc = view.state.doc.toString();
  const diff = findDiffRange(currentDoc, nextContent);
  if (!diff) return;
  const sel = view.state.selection.main;
  const newLen = nextContent.length;
  view.dispatch({
    changes: diff,
    annotations: programmaticSyncAnnotation.of(true),
    selection: {
      anchor: Math.min(sel.anchor, newLen),
      head: Math.min(sel.head, newLen),
    },
  });
}

export function reconfigureYjsBindingInView(
  view: EditorView,
  boundYTextRef: React.MutableRefObject<Y.Text | null>,
  nextYText: Y.Text | null,
  awareness: YjsCollabOptions['awareness'],
  collabAdapter: YjsCodeMirrorAdapter,
): void {
  if (boundYTextRef.current === nextYText) return;
  boundYTextRef.current = nextYText;

  if (nextYText) {
    const currentDocText = view.state.doc.toString();
    const yTextContent = nextYText.toString();
    if (nextYText.length === 0 && currentDocText.length > 0) {
      if (nextYText.doc) {
        nextYText.doc.transact(() => {
          if (nextYText.length === 0) {
            nextYText.insert(0, currentDocText);
          }
        }, 'local-init');
      } else {
        nextYText.insert(0, currentDocText);
      }
    } else if (nextYText.length > 0 && currentDocText !== yTextContent) {
      applyExternalDiffToView(view, yTextContent);
    }
  }

  view.dispatch({
    effects: collabAdapter.reconfigure({
      yText: nextYText,
      awareness,
    }),
  });
}

export function flushViewState(view: EditorView, targetFileId: string): void {
  const activeProposal = view.state.field(diffProposalField, false)?.proposal;
  if (activeProposal && targetFileId) {
    aiCoordinator.setPendingDiffForFile(targetFileId, activeProposal);
  } else if (targetFileId) {
    aiCoordinator.clearPendingDiffForFile(targetFileId);
  }

  const latestDoc = view.state.doc.toString();
  const existingModel = lruDocumentCache.getModel(targetFileId);
  if (!existingModel) {
    lruDocumentCache.registerModel(targetFileId, { content: latestDoc });
  } else if (existingModel.content !== latestDoc) {
    lruDocumentCache.updateContent(targetFileId, latestDoc, true);
  }
  const mainSel = view.state.selection.main;
  const scrollDOM = view.scrollDOM;
  lruDocumentCache.updateViewState(
    targetFileId,
    { anchor: mainSel.anchor, head: mainSel.head },
    { top: scrollDOM.scrollTop, left: scrollDOM.scrollLeft },
  );

  if (targetFileId) {
    const foldRanges: WarmFoldRange[] = [];
    try {
      const folds = foldedRanges(view.state);
      folds.between(0, view.state.doc.length, (from, to) => {
        foldRanges.push({ from, to });
      });
    } catch {
      // Ignore if folding state field is not active in this editor state
    }

    let stateJson: unknown;
    try {
      const hasHistory = Boolean(view.state.field(historyField, false));
      stateJson = view.state.toJSON(hasHistory ? { history: historyField } : undefined);
    } catch {
      stateJson = undefined;
    }

    if (stateJson) {
      warmEditorStatePool.put(targetFileId, {
        fileId: targetFileId,
        content: latestDoc,
        stateJson,
        foldedRanges: foldRanges,
        savedAt: Date.now(),
      });
    }
  }
}

export function restoreViewState(
  view: EditorView,
  targetFileId: string,
  docLength: number,
): void {
  const warmSnapshot = warmEditorStatePool.peek(targetFileId);
  if (
    warmSnapshot?.foldedRanges &&
    warmSnapshot.foldedRanges.length > 0 &&
    warmSnapshot.content === view.state.doc.toString()
  ) {
    try {
      const validFolds = warmSnapshot.foldedRanges
        .filter((r) => r.from >= 0 && r.to <= docLength && r.from < r.to)
        .map((r) => foldEffect.of({ from: r.from, to: r.to }));
      if (validFolds.length > 0) {
        view.dispatch({ effects: validFolds });
      }
    } catch {
      // Ignore fold restore errors if folding extension is unavailable
    }
  }

  const cachedModel = lruDocumentCache.get(targetFileId);
  if (cachedModel?.selection) {
    const anchor = Math.min(cachedModel.selection.anchor, docLength);
    const head = Math.min(cachedModel.selection.head, docLength);
    view.dispatch({ selection: { anchor, head } });
  }

  if (cachedModel?.scrollViewport) {
    requestAnimationFrame(() => {
      if (view.scrollDOM && cachedModel.scrollViewport) {
        view.scrollDOM.scrollTop = cachedModel.scrollViewport.top;
        view.scrollDOM.scrollLeft = cachedModel.scrollViewport.left;
      }
    });
  }
}
