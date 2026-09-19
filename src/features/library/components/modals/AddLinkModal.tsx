'use client';

import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Form,
} from "@/shared/components/ui";
import { Button } from "@/shared/components/ui";
import { Input } from "@/shared/components/ui";
import { Label } from "@/shared/components/ui";
import {
  addLinkSchema,
  type AddLinkFormValues,
} from '../../schemas/library.schema';

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
  const form = useForm<AddLinkFormValues>({
    resolver: zodResolver(addLinkSchema),
    defaultValues: {
      url: '',
      title: '',
    },
    mode: 'onSubmit',
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = form;

  useEffect(() => {
    if (open) {
      reset({ url: '', title: '' });
    }
  }, [open, reset]);

  const handleOpenChange = (v: boolean) => {
    if (!v) reset({ url: '', title: '' });
    onOpenChange(v);
  };

  const onValidSubmit = async (data: AddLinkFormValues) => {
    const trimmedUrl = data.url.trim();
    if (!trimmedUrl) return;

    const trimmedTitle = data.title?.trim();
    let isPdf = false;
    let derivedName = 'linked-document';
    try {
      const parsed = new URL(trimmedUrl);
      const pathname = parsed.pathname;
      const lastSeg = pathname.split('/').filter(Boolean).pop() || '';
      if (lastSeg) derivedName = decodeURIComponent(lastSeg);
      isPdf = pathname.toLowerCase().endsWith('.pdf') || pathname.toLowerCase().includes('/pdf/');
    } catch {
      const simpleName = trimmedUrl.split('/').pop()?.split('?')[0] || '';
      if (simpleName) derivedName = simpleName;
      isPdf = trimmedUrl.toLowerCase().includes('.pdf');
    }

    const mimeType = isPdf ? 'application/pdf' : 'text/html';
    const finalFilename = isPdf
      ? (derivedName.toLowerCase().endsWith('.pdf') ? derivedName : `${derivedName}.pdf`)
      : (derivedName || 'webpage');

    try {
      await onSubmit({
        url: trimmedUrl,
        title: trimmedTitle || undefined,
        fileUrl: trimmedUrl,
        filename: finalFilename,
        mimeType,
        size: 0,
      });

      reset({ url: '', title: '' });
      onOpenChange(false);
    } catch {
      // Handled by parent
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        onCloseAutoFocus={(e) => e.preventDefault()}
        className="sm:max-w-[500px] p-6 bg-background border border-border shadow-raised-200 rounded-lg"
      >
        <DialogHeader className="text-left pb-1">
          <DialogTitle className="text-base font-medium text-foreground">
            Add Item by Identifier
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={handleSubmit(onValidSubmit)} className="space-y-4 pt-1">
            {/* Identifier / Link Field */}
            <div className="space-y-1.5">
              <Label htmlFor="link-url-input" className="text-11 font-medium text-muted-foreground">
                Identifier or URL
              </Label>
              <Input
                id="link-url-input"
                {...register('url')}
                placeholder="Enter DOI, ISBN, arXiv ID, PubMed ID, or URL..."
                className="h-8 text-12 font-mono text-foreground rounded-md border-border"
                autoFocus
              />
              {errors.url && (
                <p className="text-11 text-destructive font-medium">{errors.url.message}</p>
              )}
            </div>

            {/* Title Field (Optional) */}
            <div className="space-y-1.5">
              <Label htmlFor="link-title-input" className="text-11 font-medium text-muted-foreground">
                Title (Optional)
              </Label>
              <Input
                id="link-title-input"
                placeholder="Leave blank to auto-detect title"
                {...register('title')}
                className="h-8 text-12 text-foreground rounded-md border-border"
              />
            </div>

            {/* Footer */}
            <DialogFooter className="flex justify-end gap-2 pt-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => handleOpenChange(false)}
                disabled={isPending}
                className="h-8 px-3 text-12 font-medium cursor-pointer text-foreground rounded-md hover:bg-muted"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                className="h-8 px-3 text-12 font-medium cursor-pointer min-w-[90px] rounded-md shadow-none"
              >
                {isPending ? (
                  <Loader2 className="size-3.5 animate-spin text-primary-foreground shrink-0" />
                ) : (
                  'Add Item'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
