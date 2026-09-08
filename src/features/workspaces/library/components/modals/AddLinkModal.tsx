'use client';

import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
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

export interface AddLinkData {
  url: string;
  title?: string;
  fileUrl?: string;
  filename?: string;
  mimeType?: string;
  size?: number;
  [key: string]: any;
}

export interface AddLinkModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: AddLinkData) => Promise<any> | void;
  isPending?: boolean;
}

export default function AddLinkModal({
  open,
  onOpenChange,
  onSubmit,
  isPending = false,
}: AddLinkModalProps) {
  const [urlInput, setUrlInput] = useState('');
  const [titleInput, setTitleInput] = useState('');

  const reset = () => {
    setUrlInput('');
    setTitleInput('');
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmedUrl = urlInput.trim();
    if (!trimmedUrl) return;

    const trimmedTitle = titleInput.trim();
    const derivedName = trimmedUrl.split('/').pop()?.split('?')[0] || 'linked-document.pdf';
    const finalFilename = derivedName.endsWith('.pdf') ? derivedName : `${derivedName}.pdf`;

    try {
      await onSubmit({
        url: trimmedUrl,
        title: trimmedTitle || undefined,
        fileUrl: trimmedUrl,
        filename: finalFilename,
        mimeType: 'application/pdf',
        size: 0,
      });

      reset();
      onOpenChange(false);
    } catch {
      // Handled by parent
    }
  };

  const canSubmit = Boolean(urlInput.trim()) && !isPending;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        onCloseAutoFocus={(e) => e.preventDefault()}
        className="sm:max-w-md bg-background border border-border/60 shadow-none rounded-md"
      >
        <DialogHeader>
          <DialogTitle className="text-base font-medium text-foreground">
            Attach Link to URI
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Link Field */}
          <div className="space-y-1.5">
            <Label htmlFor="link-url-input" className="text-sm font-medium text-foreground">
              Link
            </Label>
            <Input
              id="link-url-input"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              className="h-9 text-sm font-mono text-foreground rounded-md border-border/60"
              autoFocus
              required
            />
          </div>

          {/* Title Field */}
          <div className="space-y-1.5">
            <Label htmlFor="link-title-input" className="text-sm font-medium text-foreground">
              Title
            </Label>
            <Input
              id="link-title-input"
              placeholder="(Optional)"
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              className="h-9 text-sm text-foreground rounded-md border-border/60"
            />
          </div>

          {/* Footer */}
          <DialogFooter className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleOpenChange(false)}
              disabled={isPending}
              className="h-9 px-4 text-sm font-medium cursor-pointer text-foreground rounded-md"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!canSubmit}
              className="h-9 px-4 text-sm font-medium cursor-pointer min-w-[80px] rounded-md"
            >
              {isPending ? (
                <Loader2 className="size-4 animate-spin text-background" />
              ) : (
                'Confirm'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
