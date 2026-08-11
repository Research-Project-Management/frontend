'use client';

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { useShared } from "../hooks/use-shared";
import { useProject } from '@/features/workspaces/projects';
import { Skeleton } from "@/shared/components/ui";
import FileExplorer from '../components/FileExplorer';
import type { StorageItem } from '@/features/workspaces/storage/types/storage.types';
import { downloadFileAsBlob } from '@/features/workspaces/storage/hooks/use-blob-url';

export default function ProjectSharedPage() {
  const { projectId } = useParams() as { projectId: string };
  const { data: projectData, isLoading: isProjectLoading } = useProject(projectId!);
  const project = projectData as any;
  const canUpload = !!project;


  const { data, isLoading: isFilesLoading, handleToggleStar, handleDelete } = useShared(projectId!);

  const handleDownload = async (item: StorageItem) => {
    if (!item.url) return;
    try {
      await downloadFileAsBlob(item.url, item.filename);
    } catch {
      window.open(item.url, "_blank");
    }
  };

  const handleRenameTrigger = (_item: StorageItem) => {};

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
      onToggleStar={handleToggleStar}
      onDelete={handleDelete}
      onDownload={handleDownload}
      onRename={handleRenameTrigger}
      enableUpload={false}
      enableBreadcrumbs={false}
      defaultView="list"
      header={
        <div className="flex items-center gap-2.5">
          <h1 className="text-lg font-semibold">Shared with Me</h1>
        </div>
      }
    />
  );
}
