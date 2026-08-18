'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Input,
  Label,
  Textarea,
} from '@/shared/components/ui';
import { toast } from 'sonner';

interface LogModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (data: { taskTitle: string; hours: number; date: string; description: string }) => void;
}

export function LogModal({ open, onOpenChange, onAdd }: LogModalProps) {
  const [taskTitle, setTaskTitle] = useState('');
  const [hours, setHours] = useState('1');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) {
      toast.error('Please enter a task or activity name');
      return;
    }
    const numHours = parseFloat(hours) || 1;

    onAdd({
      taskTitle: taskTitle.trim(),
      hours: numHours,
      date,
      description: description.trim(),
    });

    onOpenChange(false);
    setTaskTitle('');
    setHours('1');
    setDescription('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-lg border border-border/80 bg-background shadow-xl">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold text-foreground">
            Log research work
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-foreground">Task or activity *</Label>
            <Input
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              placeholder="e.g. Manuscript drafting / Model training"
              className="h-8.5 text-xs rounded-md border-border/80 bg-background focus:ring-0 focus:outline-none"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">Hours spent *</Label>
              <Input
                type="number"
                step="0.5"
                min="0.25"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                className="h-8.5 text-xs rounded-md border-border/80 bg-background focus:ring-0 focus:outline-none"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">Date *</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-8.5 text-xs rounded-md border-border/80 bg-background focus:ring-0 focus:outline-none"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-foreground">Description / Notes</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What was accomplished during this session?"
              className="text-xs min-h-[80px] rounded-md border-border/80 bg-background focus:ring-0 focus:outline-none resize-none leading-relaxed"
            />
          </div>

          <DialogFooter className="pt-2 gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-8 text-xs font-medium px-4 cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              className="h-8 text-xs font-medium px-4 bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer shadow-2xs"
            >
              Save worklog
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
