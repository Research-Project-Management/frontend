/**
 * ModernWorkbenchLayout.tsx
 *
 * Modern 4-Slot Workbench Layout for Flux Editor (Block 7 UI Shell Cut-over).
 *
 * Replaces the monolithic 845-line layout with a decoupled, declarative shell:
 * - Assembles TopBar, SideBar, EditorColumn, Viewer, and Modals into WorkbenchShell.
 * - Powered by `useLayoutStore` and `useSettingsStore`.
 * - Handles Overleaf-parity command bus events (Word Count, Deleted Files, Settings).
 */

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useShallow } from 'zustand/react/shallow';

import { WorkbenchShell } from '../../../workbench/WorkbenchShell';
import Topbar from '../../../components/topbar/Topbar';
import SideBar from '../../../components/sidebar/SideBar';
import { EditorColumn } from './EditorColumn';
import { filesQuery } from '../../../hooks/use-core';
import { usePageStore, useSettingsStore } from '../../../store';
import { useEditorInstance, editorCommandBus } from '../../../core';

const Viewer = dynamic(() => import('../../../components/viewer/Viewer'), { ssr: false });
const ProjectSettingsModal = dynamic(
  () => import('../../../components/modals/ProjectSettingsModal'),
  { ssr: false }
);
const DeletedFilesModal = dynamic(
  () => import('../../../components/modals/DeletedFilesModal'),
  { ssr: false }
);
const WordCountDialog = dynamic(
  () => import('../../../components/editor/subcomponents/WordCountDialog').then((mod) => mod.WordCountDialog),
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
    sidebarWidth,
    editorFlex,
    settingsPanelOpen,
    activeSidebarPanel,
    setActiveSidebarPanel,
  } = useSettingsStore(
    useShallow((s) => ({
      layout: s.layout,
      sidebarWidth: s.sidebarWidth,
      editorFlex: s.editorFlex,
      settingsPanelOpen: s.settingsPanelOpen,
      activeSidebarPanel: s.activeSidebarPanel,
      setActiveSidebarPanel: s.setActiveSidebarPanel,
    }))
  );

  const [wordCountOpen, setWordCountOpen] = useState(false);
  const [deletedFilesOpen, setDeletedFilesOpen] = useState(false);

  const currentPage = usePageStore((s) => s.currentPage);
  const activeFilePage = usePageStore((s) => s.activeFilePage);
  const currentDoc = activeFilePage || currentPage;

  // Query server files for WordCount modal when opened
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

  // Subscribe to command bus dialog events
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

    return () => {
      unsubCmd();
      unsubClose();
    };
  }, []);

  const isEditorOnly = layout === 'editor-only';
  const isViewerOnly = layout === 'viewer-only';

  return (
    <>
      <WorkbenchShell
        topBar={<Topbar />}
        leftSidebar={
          <SideBar
            activePanel={activeSidebarPanel}
            onActivePanelChange={setActiveSidebarPanel}
          />
        }
        editor={!isViewerOnly ? <EditorColumn /> : null}
        preview={!isEditorOnly ? <Viewer /> : null}
      />

      {/* ── Global Modals & Dialogs ────────────────────────────────────────── */}
      {settingsPanelOpen && <ProjectSettingsModal />}

      {wordCountOpen && (
        <WordCountDialog
          open={wordCountOpen}
          onClose={() => setWordCountOpen(false)}
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
          onInsertSnippet={(snippet) => engine?.insertText(snippet)}
        />
      )}

      {deletedFilesOpen && (
        <DeletedFilesModal
          open={deletedFilesOpen}
          onOpenChange={setDeletedFilesOpen}
          pageId={rootPageId || (currentPage as any)?.id || ''}
        />
      )}
    </>
  );
}

export default ModernWorkbenchLayout;
