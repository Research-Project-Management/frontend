import React, { useState } from "react";
import { useCreatePage } from "~/query/page";
import { useProjects } from "~/hooks/useWorkspace";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

export default function CreatePageDialog({ defaultProjectId }: { defaultProjectId?: string }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState<string>(defaultProjectId || "");

  const { projects, isLoading: isLoadingProjects } = useProjects();
  const createPageMutation = useCreatePage();

  const handleCreate = () => {
    if (!title || !selectedProjectId) return;

    createPageMutation.mutate(
      { projectId: selectedProjectId, title, status: "draft" },
      {
        onSuccess: () => {
          setOpen(false);
          setTitle("");
          if (!defaultProjectId) setSelectedProjectId("");
          toast.success("Page created successfully");
        },
        onError: (error: any) => {
          toast.error(error.message || "Failed to create page");
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          New Page
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Page</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="title">Page Title</Label>
            <Input
              id="title"
              placeholder="e.g. System Architecture"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="project">Project</Label>
            <Select 
              value={selectedProjectId} 
              onValueChange={setSelectedProjectId}
              disabled={!!defaultProjectId}
            >
              <SelectTrigger>
                <SelectValue placeholder={isLoadingProjects ? "Loading projects..." : "Select a project"} />
              </SelectTrigger>
              <SelectContent>
                {projects?.map((project: any) => (
                  <SelectItem key={project._id} value={project._id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleCreate} 
            disabled={!title || !selectedProjectId || createPageMutation.isPending}
          >
            {createPageMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Page
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
