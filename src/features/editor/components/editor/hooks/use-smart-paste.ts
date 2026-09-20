'use client';

/**
 * use-smart-paste.ts
 *
 * Monaco Editor hook for Overleaf-style Smart Paste:
 * 1. Excel / Google Sheets / TSV / HTML tables -> automatically converted to LaTeX tabular/booktabs
 * 2. Clipboard Images (Screenshots, Copied images) -> automatically uploaded to storage & inserted as \includegraphics figure
 */

import { useEffect, useRef } from 'react';
import type { editor } from 'monaco-editor';
import { toast } from 'sonner';
import {
  isTableData,
  parseTableToLatex,
  isImageData,
  extractImageFile,
  generateFigureLatex,
} from '@/features/editor/utils/smart-paste.util';
import { StorageService } from '@/features/editor/services/storage.service';

interface UseSmartPasteOptions {
  editorRef: React.MutableRefObject<editor.IStandaloneCodeEditor | null>;
  monacoRef: React.MutableRefObject<any>;
  pageId?: string | null;
  enabled?: boolean;
}

export function useSmartPaste({
  editorRef,
  monacoRef,
  pageId,
  enabled = true,
}: UseSmartPasteOptions) {
  const isUploadingRef = useRef(false);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !enabled) return;

    const domNode = editor.getDomNode();
    if (!domNode) return;

    const handlePaste = async (e: ClipboardEvent) => {
      const clipboardData = e.clipboardData;
      if (!clipboardData) return;

      // ── 1. Image Paste Detection ──────────────────────────────────────────
      if (isImageData(clipboardData)) {
        const file = extractImageFile(clipboardData);
        if (file && pageId) {
          e.preventDefault();
          e.stopPropagation();

          if (isUploadingRef.current) return;
          isUploadingRef.current = true;

          const toastId = 'smart-paste-img';
          toast.loading('Uploading pasted image...', { id: toastId });

          try {
            const uploaded = await StorageService.uploadPageFile(pageId, file);
            const filename = uploaded.filename || file.name;
            const figureLatex = generateFigureLatex(filename);

            const selection = editor.getSelection();
            if (selection) {
              editor.executeEdits('smart-paste-image', [
                {
                  range: selection,
                  text: figureLatex,
                  forceMoveMarkers: true,
                },
              ]);
              editor.focus();
            }

            toast.success(`Image uploaded and inserted as figure!`, { id: toastId, duration: 3000 });
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Upload failed';
            toast.error(`Image paste failed: ${msg}`, { id: toastId, duration: 4000 });
          } finally {
            isUploadingRef.current = false;
          }
          return;
        }
      }

      // ── 2. Table Paste Detection (Excel, Google Sheets, TSV, HTML) ─────────
      if (isTableData(clipboardData)) {
        const latexTable = parseTableToLatex(clipboardData, { booktabs: true });
        if (latexTable) {
          e.preventDefault();
          e.stopPropagation();

          const selection = editor.getSelection();
          if (selection) {
            editor.executeEdits('smart-paste-table', [
              {
                range: selection,
                text: latexTable,
                forceMoveMarkers: true,
              },
            ]);
            editor.focus();
          }

          toast.success('Pasted as LaTeX Table (booktabs)', { duration: 2500 });
          return;
        }
      }
    };

    // Attach listener in capturing phase so we intercept before Monaco's internal handler
    domNode.addEventListener('paste', handlePaste, true);

    return () => {
      domNode.removeEventListener('paste', handlePaste, true);
    };
  }, [editorRef, monacoRef, pageId, enabled]);
}
