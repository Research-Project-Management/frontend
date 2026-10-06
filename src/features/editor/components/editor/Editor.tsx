'use client';

/**
 * Editor.tsx
 *
 * Clean Presentational Editor Cockpit (Dumb UI Shell):
 * - Top format bar with LaTeX insert tools & mode switchers
 * - UnifiedCodeMirrorEditor with syntax highlighting and keybindings
 * - Floating Overlays & Wizard Modals
 * - Decoupled from legacy network calls
 */

import React, { useRef, useEffect, useLayoutEffect, useState, useCallback, useMemo } from 'react';
import type { Page, PageFile, PageSuggestion, PageComment } from '@/features/editor/types';
import {
  useSettingsStore,
} from '@/features/editor/store';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { EditorEventBus } from '@/features/editor/utils/editor.util';
import { Lock } from 'lucide-react';
import { OverleafSearchIcon } from '@/features/editor/sub-features/code-editor/components/OverleafToolbarIcons';
import { useTheme } from '@/shared/providers';
import { cn } from '@/shared/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { filesQuery } from '@/features/editor/hooks/use-core';
import {
  usePageSuggestions,
  useAcceptSuggestion,
  useRejectSuggestion,
  useAcceptAllSuggestions,
  useRejectAllSuggestions,
  useCreateSuggestion,
} from '@/features/editor/hooks/use-suggestion';
import { usePageComments } from '@/features/editor/hooks/use-comment';
import { useViewItems } from '@/features/library';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip';

// Subcomponents & internal seams
import { FormatToolbar } from '@/features/editor/sub-features/code-editor/components/FormatToolbar';
import UnifiedCodeMirrorEditor from './UnifiedCodeMirrorEditor';
import { EditorModeSwitcher } from './subcomponents/EditorModeSwitcher';
import { SourceVisualSwitcher } from './subcomponents/SourceVisualSwitcher';
import { EditorSearchPanel } from './subcomponents/EditorSearchPanel';
import type { SelFloating } from './subcomponents/EditorFloatingBar';
import type { RenameDialogState } from './subcomponents/RenameSymbolDialog';
import type { SuggestModalState } from './subcomponents/SuggestEditModal';
import type { GlyphTooltipData } from './subcomponents/GlyphTooltip';
import type { InlineSuggestionWidgetData } from './subcomponents/InlineSuggestionWidget';

import { useEditorSave } from './hooks/use-editor-save';
import { useEditorShortcuts } from './hooks/use-editor-shortcuts';
import { useEditorCitation } from './hooks/use-editor-citation';
import { useEditorCollaborators } from './hooks/use-editor-collaborators';

import { EditorFloatingOverlay } from '../../sub-features/code-editor/ui/EditorFloatingOverlay';
import { EditorModals } from '../../sub-features/code-editor/ui/EditorModals';
import type { MisspelledItem } from '../../sub-features/code-editor/codemirror/latex-spellcheck';
import { useEditorInstance } from '../../core/context/editor-instance.context';
import { editorCommandBus } from '../../core/command-bus/editor-command-bus';

const EMPTY_LIBRARY_ITEMS: unknown[] = [];
const EMPTY_PAGE_FILES: any[] = [];

interface EditorProps {
  page: Page | PageFile;
}

type CtxPos = { x: number; y: number };

