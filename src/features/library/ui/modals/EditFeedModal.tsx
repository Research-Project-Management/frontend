'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';

import { useFeedsStore } from '@/features/library/core/store/feeds.store';
import type { SavedFeedSubscription } from '@/features/library/domain/types/feeds.types';
import {
  editFeedSchema,
  type EditFeedFormValues,
} from '@/features/library/domain/types/forms.types';
import { RETENTION_OPTIONS } from '@/features/library/domain/types/feeds.types';

export interface EditFeedModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feed: SavedFeedSubscription | null;
}

export function EditFeedModal({ open, onOpenChange, feed }: EditFeedModalProps) {
  const updateFeed = useFeedsStore((s) => s.updateFeed);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<EditFeedFormValues>({
    resolver: zodResolver(editFeedSchema),
    defaultValues: {
      url: feed?.url || '',
      name: feed?.name || '',
      retentionDays: (feed?.retentionDays as 0 | 7 | 14 | 30 | 90) ?? 30,
    },
    mode: 'onTouched',
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = form;

  useEffect(() => {
    if (feed && open) {
      reset({
        url: feed.url || '',
        name: feed.name || '',
        retentionDays: (feed.retentionDays as 0 | 7 | 14 | 30 | 90) ?? 30,
      });
      setIsSubmitting(false);
    }
  }, [feed, open, reset]);

  const onValidSubmit = (data: EditFeedFormValues) => {
    if (!feed) return;

    setIsSubmitting(true);
    try {
      updateFeed(feed.id, {
        name: data.name.trim(),
        url: data.url.trim(),
        retentionDays: data.retentionDays,
      });
      toast.success(`Updated feed "${data.name.trim()}"`);
      onOpenChange(false);
    } catch {
      toast.error('Failed to update feed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const watchedUrl = watch('url');
  const watchedName = watch('name');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onCloseAutoFocus={(e) => e.preventDefault()}
        className="sm:max-w-[420px] p-5 bg-background border border-border shadow-raised-200 rounded-lg gap-0"
      >
        <form onSubmit={handleSubmit(onValidSubmit)} className="space-y-4">
          <DialogHeader className="p-0 space-y-0 text-left">
            <DialogTitle className="text-14 font-semibold text-foreground tracking-tight">
              Edit RSS Feed
            </DialogTitle>
            <DialogDescription className="sr-only">
              Update title or RSS endpoint URL for this academic feed.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {/* URL Field */}
            <div className="space-y-1.5">
              <Label htmlFor="edit-feed-url" className="text-11 font-medium text-foreground inline-flex items-center">
                <span>URL</span>
                <span className="text-destructive ml-0.5" aria-hidden="true">
                  *
                </span>
              </Label>
              <Input
                id="edit-feed-url"
                type="url"
                placeholder="https://rss.arxiv.org/rss/cs.AI"
                autoFocus
                {...register('url')}
                className="h-8 text-13 rounded-md bg-background border-border hover:border-border-hover focus-visible:border-primary focus-visible:ring-ring placeholder:text-muted-foreground text-foreground shadow-none"
              />
              {errors.url && <p className="text-11 text-destructive">{errors.url.message}</p>}
            </div>

            {/* Title Field */}
            <div className="space-y-1.5">
              <Label htmlFor="edit-feed-name" className="text-11 font-medium text-foreground inline-flex items-center">
                <span>Title</span>
                <span className="text-destructive ml-0.5" aria-hidden="true">
                  *
                </span>
              </Label>
              <Input
                id="edit-feed-name"
                placeholder="e.g. arXiv Artificial Intelligence"
                {...register('name')}
                className="h-8 text-13 rounded-md bg-background border-border hover:border-border-hover focus-visible:border-primary focus-visible:ring-ring placeholder:text-muted-foreground text-foreground shadow-none"
              />
              {errors.name && <p className="text-11 text-destructive">{errors.name.message}</p>}
            </div>

            {/* Retention Policy Field */}
            <div className="space-y-1.5">
              <Label htmlFor="edit-feed-retention" className="text-11 font-medium text-foreground">
                Feed Retention (Clean older items)
              </Label>
              <select
                id="edit-feed-retention"
                {...register('retentionDays', { valueAsNumber: true })}
                className="h-8 w-full text-13 rounded-md bg-background border border-border px-2 text-foreground focus-visible:outline-none focus-visible:border-primary cursor-pointer"
              >
                {RETENTION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {errors.retentionDays && (
                <p className="text-11 text-destructive">{errors.retentionDays.message}</p>
              )}
            </div>
          </div>

          <DialogFooter className="flex items-center justify-end gap-2 pt-1 sm:space-x-0">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-8 px-3 text-12 text-foreground cursor-pointer rounded-md hover:bg-muted font-medium"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting || !watchedUrl?.trim() || !watchedName?.trim()}
              className="h-8 px-3.5 text-12 font-medium cursor-pointer rounded-md shadow-none"
            >
              {isSubmitting && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default EditFeedModal;
