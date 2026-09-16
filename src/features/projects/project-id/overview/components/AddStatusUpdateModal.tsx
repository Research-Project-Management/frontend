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
    activeColor: 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500',
    badgeBg: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
    textColor: 'text-emerald-600 dark:text-emerald-400',
  },
  {
    value: 'at_risk',
    label: 'At Risk',
    description: 'Potential delays or emerging blockers',
    icon: AlertTriangle,
    activeColor: 'border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500',
    badgeBg: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
    textColor: 'text-amber-600 dark:text-amber-400',
  },
  {
    value: 'off_track',
    label: 'Off Track',
    description: 'Major blockers or critical delays',
    icon: AlertOctagon,
    activeColor: 'border-rose-500 bg-rose-500/10 text-rose-700 dark:text-rose-300 ring-1 ring-rose-500',
    badgeBg: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300',
    textColor: 'text-rose-600 dark:text-rose-400',
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
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Post Project Status Update</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Inform stakeholders and team members about current project health, highlights, and risks.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-4">
            {/* Status Selector */}
            <div className="flex flex-col gap-2">
              <Label className="text-xs font-semibold text-foreground">Project Health Status</Label>
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
                      className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all cursor-pointer select-none ${
                        isSelected
                          ? opt.activeColor
                          : 'border-border/60 bg-muted/30 hover:bg-muted/60 text-muted-foreground'
                      }`}
                    >
                      <Icon className={`size-5 mb-1.5 ${isSelected ? opt.textColor : 'text-muted-foreground'}`} />
                      <span className="text-xs font-semibold">{opt.label}</span>
                      <span className="text-[10px] leading-tight opacity-75 mt-0.5 line-clamp-2">
                        {opt.value === 'on_track' ? 'On schedule' : opt.value === 'at_risk' ? 'Has risks' : 'Delayed'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Message Area */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="status-message" className="text-xs font-semibold text-foreground">
                Update Summary & Details
              </Label>
              <Textarea
                id="status-message"
                placeholder="Summarize recent progress, key deliverables completed, or any blockers requiring attention..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                disabled={isSubmitting}
                className="min-h-[110px] text-xs resize-none"
                maxLength={2000}
              />
              <div className="flex justify-end text-[10px] text-muted-foreground">
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
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting || !message.trim()}
              className="text-xs gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Posting...
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
