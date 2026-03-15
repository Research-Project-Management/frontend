import { useState } from "react";
import { FolderPlus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { useCreateFolder } from "~/query/storage";
import { useProject } from "~/query/project";

type CreateFolderDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId?: string | null;
  parentId?: string | null;
  workspaceId?: string;
};

export default function CreateFolderDialog({
  open,
  onOpenChange,
  projectId,
  parentId,
  workspaceId: workspaceIdProp,
}: CreateFolderDialogProps) {
  const [folderName, setFolderName] = useState("");
  const createFolderMutation = useCreateFolder();
  const { data: projectData } = useProject(projectId || "");
  const workspaceId = workspaceIdProp || (projectData?.project?.workspace as unknown as string);

  const handleCreate = async () => {
    if (!folderName.trim()) return;

    try {
      await createFolderMutation.mutateAsync({
        name: folderName,
        projectId: projectId || "",
        workspaceId: workspaceId!,
        parentId,
      });
      setFolderName("");
      onOpenChange(false);
    } catch (error) {
      console.error("Error creating folder:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderPlus className="h-5 w-5" />
            Create New Folder
          </DialogTitle>
          <DialogDescription>
            Enter a name for your new folder
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="folder-name">Folder Name</Label>
            <Input
              id="folder-name"
              placeholder="Enter folder name..."
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && folderName.trim()) {
                  handleCreate();
                }
              }}
              autoFocus
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              setFolderName("");
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!folderName.trim() || createFolderMutation.isPending}
          >
            {createFolderMutation.isPending ? "Creating..." : "Create Folder"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
