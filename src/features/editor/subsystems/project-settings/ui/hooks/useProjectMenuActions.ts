/**
 * useProjectMenuActions.ts
 *
 * Project menu drawer state, file/page queries, export, template publishing,
 * page duplication, and cache-clearing actions for ProjectSettingsModal.
 */

import { useState, useMemo, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSettingsStore } from '@/features/editor/core/store/settings.store';
import { usePageStore } from '@/features/editor/core/store/editor.store';
import { useCompileStore } from '@/features/editor/subsystems/compiler/coordinator/compiler.store';
import { editorCommandBus } from '@/features/editor/core/bus/command-bus';
import { filesQuery, pageQuery } from '@/features/editor/core/queries/document.queries';
import { usePageActions } from '@/features/editor/core/queries/usePageActions';
import { useProjectExport } from '@/features/editor/core/hooks/useExport';
import { useGithubSync } from '@/features/editor/subsystems/project-settings/ui/hooks/useGithubSync';
import { useEditorInstance } from '@/features/editor/core/bus/useEditorInstance';
import { extractProjectId } from '@/features/editor/domain/types/core.types';
import { normalizeVirtualPath } from '@/features/editor/domain/document/document-naming';
import { DEFAULT_MAIN_FILE } from '@/features/editor/domain/constants/editor.constants';
import { pagesService } from '@/features/editor/sdk/pages.service';

export type MenuView = 'menu' | 'github' | 'references' | 'dictionary';

