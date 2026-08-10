'use client';

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  fetchWorkspaceTrashedFiles,
  useRestoreFile,
  usePermanentlyDeleteFile,
} from "@/features/workspaces/storage/services/storage.services";
import { useWorkspace } from '@/features/workspaces';
import { Trash2 } from "lucide-react";
import { Skeleton } from '@/shared/components/ui';
import FileExplorer from '../components/FileExplorer';
import type { StorageItem } from '@/features/workspaces/storage/types/storage.types';
import { downloadFileAsBlob } from '@/features/workspaces/storage/hooks/use-blob-url';
import { useDocumentTitle } from '@/features/workspaces/storage/hooks/use-document-title';

export default function WorkspaceTrashPage() {
  const { workspaceId: workspaceUrl } = useParams() as { workspaceId: string };
  const { workspace, isLoading: isWorkspaceLoading } = useWorkspace(
    workspaceUrl!,
  );
  const workspaceId = workspace?._id;

  useDocumentTitle(workspace?.name ? `Trash - ${workspace.name}` : "Trash");

  const { data, isLoading: isFilesLoading } = useQuery({
    queryKey: ["workspace-trashed-files", workspaceId],
    queryFn: () => fetchWorkspaceTrashedFiles(workspaceId!),
    enabled: !!workspaceId,
  });

  const restoreFileMutation = useRestoreFile();
  const permanentlyDeleteFileMutation = usePermanentlyDeleteFile();

  const handleRestore = async (fileId: string) => {
    try {
      await restoreFileMutation.mutateAsync(fileId);
    } catch (error) {
      console.error("Error restoring file:", error);
    }
  };

  const handlePermanentDelete = async (fileId: string) => {
    try {
      await permanentlyDeleteFileMutation.mutateAsync(fileId);
    } catch (error) {
      console.error("Error permanently deleting file:", error);
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
      onToggleStar={handleRestore}
      onDelete={handlePermanentDelete}
      onDownload={handleDownload}
      enableUpload={false}
      enableBreadcrumbs={false}
      isTrash={true}
      defaultView="list"
      header={
        <div className="flex items-center gap-2.5">
          <div>
            <h1 className="text-lg font-semibold">Trash</h1>
          </div>
        </div>
      }
    />
  );
}

