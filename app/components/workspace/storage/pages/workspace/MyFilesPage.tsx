import { useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import {
  fetchWorkspaceMyFiles,
  useToggleStar,
  useDeleteFile,
} from "~/query/storage";
import { useWorkspace } from "~/query/workspace";
import { FolderOpen } from "lucide-react";
import Loading from "~/components/ui/Loading";
import FileExplorer from "../../components/FileExplorer";
import type { StorageItem } from "../../types";

export default function WorkspaceMyFilesPage() {
  const { workspaceId: workspaceUrl } = useParams();
  const { workspace, isLoading: isWorkspaceLoading } = useWorkspace(
    workspaceUrl!,
  );
  const workspaceId = workspace?._id;

  const { data, isLoading: isFilesLoading } = useQuery({
    queryKey: ["workspace-my-files", workspaceId],
    queryFn: () => fetchWorkspaceMyFiles(workspaceId!),
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
    if (confirm("Are you sure you want to delete this file?")) {
      try {
        await deleteFileMutation.mutateAsync(fileId);
      } catch (error) {
        console.error("Error deleting file:", error);
      }
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
      onToggleStar={handleToggleStar}
      onDelete={handleDelete}
      onDownload={handleDownload}
      enableUpload={false}
      enableBreadcrumbs={false}
      defaultView="list"
      header={
        <div className="flex items-center gap-2.5">
          <div>
            <h1 className="text-lg font-semibold">My Drive</h1>
          </div>
        </div>
      }
    />
  );
}
