'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/shared/components/ui/dialog';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';

export interface ProjectLabelItem {
  id: string;
  name: string;
  color?: string;
}

export interface CreateModalProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  title: string;
  setTitle: (title: string) => void;
  handleCreate: () => void;
  isCreating: boolean;
  templateType?: 'blank' | 'example';
  setTemplateType?: (type: 'blank' | 'example') => void;
}

export function CreateModal({
  isOpen,
  setIsOpen,
  title,
  setTitle,
  handleCreate,
  isCreating,
  templateType = 'blank',
}: CreateModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[420px] rounded-md p-5 gap-4 shadow-raised-200 border-border/80">
        <DialogHeader className="pb-1">
          <DialogTitle className="text-16 font-semibold tracking-tight text-foreground">
            {templateType === 'example' ? 'New example page' : 'New page'}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Create a new page in the current project.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-1">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="page-title" className="text-12 font-medium text-foreground">
              Page title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="page-title"
              placeholder="Page title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              className="h-9 text-13 rounded-md shadow-none focus-visible:ring-1 focus-visible:ring-ring"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && title.trim() && !isCreating) {
                  e.preventDefault();
                  handleCreate();
                }
              }}
            />
          </div>
        </div>

        <DialogFooter className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setIsOpen(false)}
            disabled={isCreating}
            className="h-8 px-3 text-12 font-medium cursor-pointer text-foreground rounded-md hover:bg-muted relative before:absolute before:-inset-1 md:before:hidden focus-visible:ring-1 focus-visible:ring-ring"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleCreate}
            disabled={!title.trim() || isCreating}
            className="h-8 px-4 text-12 font-medium cursor-pointer rounded-md shadow-none relative before:absolute before:-inset-1 md:before:hidden focus-visible:ring-1 focus-visible:ring-ring"
          >
            {isCreating ? (
              <>
                <Loader2 className="mr-1.5 size-3.5 animate-spin motion-reduce:animate-none" />
                Creating...
              </>
            ) : (
              'Create'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