export function useProjectMenuActions() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const params = useParams<{ pageId?: string; projectId?: string }>();
  const currentPage = usePageStore((s) => s.currentPage);
  const storeParentPageId = usePageStore((s) => s.parentPageId);
  const activeFilePage = usePageStore((s) => s.activeFilePage);
  const storeProjectId = usePageStore((s) => s.projectId);
  const spaceId = usePageStore((s) => s.spaceId);
  const { getContent } = useEditorInstance();
  const pdfUrl = useCompileStore((s) => s.pdfUrl);

  const pageId = params?.pageId || storeParentPageId || currentPage?.id;
  const rawProjectId =
    params?.projectId || spaceId || params?.pageId || storeProjectId || currentPage?.id;
  const effectiveProjectId = extractProjectId(currentPage) || rawProjectId || '';
  const projectTitle = currentPage?.title || 'manuscript';

  const settingsPanelOpen = useSettingsStore((s) => s.settingsPanelOpen);
  const setSettingsPanelOpen = useSettingsStore((s) => s.setSettingsPanelOpen);
  const settingsActiveTab = useSettingsStore((s) => s.settingsActiveTab);
  const setSettingsActiveTab = useSettingsStore((s) => s.setSettingsActiveTab);
  const storeMainFilePath = usePageStore((s) => s.mainFilePath);
  const setMainDocument = usePageStore((s) => s.setMainDocument);

  const [currentView, setCurrentView] = useState<MenuView>('menu');
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [isCopyingPage, setIsCopyingPage] = useState(false);
  const [isClearingCache, setIsClearingCache] = useState(false);

  useEffect(() => {
    if (settingsActiveTab === 'github') {
      setCurrentView('github');
    } else if (settingsActiveTab === 'references') {
      setCurrentView('references');
    } else {
      setCurrentView('menu');
    }
  }, [settingsActiveTab, settingsPanelOpen]);

  useEffect(() => {
    const unsub = editorCommandBus.subscribe('dialog:open', (cmd) => {
      if (cmd.dialog === 'project-settings') {
        const targetView =
          (cmd.payload?.view as MenuView) ||
          (cmd.payload?.initialTab as MenuView) ||
          'menu';
        if (targetView === 'github' || targetView === 'references' || targetView === 'dictionary') {
          setCurrentView(targetView);
          if (targetView === 'github') setSettingsActiveTab('github');
          else if (targetView === 'references') setSettingsActiveTab('references');
        } else {
          setCurrentView('menu');
          setSettingsActiveTab('editor');
        }
        setSettingsPanelOpen(true);
      }
    });
    return unsub;
  }, [setSettingsActiveTab, setSettingsPanelOpen]);

  const { downloadPdf, exportZip, exportArxiv, isExporting } = useProjectExport();

  const storeGithubLink = usePageStore((s) => s.githubLink);
  const { linkData: githubLinkData } = useGithubSync({
    projectId: effectiveProjectId,
    projectTitle,
    enabled: Boolean(effectiveProjectId && settingsPanelOpen),
    fetchRepos: false,
  });
  const effectiveGithubLink = githubLinkData?.link ?? storeGithubLink;

  const { data: projectFiles } = useQuery({
    ...filesQuery(pageId ?? effectiveProjectId),
    enabled: Boolean((pageId || effectiveProjectId) && settingsPanelOpen),
  });

  const { data: parentPage } = useQuery({
    ...pageQuery(pageId ?? ''),
    enabled: Boolean(pageId && settingsPanelOpen),
  });

  const {
    setMainFile: setMainFileMutation,
    duplicatePage: duplicatePageMutation,
  } = usePageActions();

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
    if (targetFile && (pageId || effectiveProjectId)) {
      setMainFileMutation.mutate(
        {
          pageId: pageId || effectiveProjectId,
          fileId: targetFile.docId || targetFile.id,
          projectId: effectiveProjectId,
        },
        { onError },
      );
    } else if (
      (pageId || effectiveProjectId) &&
      parentPage &&
      (normalizeVirtualPath(parentPage.path || parentPage.title || '') === normalizedNewMain ||
        normalizedNewMain === 'main.tex')
    ) {
      setMainFileMutation.mutate(
        {
          pageId: pageId || effectiveProjectId,
          fileId: parentPage.id,
          projectId: effectiveProjectId,
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
        addTexCandidate(fallbackRaw.toLowerCase().endsWith('.tex') ? fallbackRaw : `${fallbackRaw}.tex`);
      }
    }
    if (list.length === 0) list.push('main.tex');
    return list;
  }, [storeMainFilePath, parentPage?.path, parentPage?.title, projectFiles]);

  const bibFiles = useMemo(() => {
    const list: string[] = [];
    if (projectFiles && Array.isArray(projectFiles)) {
      (projectFiles as Array<{ title?: string; name?: string; filename?: string }>).forEach((f) => {
        const name = f.title || f.name || f.filename;
        if (typeof name === 'string' && name.toLowerCase().endsWith('.bib') && !list.includes(name)) {
          list.push(name);
        }
      });
    }
    if (list.length === 0) list.push('references.bib');
    return list;
  }, [projectFiles]);

  const handleSaveAsTemplate = async () => {
    if (!effectiveProjectId) {
      toast.info('No active project found to save as template.', { id: 'save-template' });
      return;
    }
    setIsSavingTemplate(true);
    const toastId = toast.loading('Saving project as custom template...');
    try {
      const mainContent =
        getContent() ||
        (typeof parentPage?.content === 'string' ? parentPage.content : '') ||
        `\\documentclass{article}\n\\begin{document}\n\\title{${projectTitle}}\n\\maketitle\n\\end{document}`;
      const targetMainFile = usePageStore.getState().mainFilePath || DEFAULT_MAIN_FILE;
      await pagesService.templates.createCustom({
        projectId: effectiveProjectId,
        name: `${projectTitle} Template`,
        description: `Custom template saved from ${projectTitle}`,
        category: 'Academic',
        mainFile: targetMainFile,
        files: { [targetMainFile]: mainContent },
      });
      queryClient.invalidateQueries({ queryKey: ['manuscript-templates'] });
      toast.success('Project saved to Template Gallery!', { id: toastId });
    } catch (err: unknown) {
      toast.error((err as Error)?.message || 'Failed to save custom template', { id: toastId });
    } finally {
      setIsSavingTemplate(false);
    }
  };

  const handleMakeCopy = async () => {
    const targetPageId = pageId || currentPage?.id;
    if (!targetPageId) {
      toast.info('No active page found to duplicate.', { id: 'duplicate-page' });
      return;
    }
    const toastId = toast.loading('Duplicating page...');
    setIsCopyingPage(true);
    try {
      const res = (await duplicatePageMutation.mutateAsync(targetPageId)) as {
        page?: { id?: string };
        rootPageId?: string;
        id?: string;
      } | null;
      const newPageId = res?.page?.id || res?.rootPageId || res?.id;
      toast.success('Page duplicated successfully!', { id: toastId });
      setSettingsPanelOpen(false);
      if (newPageId) {
        const isPersonal =
          !effectiveProjectId ||
          effectiveProjectId === 'personal' ||
          effectiveProjectId === targetPageId;
        router.push(
          isPersonal
            ? `/pages/${newPageId}`
            : `/projects/${effectiveProjectId}/pages/${newPageId}`,
        );
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to duplicate page';
      toast.error(message, { id: toastId });
    } finally {
      setIsCopyingPage(false);
    }
  };

  const handleClearCache = async () => {
    const scratchTargetId = pageId || currentPage?.id || spaceId || effectiveProjectId;
    if (!scratchTargetId) {
      toast.info('No active manuscript found to clear cache.', { id: 'clear-cache' });
      return;
    }

    setIsClearingCache(true);
    try {
      const res = await pagesService.compiler.cleanAuxFiles(scratchTargetId);
      if (res && res.success === false) {
        throw new Error('Failed to clear cached files');
      }
      toast.success('Cached files cleared. You can recompile whenever ready.', { id: 'clear-cache' });
    } catch (err: unknown) {
      toast.error((err as Error)?.message || 'Failed to clear cached files', { id: 'clear-cache' });
    } finally {
      setIsClearingCache(false);
    }
  };

  const handleDownloadZip = () => {
    const rootId = pageId || effectiveProjectId || currentPage?.id;
    if (!rootId) {
      toast.info('No active project found to export.', { id: 'export-zip' });
      return;
    }
    exportZip({
      parentPageId: rootId,
      projectTitle,
      currentContent: getContent(),
      activeFileId: activeFilePage?.id,
      activeFileTitle: activeFilePage?.title,
    });
  };

  const handleDownloadArxiv = () => {
    const rootId = pageId || effectiveProjectId || currentPage?.id;
    if (!rootId) {
      toast.info('No active project found to export.', { id: 'export-arxiv' });
      return;
    }
    exportArxiv({
      parentPageId: rootId,
      projectTitle,
      currentContent: getContent(),
      activeFileId: activeFilePage?.id,
      activeFileTitle: activeFilePage?.title,
    });
  };

  const handleDownloadPdf = () => {
    downloadPdf(pdfUrl, projectTitle);
  };

  const handleOpenWordCount = () => {
    setSettingsPanelOpen(false);
    editorCommandBus.dispatch({ type: 'dialog:open', dialog: 'word-count' });
  };

  const handleOpenShortcuts = () => {
    setSettingsPanelOpen(false);
    editorCommandBus.dispatch({ type: 'dialog:open', dialog: 'shortcuts' });
  };

  return {
    effectiveProjectId,
    projectTitle,
    settingsPanelOpen,
    setSettingsPanelOpen,
    setSettingsActiveTab,
    currentView,
    setCurrentView,
    effectiveGithubLink,
    texFiles,
    bibFiles,
    isExporting,
    isSavingTemplate,
    isCopyingPage,
    isClearingCache,
    handleMainFileChange,
    handleSaveAsTemplate,
    handleMakeCopy,
    handleClearCache,
    handleDownloadZip,
    handleDownloadArxiv,
    handleDownloadPdf,
    handleOpenWordCount,
    handleOpenShortcuts,
  };
}
