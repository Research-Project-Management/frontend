'use client';

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  fetchWorkspaceSharedFiles,
  useToggleStar,
  useDeleteFile,
} from "@/features/workspaces/storage/services/storage.services";
import { useWorkspace } from '@/features/workspaces';
import { Share2 } from "lucide-react";
import { Skeleton } from '@/shared/components/ui';
import FileExplorer from '../components/FileExplorer';
import type { StorageItem } from '@/features/workspaces/storage/types/storage.types';
import { downloadFileAsBlob } from '@/features/workspaces/storage/hooks/use-blob-url';
import { useDocumentTitle } from '@/features/workspaces/storage/hooks/use-document-title';

export default function WorkspaceSharedPage() {
  const { workspaceId: workspaceUrl } = useParams() as { workspaceId: string };
  const { workspace, isLoading: isWorkspaceLoading } = useWorkspace(
    workspaceUrl!,
  );
  const workspaceId = workspace?._id;

  useDocumentTitle(workspace?.name ? `Shared - ${workspace.name}` : "Shared");

  const { data, isLoading: isFilesLoading } = useQuery({
    queryKey: ["workspace-shared-files", workspaceId],
    queryFn: () => fetchWorkspaceSharedFiles(workspaceId!),
    enabled: !!workspaceId,
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

  const handleRenameTrigger = () => {};

  if (isWorkspaceLoading || isFilesLoading) {
    return <Skeleton className="h-48 w-full rounded-xl" />;
  }

  if (!workspaceId) {
    return <div className="p-6">Workspace not found</div>;
  }

  const files = (data?.files || []) as StorageItem[];

  return (
    <FileExplorer
      items={files}
      storageScope="workspace"
      workspaceId={workspaceId}
      onToggleStar={handleToggleStar}
      onDelete={handleDelete}
      onDownload={handleDownload}
      onRename={handleRenameTrigger}
      enableUpload={false}
      enableBreadcrumbs={false}
      defaultView="list"
      header={
        <div className="flex items-center gap-2.5">
          <div>
            <h1 className="text-lg font-semibold">Shared</h1>
          </div>
        </div>
      }
    />
  );
}

