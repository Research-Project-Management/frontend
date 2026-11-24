/**
 * ai.coordinator.ts
 *
 * Headless AI Research & Error Assist Coordinator (Coordinators Layer).
 * Location: `features/editor/subsystems/ai/coordinator/ai.coordinator.ts`
 *
 * Capabilities:
 * - Aggregates active document context, cursor selection, and compiler errors.
 * - Decoupled from `AiTab` UI mount lifecycle (survives tab switches).
 * - Applies AI-generated code diffs directly into CodeMirror and LRU Cache.
 */

import {
  getActiveEditorEngine,
  getEditorEngineForFile,
  getActiveEditorContent,
  documentFacade,
  editorCommandBus,
  usePageStore,
  sessionCoordinator,
} from '@/features/editor/core';
import { diagnosticsCoordinator } from '@/features/editor/subsystems/diagnostics';
import { lruDocumentCache } from '@/features/editor/domain/document/lru-document-cache';
import type { EditorPatchItem } from '@/features/ai';
import type { DiffProposal, IEditorEngine } from '@/features/editor/domain/types/ports/editor-engine.port';
import { extractDocumentContentString } from '@/features/editor/domain/types/core.types';
import {
  computePreambleInsertion,
  isPreambleOnlySnippet,
} from '@/features/editor/domain/latex/latex-preamble-patch';
import { toast } from 'sonner';

export interface ResolvedAnchorRange {
  from: number;
  to: number;
  originalText: string;
  replacementText: string;
}

function normalizeEol(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function findAllExactRanges(haystack: string, needle: string): Array<{ from: number; to: number }> {
  const ranges: Array<{ from: number; to: number }> = [];
  if (!needle) return ranges;
  let pos = 0;
  while (pos <= haystack.length) {
    const idx = haystack.indexOf(needle, pos);
    if (idx === -1) break;
    ranges.push({ from: idx, to: idx + needle.length });
    pos = idx + 1;
  }
  return ranges;
}

function findTrimmedLineRanges(content: string, searchText: string): Array<{ from: number; to: number }> {
  const searchLines = normalizeEol(searchText)
    .split('\n')
    .map((line) => line.trim());
  while (searchLines.length > 0 && searchLines[0] === '') searchLines.shift();
  while (searchLines.length > 0 && searchLines[searchLines.length - 1] === '') searchLines.pop();
  if (searchLines.length === 0) return [];

  const docLines = content.split('\n');
  if (docLines.length < searchLines.length) return [];

  const lineStarts: number[] = [];
  let offset = 0;
  for (const line of docLines) {
    lineStarts.push(offset);
    offset += line.length + 1;
  }

  const trimmedDoc = docLines.map((line) => line.replace(/\r$/, '').trim());
  const window = searchLines.length;
  const ranges: Array<{ from: number; to: number }> = [];

  for (let i = 0; i <= docLines.length - window; i++) {
    let allEqual = true;
    for (let j = 0; j < window; j++) {
      if (trimmedDoc[i + j] !== searchLines[j]) {
        allEqual = false;
        break;
      }
    }
    if (allEqual) {
      const from = lineStarts[i];
      const lastRaw = docLines[i + window - 1].replace(/\r$/, '');
      const to = lineStarts[i + window - 1] + lastRaw.length;
      ranges.push({ from, to });
    }
  }
  return ranges;
}

function pickDisambiguatedRange(
  content: string,
  ranges: Array<{ from: number; to: number }>,
  fromLine?: number,
): { from: number; to: number } | null {
  if (ranges.length === 0) return null;
  if (ranges.length === 1) return ranges[0];
  if (typeof fromLine !== 'number' || fromLine < 1) return null;

  let best: { range: { from: number; to: number }; dist: number } | null = null;
  let tied = false;

  for (const r of ranges) {
    const lineNum = content.slice(0, r.from).split('\n').length;
    const dist = Math.abs(lineNum - fromLine);
    if (dist > 5) continue;
    if (!best || dist < best.dist) {
      best = { range: r, dist };
      tied = false;
    } else if (dist === best.dist) {
      tied = true;
    }
  }

  return best && !tied ? best.range : null;
}

const DOC_CLASS_RE = /\\documentclass(?:\[[^\]]*\])?\{[^}]+\}/;

