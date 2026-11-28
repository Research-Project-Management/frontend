/**
 * WorkbenchLayout.tsx
 *
 * Workbench Layout Orchestrator (Block 7: UI Shell Layer).
 * Location: `features/editor/core/shell/WorkbenchLayout.tsx`
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
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useShallow } from 'zustand/react/shallow';

import { WorkbenchShell } from './WorkbenchShell';
import { ActivityBar } from './ActivityBar';
import Topbar from './Topbar';
import { PrimarySidebar } from './PrimarySidebar';
import { EditorArea } from '@/features/editor/core/surface/EditorArea';

import { filesQuery } from '@/features/editor/core/queries/document.queries';
import { usePageStore } from '../store/editor.store';
import { useSettingsStore } from '../store/settings.store';
import { useWorkspaceStore, type ActivityBarTab } from '../store/workspace.store';
import { useEditorInstance } from '@/features/editor/core/hooks/useEditorInstance';
import { useActiveDocument } from '@/features/editor/core/queries/useActiveDocument';
import { editorCommandBus, getActiveEditorEngine } from '../bus/command-bus';
import { keybindingCoordinator } from '@/features/editor/subsystems/keybinding';
import { useViewItems } from '@/features/library/sdk/queries/catalog.queries';
import { resolveCitationScope } from '@/features/editor/subsystems/citation/model/scope';
import { latexSymbolsIndex } from '@/features/editor/domain/latex/latex-symbols-index';
import { extractDocumentContentString } from '@/features/editor/domain/types/core.types';
import { DEFAULT_MAIN_FILE } from '@/features/editor/domain/constants/editor.constants';

const PdfViewer = dynamic(() => import('@/features/editor/subsystems/compiler').then(m => m.PdfViewer), { ssr: false });
const DetachedPdfPlaceholder = dynamic(() => import('@/features/editor/subsystems/compiler').then(m => m.DetachedPdfPlaceholder), { ssr: false });
const SettingsModal = dynamic(() => import('@/features/editor/subsystems/settings/ui/SettingsModal'), { ssr: false });
const WordCountModal = dynamic(() => import('@/features/editor/subsystems/compiler/ui/WordCountModal'), { ssr: false });
const CitationModal = dynamic(() => import('@/features/editor/subsystems/citation/ui/CitationModal'), { ssr: false });
const TableModal = dynamic(() => import('@/features/editor/subsystems/insert/ui/table/TableModal'), { ssr: false });
const EquationModal = dynamic(() => import('@/features/editor/subsystems/insert/ui/EquationModal'), { ssr: false });
const FigureModal = dynamic(() => import('@/features/editor/subsystems/insert/ui/FigureModal'), { ssr: false });
const TemplateGalleryModal = dynamic(() => import('@/features/editor/subsystems/explorer/ui/modals/TemplateGalleryModal').then((m) => m.TemplateGalleryModal), { ssr: false });
const KeyboardShortcutsModal = dynamic(() => import('@/features/editor/subsystems/keybinding/ui/KeyboardShortcutsModal'), { ssr: false });
const QuickOpenModal = dynamic(() => import('@/features/editor/subsystems/navigation/ui/QuickOpenModal'), { ssr: false });

/** Safely extracts LaTeX string content from active engine or document entity */
function getDocContent(doc: unknown, fallbackEngineContent?: string): string {
  return fallbackEngineContent || extractDocumentContentString(doc);
}

interface ConnectedWordCountModalProps {
  open: boolean;
  projectId?: string;
  rootPageId: string | null;
  engine: ReturnType<typeof useEditorInstance>['engine'];
}

