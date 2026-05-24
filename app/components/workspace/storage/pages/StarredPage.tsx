import { useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import {
  fetchStarredFiles,
  useToggleStar,
  useDeleteFile,
} from "~/query/storage";
import { Star } from "lucide-react";
import Loading from "~/components/ui/Loading";
import FileExplorer from "../components/FileExplorer";
import type { StorageItem } from "../types";
import { downloadFileAsBlob } from "~/hooks/useBlobUrl";
import { useProject } from "~/query/project";
import { useDocumentTitle } from "~/hooks";

export default function StarredPage() {
  const { projectId } = useParams();
  const { data: projectData } = useProject(projectId!, { enabled: !!projectId });
  useDocumentTitle(
    projectData?.project?.name
      ? `Starred - ${projectData.project.name}`
      : "Starred"
  );

  const { data, isLoading } = useQuery({
    queryKey: ["starred-files", projectId],
    queryFn: () => fetchStarredFiles(projectId!),
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
          <h1 className="text-2xl font-bold">Starred Files</h1>
        </div>
      }
    />
  );
}
