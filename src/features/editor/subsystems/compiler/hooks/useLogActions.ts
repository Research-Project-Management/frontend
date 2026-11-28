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
 * Location: `features/editor/subsystems/compiler/ui/hooks/useLogViewerActions.ts`
 */

import { useCallback } from 'react';
import { toast } from 'sonner';
import type { LogEntry } from '@/features/editor/domain/types/compiler.types';
import type { IEditorEngine } from '@/features/editor/domain/types/ports/editor-engine.port';
import type { AiErrorFixResult } from '@/features/editor/domain/ai/ai-error-assist';
import { downloadAuxFileUrl, downloadAllArtifactsZipUrl } from '@/features/editor/sdk/pages.service';
import { aiCoordinator } from '@/features/editor/subsystems/ai';
import { navigationCoordinator } from '@/features/editor/subsystems/navigation';
import { usePageStore, workspaceCoordinator, editorCommandBus } from '@/features/editor/core';
import { getEditorEngineForFile } from '@/features/editor/core/bus/engine-registry';
import { lruDocumentCache } from '@/features/editor/domain/document/lru-document-cache';
import {
  computePreambleInsertion,
  isPreambleOnlySnippet,
} from '@/features/editor/domain/latex/latex-preamble-patch';
import { DEFAULT_MAIN_FILE } from '@/features/editor/domain/constants/editor.constants';

export interface ProjectFileCandidate {
  id: string;
  title?: string;
  name?: string;
  path?: string;
}

function normalizeLogPath(filePath: string): string {
  return filePath.replace(/\\/g, '/').replace(/^(?:\.\/)+/, '').replace(/^\/+/, '');
}

export function resolveProjectFileByLogPath<T extends ProjectFileCandidate>(
  logFile: string | undefined,
  mainFile: string,
  projectFiles: T[],
): T | undefined {
  const rawTarget = (logFile || '').trim() || mainFile;
  const normalizedTarget = normalizeLogPath(rawTarget);
  if (!normalizedTarget || projectFiles.length === 0) return undefined;
  const targetLower = normalizedTarget.toLowerCase();

  const getCandidates = (file: T): string[] =>
    [file.path, file.title, file.name].filter((value): value is string => Boolean(value)).map(normalizeLogPath);

  return (
    projectFiles.find((file) => getCandidates(file).some((candidate) => candidate === normalizedTarget)) ||
    projectFiles.find((file) => getCandidates(file).some((candidate) => candidate.toLowerCase() === targetLower)) ||
    projectFiles.find((file) =>
      getCandidates(file).some((candidate) => candidate.toLowerCase().endsWith(`/${targetLower}`)),
    )
  );
}

interface QuickFixPatchResult {
  updated: string;
  fromOffset?: number;
  toOffset?: number;
  insertStr?: string;
  changed: boolean;
}

function computeQuickFixPatch(
  content: string,
  entryLine: number | undefined,
  quickFix: { description: string; replacementText: string },
  isPreambleFix: boolean,
): QuickFixPatchResult {
  const replacement = quickFix.replacementText;
  const trimmedFix = replacement.trim();
  const descriptionLower = quickFix.description.toLowerCase();

  if (isPreambleFix) {
    const patch = computePreambleInsertion(content, replacement, { fallbackToTop: true });
    if (!patch || !patch.changed) {
      return { updated: content, changed: false };
    }
    return {
      updated: patch.updated,
      fromOffset: patch.from,
      toOffset: patch.to,
      insertStr: patch.insertText,
      changed: true,
    };
  }

  if (entryLine && entryLine >= 1) {
    const lines = content.split('\n');
    const targetIdx = Math.min(entryLine - 1, Math.max(0, lines.length - 1));
    const isInsertion =
      trimmedFix.startsWith('\\end{') ||
      descriptionLower.includes('insert') ||
      descriptionLower.includes('add ') ||
      descriptionLower.includes('append');
    let lineStartOffset = 0;
    for (let i = 0; i < targetIdx; i++) {
      lineStartOffset += lines[i].length + 1;
    }
    const lineEndOffset = lineStartOffset + lines[targetIdx].length;
    if (isInsertion) {
      lines[targetIdx] = `${lines[targetIdx]}\n${replacement}`;
      return {
        updated: lines.join('\n'),
        fromOffset: lineEndOffset,
        toOffset: lineEndOffset,
        insertStr: `\n${replacement}`,
        changed: true,
      };
    }
    lines[targetIdx] = replacement;
    return {
      updated: lines.join('\n'),
      fromOffset: lineStartOffset,
      toOffset: lineEndOffset,
      insertStr: replacement,
      changed: true,
    };
  }

  return { updated: content, changed: false };
}

export function copySnippetToClipboard(snippet?: string): void {
  if (!snippet) return;
  navigator.clipboard.writeText(snippet);
  toast.success('Copied', { id: 'copy-snippet' });
}

export interface UseLogViewerActionsOptions {
  engine?: (Pick<IEditorEngine, 'jumpToLine'> & Partial<Pick<IEditorEngine, 'getContent' | 'setContent' | 'insertText'>>) | null;
  projectId?: string;
  onCompile?: () => void;
}

