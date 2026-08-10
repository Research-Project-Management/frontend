'use client';
import { 
  useToggleStar, 
  useDeleteFile, 
  useRestoreFile, 
  usePermanentlyDeleteFile, 
  fetchSharedFiles, 
  fetchStarredFiles, 
  fetchTrashedFiles, 
  fetchMyFiles,
  fetchWorkspaceHome,
  useFiles
} from '@/features/workspaces/storage/services/storage.services';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/shared/components/ui/skeleton';
import type { StorageItem } from '@/features/workspaces/storage/types/storage.types';
import { Folder } from 'lucide-react';
import FileExplorer from '@/features/workspaces/storage/components/FileExplorer';



import { downloadFileAsBlob } from '@/features/workspaces/storage/hooks/use-blob-url';
import { useProject } from '@/features/workspaces/projects/shell/services/project.services';
import { useDocumentTitle } from '@/features/workspaces/storage/hooks/use-document-title';

export default function MyFilesPage() {
  const { projectId } = useParams() as { projectId: string };
  const { data: projectData } = useProject(projectId!, { enabled: !!projectId });
  const pData = projectData as any;
  useDocumentTitle(
    pData?.project?.name
      ? `My Files - ${pData.project.name}`
      : "My Files"
  );

  const { data, isLoading: isFilesLoading } = useQuery({
    queryKey: ["my-files", projectId],
    queryFn: () => fetchMyFiles(projectId!),
    enabled: !!projectId,
  });

  const toggleStarMutation = useToggleStar();
  const deleteFileMutation = useDeleteFile();

  const handleToggleStar = async (fileId: string) => {
    try {
      await toggleStarMutation.mutateAsync(fileId);
    } catch (error) {
      console.error("Error toggling star:", error);
    }
  };

  const handleDelete = async (fileId: string) => {
    try {
      await deleteFileMutation.mutateAsync(fileId);
    } catch (error) {
      console.error("Error deleting file:", error);
    }
  };

  const handleDownload = async (item: StorageItem) => {
    if (!item.url) return;
    try {
      await downloadFileAsBlob(item.url, item.filename);
    } catch {
      window.open(item.url, "_blank");
    }
  };

  const handleRenameTrigger = (item: StorageItem) => {
     // Just a trigger
  };

  if (isFilesLoading) {
    return <Skeleton className="h-48 w-full rounded-xl" />;
  }

  if (!projectId) {
    return <div className="p-6">Project not found</div>;
  }

  const files = (data?.files || []) as StorageItem[];

  return (
    <FileExplorer
      items={files}
      projectId={projectId}
      onToggleStar={handleToggleStar}
      onDelete={handleDelete}
      onDownload={handleDownload}
      onRename={handleRenameTrigger}
      header={<h1 className="text-2xl font-bold">My Files</h1>}
    />
  );
}
