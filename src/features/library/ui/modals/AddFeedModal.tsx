'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { Loader2, UploadCloud } from 'lucide-react';
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
import { useFetchAcademicFeed } from '@/features/library/sdk/queries/ingestion.queries';
import { parseOpmlFeeds } from '@/features/library/domain/feed-parser.domain';
import {
  addFeedSchema,
  type AddFeedFormValues,
} from '@/features/library/domain/types/forms.types';
import { RETENTION_OPTIONS } from '@/features/library/domain/types/feeds.types';

export interface AddFeedModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddFeedModal({ open, onOpenChange }: AddFeedModalProps) {
  const router = useRouter();
  const addFeed = useFeedsStore((s) => s.addFeed);
  const { mutateAsync: fetchAcademicFeed } = useFetchAcademicFeed();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAutoFetchingTitle, setIsAutoFetchingTitle] = useState(false);
  const opmlInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<AddFeedFormValues>({
    resolver: zodResolver(addFeedSchema),
    defaultValues: {
      url: '',
      name: '',
      retentionDays: 30,
    },
    mode: 'onTouched',
  });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    getValues,
    watch,
    formState: { errors },
  } = form;

  useEffect(() => {
    if (open) {
      reset({
        url: '',
        name: '',
        retentionDays: 30,
      });
      setIsSubmitting(false);
      setIsAutoFetchingTitle(false);
    }
  }, [open, reset]);

  const handleUrlBlur = async () => {
    const currentUrl = (getValues('url') || '').trim();
    const currentName = (getValues('name') || '').trim();
    if (!currentUrl || currentName) return;

    const isUrlValid = z.string().url().safeParse(currentUrl).success;
    if (!isUrlValid) return;

    setIsAutoFetchingTitle(true);
    try {
      const res = await fetchAcademicFeed(currentUrl);
      const payload =
        typeof res === 'object' && res !== null && 'data' in res
          ? (res as { data?: { feedTitle?: string } }).data
          : (res as { feedTitle?: string });
      const detectedTitle = payload?.feedTitle;
      if (detectedTitle && typeof detectedTitle === 'string' && !(getValues('name') || '').trim()) {
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
    setIsSubmitting(true);
    try {
      let finalName = (data.name || '').trim();
      if (!finalName) {
        try {
          const res = await fetchAcademicFeed(data.url);
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

      const newFeed = await addFeed(finalName, data.url, data.retentionDays);
      toast.success(`Subscribed to "${newFeed.name}"`);
      onOpenChange(false);
      router.push(`/library/feeds/${newFeed.id}`);
    } catch {
      toast.error('Failed to subscribe to feed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpmlFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content !== 'string') return;

      try {
        const parsed = parseOpmlFeeds(content);
        if (parsed.length > 0) {
          const currentRetention = getValues('retentionDays');
          for (const item of parsed) {
            addFeed(item.name, item.url, currentRetention);
          }
          toast.success(`Imported ${parsed.length} feeds from OPML`);
          onOpenChange(false);
        } else {
          toast.error('No valid RSS/Atom feeds found in OPML file');
        }
      } catch {
        toast.error('Failed to parse OPML file');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const watchedUrl = watch('url');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onCloseAutoFocus={(e) => e.preventDefault()}
        className="sm:max-w-[420px] p-5 bg-background border border-border shadow-raised-200 rounded-lg gap-0"
      >
        <form onSubmit={handleSubmit(onValidSubmit)} className="space-y-4">
          <DialogHeader className="p-0 space-y-0 text-left">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-14 font-semibold text-foreground tracking-tight">
                New RSS Feed
              </DialogTitle>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => opmlInputRef.current?.click()}
                className="h-7 px-2 text-11 text-muted-foreground hover:text-foreground cursor-pointer gap-1"
              >
                <UploadCloud className="size-3.5" />
                <span>Import OPML</span>
              </Button>
              <input
                ref={opmlInputRef}
                type="file"
                accept=".opml,.xml"
                className="hidden"
                onChange={handleOpmlFileChange}
              />
            </div>
            <DialogDescription className="sr-only">
              Subscribe to an academic journal or preprint RSS feed.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {/* Feed URL Field */}
            <div className="space-y-1.5">
              <Label htmlFor="feed-url" className="text-11 font-medium text-foreground inline-flex items-center">
                <span>URL</span>
                <span className="text-destructive ml-0.5" aria-hidden="true">
                  *
                </span>
              </Label>
              <Input
                id="feed-url"
                type="url"
                placeholder="https://rss.arxiv.org/rss/cs.AI"
                autoFocus
                {...register('url', {
                  onBlur: handleUrlBlur,
                })}
                className="h-8 text-13 rounded-md bg-background border-border hover:border-border-hover focus-visible:border-primary focus-visible:ring-ring placeholder:text-muted-foreground text-foreground shadow-none"
              />
              {errors.url && <p className="text-11 text-destructive">{errors.url.message}</p>}
            </div>

            {/* Feed Title Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="feed-name" className="text-11 font-medium text-foreground">
                  Title
                </Label>
                {isAutoFetchingTitle && (
                  <span className="text-11 text-muted-foreground flex items-center gap-1">
                    <Loader2 className="size-2.5 animate-spin" /> Fetching title...
                  </span>
                )}
              </div>
              <Input
                id="feed-name"
                placeholder="Leave blank to auto-detect from feed"
                {...register('name')}
                className="h-8 text-13 rounded-md bg-background border-border hover:border-border-hover focus-visible:border-primary focus-visible:ring-ring placeholder:text-muted-foreground text-foreground shadow-none"
              />
              {errors.name && <p className="text-11 text-destructive">{errors.name.message}</p>}
            </div>

            {/* Feed Retention Policy */}
            <div className="space-y-1.5">
              <Label htmlFor="feed-retention" className="text-11 font-medium text-foreground">
                Feed Retention (Clean older items)
              </Label>
              <select
                id="feed-retention"
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
              className="h-8 px-3 text-12 font-medium cursor-pointer text-foreground rounded-md hover:bg-muted"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting || !watchedUrl?.trim()}
              className="h-8 px-3.5 text-12 font-medium cursor-pointer rounded-md shadow-none"
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
