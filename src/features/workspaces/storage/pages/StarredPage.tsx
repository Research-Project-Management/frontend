'use client';

import { useParams } from "next/navigation";
import { useStarred } from "@/features/workspaces/storage/hooks/use-starred";
import { useWorkspace } from '@/features/workspaces/shell/hooks/use-workspace';
import { Star } from "lucide-react";
import { Skeleton } from '@/shared/components/ui';
import FileExplorer from '../components/FileExplorer';
import type { StorageItem } from '@/features/workspaces/storage/types/storage.types';
import { downloadFileAsBlob } from '@/features/workspaces/storage/hooks/use-blob-url';

export default function WorkspaceStarredPage() {
  const { workspaceId: workspaceUrl } = useParams() as { workspaceId: string };
  const { workspace, isLoading: isWorkspaceLoading } = useWorkspace(
    workspaceUrl!,
  );
  const workspaceId = workspace?._id;

  const { data, isLoading: isFilesLoading, handleToggleStar, handleDelete } = useStarred(workspaceId!);

  const handleDownload = async (item: StorageItem) => {
    if (!item.url) return;
    try {
      await downloadFileAsBlob(item.url, item.filename);
    } catch {
      window.open(item.url, "_blank");
    }
  };

  const handleRenameTrigger = (_item: StorageItem) => { };

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
            <h1 className="text-lg font-semibold">Starred</h1>
          </div>
        </div>
      }
    />
  );
}

