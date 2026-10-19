'use client';

import React, { useState, useEffect } from 'react';
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
import { Rss, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useFeedsStore } from '@/features/library/core/store/feeds.store';
import type { SavedFeedSubscription } from '@/features/library/domain/types/feeds.types';

export interface EditFeedModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feed: SavedFeedSubscription | null;
}

export function EditFeedModal({ open, onOpenChange, feed }: EditFeedModalProps) {
  const updateFeed = useFeedsStore((s) => s.updateFeed);

  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [retentionDays, setRetentionDays] = useState<number>(30);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (feed) {
      setName(feed.name || '');
      setUrl(feed.url || '');
      setRetentionDays(feed.retentionDays ?? 30);
    }
  }, [feed, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!feed) return;

    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      toast.error('Please enter a valid feed URL');
      return;
    }

    setIsSubmitting(true);
    try {
      const trimmedName = name.trim() || trimmedUrl.replace(/^https?:\/\/(www\.)?/i, '').slice(0, 42);
      updateFeed(feed.id, {
        name: trimmedName,
        url: trimmedUrl,
        retentionDays,
      });
      toast.success(`Updated feed "${trimmedName}"`);
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
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader className="p-0 space-y-0 text-left">
            <DialogTitle className="text-14 font-semibold text-foreground tracking-tight">
              Edit RSS Feed
            </DialogTitle>
            <DialogDescription className="sr-only">
              Update title or RSS endpoint URL for this academic feed.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-feed-url" className="text-11 font-medium text-foreground inline-flex items-center">
                <span>URL</span>
                <span className="text-destructive ml-0.5" aria-hidden="true">*</span>
              </Label>
              <Input
                id="edit-feed-url"
                type="url"
                placeholder="https://rss.arxiv.org/rss/cs.AI"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                autoFocus
                required
                className="h-8 text-13 rounded-md bg-background border-border hover:border-border-hover focus-visible:border-primary focus-visible:ring-ring placeholder:text-muted-foreground text-foreground shadow-none"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-feed-name" className="text-11 font-medium text-foreground">
                Title
              </Label>
              <Input
                id="edit-feed-name"
                placeholder="e.g. arXiv Artificial Intelligence"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-8 text-13 rounded-md bg-background border-border hover:border-border-hover focus-visible:border-primary focus-visible:ring-ring placeholder:text-muted-foreground text-foreground shadow-none"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-feed-retention" className="text-11 font-medium text-foreground">
                Feed Retention (Clean older items)
              </Label>
              <select
                id="edit-feed-retention"
                value={retentionDays}
                onChange={(e) => setRetentionDays(Number(e.target.value))}
                className="h-8 w-full text-13 rounded-md bg-background border border-border px-2 text-foreground focus-visible:outline-none focus-visible:border-primary cursor-pointer"
              >
                <option value={7}>Keep items from last 7 days</option>
                <option value={14}>Keep items from last 14 days</option>
                <option value={30}>Keep items from last 30 days (Recommended)</option>
                <option value={90}>Keep items from last 90 days</option>
                <option value={0}>Never delete (Keep all)</option>
              </select>
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
              disabled={isSubmitting || !url.trim()}
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
