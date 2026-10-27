'use client';

/**
 * use-log-viewer-actions.ts
 *
 * Dedicated hook encapsulating viewer logs actions and notifications:
 * - Snippet copy to clipboard
 * - Error explanation lookup with fallback feedback
 * - Quick fix execution (replacement, end tag insertion, preamble insertion)
 * - AI fix application
 * - Auxiliary / output file downloading
 * Location: `features/editor/ui/features/preview/hooks/use-log-viewer-actions.ts`
 */

import { useCallback } from 'react';
import { toast } from 'sonner';
import type { LogEntry, ErrorExplanationDto } from '@/features/editor/domain/types/compiler.types';
import type { IEditorEngine } from '@/features/editor/domain/types/ports/editor-engine.port';
import type { AiErrorFixResult } from '@/features/editor/domain/ai/ai-error-assist';
import { manuscriptService, downloadAuxFileUrl, downloadAllArtifactsZipUrl } from '@/features/editor/sdk/manuscript.service';
import { aiCoordinator } from '@/features/editor/subsystems/ai';
import { navigationCoordinator } from '@/features/editor/subsystems/navigation';
import { usePageStore, workspaceCoordinator, editorCommandBus } from '@/features/editor/core';

export function copySnippetToClipboard(snippet?: string): void {
  if (!snippet) return;
  navigator.clipboard.writeText(snippet);
  toast.success('Snippet copied to clipboard', { id: 'copy-snippet' });
}

export async function fetchLogEntryExplanation(entry: LogEntry): Promise<ErrorExplanationDto | null> {
  try {
    if (entry.code) {
      return await manuscriptService.diagnostics.getExplanation(entry.code);
    }
    const rules = await manuscriptService.diagnostics.getRules();
    const found = rules.find((r) => {
      if (r.title && entry.message.toLowerCase().includes(r.title.toLowerCase())) return true;
      return false;
    });
    return found || null;
  } catch {
    return null;
  }
}

export interface UseLogViewerActionsOptions {
  engine?: (Pick<IEditorEngine, 'jumpToLine'> & Partial<Pick<IEditorEngine, 'getContent' | 'setContent' | 'insertText'>>) | null;
  projectId?: string;
  onCompile?: () => void;
  onClearCacheAndCompile?: () => void;
}

