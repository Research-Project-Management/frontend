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
 */

import { useCallback } from 'react';
import { toast } from 'sonner';
import type { LogEntry } from './Logs';
import type { AiErrorFixResult } from '@/features/editor/services/ai-error-assist.service';
import {
  downloadAuxFileUrl,
  downloadAllArtifactsZipUrl,
} from '@/features/editor/services/compiler.service';
import { manuscriptService } from '@/features/editor/services/manuscript.service';

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
  const copySnippet = useCallback((snippet?: string) => {
    if (!snippet) return;
    navigator.clipboard.writeText(snippet);
    toast.success('Snippet copied to clipboard');
  }, []);

  const fetchErrorExplanation = useCallback(
    async (entry: LogEntry): Promise<any | null> => {
      try {
        if (entry.code) {
          const exp = await manuscriptService.diagnostics.getExplanation(entry.code);
          return exp;
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
    },
    [],
  );

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
      if (!engine) {
        toast.error('Editor is not ready');
        return;
      }

      if (entry.line) {
        engine.jumpToLine(entry.line, 'synctex');
      }

      toast.success('AI fix applied successfully');
      onApplied?.();
      onCompile?.();
    },
    [engine, onCompile],
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
