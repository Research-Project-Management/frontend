/**
 * ai.coordinator.ts
 *
 * Headless AI Research & Error Assist Coordinator (Coordinators Layer).
 * Location: `features/editor/coordinators/ai.coordinator.ts`
 *
 * Capabilities:
 * - Aggregates active document context, cursor selection, and compiler errors.
 * - Decoupled from `AiTab` UI mount lifecycle (survives tab switches).
 * - Applies AI-generated code diffs directly into CodeMirror and LRU Cache.
 */

import { getActiveEditorInstance, getActiveEditorContent } from '../core/context/editor-instance.context';
import { usePageStore } from '../store/editor.store';
import { useLayoutStore } from '../store/layout.store';
import { diagnosticsCoordinator, type IndexedDiagnosticItem } from './diagnostics.coordinator';
import { sessionCoordinator } from './session.coordinator';
import { editorCommandBus } from './command-bus';
import { lruDocumentCache } from '../domain/lru-document-cache';
import { suggestLatexFix } from '../services/ai-error-assist.service';
import type { DiffProposal } from '../ports/editor-engine.port';
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

  private initCommandSubscriptions(): void {
    if (typeof window === 'undefined' || this.initialized) return;
    this.initialized = true;

    editorCommandBus.subscribe('editor:suggest-fix', (cmd) => {
      this.openAiForError(cmd.error);
    });

    editorCommandBus.subscribe('ai:autofix-diagnostic', (cmd) => {
      void this.autoFixDiagnostic(cmd.diagnostic);
    });

    editorCommandBus.registerExecutor('ai:apply-fix', async (cmd) => {
      return this.applyReplacement(cmd.fileId, cmd.line, cmd.replacement);
    });

    editorCommandBus.subscribe('ai:propose-diff', (cmd) => {
      const engine = getActiveEditorInstance();
      if (engine?.proposeDiff) {
        engine.proposeDiff(cmd.proposal);
      }
    });

    editorCommandBus.subscribe('ai:accept-diff', (cmd) => {
      const engine = getActiveEditorInstance();
      if (engine?.acceptDiff) {
        engine.acceptDiff(cmd.diffId);
      }
    });

    editorCommandBus.subscribe('ai:reject-diff', (cmd) => {
      const engine = getActiveEditorInstance();
      if (engine?.rejectDiff) {
        engine.rejectDiff(cmd.diffId);
      }
    });
  }

  /**
   * Collects full IDE context for LLM prompts (active file, selection, errors)
   */
  public gatherContext(): AiContextPayload {
    const pageStore = usePageStore.getState();
    const activeDoc = pageStore.activeFilePage || pageStore.currentPage;
    const fileName = activeDoc?.title || 'main.tex';
    const content = getActiveEditorContent() || (activeDoc?.content as string) || '';

    const engine = getActiveEditorInstance();
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
    const layoutStore = useLayoutStore.getState();
    layoutStore.setActiveSidebarTab('ai');
    layoutStore.setSidebarLeftOpen(true);

    // 2. Dispatch prompt initialization
    editorCommandBus.dispatch({
      type: 'sidebar:open-ai-panel',
      initialPrompt: `Please explain and fix this LaTeX error on line ${error.line || 'unknown'}:\n"${error.message}"\n\nContext:\n${error.context || ''}`,
    });
  }

  /**
   * 1-Click AI AutoFix for compiler/linter diagnostics.
   * Calls LLM assist and immediately mounts an interactive inline diff for user review.
   */
  public async autoFixDiagnostic(diagnostic: IndexedDiagnosticItem): Promise<boolean> {
    const pageStore = usePageStore.getState();
    const activeDoc = pageStore.activeFilePage || pageStore.currentPage;
    const fileId = activeDoc?.id || 'main.tex';
    const fileName = activeDoc?.title || fileId;

    const engine = getActiveEditorInstance();
    const content = engine?.getContent() || (activeDoc?.content as string) || '';

    // Extract surrounding code context (5 lines)
    const lines = content.split('\n');
    const errLine = Math.max(1, Math.min(diagnostic.line, lines.length));
    const startContext = Math.max(1, errLine - 2);
    const endContext = Math.min(lines.length, errLine + 2);
    const surroundingCode = lines.slice(startContext - 1, endContext).join('\n');

    const toastId = toast.loading(`AI is analyzing fix for line ${diagnostic.line}...`);

    try {
      const fixResult = await suggestLatexFix({
        errorMessage: diagnostic.message,
        errorLine: diagnostic.line,
        errorFile: fileName,
        detail: diagnostic.context,
        surroundingCode,
        fullCode: content.length < 50000 ? content : undefined,
        pageId: activeDoc?.id,
        projectId: pageStore.projectId,
      });

      toast.dismiss(toastId);

      if (fixResult && fixResult.fixedSnippet) {
        const success = this.proposeDiff(fileId, fixResult.fixedSnippet, {
          line: fixResult.startLine || diagnostic.line,
          endLine: fixResult.endLine,
          title: `AI Fix: ${fixResult.explanation || diagnostic.message}`,
        });
        return success;
      } else {
        toast.error('AI could not generate an automatic fix. Opening AI Assistant...');
        this.openAiForError(diagnostic);
        return false;
      }
    } catch {
      toast.dismiss(toastId);
      toast.error('Failed to generate AI fix. Opening AI Assistant...');
      this.openAiForError(diagnostic);
      return false;
    }
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
    const engine = getActiveEditorInstance();
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
        toast.info(`Review AI diff for line ${startLine} (⌘⏎ Accept, Esc Reject)`);
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
      toast.info('Review AI diff in editor (⌘⏎ Accept, Esc Reject)');
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
      toast.info('Review AI insertion in editor (⌘⏎ Accept, Esc Reject)');
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

    const engine = getActiveEditorInstance();

    // If active document is open in CodeMirror, apply via engine
    if (engine) {
      engine.insertText(replacement);
      toast.success('Applied AI suggestion to editor');
      return true;
    }

    // Fallback: update in LRU cache and notify session coordinator
    const model = lruDocumentCache.getModel(fileId);
    if (model) {
      sessionCoordinator.notifyContentChange(fileId, replacement);
      toast.success('Updated document with AI suggestion');
      return true;
    }

    return false;
  }
}

export const aiCoordinator = new AiCoordinatorRegistry();
