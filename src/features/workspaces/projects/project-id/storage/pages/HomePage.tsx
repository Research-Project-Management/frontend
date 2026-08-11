'use client';

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useHome } from "../hooks/use-home";
import { useProject } from '@/features/workspaces/projects';
import { Skeleton } from "@/shared/components/ui";
import FileExplorer from '../components/FileExplorer';
import type { StorageItem } from '@/features/workspaces/storage/types/storage.types';
import { downloadFileAsBlob } from '@/features/workspaces/storage/hooks/use-blob-url';

export default function ProjectHomePage() {
  const { projectId } = useParams() as { projectId: string };
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<
    Array<{ id: string | null; name: string }>
  >([]);
  
  const { data: projectData, isLoading: isProjectLoading } = useProject(projectId!);
  const project = projectData as any; // or proper type if available
  const canUpload = !!project; // Or proper RBAC check if project has roles


  const { data, isLoading: isHomeLoading, handleToggleStar, handleDelete } = useHome(projectId!, currentFolder);

  const handleDownload = async (item: StorageItem) => {
    if (!item.url) return;
    try {
      await downloadFileAsBlob(item.url, item.filename);
    } catch {
      window.open(item.url, "_blank");
    }
  };

  const handleRenameTrigger = (_item: StorageItem) => {};

  const handleFolderClick = (folder: StorageItem) => {
    setCurrentFolder(folder._id);
    setBreadcrumbs((prev) => [...prev, { id: folder._id, name: folder.filename }]);
  };

  const handleBreadcrumbNavigate = (folderId: string | null) => {
    setCurrentFolder(folderId);
    if (folderId === null) {
      setBreadcrumbs([]);
      return;
    }

    setBreadcrumbs((prev) => {
      const index = prev.findIndex((item) => item.id === folderId);
      return index >= 0 ? prev.slice(0, index + 1) : prev;
    });
  };

  const files = useMemo(
    () => (data?.files || []) as StorageItem[],
    [data?.files],
  );

  if (isProjectLoading || isHomeLoading) {
    return (
      <div className="flex-1 p-6 space-y-4">
        <Skeleton className="h-9 w-full rounded-lg" />
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (!projectId) {
    return <div className="p-6 text-muted-foreground">Project not found</div>;
  }

  return (
    <FileExplorer
      items={files}

      currentFolder={currentFolder}
      breadcrumbs={breadcrumbs}
      projectId={projectId}
      workspaceId={project?.workspaceId}
      wsId={project?.workspaceId}
      onNavigate={handleBreadcrumbNavigate}
      onFolderClick={handleFolderClick}
      onToggleStar={handleToggleStar}
      onDelete={handleDelete}
      onDownload={handleDownload}
      onRename={handleRenameTrigger}
      enableUpload={canUpload}
      enableBreadcrumbs={true}
      defaultView="list"
      header={
        <div className="flex items-center gap-2.5">
          <h1 className="text-lg font-semibold">Home</h1>
        </div>
      }
    />
  );
}
