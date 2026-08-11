'use client';

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useHome } from "@/features/workspaces/storage/hooks/use-home";
import { useWorkspace } from '@/features/workspaces/shell/hooks/use-workspace';
import { Skeleton } from "@/shared/components/ui";
import FileExplorer from '../components/FileExplorer';
import type { StorageItem } from '@/features/workspaces/storage/types/storage.types';
import { downloadFileAsBlob } from '@/features/workspaces/storage/hooks/use-blob-url';

export default function WorkspaceHomePage() {
  const { workspaceId: workspaceUrl } = useParams() as { workspaceId: string };
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<
    Array<{ id: string | null; name: string }>
  >([]);
  const { workspace, yourRole, isLoading: isWorkspaceLoading } = useWorkspace(
    workspaceUrl!,
  );
  const workspaceId = workspace?._id;
  // Allow all non-viewer members to upload at workspace level
  const canUpload = !!workspace && yourRole !== "viewer";

  const { data, isLoading: isHomeLoading, handleToggleStar, handleDelete } = useHome(workspaceId!, currentFolder);

  const handleDownload = async (item: StorageItem) => {
    if (!item.url) return;
    try {
      await downloadFileAsBlob(item.url, item.filename);
    } catch {
      window.open(item.url, "_blank");
    }
  };

  const handleRenameTrigger = (_item: StorageItem) => { };

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

  // Home shows ALL workspace-level items (folders + files without a project).
  // Project-scoped files are visible inside each project's Storage section.
  const files = useMemo(
    () => (data?.files || []) as StorageItem[],
    [data?.files],
  );

  if (isWorkspaceLoading || isHomeLoading) {
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

  if (!workspaceId) {
    return <div className="p-6 text-muted-foreground">Workspace not found</div>;
  }

  return (
    <FileExplorer
      items={files}

      currentFolder={currentFolder}
      breadcrumbs={breadcrumbs}
      workspaceId={workspaceId}
      wsId={workspaceId}
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

