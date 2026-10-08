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
 * - EditorArea: Tab bar, breadcrumbs, scoped format toolbar, CodeMirror 6.
 * - Viewer: PDF.js previewer, scoped zoom & sync toolbar.
 * - BottomDockPanel: Problems table (O(log K) search) & raw compiler logs.
 * - StatusBar: Git branch, problems indicator, sync status, Ln/Col coordinates.
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
import { StatusBar } from './StatusBar';
import Topbar from './Topbar';
import { PrimarySidebar } from '../features/sidebar/PrimarySidebar';
import { EditorArea } from '../features/editor/EditorArea';
import { BottomDockPanel } from '../features/panel/BottomDockPanel';

import { filesQuery } from '../hooks/use-core';
import { usePageStore, useSettingsStore } from '../../store';
import { useLayoutStore, type ActivityBarTab } from '../../store/layout.store';
import { useEditorInstance } from '../hooks/use-editor-instance';
import { editorCommandBus } from '../../coordinators/command-bus';
import { useViewItems } from '@/features/library';
import { latexSymbolsIndex } from '../../domain/latex-symbols-index';

const PdfViewer = dynamic(() => import('../features/preview/PdfViewer'), { ssr: false });
const ProjectSettingsModal = dynamic(
  () => import('../modals/ProjectSettingsModal'),
  { ssr: false }
);
const DeletedFilesModal = dynamic(
  () => import('../modals/DeletedFilesModal'),
  { ssr: false }
);
const WordCountDialog = dynamic(
  () => import('../modals/WordCountDialog').then((mod) => (mod.WordCountDialog || mod.default)),
  { ssr: false }
);

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
  } = useSettingsStore(
    useShallow((s) => ({
      layout: s.layout,
      settingsPanelOpen: s.settingsPanelOpen,
    }))
  );

  const [wordCountOpen, setWordCountOpen] = useState(false);
  const [deletedFilesOpen, setDeletedFilesOpen] = useState(false);

  // Sync workspace library references into latexSymbolsIndex for instant autocomplete & hover
  const { data: libraryData } = useViewItems(rawProjectId || 'me', 'all');
  useEffect(() => {
    if (libraryData?.items && libraryData.items.length > 0) {
      latexSymbolsIndex.setLibraryCitations(libraryData.items);
    }
  }, [libraryData?.items]);

  const currentPage = usePageStore((s) => s.currentPage);
  const activeFilePage = usePageStore((s) => s.activeFilePage);
  const currentDoc = activeFilePage || currentPage;

  const { data: serverFiles = [] } = useQuery({
    ...filesQuery(rootPageId || ''),
    enabled: Boolean(rootPageId) && wordCountOpen,
  });

  const combinedProjectFiles = useMemo(() => {
    if (!wordCountOpen) return [];

    const currentDocContent =
      engine?.getContent() ||
      (currentDoc?.content
        ? typeof currentDoc.content === 'string'
          ? currentDoc.content
          : (currentDoc.content as any).source || ''
        : (currentDoc as any)?.docContent || '');

    const currentDocItem = {
      id: currentDoc?.id || 'current',
      title: currentDoc?.title || 'main.tex',
      content: currentDocContent,
    };

    const list: any[] = (serverFiles as any[]).map((f: any) => ({
      id: f.id,
      title: f.title || f.name,
      content: f.id === currentDoc?.id ? currentDocContent : f.content,
    }));

    if (!list.some((f) => f.id === currentDocItem.id || f.title === currentDocItem.title)) {
      list.unshift(currentDocItem);
    }
    return list;
  }, [serverFiles, currentDoc, engine, wordCountOpen]);

  useEffect(() => {
    const unsubCmd = editorCommandBus.subscribe('dialog:open', (cmd) => {
      if (cmd.dialog === 'word-count') {
        setWordCountOpen(true);
      } else if (cmd.dialog === 'deleted-files') {
        setDeletedFilesOpen(true);
      }
    });

    const unsubClose = editorCommandBus.subscribe('dialog:close', (cmd) => {
      if (!cmd.dialog || cmd.dialog === 'word-count') {
        setWordCountOpen(false);
      }
      if (!cmd.dialog || cmd.dialog === 'deleted-files') {
        setDeletedFilesOpen(false);
      }
    });

    const unsubSidebarToggle = editorCommandBus.subscribe('sidebar:toggle-panel', (cmd) => {
      const tabMap: Record<string, ActivityBarTab> = {
        Files: 'files',
        Explorer: 'files',
        Outline: 'outline',
        Search: 'search',
        Citations: 'citations',
        Review: 'review',
        AI: 'ai',
      };
      const targetTab = tabMap[cmd.panel] || 'files';
      useLayoutStore.getState().selectActivityTab(targetTab);
    });

    const unsubAiToggle = editorCommandBus.subscribe('sidebar:toggle-ai-panel', () => {
      useLayoutStore.getState().selectActivityTab('ai');
    });

    return () => {
      unsubCmd();
      unsubClose();
      unsubSidebarToggle();
      unsubAiToggle();
    };
  }, []);

  const isEditorOnly = layout === 'editor-only';
  const isViewerOnly = layout === 'viewer-only';

  return (
    <>
      <WorkbenchShell
        topBar={<Topbar />}
        activityBar={<ActivityBar />}
        leftSidebar={<PrimarySidebar />}
        editor={!isViewerOnly ? <EditorArea /> : null}
        preview={!isEditorOnly ? <PdfViewer /> : null}
        bottomPanel={<BottomDockPanel />}
        statusBar={<StatusBar />}
      />

      {/* Global Modals */}
      {settingsPanelOpen && <ProjectSettingsModal />}

      {wordCountOpen && (
        <WordCountDialog
          open={wordCountOpen}
          onClose={() => editorCommandBus.dispatch({ type: 'dialog:close', dialog: 'word-count' })}
          content={
            engine?.getContent() ||
            (currentDoc?.content
              ? typeof currentDoc.content === 'string'
                ? currentDoc.content
                : (currentDoc.content as any).source || ''
              : (currentDoc as any)?.docContent || '')
          }
          selectedText={engine?.getSelectedText() || ''}
          activeFileName={currentDoc?.title || 'main.tex'}
          projectFiles={combinedProjectFiles}
          onInsertSnippet={(snippet) => {
            editorCommandBus.dispatch({ type: 'editor:insert-text', text: snippet });
            editorCommandBus.dispatch({ type: 'editor:focus' });
          }}
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
          pageId={rootPageId || (currentPage as any)?.id || ''}
        />
      )}
    </>
  );
}

export default ModernWorkbenchLayout;
