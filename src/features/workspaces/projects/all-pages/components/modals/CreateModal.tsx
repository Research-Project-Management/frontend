import React from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/shared/components/ui';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/shared/components/ui';
import { Input } from '@/shared/components/ui';
import { Label } from '@/shared/components/ui';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui';

interface CreateModalProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  title: string;
  setTitle: (title: string) => void;
  initialProjectId?: string;
  selectedProjectId: string;
  setSelectedProjectId: (id: string) => void;
  projects: any[];
  handleCreate: () => void;
  isCreating: boolean;
}

export function CreateModal({
  isOpen,
  setIsOpen,
  title,
  setTitle,
  initialProjectId,
  selectedProjectId,
  setSelectedProjectId,
  projects,
  handleCreate,
  isCreating,
}: CreateModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create Document</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="title">Document Title</Label>
            <Input
              id="title"
              placeholder="Enter document title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleCreate();
                }
              }}
            />
          </div>
          
          {!initialProjectId && (
            <div className="grid gap-2">
              <Label>Project</Label>
              <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a project..." />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project: any) => (
                    <SelectItem key={project._id} value={project._id}>
                      {project.title || project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={isCreating}>
            {isCreating && <Loader2 className="mr-2 size-4 animate-spin" />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
