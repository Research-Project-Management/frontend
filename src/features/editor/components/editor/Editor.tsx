'use client';

import React, { useRef, useEffect, useLayoutEffect, useState } from 'react';
import MonacoEditor from '@monaco-editor/react';
import type { OnMount } from '@monaco-editor/react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { filesQuery } from '@/features/editor/hooks/use-core';
import { usePageComments } from '@/features/editor/hooks/use-comment';
import { usePageSuggestions, useCreateSuggestion } from '@/features/editor/hooks/use-suggestion';
import { useViewItems } from '@/features/library/hooks/use-items';
import type { Page, PageFile } from '@/features/editor/types';
import type { Item } from '@/features/library/types/library.types';
import { usePageStore, useSettingsStore } from '@/features/editor/store';
import { EditorEventBus } from '@/features/editor/utils/editor.util';
import { Lock } from 'lucide-react';

// Subcomponents & internal seams
import './monaco-themes';
import Format from './Format';
import VisualEditor from './VisualEditor';
import CitationPickerModal from './CitationPickerModal';
import { registerLabelCompletion } from './label-completion.provider';
import { registerLatexSnippets, registerLatexLinkedEditing } from './latex-snippets.provider';

import { useEditorSave } from './hooks/use-editor-save';
import { useEditorDecorations } from './hooks/use-editor-decorations';
import { useEditorShortcuts } from './hooks/use-editor-shortcuts';
import { useEditorCitation } from './hooks/use-editor-citation';
import { useEditorCollaborators } from './hooks/use-editor-collaborators';
import { useEditorVim } from './hooks/use-editor-vim';
import { cn } from '@/shared/lib/utils';

import { EditorContextMenu } from './subcomponents/EditorContextMenu';
import { EditorFloatingBar, type SelFloating } from './subcomponents/EditorFloatingBar';
import { RenameSymbolDialog, type RenameDialogState } from './subcomponents/RenameSymbolDialog';
import { SuggestEditModal, type SuggestModalState } from './subcomponents/SuggestEditModal';
import { GlyphTooltip } from './subcomponents/GlyphTooltip';
import { CollaboratorPresenceBar } from './subcomponents/CollaboratorPresenceBar';

interface EditorProps {
  page: Page | PageFile;
}

type CtxPos = { x: number; y: number };