function ConnectedWordCountModal({ open, projectId, rootPageId, engine }: ConnectedWordCountModalProps) {
  const currentDoc = usePageStore((s) => s.activeFilePage || s.currentPage);
  const configuredMainFile = usePageStore((s) => s.mainFilePath) || DEFAULT_MAIN_FILE;
  const { data: serverFiles = [] } = useQuery({
    ...filesQuery(rootPageId || ''),
    enabled: Boolean(rootPageId) && open,
  });

  const combinedProjectFiles = useMemo(() => {
    if (!open) return [];

    const currentDocContent = getDocContent(currentDoc, engine?.getContent());

    const currentDocItem = {
      id: currentDoc?.id || 'current',
      title: currentDoc?.title || configuredMainFile,
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
  }, [serverFiles, currentDoc, engine, open, configuredMainFile]);

  return (
    <WordCountModal
      open={open}
      onClose={() => editorCommandBus.dispatch({ type: 'dialog:close', dialog: 'word-count' })}
      projectId={projectId || rootPageId || currentDoc?.id}
      content={getDocContent(currentDoc, engine?.getContent())}
      selectedText={engine?.getSelectedText() || ''}
      activeFileName={currentDoc?.title || configuredMainFile}
      projectFiles={combinedProjectFiles}
      onInsertSnippet={(snippet) => {
        editorCommandBus.dispatch({ type: 'editor:insert-text', text: snippet });
        editorCommandBus.dispatch({ type: 'editor:focus' });
      }}
    />
  );
}

export function WorkbenchLayout() {
  const router = useRouter();
  const { projectId: routeProjectId, pageId, draftId } = useParams<{
    projectId?: string;
    pageId?: string;
    draftId?: string;
  }>();

  const storeProjectId = usePageStore((s) => s.projectId);
  const spaceId = usePageStore((s) => s.spaceId);
  const spaceType = usePageStore((s) => s.spaceType);
  const { libraryScope } = resolveCitationScope({
    spaceType,
    routeProjectId,
    storeProjectId: storeProjectId || undefined,
    storeSpaceId: spaceId || undefined,
  });
  const hasWorkspaceScope = Boolean(routeProjectId || storeProjectId || spaceId);
  const rootPageId = pageId ?? draftId ?? null;

  // Ensure active document and workspace store are always hydrated even in viewer-only or history modes
  useActiveDocument();
  const { engine } = useEditorInstance();

  const {
    layout,
    isHistoryOpen,
    setIsHistoryOpen,
    settingsPanelOpen,
    isTemplateModalOpen,
  } = useSettingsStore(
    useShallow((s) => ({
      layout: s.layout,
      isHistoryOpen: s.isHistoryOpen,
      setIsHistoryOpen: s.setIsHistoryOpen,
      settingsPanelOpen: s.settingsPanelOpen,
      isTemplateModalOpen: s.isTemplateModalOpen,
    }))
  );

  const [wordCountOpen, setWordCountOpen] = useState(false);
  const [citationPickerOpen, setCitationPickerOpen] = useState(false);
  const [citationPickerInitialQuery, setCitationPickerInitialQuery] = useState<string | undefined>(undefined);
  const [tableWizardOpen, setTableWizardOpen] = useState(false);
  const [tableWizardTab, setTableWizardTab] = useState<'table' | 'import' | 'ai' | 'matrix'>('table');
  const [tableWizardInitialLatex, setTableWizardInitialLatex] = useState('');
  const [equationGeneratorOpen, setEquationGeneratorOpen] = useState(false);
  const [figureWizardOpen, setFigureWizardOpen] = useState(false);
  const [keyboardShortcutsOpen, setKeyboardShortcutsOpen] = useState(false);
  const [quickOpenOpen, setQuickOpenOpen] = useState(false);

  // Sync workspace library references into latexSymbolsIndex once workspace scope is resolved
  const { data: libraryData } = useViewItems(
    libraryScope,
    'all',
    { enabled: hasWorkspaceScope },
  );
  useEffect(() => {
    if (libraryData?.items && libraryData.items.length > 0) {
      latexSymbolsIndex.setLibraryCitations(libraryData.items);
    }
  }, [libraryData?.items]);

  const currentPageId = usePageStore((s) => s.currentPage?.id);
  const currentPageTitle = usePageStore((s) => s.currentPage?.title ?? '');

  useEffect(() => {
    const t = currentPageTitle.trim();
    document.title = t ? `${t} · Flux` : 'Editor · Flux';
  }, [currentPageTitle]);

  useEffect(() => {
    const disposeKeybindings = keybindingCoordinator.init();

    const unsubCmd = editorCommandBus.subscribe('dialog:open', (cmd) => {
      if (cmd.dialog === 'word-count') {
        setWordCountOpen(true);
      } else if (cmd.dialog === 'citation-picker') {
        setCitationPickerInitialQuery(cmd.payload?.initialQuery || undefined);
        setCitationPickerOpen(true);
      } else if (cmd.dialog === 'table-wizard' || cmd.dialog === 'matrix-wizard') {
        const requestedTab = cmd.payload?.initialTab;
        const initialTab: 'table' | 'import' | 'ai' | 'matrix' =
          cmd.dialog === 'matrix-wizard' || requestedTab === 'matrix'
            ? 'matrix'
            : requestedTab === 'import' || requestedTab === 'ai'
              ? requestedTab
              : 'table';
        const selectedText = getActiveEditorEngine()?.getSelectedText?.() || cmd.payload?.initialLatex || '';
        setTableWizardTab(initialTab);
        setTableWizardInitialLatex(selectedText);
        setTableWizardOpen(true);
      } else if (cmd.dialog === 'figure-wizard') {
        setFigureWizardOpen(true);
      } else if (cmd.dialog === 'equation-generator') {
        if (useSettingsStore.getState().aiAssistEnabled) {
          setEquationGeneratorOpen(true);
        }
      } else if (cmd.dialog === 'template-gallery') {
        useSettingsStore.getState().setIsTemplateModalOpen(true);
      } else if (cmd.dialog === 'keyboard-shortcuts' || cmd.dialog === 'shortcuts') {
        setKeyboardShortcutsOpen(true);
      } else if (cmd.dialog === 'quick-open') {
        setQuickOpenOpen(true);
      } else if (cmd.dialog === 'github-sync') {
        useSettingsStore.getState().openSettingsModal('github');
      } else if (cmd.dialog === 'project-settings') {
        const targetTab = (cmd.payload?.tab || cmd.payload?.view || cmd.payload?.initialTab || 'editor') as import('@/features/editor/core/store/settings.store').SettingsTab;
        useSettingsStore.getState().openSettingsModal(targetTab);
      }
    });

    const unsubClose = editorCommandBus.subscribe('dialog:close', (cmd) => {
      if (!cmd.dialog || cmd.dialog === 'word-count') {
        setWordCountOpen(false);
      }
      if (!cmd.dialog || cmd.dialog === 'citation-picker') {
        setCitationPickerOpen(false);
      }
      if (!cmd.dialog || cmd.dialog === 'table-wizard' || cmd.dialog === 'matrix-wizard') {
        setTableWizardOpen(false);
      }
      if (!cmd.dialog || cmd.dialog === 'figure-wizard') {
        setFigureWizardOpen(false);
      }
      if (!cmd.dialog || cmd.dialog === 'equation-generator') {
        setEquationGeneratorOpen(false);
      }
      if (!cmd.dialog || cmd.dialog === 'template-gallery') {
        useSettingsStore.getState().setIsTemplateModalOpen(false);
      }
      if (!cmd.dialog || cmd.dialog === 'keyboard-shortcuts' || cmd.dialog === 'shortcuts') {
        setKeyboardShortcutsOpen(false);
      }
      if (!cmd.dialog || cmd.dialog === 'quick-open') {
        setQuickOpenOpen(false);
      }
    });

    const normalizeTab = (panel: string): ActivityBarTab => {
      const lower = (panel || '').toLowerCase();
      if (lower === 'explorer') return 'files';
      if (lower === 'outline') {
        useWorkspaceStore.getState().setFileOutlineOpen(true);
        return 'files';
      }
      if (lower === 'files' || lower === 'search' || lower === 'citations' || lower === 'review' || lower === 'ai') {
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
      const targetPageId = rootPageId || currentPageId;
      if (!targetPageId) return;
      const isPersonal = !routeProjectId || routeProjectId === 'personal';
      const url = isPersonal
        ? `/pages/${targetPageId}/history`
        : `/projects/${routeProjectId}/pages/${targetPageId}/history`;
      router.push(url);
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
      {settingsPanelOpen && <SettingsModal />}

      {wordCountOpen && (
        <ConnectedWordCountModal
          open={wordCountOpen}
          projectId={routeProjectId || storeProjectId || undefined}
          rootPageId={rootPageId}
          engine={engine}
        />
      )}

      {citationPickerOpen && (
        <CitationModal
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

      {tableWizardOpen && (
        <TableModal
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

      {equationGeneratorOpen && (
        <EquationModal
          open={equationGeneratorOpen}
          onOpenChange={(open) => {
            setEquationGeneratorOpen(open);
            if (!open) {
              editorCommandBus.dispatch({ type: 'dialog:close', dialog: 'equation-generator' });
            }
          }}
          onInsert={(latexCode) => {
            editorCommandBus.dispatch({ type: 'editor:insert-text', text: latexCode });
            editorCommandBus.dispatch({ type: 'editor:focus' });
          }}
        />
      )}

      {figureWizardOpen && (
        <FigureModal
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

      {isTemplateModalOpen && <TemplateGalleryModal />}

      {keyboardShortcutsOpen && (
        <KeyboardShortcutsModal
          open={keyboardShortcutsOpen}
          onOpenChange={(open) => {
            setKeyboardShortcutsOpen(open);
            if (!open) {
              editorCommandBus.dispatch({ type: 'dialog:close', dialog: 'keyboard-shortcuts' });
            }
          }}
        />
      )}

      {quickOpenOpen && (
        <QuickOpenModal
          open={quickOpenOpen}
          onOpenChange={(open) => {
            setQuickOpenOpen(open);
            if (!open) {
              editorCommandBus.dispatch({ type: 'dialog:close', dialog: 'quick-open' });
            }
          }}
        />
      )}
    </>
  );
}

export default WorkbenchLayout;