function findAfterDocumentClassPos(content: string): number {
  const match = DOC_CLASS_RE.exec(content);
  if (!match) return -1;
  const endOfMatch = match.index + match[0].length;
  const nextNewline = content.indexOf('\n', endOfMatch);
  return nextNewline === -1 ? content.length : nextNewline + 1;
}

function formatLineInsertion(content: string, pos: number, lines: string[]): string {
  const needsLeadingNewline = pos > 0 && content[pos - 1] !== '\n';
  return `${needsLeadingNewline ? '\n' : ''}${lines.join('\n')}\n`;
}

export function resolveAnchorInContent(
  content: string,
  patch: Pick<EditorPatchItem, 'kind' | 'searchText' | 'replaceText' | 'fromLine' | 'toLine'>,
): ResolvedAnchorRange | null {
  if (typeof content !== 'string') return null;
  const search = normalizeEol(patch.searchText || '');
  const replacement = normalizeEol(patch.replaceText || '');
  const afterDocClass = findAfterDocumentClassPos(content);
  const insertsUsepackageOnly =
    /\\usepackage/.test(replacement) && !DOC_CLASS_RE.test(replacement);

  if (search.length > 0) {
    const exact = findAllExactRanges(content, search);
    const chosen = pickDisambiguatedRange(content, exact, patch.fromLine);
    if (chosen) {
      if (afterDocClass !== -1 && chosen.from < afterDocClass && insertsUsepackageOnly) {
        const addedLines = replacement
          .split('\n')
          .filter((ln) => ln.trim().length > 0);
        if (addedLines.length > 0) {
          return {
            from: afterDocClass,
            to: afterDocClass,
            originalText: '',
            replacementText: formatLineInsertion(content, afterDocClass, addedLines),
          };
        }
      }
      return {
        from: chosen.from,
        to: chosen.to,
        originalText: content.slice(chosen.from, chosen.to),
        replacementText: replacement,
      };
    }

    const trimmed = findTrimmedLineRanges(content, search);
    const chosenTrimmed = pickDisambiguatedRange(content, trimmed, patch.fromLine);
    if (chosenTrimmed) {
      if (afterDocClass !== -1 && chosenTrimmed.from < afterDocClass && insertsUsepackageOnly) {
        const addedLines = replacement
          .split('\n')
          .filter((ln) => ln.trim().length > 0);
        if (addedLines.length > 0) {
          return {
            from: afterDocClass,
            to: afterDocClass,
            originalText: '',
            replacementText: formatLineInsertion(content, afterDocClass, addedLines),
          };
        }
      }
      return {
        from: chosenTrimmed.from,
        to: chosenTrimmed.to,
        originalText: content.slice(chosenTrimmed.from, chosenTrimmed.to),
        replacementText: replacement,
      };
    }
  }

  if (patch.kind === 'insert_preamble') {
    const addedLines = replacement
      .split('\n')
      .filter((ln) => ln.trim() !== '\\begin{document}' && !DOC_CLASS_RE.test(ln) && ln.trim().length > 0);
    if (addedLines.length === 0) return null;

    const beginIdx = content.indexOf('\\begin{document}');
    let insertPos = -1;
    if (beginIdx !== -1) {
      const beginLineStart = content.lastIndexOf('\n', beginIdx) + 1;
      insertPos =
        afterDocClass !== -1 && beginLineStart < afterDocClass
          ? afterDocClass
          : beginLineStart;
    } else if (afterDocClass !== -1) {
      insertPos = afterDocClass;
    }

    if (insertPos !== -1) {
      return {
        from: insertPos,
        to: insertPos,
        originalText: '',
        replacementText: formatLineInsertion(content, insertPos, addedLines),
      };
    }
  }

  return null;
}

export interface AiContextPayload {
  activeFile: string;
  fileContent: string;
  selectedText?: string;
  cursorLine?: number;
  recentErrors?: Array<{ line: number; message: string; context?: string }>;
}

export class AiCoordinator {
  private initialized = false;
  private readonly pendingDiffsByFile = new Map<string, DiffProposal>();
  private readonly pendingPatchByFile = new Map<string, EditorPatchItem>();