export default function Editor({ page }: EditorProps) {
  const { engine, setEngine } = useEditorInstance();

  const editorTheme = useSettingsStore((s) => s.editorTheme);
  const fontSize = useSettingsStore((s) => s.fontSize);
  const wordWrap = useSettingsStore((s) => s.wordWrap);
  const lineNumbers = useSettingsStore((s) => s.lineNumbers);
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

  // Live comments & suggestions for Overleaf review parity
  const { data: comments = [] } = usePageComments(page?.id ?? null);
  const { data: suggestions = [] } = usePageSuggestions(page?.id ?? null);
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const acceptSuggestionMutation = useAcceptSuggestion();
  const rejectSuggestionMutation = useRejectSuggestion();
  const acceptAllSuggestionsMutation = useAcceptAllSuggestions();
  const rejectAllSuggestionsMutation = useRejectAllSuggestions();

  useEffect(() => {
    const unsub = EditorEventBus.on('flux:open-panel', (detail) => {
      if (typeof detail === 'object' && detail !== null && detail.commentId) {
        setActiveCommentId(detail.commentId);
      }
    });
    return () => unsub();
  }, []);

  // Realtime collaboration & remote cursor tracking (clean presentation state)
  const rawProjId = 'projectId' in page ? page.projectId : undefined;
  const effectiveProjectId =
    typeof rawProjId === 'string'
      ? rawProjId
      : rawProjId?.id || '';
  const collaboratorCurrentUser = useMemo(() => {
    if (!user) return undefined;
    const userExtra = user as (typeof user & { email?: string; avatar?: string; image?: string; color?: string }) | null;
    return {
      id: user.id,
      name: user.name || userExtra?.email || 'Collaborator',
      avatar: userExtra?.avatar || userExtra?.image,
      color: userExtra?.color,
      role: user.role,
    };
  }, [user]);

  const {
    activeCollaborators,
    isDocumentLocked,
    lockedBy,
    yText,
    awareness,
  } = useEditorCollaborators({
    projectId: effectiveProjectId,
    pageId: page.id,
    currentUserId: user?.id,
    currentUser: collaboratorCurrentUser,
  });

  // Core editor state hooks
  const [editorMounted] = useState(true);
  const {
    currentContent,
    handleContentChange,
  } = useEditorSave({ page, isRealtimeActive: false });

  const rootPageId = ('parentPageId' in page ? (page as { parentPageId?: string }).parentPageId : undefined) || page?.id || null;

  const vimStatusRef = useRef<HTMLDivElement>(null);
  const emacsStatusRef = useRef<HTMLDivElement>(null);

  const isVimActive = keybinding === 'vim';
  const isEmacsActive = keybinding === 'emacs';
  const emacsStatus = 'Ready';

  const [glyphTooltip, setGlyphTooltip] = useState<GlyphTooltipData | null>(null);
  const [activeSuggestionWidgetData, setActiveSuggestionWidgetData] = useState<InlineSuggestionWidgetData | null>(null);

  const createSuggestionMutation = useCreateSuggestion();

  const handleAcceptSuggestion = useCallback((s: PageSuggestion) => {
    setActiveSuggestionWidgetData(null);
    if (page?.id) {
      acceptSuggestionMutation.mutate({ pageId: page.id, suggestionId: s.id });
    }
  }, [page?.id, acceptSuggestionMutation, setActiveSuggestionWidgetData]);

  const handleRejectSuggestion = useCallback((s: PageSuggestion) => {
    setActiveSuggestionWidgetData(null);
    if (page?.id) {
      rejectSuggestionMutation.mutate({ pageId: page.id, suggestionId: s.id });
    }
  }, [page?.id, rejectSuggestionMutation, setActiveSuggestionWidgetData]);

  const projectScopeId = effectiveProjectId;

  const { data: rawPageFiles } = useQuery({
    ...filesQuery(rootPageId ?? ''),
    enabled: !!rootPageId,
  });
  const pageFiles = rawPageFiles ?? EMPTY_PAGE_FILES;

  const { data: libraryData } = useViewItems(
    projectScopeId || 'me',
    'all',
  );
  const libraryItems = (libraryData as { items?: unknown[] })?.items ?? EMPTY_LIBRARY_ITEMS;

  const {
    bibEntries,
    citationModalOpen,
    setCitationModalOpen,
    handleInsertCitationSnippet,
    initialCitationQuery,
    initialCitationKey,
    citedKeys,
  } = useEditorCitation({
    pageFiles,
    libraryItems,
    projectId: projectScopeId,
    rootPageId,
  });

  // Local popup states
  const [ctxMenu, setCtxMenu] = useState<CtxPos | null>(null);
  const [ctxPos, setCtxPos] = useState<CtxPos | null>(null);
  const [ctxStartLine, setCtxStartLine] = useState<number | null>(null);
  const [ctxEndLine, setCtxEndLine] = useState<number | null>(null);
  const [ctxSelText, setCtxSelText] = useState('');
  const [ctxMisspelledInfo, setCtxMisspelledInfo] = useState<MisspelledItem | null>(null);
  const ctxMenuRef = useRef<HTMLDivElement>(null);

  const handleEditorContextMenu = useCallback(
    (data: {
      x: number;
      y: number;
      startLine: number;
      endLine: number;
      text: string;
      misspelledInfo?: MisspelledItem | null;
    }) => {
      setCtxMenu({ x: data.x, y: data.y });
      setCtxPos(null);
      setCtxStartLine(data.startLine);
      setCtxEndLine(data.endLine);
      setCtxSelText(data.text);
      setCtxMisspelledInfo(data.misspelledInfo || null);
    },
    [],
  );

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
      if (!engine) return;
      if (mode === 'replace') {
        engine.insertText(newText);
      } else {
        engine.insertText('\n\n' + newText);
      }
      engine.focus();
    },
    [engine],
  );

  const [renameDialog, setRenameDialog] = useState<RenameDialogState | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const [suggestModal, setSuggestModal] = useState<SuggestModalState | null>(null);
  const [isFindOpen, setIsFindOpen] = useState(false);

  useEffect(() => {
    const unsub = editorCommandBus.subscribe('editor:find', (cmd) => {
      setIsFindOpen((prev) => (cmd.open !== undefined ? cmd.open : !prev));
    });
    return () => unsub();
  }, []);

  const closeMenu = useCallback(() => setCtxMenu(null), []);

  const openRenameDialog = useCallback(() => {
    const word = engine?.getSelectedText()?.trim();
    if (!word) return;
    closeMenu();
    setRenameDialog({ word, newName: word });
  }, [closeMenu, engine]);

  const handleOpenCitationModal = useCallback(() => setCitationModalOpen(true), [setCitationModalOpen]);

  const {
    menuGroups,
    applyRename,
  } = useEditorShortcuts({
    closeMenu,
    openRenameDialog,
    openCitationModal: handleOpenCitationModal,
    openSuggestModal: setSuggestModal,
    ctxStartLine,
    ctxEndLine,
    ctxSelText,
    projectId: projectScopeId,
    ctxMisspelledInfo,
  });

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === 'F' || e.key === 'f')) {
        e.preventDefault();
        setIsFindOpen((prev) => !prev);
      } else if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === 'H' || e.key === 'h')) {
        e.preventDefault();
        setIsFindOpen(true);
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'F' || e.key === 'f')) {
        e.preventDefault();
        const query = engine?.getSelectedText()?.trim() || undefined;
        EditorEventBus.emit('flux:open-panel', { panel: 'Search', query });
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'K' || e.key === 'k')) {
        e.preventDefault();
        EditorEventBus.emit('flux:open-citation-picker');
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'V' || e.key === 'v')) {
        e.preventDefault();
        const current = useSettingsStore.getState().editorMode;
        const next = current === 'code' ? 'visual' : 'code';
        useSettingsStore.getState().setEditorMode(next);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [engine]);

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

  // Close context menu on outside click
  useEffect(() => {
    if (!ctxMenu) return;
    const handler = (e: MouseEvent) => {
      if (!ctxMenuRef.current?.contains(e.target as Node)) {
        setCtxMenu(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [ctxMenu]);

  // Auto-focus input when rename dialog opens
  useEffect(() => {
    if (renameDialog) {
      setTimeout(() => {
        renameInputRef.current?.focus();
        renameInputRef.current?.select();
      }, 30);
    }
  }, [renameDialog]);

  useEffect(() => {
    return () => {
      setEngine(null);
    };
  }, [setEngine]);

  // SyncTeX forward jump event listener
  useEffect(() => {
    return EditorEventBus.on('flux:synctex-forward', () => {
      const sel = engine?.getSelection();
      const line = sel?.startLine ?? 1;
      editorCommandBus.dispatch({ type: 'viewer:jump-to-line', line });
    });
  }, [engine]);

  const handleSuggestionSubmit = useCallback(async () => {
    if (!suggestModal) return;
    createSuggestionMutation.mutate({
      pageId: page.id,
      type: suggestModal.type,
      originalText: suggestModal.originalText,
      suggestedText: suggestModal.type === 'delete' ? '' : suggestModal.suggestedText,
      fromLine: suggestModal.fromLine,
      fromColumn: 0,
      toLine: suggestModal.toLine,
      toColumn: 0,
      description: suggestModal.description || undefined,
    });
    setSuggestModal(null);
    EditorEventBus.emit('flux:open-panel', 'Review');
  }, [page.id, suggestModal, createSuggestionMutation]);

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

  const isPageLocked = 'isLocked' in page ? Boolean((page as { isLocked?: boolean }).isLocked) : false;
  const isReadOnly = Boolean(isPageLocked || isDocumentLocked);

  return (
    <div className="relative flex-1 w-full min-w-0 max-w-full h-full flex flex-col min-h-0 overflow-hidden">
      {/* Header format bar & mode switches (Overleaf 1:1 Parity) */}
      <div className="h-9 flex items-center justify-between border-b border-border bg-background pl-1 pr-2 shrink-0 overflow-hidden gap-1.5">
        <div className="flex-1 min-w-0 overflow-hidden">
          <FormatToolbar />
        </div>
        <div className="flex items-center gap-1.5 shrink-0 select-none">
          <div className="h-4 w-px bg-border/60 mx-1 shrink-0" />
          <SourceVisualSwitcher />
          <EditorModeSwitcher
            reviewMode={reviewMode}
            onSelectMode={handleSelectMode}
            isReviewerOnly={isReviewerOnly}
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => setIsFindOpen((prev) => !prev)}
                className={cn(
                  'flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary select-none',
                  isFindOpen && 'bg-muted text-foreground font-semibold',
                )}
                aria-label="Search and Replace (Ctrl+F)"
              >
                <OverleafSearchIcon className="size-3.5 shrink-0" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              <div className="flex items-center gap-1.5">
                <span>Search and Replace</span>
                <kbd className="px-1 py-0.5 text-11 rounded bg-muted text-muted-foreground font-mono">
                  Ctrl+F
                </kbd>
              </div>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {isReadOnly && (
        <div className="w-full bg-amber-500/10 border-b border-amber-500/30 px-3 py-1.5 flex items-center justify-between text-xs text-amber-700 dark:text-amber-300 select-none shrink-0">
          <div className="flex items-center gap-2">
            <Lock className="size-3.5 shrink-0 text-amber-500" />
            <span>
              Document locked{lockedBy ? ` (${lockedBy})` : ''}
            </span>
          </div>
          <span className="text-11 font-mono font-medium bg-amber-500/20 px-1.5 py-0.5 rounded-sm text-amber-800 dark:text-amber-200 tracking-normal">
            Read only
          </span>
        </div>
      )}

      {/* Editor surface area */}
      <div
        id="editor-surface"
        className="flex-1 w-full min-w-0 max-w-full relative min-h-0 flex flex-col overflow-hidden focus-within:ring-1 focus-within:ring-primary/40 focus-within:ring-inset bg-[var(--editor-bg,#FCFCFB)] dark:bg-[var(--editor-bg,#1A1A22)]"
      >
        <UnifiedCodeMirrorEditor
          key={page.id}
          fileId={page.id}
          filePath={page.title || (page as any).name || page.id}
          value={currentContent}
          onChange={handleContentChange}
          isDarkTheme={isDarkTheme}
          readOnly={isReadOnly}
          bibEntries={bibEntries}
          projectFiles={pageFiles}
          projectId={projectScopeId}
          keybinding={keybinding}
          yText={yText}
          awareness={awareness}
          comments={comments}
          activeCommentId={activeCommentId}
          suggestions={suggestions}
          trackChangesViewMode={trackChangesViewMode}
          reviewMode={reviewMode}
          onCreateSuggestion={(change) => {
            if (page?.id) {
              createSuggestionMutation.mutate({
                pageId: page.id,
                projectId: effectiveProjectId,
                type: change.type,
                originalText: change.originalText || (change.type === 'delete' ? change.text : undefined),
                suggestedText: change.suggestedText || (change.type === 'insert' ? change.text : undefined),
                fromLine: change.fromLine,
                fromColumn: change.fromColumn,
                toLine: change.toLine,
                toColumn: change.toColumn,
                silent: change.silent ?? true,
              });
            }
          }}
          onSelectionFloating={setSelFloating}
          onContextMenu={handleEditorContextMenu}
          onAcceptSuggestion={(sug) =>
            acceptSuggestionMutation.mutate({ pageId: page.id, suggestionId: sug.id })
          }
          onRejectSuggestion={(sug) =>
            rejectSuggestionMutation.mutate({ pageId: page.id, suggestionId: sug.id })
          }
        />

        {/* In-Editor Search & Replace Bar */}
        <EditorSearchPanel
          isOpen={isFindOpen}
          onClose={() => setIsFindOpen(false)}
        />

        {/* Vim status bar */}
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

        {/* Emacs status bar */}
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
              <span className="px-1.5 py-0.5 rounded-sm bg-ai/10 text-ai border border-ai/20 text-11 font-medium tracking-normal">
                emacs
              </span>
              <span className="text-foreground font-medium text-xs">
                {emacsStatus || 'ready'}
              </span>
            </div>
            <span className="text-11 text-muted-foreground">
              c-x c-s to save · c-g to quit
            </span>
          </div>
        )}
      </div>

      {/* Overlays (Glyph tooltip, Inline suggestion, Selection bar, AI Assistant, Context menu) */}
      <EditorFloatingOverlay
        glyphTooltip={glyphTooltip}
        activeSuggestionWidgetData={activeSuggestionWidgetData}
        isAcceptingSuggestion={false}
        isRejectingSuggestion={false}
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

      {/* Modals (Citations, Tables, Figures, Symbols, Word Count, Suggestion, Rename) */}
      <EditorModals
        citationModalOpen={citationModalOpen}
        setCitationModalOpen={setCitationModalOpen}
        bibEntries={bibEntries}
        onInsertCitation={handleInsertCitationSnippet}
        projectId={projectScopeId}
        initialCitationQuery={initialCitationQuery}
        initialCitationKey={initialCitationKey}
        citedKeys={citedKeys}
        rootPageId={rootPageId}
        currentPage={page}
        projectFiles={pageFiles}
        suggestModal={suggestModal}
        setSuggestModal={setSuggestModal}
        isCreatingSuggestion={false}
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
