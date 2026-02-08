import { useState, useEffect } from "react";
import { useParams } from "react-router";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Task, Column } from "~/types/task";
import { useProjectDetails } from "~/query/project";

type TaskDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "add" | "edit";
  card?: Partial<Task>;
  columns: Column[];
  onSave: (card: Partial<Task>) => void;
  onDelete?: () => void;
};

export function TaskDialog({
  open,
  onOpenChange,
  mode,
  card,
  columns,
  onSave,
  onDelete,
}: TaskDialogProps) {
  const { projectId } = useParams();
  const { data: projectData } = useProjectDetails(projectId!);
  const members = projectData?.project?.members || [];

  const [formData, setFormData] = useState<Partial<Task>>({
    title: "",
    content: "",
    columnId: columns[0]?.id || "",
    labels: [],
    assignee: undefined,
    dueDate: "",
  });

  const [labelsString, setLabelsString] = useState("");

  useEffect(() => {
    if (open && card) {
      setFormData({
        title: card.title || "",
        content: card.content || "",
        columnId: card.columnId || columns[0]?.id || "",
        labels: card.labels || [],
        assignee: card.assignee,
        dueDate: card.dueDate
          ? new Date(card.dueDate).toISOString().split("T")[0]
          : "",
      });
      setLabelsString((card.labels || []).join(", "));
    } else if (open && !card) {
      setFormData({
        title: "",
        content: "",
        columnId: columns[0]?.id || "",
        labels: [],
        assignee: undefined,
        dueDate: "",
      });
      setLabelsString("");
    }
  }, [open, card, columns]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const labels = labelsString
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    // Convert assignee object to ID if it's an object (for mutation)
    let assigneeId =
      typeof formData.assignee === "object"
        ? (formData.assignee as any)._id
        : formData.assignee;
    if (assigneeId === "none") assigneeId = null;

    onSave({ ...formData, labels, assignee: assigneeId });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="text-xl">
              {mode === "add" ? "Create New Task" : "Edit Task"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-6 py-6">
            <div className="space-y-2">
              <Label htmlFor="title" className="text-sm font-semibold">
                Title *
              </Label>
              <Input
                id="title"
                value={formData.title || ""}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                placeholder="Enter task title"
                required
                autoFocus
                className="text-base"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="content" className="text-sm font-semibold">
                Description
              </Label>
              <Textarea
                id="content"
                className="min-h-[140px] resize-none"
                value={formData.content || ""}
                onChange={(e) =>
                  setFormData({ ...formData, content: e.target.value })
                }
                placeholder="Add a detailed description..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="columnId" className="text-sm font-semibold">
                  Status *
                </Label>
                <Select
                  value={formData.columnId}
                  onValueChange={(value) =>
                    setFormData({ ...formData, columnId: value })
                  }
                >
                  <SelectTrigger id="columnId">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {columns.map((column) => (
                      <SelectItem key={column.id} value={column.id}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: column.accentColor }}
                          />
                          {column.title}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="assignee" className="text-sm font-semibold">
                  Assign To
                </Label>
                <Select
                  value={
                    typeof formData.assignee === "object"
                      ? (formData.assignee as any)?._id
                      : formData.assignee
                  }
                  onValueChange={(value) =>
                    setFormData({ ...formData, assignee: value as any })
                  }
                >
                  <SelectTrigger id="assignee">
                    <SelectValue placeholder="Select assignee" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      <span className="text-muted-foreground">Unassigned</span>
                    </SelectItem>
                    {members.map((m: any) => (
                      <SelectItem key={m.user._id} value={m.user._id}>
                        <div className="flex items-center gap-2">
                          {m.user.avatar && (
                            <img
                              src={m.user.avatar}
                              alt=""
                              className="w-5 h-5 rounded-full"
                            />
                          )}
                          <span>{m.user.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="labels" className="text-sm font-semibold">
                  Labels
                </Label>
                <Input
                  id="labels"
                  value={labelsString}
                  onChange={(e) => setLabelsString(e.target.value)}
                  placeholder="e.g., bug, feature, urgent"
                />
                <p className="text-xs text-muted-foreground">
                  Separate with commas
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="dueDate" className="text-sm font-semibold">
                  Due Date
                </Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={formData.dueDate || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, dueDate: e.target.value })
                  }
                />
              </div>
            </div>
          </div>

          <DialogFooter className="flex justify-between items-center">
            <div>
              {mode === "edit" && onDelete && (
                <Button type="button" variant="destructive" onClick={onDelete}>
                  Delete Task
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit">
                {mode === "add" ? "Create" : "Save"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
