'use client';

/**
 * useLogViewerActions.ts
 *
 * Dedicated hook encapsulating viewer logs actions and notifications:
 * - Snippet copy to clipboard
 * - Error explanation lookup with fallback feedback
 * - Quick fix execution (replacement, end tag insertion, preamble insertion)
 * - AI fix application
 * - Auxiliary / output file downloading
 * Location: `features/editor/ui/features/preview/hooks/useLogViewerActions.ts`
 */

import { useCallback } from 'react';
import { toast } from 'sonner';
import type { LogEntry } from '@/features/editor/domain/types';
import type { AiErrorFixResult } from '@/features/editor/coordinators/services/ai-error-assist.service';
import {
  downloadAuxFileUrl,
  downloadAllArtifactsZipUrl,
} from '@/features/editor/coordinators/services/compiler.service';
import { manuscriptService } from '@/features/editor/coordinators/services/manuscript.service';
import { aiCoordinator } from '@/features/editor/coordinators/ai.coordinator';
import { usePageStore } from '@/features/editor/store';

export function copySnippetToClipboard(snippet?: string): void {
  if (!snippet) return;
  navigator.clipboard.writeText(snippet);
  toast.success('Snippet copied to clipboard');
}

export async function fetchLogEntryExplanation(entry: LogEntry): Promise<any | null> {
  try {
    if (entry.code) {
      return await manuscriptService.diagnostics.getExplanation(entry.code);
    }
    const rules = await manuscriptService.diagnostics.getRules();
    const found = rules.find((r: any) => {
      if (r.title && entry.message.toLowerCase().includes(r.title.toLowerCase())) return true;
      return false;
    });
    return found || null;
  } catch {
    return null;
  }
}

export interface UseLogViewerActionsOptions {
  engine?: any;
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
        toast.error('Editor is not ready');
        return;
      }

      if (entry.line) {
        engine.jumpToLine(entry.line, 'error');
      }

      toast.success(`Applied fix: ${quickFix.description}`);
      onCompile?.();
    },
    [engine, onCompile],
  );

  const applyAiFix = useCallback(
    (entry: LogEntry, fix: AiErrorFixResult, onApplied?: () => void) => {
      const pageStore = usePageStore.getState();
      const fileId = pageStore.activeFilePage?.id || pageStore.currentPage?.id || 'main.tex';

      aiCoordinator.proposeDiff(fileId, fix.fixedSnippet, {
        line: fix.startLine || entry.line,
        endLine: fix.endLine,
        title: `AI Fix: ${fix.explanation || entry.message}`,
      });

      onApplied?.();
    },
    [],
  );

  const downloadAuxFile = useCallback(
    (filename: string) => {
      if (!projectId) {
        toast.error('Project ID not found');
        return;
      }
      const url = downloadAuxFileUrl(projectId, filename);
      window.open(url, '_blank');
      toast.success(`Downloading ${filename}...`);
    },
    [projectId],
  );

  const downloadAllAux = useCallback(() => {
    if (!projectId) {
      toast.error('Project ID not found');
      return;
    }
    const url = downloadAllArtifactsZipUrl(projectId);
    window.open(url, '_blank');
    toast.success('Downloading all auxiliary files...');
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
