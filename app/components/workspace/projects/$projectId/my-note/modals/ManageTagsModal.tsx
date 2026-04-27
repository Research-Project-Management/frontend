import { useState } from "react";
import { Edit2, Trash2, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { useTags, useUpdateTag, useDeleteTag } from "~/query/tag";
import { useParams } from "react-router";
import type { Tag } from "../types/note.type";

interface ManageTagsModalProps {
  open: boolean;
  onClose: () => void;
}

export default function ManageTagsModal({ open, onClose }: ManageTagsModalProps) {
  const { workspaceId } = useParams();
  const { data: tags = [] } = useTags(workspaceId || "");
  const updateTag = useUpdateTag();
  const deleteTag = useDeleteTag();

  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");

  const startEdit = (tag: Tag) => {
    setEditingTagId(tag._id);
    setEditName(tag.name);
    setEditColor(tag.color);
  };

  const cancelEdit = () => {
    setEditingTagId(null);
    setEditName("");
    setEditColor("");
  };

  const handleSave = (tagId: string) => {
    if (!editName.trim()) return;
    updateTag.mutate({ tagId, name: editName, color: editColor }, {
        onSuccess: () => cancelEdit()
    });
  };

  const handleDelete = (tagId: string) => {
    if (confirm("Delete this tag? It will be removed from all stickies.")) {
        deleteTag.mutate(tagId);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Manage Tags</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          {tags.length === 0 && (
            <div className="text-center text-muted-foreground text-sm py-4">
              No tags created yet.
            </div>
          )}
          {tags.map((tag) => (
            <div key={tag._id} className="flex items-center gap-2 p-2 border rounded-md">
              {editingTagId === tag._id ? (
                <div className="flex-1 flex items-center gap-2">
                  <input 
                    type="color" 
                    value={editColor} 
                    onChange={(e) => setEditColor(e.target.value)}
                    className="w-8 h-8 p-0 border-none rounded cursor-pointer"
                  />
                  <Input 
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="h-8"
                  />
                  <Button size="sm" onClick={() => handleSave(tag._id)}>Save</Button>
                  <Button size="sm" variant="ghost" onClick={cancelEdit}><X className="h-4 w-4"/></Button>
                </div>
              ) : (
                <>
                  <div 
                    className="w-4 h-4 rounded-full flex-shrink-0" 
                    style={{ backgroundColor: tag.color }} 
                  />
                  <span className="flex-1 font-medium text-sm">{tag.name}</span>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon-sm" onClick={() => startEdit(tag)}>
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(tag._id)} className="text-red-500 hover:text-red-700">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
