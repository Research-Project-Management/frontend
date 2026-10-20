/**
 * ModernWorkbenchLayout.tsx
 *
 * Workbench Layout Orchestrator (Block 7: UI Shell Layer).
 * Location: `features/editor/ui/shell/ModernWorkbenchLayout.tsx`
 *
 * Connects the WorkbenchShell slots to their implementations:
 * - TopBar: Project title, compile button, global actions.
 * - ActivityBar: 48px icon strip switching Primary Sidebar viewlets (Files, Search, AI...).
 * - PrimarySidebar: FileTree, Project Search, Outline, Citations, Review, Chat, AI.
 * - EditorArea: Tab bar, scoped format toolbar, CodeMirror 6 / Visual Editor.
 * - Viewer: PDF.js previewer, scoped zoom & sync toolbar, and CompilerLogs.
 * - Modals: Settings, WordCount, DeletedFiles.
 *
 * NOTE: 0 dependencies on legacy sub-features/ directory.
 */

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useShallow } from 'zustand/react/shallow';

import { WorkbenchShell } from './WorkbenchShell';
import { ActivityBar } from './ActivityBar';
import Topbar from './Topbar';
import { PrimarySidebar } from './PrimarySidebar';
import { EditorArea } from '@/features/editor/ui/editor/EditorArea';

import { filesQuery } from '@/features/editor/ui/hooks/document.queries';
import { usePageStore } from '@/features/editor/core';
import { useSettingsStore } from '@/features/editor/core';
import { useWorkspaceStore, type ActivityBarTab } from '@/features/editor/core';
import { useEditorInstance } from '@/features/editor/ui/hooks/useEditorInstance';
import { editorCommandBus, getActiveEditorEngine } from '@/features/editor/core';
import { keybindingCoordinator } from '@/features/editor/subsystems/keybinding';
import { useViewItems } from '@/features/library/sdk/queries/catalog.queries';
import { latexSymbolsIndex } from '@/features/editor/domain/latex/latex-symbols-index';

const PdfViewer = dynamic(() => import('@/features/editor/subsystems/compiler').then(m => m.PdfViewer), { ssr: false });
const DetachedPdfPlaceholder = dynamic(() => import('@/features/editor/subsystems/compiler').then(m => m.DetachedPdfPlaceholder), { ssr: false });
const ProjectSettingsModal = dynamic(() => import('@/features/editor/ui/modals/project-settings/ProjectSettingsModal'), { ssr: false });
const DeletedFilesModal = dynamic(() => import('@/features/editor/ui/modals/DeletedFilesModal'), { ssr: false });
const WordCountModal = dynamic(() => import('@/features/editor/ui/modals/WordCountModal'), { ssr: false });
const CitationPickerModal = dynamic(() => import('@/features/editor/subsystems/citation/ui/modals/CitationPickerModal'), { ssr: false });
const RenameCitationModal = dynamic(() => import('@/features/editor/subsystems/citation/ui/modals/RenameCitationModal'), { ssr: false });
const HistoryPage = dynamic(() => import('@/features/editor/subsystems/history/ui/HistoryPage'), { ssr: false });
const TableWizardModal = dynamic(() => import('@/features/editor/ui/modals/table-wizard/TableWizardModal'), { ssr: false });
const FigureWizardModal = dynamic(() => import('@/features/editor/ui/modals/FigureWizardModal'), { ssr: false });
const SymbolPaletteModal = dynamic(() => import('@/features/editor/ui/modals/SymbolPaletteModal'), { ssr: false });

/** Safely extracts LaTeX string content from active engine or document entity */
function getDocContent(doc: unknown, fallbackEngineContent?: string): string {
  if (fallbackEngineContent) return fallbackEngineContent;
  if (!doc || typeof doc !== 'object') return '';
  const d = doc as { content?: unknown; docContent?: unknown };
  if (typeof d.content === 'string') return d.content;
  if (
    d.content &&
    typeof d.content === 'object' &&
    'source' in d.content &&
    typeof (d.content as { source?: unknown }).source === 'string'
  ) {
    return (d.content as { source: string }).source;
  }
  if (typeof d.docContent === 'string') return d.docContent;
  return '';
}

