import { useParams, useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import {
  fetchWorkspaceHome,
  useToggleStar,
  useDeleteFile,
} from "~/query/storage";
import { useWorkspace } from "~/query/workspace";
import { Skeleton } from "~/components/ui/skeleton";
import FileExplorer from "../../components/FileExplorer";
import type { StorageItem } from "../../types";

export default function WorkspaceHomePage() {
  const { workspaceId: workspaceUrl } = useParams();
  const navigate = useNavigate();
  const { workspace, isLoading: isWorkspaceLoading } = useWorkspace(
    workspaceUrl!,
  );
  const workspaceId = workspace?._id;

  const { data, isLoading: isHomeLoading } = useQuery({
    queryKey: ["workspace-home", workspaceId],
    queryFn: () => fetchWorkspaceHome(workspaceId!),
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

  const handleDownload = (item: StorageItem) => {
    if (item.url) {
      window.open(item.url, "_blank");
    }
  };

  if (isWorkspaceLoading || isHomeLoading) {
    return (
      <div className="flex-1 p-6 space-y-4">
        <Skeleton className="h-9 w-full rounded-lg" />
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (!workspaceId) {
    return <div className="p-6 text-muted-foreground">Workspace not found</div>;
  }

  const projects = data?.projects || [];
  const workspaceFiles = (data?.workspaceFiles || []) as StorageItem[];

  // Convert projects into virtual folder StorageItems so they appear
  // as regular folders inside the FileExplorer alongside workspace files
  const projectFolders: StorageItem[] = projects.map((project) => ({
    _id: `project:${project._id}`,
    filename: project.name,
    isFolder: true,
    starred: false,
    author: { name: "", email: "", avatar: "" },
    project: { _id: project._id, name: project.name },
    createdAt: "",
    updatedAt: "",
    size: project.totalSize,
  }));

  // Merge: project folders first, then workspace files
  const allItems = [...projectFolders, ...workspaceFiles];

  const handleFolderClick = (folder: StorageItem) => {
    // If it's a virtual project folder, navigate to that project's storage
    if (folder._id.startsWith("project:")) {
      const projectId = folder._id.replace("project:", "");
      navigate(`/${workspaceUrl}/projects/${projectId}/storage`);
    }
  };

  return (
    <FileExplorer
      items={allItems}
      projectId={undefined}
      wsId={workspaceId}
      onFolderClick={handleFolderClick}
      onToggleStar={handleToggleStar}
      onDelete={handleDelete}
      onDownload={handleDownload}
      enableUpload={true}
      enableBreadcrumbs={false}
      defaultView="list"
      header={
        <div className="flex items-center gap-2.5">
          <h1 className="text-lg font-semibold">Home</h1>
        </div>
      }
    />
  );
}