  constructor() {
    this.initCommandSubscriptions();
  }

  public setPendingDiffForFile(fileId: string, proposal: DiffProposal): void {
    if (!fileId) return;
    this.pendingDiffsByFile.set(fileId, proposal);
  }

  public consumePendingDiffForFile(fileId: string, docText?: string): DiffProposal | null {
    if (!fileId) return null;
    const proposal = this.pendingDiffsByFile.get(fileId) ?? null;
    if (proposal) {
      this.pendingDiffsByFile.delete(fileId);
      return proposal;
    }

    const pendingPatch = this.pendingPatchByFile.get(fileId);
    if (pendingPatch && typeof docText === 'string') {
      this.pendingPatchByFile.delete(fileId);
      const resolved = resolveAnchorInContent(docText, pendingPatch);
      if (!resolved) {
        toast.error(
          `Could not locate patch anchor in ${pendingPatch.filePath} — file may have changed.`,
          { id: 'ai-diff-proposal' },
        );
        return null;
      }
      return {
        id: pendingPatch.id || `diff-${Date.now()}`,
        from: resolved.from,
        to: resolved.to,
        originalText: resolved.originalText,
        replacementText: resolved.replacementText,
        title: pendingPatch.title,
        createdAt: Date.now(),
      };
    }

    return null;
  }

  public clearPendingDiffForFile(fileId: string): void {
    if (!fileId) return;
    this.pendingDiffsByFile.delete(fileId);
    this.pendingPatchByFile.delete(fileId);
  }

  private resolveTargetFile(patch: Pick<EditorPatchItem, 'fileId' | 'filePath'>): {
    targetFileId: string;
    engine: IEditorEngine | null;
    isActive: boolean;
  } {
    const pageStore = usePageStore.getState();
    const activeDoc = pageStore.activeFilePage || pageStore.getActiveDocument?.();
    const activeFileId =
      pageStore.activeFilePage?.id ||
      pageStore.activeDocId ||
      pageStore.currentPage?.id ||
      '';
    const activePath = (activeDoc?.path || activeDoc?.title || '').replace(/^\/+/, '');
    const cleanPatchPath = (patch.filePath || '').replace(/^\/+/, '');

    const resolvedId =
      (patch.fileId && patch.fileId.trim()) ||
      (cleanPatchPath && activePath && cleanPatchPath === activePath ? activeFileId : '') ||
      (!cleanPatchPath ? activeFileId : '') ||
      '';

    const exactEngine = resolvedId ? getEditorEngineForFile(resolvedId) : null;
    const isActive =
      Boolean(resolvedId && resolvedId === activeFileId) ||
      (!resolvedId && Boolean(cleanPatchPath && cleanPatchPath === activePath));
    const engine = exactEngine || (isActive ? getActiveEditorEngine() : null);

    return { targetFileId: resolvedId || activeFileId, engine, isActive };
  }

