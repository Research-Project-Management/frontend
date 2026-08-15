import React from 'react';
import { Loader2 } from 'lucide-react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Input,
  Label,
} from '@/shared/components/ui';

interface CreateModalProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  title: string;
  setTitle: (title: string) => void;
  handleCreate: () => void;
  isCreating: boolean;
}

export function CreateModal({
  isOpen,
  setIsOpen,
  title,
  setTitle,
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
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={isCreating || !title.trim()}>
            {isCreating && <Loader2 className="mr-2 size-4 animate-spin" />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
