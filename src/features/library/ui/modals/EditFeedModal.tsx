'use client';

import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
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
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/shared/components/ui/select';

import { useFeedsStore } from '@/features/library/core/store/feeds.store';
import { useUpdateFeedSubscriptionMutation } from '@/features/library/sdk/queries/ingestion.queries';
import type { SavedFeedSubscription } from '@/features/library/domain/types/feeds.types';
import {
  editFeedSchema,
  type EditFeedFormValues,
} from '@/features/library/domain/types/forms.types';
import {
  READ_RETENTION_OPTIONS,
  UNREAD_RETENTION_OPTIONS,
  type FeedRetentionDays,
} from '@/features/library/domain/types/feeds.types';

export interface EditFeedModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feed: SavedFeedSubscription | null;
}

export function EditFeedModal({ open, onOpenChange, feed }: EditFeedModalProps) {
  const { mutateAsync: updateFeedSubscription } = useUpdateFeedSubscriptionMutation();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<EditFeedFormValues>({
    resolver: zodResolver(editFeedSchema),
    defaultValues: {
      url: feed?.url || '',
      name: feed?.name || '',
      retentionDays: (feed?.cleanupUnreadAfter ?? feed?.retentionDays ?? 30) as FeedRetentionDays,
      cleanupReadAfter: (feed?.cleanupReadAfter ?? 7) as FeedRetentionDays,
      cleanupUnreadAfter: (feed?.cleanupUnreadAfter ?? feed?.retentionDays ?? 30) as FeedRetentionDays,
    },
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  });

  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    formState: { errors },
  } = form;

  useEffect(() => {
    if (feed && open) {
      reset({
        url: feed.url || '',
        name: feed.name || '',
        retentionDays: (feed.cleanupUnreadAfter ?? feed.retentionDays ?? 30) as FeedRetentionDays,
        cleanupReadAfter: (feed.cleanupReadAfter ?? 7) as FeedRetentionDays,
        cleanupUnreadAfter: (feed.cleanupUnreadAfter ?? feed.retentionDays ?? 30) as FeedRetentionDays,
      });
      setIsSubmitting(false);
    }
  }, [feed, open, reset]);

  const onValidSubmit = async (data: EditFeedFormValues) => {
    if (!feed) return;

    setIsSubmitting(true);
    try {
      await updateFeedSubscription({
        id: feed.id,
        updates: {
          name: data.name.trim(),
          url: data.url.trim(),
          retentionDays: data.retentionDays,
          cleanupReadAfter: data.cleanupReadAfter ?? 7,
          cleanupUnreadAfter: data.retentionDays,
        },
      });
      toast.success(`Updated feed "${data.name.trim()}"`);
      onOpenChange(false);
    } catch {
      toast.error('Failed to update feed');
    } finally {
      setIsSubmitting(false);
    }
  };

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
              <Label htmlFor="edit-feed-url" className="text-12 font-medium text-foreground inline-flex items-center">
                <span>Feed URL</span>
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
                className="h-8 text-12 rounded-md bg-background border-border hover:border-border-hover focus-visible:border-primary focus-visible:ring-ring placeholder:text-muted-foreground text-foreground shadow-none"
              />
              {errors.url && <p className="text-11 text-destructive">{errors.url.message}</p>}
            </div>

            {/* Title Field */}
            <div className="space-y-1.5">
              <Label htmlFor="edit-feed-name" className="text-12 font-medium text-foreground inline-flex items-center">
                <span>Title</span>
                <span className="text-destructive ml-0.5" aria-hidden="true">
                  *
                </span>
              </Label>
              <Input
                id="edit-feed-name"
                placeholder="Feed title"
                {...register('name')}
                className="h-8 text-12 rounded-md bg-background border-border hover:border-border-hover focus-visible:border-primary focus-visible:ring-ring placeholder:text-muted-foreground text-foreground shadow-none"
              />
              {errors.name && <p className="text-11 text-destructive">{errors.name.message}</p>}
            </div>

            {/* Retention Policy (Unread vs Read) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="space-y-1.5">
                <Label htmlFor="edit-feed-retention" className="text-12 font-medium text-foreground">
                  Remove Unread Items
                </Label>
                <Controller
                  name="retentionDays"
                  control={control}
                  render={({ field }) => (
                    <Select
                      value={String(field.value ?? 30)}
                      onValueChange={(val) => {
                        const num = Number(val) as FeedRetentionDays;
                        field.onChange(num);
                        setValue('cleanupUnreadAfter', num);
                      }}
                    >
                      <SelectTrigger
                        id="edit-feed-retention"
                        className="w-full h-8 text-12 text-foreground justify-between rounded-md border-border bg-background hover:border-border-hover focus-visible:border-primary cursor-pointer"
                      >
                        <SelectValue placeholder="Select retention" />
                      </SelectTrigger>
                      <SelectContent className="max-h-60 bg-popover text-popover-foreground border border-border shadow-raised-200 rounded-md">
                        {UNREAD_RETENTION_OPTIONS.map((option) => (
                          <SelectItem
                            key={option.value}
                            value={String(option.value)}
                            className="text-12 py-1.5 px-2"
                          >
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-feed-read-retention" className="text-12 font-medium text-foreground">
                  Remove Read Items
                </Label>
                <Controller
                  name="cleanupReadAfter"
                  control={control}
                  render={({ field }) => (
                    <Select
                      value={String(field.value ?? 7)}
                      onValueChange={(val) =>
                        field.onChange(Number(val) as FeedRetentionDays)
                      }
                    >
                      <SelectTrigger
                        id="edit-feed-read-retention"
                        className="w-full h-8 text-12 text-foreground justify-between rounded-md border-border bg-background hover:border-border-hover focus-visible:border-primary cursor-pointer"
                      >
                        <SelectValue placeholder="Select cleanup time" />
                      </SelectTrigger>
                      <SelectContent className="max-h-60 bg-popover text-popover-foreground border border-border shadow-raised-200 rounded-md">
                        {READ_RETENTION_OPTIONS.map((option) => (
                          <SelectItem
                            key={option.value}
                            value={String(option.value)}
                            className="text-12 py-1.5 px-2"
                          >
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="flex items-center justify-end gap-2 pt-3 sm:space-x-0">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-8 px-3 text-12 font-medium cursor-pointer text-foreground rounded-md hover:bg-muted"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="h-8 px-4 text-12 font-medium cursor-pointer rounded-md shadow-none"
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