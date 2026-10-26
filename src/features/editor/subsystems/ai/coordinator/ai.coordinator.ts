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
  documentAuthority,
  editorCommandBus,
  usePageStore,
  useWorkspaceStore,
  sessionCoordinator,
} from '@/features/editor/core';
import { diagnosticsCoordinator, type IndexedDiagnosticItem } from '@/features/editor/subsystems/diagnostics';
import type { EditorDiagnosticItem } from '@/features/editor/domain/types/diagnostics.types';
import { manuscriptService } from '@/features/editor/sdk/manuscript.service';
import { lruDocumentCache } from '@/features/editor/domain/document/lru-document-cache';
import type { DiffProposal } from '@/features/editor/domain/types/ports/editor-engine.port';
import { extractDocumentContentString } from '@/features/editor/domain/types/core.types';
import { heuristicLatexErrorFix } from '@/features/editor/domain/ai/ai-error-assist';
import { toast } from 'sonner';

export interface AiContextPayload {
  activeFile: string;
  fileContent: string;
  selectedText?: string;
  cursorLine?: number;
  recentErrors?: Array<{ line: number; message: string; context?: string }>;
}

export class AiCoordinatorRegistry {
  private initialized = false;

  constructor() {
    this.initCommandSubscriptions();
  }

  public initCommandSubscriptions(force = false): void {
    if (typeof window === 'undefined') return;
    if (this.initialized && !force) return;
    this.initialized = true;

    editorCommandBus.subscribe('editor:suggest-fix', (cmd) => {
      this.openAiForError(cmd.error);
    });

    editorCommandBus.subscribe('ai:autofix-diagnostic', (cmd) => {
      void this.autoFixDiagnostic(cmd.diagnostic);
    });

    editorCommandBus.subscribe('editor:autofix', () => {
      void this.autoFixCurrentFile();
    });

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
        toast.success('Applied AI suggestion to document!', { id: 'ai-diff-status' });
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
   * Opens Left Sidebar AI tab and auto-fills error context
   */
  public openAiForError(error: { message: string; line?: number; file?: string; context?: string }): void {
    // 1. Switch Primary Sidebar to AI tab (Left Sidebar)
    const layoutStore = useWorkspaceStore.getState();
    layoutStore.setActiveSidebarTab('ai');
    layoutStore.setSidebarLeftOpen(true);

    // 2. Dispatch prompt initialization
    editorCommandBus.dispatch({
      type: 'sidebar:open-ai-panel',
      initialPrompt: `Please explain and fix this LaTeX error on line ${error.line || 'unknown'}:\n"${error.message}"\n\nContext:\n${error.context || ''}`,
    });
  }

  /**
   * 1-Click AutoFix for active document: finds the most critical diagnostic
   * and runs AI AutoFix with interactive inline diff.
   */
  public async autoFixCurrentFile(): Promise<boolean> {
    const pageStore = usePageStore.getState();
    const activeDoc = pageStore.getActiveDocument();
    const fileId = activeDoc?.id || 'main.tex';
    const filePath = activeDoc?.path || activeDoc?.title || fileId;

    const diags = diagnosticsCoordinator.getDiagnosticsForFile(filePath);
    const firstIssue = diags.find((d) => d.severity === 'error') || diags[0];

    if (!firstIssue) {
      toast.info('No syntax or compile errors found in this file.', { id: 'ai-autofix' });
      return false;
    }

    return this.autoFixDiagnostic(firstIssue);
  }

  /**
   * 1-Click AI AutoFix for compiler/linter diagnostics.
   * Calls LLM assist and immediately mounts an interactive inline diff for user review.
   */
  public async autoFixDiagnostic(diagnostic: EditorDiagnosticItem | IndexedDiagnosticItem): Promise<boolean> {
    const pageStore = usePageStore.getState();
    const activeDoc = pageStore.getActiveDocument();
    const fileId = activeDoc?.id || 'main.tex';
    const fileName = activeDoc?.title || fileId;

    const engine = getActiveEditorEngine();
    const content =
      documentAuthority.getDocumentContent(fileId) ||
      engine?.getContent() ||
      extractDocumentContentString(activeDoc?.content);

    // Extract surrounding code context (5 lines)
    const lines = content.split('\n');
    const errLine = Math.max(1, Math.min(diagnostic.line, lines.length));
    const startContext = Math.max(1, errLine - 2);
    const endContext = Math.min(lines.length, errLine + 2);
    const surroundingCode = lines.slice(startContext - 1, endContext).join('\n');

    // 1. Instant 0ms precomputed fix (if already resolved by heuristic rule)
    if (diagnostic.fixedSnippet) {
      editorCommandBus.dispatch({
        type: 'navigation:jump-to-line',
        filePath: fileName,
        fileId,
        line: diagnostic.line,
        highlight: 'error',
      });

      const success = this.proposeDiff(fileId, diagnostic.fixedSnippet, {
        line: diagnostic.line,
        title: `Quick-Fix: ${diagnostic.suggestion || diagnostic.message}`,
      });
      if (success) {
        toast.success(`Quick-Fix ready for line ${diagnostic.line} — Press Tab to Accept, Esc to Reject`, {
          id: 'ai-diff-proposal',
          duration: 6000,
        });
        return true;
      }
    }

    const toastId = typeof toast.loading === 'function'
      ? toast.loading(`Analyzing fix for line ${diagnostic.line}...`, { id: 'ai-diff-analyzing' })
      : null;

    try {
      const fixResult = await manuscriptService.ai.suggestLatexFix({
        errorMessage: diagnostic.message,
        errorLine: diagnostic.line,
        errorFile: fileName,
        detail: diagnostic.context,
        surroundingCode,
        fullCode: content.length < 50000 ? content : undefined,
        pageId: activeDoc?.id,
        projectId: pageStore.projectId,
      });

      if (toastId && typeof toast.dismiss === 'function') {
        toast.dismiss(toastId);
      }

      if (fixResult && fixResult.fixedSnippet) {
        editorCommandBus.dispatch({
          type: 'navigation:jump-to-line',
          filePath: fileName,
          fileId,
          line: diagnostic.line,
          highlight: 'error',
        });

        const success = this.proposeDiff(fileId, fixResult.fixedSnippet, {
          line: fixResult.startLine || diagnostic.line,
          endLine: fixResult.endLine,
          title: `AI Fix: ${fixResult.explanation || diagnostic.message}`,
        });
        if (success) {
          toast.success(`AI Diff ready for line ${diagnostic.line} — Press Tab to Accept, Esc to Reject`, {
            id: 'ai-diff-proposal',
            duration: 6000,
          });
        }
        return success;
      }
    } catch {
      // Remote call failed or offline — fall through to heuristic rule
    }

    if (toastId && typeof toast.dismiss === 'function') {
      toast.dismiss(toastId);
    }

    // 2. Offline Heuristic Fallback rule
    const fallbackFix = heuristicLatexErrorFix({
      errorMessage: diagnostic.message,
      errorLine: diagnostic.line,
      errorFile: fileName,
      detail: diagnostic.context,
      surroundingCode,
    });

    if (fallbackFix && fallbackFix.fixedSnippet) {
      editorCommandBus.dispatch({
        type: 'navigation:jump-to-line',
        filePath: fileName,
        fileId,
        line: diagnostic.line,
        highlight: 'error',
      });

      const success = this.proposeDiff(fileId, fallbackFix.fixedSnippet, {
        line: fallbackFix.startLine || diagnostic.line,
        endLine: fallbackFix.endLine,
        title: `Quick-Fix: ${fallbackFix.explanation || diagnostic.message}`,
      });
      if (success) {
        toast.success(`Quick-Fix ready for line ${diagnostic.line} — Press Tab to Accept, Esc to Reject`, {
          id: 'ai-diff-proposal',
          duration: 6000,
        });
        return true;
      }
    }

    toast.error('Could not generate an automated fix. Opening AI Assistant...', { id: 'ai-diff-proposal' });
    this.openAiForError(diagnostic);
    return false;
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
    const engine = (fileId ? getEditorEngineForFile(fileId) : null) || getActiveEditorEngine();
    if (!engine || !engine.proposeDiff) {
      return this.applyDirect(fileId, options?.line, replacement);
    }

    const content = engine.getContent();

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

        engine.proposeDiff(proposal);
        toast.info(`Review AI diff for line ${startLine} (Tab to Accept, Esc to Reject)`, { id: 'ai-diff-proposal' });
        return true;
      }
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

      engine.proposeDiff(proposal);
      toast.info('Review AI diff in editor (Tab to Accept, Esc to Reject)', { id: 'ai-diff-proposal' });
      return true;
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

      engine.proposeDiff(proposal);
      toast.info('Review AI insertion in editor (Tab to Accept, Esc to Reject)', { id: 'ai-diff-proposal' });
      return true;
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
      documentAuthority.getEditorEngineForFile(fileId) ?? getActiveEditorEngine();

    // If active document or split-pane is open in CodeMirror, apply via engine
    if (engine) {
      engine.insertText(replacement);
      sessionCoordinator.notifyContentChange(fileId, engine.getContent());
      toast.success('Applied AI suggestion to editor', { id: 'ai-diff-status' });
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
      toast.success('Updated document with AI suggestion', { id: 'ai-diff-status' });
      return true;
    }

    return false;
  }
}

export const aiCoordinator = new AiCoordinatorRegistry();