interface ConnectedWordCountModalProps {
  open: boolean;
  rootPageId: string | null;
  engine: ReturnType<typeof useEditorInstance>['engine'];
}

function ConnectedWordCountModal({ open, rootPageId, engine }: ConnectedWordCountModalProps) {
  const currentDoc = usePageStore((s) => s.activeFilePage || s.currentPage);
  const { data: serverFiles = [] } = useQuery({
    ...filesQuery(rootPageId || ''),
    enabled: Boolean(rootPageId) && open,
  });

  const combinedProjectFiles = useMemo(() => {
    if (!open) return [];

    const currentDocContent = getDocContent(currentDoc, engine?.getContent());

    const currentDocItem = {
      id: currentDoc?.id || 'current',
      title: currentDoc?.title || 'main.tex',
      content: currentDocContent,
    };

    const list: Array<{ id: string; title: string; content: string }> = (
      serverFiles as Array<{ id: string; title?: string; name?: string; content?: string }>
    ).map((f) => ({
      id: f.id,
      title: f.title || f.name || 'document',
      content: f.id === currentDoc?.id ? currentDocContent : (f.content || ''),
    }));

    if (!list.some((f) => f.id === currentDocItem.id || f.title === currentDocItem.title)) {
      list.unshift(currentDocItem);
    }
    return list;
  }, [serverFiles, currentDoc, engine, open]);

  return (
    <WordCountModal
      open={open}
      onClose={() => editorCommandBus.dispatch({ type: 'dialog:close', dialog: 'word-count' })}
      content={getDocContent(currentDoc, engine?.getContent())}
      selectedText={engine?.getSelectedText() || ''}
      activeFileName={currentDoc?.title || 'main.tex'}
      projectFiles={combinedProjectFiles}
      onInsertSnippet={(snippet) => {
        editorCommandBus.dispatch({ type: 'editor:insert-text', text: snippet });
        editorCommandBus.dispatch({ type: 'editor:focus' });
      }}
    />
  );
}

