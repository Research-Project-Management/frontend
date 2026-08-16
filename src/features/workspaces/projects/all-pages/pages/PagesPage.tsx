'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { workspacePagesQueryOptions, usePageActions } from '../hooks/use-page';
import { useProjects } from '@/features/workspaces/projects/shell';
import { TopBar } from '../components/layout/TopBar';
import { EmptyState } from '../components/layout/EmptyState';
import { CreateModal } from '../components/modals/CreateModal';
import { GridView } from '../components/views/GridView';
import { ListView } from '../components/views/ListView';
import type { PagesViewMode } from '../types/page.types';

export default function PagesPage() {
  const { workspaceId } = useParams() as { workspaceId: string };
  const router = useRouter();
  const [viewMode, setViewMode] = useState<PagesViewMode>('grid');

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');

  const { data: pages = [], isLoading } = useQuery(
    workspacePagesQueryOptions(workspaceId),
  );

  const { projects = [] } = useProjects(workspaceId);
  const { createPage } = usePageActions();

  const handleCreate = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle || !selectedProjectId) return;

    try {
      const data = await createPage.mutateAsync({
        projectId: selectedProjectId,
        title: trimmedTitle,
      });
      setIsCreateModalOpen(false);
      setTitle('');
      const mainFileStr = data.mainFile
        ? typeof data.mainFile === 'object' && data.mainFile !== null && '_id' in data.mainFile
          ? (data.mainFile._id as string)
          : (data.mainFile as string)
        : null;
      const fileQuery = mainFileStr ? `?file=${mainFileStr}` : '';
      router.push(
        `/${workspaceId}/projects/${selectedProjectId}/pages/${data.page._id}${fileQuery}`,
      );
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <TopBar
        viewMode={viewMode}
        setViewMode={setViewMode}
        onCreateClick={() => setIsCreateModalOpen(true)}
      />

      <div className="flex-1 overflow-y-auto">
        {!isLoading && pages.length === 0 ? (
          <EmptyState onCreateClick={() => setIsCreateModalOpen(true)} />
        ) : viewMode === 'grid' ? (
          <GridView pages={pages} workspaceId={workspaceId} />
        ) : (
          <ListView pages={pages} workspaceId={workspaceId} />
        )}
      </div>

      <CreateModal
        isOpen={isCreateModalOpen}
        setIsOpen={setIsCreateModalOpen}
        title={title}
        setTitle={setTitle}
        selectedProjectId={selectedProjectId}
        setSelectedProjectId={setSelectedProjectId}
        projects={projects}
        handleCreate={handleCreate}
        isCreating={createPage.isPending}
      />
    </div>
  );
}
