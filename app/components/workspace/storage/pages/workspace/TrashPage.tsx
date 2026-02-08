import { useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import {
  fetchWorkspaceTrashedFiles,
  useRestoreFile,
  usePermanentlyDeleteFile,
} from "~/query/storage";
import { useWorkspace } from "~/query/workspace";
import { Trash2 } from "lucide-react";
import Loading from "~/components/ui/Loading";
import FileExplorer from "../../components/FileExplorer";
import type { StorageItem } from "../../types";

export default function WorkspaceTrashPage() {
  const { workspaceId: workspaceUrl } = useParams();
  const { workspace, isLoading: isWorkspaceLoading } = useWorkspace(
    workspaceUrl!,
  );
  const workspaceId = workspace?._id;

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

  const handleDownload = (item: StorageItem) => {
    if (item.url) {
      window.open(item.url, "_blank");
    }
  };

  if (isWorkspaceLoading || isFilesLoading) {
    return <Loading />;
  }

  if (!workspaceId) {
    return <div className="p-6">Workspace not found</div>;
  }

  const files = (data?.files || []) as StorageItem[];

  return (
    <FileExplorer
      items={files}
      projectId={workspaceId}
      onToggleStar={() => {}}
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
