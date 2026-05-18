import { useState } from "react";
import { useParams } from "react-router";
import { useFiles, useToggleStar, useDeleteFile } from "~/query/storage";
import { useProject } from "~/query/project";
import Loading from "~/components/ui/Loading";
import FileExplorer from "../components/FileExplorer";
import type { StorageItem } from "../types";
import { downloadFileAsBlob } from "~/hooks/useBlobUrl";

export default function StoragePage() {
  const { projectId } = useParams();
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<Array<{ id: string | null; name: string }>>([]);
  const { data: projectData, isLoading: isProjectLoading } = useProject(projectId!);

  const { data, isLoading: isFilesLoading } = useFiles(projectId!, currentFolder);
  const toggleStarMutation = useToggleStar();
  const deleteFileMutation = useDeleteFile();
  const canUpload = projectData?.yourRole !== "viewer";

  const handleFolderClick = (folder: StorageItem) => {
    setCurrentFolder(folder._id);
    setBreadcrumbs([...breadcrumbs, { id: folder._id, name: folder.filename }]);
  };

  const handleBreadcrumbNavigate = (folderId: string | null) => {
    setCurrentFolder(folderId);
    if (folderId === null) {
      setBreadcrumbs([]);
    } else {
      const index = breadcrumbs.findIndex((b) => b.id === folderId);
      setBreadcrumbs(breadcrumbs.slice(0, index + 1));
    }
  };

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

  // W4: non-empty stub — FileExplorer uses its own internal RenameDialog
  // but only activates it when onRename prop is truthy.
  const handleRenameTrigger = (_item: StorageItem) => {};

  if (isFilesLoading || isProjectLoading) {
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
      currentFolder={currentFolder}
      breadcrumbs={breadcrumbs}
      onNavigate={handleBreadcrumbNavigate}
      onFolderClick={handleFolderClick}
      onToggleStar={handleToggleStar}
      onDelete={handleDelete}
      onDownload={handleDownload}
      onRename={handleRenameTrigger}
      enableUpload={canUpload}
      enableBreadcrumbs={true}
    />
  );
}
