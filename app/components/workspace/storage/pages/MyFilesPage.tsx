import { useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchMyFiles, useToggleStar, useDeleteFile } from "~/query/storage";
import Loading from "~/components/ui/Loading";
import FileExplorer from "../components/FileExplorer";
import type { StorageItem } from "../types";
import { downloadFileAsBlob } from "~/hooks/useBlobUrl";

export default function MyFilesPage() {
  const { projectId } = useParams();

  const { data, isLoading: isFilesLoading } = useQuery({
    queryKey: ["my-files", projectId],
    queryFn: () => fetchMyFiles(projectId!),
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

  const handleDownload = async (item: StorageItem) => {
    if (!item.url) return;
    try {
      await downloadFileAsBlob(item.url, item.filename);
    } catch {
      window.open(item.url, "_blank");
    }
  };

  const handleRenameTrigger = (item: StorageItem) => {
     // Just a trigger
  };

  if (isFilesLoading) {
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
      header={<h1 className="text-2xl font-bold">My Files</h1>}
    />
  );
}
