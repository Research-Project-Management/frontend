/**
 * useTemplateGallery.ts
 *
 * GoF Virtual Proxy (`list` summaries + lazy `getById` multi-file detail)
 * + Command / Template Method (`runCmd`) for Pages Template Gallery.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  usePageStore,
  useSettingsStore,
  resolveEditorScopeFromState,
  PERSONAL_SPACE_PARAM,
} from '@/features/editor/core';
import {
  templatesApi,
  type TemplateCategory,
  type TemplateFileItem,
  type TemplateScope,
  type TemplateSummary,
} from '@/features/editor/sdk/pages/templates.client';

export type GalleryCategoryFilter = 'all' | TemplateCategory;
export type GalleryScopeFilter = 'all' | TemplateScope;

export interface UseTemplateGalleryOptions {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  spaceId?: string;
  initialCategory?: string;
}

interface GalleryCommand {
  id: string;
  loadingMsg?: string;
  successMsg: string;
  errorMsg: string;
  run: () => Promise<void>;
}

const QUERY_ROOT = 'page-templates';
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(v?: string | null): v is string {
  return Boolean(v && UUID_RE.test(v));
}

export function useTemplateGallery(opts: UseTemplateGalleryOptions = {}) {
  const router = useRouter();
  const queryClient = useQueryClient();

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

  // Canonical Coordinate Model (spaceId -> pageId)
  const storeSpaceId = usePageStore((s) => resolveEditorScopeFromState(s).spaceId);
  const storeSpaceKind = usePageStore((s) => resolveEditorScopeFromState(s).spaceKind);
  const pageId = usePageStore((s) => resolveEditorScopeFromState(s).rootPageId);
  const activeTitle = usePageStore(
    (s) => s.workspaceTitle || s.currentPage?.title,
  );

  const spaceId = opts.spaceId || storeSpaceId || PERSONAL_SPACE_PARAM;
  const validSpaceUuid = isUuid(spaceId) ? spaceId : undefined;
  const isProjectSpace =
    Boolean(validSpaceUuid) &&
    (opts.spaceId ? opts.spaceId !== PERSONAL_SPACE_PARAM : storeSpaceKind === 'project');
  const canPublishPage = !isControlled && isUuid(pageId);

  const [category, setCategory] = useState<GalleryCategoryFilter>(
    (opts.initialCategory as GalleryCategoryFilter) || 'all',
  );
  const [scope, setScope] = useState<GalleryScopeFilter>('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewPath, setPreviewPath] = useState<string>('');
  const [busy, setBusy] = useState(false);

  // Inline Flat Precision publish bar state
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishName, setPublishName] = useState('');
  const [publishCategory, setPublishCategory] =
    useState<TemplateCategory>('other');
  const [publishScope, setPublishScope] = useState<'personal' | 'project'>(
    'personal',
  );

  useEffect(() => {
    if (open && opts.initialCategory) {
      setCategory(opts.initialCategory as GalleryCategoryFilter);
    }
    if (!open) {
      setPublishOpen(false);
    }
  }, [open, opts.initialCategory]);

  // Virtual Proxy Stage 1: Lightweight summary list (0 blob bytes)
  const { data: rawItems = [], isLoading: loadingList } = useQuery({
    queryKey: [QUERY_ROOT, 'list', category, search, validSpaceUuid],
    queryFn: () =>
      templatesApi.list({
        category: category === 'all' ? undefined : category,
        search: search.trim() || undefined,
        spaceId: validSpaceUuid,
      }),
    enabled: open,
    staleTime: 2 * 60_000,
  });

  const items = useMemo(() => {
    if (scope === 'all') return rawItems;
    return rawItems.filter((t) => t.scope === scope);
  }, [rawItems, scope]);

  const selected: TemplateSummary | null = useMemo(() => {
    if (items.length === 0) return null;
    if (selectedId) {
      const hit = items.find((t) => t.id === selectedId);
      if (hit) return hit;
    }
    return items[0];
  }, [items, selectedId]);

  // Virtual Proxy Stage 2: On-demand full file manifest for selected template
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
      setPreviewPath('');
      return;
    }
    if (files.length === 0) {
      setPreviewPath(selected.mainFile);
      return;
    }
    if (!files.some((f) => f.path === previewPath)) {
      const mainHit =
        files.find((f) => f.path === selected.mainFile) ?? files[0];
      setPreviewPath(mainHit.path);
    }
  }, [selected, files, previewPath]);

  const activeFile: TemplateFileItem | null = useMemo(() => {
    if (files.length === 0) return null;
    return files.find((f) => f.path === previewPath) ?? files[0];
  }, [files, previewPath]);

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

  const instantiate = useCallback(async () => {
    if (!selected || !spaceId) return;

    await runCmd({
      id: 'instantiate-template',
      loadingMsg: `Creating page from "${selected.name}"…`,
      successMsg: `Created "${selected.name}"`,
      errorMsg: 'Failed to create page from template',
      run: async () => {
        const res = await templatesApi.instantiate(spaceId, selected.id, {
          title: selected.name,
        });
        await queryClient.invalidateQueries({ queryKey: ['pages'] });
        setOpen(false);
        const dest = res.isPersonal
          ? `/pages/${res.pageId}`
          : `/projects/${res.spaceId}/pages/${res.pageId}`;
        router.push(dest);
      },
    });
  }, [queryClient, router, runCmd, selected, setOpen, spaceId]);

  const existingForPage = useMemo(() => {
    if (!isUuid(pageId)) return null;
    return (
      rawItems.find(
        (t) => t.sourcePageId === pageId && t.scope === publishScope,
      ) ?? null
    );
  }, [pageId, publishScope, rawItems]);

  const openPublishBar = useCallback(() => {
    const defaultScope: 'personal' | 'project' = isProjectSpace
      ? 'project'
      : 'personal';
    const existing = rawItems.find(
      (t) => t.sourcePageId === pageId && t.scope === defaultScope,
    );
    const baseTitle = activeTitle?.replace(/\.tex$/i, '').trim() || 'Untitled';
    setPublishScope(defaultScope);
    setPublishName(existing?.name || `${baseTitle} Template`);
    setPublishCategory(
      existing?.category || (category !== 'all' ? category : 'other'),
    );
    setPublishOpen(true);
  }, [activeTitle, category, isProjectSpace, pageId, rawItems]);

  const publishCurrentPage = useCallback(async () => {
    if (!isUuid(pageId) || !publishName.trim()) return;

    await runCmd({
      id: 'publish-template',
      loadingMsg: existingForPage
        ? 'Updating published template…'
        : 'Saving page as template…',
      successMsg: existingForPage
        ? 'Template version updated'
        : 'Saved template to gallery',
      errorMsg: 'Failed to save template',
      run: async () => {
        const saved = await templatesApi.publish({
          pageId,
          name: publishName.trim(),
          category: publishCategory,
          scope: publishScope,
        });
        await queryClient.invalidateQueries({ queryKey: [QUERY_ROOT] });
        setSelectedId(saved.id);
        setPublishOpen(false);
      },
    });
  }, [
    existingForPage,
    pageId,
    publishCategory,
    publishName,
    publishScope,
    queryClient,
    runCmd,
  ]);

  const deleteSelected = useCallback(async () => {
    if (!selected || !selected.isCustom) return;
    await runCmd({
      id: 'delete-template',
      loadingMsg: 'Removing template…',
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
    isProjectSpace,
    canPublishPage,
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
    setPreviewPath,
    loadingList,
    loadingDetail,
    busy,
    publishOpen,
    setPublishOpen,
    publishName,
    setPublishName,
    publishCategory,
    setPublishCategory,
    publishScope,
    setPublishScope,
    existingForPage,
    openPublishBar,
    instantiate,
    publishCurrentPage,
    deleteSelected,
  };
}
