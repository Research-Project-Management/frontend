'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Textarea } from '@/shared/components/ui/textarea';
import { Label } from '@/shared/components/ui/label';
import { Loader2 } from 'lucide-react';
import { ProjectStatusIndicator } from '../types/overview.types';
import { toast } from 'sonner';

interface AddStatusUpdateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { status: ProjectStatusIndicator; message: string }) => Promise<void>;
  currentStatus?: ProjectStatusIndicator;
}

const STATUS_OPTIONS: Array<{
  value: ProjectStatusIndicator;
  label: string;
  dotColor: string;
  selectedClass: string;
}> = [
  {
    value: 'on_track',
    label: 'On Track',
    dotColor: 'bg-emerald-500',
    selectedClass: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium ring-1 ring-emerald-500/25',
  },
  {
    value: 'at_risk',
    label: 'At Risk',
    dotColor: 'bg-amber-500',
    selectedClass: 'border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium ring-1 ring-amber-500/25',
  },
  {
    value: 'off_track',
    label: 'Off Track',
    dotColor: 'bg-rose-500',
    selectedClass: 'border-rose-500/50 bg-rose-500/10 text-rose-600 dark:text-rose-400 font-medium ring-1 ring-rose-500/25',
  },
];

export function AddStatusUpdateModal({
  open,
  onOpenChange,
  onSubmit,
  currentStatus = 'on_track',
}: AddStatusUpdateModalProps) {
  const [selectedStatus, setSelectedStatus] = useState<ProjectStatusIndicator>(currentStatus);
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync initial state when modal opens
  React.useEffect(() => {
    if (open) {
      setSelectedStatus(currentStatus || 'on_track');
      setMessage('');
    }
  }, [open, currentStatus]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStatus) {
      toast.error('Please pick a project health status');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        status: selectedStatus,
        message: message.trim(),
      });
      toast.success('Project status updated successfully');
      onOpenChange(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to publish status update');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-5 gap-4 rounded-lg border-border bg-background shadow-raised-200">
        <DialogHeader className="gap-1 text-left">
          <DialogTitle className="text-16 font-semibold tracking-tight text-foreground">
            Update Status
          </DialogTitle>
          <DialogDescription className="sr-only">
            Update the overall health status and progress notes for this project.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Health Status selector - Clean Single Dot Indicator */}
          <div className="space-y-1.5">
            <Label className="text-12 font-medium text-foreground">
              Health Status
            </Label>
            <div className="grid grid-cols-3 gap-2">
              {STATUS_OPTIONS.map((opt) => {
                const isSelected = selectedStatus === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSelectedStatus(opt.value)}
                    className={`flex items-center justify-center gap-2 py-2 px-3 rounded-md border text-center transition-all cursor-pointer select-none outline-none focus-visible:ring-1 focus-visible:ring-primary ${
                      isSelected
                        ? opt.selectedClass
                        : 'border-border/70 bg-muted/20 hover:bg-muted/40 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <span className={`size-2 rounded-full shrink-0 ${opt.dotColor}`} />
                    <span className="text-12">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Update notes message */}
          <div className="space-y-1.5">
            <Label className="text-12 font-medium text-foreground">
              Description
            </Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Add status details, key progress or blockers..."
              rows={4}
              className="text-13 resize-none border-border bg-background focus-visible:ring-1 focus-visible:ring-ring rounded-md"
            />
          </div>

          <DialogFooter className="flex items-center justify-end gap-2.5 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="h-8 px-3 text-12 font-medium border-border hover:bg-muted"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="h-8 px-3 text-12 font-medium bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isSubmitting && <Loader2 className="size-3.5 mr-1.5 animate-spin" />}
              <span>Save Status</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default AddStatusUpdateModal;
