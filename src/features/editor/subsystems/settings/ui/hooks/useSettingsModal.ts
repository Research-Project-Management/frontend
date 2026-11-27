/**
 * useSettingsModal.ts
 *
 * State and actions for SettingsModal (active section, main document, and cache clearing).
 */

import { useState, useMemo, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useSettingsStore } from '@/features/editor/core/store/settings.store';
import { usePageStore } from '@/features/editor/core/store/editor.store';
import { editorCommandBus } from '@/features/editor/core/bus/command-bus';
import { filesQuery, pageQuery } from '@/features/editor/core/queries/document.queries';
import { usePageActions } from '@/features/editor/core/queries/usePageActions';
import { extractProjectId } from '@/features/editor/domain/types/core.types';
import { normalizeVirtualPath } from '@/features/editor/domain/document/document-naming';

export type SettingsView = 'compiler' | 'editor' | 'github' | 'dictionary';

export function useSettingsModal() {
  const params = useParams<{ pageId?: string; projectId?: string }>();
  const currentPage = usePageStore((s) => s.currentPage);
  const storeParentPageId = usePageStore((s) => s.parentPageId);
  const storeProjectId = usePageStore((s) => s.projectId);
  const spaceId = usePageStore((s) => s.spaceId);

  const pageId = params?.pageId || storeParentPageId || currentPage?.id;
  const rawProjectId =
    params?.projectId || spaceId || params?.pageId || storeProjectId || currentPage?.id;
  const projectId = extractProjectId(currentPage) || rawProjectId || '';
  const projectTitle = currentPage?.title || 'manuscript';

  const open = useSettingsStore((s) => s.settingsPanelOpen);
  const setOpen = useSettingsStore((s) => s.setSettingsPanelOpen);
  const settingsActiveTab = useSettingsStore((s) => s.settingsActiveTab);
  const setSettingsActiveTab = useSettingsStore((s) => s.setSettingsActiveTab);
  const storeMainFilePath = usePageStore((s) => s.mainFilePath);
  const setMainDocument = usePageStore((s) => s.setMainDocument);

  const [activeView, setActiveView] = useState<SettingsView>('compiler');

  useEffect(() => {
    if (!open) {
      setActiveView('compiler');
      return;
    }
    if (
      settingsActiveTab === 'github' ||
      settingsActiveTab === 'dictionary' ||
      settingsActiveTab === 'editor'
    ) {
      setActiveView(settingsActiveTab);
    } else {
      setActiveView('compiler');
    }
  }, [settingsActiveTab, open]);

  useEffect(() => {
    const unsub = editorCommandBus.subscribe('dialog:open', (cmd) => {
      if (cmd.dialog === 'project-settings') {
        const target =
          (cmd.payload?.view as SettingsView | 'menu') ||
          (cmd.payload?.initialTab as SettingsView | 'menu') ||
          'compiler';
        if (
          target === 'github' ||
          target === 'dictionary' ||
          target === 'editor'
        ) {
          setActiveView(target);
          setSettingsActiveTab(target);
        } else {
          setActiveView('compiler');
          setSettingsActiveTab('compiler');
        }
        setOpen(true);
      }
    });
    return unsub;
  }, [setSettingsActiveTab, setOpen]);

  const { data: projectFiles } = useQuery({
    ...filesQuery(pageId ?? projectId),
    enabled: Boolean((pageId || projectId) && open),
  });

  const { data: parentPage } = useQuery({
    ...pageQuery(pageId ?? ''),
    enabled: Boolean(pageId && open),
  });

  const { setMainFile: setMainFileMutation } = usePageActions();

  const selectView = (view: SettingsView) => {
    setActiveView(view);
    setSettingsActiveTab(view);
  };

  const handleMainFileChange = (newMainFileName: string) => {
    const normalizedNewMain = normalizeVirtualPath(newMainFileName) || newMainFileName;
    const { mainFilePath: prevMainFilePath, rootDocId: prevRootDocId } =
      usePageStore.getState();
    const filesList = (projectFiles || []) as Array<{
      id: string;
      docId?: string | null;
      title?: string;
      name?: string;
      filename?: string;
      path?: string;
    }>;
    const targetFile = filesList.find(
      (f) =>
        normalizeVirtualPath(f.path || f.title || f.name || f.filename || '') ===
        normalizedNewMain,
    );
    const optimisticRootDocId =
      targetFile?.docId || targetFile?.id || parentPage?.id || prevRootDocId;
    setMainDocument({
      rootDocId: optimisticRootDocId,
      mainFilePath: normalizedNewMain,
    });
    const onError = () => {
      setMainDocument({
        rootDocId: prevRootDocId,
        mainFilePath: prevMainFilePath,
      });
    };
    if (targetFile && (pageId || projectId)) {
      setMainFileMutation.mutate(
        {
          pageId: pageId || projectId,
          fileId: targetFile.docId || targetFile.id,
          projectId,
        },
        { onError },
      );
    } else if (
      (pageId || projectId) &&
      parentPage &&
      (normalizeVirtualPath(parentPage.path || parentPage.title || '') === normalizedNewMain ||
        normalizedNewMain === 'main.tex')
    ) {
      setMainFileMutation.mutate(
        {
          pageId: pageId || projectId,
          fileId: parentPage.id,
          projectId,
        },
        { onError },
      );
    }
  };

  const texFiles = useMemo(() => {
    const list: string[] = [];
    const addTexCandidate = (raw?: string | null) => {
      if (typeof raw !== 'string') return;
      const clean = normalizeVirtualPath(raw);
      if (clean && clean.toLowerCase().endsWith('.tex') && !list.includes(clean)) {
        list.push(clean);
      }
    };
    addTexCandidate(storeMainFilePath);
    if (projectFiles && Array.isArray(projectFiles)) {
      (
        projectFiles as Array<{
          title?: string;
          name?: string;
          filename?: string;
          path?: string;
        }>
      ).forEach((f) => {
        addTexCandidate(f.path || f.title || f.name || f.filename);
      });
    }
    if (list.length === 0 && (parentPage?.path || parentPage?.title)) {
      const fallbackRaw = normalizeVirtualPath(parentPage.path || parentPage.title || '');
      if (fallbackRaw) {
        addTexCandidate(
          fallbackRaw.toLowerCase().endsWith('.tex') ? fallbackRaw : `${fallbackRaw}.tex`,
        );
      }
    }
    if (list.length === 0) list.push('main.tex');
    return list;
  }, [storeMainFilePath, parentPage?.path, parentPage?.title, projectFiles]);

  return {
    pageId: pageId || projectId,
    projectId,
    pageTitle: projectTitle,
    open,
    setOpen,
    activeView,
    selectView,
    texFiles,
    handleMainFileChange,
  };
}
