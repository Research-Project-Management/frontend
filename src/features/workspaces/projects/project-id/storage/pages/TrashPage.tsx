'use client';

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { useTrash } from "../hooks/use-trash";
import { useProject } from '@/features/workspaces/projects';
import { Skeleton } from "@/shared/components/ui";
import FileExplorer from '../components/FileExplorer';
import type { StorageItem } from '@/features/workspaces/storage/types/storage.types';

export default function ProjectTrashPage() {
  const { projectId } = useParams() as { projectId: string };
  const { data: projectData, isLoading: isProjectLoading } = useProject(projectId!);
  const project = projectData as any;


  const { data, isLoading: isFilesLoading, handleRestore, handlePermanentlyDelete } = useTrash(projectId!);

  // Action handlers
  const handleToggleStarStub = () => {};
  const handleDeleteStub = () => {};
  const handleDownloadStub = () => {};
  const handleRenameTriggerStub = () => {};

  const files = useMemo(
    () => (data?.files || []) as StorageItem[],
    [data?.files],
  );

  if (isProjectLoading || isFilesLoading) {
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

      projectId={projectId}
      workspaceId={project?.workspaceId}
      wsId={project?.workspaceId}
      onDownload={handleDownloadStub}
      onRename={handleRenameTriggerStub}
      onToggleStar={handleRestore}
      onDelete={handlePermanentlyDelete}
      enableUpload={false}
      enableBreadcrumbs={false}
      isTrash={true}
      defaultView="list"
      header={
        <div className="flex items-center gap-2.5">
          <h1 className="text-lg font-semibold">Trash</h1>
        </div>
      }
    />
  );
}