  public proposePatch(patch: EditorPatchItem): boolean {
    const { targetFileId, engine, isActive } = this.resolveTargetFile(patch);

    if (engine?.isReadOnly?.()) {
      toast.info('Editor is in read-only mode', { id: 'ai-diff-readonly' });
      return false;
    }

    if (engine?.proposeDiff) {
      const content = engine.getContent();
      const resolved = resolveAnchorInContent(content, patch);
      if (!resolved) {
        toast.error(
          `Could not locate patch anchor in ${patch.filePath} — file may have changed.`,
          { id: 'ai-diff-proposal' },
        );
        return false;
      }

      if (targetFileId) {
        this.clearPendingDiffForFile(targetFileId);
      }
      engine.proposeDiff({
        id: patch.id || `diff-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        from: resolved.from,
        to: resolved.to,
        originalText: resolved.originalText,
        replacementText: resolved.replacementText,
        title: patch.title,
        createdAt: Date.now(),
      });
      engine.focus();
      toast.info(`Review diff for ${patch.filePath} (Tab or ⌘⏎ to Accept, Esc to Reject)`, {
        id: 'ai-diff-proposal',
      });
      return true;
    }

    if (targetFileId && !isActive) {
      this.pendingDiffsByFile.delete(targetFileId);
      this.pendingPatchByFile.set(targetFileId, patch);
      editorCommandBus.dispatch({
        type: 'workspace:open-file',
        fileId: targetFileId,
        filePath: patch.filePath,
      });
      toast.info(`Opening ${patch.filePath} to review diff...`, {
        id: 'ai-diff-proposal',
      });
      return true;
    }

    toast.error(`Cannot review diff: target file "${patch.filePath}" is not open.`, {
      id: 'ai-diff-proposal',
    });
    return false;
  }

  public applyAllPatches(patches: readonly EditorPatchItem[]): {
    applied: number;
    failed: number;
  } {
    let applied = 0;
    let failed = 0;
    let openedDeferred = false;

    const byTarget = new Map<string, { engine: IEditorEngine | null; isActive: boolean; items: EditorPatchItem[] }>();
    for (const patch of patches) {
      const target = this.resolveTargetFile(patch);
      const bucketKey = target.targetFileId || patch.filePath;
      const existing = byTarget.get(bucketKey);
      if (existing) {
        existing.items.push(patch);
      } else {
        byTarget.set(bucketKey, {
          engine: target.engine,
          isActive: target.isActive,
          items: [patch],
        });
      }
    }

    for (const [targetKey, group] of byTarget) {
      const { engine, isActive, items } = group;
      if (!engine || engine.isReadOnly?.()) {
        if (!engine && targetKey && !isActive && !openedDeferred && items.length > 0) {
          this.pendingPatchByFile.set(targetKey, items[0]);
          editorCommandBus.dispatch({
            type: 'workspace:open-file',
            fileId: targetKey,
            filePath: items[0].filePath,
          });
          openedDeferred = true;
        }
        failed += items.length;
        continue;
      }

      const content = engine.getContent();
      const resolvedItems: Array<{ patch: EditorPatchItem; resolved: ResolvedAnchorRange }> = [];
      for (const patch of items) {
        const resolved = resolveAnchorInContent(content, patch);
        if (!resolved) {
          failed += 1;
        } else {
          resolvedItems.push({ patch, resolved });
        }
      }

      // Apply bottom-to-top so earlier offsets remain exact across hunks
      resolvedItems.sort((a, b) => b.resolved.from - a.resolved.from);
      for (const { patch, resolved } of resolvedItems) {
        const diffId = patch.id || `diff-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        if (engine.proposeDiff && engine.acceptDiff) {
          engine.proposeDiff({
            id: diffId,
            from: resolved.from,
            to: resolved.to,
            originalText: resolved.originalText,
            replacementText: resolved.replacementText,
            title: patch.title,
            createdAt: Date.now(),
          });
          engine.acceptDiff(diffId);
          applied += 1;
        } else if (engine.replaceRange) {
          engine.replaceRange(resolved.replacementText, resolved.from, resolved.to);
          applied += 1;
        } else {
          failed += 1;
        }
      }
      engine.focus();
    }

    return { applied, failed };
  }

  public initCommandSubscriptions(force = false): void {
    if (typeof window === 'undefined') return;
    if (this.initialized && !force) return;
    this.initialized = true;

    editorCommandBus.registerExecutor('ai:apply-fix', async (cmd) => {
      return this.applyReplacement(cmd.fileId, cmd.line, cmd.replacement);
    });

    editorCommandBus.subscribe('ai:propose-diff', (cmd) => {
      const engine = getActiveEditorEngine();
      if (engine?.proposeDiff) {
        engine.proposeDiff(cmd.proposal);
      }
    });

    editorCommandBus.subscribe('ai:accept-diff', (cmd) => {
      const engine = getActiveEditorEngine();
      if (engine?.acceptDiff) {
        engine.acceptDiff(cmd.diffId);
      }
    });

    editorCommandBus.subscribe('ai:reject-diff', (cmd) => {
      const engine = getActiveEditorEngine();
      if (engine?.rejectDiff) {
        engine.rejectDiff(cmd.diffId);
      }
    });

    editorCommandBus.subscribe('ai:diff-resolved', (cmd) => {
      if (cmd.action === 'accept') {
        toast.success('Applied AI suggestion', { id: 'ai-diff-status' });
        editorCommandBus.dispatch({ type: 'compiler:trigger', draft: true });
      }
    });
  }

  /**
   * Collects full IDE context for LLM prompts (active file, selection, errors)
   */
  public gatherContext(): AiContextPayload {
    const pageStore = usePageStore.getState();
    const activeDoc = pageStore.getActiveDocument();
    const fileName = activeDoc?.title || 'main.tex';
    const content = getActiveEditorContent() || extractDocumentContentString(activeDoc?.content);

    const engine = getActiveEditorEngine();
    const selectedText = engine?.getSelectedText() || undefined;
    const cursor = engine?.getCursorPosition();

    // Get recent compiler diagnostics for this file
    const diagnostics = diagnosticsCoordinator
      .getDiagnosticsForFile(fileName)
      .slice(0, 5)
      .map((d) => ({
        line: d.line,
        message: d.message,
        context: d.context,
      }));

    return {
      activeFile: fileName,
      fileContent: content,
      selectedText,
      cursorLine: cursor?.line,
      recentErrors: diagnostics,
    };
  }

  /**
   * Proposes an AI code diff interactively with Accept/Reject overlay
   */
  public proposeDiff(
    fileId: string,
    replacement: string,
    options?: { line?: number; endLine?: number; title?: string }
  ): boolean {
    if (!replacement) return false;

    const pageStore = usePageStore.getState();
    const activeFileId =
      pageStore.activeFilePage?.id ||
      pageStore.activeDocId ||
      pageStore.currentPage?.id ||
      '';
    const exactEngine = fileId ? getEditorEngineForFile(fileId) : null;
    const isTargetingActive = !fileId || fileId === activeFileId;
    const engine = exactEngine || (isTargetingActive ? getActiveEditorEngine() : null);

    if (engine?.isReadOnly?.()) {
      toast.info('Editor is in read-only mode', { id: 'ai-diff-readonly' });
      return false;
    }

    const content =
      engine?.getContent() ??
      (fileId ? lruDocumentCache.getModel(fileId)?.content ?? documentFacade.getDocumentContent(fileId) : '') ??
      '';

    const buildAndDispatchProposal = (proposal: DiffProposal): boolean => {
      if (engine?.proposeDiff) {
        this.clearPendingDiffForFile(fileId);
        engine.proposeDiff(proposal);
        return true;
      }
      if (fileId && !isTargetingActive) {
        this.setPendingDiffForFile(fileId, proposal);
        return true;
      }
      return false;
    };

    // 0. Preamble \usepackage{...} fix: insert cleanly after \documentclass and before \begin{document}
    if (isPreambleOnlySnippet(replacement)) {
      const preamblePatch = computePreambleInsertion(content, replacement);
      if (preamblePatch) {
        if (!preamblePatch.changed) {
          toast.info('Package(s) already present in preamble', {
            id: 'ai-diff-proposal',
          });
          return true;
        }
        const defaultTitle =
          preamblePatch.addedLines.length === 1
            ? `Add ${preamblePatch.addedLines[0]} to preamble`
            : `Add ${preamblePatch.addedLines.length} packages to preamble`;
        const proposal: DiffProposal = {
          id: `diff-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          from: preamblePatch.from,
          to: preamblePatch.to,
          originalText: preamblePatch.originalText,
          replacementText: preamblePatch.insertText,
          title: options?.title || defaultTitle,
          createdAt: Date.now(),
        };
        if (buildAndDispatchProposal(proposal)) {
          toast.info('Review preamble package diff in editor (Tab or ⌘⏎ to Accept, Esc to Reject)', {
            id: 'ai-diff-proposal',
          });
          return true;
        }
      }
    }

    // 1. Line-targeted diff (single-line or multi-line range)
    if (options?.line !== undefined && options.line > 0) {
      const lines = content.split('\n');
      const startLine = options.line;
      const endLine = options.endLine && options.endLine >= startLine ? options.endLine : startLine;

      if (startLine <= lines.length) {
        let from = 0;
        for (let i = 1; i < startLine; i++) {
          from += lines[i - 1].length + 1;
        }

        let to = from;
        for (let i = startLine; i <= endLine && i <= lines.length; i++) {
          to += lines[i - 1].length + (i < endLine && i < lines.length ? 1 : 0);
        }

        const originalText = content.slice(from, to);

        const proposal: DiffProposal = {
          id: `diff-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          from,
          to,
          originalText,
          replacementText: replacement,
          title:
            options?.title ||
            (startLine === endLine ? `AI Fix (Line ${startLine})` : `AI Fix (Lines ${startLine}-${endLine})`),
          createdAt: Date.now(),
        };

        if (buildAndDispatchProposal(proposal)) {
          toast.info(`Review AI diff for line ${startLine} (Tab or ⌘⏎ to Accept, Esc to Reject)`, {
            id: 'ai-diff-proposal',
          });
          return true;
        }
      }
    }

    // Defer end-of-doc proposal if switching to an unmounted file without a valid line range
    if (!engine || !engine.proposeDiff) {
      if (fileId && !isTargetingActive) {
        const docEnd = content.length;
        const proposal: DiffProposal = {
          id: `diff-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          from: docEnd,
          to: docEnd,
          originalText: '',
          replacementText: replacement,
          title: options?.title || 'AI Fix',
          createdAt: Date.now(),
        };
        this.setPendingDiffForFile(fileId, proposal);
        return true;
      }
      return this.applyDirect(fileId, options?.line, replacement);
    }

    // 2. Selection-targeted diff
    const offsets = engine.getSelectionOffsets?.();
    if (offsets && offsets.to > offsets.from) {
      const originalText = engine.getSelectedText();
      const proposal: DiffProposal = {
        id: `diff-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        from: offsets.from,
        to: offsets.to,
        originalText,
        replacementText: replacement,
        title: options?.title || 'AI Proposed Selection Diff',
        createdAt: Date.now(),
      };

      if (buildAndDispatchProposal(proposal)) {
        toast.info('Review AI diff in editor (Tab or ⌘⏎ to Accept, Esc to Reject)', { id: 'ai-diff-proposal' });
        return true;
      }
    }

    // 3. Cursor-position diff
    if (offsets) {
      const proposal: DiffProposal = {
        id: `diff-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        from: offsets.from,
        to: offsets.to,
        originalText: '',
        replacementText: replacement,
        title: options?.title || 'AI Code Proposal',
        createdAt: Date.now(),
      };

      if (buildAndDispatchProposal(proposal)) {
        toast.info('Review AI insertion in editor (Tab or ⌘⏎ to Accept, Esc to Reject)', {
          id: 'ai-diff-proposal',
        });
        return true;
      }
    }

    return this.applyDirect(fileId, options?.line, replacement);
  }

  /**
   * Applies an AI code suggestion / diff directly or via interactive diff
   */
  public applyReplacement(fileId: string, line?: number, replacement?: string): boolean {
    if (!replacement) return false;
    return this.proposeDiff(fileId, replacement, { line });
  }

  /**
   * Direct fallback insertion when interactive diff is bypassed
   */
  public applyDirect(fileId: string, line?: number, replacement?: string): boolean {
    if (!replacement) return false;

    const engine =
      documentFacade.getEditorEngineForFile(fileId) ?? getActiveEditorEngine();

    // If active document or split-pane is open in CodeMirror, apply via engine
    if (engine) {
      engine.insertText(replacement);
      sessionCoordinator.notifyContentChange(fileId, engine.getContent());
      toast.success('Applied AI suggestion', { id: 'ai-diff-status' });
      return true;
    }

    // Fallback: update in LRU cache and notify session coordinator
    const model = lruDocumentCache.getModel(fileId);
    if (model) {
      let nextContent = model.content;
      if (typeof line === 'number' && line > 0) {
        const lines = model.content.split('\n');
        const idx = Math.max(0, Math.min(line - 1, lines.length - 1));
        lines[idx] = replacement;
        nextContent = lines.join('\n');
      } else {
        nextContent = model.content ? `${model.content}\n${replacement}` : replacement;
      }
      sessionCoordinator.notifyContentChange(fileId, nextContent);
      toast.success('Applied AI suggestion', { id: 'ai-diff-status' });
      return true;
    }

    return false;
  }
}

export const aiCoordinator = new AiCoordinator();
