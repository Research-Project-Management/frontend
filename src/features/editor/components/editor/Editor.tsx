'use client';

/**
 * Editor.tsx
 *
 * Deconstructed Source/Visual Editor cockpit:
 * - Composes useMonacoMount for keybindings, SyncTeX forward, decorations & review interceptors
 * - Composes useMonacoDiagnostics for real-time LaTeX error markers
 * - Isolated EditorFloatingOverlay (Glyphs, Overleaf AI, Selection bar, Context menu)
 * - Isolated EditorModals (Table, Figure, Symbol palette, Citation picker, Track Changes)
 */

import React, { useRef, useEffect, useLayoutEffect, useState, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { filesQuery } from '@/features/editor/hooks/use-core';
import { usePageComments } from '@/features/editor/hooks/use-comment';
import {
  usePageSuggestions,
  useCreateSuggestion,
  useAcceptSuggestion,
  useRejectSuggestion,
} from '@/features/editor/hooks/use-suggestion';
import type { Page, PageFile, PageSuggestion } from '@/features/editor/types';
import {
  usePageStore,
  useSettingsStore,
} from '@/features/editor/store';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { EditorEventBus } from '@/features/editor/utils/editor.util';
import { toast } from 'sonner';
import { Lock, Loader2 } from 'lucide-react';
import { useTheme } from '@/shared/providers';
import { cn } from '@/shared/lib/utils';
import dynamic from 'next/dynamic';

// Subcomponents & internal seams
import Format from './Format';
import UnifiedCodeMirrorEditor from './UnifiedCodeMirrorEditor';
import { EditorModeSwitcher } from './subcomponents/EditorModeSwitcher';
import { CollaboratorPresenceBar } from './subcomponents/CollaboratorPresenceBar';
import { SyncStatusBadge } from './subcomponents/SyncStatusBadge';
import { LatexDiagnosticsBadge } from './subcomponents/LatexDiagnosticsBadge';
import type { SelFloating } from './subcomponents/EditorFloatingBar';
import type { RenameDialogState } from './subcomponents/RenameSymbolDialog';
import type { SuggestModalState } from './subcomponents/SuggestEditModal';

import { useEditorSave, extractStringContent } from './hooks/use-editor-save';
import { useEditorDecorations } from './hooks/use-editor-decorations';
import { useEditorShortcuts } from './hooks/use-editor-shortcuts';
import { useEditorCitation } from './hooks/use-editor-citation';
import { useEditorCollaborators } from './hooks/use-editor-collaborators';
import { useEditorVim } from './hooks/use-editor-vim';
import { useEditorEmacs } from './hooks/use-editor-emacs';
import { useSpellChecker } from './hooks/use-spell-checker';
import { useSmartPaste } from './hooks/use-smart-paste';

import { EditorFloatingOverlay } from '../../sub-features/code-editor/ui/EditorFloatingOverlay';
import { EditorModals } from '../../sub-features/code-editor/ui/EditorModals';
import { useEditorInstance } from '../../core/context/editor-instance.context';
import { editorCommandBus } from '../../core/command-bus/editor-command-bus';

interface EditorProps {
  page: Page | PageFile;
}

type CtxPos = { x: number; y: number };

export default function Editor({ page }: EditorProps) {
  const { engine, setEngine } = useEditorInstance();
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);

  const editorTheme = useSettingsStore((s) => s.editorTheme);
  const fontSize = useSettingsStore((s) => s.fontSize);
  const wordWrap = useSettingsStore((s) => s.wordWrap);
  const lineNumbers = useSettingsStore((s) => s.lineNumbers);
  const editorMode = useSettingsStore((s) => s.editorMode);
  const setEditorMode = useSettingsStore((s) => s.setEditorMode);
  const keybinding = useSettingsStore((s) => s.keybinding);
  const reviewMode = useSettingsStore((s) => s.reviewMode);
  const setReviewMode = useSettingsStore((s) => s.setReviewMode);
  const toggleReviewMode = useSettingsStore((s) => s.toggleReviewMode);
  const trackChangesViewMode = useSettingsStore((s) => s.trackChangesViewMode);
  const setTrackChangesViewMode = useSettingsStore((s) => s.setTrackChangesViewMode);

  const { resolvedTheme } = useTheme();

  const activeEditorTheme = useMemo(() => {
    if (!editorTheme || editorTheme === 'auto') {
      return resolvedTheme === 'dark' ? 'latex-dark' : 'latex-light';
    }
    if (editorTheme === 'light') return 'latex-light';
    if (editorTheme === 'dark') return 'latex-dark';
    return editorTheme;
  }, [editorTheme, resolvedTheme]);

  const isDarkTheme = useMemo(() => {
    return (
      activeEditorTheme === 'latex-dark' ||
      activeEditorTheme === 'dracula' ||
      activeEditorTheme === 'monokai' ||
      activeEditorTheme === 'solarized-dark' ||
      activeEditorTheme === 'github-dark' ||
      activeEditorTheme === 'cobalt'
    );
  }, [activeEditorTheme]);

  const { user } = useAuth();
  const isReviewerOnly = user?.role?.toLowerCase() === 'reviewer';

  // Auto-enable review mode for reviewers on mount
  const hasAutoSwitchedRef = useRef(false);
  useEffect(() => {
    if (isReviewerOnly && !reviewMode && !hasAutoSwitchedRef.current) {
      hasAutoSwitchedRef.current = true;
      setReviewMode(true);
    }
  }, [isReviewerOnly, reviewMode, setReviewMode]);

  const handleSelectMode = useCallback(
    (mode: 'editing' | 'reviewing') => {
      setReviewMode(mode === 'reviewing');
    },
    [setReviewMode],
  );

  const { pageId: pageIdParam, projectId: projectIdParam } = useParams<{
    pageId?: string;
    projectId?: string;
  }>();
  const storeProjectId = usePageStore((s) => s.projectId);
  const activeProjectId = projectIdParam || storeProjectId || 'me';

  // Remote data queries
  const { data: comments = [] } = usePageComments(pageIdParam ?? null);
  const { data: suggestions = [] } = usePageSuggestions(page.id, 'pending');

  const { data: pageFiles = [] } = useQuery({
    ...filesQuery(pageIdParam ?? ''),
    enabled: !!pageIdParam,
  });
  const pageFilesRef = useRef<any[]>(pageFiles);
  pageFilesRef.current = pageFiles;

  const createSuggestionMutation = useCreateSuggestion();
  const acceptSuggestionMutation = useAcceptSuggestion();
  const rejectSuggestionMutation = useRejectSuggestion();

  // Realtime collaboration & remote cursor tracking
  const {
    activeCollaborators,
    isDocumentLocked,
    lockedBy,
    bindMonacoCursorListeners,
    isRealtimeActive,
    connectionStatus,
    isSynced,
    triggerCheckpoint,
    yText,
    awareness,
  } = useEditorCollaborators({
    projectId: activeProjectId,
    pageId: page.id,
    editorRef,
    monacoRef,
  });

  // Core editor state hooks
  const [editorMounted, setEditorMounted] = useState(false);
  const {
    currentContent,
    handleContentChange,
    updateMutation,
  } = useEditorSave({ page, isRealtimeActive });

  // Table, Figure, Symbol Wizard Modals
  const [tableWizardOpen, setTableWizardOpen] = useState(false);
  const [figureWizardOpen, setFigureWizardOpen] = useState(false);
  const [symbolPaletteOpen, setSymbolPaletteOpen] = useState(false);

  const rootPageId = (page as any)?.parentPageId || page?.id || null;

  const handleInsertWizardSnippet = useCallback((snippet: string) => {
    if (engine) {
      engine.insertText(snippet);
    }
  }, [engine]);

  useEffect(() => {
    const unsubTable = EditorEventBus.on('flux:open-table-wizard', () => {
      setTableWizardOpen(true);
    });
    const unsubFigure = EditorEventBus.on('flux:open-figure-wizard', () => {
      setFigureWizardOpen(true);
    });
    const unsubSymbol = EditorEventBus.on('flux:open-symbol-palette', () => {
      setSymbolPaletteOpen(true);
    });
    return () => {
      unsubTable();
      unsubFigure();
      unsubSymbol();
    };
  }, []);


  const vimStatusRef = useRef<HTMLDivElement>(null);

  const handleSaveAndCompile = useCallback(() => {
    if (isRealtimeActive) {
      triggerCheckpoint();
    } else if (page?.id && currentContent !== undefined) {
      updateMutation.mutate({
        pageId: page.id,
        content: currentContent,
      });
    }
    editorCommandBus.dispatch({ type: 'compiler:trigger' });
  }, [currentContent, isRealtimeActive, page?.id, triggerCheckpoint, updateMutation]);

  const { isVimActive } = useEditorVim({
    editor: editorMounted ? editorRef.current : null,
    keybinding,
    statusNodeRef: vimStatusRef,
    onSave: handleSaveAndCompile,
  });

  const emacsStatusRef = useRef<HTMLDivElement>(null);
  const { isEmacsActive, emacsStatus } = useEditorEmacs({
    editor: editorMounted ? editorRef.current : null,
    keybinding,
    statusNodeRef: emacsStatusRef,
    onSave: handleSaveAndCompile,
  });

  // Spell checker — WebWorker
  const spellCheckLanguage = useSettingsStore((s) => s.spellCheckLanguage ?? 'en_US');
  const spellCheckEnabled = useSettingsStore((s) => s.spellCheck ?? true);
  useSpellChecker({
    editorRef,
    monacoRef,
    language: spellCheckLanguage,
    enabled: spellCheckEnabled && editorMounted,
  });

  // Smart Paste
  useSmartPaste({
    editorRef,
    monacoRef,
    pageId: page?.id,
    enabled: editorMounted,
  });

  const {
    glyphTooltip,
    activeSuggestionWidgetData,
    setActiveSuggestionWidgetData,
    bindDecorationListeners,
  } = useEditorDecorations({
    editorRef,
    monacoRef,
    comments,
    suggestions,
    editorMounted,
  });


  const handleAcceptSuggestion = useCallback(async (s: PageSuggestion) => {
    try {
      const res = await acceptSuggestionMutation.mutateAsync({
        pageId: page.id,
        suggestionId: s.id,
      });
      if (res?.page?.content && !isRealtimeActive) {
        const text = extractStringContent(res.page.content);
        if (editorRef.current && editorRef.current.getValue() !== text) {
          editorRef.current.setValue(text);
        }
      }
      toast.success(`Accepted suggestion by ${s.author?.name || 'author'}`);
      setActiveSuggestionWidgetData(null);
    } catch {
      toast.error('Failed to accept suggestion');
    }
  }, [acceptSuggestionMutation, isRealtimeActive, page.id, setActiveSuggestionWidgetData, editorRef]);

  const handleRejectSuggestion = useCallback(async (s: PageSuggestion) => {
    try {
      await rejectSuggestionMutation.mutateAsync({
        pageId: page.id,
        suggestionId: s.id,
      });
      toast.info(`Rejected suggestion by ${s.author?.name || 'author'}`);
      setActiveSuggestionWidgetData(null);
    } catch {
      toast.error('Failed to reject suggestion');
    }
  }, [page.id, rejectSuggestionMutation, setActiveSuggestionWidgetData]);

  // Synchronize editor buffer when a suggestion is accepted elsewhere
  useEffect(() => {
    if (!page?.id) return;
    const unsub = EditorEventBus.on('flux:review-event', ({ pageId: evtPageId, event, payload }) => {
      if (evtPageId !== page.id) return;
      if (event === 'suggestion:accepted' || event === 'suggestions:accepted-all') {
        if (!isRealtimeActive && payload?.page?.content) {
          const text = extractStringContent(payload.page.content);
          if (editorRef.current && editorRef.current.getValue() !== text) {
            editorRef.current.setValue(text);
          }
        }
      }
    });
    return () => unsub();
  }, [editorRef, isRealtimeActive, page?.id]);

  const {
    bibEntries,
    citationModalOpen,
    setCitationModalOpen,
    handleInsertCitationSnippet,
    registerCitationProvider,
  } = useEditorCitation({
    editorRef,
    pageFiles: pageFiles.map((f) => ({ name: f.title, content: f.content })),
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

  const [aiAssistState, setAiAssistState] = useState<{
    isOpen: boolean;
    selectedText: string;
    startLine: number;
    endLine: number;
    position: { x: number; y: number };
  } | null>(null);

  const handleApplyAiEdit = useCallback(
    (newText: string, mode: 'replace' | 'insert-below') => {
      const editor = editorRef.current;
      if (!editor) return;

      const sel = editor.getSelection();
      if (!sel) return;

      if (mode === 'replace') {
        editor.executeEdits('overleaf-ai-assist', [
          {
            range: sel,
            text: newText,
            forceMoveMarkers: true,
          },
        ]);
      } else {
        const endLine = sel.endLineNumber;
        const model = editor.getModel();
        const maxCol = model ? model.getLineMaxColumn(endLine) : 1;
        const insertRange = {
          startLineNumber: endLine,
          startColumn: maxCol,
          endLineNumber: endLine,
          endColumn: maxCol,
        };
        editor.executeEdits('overleaf-ai-assist', [
          {
            range: insertRange as any,
            text: '\n\n' + newText,
            forceMoveMarkers: true,
          },
        ]);
      }
      editor.focus();
    },
    [editorRef],
  );

  const [renameDialog, setRenameDialog] = useState<RenameDialogState | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const [suggestModal, setSuggestModal] = useState<SuggestModalState | null>(null);

  const closeMenu = useCallback(() => setCtxMenu(null), []);

  const openRenameDialog = useCallback(() => {
    const ed = editorRef.current;
    if (!ed) return;
    const pos = ed.getPosition();
    const word = pos ? ed.getModel()?.getWordAtPosition(pos) : null;
    if (!word) return;
    closeMenu();
    setRenameDialog({ word: word.word, newName: word.word });
  }, [closeMenu, editorRef]);

  const openRenameDialogLatestRef = useRef(openRenameDialog);
  openRenameDialogLatestRef.current = openRenameDialog;

  const handleOpenCitationModal = useCallback(() => setCitationModalOpen(true), [setCitationModalOpen]);

  const {
    menuGroups,
    applyRename,
  } = useEditorShortcuts({
    editorRef,
    closeMenu,
    openRenameDialog,
    openCitationModal: handleOpenCitationModal,
    openSuggestModal: setSuggestModal,
    ctxStartLine,
    ctxEndLine,
    ctxSelText,
  });

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'F' || e.key === 'f')) {
        e.preventDefault();
        const ed = editorRef.current;
        let query: string | undefined;
        if (ed) {
          const sel = ed.getSelection();
          if (sel && !sel.isEmpty()) {
            query = ed.getModel()?.getValueInRange(sel) || undefined;
          } else {
            const pos = ed.getPosition();
            if (pos) {
              const word = ed.getModel()?.getWordAtPosition(pos);
              if (word) query = word.word;
            }
          }
        }
        EditorEventBus.emit('flux:open-panel', { panel: 'Search', query });
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'K' || e.key === 'k')) {
        e.preventDefault();
        EditorEventBus.emit('flux:open-citation-picker');
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'V' || e.key === 'v')) {
        e.preventDefault();
        const current = useSettingsStore.getState().editorMode;
        const next = current === 'code' ? 'visual' : 'code';
        useSettingsStore.getState().setEditorMode(next);
        toast.info(
          next === 'visual'
            ? 'Switched to Visual (Rich Text) mode'
            : 'Switched to Source (Code) mode',
          { duration: 1500 },
        );
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editorRef]);

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

  const hasComments = (comments?.length ?? 0) > 0;
  // Synchronize options with Monaco
  useEffect(() => {
    editorRef.current?.updateOptions({
      fontSize,
      lineHeight: Math.round(fontSize * 1.65),
      wordWrap: wordWrap ? 'on' : 'off',
      lineNumbers: lineNumbers ? 'on' : 'off',
      lineNumbersMinChars: 3,
      lineDecorationsWidth: 0,
      glyphMargin: hasComments,
      folding: false,
      renderLineHighlight: 'all',
      renderLineHighlightOnlyWhenFocus: false,
      scrollBeyondLastLine: false,
      smoothScrolling: true,
      minimap: { enabled: false },
      overviewRulerBorder: false,
      overviewRulerLanes: 0,
      hideCursorInOverviewRuler: true,
      scrollbar: {
        vertical: 'auto',
        horizontal: 'auto',
        verticalScrollbarSize: 8,
        horizontalScrollbarSize: 8,
        verticalSliderSize: 6,
        horizontalSliderSize: 6,
        useShadows: false,
        verticalHasArrows: false,
        horizontalHasArrows: false,
        alwaysConsumeMouseWheel: false,
      },
    });
  }, [fontSize, wordWrap, lineNumbers, hasComments, editorRef]);



  useEffect(() => {
    return () => {
      setEngine(null);
    };
  }, [setEngine]);

  // SyncTeX forward jump event listener (Floating widget forward arrow)
  useEffect(() => {
    return EditorEventBus.on('flux:synctex-forward', () => {
      const inst = editorRef.current;
      if (!inst) return;
      const pos = inst.getPosition();
      const line =
        pos?.lineNumber ??
        inst.getVisibleRanges()?.[0]?.startLineNumber ??
        1;
      editorCommandBus.dispatch({ type: 'viewer:jump-to-line', line });
    });
  }, [editorRef]);

  const handleSuggestionSubmit = useCallback(async () => {
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
  }, [createSuggestionMutation, page.id, suggestModal]);

  const handleCloseSuggestionWidget = useCallback(() => {
    setActiveSuggestionWidgetData(null);
  }, [setActiveSuggestionWidgetData]);

  const handleOpenReviewTab = useCallback((suggestionId: string) => {
    EditorEventBus.emit('flux:open-panel', {
      panel: 'Review',
      suggestionId,
    });
  }, []);

  const handleCloseFloating = useCallback(() => {
    setSelFloating(null);
  }, []);

  const handleChangeRenameName = useCallback((name: string) => {
    setRenameDialog((d) => (d ? { ...d, newName: name } : null));
  }, []);

  const handleApplyRename = useCallback((word: string, newName: string) => {
    applyRename(word, newName);
    setRenameDialog(null);
  }, [applyRename]);

  const handleCancelRename = useCallback(() => {
    setRenameDialog(null);
  }, []);

  const handleCloseSuggestModal = useCallback(() => {
    setSuggestModal(null);
  }, []);

  const isReadOnly = Boolean((page as any).isLocked || isDocumentLocked);

  return (
    <div className="h-full w-full flex flex-col overflow-hidden">
      {/* Header format bar & mode switches */}
      <div className="h-9 flex items-center justify-between border-b border-border bg-background pl-1 pr-2 shrink-0 overflow-hidden gap-1.5">
        <div className="flex-1 min-w-0 overflow-hidden">
          <Format />
        </div>
        <div className="flex items-center gap-1.5 shrink-0 select-none">
          <LatexDiagnosticsBadge />
          <EditorModeSwitcher
            reviewMode={reviewMode}
            onSelectMode={handleSelectMode}
            isReviewerOnly={isReviewerOnly}
          />
          <SyncStatusBadge
            connectionStatus={connectionStatus}
            isSynced={isSynced}
            isReadOnly={isReadOnly}
          />
          <CollaboratorPresenceBar
            collaborators={activeCollaborators}
          />
        </div>
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
          <span className="text-11 font-mono font-medium bg-amber-500/20 px-1.5 py-0.5 rounded-sm text-amber-800 dark:text-amber-200 tracking-normal">
            Read Only
          </span>
        </div>
      )}

      {reviewMode && !isReadOnly && (
        <div className="w-full bg-amber-500/10 border-b border-amber-500/30 px-3 py-1.5 flex items-center justify-between text-xs text-amber-800 dark:text-amber-300 select-none shrink-0 animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
            </span>
            <span className="font-semibold">Track Changes (Review Mode) Active</span>
            <span className="text-amber-700/80 dark:text-amber-400/80 hidden md:inline">
              — Text replacement or deletion will be proposed as suggestions for author review.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center rounded-md bg-amber-500/15 p-0.5 text-11 font-medium border border-amber-500/30">
              <span className="text-10 text-amber-800/80 dark:text-amber-300/80 px-1.5 uppercase font-semibold">View:</span>
              <button
                type="button"
                onClick={() => setTrackChangesViewMode('changes')}
                className={cn(
                  'px-1.5 py-0.5 rounded-sm text-11 transition-colors cursor-pointer',
                  trackChangesViewMode === 'changes'
                    ? 'bg-amber-600 text-white font-semibold shadow-2xs'
                    : 'text-amber-900/80 dark:text-amber-300/80 hover:text-amber-900 hover:bg-amber-500/20',
                )}
                title="View all tracked changes with diff highlights"
              >
                Changes
              </button>
              <button
                type="button"
                onClick={() => setTrackChangesViewMode('clean')}
                className={cn(
                  'px-1.5 py-0.5 rounded-sm text-11 transition-colors cursor-pointer',
                  trackChangesViewMode === 'clean'
                    ? 'bg-amber-600 text-white font-semibold shadow-2xs'
                    : 'text-amber-900/80 dark:text-amber-300/80 hover:text-amber-900 hover:bg-amber-500/20',
                )}
                title="Preview clean document with all suggestions accepted"
              >
                Clean
              </button>
              <button
                type="button"
                onClick={() => setTrackChangesViewMode('original')}
                className={cn(
                  'px-1.5 py-0.5 rounded-sm text-11 transition-colors cursor-pointer',
                  trackChangesViewMode === 'original'
                    ? 'bg-amber-600 text-white font-semibold shadow-2xs'
                    : 'text-amber-900/80 dark:text-amber-300/80 hover:text-amber-900 hover:bg-amber-500/20',
                )}
                title="View original document without any suggestions"
              >
                Original
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                const ed = editorRef.current;
                const sel = ed?.getSelection();
                const hasSel = sel && !sel.isEmpty();
                const startL = hasSel ? sel.startLineNumber : (ed?.getPosition()?.lineNumber ?? 1);
                const endL = hasSel ? sel.endLineNumber : startL;
                const text = hasSel ? (ed?.getModel()?.getValueInRange(sel) ?? '') : '';
                setSuggestModal({
                  originalText: text,
                  suggestedText: text,
                  fromLine: startL,
                  toLine: endL,
                  type: hasSel ? 'replace' : 'insert',
                  description: '',
                });
              }}
              className="px-2 py-0.5 rounded-sm text-11 font-medium bg-amber-500/20 hover:bg-amber-500/30 text-amber-900 dark:text-amber-200 transition-colors cursor-pointer shadow-2xs"
            >
              Propose Suggestion
            </button>
            <button
              type="button"
              onClick={() => toggleReviewMode()}
              className="px-2 py-0.5 rounded-sm text-11 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              title="Turn off Review Mode"
            >
              Turn Off
            </button>
          </div>
        </div>
      )}

      {/* Editor surface area */}
      <div className="flex-1 w-full relative min-h-0 flex flex-col overflow-hidden">
        <div className="flex-1 w-full relative min-h-0 overflow-hidden">
          <UnifiedCodeMirrorEditor
            value={currentContent}
            onChange={handleContentChange}
            isDarkTheme={isDarkTheme}
            readOnly={isReadOnly}
            bibEntries={bibEntries}
            keybinding={keybinding}
            yText={yText}
            awareness={awareness}
          />
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

        {/* Monaco Emacs status bar */}
        {keybinding === 'emacs' && (
          <div
            ref={emacsStatusRef}
            className={cn(
              "emacs-status-bar h-6 px-3 bg-muted/70 border-t border-border flex items-center justify-between font-mono text-xs text-muted-foreground select-none shrink-0 transition-colors",
              !isEmacsActive && "hidden"
            )}
            aria-label="Emacs mode status bar"
          >
            <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 rounded-sm bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 text-10 font-semibold tracking-normal">
                Emacs
              </span>
              <span className="text-foreground font-medium text-xs">
                {emacsStatus || 'Ready'}
              </span>
            </div>
            <span className="text-11 text-muted-foreground">
              C-x C-s to save · C-g to quit
            </span>
          </div>
        )}
      </div>

      {/* Overlays (Glyph tooltip, Inline suggestion, Selection bar, AI Assistant, Context menu) */}
      <EditorFloatingOverlay
        glyphTooltip={glyphTooltip}
        activeSuggestionWidgetData={activeSuggestionWidgetData}
        isAcceptingSuggestion={acceptSuggestionMutation.isPending}
        isRejectingSuggestion={rejectSuggestionMutation.isPending}
        onAcceptSuggestion={handleAcceptSuggestion}
        onRejectSuggestion={handleRejectSuggestion}
        onCloseSuggestionWidget={handleCloseSuggestionWidget}
        onOpenReviewTab={handleOpenReviewTab}
        selFloating={selFloating}
        selFloatingRef={selFloatingRef}
        reviewMode={reviewMode}
        onCloseFloating={handleCloseFloating}
        onOpenSuggestModal={setSuggestModal}
        aiAssistState={aiAssistState}
        onCloseAiAssist={() => setAiAssistState(null)}
        onApplyAiEdit={handleApplyAiEdit}
        onOpenAiAssist={(opts) => {
          setAiAssistState({
            isOpen: true,
            selectedText: opts.selectedText,
            startLine: opts.startLine,
            endLine: opts.endLine,
            position: opts.position,
          });
        }}
        ctxMenu={ctxMenu}
        ctxPos={ctxPos}
        ctxMenuRef={ctxMenuRef}
        menuGroups={menuGroups}
      />

      {/* Modals (Citations, Tables, Figures, Symbols, Suggestion, Rename) */}
      <EditorModals
        citationModalOpen={citationModalOpen}
        setCitationModalOpen={setCitationModalOpen}
        bibEntries={bibEntries}
        onInsertCitation={handleInsertCitationSnippet}
        tableWizardOpen={tableWizardOpen}
        setTableWizardOpen={setTableWizardOpen}
        figureWizardOpen={figureWizardOpen}
        setFigureWizardOpen={setFigureWizardOpen}
        rootPageId={rootPageId}
        symbolPaletteOpen={symbolPaletteOpen}
        setSymbolPaletteOpen={setSymbolPaletteOpen}
        onInsertSnippet={handleInsertWizardSnippet}
        suggestModal={suggestModal}
        setSuggestModal={setSuggestModal}
        isCreatingSuggestion={createSuggestionMutation.isPending}
        onCloseSuggestModal={handleCloseSuggestModal}
        onSuggestionSubmit={handleSuggestionSubmit}
        renameDialog={renameDialog}
        renameInputRef={renameInputRef}
        onChangeRenameName={handleChangeRenameName}
        onApplyRename={handleApplyRename}
        onCancelRename={handleCancelRename}
      />
    </div>
  );
}
