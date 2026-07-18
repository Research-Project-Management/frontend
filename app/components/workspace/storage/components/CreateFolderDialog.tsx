import { useState } from "react";
import { toast } from "sonner";
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

type CreateFolderDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scope: "project" | "workspace";
  projectId?: string | null;
  parentId?: string | null;
  workspaceId?: string;
};

export default function CreateFolderDialog({
  open,
  onOpenChange,
  scope,
  projectId,
  parentId,
  workspaceId,
}: CreateFolderDialogProps) {
  const [folderName, setFolderName] = useState("");
  const createFolderMutation = useCreateFolder();


  const handleCreate = async () => {
    if (!folderName.trim()) return;

    try {
      console.log("CreateFolderDialog: handleCreate with variables:", {
        name: folderName,
        scope,
        projectId,
        workspaceId,
        parentId,
      });
      await createFolderMutation.mutateAsync({
        name: folderName,
        scope,
        projectId: projectId || undefined,
        workspaceId,
        parentId,
      });
      console.log("CreateFolderDialog: handleCreate mutation finished successfully");
      toast.success(`Created folder "${folderName}"`);
      onOpenChange(false);
      setFolderName("");
    } catch (error) {
      toast.error("Failed to create folder");
      console.error("CreateFolderDialog: handleCreate mutation threw error:", error);
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
              disabled={createFolderMutation.isPending}
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
            disabled={createFolderMutation.isPending}
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
