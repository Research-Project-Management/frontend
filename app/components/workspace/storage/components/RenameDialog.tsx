import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { useRenameFile } from "~/query/storage";

type RenameDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileId: string | null;
  currentName: string;
};

export default function RenameDialog({
  open,
  onOpenChange,
  fileId,
  currentName,
}: RenameDialogProps) {
  const [name, setName] = useState(currentName);
  const renameMutation = useRenameFile();

  // Reset name when dialog opens/closes or currentName changes
  useEffect(() => {
    if (open) {
      setName(currentName);
    }
  }, [open, currentName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !fileId) return;

    try {
      await renameMutation.mutateAsync({
        fileId,
        name: name.trim(),
      });
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to rename:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rename</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter new name"
              autoFocus
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={renameMutation.isPending || !name.trim()}>
              {renameMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
