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
import { PageLayout, PageContent } from '@/shared/components/layout';

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
    refetch,
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
    <PageLayout>
      <Topbar
        viewMode={viewMode}
        setViewMode={setViewMode}
        onCreateClick={() => setIsCreateModalOpen(true)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      <PageContent maxWidth="full" noPadding>
        {projectLabels.length > 0 && !isError && !isLoading && (
          <div className="px-6 pt-4 pb-2 flex flex-wrap gap-2 items-center shrink-0">
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

        {isLoading ? (
          viewMode === 'grid' ? (
            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-36 rounded-md border border-border bg-card p-4 flex flex-col justify-between animate-pulse"
                >
                  <div className="space-y-2.5">
                    <div className="h-3.5 w-32 rounded bg-muted" />
                    <div className="h-3 w-44 rounded bg-muted/60" />
                  </div>
                  <div className="h-3 w-20 rounded bg-muted/60" />
                </div>
              ))}
            </div>
          ) : (
            <div className="divide-y divide-border border-b border-border">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-11 px-4 flex items-center justify-between gap-4 animate-pulse">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="size-4 rounded bg-muted shrink-0" />
                    <div className="h-3.5 w-48 rounded bg-muted" />
                  </div>
                  <div className="h-3 w-24 rounded bg-muted shrink-0" />
                </div>
              ))}
            </div>
          )
        ) : isError ? (
          <PlaneErrorState
            title="Unable to load pages"
            description="An issue occurred while loading documents for this project. Other features and workspaces remain safe."
            error={error}
            reset={() => refetch()}
          />
        ) : filteredPages.length === 0 ? (
          <PagesEmptyState
            searchQuery={searchQuery}
            onClearSearch={() => setSearchQuery('')}
            labelName={selectedLabel?.name}
            onClearFilter={() => setSelectedLabelId(null)}
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
      />
    </PageLayout>
  );
}

export default ProjectPagesView;