export function useLogViewerActions({
  engine,
  projectId,
  onCompile,
}: UseLogViewerActionsOptions = {}) {

  const applyQuickFix = useCallback(
    (
      entry: LogEntry,
      quickFix: { description: string; replacementText: string },
    ) => {
      const pageStore = usePageStore.getState();
      const configuredMainFile = pageStore.mainFilePath || DEFAULT_MAIN_FILE;
      const activeFileId = pageStore.activeFilePage?.id || pageStore.currentPage?.id;
      const replacement = quickFix.replacementText;
      const trimmedFix = replacement.trim();
      const descriptionLower = quickFix.description.toLowerCase();
      const isPreambleFix =
        isPreambleOnlySnippet(replacement) ||
        trimmedFix.startsWith('\\usepackage') ||
        descriptionLower.includes('preamble');

      const projectFiles = (workspaceCoordinator.getProjectFiles() || []) as ProjectFileCandidate[];
      const targetPath = isPreambleFix ? configuredMainFile : entry.file || configuredMainFile;
      const targetNode = resolveProjectFileByLogPath(targetPath, configuredMainFile, projectFiles);

      let targetEngine = engine ?? null;
      const switchesToOtherFile = Boolean(targetNode && targetNode.id !== activeFileId);

      if (targetNode && switchesToOtherFile) {
        navigationCoordinator.openDocument({
          fileId: targetNode.id,
          title: targetNode.title || targetNode.name || targetPath,
        });
        targetEngine = getEditorEngineForFile(targetNode.id);
      }

      if (!targetEngine) {
        if (targetNode && replacement) {
          const cached = lruDocumentCache.getContent(targetNode.id);
          if (typeof cached === 'string') {
            const patch = computeQuickFixPatch(cached, entry.line, quickFix, isPreambleFix);
            if (patch.changed) {
              lruDocumentCache.updateContent(targetNode.id, patch.updated, true);
            }
            toast.success(`Applied fix: ${quickFix.description}`, { id: 'log-quick-fix' });
            onCompile?.();
            return;
          }
        }
        toast.error('Editor is not ready', { id: 'log-quick-fix' });
        return;
      }

      if (!isPreambleFix && entry.line) {
        targetEngine.jumpToLine(entry.line, 'error');
      }

      if (replacement) {
        if (typeof targetEngine.getContent === 'function' && typeof targetEngine.setContent === 'function') {
          const content = targetEngine.getContent();
          const patch = computeQuickFixPatch(content, entry.line, quickFix, isPreambleFix);

          if (patch.changed) {
            const editableEngine = targetEngine as Partial<Pick<IEditorEngine, 'replaceRange' | 'setContent'>>;
            if (
              typeof editableEngine.replaceRange === 'function' &&
              patch.fromOffset !== undefined &&
              patch.toOffset !== undefined &&
              patch.insertStr !== undefined
            ) {
              editableEngine.replaceRange(patch.insertStr, patch.fromOffset, patch.toOffset);
            } else if (typeof editableEngine.setContent === 'function') {
              editableEngine.setContent(patch.updated);
            } else {
              editorCommandBus.dispatch({ type: 'editor:set-content', content: patch.updated });
            }
          } else if (!isPreambleFix && !entry.line && typeof targetEngine.insertText === 'function') {
            targetEngine.insertText(replacement);
          }
        } else if (typeof targetEngine.insertText === 'function') {
          targetEngine.insertText(replacement);
        }
      }

      toast.success(`Applied fix: ${quickFix.description}`, { id: 'log-quick-fix' });
      onCompile?.();
    },
    [engine, onCompile],
  );

  const applyAiFix = useCallback(
    (
      entry: LogEntry,
      fix: AiErrorFixResult,
      onOutcome?: (outcome: 'proposed' | 'applied') => void,
    ) => {
      const pageStore = usePageStore.getState();
      const configuredMainFile = pageStore.mainFilePath || DEFAULT_MAIN_FILE;
      let targetFileId = pageStore.activeFilePage?.id || pageStore.currentPage?.id || configuredMainFile;
      let targetFileName = pageStore.activeFilePage?.title || configuredMainFile;

      if (entry.file) {
        const projectFiles = (workspaceCoordinator.getProjectFiles() || []) as ProjectFileCandidate[];
        const found = resolveProjectFileByLogPath(entry.file, configuredMainFile, projectFiles);
        if (found) {
          targetFileId = found.id;
          targetFileName = found.title || found.name || entry.file.replace(/^\/+/, '');
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
      const proposed = aiCoordinator.proposeDiff(targetFileId, fix.fixedSnippet, {
        line: startLine,
        endLine,
        title: `AI Fix: ${fix.explanation || entry.message}`,
      });

      if (proposed) {
        onOutcome?.('proposed');
        return;
      }

      if (
        engine &&
        typeof engine.getContent === 'function' &&
        typeof engine.setContent === 'function' &&
        startLine &&
        startLine >= 1
      ) {
        const content = engine.getContent();
        const lines = content.split('\n');
        const startIdx = Math.min(startLine - 1, Math.max(0, lines.length - 1));
        const endIdx = Math.min((endLine || startLine) - 1, Math.max(startIdx, lines.length - 1));
        lines.splice(startIdx, endIdx - startIdx + 1, fix.fixedSnippet);
        engine.setContent(lines.join('\n'));
        onOutcome?.('applied');
      }
      // Notice: Do NOT call onCompile?.() immediately on diff proposal — compile only after diff is accepted!
    },
    [engine],
  );

  const downloadFile = useCallback(
    (filename: string) => {
      if (!projectId) {
        toast.error('Project ID not found', { id: 'download-aux' });
        return;
      }
      const url = downloadAuxFileUrl(projectId, filename);
      window.open(url, '_blank');
    },
    [projectId],
  );

  const downloadAllArtifacts = useCallback(() => {
    if (!projectId) {
      toast.error('Project ID not found', { id: 'download-all-aux' });
      return;
    }
    const url = downloadAllArtifactsZipUrl(projectId);
    window.open(url, '_blank');
  }, [projectId]);

  return {
    applyQuickFix,
    applyAiFix,
    downloadFile,
    downloadAllArtifacts,
  };
}
