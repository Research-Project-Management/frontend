/**
 * useTemplateGallery.ts
 *
 * GoF Virtual Proxy (`list` summaries + lazy `getById` multi-file detail)
 * + Command / Template Method (`runCmd`) + Mode Strategy (`editor` vs `project`).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  editorCommandBus,
  sessionCoordinator,
  usePageStore,
  useSettingsStore,
} from '@/features/editor/core';
import { useEditorInstance } from '@/features/editor/core/bus/useEditorInstance';
import { invalidateFileTreeQueries } from '@/features/editor/core/queries/document.queries';
import { DEFAULT_MAIN_FILE } from '@/features/editor/domain/constants/editor.constants';
import { lruDocumentCache } from '@/features/editor/domain/document/lru-document-cache';
import { clearYjsProviderPool } from '@/features/editor/sdk/realtime';
import {
  templatesApi,
  type TemplateCategory,
  type TemplateFileItem,
  type TemplateSummary,
} from '@/features/editor/sdk/pages/templates.client';

export type GalleryMode = 'editor' | 'project';

export interface UseTemplateGalleryOptions {
  mode?: GalleryMode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  projectId?: string;
  initialCategory?: string;
}

interface GalleryCommand {
  id: string;
  loadingMsg?: string;
  successMsg: string;
  errorMsg: string;
  run: () => Promise<void>;
}

const QUERY_ROOT = 'manuscript-templates';

export function useTemplateGallery(opts: UseTemplateGalleryOptions = {}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { engine } = useEditorInstance();

  const storeOpen = useSettingsStore((s) => s.isTemplateModalOpen);
  const setStoreOpen = useSettingsStore((s) => s.setIsTemplateModalOpen);

  const isControlled = opts.open !== undefined;
  const open = isControlled ? Boolean(opts.open) : storeOpen;
  const setOpen = useCallback(
    (next: boolean) => {
      if (opts.onOpenChange) opts.onOpenChange(next);
      else setStoreOpen(next);
    },
    [opts, setStoreOpen],
  );

  const mode: GalleryMode = opts.mode ?? (isControlled ? 'project' : 'editor');

  const storeSpaceId = usePageStore(
    (s) => s.spaceId || s.projectId || s.parentPageId || s.currentPage?.id || '',
  );
  const currentPageId = usePageStore((s) => s.currentPage?.id);
  const activeDocId = usePageStore((s) => s.activeFilePage?.id);
  const activeTitle = usePageStore(
    (s) => s.activeFilePage?.title || s.currentPage?.title,
  );
  const mainFilePath = usePageStore((s) => s.mainFilePath);

  const spaceId = opts.projectId || storeSpaceId;

  const [category, setCategory] = useState<string>(
    opts.initialCategory || 'all',
  );
  const [scope, setScope] = useState<'all' | 'official' | 'custom'>('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeFilePath, setActiveFilePath] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open && opts.initialCategory) {
      setCategory(opts.initialCategory);
    }
  }, [open, opts.initialCategory]);

  // 1. Virtual Proxy Stage 1: Lightweight summary list (0 blob bytes)
  const { data: rawItems = [], isLoading: loadingList } = useQuery({
    queryKey: [QUERY_ROOT, 'list', category, search, spaceId],
    queryFn: () =>
      templatesApi.list({
        category: category === 'all' ? undefined : category,
        search: search.trim() || undefined,
        spaceId: spaceId && spaceId !== 'personal' ? spaceId : undefined,
      }),
    enabled: open,
    staleTime: 2 * 60_000,
  });

  const items = useMemo(() => {
    if (scope === 'official') {
      return rawItems.filter((t) => t.visibility === 'official');
    }
    if (scope === 'custom') {
      return rawItems.filter((t) => t.visibility !== 'official');
    }
    return rawItems;
  }, [rawItems, scope]);

  const selected: TemplateSummary | null = useMemo(() => {
    if (items.length === 0) return null;
    if (selectedId) {
      const hit = items.find((t) => t.id === selectedId);
      if (hit) return hit;
    }
    return items[0];
  }, [items, selectedId]);

  // 2. Virtual Proxy Stage 2: On-demand full file manifest for selected template
  const { data: detail, isLoading: loadingDetail } = useQuery({
    queryKey: [QUERY_ROOT, 'detail', selected?.id],
    queryFn: () => templatesApi.getById(selected!.id),
    enabled: Boolean(open && selected?.id),
    staleTime: 5 * 60_000,
  });

  const files: TemplateFileItem[] = useMemo(
    () => detail?.files ?? [],
    [detail?.files],
  );

  useEffect(() => {
    if (!selected) {
      setActiveFilePath('');
      return;
    }
    if (files.length === 0) {
      setActiveFilePath(selected.mainFile);
      return;
    }
    const hasCurrent = files.some((f) => f.path === activeFilePath);
    if (!hasCurrent) {
      const mainHit =
        files.find((f) => f.path === selected.mainFile) ?? files[0];
      setActiveFilePath(mainHit.path);
    }
  }, [selected, files, activeFilePath]);

  const activeFile: TemplateFileItem | null = useMemo(() => {
    if (files.length === 0) return null;
    return files.find((f) => f.path === activeFilePath) ?? files[0];
  }, [files, activeFilePath]);

  const mainTexContent = useMemo(() => {
    if (!selected) return '';
    const main =
      files.find((f) => f.path === selected.mainFile && f.kind === 'doc') ??
      files.find((f) => f.kind === 'doc' && f.path.endsWith('.tex'));
    return main?.content ?? '';
  }, [files, selected]);

  /** GoF Template Method for guarded async UI mutations. */
  const runCmd = useCallback(async (cmd: GalleryCommand) => {
    setBusy(true);
    const toastId = cmd.loadingMsg ? toast.loading(cmd.loadingMsg) : cmd.id;
    try {
      await cmd.run();
      toast.success(cmd.successMsg, { id: toastId });
    } catch (err: unknown) {
      toast.error((err as Error)?.message || cmd.errorMsg, { id: toastId });
    } finally {
      setBusy(false);
    }
  }, []);

  const copyPreview = useCallback(() => {
    const text = activeFile?.content;
    if (!text || typeof navigator === 'undefined' || !navigator.clipboard) {
      return;
    }
    void navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success(`Copied ${activeFile.path}`, { id: 'copy-template-file' });
    setTimeout(() => setCopied(false), 2_000);
  }, [activeFile]);

  const insertIntoActiveFile = useCallback(() => {
    if (!selected || !mainTexContent) return;
    if (engine) {
      engine.setContent(mainTexContent);
      const docId = activeDocId || currentPageId;
      if (docId) {
        sessionCoordinator.notifyContentChange(docId, mainTexContent);
      }
      toast.success(`Inserted "${selected.name}" into current file`, {
        id: 'insert-template',
      });
      setOpen(false);
    }
  }, [activeDocId, currentPageId, engine, mainTexContent, selected, setOpen]);

  const scaffold = useCallback(async () => {
    if (!selected || !spaceId) return;

    await runCmd({
      id: 'scaffold-template',
      loadingMsg: `Scaffolding "${selected.name}"…`,
      successMsg: `Scaffolded "${selected.name}"`,
      errorMsg: 'Failed to scaffold template',
      run: async () => {
        if (mode === 'project') {
          const res = await templatesApi.scaffold(spaceId, selected.id, {
            title: selected.name,
          });
          await queryClient.invalidateQueries({ queryKey: ['pages'] });
          setOpen(false);
          const targetId = res.pageId || res.rootDocId;
          if (targetId) {
            const dest =
              !spaceId || spaceId === 'personal'
                ? `/pages/${targetId}`
                : `/projects/${spaceId}/pages/${targetId}`;
            router.push(dest);
          }
          return;
        }

        await templatesApi.scaffold(spaceId, selected.id, {
          pageId: currentPageId || undefined,
        });
        sessionCoordinator.resetSession();
        clearYjsProviderPool();
        lruDocumentCache.clearAll();
        if (engine && mainTexContent) {
          engine.setContent(mainTexContent);
        }
        invalidateFileTreeQueries(queryClient, {
          includeRootDoc: true,
          includeProjects: true,
        });
        editorCommandBus.dispatch({ type: 'filetree:updated' });
        setOpen(false);
      },
    });
  }, [
    currentPageId,
    engine,
    mainTexContent,
    mode,
    queryClient,
    router,
    runCmd,
    selected,
    setOpen,
    spaceId,
  ]);

  const publishCurrentPage = useCallback(async () => {
    if (!spaceId) return;
    const baseTitle = activeTitle?.replace(/\.tex$/i, '').trim() || 'Custom';
    const targetMain = (mainFilePath || DEFAULT_MAIN_FILE).replace(/^\/+/, '');
    const cat: TemplateCategory =
      category !== 'all' ? (category as TemplateCategory) : 'other';
    const isProjectSpace = Boolean(spaceId && spaceId !== 'personal');

    await runCmd({
      id: 'publish-template',
      loadingMsg: 'Publishing manuscript as template…',
      successMsg: 'Saved template to gallery',
      errorMsg: 'Failed to save template',
      run: async () => {
        const liveText = engine?.getContent();
        const saved = await templatesApi.publish({
          name: `${baseTitle} Template`,
          category: cat,
          visibility: isProjectSpace ? 'workspace' : 'private',
          description: 'Published from manuscript workspace',
          mainFile: targetMain,
          spaceId: isProjectSpace ? spaceId : undefined,
          pageId: currentPageId || undefined,
          ...(liveText ? { files: { [targetMain]: liveText } } : {}),
        });
        await queryClient.invalidateQueries({ queryKey: [QUERY_ROOT] });
        setSelectedId(saved.id);
      },
    });
  }, [
    activeTitle,
    category,
    currentPageId,
    engine,
    mainFilePath,
    queryClient,
    runCmd,
    spaceId,
  ]);

  const deleteSelected = useCallback(async () => {
    if (!selected || selected.visibility === 'official') return;
    await runCmd({
      id: 'delete-template',
      loadingMsg: 'Removing custom template…',
      successMsg: 'Template deleted',
      errorMsg: 'Failed to delete template',
      run: async () => {
        await templatesApi.remove(selected.id);
        setSelectedId(null);
        await queryClient.invalidateQueries({ queryKey: [QUERY_ROOT] });
      },
    });
  }, [queryClient, runCmd, selected]);

  return {
    open,
    setOpen,
    mode,
    spaceId,
    category,
    setCategory,
    scope,
    setScope,
    search,
    setSearch,
    items,
    selected,
    setSelectedId,
    files,
    activeFile,
    activeFilePath,
    setActiveFilePath,
    loadingList,
    loadingDetail,
    busy,
    copied,
    copyPreview,
    insertIntoActiveFile,
    scaffold,
    publishCurrentPage,
    deleteSelected,
  };
}
