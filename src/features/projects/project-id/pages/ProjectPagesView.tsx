'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PanelLeft } from 'lucide-react';
import { toast } from 'sonner';
import { manuscriptService } from '@/features/editor/core';
import { projectPagesQueryOptions, usePageActions, pageKeys } from './hooks/use-page';
import { useProjectsQuery, useProjectQuery } from '@/features/projects/shell/hooks/use-project';
import { useWorkspaceContextStore } from '@/features/shell/store/workspace-context.store';
import { Topbar } from './components/layout/Topbar';
import { PagesSidebar, type PagesFilterTab } from './components/layout/PagesSidebar';
import { PagesEmptyState } from './components/layout/PagesEmptyState';
import { GridView } from './components/views/GridView';
import { ListView } from './components/views/ListView';
import type { Page, PagesViewMode } from './types/page.types';
import {
  useProjectLabels,
  useLabels,
  useCreateProjectLabel,
  useCreateLabel,
} from '../settings/hooks/use-label';
import { PageLayout, PageContent } from '@/shared/components/layout/PageLayout';
import {
  WorkspaceCardGridSkeleton,
  WorkspaceRowListSkeleton,
  WorkspaceViewTransition,
} from '@/shared/components/layout/WorkspaceSkeleton';
import { PlaneErrorState } from '@/shared/components/ui/PlaneErrorState';

const CreateModal = dynamic(
  () => import('./components/modals/CreateModal').then((m) => m.CreateModal),
  { ssr: false }
);
const EditModal = dynamic(
  () => import('./components/modals/EditModal').then((m) => m.EditModal),
  { ssr: false }
);
const TemplatePickerDialog = dynamic(
  () => import('./components/modals/TemplatePickerDialog').then((m) => m.TemplatePickerDialog),
  { ssr: false }
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
};

