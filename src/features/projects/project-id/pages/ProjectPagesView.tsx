'use client';

import { useState, useMemo, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { manuscriptService } from '@/features/editor/core';
import { projectPagesQueryOptions, usePageActions, pageKeys } from './hooks/use-page';
import { useProjectsQuery, useProjectQuery } from '@/features/projects/shell/hooks/use-project';
import { Topbar } from './components/layout/Topbar';
import { PagesEmptyState } from './components/layout/PagesEmptyState';
import { GridView } from './components/views/GridView';
import { ListView } from './components/views/ListView';
import type { Page, PagesViewMode } from './types/page.types';
import { useProjectLabels } from '../settings/hooks/use-label';
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

export function ProjectPagesView({ projectId: propProjectId }: { projectId?: string } = {}) {
  const router = useRouter();
  const params = useParams() as { projectId?: string };
  const [viewMode, setViewMode] = useState<PagesViewMode>('grid');

  // Load workspace projects
  const { projects = [] } = useProjectsQuery();

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
    () => (projectId ? projects.find((p) => p.id === projectId || (p as { identifier?: string }).identifier === projectId) : null),
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
  } = useQuery(projectPagesQueryOptions(projectId));

  const { data: projectLabels = [] } = useProjectLabels(projectId);

  // Extract only labels that are actually assigned to at least one page in this project
  const assignedLabels = useMemo(() => {
    const map = new Map<string, { id: string; name: string; color?: string }>();
    for (const page of pages) {
      if (Array.isArray(page.labels)) {
        for (const l of page.labels) {
          if (!l) continue;
          if (typeof l === 'string') {
            const matched = projectLabels.find((pl: { id?: string; name?: string }) => pl.id === l || pl.name === l);
            const id = matched?.id || l;
            const name = matched?.name || l;
            const color = matched?.color || '#3b82f6';
            if (!map.has(id)) {
              map.set(id, { id, name, color });
            }
          } else if (typeof l === 'object' && l !== null) {
            const labelObj = l as { id?: string; name?: string; title?: string; color?: string };
            const id = labelObj.id || labelObj.name;
            const matched = projectLabels.find((pl) => pl.id === id || pl.name === labelObj.name);
            const name = matched?.name || labelObj.name || labelObj.title || id || '';
            const color = labelObj.color || matched?.color || '#3b82f6';
            if (id && !map.has(id)) {
              map.set(id, { id, name, color });
            }
          }
        }
      }
    }

    // Also include any currently selected label so the user can see and uncheck it
    if (selectedLabelIds.length > 0) {
      for (const id of selectedLabelIds) {
        if (!map.has(id)) {
          const matched = projectLabels.find((pl) => pl.id === id || pl.name === id);
          if (matched) {
            map.set(id, matched);
          }
        }
      }
    }

    return Array.from(map.values());
  }, [pages, projectLabels, selectedLabelIds]);

  const selectedLabels = useMemo(
    () => assignedLabels.filter((l) => selectedLabelIds.includes(l.id)),
    [assignedLabels, selectedLabelIds]
  );

  const filteredPages = useMemo(() => {
    let result = pages;
    if (selectedLabelIds.length > 0) {
      result = result.filter((page) =>
        (page.labels as Array<{ id?: string; name?: string } | string> | undefined)?.some((label) => {
          const lid = typeof label === 'string' ? label : (label?.id || label?.name);
          return lid ? selectedLabelIds.includes(lid) : false;
        })
      );
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((page) => page.title?.toLowerCase().includes(q));
    }
    return result;
  }, [pages, selectedLabelIds, searchQuery]);

  const { createPage } = usePageActions();

  const handleCreate = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle || !projectId) return;

    try {
      const data = await createPage.mutateAsync({
        projectId,
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
      const result = await manuscriptService.export.importProjectZip(projectId, file);
      await queryClient.invalidateQueries({ queryKey: pageKeys.all });
      toast.success('Project imported successfully', { id: toastId });
      const targetDocId = result?.rootDocId;
      if (targetDocId) {
        router.push(`/projects/${projectId}/pages/${targetDocId}`);
      }
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
        projectLabels={assignedLabels}
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
          projectId={projectId}
          projectLabels={projectLabels}
        />
      )}

      {isTemplatePickerOpen && (
        <TemplatePickerDialog
          isOpen={isTemplatePickerOpen}
          setIsOpen={setIsTemplatePickerOpen}
          projectId={projectId}
          initialCategory={templatePickerCategory}
        />
      )}

      {isImportDocModalOpen && (
        <ImportDocumentModal
          isOpen={isImportDocModalOpen}
          setIsOpen={setIsImportDocModalOpen}
          projectId={projectId}
          initialFormat={importDocFormat}
        />
      )}

      {isImportGithubOpen && (
        <ImportGithubModal
          isOpen={isImportGithubOpen}
          setIsOpen={setIsImportGithubOpen}
          projectId={projectId}
        />
      )}
    </PageLayout>
  );
}

export default ProjectPagesView;
