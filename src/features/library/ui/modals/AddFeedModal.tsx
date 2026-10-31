'use client';

import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
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
import { cn } from '@/shared/lib/utils';

import {
  useFetchAcademicFeed,
  useSubscribeFeedMutation,
} from '@/features/library/sdk/queries/ingestion.queries';
import {
  addFeedSchema,
  type AddFeedFormValues,
} from '@/features/library/domain/types/forms.types';
import {
  READ_RETENTION_OPTIONS,
  UNREAD_RETENTION_OPTIONS,
  type FeedRetentionDays,
} from '@/features/library/domain/types/feeds.types';

export interface AddFeedModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit?: (data: AddFeedFormValues) => Promise<unknown> | void;
  isPending?: boolean;
}

export function AddFeedModal({
  open,
  onOpenChange,
  onSubmit,
  isPending: externalPending,
}: AddFeedModalProps) {
  const router = useRouter();
  const { mutateAsync: subscribeFeed } = useSubscribeFeedMutation();
  const { mutateAsync: fetchAcademicFeed } = useFetchAcademicFeed();

  const [internalSubmitting, setInternalSubmitting] = useState(false);
  const [isAutoFetchingTitle, setIsAutoFetchingTitle] = useState(false);

  const isSubmitting = externalPending ?? internalSubmitting;

  const form = useForm<AddFeedFormValues>({
    resolver: zodResolver(addFeedSchema),
    defaultValues: {
      url: '',
      name: '',
      retentionDays: 30,
      cleanupReadAfter: 7,
      cleanupUnreadAfter: 30,
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
    getValues,
    formState: { errors },
  } = form;

  useEffect(() => {
    if (open) {
      reset({
        url: '',
        name: '',
        retentionDays: 30,
        cleanupReadAfter: 7,
        cleanupUnreadAfter: 30,
      });
      setInternalSubmitting(false);
      setIsAutoFetchingTitle(false);
    }
  }, [open, reset]);

  const handleUrlBlur = async () => {
    if (!open || isSubmitting) return;
    const currentUrl = (getValues('url') || '').trim();
    const currentName = (getValues('name') || '').trim();
    if (!currentUrl || currentName) return;

    const isUrlValid = z.string().url().safeParse(currentUrl).success;
    if (!isUrlValid) return;

    setIsAutoFetchingTitle(true);
    try {
      const res = await fetchAcademicFeed({ url: currentUrl, silent: true });
      const payload =
        typeof res === 'object' && res !== null && 'data' in res
          ? (res as { data?: { feedTitle?: string } }).data
          : (res as { feedTitle?: string });
      const detectedTitle = payload?.feedTitle;
      if (
        detectedTitle &&
        typeof detectedTitle === 'string' &&
        !(getValues('name') || '').trim()
      ) {
        setValue('name', detectedTitle.trim(), {
          shouldValidate: true,
          shouldDirty: true,
        });
      }
    } catch {
      // background detection error - safe to ignore
    } finally {
      setIsAutoFetchingTitle(false);
    }
  };

  const onValidSubmit = async (data: AddFeedFormValues) => {
    if (onSubmit) {
      await onSubmit(data);
      return;
    }

    setInternalSubmitting(true);
    try {
      let finalName = (data.name || '').trim();
      if (!finalName) {
        try {
          const res = await fetchAcademicFeed({ url: data.url, silent: true });
          const payload =
            typeof res === 'object' && res !== null && 'data' in res
              ? (res as { data?: { feedTitle?: string } }).data
              : (res as { feedTitle?: string });
          if (payload?.feedTitle) {
            finalName = payload.feedTitle.trim();
          }
        } catch {
          // fallback to domain naming in store
        }
      }

      const newFeed = await subscribeFeed({
        name: finalName || 'Academic Feed',
        url: data.url,
        retentionDays: data.cleanupUnreadAfter ?? data.retentionDays,
        cleanupReadAfter: data.cleanupReadAfter ?? 7,
        cleanupUnreadAfter: data.cleanupUnreadAfter ?? data.retentionDays,
      });
      toast.success(`Subscribed to "${newFeed.name}"`);
      onOpenChange(false);
      if (newFeed.id) {
        router.push(`/library/feeds/${newFeed.id}`);
      }
    } catch {
      toast.error('Failed to subscribe to feed');
    } finally {
      setInternalSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (isSubmitting) return; onOpenChange(v); }}>
      <DialogContent
        onCloseAutoFocus={(e) => e.preventDefault()}
        className="sm:max-w-[460px] p-6 bg-background border border-border shadow-raised-200 rounded-lg gap-0"
      >
        <form onSubmit={handleSubmit(onValidSubmit)} className="space-y-4">
          <DialogHeader className="text-left pb-0">
            <DialogTitle className="text-15 font-semibold text-foreground tracking-tight">
              New RSS Feed
            </DialogTitle>
            <DialogDescription className="sr-only">
              Subscribe to an RSS or Atom feed.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 pt-1">
            {/* URL Field */}
            <div className="space-y-1.5">
              <Label
                htmlFor="feed-url"
                className="text-12 font-medium text-foreground inline-flex items-center gap-0.5"
              >
                <span>URL</span>
                <span className="text-destructive" aria-hidden="true">*</span>
              </Label>
              <Input
                id="feed-url"
                type="url"
                placeholder="https://rss.arxiv.org/rss/cs.AI"
                autoFocus
                {...register('url', {
                  onBlur: handleUrlBlur,
                })}
                className={cn(
                  "h-8 text-13 rounded-md bg-background border-border hover:border-border-hover focus-visible:border-primary focus-visible:ring-ring placeholder:text-muted-foreground text-foreground shadow-none transition-colors",
                  errors.url && "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20"
                )}
              />
              {errors.url && (
                <p className="text-11 text-destructive font-medium mt-1">
                  {errors.url.message}
                </p>
              )}
            </div>

            {/* Title Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="feed-name" className="text-12 font-medium text-foreground">
                  Title
                </Label>
                {isAutoFetchingTitle && (
                  <span className="text-11 text-muted-foreground flex items-center gap-1">
                    <Loader2 className="size-3 animate-spin text-primary" /> Auto-detecting...
                  </span>
                )}
              </div>
              <Input
                id="feed-name"
                placeholder="Leave blank to auto-detect from feed"
                {...register('name')}
                className="h-8 text-13 rounded-md bg-background border-border hover:border-border-hover focus-visible:border-primary focus-visible:ring-ring placeholder:text-muted-foreground text-foreground shadow-none transition-colors"
              />
              {errors.name && (
                <p className="text-11 text-destructive font-medium mt-1">
                  {errors.name.message}
                </p>
              )}
            </div>

            {/* Retention Policy (Unread vs Read) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="space-y-1.5">
                <Label htmlFor="feed-retention" className="text-12 font-medium text-foreground">
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
                        id="feed-retention"
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
                <Label htmlFor="feed-read-retention" className="text-12 font-medium text-foreground">
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
                        id="feed-read-retention"
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
              disabled={isSubmitting}
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
              Save Feed
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default AddFeedModal;