export function ModernWorkbenchLayout() {
  const { projectId: routeProjectId, pageId, draftId } = useParams<{
    projectId?: string;
    pageId?: string;
    draftId?: string;
  }>();

  const storeProjectId = usePageStore((s) => s.projectId);
  const rawProjectId = routeProjectId || storeProjectId || undefined;
  const rootPageId = pageId ?? draftId ?? null;

  const { engine } = useEditorInstance();

  const {
    layout,
    settingsPanelOpen,
    isHistoryOpen,
    setIsHistoryOpen,
  } = useSettingsStore(
    useShallow((s) => ({
      layout: s.layout,
      settingsPanelOpen: s.settingsPanelOpen,
      isHistoryOpen: s.isHistoryOpen,
      setIsHistoryOpen: s.setIsHistoryOpen,
    }))
  );

  const [wordCountOpen, setWordCountOpen] = useState(false);
  const [deletedFilesOpen, setDeletedFilesOpen] = useState(false);
  const [citationPickerOpen, setCitationPickerOpen] = useState(false);
  const [citationPickerInitialQuery, setCitationPickerInitialQuery] = useState<string | undefined>(undefined);
  const [renameCitationOpen, setRenameCitationOpen] = useState(false);
  const [renameCitationOldKey, setRenameCitationOldKey] = useState('');
  const [tableWizardOpen, setTableWizardOpen] = useState(false);
  const [tableWizardTab, setTableWizardTab] = useState<'table' | 'matrix'>('table');
  const [tableWizardInitialLatex, setTableWizardInitialLatex] = useState('');
  const [figureWizardOpen, setFigureWizardOpen] = useState(false);
  const [symbolPaletteOpen, setSymbolPaletteOpen] = useState(false);

  // Sync workspace library references into latexSymbolsIndex for instant autocomplete & hover
  const { data: libraryData } = useViewItems(rawProjectId || 'user', 'all');
  useEffect(() => {
    if (libraryData?.items && libraryData.items.length > 0) {
      latexSymbolsIndex.setLibraryCitations(libraryData.items);
    }
  }, [libraryData?.items]);

  const currentPageId = usePageStore((s) => s.currentPage?.id);

  useEffect(() => {
    const disposeKeybindings = keybindingCoordinator.init();

    const unsubCmd = editorCommandBus.subscribe('dialog:open', (cmd) => {
      if (cmd.dialog === 'word-count') {
        setWordCountOpen(true);
      } else if (cmd.dialog === 'deleted-files') {
        setDeletedFilesOpen(true);
      } else if (cmd.dialog === 'citation-picker') {
        setCitationPickerInitialQuery(cmd.payload?.initialQuery || undefined);
        setCitationPickerOpen(true);
      } else if (cmd.dialog === 'rename-symbol' || cmd.dialog === 'rename-citation') {
        const key = cmd.payload?.oldKey || cmd.payload?.key || '';
        setRenameCitationOldKey(key);
        setRenameCitationOpen(true);
      } else if (cmd.dialog === 'table-wizard' || cmd.dialog === 'matrix-wizard') {
        const initialTab: 'table' | 'matrix' =
          cmd.dialog === 'matrix-wizard' || cmd.payload?.initialTab === 'matrix'
            ? 'matrix'
            : 'table';
        const selectedText = getActiveEditorEngine()?.getSelectedText?.() || cmd.payload?.initialLatex || '';
        setTableWizardTab(initialTab);
        setTableWizardInitialLatex(selectedText);
        setTableWizardOpen(true);
      } else if (cmd.dialog === 'figure-wizard') {
        setFigureWizardOpen(true);
      } else if (cmd.dialog === 'symbol-palette') {
        setSymbolPaletteOpen(true);
      } else if (cmd.dialog === 'github-sync') {
        useSettingsStore.getState().openSettingsModal('github');
      } else if (cmd.dialog === 'project-settings') {
        useSettingsStore.getState().openSettingsModal((cmd.payload?.tab as import('@/features/editor/core/store/settings.store').SettingsTab) || 'editor');
      }
    });

    const unsubClose = editorCommandBus.subscribe('dialog:close', (cmd) => {
      if (!cmd.dialog || cmd.dialog === 'word-count') {
        setWordCountOpen(false);
      }
      if (!cmd.dialog || cmd.dialog === 'deleted-files') {
        setDeletedFilesOpen(false);
      }
      if (!cmd.dialog || cmd.dialog === 'citation-picker') {
        setCitationPickerOpen(false);
      }
      if (!cmd.dialog || cmd.dialog === 'rename-symbol' || cmd.dialog === 'rename-citation') {
        setRenameCitationOpen(false);
      }
      if (!cmd.dialog || cmd.dialog === 'table-wizard' || cmd.dialog === 'matrix-wizard') {
        setTableWizardOpen(false);
      }
      if (!cmd.dialog || cmd.dialog === 'figure-wizard') {
        setFigureWizardOpen(false);
      }
      if (!cmd.dialog || cmd.dialog === 'symbol-palette') {
        setSymbolPaletteOpen(false);
      }
    });

    const normalizeTab = (panel: string): ActivityBarTab => {
      const lower = (panel || '').toLowerCase();
      if (lower === 'explorer') return 'files';
      if (lower === 'outline') {
        useWorkspaceStore.getState().setFileOutlineOpen(true);
        return 'files';
      }
      if (lower === 'files' || lower === 'search' || lower === 'citations' || lower === 'review' || lower === 'chat' || lower === 'ai') {
        return lower as ActivityBarTab;
      }
      return 'files';
    };

    const unsubSidebarToggle = editorCommandBus.subscribe('sidebar:toggle-panel', (cmd) => {
      useWorkspaceStore.getState().selectActivityTab(normalizeTab(cmd.panel));
    });

    const unsubSidebarOpen = editorCommandBus.subscribe('sidebar:open-panel', (cmd) => {
      useWorkspaceStore.getState().setActiveSidebarTab(normalizeTab(cmd.panel));
      useWorkspaceStore.getState().setSidebarLeftOpen(true);
    });

    const unsubAiToggle = editorCommandBus.subscribe('sidebar:toggle-ai-panel', () => {
      useWorkspaceStore.getState().selectActivityTab('ai');
    });

    const unsubHistory = editorCommandBus.subscribe('history:open', () => {
      useSettingsStore.getState().setIsHistoryOpen(true);
    });

    return () => {
      disposeKeybindings();
      unsubCmd();
      unsubClose();
      unsubSidebarToggle();
      unsubSidebarOpen();
      unsubAiToggle();
      unsubHistory();
    };
  }, []);

  const isPdfDetached = useWorkspaceStore((s) => s.isPdfDetached);
  const isEditorOnly = layout === 'editor-only';
  const isViewerOnly = layout === 'viewer-only';

  if (isHistoryOpen) {
    return (
      <HistoryPage
        open={isHistoryOpen}
        onOpenChange={(open) => setIsHistoryOpen(open)}
        onClose={() => setIsHistoryOpen(false)}
        projectId={rawProjectId}
        pageId={rootPageId || currentPageId}
      />
    );
  }

  return (
    <>
      <WorkbenchShell
        topBar={<Topbar />}
        activityBar={<ActivityBar />}
        leftSidebar={<PrimarySidebar />}
        editor={!isViewerOnly ? <EditorArea /> : null}
        preview={
          !isEditorOnly
            ? isPdfDetached
              ? <DetachedPdfPlaceholder />
              : <PdfViewer />
            : null
        }
      />

      {/* Global Modals */}
      <ProjectSettingsModal />

      {wordCountOpen && (
        <ConnectedWordCountModal
          open={wordCountOpen}
          rootPageId={rootPageId}
          engine={engine}
        />
      )}

      {deletedFilesOpen && (
        <DeletedFilesModal
          open={deletedFilesOpen}
          onOpenChange={(open) => {
            if (!open) {
              editorCommandBus.dispatch({ type: 'dialog:close', dialog: 'deleted-files' });
            } else {
              setDeletedFilesOpen(true);
            }
          }}
          pageId={rootPageId || currentPageId || ''}
        />
      )}

      {citationPickerOpen && (
        <CitationPickerModal
          open={citationPickerOpen}
          onOpenChange={(open) => {
            if (!open) {
              editorCommandBus.dispatch({ type: 'dialog:close', dialog: 'citation-picker' });
            } else {
              setCitationPickerOpen(true);
            }
          }}
          initialQuery={citationPickerInitialQuery}
        />
      )}

      {renameCitationOpen && (
        <RenameCitationModal
          open={renameCitationOpen}
          oldKey={renameCitationOldKey}
          onOpenChange={(open) => {
            setRenameCitationOpen(open);
            if (!open) {
              editorCommandBus.dispatch({ type: 'dialog:close', dialog: 'rename-symbol' });
            }
          }}
        />
      )}

      {tableWizardOpen && (
        <TableWizardModal
          open={tableWizardOpen}
          onOpenChange={(open) => {
            setTableWizardOpen(open);
            if (!open) {
              editorCommandBus.dispatch({ type: 'dialog:close', dialog: 'table-wizard' });
            }
          }}
          initialTab={tableWizardTab}
          initialLatex={tableWizardInitialLatex}
          onInsert={(latexCode) => {
            editorCommandBus.dispatch({ type: 'editor:insert-text', text: latexCode });
            editorCommandBus.dispatch({ type: 'editor:focus' });
          }}
        />
      )}

      {figureWizardOpen && (
        <FigureWizardModal
          open={figureWizardOpen}
          onOpenChange={(open) => {
            setFigureWizardOpen(open);
            if (!open) {
              editorCommandBus.dispatch({ type: 'dialog:close', dialog: 'figure-wizard' });
            }
          }}
          parentPageId={rootPageId || currentPageId || ''}
          onInsert={(latexCode) => {
            editorCommandBus.dispatch({ type: 'editor:insert-text', text: latexCode });
            editorCommandBus.dispatch({ type: 'editor:focus' });
          }}
        />
      )}

      {symbolPaletteOpen && (
        <SymbolPaletteModal
          open={symbolPaletteOpen}
          onOpenChange={(open) => {
            setSymbolPaletteOpen(open);
            if (!open) {
              editorCommandBus.dispatch({ type: 'dialog:close', dialog: 'symbol-palette' });
            }
          }}
          onInsert={(symbol) => {
            editorCommandBus.dispatch({ type: 'editor:insert-text', text: symbol });
            editorCommandBus.dispatch({ type: 'editor:focus' });
          }}
        />
      )}
    </>
  );
}

export default ModernWorkbenchLayout;

