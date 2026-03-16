import { useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import {
  fetchTrashedFiles,
  useRestoreFile,
  usePermanentlyDeleteFile,
} from "~/query/storage";
import { Trash2 } from "lucide-react";
import Loading from "~/components/ui/Loading";
import FileExplorer from "../components/FileExplorer";
import type { StorageItem } from "../types";
import { downloadFileAsBlob } from "~/hooks/useBlobUrl";

export default function TrashPage() {
  const { projectId } = useParams();

  const { data, isLoading } = useQuery({
    queryKey: ["trashed-files", projectId],
    queryFn: () => fetchTrashedFiles(projectId!),
    enabled: !!projectId,
  });

  const restoreFileMutation = useRestoreFile();
  const permanentlyDeleteFileMutation = usePermanentlyDeleteFile();

  // In Trash page, "Toggle Star" action is reused for "Restore" to keep the UI consistent
  // (the icon is changed in ItemActions based on isTrash prop)
  const handleRestore = async (fileId: string) => {
    try {
      await restoreFileMutation.mutateAsync(fileId);
    } catch (error) {
      console.error("Error restoring file:", error);
    }
  };

  const handlePermanentDelete = async (fileId: string) => {
    if (
      confirm(
        "Are you sure you want to permanently delete this file? This action cannot be undone.",
      )
    ) {
      try {
        await permanentlyDeleteFileMutation.mutateAsync(fileId);
      } catch (error) {
        console.error("Error permanently deleting file:", error);
      }
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
      onToggleStar={handleRestore} // Maps to Restore
      onDelete={handlePermanentDelete} // Maps to Permanent Delete
      onDownload={handleDownload}
      isTrash={true}
      header={
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">Trash</h1>
        </div>
      }
    />
  );
}
