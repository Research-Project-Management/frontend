'use client';

import React, { useEffect } from 'react';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/shared/components/ui';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Form,
} from '@/shared/components/ui';
import { Checkbox } from '@/shared/components/ui';
import { Label } from '@/shared/components/ui';
import { cn } from '@/shared/lib/utils';
import type { Item } from '../../types/library.types';
import { normalizeAuthors, formatCreatorCompact } from '../../utils/library.util';
import {
  authorshipSchema,
  type AuthorshipFormValues,
} from '../../schemas/library.schema';

interface AuthorshipModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: Item | null;
  onConfirmAuthorship: (itemId: string, isMyPublication: boolean) => Promise<any>;
  isPending?: boolean;
}

export default function AuthorshipModal({
  open,
  onOpenChange,
  item,
  onConfirmAuthorship,
  isPending = false,
}: AuthorshipModalProps) {
  const form = useForm<AuthorshipFormValues>({
    resolver: zodResolver(authorshipSchema),
    defaultValues: {
      confirmed: false,
    },
    mode: 'onSubmit',
  });

  const { handleSubmit, reset, control } = form;
  const confirmed = useWatch({ control, name: 'confirmed' }) ?? false;

  useEffect(() => {
    if (open) {
      reset({ confirmed: false });
    }
  }, [open, item, reset]);

  if (!item) return null;

  const authors = normalizeAuthors(item.authors, item.creators, item.contributors);
  const authorCompact = formatCreatorCompact(authors);
  const isAlreadyPublication = Boolean(item.isMyPublication);

  const onValidSubmit = async (data: AuthorshipFormValues) => {
    if (!isAlreadyPublication && !data.confirmed) return;
    try {
      await onConfirmAuthorship(item.id, !isAlreadyPublication);
      onOpenChange(false);
    } catch {
      // Handled by service / mutation toast
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px] p-0 rounded-lg border border-border bg-background shadow-raised-200 font-sans gap-0 overflow-hidden">
        {/* Modal Header with 1px hairline border matching DESIGN.md */}
        <div className="px-5 py-3.5 border-b border-border bg-background flex items-center justify-between">
          <DialogHeader className="text-left gap-0">
            <DialogTitle className="text-14 font-semibold text-foreground">
              {isAlreadyPublication ? 'My Publications' : 'Add to My Publications'}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {isAlreadyPublication
                ? 'Manage My Publications item'
                : 'Confirm authorship and rights for My Publications'}
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Modal Body - Clean layout, no inner boxed frame */}
        <Form {...form}>
          <form onSubmit={handleSubmit(onValidSubmit)}>
            <div className="p-5 space-y-4 bg-background">
              {/* Reference Information */}
              <div className="space-y-1">
                <h4 className="text-13 font-medium text-foreground line-clamp-2 leading-snug">
                  {item.title || 'Untitled Reference'}
                </h4>
                <p className="text-12 text-muted-foreground truncate">
                  {authorCompact || 'Unknown Authors'}
                  {item.year ? ` • ${item.year}` : ''}
                </p>
              </div>

              {/* Official Zotero Advisory & Attestation */}
              {!isAlreadyPublication ? (
                <div className="space-y-3.5">
                  <p className="text-13 leading-relaxed text-foreground">
                    My Publications allows you to create a list of your own work and share it on your public profile. Only add work you yourself have created, and only include files if you have the rights to distribute them publicly.
                  </p>

                  <div className="flex items-start gap-2.5 pt-0.5">
                    <Controller
                      name="confirmed"
                      control={control}
                      render={({ field }) => (
                        <Checkbox
                          id="authorship-confirm"
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          className="mt-0.5 shrink-0"
                        />
                      )}
                    />
                    <Label
                      htmlFor="authorship-confirm"
                      className="text-13 font-normal text-foreground leading-snug cursor-pointer select-none"
                    >
                      I created this work and have the rights to distribute included files.
                    </Label>
                  </div>
                </div>
              ) : (
                <p className="text-13 leading-relaxed text-foreground">
                  This reference is currently in your My Publications collection. Confirming will remove it from your public profile.
                </p>
              )}
            </div>

            {/* Modal Footer with 1px hairline border - Cancel and Confirm buttons */}
            <div className="px-5 py-3 border-t border-border bg-background flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
                className="h-8 px-3.5 text-13 font-medium rounded-md border border-border bg-background shadow-2xs hover:bg-muted text-foreground cursor-pointer"
              >
                Cancel
              </Button>

              <Button
                type="submit"
                size="sm"
                disabled={(!isAlreadyPublication && !confirmed) || isPending}
                className={cn(
                  "h-8 px-3.5 text-13 font-medium rounded-md cursor-pointer shadow-none",
                  isAlreadyPublication
                    ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    : "bg-primary text-primary-foreground hover:bg-primary-hover"
                )}
              >
                {isPending ? 'Confirming...' : 'Confirm'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