export function ProjectPagesView({ projectId: propProjectId }: { projectId?: string } = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams() as { projectId?: string };
  const [viewMode, setViewMode] = useState<PagesViewMode>('grid');
  const [activeFilter, setActiveFilter] = useState<PagesFilterTab>('all');
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [mounted, setMounted] = useState(false);

  // Load workspace projects & active space (userId Personal Space vs projectId Project Space)
  const { projects = [] } = useProjectsQuery();
  const activeSpace = useWorkspaceContextStore((s) => s.activeSpace);

  const isProjectMode = Boolean(
    propProjectId ||
      params?.projectId ||
      (activeSpace.type === 'project' && activeSpace.projectId)
  );

  // Sync sidebar visibility & responsive behavior matching ProjectLayout
  useEffect(() => {
    setMounted(true);
    const isMobile = window.innerWidth < 1024;
    try {
      const saved = localStorage.getItem('flux:pages-sidebar-visible');
      if (saved !== null) {
        setIsSidebarVisible(isMobile ? false : saved === 'true');
        return;
      }
    } catch {
      // ignore
    }

    setIsSidebarVisible(!isMobile);

    const media = window.matchMedia('(max-width: 1023px)');
    const syncSidebar = () => {
      setIsSidebarVisible(!media.matches);
    };

    media.addEventListener('change', syncSidebar);
    return () => media.removeEventListener('change', syncSidebar);
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
    window.addEventListener('toggle-pages-sidebar', handleToggleEvent);
    return () => window.removeEventListener('toggle-pages-sidebar', handleToggleEvent);
  }, []);

  const handleToggleSidebar = (visible: boolean) => {
    setIsSidebarVisible(visible);
    try {
      if (window.innerWidth >= 1024) {
        localStorage.setItem('flux:pages-sidebar-visible', String(visible));
      }
    } catch {
      // ignore
    }
  };

  // Resolve effective project ID based on URL or activeSpace (never leak projects[0] into Personal Space)
  const resolvedProjectId = useMemo(() => {
    if (propProjectId) return propProjectId;
    if (params?.projectId) return params.projectId;
    if (activeSpace.type === 'project' && activeSpace.projectId) {
      return activeSpace.projectId;
    }
    return '';
  }, [propProjectId, params?.projectId, activeSpace.type, activeSpace.projectId]);

  const projectId = resolvedProjectId;

  // Auto-redirect /pages to /projects/[projectId]/pages ONLY when in Project Space
  useEffect(() => {
    if (!propProjectId && !params?.projectId && activeSpace.type === 'project' && projectId) {
      router.replace(`/projects/${projectId}/pages`);
    }
  }, [propProjectId, params?.projectId, activeSpace.type, projectId, router]);

  // Synchronous lookup from projects list cache
  const projectFromList = useMemo(
    () =>
      projectId
        ? projects.find(
            (p) => p.id === projectId || (p as { identifier?: string }).identifier === projectId
          )
        : null,
    [projects, projectId]
  );

  const projectState = useProjectQuery(projectId, {
    enabled: Boolean(projectId && !projectFromList?.name),
  });

  const currentProject = useMemo(() => {
    if (projectFromList) return projectFromList;
    if (projectState?.project) return projectState.project;
    return projectId ? { id: projectId, name: '', avatar: null } : undefined;
  }, [projectFromList, projectState?.project, projectId]);

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

  const {
    data: pages = [],
    isLoading,
    isError,
    error,
  } = useQuery(projectPagesQueryOptions(projectId || 'personal'));

  // Dual-space labels: Project labels when projectId is available, otherwise Personal/Global labels
  const { data: projectScopedLabels = [] } = useProjectLabels(projectId);
  const { data: personalScopedLabels = [] } = useLabels(undefined, projectId || undefined);
  const projectLabels = projectId ? projectScopedLabels : personalScopedLabels;

  const createProjectLabelMutation = useCreateProjectLabel(projectId);
  const createGlobalLabelMutation = useCreateLabel();

  const handleCreateSidebarLabel = async (input: { name: string; color: string }) => {
    if (projectId) {
      return await createProjectLabelMutation.mutateAsync({
        name: input.name,
        color: input.color,
      });
    }
    return await createGlobalLabelMutation.mutateAsync({
      name: input.name,
      color: input.color,
      type: 'page',
    });
  };

  // Combine projectLabels and any labels embedded on pages for the sidebar & topbar filter
  const availableLabels = useMemo(() => {
    const map = new Map<string, { id: string; name: string; color?: string }>();

    for (const pl of projectLabels) {
      if (pl?.id && pl?.name) {
        map.set(pl.id, { id: pl.id, name: pl.name, color: pl.color || '#0969DA' });
      }
    }

    for (const page of pages) {
      if (Array.isArray(page.labels)) {
        for (const l of page.labels) {
          if (!l) continue;
          if (typeof l === 'string') {
            const matched = projectLabels.find(
              (pl: { id?: string; name?: string }) => pl.id === l || pl.name === l
            );
            const id = matched?.id || l;
            const name = matched?.name || l;
            const color = matched?.color || '#0969DA';
            if (!map.has(id)) {
              map.set(id, { id, name, color });
            }
          } else if (typeof l === 'object' && l !== null) {
            const labelObj = l as { id?: string; name?: string; title?: string; color?: string };
            const id = labelObj.id || labelObj.name;
            const matched = projectLabels.find((pl) => pl.id === id || pl.name === labelObj.name);
            const name = matched?.name || labelObj.name || labelObj.title || id || '';
            const color = labelObj.color || matched?.color || '#0969DA';
            if (id && !map.has(id)) {
              map.set(id, { id, name, color });
            }
          }
        }
      }
    }

    return Array.from(map.values());
  }, [pages, projectLabels]);

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
  }, [pages, activeFilter, selectedLabelIds, searchQuery]);

  const { createPage } = usePageActions();

  const handleCreate = async () => {
    const trimmedTitle = title.trim();
    const targetProjectId = projectId || 'personal';
    if (!trimmedTitle) return;

    try {
      const data = await createPage.mutateAsync({
        projectId: targetProjectId,
        title: trimmedTitle,
        status: 'active',
        labels: [],
        templateType,
      });
      setIsCreateModalOpen(false);
      setTitle('');
      setTemplateType('blank');
      const mainFileId =
        data.mainFileId ||
        (typeof data.mainFile === 'string'
          ? data.mainFile
          : (data.mainFile as { id?: string } | undefined)?.id);
      const queryStr = mainFileId ? `?file=${mainFileId}` : '';
      const isPersonalScope = !projectId || projectId === 'personal';
      const targetUrl = !isPersonalScope
        ? `/projects/${projectId}/pages/${data.page.id}${queryStr}`
        : `/pages/${data.page.id}${queryStr}`;
      router.push(targetUrl);
    } catch (err) {
      console.error(err);
    }
  };

  const queryClient = useQueryClient();
  const handleImportZip = async (file: File) => {
    const targetSpaceId = projectId || 'personal';
    const toastId = toast.loading(`Importing ${file.name}...`);
    try {
      const result = await manuscriptService.export.importProjectZip(targetSpaceId, file);
      await queryClient.invalidateQueries({ queryKey: pageKeys.all });
      toast.success('Project imported successfully', { id: toastId });
      const targetDocId = result?.rootDocId;
      if (targetDocId) {
        const isPersonalScope = !projectId || projectId === 'personal';
        router.push(!isPersonalScope ? `/projects/${projectId}/pages/${targetDocId}` : `/pages/${targetDocId}`);
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
            project={currentProject}
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
            projectLabels={availableLabels}
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
                description="An issue occurred while loading pages for this project. Other features and workspaces remain safe."
                error={error}
              />
            ) : filteredPages.length === 0 ? (
              <PagesEmptyState
                searchQuery={searchQuery}
                onClearSearch={() => setSearchQuery('')}
                variant={activeFilter === 'archived' ? 'archive' : undefined}
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
              setTemplateType={setTemplateType}
            />
          )}

          {editingPage && (
            <EditModal
              isOpen={!!editingPage}
              setIsOpen={(open) => {
                if (!open) setEditingPage(null);
              }}
              page={editingPage}
              projectId={projectId || 'personal'}
              projectLabels={projectLabels}
            />
          )}

          {isTemplatePickerOpen && (
            <TemplatePickerDialog
              isOpen={isTemplatePickerOpen}
              setIsOpen={setIsTemplatePickerOpen}
              projectId={projectId || 'personal'}
              initialCategory={templatePickerCategory}
            />
          )}

          {isImportDocModalOpen && (
            <ImportDocumentModal
              isOpen={isImportDocModalOpen}
              setIsOpen={setIsImportDocModalOpen}
              projectId={projectId || 'personal'}
              initialFormat={importDocFormat}
            />
          )}

          {isImportGithubOpen && (
            <ImportGithubModal
              isOpen={isImportGithubOpen}
              setIsOpen={setIsImportGithubOpen}
              projectId={projectId || 'personal'}
            />
          )}
        </PageLayout>
      </div>
    </div>
  );
}

export default ProjectPagesView;
