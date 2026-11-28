'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PanelLeft } from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@/shared/lib/logger';
import { pagesService } from '@/features/editor/core';
import {
  pagesQueryOptions,
  trashPagesQueryOptions,
  usePageActions,
  pageKeys,
} from './hooks/use-page';
import { useWorkspaceContextStore } from '@/features/shell/store/workspace-context.store';
import { Topbar } from './components/layout/Topbar';
import { PagesSidebar, type PagesFilterTab } from './components/layout/PagesSidebar';
import { PagesEmptyState } from './components/layout/PagesEmptyState';
import { GridView } from './components/views/GridView';
import { ListView } from './components/views/ListView';
import { TrashView } from './components/views/TrashView';
import type { Page, PagesViewMode } from './types/page.types';
import { buildPageEditorHref } from './utils/page-url';
import {
  useProjectLabels,
  useLabels,
  useCreateProjectLabel,
  useCreateLabel,
} from '@/features/projects/project-id/settings/hooks/use-label';
import { PageLayout, PageContent } from '@/shared/components/layout/PageLayout';
import {
  WorkspaceCardGridSkeleton,
  WorkspaceRowListSkeleton,
  WorkspaceViewTransition,
} from '@/shared/components/layout/WorkspaceSkeleton';
import { PlaneErrorState } from '@/shared/components/ui/PlaneErrorState';
import { MEDIA_QUERY_TABLET, subscribeMediaQuery } from '@/shared/hooks/use-media-query';
import { STORAGE_KEYS } from '@/config/storage-keys';
import { APP_EVENTS, onAppEvent } from '@/config/events';

const CreateModal = dynamic(
  () => import('./components/modals/CreateModal').then((m) => m.CreateModal),
  { ssr: false }
);
const EditModal = dynamic(
  () => import('./components/modals/EditModal').then((m) => m.EditModal),
  { ssr: false }
);
const TemplateGalleryModal = dynamic(
  () =>
    import(
      '@/features/editor/subsystems/explorer/ui/modals/TemplateGalleryModal'
    ).then((m) => m.TemplateGalleryModal),
  { ssr: false },
);
const ImportDocumentModal = dynamic(
  () => import('./components/modals/ImportDocumentModal').then((m) => m.ImportDocumentModal),
  { ssr: false }
);
const ImportGithubModal = dynamic(
  () => import('./components/modals/ImportGithubModal').then((m) => m.ImportGithubModal),
  { ssr: false }
);

const FILTER_VIEW_LABELS: Record<PagesFilterTab, string> = {
  all: 'All pages',
  archived: 'Archived',
  uncategorized: 'Uncategorized',
  trash: 'Trash',
};

