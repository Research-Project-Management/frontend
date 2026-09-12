'use client';

import React, { useEffect } from 'react';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Award, CheckCircle2, ShieldCheck } from 'lucide-react';
import { Button } from '@/shared/components/ui';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Form,
} from '@/shared/components/ui';
import { Checkbox } from '@/shared/components/ui';
import { Label } from '@/shared/components/ui';
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
      <DialogContent className="max-w-md p-6 font-sans">
        <DialogHeader className="gap-2">
          <div className="flex items-center gap-2 text-primary">
            <Award className="size-5 shrink-0" />
            <DialogTitle className="text-base font-semibold text-foreground">
              {isAlreadyPublication ? 'My Publications - Authorship' : 'Add to My Publications'}
            </DialogTitle>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {isAlreadyPublication
              ? 'This publication is currently part of your academic portfolio.'
              : 'Add this paper to your personal publications list to curate your academic portfolio, track your scientific output, and generate CV bibliographies.'}
          </p>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={handleSubmit(onValidSubmit)} className="space-y-4 pt-2">
            {/* Paper Summary Card */}
            <div className="p-3.5 rounded-lg border border-border bg-muted/50 space-y-1.5">
              <h4 className="text-xs font-semibold text-foreground line-clamp-2 leading-snug">
                {item.title || 'Untitled Reference'}
              </h4>
              <div className="flex items-center gap-3 text-11 text-muted-foreground">
                <span>{authorCompact || 'Unknown Authors'}</span>
                {item.year ? <span>• {item.year}</span> : null}
              </div>
              {isAlreadyPublication && item.publicationConfirmedAt ? (
                <div className="pt-1 flex items-center gap-1 text-11 font-medium text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="size-3.5 shrink-0" />
                  <span>
                    Authorship confirmed on{' '}
                    {new Date(item.publicationConfirmedAt).toLocaleDateString('en-US')}
                  </span>
                </div>
              ) : null}
            </div>

            {/* Authorship Declaration Checkbox */}
            {!isAlreadyPublication ? (
              <div className="flex items-start gap-2.5 p-3 rounded-md bg-primary/5 border border-primary/20">
                <Controller
                  name="confirmed"
                  control={control}
                  render={({ field }) => (
                    <Checkbox
                      id="authorship-declare"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      className="mt-0.5"
                    />
                  )}
                />
                <Label
                  htmlFor="authorship-declare"
                  className="text-xs text-foreground font-normal leading-snug cursor-pointer select-none"
                >
                  <strong>I created this work.</strong> I confirm that I am an author or co-author of this
                  publication, and I hold the rights to include it in my portfolio.
                </Label>
              </div>
            ) : null}

            <DialogFooter className="gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
                className="text-xs h-8"
              >
                Cancel
              </Button>

              {isAlreadyPublication ? (
                <Button
                  type="submit"
                  variant="destructive"
                  size="sm"
                  disabled={isPending}
                  className="text-xs h-8 gap-1.5"
                >
                  <span>{isPending ? 'Removing...' : 'Remove from My Publications'}</span>
                </Button>
              ) : (
                <Button
                  type="submit"
                  size="sm"
                  disabled={!confirmed || isPending}
                  className="text-xs h-8 gap-1.5"
                >
                  <ShieldCheck className="size-3.5 shrink-0" />
                  <span>{isPending ? 'Adding...' : 'Confirm & Add to My Publications'}</span>
                </Button>
              )}
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
