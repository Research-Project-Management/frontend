import { useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import {
  fetchSharedFiles,
  useToggleStar,
  useDeleteFile,
} from "~/query/storage";
import { Share2 } from "lucide-react";
import Loading from "~/components/ui/Loading";
import FileExplorer from "../components/FileExplorer";
import type { StorageItem } from "../types";

export default function SharedPage() {
  const { projectId } = useParams();

  const { data, isLoading } = useQuery({
    queryKey: ["shared-files", projectId],
    queryFn: () => fetchSharedFiles(projectId!),
    enabled: !!projectId,
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

  const handleDownload = (item: StorageItem) => {
    if (item.url) {
      window.open(item.url, "_blank");
    }
  };

  const handleRenameTrigger = (item: StorageItem) => {
    // Just a trigger
  };

  if (isLoading) {
    return <Loading />;
  }

  if (!projectId) {
    return <div className="p-6">Project not found</div>;
  }

  const files = (data?.files || []) as StorageItem[];

  return (
    <FileExplorer
      items={files}
      projectId={projectId}
      onToggleStar={handleToggleStar}
      onDelete={handleDelete}
      onDownload={handleDownload}
      onRename={handleRenameTrigger}
      header={
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">Shared with Me</h1>
        </div>
      }
    />
  );
}
