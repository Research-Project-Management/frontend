'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { projectPagesQueryOptions, usePageActions } from '../hooks/use-page';
import { Topbar } from '../components/layout/Topbar';
import { EmptyState } from '../components/layout/EmptyState';
import { CreateModal } from '../components/modals/CreateModal';
import { GridView } from '../components/views/GridView';
import { ListView } from '../components/views/ListView';
import type { PagesViewMode } from '../types/page.types';

export default function PagesPage({ projectId: propProjectId }: { projectId?: string } = {}) {
  const params = useParams() as { workspaceId: string; projectId?: string };
  const workspaceId = params.workspaceId;
  const projectId = propProjectId || params.projectId || '';
  const router = useRouter();
  const [viewMode, setViewMode] = useState<PagesViewMode>('grid');

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [title, setTitle] = useState('');

  const { data: pages = [], isLoading } = useQuery(
    projectPagesQueryOptions(projectId),
  );

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
      const mainFileStr = data.mainFile
        ? typeof data.mainFile === 'object' && data.mainFile !== null && 'id' in data.mainFile
          ? (data.mainFile.id as string)
          : (data.mainFile as string)
        : null;
      const fileQuery = mainFileStr ? `?file=${mainFileStr}` : '';
      router.push(
        `/${workspaceId}/projects/${projectId}/pages/${data.page.id}${fileQuery}`,
      );
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <Topbar
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
        handleCreate={handleCreate}
        isCreating={createPage.isPending}
      />
    </div>
  );
}
