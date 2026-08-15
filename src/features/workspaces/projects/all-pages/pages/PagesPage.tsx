'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { workspacePagesQueryOptions, projectPagesQueryOptions, usePageActions } from '../hooks/use-page';
import { useProjects } from '@/features/workspaces/projects/shell/services/project.services';
import { TopBar } from '../components/layout/TopBar';
import { EmptyState } from '../components/layout/EmptyState';
import { CreateModal } from '../components/modals/CreateModal';
import { GridView } from '../components/views/GridView';
import { ListView } from '../components/views/ListView';

export default function PagesPage({ projectId: initialProjectId }: { projectId?: string }) {
  const { workspaceId } = useParams() as { workspaceId: string };
  const router = useRouter();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>(initialProjectId || '');
  
  const { data: workspacePages, isLoading: isWorkspaceLoading } = useQuery({
    ...workspacePagesQueryOptions(workspaceId),
    enabled: !initialProjectId,
  });

  const { data: projectPages, isLoading: isProjectLoading } = useQuery({
    ...projectPagesQueryOptions(initialProjectId || ''),
    enabled: !!initialProjectId,
  });

  const pages = initialProjectId ? (projectPages ?? []) : (workspacePages ?? []);
  const isLoading = initialProjectId ? isProjectLoading : isWorkspaceLoading;

  const { projects } = useProjects();
  const { createPage } = usePageActions();

  const handleCreate = async () => {
    if (!title.trim()) {
      return;
    }
    const targetProjectId = initialProjectId || selectedProjectId;
    if (!targetProjectId) {
      return;
    }

    try {
      const data = await createPage.mutateAsync({
        projectId: targetProjectId,
        title: title.trim(),
        content: '',
      });
      setIsCreateModalOpen(false);
      setTitle('');
      // Redirect to the new document in the editor
      const mainFileStr = data.mainFile ? (typeof data.mainFile === 'object' ? data.mainFile._id : data.mainFile) : null;
      const fileQuery = mainFileStr ? `?file=${mainFileStr}` : '';
      router.push(`/${workspaceId}/projects/${targetProjectId}/pages/${data.page._id}${fileQuery}`);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <TopBar 
        initialProjectId={initialProjectId}
        viewMode={viewMode}
        setViewMode={setViewMode}
        onCreateClick={() => setIsCreateModalOpen(true)}
      />

      <div className="flex-1 overflow-y-auto">
        {!isLoading && pages.length === 0 ? (
          <EmptyState onCreateClick={() => setIsCreateModalOpen(true)} />
        ) : (
          viewMode === 'grid' ? (
            <GridView pages={pages} workspaceId={workspaceId} />
          ) : (
            <ListView pages={pages} workspaceId={workspaceId} />
          )
        )}
      </div>

      <CreateModal 
        isOpen={isCreateModalOpen}
        setIsOpen={setIsCreateModalOpen}
        title={title}
        setTitle={setTitle}
        initialProjectId={initialProjectId}
        selectedProjectId={selectedProjectId}
        setSelectedProjectId={setSelectedProjectId}
        projects={projects}
        handleCreate={handleCreate}
        isCreating={createPage.isPending}
      />
    </div>
  );
}
