'use client';

import { useState, useMemo, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { manuscriptService } from '@/features/editor/services/manuscript.service';
import { projectPagesQueryOptions, usePageActions, pageKeys } from './hooks/use-page';
import { useProjects, useProject } from '@/features/projects/shell/hooks/use-project';
import { Topbar } from './components/layout/Topbar';
import { PagesEmptyState } from './components/layout/PagesEmptyState';
import { CreateModal } from './components/modals/CreateModal';
import { TemplatePickerDialog } from './components/modals/TemplatePickerDialog';
import { GridView } from './components/views/GridView';
import { ListView } from './components/views/ListView';
import type { PagesViewMode } from './types/page.types';
import { useProjectLabels } from '../settings/hooks/use-label';
import { PageLayout, PageContent } from '@/shared/components/layout';

export function ProjectPagesView({ projectId: propProjectId }: { projectId?: string } = {}) {
  const router = useRouter();
  const params = useParams() as { projectId?: string };
  const [viewMode, setViewMode] = useState<PagesViewMode>('grid');

  // Load workspace projects
  const { projects = [], isLoading: isProjectsLoading } = useProjects();

  // Resolve effective project ID
  const resolvedProjectId = useMemo(() => {
    if (propProjectId) return propProjectId;
    if (params?.projectId) return params.projectId;
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('flux_active_project_id');
        if (stored && projects.some((p) => p.id === stored)) return stored;
      } catch {}
    }
    return projects[0]?.id || '';
  }, [propProjectId, params?.projectId, projects]);

  const projectId = resolvedProjectId;

  // Auto-redirect /pages to /projects/[projectId]/pages once resolved
  useEffect(() => {
    if (!propProjectId && !params?.projectId && projectId) {
      router.replace(`/projects/${projectId}/pages`);
    }
  }, [propProjectId, params?.projectId, projectId, router]);

  // Synchronous lookup from projects list cache
  const projectFromList = useMemo(
    () => (projectId ? projects.find((p) => p.id === projectId || (p as any).identifier === projectId) : null),
    [projects, projectId]
  );

  const { state: projectState } = useProject(projectId, {
    enabled: Boolean(projectId && !projectFromList?.name),
  });

  const currentProject = useMemo(() => {
    if (projectFromList) return projectFromList;
    if (projectState?.project) return projectState.project;
    return projectId ? { id: projectId, name: '', avatar: null } : undefined;
  }, [projectFromList, projectState?.project, projectId]);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isTemplatePickerOpen, setIsTemplatePickerOpen] = useState(false);
  const [templatePickerCategory, setTemplatePickerCategory] = useState<string>('all');
  const [title, setTitle] = useState('');
  const [templateType, setTemplateType] = useState<'blank' | 'example'>('blank');
  const [createSelectedLabelIds, setCreateSelectedLabelIds] = useState<string[]>([]);
  const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const {
    data: pages = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery(projectPagesQueryOptions(projectId));

  const { data: projectLabels = [] } = useProjectLabels(projectId);

  const selectedLabels = useMemo(
    () => projectLabels.filter((l: any) => selectedLabelIds.includes(l.id)),
    [projectLabels, selectedLabelIds]
  );

  const filteredPages = useMemo(() => {
    let result = pages;
    if (selectedLabelIds.length > 0) {
      result = result.filter((page) =>
        (page.labels as any[])?.some(
          (label) => selectedLabelIds.includes(label.id || label)
        )
      );
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((page) => page.title?.toLowerCase().includes(q));
    }
    return result;
  }, [pages, selectedLabelIds, searchQuery]);

  const { createPage } = usePageActions();

  const handleToggleCreateLabel = (labelId: string) => {
    setCreateSelectedLabelIds((prev) =>
      prev.includes(labelId) ? prev.filter((id) => id !== labelId) : [...prev, labelId]
    );
  };

  const handleCreate = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle || !projectId) return;

    try {
      const data = await createPage.mutateAsync({
        projectId,
        title: trimmedTitle,
        labels: createSelectedLabelIds,
        templateType,
      });
      setIsCreateModalOpen(false);
      setTitle('');
      setCreateSelectedLabelIds([]);
      setTemplateType('blank');
      const mainFileId =
        data.mainFileId ||
        (typeof data.mainFile === 'string'
          ? data.mainFile
          : (data.mainFile as any)?.id);
      const queryStr = mainFileId ? `?file=${mainFileId}` : '';
      const targetUrl = `/projects/${projectId}/pages/${data.page.id}${queryStr}`;
      router.push(targetUrl);
    } catch (err) {
      console.error(err);
    }
  };

  const queryClient = useQueryClient();
  const handleImportZip = async (file: File) => {
    if (!projectId) return;
    const toastId = toast.loading(`Importing ${file.name}...`);
    try {
      await manuscriptService.exportImport.importProjectZip(projectId, file);
      await queryClient.invalidateQueries({ queryKey: pageKeys.all });
      toast.success('Project imported', { id: toastId });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Import failed', { id: toastId });
    }
  };

  return (
    <PageLayout>
      <Topbar
        project={currentProject}
        viewMode={viewMode}
        setViewMode={setViewMode}
        onCreateClick={(template) => {
          setCreateSelectedLabelIds([]);
          setTemplateType(template ?? 'blank');
          setIsCreateModalOpen(true);
        }}
        onImportZip={handleImportZip}
        onOpenTemplates={(category) => {
          setTemplatePickerCategory(category);
          setIsTemplatePickerOpen(true);
        }}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        projectLabels={projectLabels}
        selectedLabelIds={selectedLabelIds}
        onSelectLabelIds={setSelectedLabelIds}
      />

      <PageContent maxWidth="full" noPadding className="pb-8">
        {isLoading ? (
          viewMode === 'grid' ? (
            <div className="p-4 sm:p-6 pb-12 w-full max-w-7xl mx-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-4.5">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex flex-col rounded-md border border-border/80 bg-card overflow-hidden animate-pulse"
                  >
                    <div className="aspect-[16/9] w-full bg-muted/40 border-b border-border/70 p-3.5 flex flex-col justify-between">
                      <div className="space-y-1.5">
                        <div className="h-3 w-16 rounded bg-muted/60" />
                        <div className="h-2 w-3/4 rounded bg-muted/50" />
                      </div>
                      <div className="h-1.5 w-1/2 rounded bg-muted/40" />
                    </div>
                    <div className="p-3.5 space-y-2.5">
                      <div className="h-4 w-3/4 rounded bg-muted/70" />
                      <div className="h-3 w-5/6 rounded bg-muted/50" />
                      <div className="flex gap-1.5 pt-1">
                        <div className="h-4.5 w-16 rounded-sm bg-muted/50" />
                        <div className="h-4.5 w-14 rounded-sm bg-muted/40" />
                      </div>
                      <div className="pt-2 border-t border-border/50 flex justify-between">
                        <div className="h-3 w-20 rounded bg-muted/50" />
                        <div className="h-3 w-16 rounded bg-muted/40" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="divide-y divide-border/60 border-b border-border overflow-x-auto select-none">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-10 px-4 flex items-center min-w-[780px] animate-pulse">
                  <div className="w-[36%] flex items-center gap-2.5 min-w-0 pr-4">
                    <div className="size-6.5 rounded-md bg-muted/60 shrink-0" />
                    <div className="h-3.5 w-3/5 rounded bg-muted/70" />
                  </div>
                  <div className="w-[12%] flex items-center pr-3">
                    <div className="h-5 w-16 rounded-md bg-muted/50" />
                  </div>
                  <div className="w-[16%] flex items-center gap-2 min-w-0 pr-3">
                    <div className="size-5 rounded-full bg-muted/60 shrink-0" />
                    <div className="h-3 w-20 rounded bg-muted/50" />
                  </div>
                  <div className="w-[22%] flex items-center gap-1.5 min-w-0 pr-3">
                    <div className="h-5 w-18 rounded-sm bg-muted/50" />
                    <div className="h-5 w-14 rounded-sm bg-muted/30" />
                  </div>
                  <div className="w-[10%] flex items-center min-w-0 pr-3">
                    <div className="h-3 w-16 rounded bg-muted/50" />
                  </div>
                  <div className="w-[4%] flex items-center justify-end">
                    <div className="size-4 rounded bg-muted/30" />
                  </div>
                </div>
              ))}
            </div>
          )
        ) : isError ? (
          <PlaneErrorState
            title="Unable to load pages"
            description="An issue occurred while loading pages for this project. Other features and workspaces remain safe."
            error={error}
            reset={() => refetch()}
          />
        ) : filteredPages.length === 0 ? (
          <PagesEmptyState
            searchQuery={searchQuery}
            onClearSearch={() => setSearchQuery('')}
            labelName={
              selectedLabels.length === 1
                ? selectedLabels[0].name
                : selectedLabels.length > 1
                  ? `${selectedLabels.length} labels`
                  : undefined
            }
            onClearFilter={() => setSelectedLabelIds([])}
          />
        ) : viewMode === 'grid' ? (
          <GridView pages={filteredPages} />
        ) : (
          <ListView pages={filteredPages} />
        )}
      </PageContent>

      <CreateModal
        isOpen={isCreateModalOpen}
        setIsOpen={setIsCreateModalOpen}
        title={title}
        setTitle={setTitle}
        handleCreate={handleCreate}
        isCreating={createPage.isPending}
        projectLabels={projectLabels}
        selectedLabelIds={createSelectedLabelIds}
        onToggleLabel={handleToggleCreateLabel}
        onClearLabels={() => setCreateSelectedLabelIds([])}
        templateType={templateType}
        setTemplateType={setTemplateType}
      />

      <TemplatePickerDialog
        isOpen={isTemplatePickerOpen}
        setIsOpen={setIsTemplatePickerOpen}
        projectId={projectId}
        initialCategory={templatePickerCategory}
      />
    </PageLayout>
  );
}

export default ProjectPagesView;