export default function Editor({ page }: EditorProps) {
  const {
    editorRef,
    compileRef,
    scrollToLineRef,
    scrollToPdfLineRef,
    isAiPreviewingRef,
  } = usePageStore();
  const monacoRef = useRef<any>(null);

  const {
    editorTheme,
    fontSize,
    wordWrap,
    lineNumbers,
    editorMode,
    setEditorMode,
    keybinding,
  } = useSettingsStore();

  const { pageId: pageIdParam, projectId: projectIdParam } = useParams<{
    pageId?: string;
    projectId?: string;
  }>();
  const storeProjectId = usePageStore((s) => s.projectId);
  const activeProjectId = projectIdParam || storeProjectId || 'me';

  // Remote data queries
  const { data: comments = [] } = usePageComments(pageIdParam ?? null);
  const { data: suggestions = [] } = usePageSuggestions(page.id, 'pending');
  const { data: libraryData } = useViewItems(activeProjectId, 'all');
  const libraryItems = libraryData?.items ?? [];
  const libraryItemsRef = useRef<Item[]>(libraryItems);
  libraryItemsRef.current = libraryItems;

  const { data: pageFiles = [] } = useQuery({
    ...filesQuery(pageIdParam ?? ''),
    enabled: !!pageIdParam,
  });
  const pageFilesRef = useRef<any[]>(pageFiles);
  pageFilesRef.current = pageFiles;

  const createSuggestionMutation = useCreateSuggestion();

  // Core editor state hooks
  const [editorMounted, setEditorMounted] = useState(false);
  const {
    currentContent,
    handleContentChange,
    updateMutation,
  } = useEditorSave({ page });

  const vimStatusRef = useRef<HTMLDivElement>(null);

  const handleSaveAndCompile = () => {
    if (page?.id && currentContent !== undefined) {
      updateMutation.mutate({
        pageId: page.id,
        content: currentContent,
      });
    }
    compileRef.current?.();
  };

  const { isVimActive } = useEditorVim({
    editor: editorMounted ? editorRef.current : null,
    keybinding,
    statusNodeRef: vimStatusRef,
    onSave: handleSaveAndCompile,
  });

  const {
    glyphTooltip,
    bindDecorationListeners,
  } = useEditorDecorations({
    editorRef,
    monacoRef,
    comments,
    suggestions,
    editorMounted,
  });

  const {
    citationModalOpen,
    setCitationModalOpen,
    handleInsertCitationSnippet,
    registerCitationProvider,
  } = useEditorCitation({
    editorRef,
    projectId: activeProjectId,
  });

  const {
    activeCollaborators,
    isDocumentLocked,
    lockedBy,
    bindMonacoCursorListeners,
  } = useEditorCollaborators({
    projectId: activeProjectId,
    pageId: page.id,
    editorRef,
    monacoRef,
  });

  // Local popup states
  const [ctxMenu, setCtxMenu] = useState<CtxPos | null>(null);
  const [ctxPos, setCtxPos] = useState<CtxPos | null>(null);
  const [ctxStartLine, setCtxStartLine] = useState<number | null>(null);
  const [ctxEndLine, setCtxEndLine] = useState<number | null>(null);
  const [ctxSelText, setCtxSelText] = useState('');
  const ctxMenuRef = useRef<HTMLDivElement>(null);

  const [selFloating, setSelFloating] = useState<SelFloating | null>(null);
  const selFloatingRef = useRef<HTMLDivElement>(null);

  const [renameDialog, setRenameDialog] = useState<RenameDialogState | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const [suggestModal, setSuggestModal] = useState<SuggestModalState | null>(null);

  const disposablesRef = useRef<Array<{ dispose: () => void }>>([]);
  const domCleanupRef = useRef<(() => void) | null>(null);

  const closeMenu = () => setCtxMenu(null);

  const openRenameDialog = () => {
    const ed = editorRef.current;
    if (!ed) return;
    const pos = ed.getPosition();
    const word = pos ? ed.getModel()?.getWordAtPosition(pos) : null;
    if (!word) return;
    closeMenu();
    setRenameDialog({ word: word.word, newName: word.word });
  };

  const openRenameDialogLatestRef = useRef(openRenameDialog);
  openRenameDialogLatestRef.current = openRenameDialog;

  const {
    menuGroups,
    applyRename,
  } = useEditorShortcuts({
    editorRef,
    closeMenu,
    openRenameDialog,
    openCitationModal: () => setCitationModalOpen(true),
    openSuggestModal: setSuggestModal,
    ctxStartLine,
    ctxEndLine,
    ctxSelText,
  });

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      domCleanupRef.current?.();
      disposablesRef.current.forEach((d) => d.dispose());
      disposablesRef.current = [];
    };
  }, []);

  // Close context menu when clicking outside or pressing Escape
  useEffect(() => {
    if (!ctxMenu) return;
    const handler = (e: MouseEvent) => {
      if (!ctxMenuRef.current?.contains(e.target as Node)) setCtxMenu(null);
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCtxMenu(null);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', keyHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', keyHandler);
    };
  }, [ctxMenu]);

  // Adjust context menu position to viewport
  useLayoutEffect(() => {
    if (!ctxMenu || !ctxMenuRef.current) return;
    if (ctxPos) return;
    const el = ctxMenuRef.current;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const rawX = ctxMenu.x;
    const rawY = ctxMenu.y;
    const x = Math.max(4, rawX + w + 4 > vw ? rawX - w - 4 : rawX);
    const y = Math.max(4, rawY + h + 4 > vh ? rawY - h - 8 : rawY);
    setCtxPos({ x, y });
  }, [ctxMenu, ctxPos]);

  // Close selection floating toolbar on outside click
  useEffect(() => {
    if (!selFloating) return;
    const handler = (e: MouseEvent) => {
      if (!selFloatingRef.current?.contains(e.target as Node)) {
        setSelFloating(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [selFloating]);

  // Auto-focus input when rename dialog opens
  useEffect(() => {
    if (renameDialog) {
      setTimeout(() => {
        renameInputRef.current?.focus();
        renameInputRef.current?.select();
      }, 30);
    }
  }, [renameDialog]);

  // Synchronize options with Monaco
  useEffect(() => {
    editorRef.current?.updateOptions({
      fontSize,
      lineHeight: Math.round(fontSize * 1.65),
      wordWrap: wordWrap ? 'on' : 'off',
      lineNumbers: lineNumbers ? 'on' : 'off',
      lineNumbersMinChars: 2,
      lineDecorationsWidth: 4,
      folding: false,
    });
  }, [fontSize, wordWrap, lineNumbers, editorRef]);

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    setEditorMounted(true);

    // Double-click jumps to PDF (SyncTeX)
    const domNode = editor.getDomNode();
    if (domNode) {
      const dblClickHandler = () => {
        const pos = editor.getPosition();
        if (pos) scrollToPdfLineRef.current?.(pos.lineNumber);
      };
      domNode.addEventListener('dblclick', dblClickHandler);
      domCleanupRef.current = () =>
        domNode.removeEventListener('dblclick', dblClickHandler);
    }

    // Register completions & snippets
    disposablesRef.current.push(registerCitationProvider(monaco));
    disposablesRef.current.push(
      registerLabelCompletion(monaco, () => pageFilesRef.current),
    );
    disposablesRef.current.push(registerLatexSnippets(monaco));
    disposablesRef.current.push(registerLatexLinkedEditing(monaco));

    // Register decoration listeners
    disposablesRef.current.push(bindDecorationListeners(editor, monaco));
    disposablesRef.current.push(bindMonacoCursorListeners(editor));

    // Right-click context menu
    disposablesRef.current.push(
      editor.onContextMenu((e) => {
        e.event.preventDefault();
        e.event.stopPropagation();
        const pos = e.target.position;
        const sel = editor.getSelection();
        const hasSel = sel && !sel.isEmpty();
        const sLine = hasSel ? sel.startLineNumber : (pos?.lineNumber ?? null);
        const eLine = hasSel ? sel.endLineNumber : (pos?.lineNumber ?? null);
        const selTxt = hasSel
          ? editor.getModel()?.getValueInRange(sel) ?? ''
          : '';

        setCtxStartLine(sLine);
        setCtxEndLine(eLine);
        setCtxSelText(selTxt);
        setCtxPos(null);
        setCtxMenu({ x: e.event.posx, y: e.event.posy });
      }),
    );

    // SyncTeX Forward jump highlight
    scrollToLineRef.current = (line: number) => {
      editor.revealLineInCenter(line);
      editor.setPosition({ lineNumber: line, column: 1 });
      editor.focus();

      const flashColl = editor.createDecorationsCollection([
        {
          range: new monaco.Range(line, 1, line, 1),
          options: {
            isWholeLine: true,
            className:
              'bg-primary/20 border-l-2 border-primary transition-colors duration-700',
          },
        },
      ]);
      setTimeout(() => {
        flashColl.clear();
      }, 1500);
    };

    // Keyboard commands
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      compileRef.current?.();
    });

    editor.addCommand(monaco.KeyCode.F2, () => {
      openRenameDialogLatestRef.current();
    });

    // Floating selection toolbar
    disposablesRef.current.push(
      editor.onDidChangeCursorSelection((e) => {
        if (isAiPreviewingRef?.current) {
          setSelFloating(null);
          return;
        }
        const sel = e.selection;
        if (sel.isEmpty()) {
          setSelFloating(null);
        } else {
          const model = editor.getModel();
          const text = model ? model.getValueInRange(sel) : '';
          if (text.trim().length > 0) {
            const endPos = {
              lineNumber: sel.endLineNumber,
              column: sel.endColumn,
            };
            const coords = editor.getScrolledVisiblePosition(endPos);
            const editorDom = editor.getDomNode();
            if (coords && editorDom) {
              const rect = editorDom.getBoundingClientRect();
              setSelFloating({
                x: Math.min(rect.left + coords.left + 8, window.innerWidth - 180),
                y: Math.max(rect.top + coords.top + coords.height + 4, 8),
                startLine: sel.startLineNumber,
                endLine: sel.endLineNumber,
                text,
              });
            }
          } else {
            setSelFloating(null);
          }
        }
      }),
    );
  };

  const handleSuggestionSubmit = async () => {
    if (!suggestModal) return;
    await createSuggestionMutation.mutateAsync({
      pageId: page.id,
      type: suggestModal.type,
      originalText: suggestModal.originalText,
      suggestedText:
        suggestModal.type === 'delete' ? '' : suggestModal.suggestedText,
      fromLine: suggestModal.fromLine,
      toLine: suggestModal.toLine,
      description: suggestModal.description || undefined,
    });
    setSuggestModal(null);
    EditorEventBus.emit('flux:open-panel', 'Review');
  };

  const isReadOnly = Boolean((page as any).isLocked || isDocumentLocked);

  return (
    <div className="h-full w-full flex flex-col">
      <div className="h-9 flex items-center justify-between border-b border-border bg-background pr-2 shrink-0">
        <div className="flex-1 min-w-0">
          <Format />
        </div>
        <CollaboratorPresenceBar
          collaborators={activeCollaborators}
          className="ml-2 shrink-0"
        />
      </div>

      {isReadOnly && (
        <div className="w-full bg-amber-500/10 border-b border-amber-500/30 px-3 py-1.5 flex items-center justify-between text-xs text-amber-700 dark:text-amber-300 select-none shrink-0">
          <div className="flex items-center gap-2">
            <Lock className="size-3.5 shrink-0 text-amber-500" />
            <span>
              Document is locked{lockedBy ? ` by ${lockedBy}` : ''}. Editing is
              disabled.
            </span>
          </div>
          <span className="text-11 font-mono font-medium bg-amber-500/20 px-1.5 py-0.5 rounded text-amber-800 dark:text-amber-200 uppercase tracking-wide">
            Read Only
          </span>
        </div>
      )}

      <div className="flex-1 w-full relative min-h-0 flex flex-col">
        <div className="flex-1 w-full relative min-h-0">
          {editorMode === 'visual' ? (
            <VisualEditor
              value={currentContent}
              onChange={handleContentChange}
              theme={editorTheme === 'dark' ? 'dark' : 'light'}
              readOnly={isReadOnly}
              onSwitchToCode={() => setEditorMode('code')}
            />
          ) : (
            <MonacoEditor
              height="100%"
              defaultLanguage="latex"
              value={currentContent}
              onChange={handleContentChange}
              theme={editorTheme === 'dark' ? 'latex-dark' : 'latex-light'}
              className=""
              onMount={handleEditorMount}
              options={{ automaticLayout: true, readOnly: isReadOnly }}
            />
          )}
        </div>

        {/* Monaco Vim status bar */}
        {keybinding === 'vim' && (
          <div
            ref={vimStatusRef}
            className={cn(
              "vim-status-bar h-6 px-3 bg-muted/70 border-t border-border flex items-center justify-between font-mono text-xs text-muted-foreground select-none shrink-0 transition-colors",
              "[&_input]:bg-transparent [&_input]:border-none [&_input]:outline-none [&_input]:text-foreground [&_input]:font-mono [&_input]:text-xs [&_input]:w-48",
              "[&_.vim-notification]:text-amber-600 dark:[&_.vim-notification]:text-amber-400 [&_.vim-notification]:ml-2 [&_.vim-notification]:font-medium",
              !isVimActive && "hidden"
            )}
            aria-label="Vim mode status bar"
          />
        )}
      </div>

      {/* Glyph comment tooltip */}
      <GlyphTooltip tooltip={glyphTooltip} />

      {/* Selection floating action bar */}
      <EditorFloatingBar
        selFloating={selFloating}
        selFloatingRef={selFloatingRef}
        onClose={() => setSelFloating(null)}
        onOpenSuggest={setSuggestModal}
      />

      {/* Custom context menu portal */}
      <EditorContextMenu
        ctxMenu={ctxMenu}
        ctxPos={ctxPos}
        ctxMenuRef={ctxMenuRef}
        menuGroups={menuGroups}
      />

      {/* Rename occurrences confirmation dialog */}
      <RenameSymbolDialog
        renameDialog={renameDialog}
        renameInputRef={renameInputRef}
        onChangeNewName={(name) =>
          setRenameDialog((d) => (d ? { ...d, newName: name } : null))
        }
        onApply={(word, newName) => {
          applyRename(word, newName);
          setRenameDialog(null);
        }}
        onCancel={() => setRenameDialog(null)}
      />

      {/* Suggestion (Track Changes) modal dialog */}
      <SuggestEditModal
        suggestModal={suggestModal}
        isPending={createSuggestionMutation.isPending}
        onClose={() => setSuggestModal(null)}
        onSubmit={handleSuggestionSubmit}
        onChangeState={setSuggestModal}
      />

      {/* In-Editor Citation Picker Modal */}
      <CitationPickerModal
        open={citationModalOpen}
        onOpenChange={setCitationModalOpen}
        items={libraryItems}
        onSelectCitation={handleInsertCitationSnippet}
      />
    </div>
  );
}
