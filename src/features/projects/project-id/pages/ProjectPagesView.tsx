'use client';

import { useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { projectPagesQueryOptions, usePageActions } from './hooks/use-page';
import { Topbar } from './components/layout/Topbar';
import { PagesEmptyState } from './components/layout/PagesEmptyState';
import { PlaneErrorState } from '@/shared/components/ui/PlaneErrorState';
import { CreateModal } from './components/modals/CreateModal';
import { GridView } from './components/views/GridView';
import { ListView } from './components/views/ListView';
import type { PagesViewMode } from './types/page.types';
import { useProjectLabels } from '../settings/hooks/use-label';

export function ProjectPagesView({ projectId: propProjectId }: { projectId?: string } = {}) {
  const params = useParams() as { projectId?: string };
  const projectId = propProjectId || params.projectId || '';
  const router = useRouter();
  const [viewMode, setViewMode] = useState<PagesViewMode>('grid');

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [selectedLabelId, setSelectedLabelId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const {
    data: pages = [],
    isLoading,
    isError,
    error,
  } = useQuery(projectPagesQueryOptions(projectId));

  const { data: projectLabels = [] } = useProjectLabels(projectId);

  const selectedLabel = useMemo(
    () => projectLabels.find((l: any) => l.id === selectedLabelId),
    [projectLabels, selectedLabelId]
  );

  const filteredPages = useMemo(() => {
    let result = pages;
    if (selectedLabelId) {
      result = result.filter((page) =>
        (page.labels as any[])?.some(
          (label) => (label.id || label) === selectedLabelId
        )
      );
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((page) => page.title?.toLowerCase().includes(q));
    }
    return result;
  }, [pages, selectedLabelId, searchQuery]);

  const { createPage } = usePageActions();

  const handleCreate = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle || !projectId) return;

    try {
      const data = await createPage.mutateAsync({
        projectId,
        title: trimmedTitle,
      });
      setIsCreateModalOpen(false);
      setTitle('');
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

  return (
    <div className="flex flex-col h-full bg-transparent">
      <Topbar
        viewMode={viewMode}
        setViewMode={setViewMode}
        onCreateClick={() => setIsCreateModalOpen(true)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      <div className="flex-1 overflow-y-auto flex flex-col">
        {projectLabels.length > 0 && !isError && (
          <div className="px-6 pt-4 pb-2 flex flex-wrap gap-2 items-center">
            {projectLabels.map((label: any) => {
              const isSelected = selectedLabelId === label.id;
              return (
                <button
                  key={label.id}
                  onClick={() => setSelectedLabelId(isSelected ? null : label.id)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors hover:opacity-80 cursor-pointer"
                  style={{
                    backgroundColor: isSelected
                      ? `${label.color ?? '#3b82f6'}25`
                      : 'transparent',
                    borderColor: `${label.color ?? '#3b82f6'}40`,
                    color: label.color ?? '#3b82f6',
                  }}
                >
                  <span
                    className="size-2 rounded-full shrink-0"
                    style={{ backgroundColor: label.color ?? '#3b82f6' }}
                  />
                  {label.name}
                </button>
              );
            })}
          </div>
        )}

        {isError ? (
          <PlaneErrorState
            title="Unable to load pages"
            description="An issue occurred while loading documents for this project. Other features and workspaces remain safe."
            error={error || new Error('Internal Server Error')}
          />
        ) : !isLoading && filteredPages.length === 0 ? (
          <PagesEmptyState
            searchQuery={searchQuery}
            onClearSearch={() => setSearchQuery('')}
            labelName={selectedLabel?.name}
            onClearFilter={() => setSelectedLabelId(null)}
            onCreateClick={() => setIsCreateModalOpen(true)}
          />
        ) : viewMode === 'grid' ? (
          <GridView pages={filteredPages} workspaceId="" />
        ) : (
          <ListView pages={filteredPages} workspaceId="" />
        )}
      </div>

      <CreateModal
        isOpen={isCreateModalOpen}
        setIsOpen={setIsCreateModalOpen}
        title={title}
        setTitle={setTitle}
        handleCreate={handleCreate}
        isCreating={createPage.isPending}
      />
    </div>
  );
}

export default ProjectPagesView;
