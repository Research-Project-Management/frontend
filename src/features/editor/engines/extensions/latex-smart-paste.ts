/**
 * latex-smart-paste.ts
 *
 * CodeMirror 6 Smart Paste Extension (Engines Layer).
 *
 * Implements Overleaf 1:1 Parity for:
 * 1. Image pasting: Automatically extracts pasted screenshots / image blobs,
 *    generates `\begin{figure} \includegraphics ... \end{figure}`, and initiates
 *    background asset upload to the project's filestore.
 * 2. Table pasting: Detects HTML <table> elements or TSV spreadsheets (Excel, Google Sheets)
 *    and converts them to formatted LaTeX `\begin{table} \begin{tabular} ... \end{tabular} \end{table}`.
 * 3. Rich text pasting: Converts headings, bold, italic, lists, and links from Word/Google Docs
 *    into corresponding semantic LaTeX syntax.
 */

import { EditorView } from '@codemirror/view';
import {
  isTableData,
  parseTableToLatex,
  isImageData,
  extractImageFile,
  generateFigureLatex,
  isRichTextHtml,
  parseHtmlToLatex,
} from '@/features/editor/domain/latex/smart-paste';
import { filestore } from '@/features/editor/sdk/manuscript/filestore.api';
import { editorCommandBus } from '@/features/editor/coordinators/command-bus';

export interface LatexSmartPasteOptions {
  projectId?: string;
  enableSmartPaste?: boolean;
}

export function createLatexSmartPasteExtension(options: LatexSmartPasteOptions = {}) {
  const { projectId, enableSmartPaste = true } = options;

  return EditorView.domEventHandlers({
    paste(event, view) {
      if (!enableSmartPaste || !event.clipboardData) {
        return false;
      }

      const clipboard = event.clipboardData;

      // 1. Paste Image Data (Screenshots, copied image files)
      if (isImageData(clipboard)) {
        const file = extractImageFile(clipboard);
        if (file) {
          event.preventDefault();
          const figureSnippet = generateFigureLatex(file.name);
          const { from, to } = view.state.selection.main;
          view.dispatch({
            changes: { from, to, insert: figureSnippet },
            selection: { anchor: from + figureSnippet.length },
          });

          // Upload image in background if projectId is provided
          if (projectId) {
            filestore
              .upload(projectId, file, file.name)
              .then(() => {
                editorCommandBus.dispatch({ type: 'filetree:updated' });
              })
              .catch((err) => {
                console.error('[SmartPaste] Image upload failed:', err);
              });
          }
          return true;
        }
      }

      // 2. Paste Tabular Data (Excel, Google Sheets, TSV, HTML table)
      if (isTableData(clipboard)) {
        const tableLatex = parseTableToLatex(clipboard);
        if (tableLatex) {
          event.preventDefault();
          const { from, to } = view.state.selection.main;
          view.dispatch({
            changes: { from, to, insert: tableLatex },
            selection: { anchor: from + tableLatex.length },
          });
          return true;
        }
      }

      // 3. Paste Formatted Rich Text (Word, Google Docs, Apple Pages, Web)
      if (isRichTextHtml(clipboard)) {
        const html = clipboard.getData('text/html');
        const richLatex = parseHtmlToLatex(html);
        if (richLatex && richLatex.trim().length > 0) {
          event.preventDefault();
          const { from, to } = view.state.selection.main;
          view.dispatch({
            changes: { from, to, insert: richLatex },
            selection: { anchor: from + richLatex.length },
          });
          return true;
        }
      }

      return false;
    },
  });
}
