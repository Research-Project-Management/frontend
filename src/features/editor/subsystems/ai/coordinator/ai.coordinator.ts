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
import {
  resolveAnchorInContent,
  type ResolvedAnchorRange,
} from '../model/patch-anchor.resolver';

export type { ResolvedAnchorRange };
export { resolveAnchorInContent };

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