export function useLogViewerActions({
  engine,
  projectId,
  onCompile,
  onClearCacheAndCompile,
}: UseLogViewerActionsOptions = {}) {
  const copySnippet = copySnippetToClipboard;
  const fetchErrorExplanation = fetchLogEntryExplanation;

  const applyQuickFix = useCallback(
    (
      entry: LogEntry,
      quickFix: { description: string; replacementText: string },
    ) => {
      if (!engine) {
        toast.error('Editor is not ready', { id: 'log-quick-fix' });
        return;
      }

      if (entry.line) {
        engine.jumpToLine(entry.line, 'error');
      }

      const replacement = quickFix.replacementText;
      if (replacement) {
        if (typeof engine.getContent === 'function' && typeof engine.setContent === 'function') {
          const content = engine.getContent();
          const trimmedFix = replacement.trim();
          const descLower = quickFix.description.toLowerCase();
          const isPreambleFix =
            trimmedFix.startsWith('\\usepackage') || descLower.includes('preamble');

          const applyUpdatedContent = (newContent: string, fromOffset?: number, toOffset?: number, insertStr?: string) => {
            const anyEng = engine as Partial<Pick<IEditorEngine, 'replaceRange' | 'setContent'>>;
            if (typeof anyEng.replaceRange === 'function' && fromOffset !== undefined && toOffset !== undefined && insertStr !== undefined) {
              anyEng.replaceRange(insertStr, fromOffset, toOffset);
            } else if (typeof anyEng.setContent === 'function') {
              anyEng.setContent(newContent);
            } else {
              editorCommandBus.dispatch({ type: 'editor:set-content', content: newContent });
            }
          };

          if (isPreambleFix) {
            if (!content.includes(trimmedFix)) {
              const beginDocIdx = content.indexOf('\\begin{document}');
              if (beginDocIdx !== -1) {
                const updated =
                  content.slice(0, beginDocIdx) +
                  `${trimmedFix}\n` +
                  content.slice(beginDocIdx);
                applyUpdatedContent(updated, beginDocIdx, beginDocIdx, `${trimmedFix}\n`);
              } else {
                const docClassMatch = content.match(/^.*\\documentclass(?:\[[^\]]*\])?\{[^}]+\}.*$/m);
                if (docClassMatch && docClassMatch.index !== undefined) {
                  const insertPos = docClassMatch.index + docClassMatch[0].length;
                  const updated =
                    content.slice(0, insertPos) +
                    `\n${trimmedFix}` +
                    content.slice(insertPos);
                  applyUpdatedContent(updated, insertPos, insertPos, `\n${trimmedFix}`);
                } else {
                  applyUpdatedContent(`${trimmedFix}\n${content}`, 0, 0, `${trimmedFix}\n`);
                }
              }
            }
          } else if (entry.line && entry.line >= 1) {
            const lines = content.split('\n');
            const targetIdx = Math.min(entry.line - 1, Math.max(0, lines.length - 1));
            const isInsertion =
              trimmedFix.startsWith('\\end{') ||
              descLower.includes('insert') ||
              descLower.includes('add ') ||
              descLower.includes('append');
            let lineStartOffset = 0;
            for (let i = 0; i < targetIdx; i++) {
              lineStartOffset += lines[i].length + 1;
            }
            const lineEndOffset = lineStartOffset + lines[targetIdx].length;
            if (isInsertion) {
              lines[targetIdx] = `${lines[targetIdx]}\n${replacement}`;
              applyUpdatedContent(lines.join('\n'), lineEndOffset, lineEndOffset, `\n${replacement}`);
            } else {
              lines[targetIdx] = replacement;
              applyUpdatedContent(lines.join('\n'), lineStartOffset, lineEndOffset, replacement);
            }
          } else if (typeof engine.insertText === 'function') {
            engine.insertText(replacement);
          }
        } else if (typeof engine.insertText === 'function') {
          engine.insertText(replacement);
        }
      }

      toast.success(`Applied fix: ${quickFix.description}`, { id: 'log-quick-fix' });
      onCompile?.();
    },
    [engine, onCompile],
  );

  const applyAiFix = useCallback(
    (entry: LogEntry, fix: AiErrorFixResult, onApplied?: () => void) => {
      const pageStore = usePageStore.getState();
      let targetFileId = pageStore.activeFilePage?.id || pageStore.currentPage?.id || 'main.tex';
      let targetFileName = pageStore.activeFilePage?.title || 'main.tex';

      if (entry.file) {
        const cleanEntryFile = entry.file.replace(/^\/+/, '');
        const projectFiles = workspaceCoordinator.getProjectFiles() || [];
        const found = projectFiles.find(
          (f: { id: string; title?: string; name?: string; path?: string }) => f.title === cleanEntryFile || f.name === cleanEntryFile || (f.path && f.path.replace(/^\/+/, '') === cleanEntryFile)
        );
        if (found) {
          targetFileId = found.id;
          targetFileName = found.title || cleanEntryFile;
        }
      }

      if (targetFileId !== pageStore.activeFilePage?.id) {
        navigationCoordinator.openDocument({
          fileId: targetFileId,
          title: targetFileName,
        });
      }

      const startLine = fix.startLine || entry.line;
      const endLine = fix.endLine && startLine && fix.endLine >= startLine ? fix.endLine : startLine;

      // Consistent Flow: Always propose interactive Diff for user review (Tab to Accept, Esc to Reject)
      const success = aiCoordinator.proposeDiff(targetFileId, fix.fixedSnippet, {
        line: startLine,
        endLine,
        title: `AI Fix: ${fix.explanation || entry.message}`,
      });

      if (!success && engine && typeof engine.getContent === 'function' && typeof engine.setContent === 'function' && startLine && startLine >= 1) {
        const content = engine.getContent();
        const lines = content.split('\n');
        const startIdx = Math.min(startLine - 1, Math.max(0, lines.length - 1));
        const endIdx = Math.min((endLine || startLine) - 1, Math.max(startIdx, lines.length - 1));
        lines.splice(startIdx, endIdx - startIdx + 1, fix.fixedSnippet);
        engine.setContent(lines.join('\n'));
      }

      onApplied?.();
      // Notice: Do NOT call onCompile?.() immediately on diff proposal — compile only after diff is accepted!
    },
    [engine],
  );

  const downloadAuxFile = useCallback(
    (filename: string) => {
      if (!projectId) {
        toast.error('Project ID not found', { id: 'download-aux' });
        return;
      }
      const url = downloadAuxFileUrl(projectId, filename);
      window.open(url, '_blank');
      toast.success(`Downloading ${filename}...`, { id: `download-aux-${filename}` });
    },
    [projectId],
  );

  const downloadAllAux = useCallback(() => {
    if (!projectId) {
      toast.error('Project ID not found', { id: 'download-all-aux' });
      return;
    }
    const url = downloadAllArtifactsZipUrl(projectId);
    window.open(url, '_blank');
    toast.success('Downloading all auxiliary files...', { id: 'download-all-aux' });
  }, [projectId]);

  return {
    copySnippet,
    fetchErrorExplanation,
    applyQuickFix,
    applyAiFix,
    downloadAuxFile,
    downloadAllAux,
    downloadFile: downloadAuxFile,
    downloadAllArtifacts: downloadAllAux,
  };
}
