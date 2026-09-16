'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { ProjectLink } from '../types/overview.types';
import { toast } from 'sonner';

interface AddLinkModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { title: string; url: string }) => Promise<void>;
  initialData?: ProjectLink | null;
}

export function AddLinkModal({
  open,
  onOpenChange,
  onSubmit,
  initialData,
}: AddLinkModalProps) {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title);
      setUrl(initialData.url);
    } else {
      setTitle('');
      setUrl('');
    }
  }, [initialData, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = title.trim();
    let cleanUrl = url.trim();

    if (!cleanTitle) {
      toast.error('Please enter a link title', { id: 'project-link-action' });
      return;
    }

    if (!cleanUrl) {
      toast.error('Please enter a URL', { id: 'project-link-action' });
      return;
    }

    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = `https://${cleanUrl}`;
    }

    try {
      setIsSubmitting(true);
      await onSubmit({ title: cleanTitle, url: cleanUrl });
      toast.success(initialData ? 'Link updated' : 'Pinned link added', { id: 'project-link-action' });
      onOpenChange(false);
    } catch (err: any) {
      const msg = err?.message || 'Failed to save link';
      toast.error(msg, { id: 'project-link-action' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {initialData ? 'Edit Pinned Link' : 'Add Pinned Resource / Link'}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="link-title" className="text-sm font-medium">
                Title
              </Label>
              <Input
                id="link-title"
                placeholder="e.g. Figma Design, GitHub Repo, Slack"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={255}
                disabled={isSubmitting}
                autoFocus
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="link-url" className="text-sm font-medium">
                URL
              </Label>
              <Input
                id="link-url"
                placeholder="https://..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? 'Saving...'
                : initialData
                  ? 'Update Link'
                  : 'Add Link'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