export function PagesView({ spaceId: propSpaceId }: { spaceId?: string } = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams() as { projectId?: string };
  const [viewMode, setViewMode] = useState<PagesViewMode>('grid');
  const [activeFilter, setActiveFilter] = useState<PagesFilterTab>('all');
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [mounted, setMounted] = useState(false);

  const activeSpace = useWorkspaceContextStore((s) => s.activeSpace);

  const isProjectMode = Boolean(
    propSpaceId ||
      params?.projectId ||
      (activeSpace.type === 'project' && activeSpace.projectId)
  );

  // Sync sidebar visibility & responsive behavior matching ProjectLayout
  useEffect(() => {
    setMounted(true);
    const isMobile = window.innerWidth < 1024;
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PAGES_SIDEBAR_VISIBLE);
      if (saved !== null) {
        setIsSidebarVisible(isMobile ? false : saved === 'true');
        return;
      }
    } catch {
      // ignore
    }

    setIsSidebarVisible(!isMobile);

    return subscribeMediaQuery(MEDIA_QUERY_TABLET, (matches) => {
      setIsSidebarVisible(!matches);
    });
  }, []);

  useEffect(() => {
    if (window.innerWidth < 1024) {
      setIsSidebarVisible(false);
    }
  }, [pathname]);

  useEffect(() => {
    const handleToggleEvent = () => {
      setIsSidebarVisible((prev) => !prev);
    };
    return onAppEvent(APP_EVENTS.TOGGLE_PAGES_SIDEBAR, handleToggleEvent);
  }, []);

  const handleToggleSidebar = (visible: boolean) => {
    setIsSidebarVisible(visible);
    try {
      if (window.innerWidth >= 1024) {
        localStorage.setItem(STORAGE_KEYS.PAGES_SIDEBAR_VISIBLE, String(visible));
      }
    } catch {
      // ignore
    }
  };

  const spaceId = useMemo(() => {
    if (propSpaceId) return propSpaceId;
    if (params?.projectId) return params.projectId;
    if (activeSpace.type === 'project' && activeSpace.projectId) {
      return activeSpace.projectId;
    }
    return '';
  }, [propSpaceId, params?.projectId, activeSpace.type, activeSpace.projectId]);

  useEffect(() => {
    if (!propSpaceId && !params?.projectId && activeSpace.type === 'project' && spaceId) {
      router.replace(`/projects/${spaceId}/pages`);
    }
  }, [propSpaceId, params?.projectId, activeSpace.type, spaceId, router]);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingPage, setEditingPage] = useState<Page | null>(null);
  const [isTemplatePickerOpen, setIsTemplatePickerOpen] = useState(false);
  const [templatePickerCategory, setTemplatePickerCategory] = useState<string>('all');
  const [isImportDocModalOpen, setIsImportDocModalOpen] = useState(false);
  const [importDocFormat, setImportDocFormat] = useState<'docx' | 'md'>('docx');
  const [isImportGithubOpen, setIsImportGithubOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [templateType, setTemplateType] = useState<'blank' | 'example'>('blank');
  const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const isTrashTab = activeFilter === 'trash';
  const effectiveSpaceId = spaceId || 'personal';

  const {
    data: pages = [],
    isLoading: isPagesLoading,
    isError: isPagesError,
    error: pagesError,
  } = useQuery(pagesQueryOptions(effectiveSpaceId));

  const {
    data: trashPages = [],
    isLoading: isTrashLoading,
    isError: isTrashError,
    error: trashError,
  } = useQuery(trashPagesQueryOptions(effectiveSpaceId, isTrashTab));

  const isLoading = isTrashTab ? isTrashLoading : isPagesLoading;
  const isError = isTrashTab ? isTrashError : isPagesError;
  const error = isTrashTab ? trashError : pagesError;

  const { data: projectScopedLabels = [] } = useProjectLabels(spaceId, 'page');
  const { data: personalScopedLabels = [] } = useLabels('page', spaceId || undefined);
  const spaceLabels = spaceId ? projectScopedLabels : personalScopedLabels;

  const createProjectLabelMutation = useCreateProjectLabel(spaceId);
  const createGlobalLabelMutation = useCreateLabel();

  const handleCreateSidebarLabel = async (input: { name: string; color: string }) => {
    if (spaceId) {
      return await createProjectLabelMutation.mutateAsync({
        name: input.name,
        color: input.color,
        type: 'page',
      });
    }
    return await createGlobalLabelMutation.mutateAsync({
      name: input.name,
      color: input.color,
      type: 'page',
    });
  };

  const availableLabels = useMemo(() => {
    const map = new Map<string, { id: string; name: string; color?: string }>();
    for (const sl of spaceLabels) {
      if (sl?.id && sl?.name) {
        map.set(sl.id, { id: sl.id, name: sl.name, color: sl.color || '#0969DA' });
      }
    }
    for (const page of pages) {
      for (const l of page.labels ?? []) {
        if (l?.id && l?.name && !map.has(l.id)) {
          map.set(l.id, { id: l.id, name: l.name, color: l.color || '#0969DA' });
        }
      }
    }
    return Array.from(map.values());
  }, [pages, spaceLabels]);

  const selectedLabels = useMemo(
    () => availableLabels.filter((l) => selectedLabelIds.includes(l.id)),
    [availableLabels, selectedLabelIds]
  );

  const handleToggleLabel = (labelId: string) => {
    setSelectedLabelIds((prev) =>
      prev.includes(labelId) ? prev.filter((id) => id !== labelId) : [...prev, labelId]
    );
  };

  const filteredPages = useMemo(() => {
    if (isTrashTab) {
      if (!searchQuery.trim()) return trashPages;
      const q = searchQuery.toLowerCase();
      return trashPages.filter((page) => page.title?.toLowerCase().includes(q));
    }

    let result = pages;

    // 1. Space view filter (Active vs Archived vs Uncategorized)
    if (activeFilter === 'archived') {
      result = result.filter((page) => page.status === 'archived');
    } else {
      result = result.filter((page) => page.status !== 'archived');
      if (activeFilter === 'uncategorized') {
        result = result.filter(
          (page) => !Array.isArray(page.labels) || page.labels.length === 0
        );
      }
    }

    // 2. Label filter
    if (selectedLabelIds.length > 0) {
      result = result.filter((page) =>
        (page.labels as Array<{ id?: string; name?: string } | string> | undefined)?.some(
          (label) => {
            const lid = typeof label === 'string' ? label : label?.id || label?.name;
            return lid ? selectedLabelIds.includes(lid) : false;
          }
        )
      );
    }

    // 3. Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((page) => page.title?.toLowerCase().includes(q));
    }

    return result;
  }, [isTrashTab, trashPages, pages, activeFilter, selectedLabelIds, searchQuery]);

  const { createPage } = usePageActions();

  const handleCreate = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;

    try {
      const data = await createPage.mutateAsync({
        spaceId: effectiveSpaceId,
        title: trimmedTitle,
        status: 'draft',
        labelIds: [],
        templateType,
      });
      setIsCreateModalOpen(false);
      setTitle('');
      setTemplateType('blank');
      const targetUrl = buildPageEditorHref(
        {
          id: data.page.id,
          projectId: effectiveSpaceId,
          mainFile: data.mainFile ?? undefined,
          mainFileId: data.mainFileId,
        },
        spaceId || null,
      );
      router.push(targetUrl);
    } catch (err) {
      logger.error('[PagesView] Action failed', err);
    }
  };

  const queryClient = useQueryClient();
  const handleImportZip = async (file: File) => {
    const toastId = toast.loading(`Importing ${file.name}...`);
    try {
      const result = await pagesService.export.importZip(effectiveSpaceId, file);
      await queryClient.invalidateQueries({ queryKey: pageKeys.all });
      toast.success('Archive imported successfully', { id: toastId });
      const targetDocId = result?.rootDocId;
      if (targetDocId) {
        const isPersonalScope = !spaceId || spaceId === 'personal';
        router.push(!isPersonalScope ? `/projects/${spaceId}/pages/${targetDocId}` : `/pages/${targetDocId}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Import failed', { id: toastId });
    }
  };

  return (
    <div className="relative flex h-full min-h-0 min-w-0 w-full">
      {/* Mobile Drawer Backdrop */}
      {mounted &&
        isSidebarVisible &&
        typeof document !== 'undefined' &&
        createPortal(
          <button
            type="button"
            aria-label="Close pages sidebar"
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs lg:hidden cursor-pointer animate-in fade-in duration-200"
            onClick={() => handleToggleSidebar(false)}
          />,
          document.body
        )}

      {/* Overleaf-Inspired Collapsible Left Sidebar (Dual-Space: userId Personal vs projectId Project) */}
      <div
        className={`fixed lg:relative inset-y-0 left-0 z-50 lg:z-auto h-full overflow-hidden transition-all duration-300 ease-in-out bg-background lg:bg-transparent shrink-0 ${
          isSidebarVisible
            ? 'w-60 border-r border-border shadow-2xl lg:shadow-none'
            : 'w-0 border-r-0 pointer-events-none lg:pointer-events-auto'
        }`}
      >
        <div className="h-full w-60 bg-background lg:bg-transparent">
          <PagesSidebar
            spaceType={isProjectMode ? 'project' : 'personal'}
            activeFilter={activeFilter}
            onSelectFilter={setActiveFilter}
            labels={availableLabels}
            selectedLabelIds={selectedLabelIds}
            onToggleLabel={handleToggleLabel}
            onClearLabels={() => setSelectedLabelIds([])}
            onCreateLabel={handleCreateSidebarLabel}
            isCreatingLabel={
              createProjectLabelMutation.isPending || createGlobalLabelMutation.isPending
            }
            onToggleCollapse={() => handleToggleSidebar(false)}
          />
        </div>
      </div>

      {/* Main Content Area */}
      <div
        className="flex-1 min-w-0 flex flex-col h-full bg-transparent relative min-h-0"
        style={{ '--header-offset': !isSidebarVisible ? '46px' : '0px' } as React.CSSProperties}
      >
        {!isSidebarVisible && (
          <div className="absolute top-2 left-2.5 z-30">
            <button
              type="button"
              onClick={() => handleToggleSidebar(true)}
              aria-label="Open pages sidebar"
              title="Open pages sidebar"
              className="flex size-7 items-center justify-center rounded-md text-foreground hover:bg-muted transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
            >
              <PanelLeft className="size-4 shrink-0 text-foreground" strokeWidth={1.5} />
            </button>
          </div>
        )}

        <PageLayout>
          <Topbar
            viewMode={viewMode}
            setViewMode={setViewMode}
            activeViewLabel={FILTER_VIEW_LABELS[activeFilter]}
            onCreateClick={(template) => {
              setTemplateType(template ?? 'blank');
              setIsCreateModalOpen(true);
            }}
            onImportZip={handleImportZip}
            onOpenImportDoc={(fmt) => {
              setImportDocFormat(fmt);
              setIsImportDocModalOpen(true);
            }}
            onOpenImportGithub={() => setIsImportGithubOpen(true)}
            onOpenTemplates={(category) => {
              setTemplatePickerCategory(category);
              setIsTemplatePickerOpen(true);
            }}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            labels={availableLabels}
            selectedLabelIds={selectedLabelIds}
            onSelectLabelIds={setSelectedLabelIds}
          />

          <PageContent maxWidth="full" noPadding className="pb-8">
            {isLoading ? (
              viewMode === 'grid' ? (
                <div className="p-4 sm:p-6 pb-12 w-full">
                  <WorkspaceCardGridSkeleton variant="pages" count={8} />
                </div>
              ) : (
                <WorkspaceRowListSkeleton variant="pages" rows={8} />
              )
            ) : isError ? (
              <PlaneErrorState
                title="Unable to load pages"
                description="An issue occurred while loading pages. Please try again."
                error={error}
              />
            ) : filteredPages.length === 0 ? (
              <PagesEmptyState
                searchQuery={searchQuery}
                onClearSearch={() => setSearchQuery('')}
                variant={
                  isTrashTab
                    ? 'trash'
                    : activeFilter === 'archived'
                      ? 'archive'
                      : undefined
                }
                labelName={
                  selectedLabels.length === 1
                    ? selectedLabels[0].name
                    : selectedLabels.length > 1
                      ? `${selectedLabels.length} labels`
                      : activeFilter === 'uncategorized'
                        ? 'Uncategorized'
                        : undefined
                }
                onClearFilter={() => {
                  setSelectedLabelIds([]);
                  if (activeFilter === 'uncategorized') setActiveFilter('all');
                }}
              />
            ) : isTrashTab ? (
              <WorkspaceViewTransition>
                <TrashView pages={filteredPages} />
              </WorkspaceViewTransition>
            ) : viewMode === 'grid' ? (
              <WorkspaceViewTransition>
                <GridView pages={filteredPages} onEdit={setEditingPage} />
              </WorkspaceViewTransition>
            ) : (
              <WorkspaceViewTransition>
                <ListView pages={filteredPages} onEdit={setEditingPage} />
              </WorkspaceViewTransition>
            )}
          </PageContent>

          {isCreateModalOpen && (
            <CreateModal
              isOpen={isCreateModalOpen}
              setIsOpen={setIsCreateModalOpen}
              title={title}
              setTitle={setTitle}
              handleCreate={handleCreate}
              isCreating={createPage.isPending}
              templateType={templateType}
            />
          )}

          {editingPage && (
            <EditModal
              isOpen={!!editingPage}
              setIsOpen={(open) => {
                if (!open) setEditingPage(null);
              }}
              page={editingPage}
              spaceId={effectiveSpaceId}
              labels={spaceLabels}
            />
          )}

          {isTemplatePickerOpen && (
            <TemplateGalleryModal
              mode="project"
              open={isTemplatePickerOpen}
              onOpenChange={setIsTemplatePickerOpen}
              projectId={effectiveSpaceId}
              initialCategory={templatePickerCategory}
            />
          )}

          {isImportDocModalOpen && (
            <ImportDocumentModal
              isOpen={isImportDocModalOpen}
              setIsOpen={setIsImportDocModalOpen}
              projectId={effectiveSpaceId}
              initialFormat={importDocFormat}
            />
          )}

          {isImportGithubOpen && (
            <ImportGithubModal
              isOpen={isImportGithubOpen}
              setIsOpen={setIsImportGithubOpen}
              projectId={effectiveSpaceId}
            />
          )}
        </PageLayout>
      </div>
    </div>
  );
}

export default PagesView;
