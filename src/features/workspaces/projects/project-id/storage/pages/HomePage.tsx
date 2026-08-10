// @ts-nocheck
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
import { useDocumentTitle } from '@/features/workspaces/storage/hooks/use-document-title';

export default function StoragePage() {
  const { projectId } = useParams() as { projectId: string };
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<Array<{ id: string | null; name: string }>>([]);
  const { data: projectData, isLoading: isProjectLoading } = useProject(projectId!);
  const pData = projectData as any;

  const { data, isLoading: isFilesLoading } = useFiles(projectId!, currentFolder);

  useDocumentTitle(
    pData?.project?.name
      ? `Storage - ${pData.project.name}`
      : "Storage"
  );
  const toggleStarMutation = useToggleStar();
  const deleteFileMutation = useDeleteFile();
  const canUpload = pData?.yourRole !== "viewer";

  const handleFolderClick = (folder: StorageItem) => {
    setCurrentFolder(folder._id);
    setBreadcrumbs([...breadcrumbs, { id: folder._id, name: folder.filename }]);
  };

  const handleBreadcrumbNavigate = (folderId: string | null) => {
    setCurrentFolder(folderId);
    if (folderId === null) {
      setBreadcrumbs([]);
    } else {
      const index = breadcrumbs.findIndex((b) => b.id === folderId);
      setBreadcrumbs(breadcrumbs.slice(0, index + 1));
    }
  };

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

  // W4: non-empty stub — FileExplorer uses its own internal RenameDialog
  // but only activates it when onRename prop is truthy.
  const handleRenameTrigger = (_item: StorageItem) => {};

  if (isFilesLoading || isProjectLoading) {
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
      currentFolder={currentFolder}
      breadcrumbs={breadcrumbs}
      onNavigate={handleBreadcrumbNavigate}
      onFolderClick={handleFolderClick}
      onToggleStar={handleToggleStar}
      onDelete={handleDelete}
      onDownload={handleDownload}
      onRename={handleRenameTrigger}
      enableUpload={canUpload}
      enableBreadcrumbs={true}
    />
  );
}
