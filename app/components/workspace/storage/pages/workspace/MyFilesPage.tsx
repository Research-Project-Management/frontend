import { useMemo, useState } from "react";
import { useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import {
  fetchWorkspaceFiles,
  useToggleStar,
  useDeleteFile,
} from "~/query/storage";
import { useWorkspace } from "~/query/workspace";
import Loading from "~/components/ui/Loading";
import FileExplorer from "../../components/FileExplorer";
import type { StorageItem } from "../../types";
import { downloadFileAsBlob } from "~/hooks/useBlobUrl";

export default function WorkspaceMyFilesPage() {
  const { workspaceId: workspaceUrl } = useParams();
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<
    Array<{ id: string | null; name: string }>
  >([]);
  const { workspace, isLoading: isWorkspaceLoading } = useWorkspace(
    workspaceUrl!,
  );
  const workspaceId = workspace?._id;
  const canUpload = !workspace?.yourRole || workspace.yourRole !== "viewer";

  const { data, isLoading: isFilesLoading } = useQuery({
    queryKey: ["workspace-my-files", workspaceId, currentFolder],
    queryFn: () => fetchWorkspaceFiles(workspaceId!, currentFolder),
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

  const handleRenameTrigger = (_item: StorageItem) => {};

  const handleFolderClick = (folder: StorageItem) => {
    setCurrentFolder(folder._id);
    setBreadcrumbs((prev) => [...prev, { id: folder._id, name: folder.filename }]);
  };

  const handleBreadcrumbNavigate = (folderId: string | null) => {
    setCurrentFolder(folderId);
    if (folderId === null) {
      setBreadcrumbs([]);
      return;
    }

    setBreadcrumbs((prev) => {
      const index = prev.findIndex((item) => item.id === folderId);
      return index >= 0 ? prev.slice(0, index + 1) : prev;
    });
  };

  // My Drive only shows workspace-level items.
  const files = useMemo(
    () =>
      ((data?.files || []) as StorageItem[]).filter(
        (item) => !item.project?._id,
      ),
    [data?.files],
  );

  if (isWorkspaceLoading || isFilesLoading) {
    return <Loading />;
  }

  if (!workspaceId) {
    return <div className="p-6">Workspace not found</div>;
  }

  return (
    <FileExplorer
      items={files}
      storageScope="workspace"
      currentFolder={currentFolder}
      breadcrumbs={breadcrumbs}
      workspaceId={workspaceId}
      wsId={workspaceId}
      onNavigate={handleBreadcrumbNavigate}
      onFolderClick={handleFolderClick}
      onToggleStar={handleToggleStar}
      onDelete={handleDelete}
      onDownload={handleDownload}
      onRename={handleRenameTrigger}
      enableUpload={canUpload}
      enableBreadcrumbs={true}
      defaultView="list"
      header={
        <div className="flex items-center gap-2.5">
          <h1 className="text-lg font-semibold">My Drive</h1>
        </div>
      }
    />
  );
}
