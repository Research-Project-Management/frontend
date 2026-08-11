'use client';

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useMyFiles } from "@/features/workspaces/storage/hooks/use-my-files";
import { useWorkspace } from '@/features/workspaces/shell/hooks/use-workspace';
import { Skeleton } from '@/shared/components/ui';
import FileExplorer from '../components/FileExplorer';
import type { StorageItem } from '@/features/workspaces/storage/types/storage.types';
import { downloadFileAsBlob } from '@/features/workspaces/storage/hooks/use-blob-url';

export default function WorkspaceMyFilesPage() {
  const { workspaceId: workspaceUrl } = useParams() as { workspaceId: string };
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<
    Array<{ id: string | null; name: string }>
  >([]);
  const { workspace, yourRole, isLoading: isWorkspaceLoading } = useWorkspace(
    workspaceUrl!,
  );
  const workspaceId = workspace?._id;
  const canUpload = !yourRole || yourRole !== "viewer";

  const { data, isLoading: isFilesLoading, handleToggleStar, handleDelete } = useMyFiles(workspaceId!);

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

  // My Drive only shows workspace-level items.
  const files = useMemo(
    () =>
      ((data?.files || []) as StorageItem[]).filter(
        (item) => !item.project?._id,
      ),
    [data?.files],
  );

  if (isWorkspaceLoading || isFilesLoading) {
    return <Skeleton className="h-48 w-full rounded-xl" />;
  }

  if (!workspaceId) {
    return <div className="p-6">Workspace not found</div>;
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
          <h1 className="text-lg font-semibold">My Drive</h1>
        </div>
      }
    />
  );
}

