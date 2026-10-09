'use client';

/**
 * VisualEditorView.tsx
 *
 * Rich-Text / Visual LaTeX Editor View (Overleaf Visual Mode Parity).
 * Location: `features/editor/ui/features/editor/VisualEditorView.tsx`
 *
 * Capabilities:
 * 1. WYSIWYG Document Surface:
 *    - Headings (H1 \section, H2 \subsection, H3 \subsubsection) rendered with styled typography.
 *    - Bold (\textbf), Italic (\textit), Underline (\underline), Code (\texttt).
 *    - Ordered and unordered lists.
 *    - Tables rendered as interactive HTML tables.
 * 2. Interactive KaTeX Math Editing:
 *    - Inline ($...$) and Display ($$...$$, \begin{equation}...\end{equation}) rendered with KaTeX.
 *    - Click-to-edit inline math editor card with live real-time KaTeX preview.
 * 3. Protected LaTeX Environments:
 *    - Figures, TikZ, Algorithms, Listings preserved with clean cards and 1-click raw LaTeX editor.
 * 4. Interactive Citations & References:
 *    - \cite rendered as clickable chips [@key] with citation details and picker link.
 *    - \ref rendered as link badges.
 * 5. Lossless Two-Way Sync:
 *    - Continuous debounced synchronization with backend LaTeX source via latexToHtml / htmlToLatex.
 *    - Registered with setActiveEditorEngine and editorCommandBus.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import 'katex/dist/katex.min.css';
import { cn } from '@/shared/lib/utils';
import {
  latexToHtml,
  htmlToLatex,
  renderMathHtml,
} from '@/features/editor/domain/latex/latex-converter';
import { editorCommandBus } from '@/features/editor/coordinators/command-bus';
import { EditorEventBus } from '@/features/editor/domain/latex/latex-structure';
import { useSettingsStore } from '../../../store/settings.store';
import { VisualSlashCommandMenu } from './VisualSlashCommandMenu';
import { VisualTableToolbar } from './VisualTableToolbar';
import { VisualFigureToolbar } from './VisualFigureToolbar';
import { VisualSelectionBubbleMenu } from './VisualSelectionBubbleMenu';
import { VisualCollaboratorCursors } from './VisualCollaboratorCursors';
import { VisualReferenceHoverCard } from './VisualReferenceHoverCard';
import {
  VisualMathEditorModal,
  type ActiveMathEditorState,
} from './VisualMathEditorModal';
import {
  VisualProtectedEditorModal,
  type ActiveProtectedBlockEditorState,
} from './VisualProtectedEditorModal';
import { useVisualTableMatrix } from './hooks/useVisualTableMatrix';
import { useVisualFigureOperations } from './hooks/useVisualFigureOperations';
import { useVisualSyncTexEngine } from './hooks/useVisualSyncTexEngine';
import { useVisualSelectionBubble } from './hooks/useVisualSelectionBubble';
import { useVisualSlashMenu } from './hooks/useVisualSlashMenu';
import type { CollaboratorPresenceInfo } from '../../../store/collaboration.store';

export interface VisualEditorViewProps {
  fileId?: string;
  filePath?: string;
  value: string;
  onChange?: (nextLatex: string) => void;
  readOnly?: boolean;
  currentUserId?: string;
  collaborators?: CollaboratorPresenceInfo[];
}

export function VisualEditorView({
  fileId,
  filePath = 'main.tex',
  value,
  onChange,
  readOnly = false,
  currentUserId,
  collaborators,
}: VisualEditorViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const originalLatexRef = useRef<string>(value);
  const debounceTimerRef = useRef<any>(null);

  // Math editor floating modal state
  const [activeMath, setActiveMath] = useState<ActiveMathEditorState | null>(null);

  // Protected block raw code editor modal state
  const [activeProtected, setActiveProtected] = useState<ActiveProtectedBlockEditorState | null>(
    null
  );

  const toggleEditorMode = useSettingsStore((s) => s.toggleEditorMode);

  // Sync incoming value to internal HTML only when external value has diverged
  useEffect(() => {
    originalLatexRef.current = value;
    if (!contentRef.current) return;

    const currentHtml = contentRef.current.innerHTML;
    const currentDerivedLatex = htmlToLatex(currentHtml, value);

    if (currentDerivedLatex.trim() !== value.trim()) {
      const newHtml = latexToHtml(value);
      contentRef.current.innerHTML = newHtml;
    }
  }, [value]);

  // Two-way sync: read HTML, convert back to LaTeX, and call onChange
  const syncHtmlToLatex = useCallback(() => {
    if (!contentRef.current || readOnly) return;
    const html = contentRef.current.innerHTML;
    const nextLatex = htmlToLatex(html, originalLatexRef.current);
    originalLatexRef.current = nextLatex;
    onChange?.(nextLatex);
  }, [onChange, readOnly]);

  const handleInput = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      syncHtmlToLatex();
    }, 250);
  }, [syncHtmlToLatex]);

  // ── Table Matrix Operations Hook ──────────────────────────────────────────
  const {
    activeTable,
    setActiveTable,
    handleTableCellClick,
    handleAddRowAbove,
    handleAddRowBelow,
    handleDeleteRow,
    handleAddColumnLeft,
    handleAddColumnRight,
    handleDeleteColumn,
    handleAlignColumn,
    handleUpdateMetadata: handleUpdateTableMetadata,
    handleDeleteTable,
  } = useVisualTableMatrix({ syncHtmlToLatex });

  // ── Figure Operations Hook ────────────────────────────────────────────────
  const {
    activeFigure,
    setActiveFigure,
    projectImageFiles,
    handleFigureClick,
    handleChangeFigureWidth,
    handleChangeFigureImage,
    handleUpdateFigureMetadata,
    handleToggleFigureCentering,
    handleToggleFigureStarred,
    handleDeleteFigure,
  } = useVisualFigureOperations({ contentRef, syncHtmlToLatex });

  // ── SyncTeX & Active Editor Engine Hook ────────────────────────────────────
  const {
    handleDoubleClick,
    triggerForwardSync,
    broadcastLocalCursor,
  } = useVisualSyncTexEngine({
    containerRef,
    contentRef,
    originalLatexRef,
    fileId,
    filePath,
    currentUserId,
    readOnly,
    handleInput,
  });

  // ── Slash Command Menu Hook ───────────────────────────────────────────────
  const {
    slashMenu,
    setSlashMenu,
    handleSelectSlashCommand,
    handleSlashKeyDown,
    handleSlashKeyUp,
  } = useVisualSlashMenu({
    contentRef,
    projectImageFiles,
    handleInput,
  });

  // ── Floating Selection Bubble Menu Hook ───────────────────────────────────
  const hasActiveModalOrToolbar = Boolean(
    activeMath || activeProtected || activeTable || activeFigure || slashMenu.isOpen
  );

  const {
    selectionBubble,
    setSelectionBubble,
    updateSelectionBubble,
    handleBubbleFormat,
    handleBubbleBlockTypeChange,
    handleBubbleConvertToMath,
    handleBubbleConvertToCitation,
  } = useVisualSelectionBubble({
    contentRef,
    readOnly,
    hasActiveModalOrToolbar,
    handleInput,
    broadcastLocalCursor,
  });

  // ── Math Modal Handlers ───────────────────────────────────────────────────
  const handleSaveMath = useCallback(
    (state: ActiveMathEditorState) => {
      const { element, currentMath, isDisplay } = state;
      if (!currentMath.trim()) {
        element.remove();
      } else {
        const renderedHtml = renderMathHtml(currentMath.trim(), isDisplay);
        element.innerHTML = renderedHtml;
        element.setAttribute('data-math', encodeURIComponent(currentMath.trim()));
      }
      setActiveMath(null);
      syncHtmlToLatex();
    },
    [syncHtmlToLatex]
  );

  const handleDeleteMath = useCallback(
    (state: ActiveMathEditorState) => {
      state.element.remove();
      setActiveMath(null);
      syncHtmlToLatex();
    },
    [syncHtmlToLatex]
  );

  // ── Protected Block Handlers ──────────────────────────────────────────────
  const handleSaveProtectedBlock = useCallback(
    (element: HTMLElement, rawLatex: string) => {
      element.setAttribute('data-raw-latex', encodeURIComponent(rawLatex));
      const preEl = element.querySelector('pre');
      if (preEl) {
        preEl.textContent = rawLatex;
      }
      setActiveProtected(null);
      syncHtmlToLatex();
    },
    [syncHtmlToLatex]
  );

  // ── Format Execution (Toolbar commands, Bus events) ───────────────────────
  const executeVisualCommand = useCallback(
    (cmd: { command: string; level?: 1 | 2 | 3; contentHtml?: string }) => {
      if (readOnly) return;
      contentRef.current?.focus();

      switch (cmd.command) {
        case 'bold':
          document.execCommand('bold', false);
          break;
        case 'italic':
          document.execCommand('italic', false);
          break;
        case 'underline':
          document.execCommand('underline', false);
          break;
        case 'strike':
          document.execCommand('strikeThrough', false);
          break;
        case 'heading': {
          const tag = cmd.level === 2 ? 'h2' : cmd.level === 3 ? 'h3' : 'h1';
          document.execCommand('formatBlock', false, tag);
          break;
        }
        case 'bulletList':
          document.execCommand('insertUnorderedList', false);
          break;
        case 'orderedList':
          document.execCommand('insertOrderedList', false);
          break;
        case 'quote':
          document.execCommand('formatBlock', false, 'blockquote');
          break;
        case 'code':
          document.execCommand('formatBlock', false, 'pre');
          break;
        case 'insertMath': {
          const sampleMath = 'x^2 + y^2 = z^2';
          const rendered = renderMathHtml(sampleMath, false);
          const mathHtml = `<span class="latex-math-inline inline-block px-1 py-0.5 bg-muted/20 rounded cursor-pointer" data-math="${encodeURIComponent(sampleMath)}">${rendered}</span>&nbsp;`;
          document.execCommand('insertHTML', false, mathHtml);
          break;
        }
        case 'insertCitation':
          editorCommandBus.dispatch({ type: 'dialog:open', dialog: 'citation-picker' });
          break;
        default:
          break;
      }

      handleInput();
    },
    [handleInput, readOnly]
  );

  // Command Bus and Event Bus subscriptions
  useEffect(() => {
    const unsubCmd = editorCommandBus.subscribe('editor:visual-command', (cmd) => {
      executeVisualCommand(cmd);
    });

    const unsubEvent = EditorEventBus.on('flux:visual-command', (cmd) => {
      executeVisualCommand(cmd);
    });

    const unsubCite = EditorEventBus.on('flux:insert-citation', (payload) => {
      if (payload?.bibKey) {
        const chipHtml = `<span class="latex-citation-chip font-mono text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded inline-block cursor-pointer" data-cite="${payload.bibKey}">[@${payload.bibKey}]</span>&nbsp;`;
        document.execCommand('insertHTML', false, chipHtml);
        handleInput();
      }
    });

    return () => {
      unsubCmd();
      unsubEvent();
      unsubCite();
    };
  }, [executeVisualCommand, handleInput]);

  // Click delegation for interactive elements (Math, Protected blocks, Citations, Table, Figure)
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;

      // 0. Precision Forward SyncTeX: Ctrl+Click or Cmd+Click anywhere in the Visual Editor
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        e.stopPropagation();
        triggerForwardSync(target);
        return;
      }

      // 1. Math Element Click
      const mathBlock = target.closest('.latex-math-block') as HTMLElement | null;
      const mathInline = target.closest('.latex-math-inline') as HTMLElement | null;
      const mathEl = mathBlock || mathInline;

      if (mathEl && contentRef.current?.contains(mathEl)) {
        e.preventDefault();
        e.stopPropagation();

        const rawEnc = mathEl.getAttribute('data-math') || '';
        const rawMath = decodeURIComponent(rawEnc);
        const isDisplay = !!mathBlock;

        setActiveMath({
          element: mathEl,
          isDisplay,
          initialMath: rawMath,
          currentMath: rawMath,
        });
        return;
      }

      // 2. Protected Block Edit Button Click
      const editBtn = target.closest('.latex-protected-edit-btn') as HTMLElement | null;
      const protectedBlock = target.closest('.latex-protected-block') as HTMLElement | null;

      if (editBtn && protectedBlock) {
        e.preventDefault();
        e.stopPropagation();
        const rawLatex = decodeURIComponent(
          protectedBlock.getAttribute('data-raw-latex') || ''
        );
        setActiveProtected({ element: protectedBlock, rawLatex });
        return;
      }

      // 3. Citation Chip Click
      const citeChip = target.closest('.latex-citation-chip') as HTMLElement | null;
      if (citeChip) {
        e.preventDefault();
        e.stopPropagation();
        const citeKey = citeChip.getAttribute('data-cite');
        editorCommandBus.dispatch({
          type: 'dialog:open',
          dialog: 'citation-picker',
          payload: { initialQuery: citeKey },
        });
        return;
      }

      // 3b. Reference Chip Click (\ref{...}) -> Instant Jump to Target
      const refChip = target.closest('.latex-ref-chip') as HTMLElement | null;
      if (refChip) {
        e.preventDefault();
        e.stopPropagation();
        const refKey = refChip.getAttribute('data-ref');
        if (refKey && contentRef.current) {
          const encKey = encodeURIComponent(refKey);
          const targetEl =
            contentRef.current.querySelector<HTMLElement>(
              `[data-label="${encKey}"], [data-label="${refKey}"], .latex-label-token[data-label="${encKey}"], .latex-label-token[data-label="${refKey}"]`
            ) ||
            (refKey.startsWith('fig:')
              ? contentRef.current.querySelector<HTMLElement>('figure')
              : null) ||
            (refKey.startsWith('tab:')
              ? contentRef.current.querySelector<HTMLElement>('table')
              : null);

          if (targetEl) {
            const scrollTarget =
              (targetEl.closest(
                'figure, table, h1, h2, h3, h4, .latex-math-block, [data-line]'
              ) as HTMLElement) || targetEl;
            scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'center' });
            scrollTarget.classList.remove('synctex-highlight-pulse');
            void scrollTarget.offsetWidth;
            scrollTarget.classList.add('synctex-highlight-pulse');
            setTimeout(() => {
              scrollTarget.classList.remove('synctex-highlight-pulse');
            }, 1800);
          }
        }
        return;
      }

      // 4. Table Cell Click (Matrix Editor)
      const tableCell = target.closest('td, th') as HTMLTableCellElement | null;
      const tableEl = tableCell?.closest('table') as HTMLTableElement | null;

      if (tableCell && tableEl && contentRef.current?.contains(tableEl)) {
        handleTableCellClick(tableCell, tableEl);
        return;
      }

      // 5. Figure Element Click (Interactive Figure GUI)
      const figureEl = target.closest('figure.latex-figure-wrapper') as HTMLElement | null;
      if (figureEl && contentRef.current?.contains(figureEl)) {
        handleFigureClick(figureEl);
        setActiveTable(null);
        setSelectionBubble((prev) => (prev.isOpen ? { ...prev, isOpen: false } : prev));
        return;
      }

      // Default: Clicked elsewhere inside editor surface
      setActiveTable(null);
      setActiveFigure(null);
    },
    [
      handleFigureClick,
      handleTableCellClick,
      setActiveFigure,
      setActiveTable,
      setSelectionBubble,
      triggerForwardSync,
    ]
  );

  // Keyboard Shortcuts (Ctrl+Shift+V to toggle mode, Mod+M for math, Mod+Alt+J for forward sync)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // 1. Slash Menu Navigation
    if (handleSlashKeyDown(e)) {
      return;
    }

    if (e.key === 'Escape') {
      if (selectionBubble.isOpen) {
        e.preventDefault();
        setSelectionBubble((prev) => ({ ...prev, isOpen: false }));
        return;
      }
      if (activeFigure) {
        e.preventDefault();
        setActiveFigure(null);
        return;
      }
      if (activeTable) {
        e.preventDefault();
        setActiveTable(null);
        return;
      }
    }

    // 2. Global Shortcuts
    const isMac =
      typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
    const modKey = isMac ? e.metaKey : e.ctrlKey;

    if (modKey && e.shiftKey && (e.key === 'V' || e.key === 'v')) {
      e.preventDefault();
      toggleEditorMode();
      return;
    }

    if (modKey && (e.key === 'm' || e.key === 'M')) {
      e.preventDefault();
      executeVisualCommand({ command: 'insertMath' });
      return;
    }

    // Mod-Alt-j or Ctrl-Alt-j: Forward SyncTeX shortcut (Overleaf parity)
    if (modKey && e.altKey && (e.key === 'j' || e.key === 'J')) {
      e.preventDefault();
      triggerForwardSync(null);
      return;
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative flex-1 h-full w-full overflow-y-auto bg-background text-foreground select-text font-serif"
    >
      {/* ── Real-Time Collaborator Cursors & Selection Overlays (Overleaf Parity) ── */}
      <VisualCollaboratorCursors
        contentRef={contentRef}
        containerRef={containerRef}
        fileId={fileId}
        filePath={filePath}
        collaborators={collaborators}
        currentUserId={currentUserId}
      />

      {/* ── Document Container ── */}
      <div className="max-w-4xl mx-auto px-8 py-10 min-h-full">
        <div
          ref={contentRef}
          contentEditable={!readOnly}
          suppressContentEditableWarning
          onInput={handleInput}
          onClick={handleClick}
          onDoubleClick={handleDoubleClick}
          onKeyDown={handleKeyDown}
          onKeyUp={handleSlashKeyUp}
          onMouseUp={() => {
            if (typeof window !== 'undefined') {
              window.requestAnimationFrame(updateSelectionBubble);
            }
          }}
          className={cn(
            'visual-editor-surface outline-none prose prose-neutral dark:prose-invert max-w-none',
            'focus:ring-0 leading-relaxed font-serif text-[15px]',
            '[&_h1]:text-2xl [&_h1]:font-bold [&_h1]:font-sans [&_h1]:mt-8 [&_h1]:mb-4 [&_h1]:border-b [&_h1]:pb-2',
            '[&_h2]:text-xl [&_h2]:font-semibold [&_h2]:font-sans [&_h2]:mt-6 [&_h2]:mb-3',
            '[&_h3]:text-lg [&_h3]:font-medium [&_h3]:font-sans [&_h3]:mt-4 [&_h3]:mb-2',
            '[&_p]:my-3.5 [&_p]:leading-7',
            '[&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-3',
            '[&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-3',
            '[&_li]:my-1',
            '[&_blockquote]:border-l-4 [&_blockquote]:border-primary/40 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:my-4',
            '[&_table]:w-full [&_table]:border-collapse [&_table]:my-4 [&_table]:border [&_table]:border-border',
            '[&_th]:border [&_th]:border-border [&_th]:p-2 [&_th]:bg-muted/40 [&_th]:font-semibold [&_th]:text-left',
            '[&_td]:border [&_td]:border-border [&_td]:p-2',
            '[&_.latex-citation-chip]:hover:bg-primary/20 [&_.latex-citation-chip]:cursor-pointer [&_.latex-citation-chip]:transition-colors',
            '[&_.latex-math-block]:hover:ring-1 [&_.latex-math-block]:hover:ring-primary/40 [&_.latex-math-block]:transition-all',
            '[&_.latex-math-inline]:hover:ring-1 [&_.latex-math-inline]:hover:ring-primary/40 [&_.latex-math-inline]:transition-all'
          )}
        />
      </div>

      {/* ── Interactive Inline Math Editor Card ── */}
      <VisualMathEditorModal
        activeMath={activeMath}
        onClose={() => setActiveMath(null)}
        onSave={handleSaveMath}
        onDelete={handleDeleteMath}
      />

      {/* ── Protected Block LaTeX Editor Modal ── */}
      <VisualProtectedEditorModal
        activeProtected={activeProtected}
        onClose={() => setActiveProtected(null)}
        onSave={handleSaveProtectedBlock}
      />

      {/* ── Slash Command Menu Popup ── */}
      <VisualSlashCommandMenu
        isOpen={slashMenu.isOpen}
        query={slashMenu.query}
        position={slashMenu.position}
        selectedIndex={slashMenu.selectedIndex}
        onSelect={handleSelectSlashCommand}
        onClose={() => setSlashMenu((prev) => ({ ...prev, isOpen: false }))}
        onHoverIndex={(idx) => setSlashMenu((prev) => ({ ...prev, selectedIndex: idx }))}
      />

      {/* ── Floating Table Matrix Toolbar ── */}
      {activeTable && (
        <VisualTableToolbar
          position={activeTable.position}
          caption={activeTable.caption}
          label={activeTable.label}
          columnAlignment={activeTable.columnAlignment}
          rowIndex={activeTable.rowIndex}
          colIndex={activeTable.colIndex}
          totalRows={activeTable.totalRows}
          totalCols={activeTable.totalCols}
          onAddRowAbove={handleAddRowAbove}
          onAddRowBelow={handleAddRowBelow}
          onDeleteRow={handleDeleteRow}
          onAddColumnLeft={handleAddColumnLeft}
          onAddColumnRight={handleAddColumnRight}
          onDeleteColumn={handleDeleteColumn}
          onAlignColumn={handleAlignColumn}
          onUpdateMetadata={handleUpdateTableMetadata}
          onDeleteTable={handleDeleteTable}
          onClose={() => setActiveTable(null)}
        />
      )}

      {/* ── Floating Figure Toolbar (Overleaf Parity) ── */}
      {activeFigure && (
        <VisualFigureToolbar
          position={activeFigure.position}
          src={activeFigure.src}
          width={activeFigure.width}
          caption={activeFigure.caption}
          label={activeFigure.label}
          isCentering={activeFigure.isCentering}
          isStarred={activeFigure.isStarred}
          projectImageFiles={projectImageFiles}
          onChangeWidth={handleChangeFigureWidth}
          onChangeImage={handleChangeFigureImage}
          onUpdateMetadata={handleUpdateFigureMetadata}
          onToggleCentering={handleToggleFigureCentering}
          onToggleStarred={handleToggleFigureStarred}
          onDeleteFigure={handleDeleteFigure}
          onClose={() => setActiveFigure(null)}
        />
      )}

      {/* ── Floating Selection Bubble Menu (Medium / Notion / Overleaf Parity) ── */}
      {selectionBubble.isOpen && (
        <VisualSelectionBubbleMenu
          position={selectionBubble.position}
          activeFormats={selectionBubble.activeFormats}
          onFormat={handleBubbleFormat}
          onBlockTypeChange={handleBubbleBlockTypeChange}
          onConvertToMath={handleBubbleConvertToMath}
          onConvertToCitation={handleBubbleConvertToCitation}
          onSyncToPdf={() => triggerForwardSync(null)}
          onClose={() => setSelectionBubble((prev) => ({ ...prev, isOpen: false }))}
        />
      )}

      {/* ── Interactive In-Text Hover Card for Citations and Cross-References (Overleaf Parity) ── */}
      <VisualReferenceHoverCard
        contentRef={contentRef}
        containerRef={containerRef}
      />
    </div>
  );
}

export default VisualEditorView;
