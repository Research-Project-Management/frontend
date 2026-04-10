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
  const [isClosing, setIsClosing] = useState(false);
  const createFolderMutation = useCreateFolder();

  const closeWithAnimation = (onClosed?: () => void) => {
    setIsClosing(true);
    window.setTimeout(() => {
      onOpenChange(false);
      setIsClosing(false);
      onClosed?.();
    }, 180);
  };

  const handleCreate = async () => {
    if (!folderName.trim()) return;

    try {
      await createFolderMutation.mutateAsync({
        name: folderName,
        scope,
        projectId: projectId || undefined,
        workspaceId,
        parentId,
      });
      window.setTimeout(() => {
        closeWithAnimation(() => setFolderName(""));
      }, 220);
    } catch (error) {
      console.error("Error creating folder:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`sm:max-w-md transition-all duration-200 ${
          isClosing ? "opacity-0 scale-[0.98]" : "opacity-100 scale-100"
        }`}
      >
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
              disabled={createFolderMutation.isPending || isClosing}
              autoFocus
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              closeWithAnimation(() => setFolderName(""));
            }}
            disabled={createFolderMutation.isPending || isClosing}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!folderName.trim() || createFolderMutation.isPending || isClosing}
          >
            {createFolderMutation.isPending ? "Creating..." : "Create Folder"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
