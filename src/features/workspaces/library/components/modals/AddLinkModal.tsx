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
        className="sm:max-w-md bg-background border border-border shadow-none rounded-md"
      >
        <DialogHeader>
          <DialogTitle className="text-base font-medium text-foreground">
            Attach Link to URI
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={handleSubmit(onValidSubmit)} className="space-y-4 pt-2">
            {/* Link Field */}
            <div className="space-y-1.5">
              <Label htmlFor="link-url-input" className="text-sm font-medium text-foreground">
                Link
              </Label>
              <Input
                id="link-url-input"
                {...register('url')}
                placeholder="https://..."
                className="h-9 text-sm font-mono text-foreground rounded-md border-border"
                autoFocus
              />
              {errors.url && (
                <p className="text-xs text-destructive font-medium">{errors.url.message}</p>
              )}
            </div>

            {/* Title Field */}
            <div className="space-y-1.5">
              <Label htmlFor="link-title-input" className="text-sm font-medium text-foreground">
                Title
              </Label>
              <Input
                id="link-title-input"
                placeholder="(Optional)"
                {...register('title')}
                className="h-9 text-sm text-foreground rounded-md border-border"
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
                disabled={isPending}
                className="h-9 px-4 text-sm font-medium cursor-pointer min-w-[80px] rounded-md"
              >
                {isPending ? (
                  <Loader2 className="size-4 animate-spin text-background shrink-0" />
                ) : (
                  'Confirm'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
