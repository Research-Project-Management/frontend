/**
 * useEditorSelectionBar.ts
 *
 * Encapsulates Floating Toolbar positioning & Context Menu DOM event handlers for CodeMirror 6.
 */

import { type ViewUpdate, EditorView } from '@codemirror/view';
import { getMisspelledWordAtPos, type MisspelledItem } from '../latex-spellcheck';
import type { SelFloating } from '@/features/editor/components/editor/subcomponents/EditorFloatingBar';

export interface UseEditorSelectionBarOptions {
  onSelectionFloatingRef: React.RefObject<((floating: SelFloating | null) => void) | undefined>;
  onContextMenuRef: React.RefObject<
    | ((data: {
        x: number;
        y: number;
        startLine: number;
        endLine: number;
        text: string;
        misspelledInfo?: MisspelledItem | null;
      }) => void)
    | undefined
  >;
}

export function createSelectionUpdateHandler(
  onSelectionFloatingRef: React.RefObject<((floating: SelFloating | null) => void) | undefined>
) {
  return (update: ViewUpdate) => {
    if (update.selectionSet || update.docChanged || update.geometryChanged) {
      const mainSel = update.state.selection.main;
      if (!mainSel.empty) {
        const text = update.state.sliceDoc(mainSel.from, mainSel.to);
        if (text.trim().length > 0) {
          const lineBlock = update.view.lineBlockAt(mainSel.from);
          const lineCoords = update.view.coordsAtPos(lineBlock.from);
          const startSelCoords = update.view.coordsAtPos(mainSel.from);
          const coords = lineCoords || startSelCoords;

          if (coords) {
            const editorRect = update.view.dom.getBoundingClientRect();
            const guttersEl = update.view.dom.querySelector('.cm-gutters') as HTMLElement | null;
            const guttersRect = guttersEl?.getBoundingClientRect();

            if (coords.top >= editorRect.top - 10 && coords.top <= editorRect.bottom - 20) {
              const startLine = update.state.doc.lineAt(mainSel.from).number;
              const endLine = update.state.doc.lineAt(mainSel.to).number;
              const widgetWidth = 28;
              const targetX = guttersRect
                ? guttersRect.right - widgetWidth - 2
                : Math.max(8, coords.left - widgetWidth - 4);

              onSelectionFloatingRef.current?.({
                x: targetX,
                y: coords.top,
                startLine,
                endLine,
                text,
              });
              return;
            }
          }
        }
      }
      onSelectionFloatingRef.current?.(null);
    }
  };
}

export function createContextMenuHandler(
  onContextMenuRef: React.RefObject<
    | ((data: {
        x: number;
        y: number;
        startLine: number;
        endLine: number;
        text: string;
        misspelledInfo?: MisspelledItem | null;
      }) => void)
    | undefined
  >
) {
  return EditorView.domEventHandlers({
    contextmenu: (event, view) => {
      event.preventDefault();
      const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
      const misspelledInfo = pos !== null ? getMisspelledWordAtPos(view.state, pos) : null;

      let selectedText = '';
      const sel = view.state.selection.main;
      if (!sel.empty) {
        selectedText = view.state.sliceDoc(sel.from, sel.to);
      } else if (misspelledInfo) {
        selectedText = misspelledInfo.word;
      } else if (pos !== null) {
        const wordRange = view.state.wordAt(pos);
        if (wordRange) {
          selectedText = view.state.sliceDoc(wordRange.from, wordRange.to);
        }
      }

      let startLine = 1;
      let endLine = 1;
      if (pos !== null) {
        const line = view.state.doc.lineAt(pos);
        startLine = line.number;
        endLine = line.number;
      }

      onContextMenuRef.current?.({
        x: event.clientX,
        y: event.clientY,
        startLine,
        endLine,
        text: selectedText,
        misspelledInfo,
      });
      return true;
    },
  });
}
