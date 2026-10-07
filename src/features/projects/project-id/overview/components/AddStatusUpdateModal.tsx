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
import { CheckCircle2, AlertTriangle, AlertOctagon, Loader2 } from 'lucide-react';
import { ProjectStatusIndicator } from '../types/overview.types';
import { toast } from 'sonner';

interface AddStatusUpdateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { status: ProjectStatusIndicator; message: string }) => Promise<void>;
}

const STATUS_OPTIONS: {
  value: ProjectStatusIndicator;
  label: string;
  description: string;
  icon: React.ElementType;
  activeColor: string;
  badgeBg: string;
  textColor: string;
}[] = [
  {
    value: 'on_track',
    label: 'On Track',
    description: 'Progressing as planned, no blockers',
    icon: CheckCircle2,
    activeColor: 'border-success bg-success/10 text-success ring-1 ring-success',
    badgeBg: 'bg-success/15 text-success',
    textColor: 'text-success',
  },
  {
    value: 'at_risk',
    label: 'At Risk',
    description: 'Potential delays or emerging blockers',
    icon: AlertTriangle,
    activeColor: 'border-warning bg-warning/10 text-warning ring-1 ring-warning',
    badgeBg: 'bg-warning/15 text-warning',
    textColor: 'text-warning',
  },
  {
    value: 'off_track',
    label: 'Off Track',
    description: 'Major blockers or critical delays',
    icon: AlertOctagon,
    activeColor: 'border-destructive bg-destructive/10 text-destructive ring-1 ring-destructive',
    badgeBg: 'bg-destructive/15 text-destructive',
    textColor: 'text-destructive',
  },
];

export function AddStatusUpdateModal({
  open,
  onOpenChange,
  onSubmit,
}: AddStatusUpdateModalProps) {
  const [selectedStatus, setSelectedStatus] = useState<ProjectStatusIndicator>('on_track');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanMessage = message.trim();

    if (!cleanMessage) {
      toast.error('Please enter an update message', { id: 'project-status-update' });
      return;
    }

    try {
      setIsSubmitting(true);
      await onSubmit({ status: selectedStatus, message: cleanMessage });
      toast.success('Project status update posted', { id: 'project-status-update' });
      setMessage('');
      setSelectedStatus('on_track');
      onOpenChange(false);
    } catch (err: any) {
      const msg = err?.message || 'Failed to post project status update';
      toast.error(msg, { id: 'project-status-update' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] shadow-raised-200">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="text-16 font-semibold">Post Project Status Update</DialogTitle>
            <DialogDescription className="text-13 text-muted-foreground">
              Inform stakeholders and team members about current project health, highlights, and risks.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-4">
            {/* Status Selector */}
            <div className="flex flex-col gap-2">
              <Label className="text-12 font-medium text-foreground">Project Health Status</Label>
              <div className="grid grid-cols-3 gap-2">
                {STATUS_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const isSelected = selectedStatus === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setSelectedStatus(opt.value)}
                      disabled={isSubmitting}
                      className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all cursor-pointer select-none relative before:absolute before:-inset-1 md:before:hidden focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
                        isSelected
                          ? opt.activeColor
                          : 'border-border/60 bg-muted/30 hover:bg-muted/60 text-muted-foreground'
                      }`}
                    >
                      <Icon className={`size-5 mb-1.5 ${isSelected ? opt.textColor : 'text-muted-foreground'}`} />
                      <span className="text-xs font-semibold">{opt.label}</span>
                      <span className="text-10 leading-tight opacity-75 mt-0.5 line-clamp-2">
                        {opt.value === 'on_track' ? 'On schedule' : opt.value === 'at_risk' ? 'Has risks' : 'Delayed'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Message Area */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="status-message" className="text-12 font-medium text-foreground">
                Update Summary & Details
              </Label>
              <Textarea
                id="status-message"
                placeholder="Summarize recent progress, key deliverables completed, or any blockers requiring attention..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                disabled={isSubmitting}
                className="min-h-[110px] text-13 resize-none focus-visible:ring-1 focus-visible:ring-ring"
                maxLength={2000}
              />
              <div className="flex justify-end text-10 text-muted-foreground">
                {message.length} / 2000
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="h-8 px-3 text-12 font-medium cursor-pointer relative before:absolute before:-inset-1 md:before:hidden focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting || !message.trim()}
              className="h-8 px-3 text-12 font-medium gap-1.5 cursor-pointer relative before:absolute before:-inset-1 md:before:hidden focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Posting...</span>
                </>
              ) : (
                'Post Update'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
