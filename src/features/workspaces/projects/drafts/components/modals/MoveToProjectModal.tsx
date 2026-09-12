'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Label } from '@/shared/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { FolderInput } from 'lucide-react';
import type { WorkItemDraft } from '../../types/draft.types';

interface MoveToProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  draft: WorkItemDraft | null;
  projects: Array<{ id: string; name: string; identifier?: string }>;
  onMove: (draftId: string, projectId: string, columnId?: string) => Promise<void>;
  isMoving: boolean;
}

export const MoveToProjectModal: React.FC<MoveToProjectModalProps> = ({
  isOpen,
  onClose,
  draft,
  projects,
  onMove,
  isMoving,
}) => {
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');

  useEffect(() => {
    if (isOpen && draft) {
      if (draft.projectId && projects.some((p) => p.id === draft.projectId)) {
        setSelectedProjectId(draft.projectId);
      } else if (projects.length > 0) {
        setSelectedProjectId(projects[0].id);
      }
    }
  }, [isOpen, draft, projects]);

  const handleConfirm = async () => {
    if (!draft || !selectedProjectId) return;
    await onMove(draft.id, selectedProjectId);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md p-5 bg-background border border-border rounded-lg shadow-raised-200">
        <DialogHeader className="text-left space-y-1.5">
          <div className="flex items-center gap-2 mb-0.5">
            <div className="size-8 rounded-md bg-muted text-foreground flex items-center justify-center shrink-0">
              <FolderInput className="size-4 shrink-0 text-foreground" />
            </div>
            <DialogTitle className="text-14 font-semibold tracking-tight text-foreground">
              Move to project
            </DialogTitle>
          </div>
          <DialogDescription className="text-12 text-muted-foreground leading-relaxed">
            Publish this draft as an active work item. An official work item identifier will be
            assigned, and this draft will be removed from your private drafts.
          </DialogDescription>
        </DialogHeader>

        <div className="py-3 flex flex-col gap-3">
          {draft && (
            <div className="p-2.5 rounded-md bg-muted border border-border">
              <span className="text-11 text-muted-foreground font-medium block">Draft to publish:</span>
              <p className="text-13 font-medium text-foreground mt-0.5 truncate">
                {draft.title || 'Untitled Draft'}
              </p>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label className="text-12 font-medium text-foreground">Destination Project *</Label>
            <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
              <SelectTrigger className="h-8 text-12 rounded-md border-border bg-background">
                <SelectValue placeholder="Choose project..." />
              </SelectTrigger>
              <SelectContent className="bg-background border border-border">
                {projects.map((proj) => (
                  <SelectItem key={proj.id} value={proj.id} className="text-12 cursor-pointer">
                    {proj.name} ({proj.identifier || 'PROJ'})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isMoving}
            className="h-8 px-3 rounded-md text-12 font-medium border-border bg-background hover:bg-muted text-foreground cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleConfirm}
            disabled={!selectedProjectId || isMoving}
            className="h-8 px-3.5 rounded-md text-12 font-medium bg-primary text-primary-foreground hover:bg-primary-hover shadow-none transition-colors cursor-pointer"
          >
            {isMoving ? 'Moving...' : 'Move to project'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
