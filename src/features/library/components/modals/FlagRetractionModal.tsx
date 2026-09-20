'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { FileText, Flag, FlagOff, Link2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/shared/components/ui';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Form,
} from '@/shared/components/ui';
import { Input } from '@/shared/components/ui';
import { Label } from '@/shared/components/ui';
import { Textarea } from '@/shared/components/ui';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/shared/components/ui';
import type { Item, FlagRetractionInput, RetractionNature } from '../../types/library.types';
import {
  flagRetractionSchema,
  type FlagRetractionFormValues,
} from '../../types';

interface FlagRetractionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: Item | null;
  onFlag: (itemId: string, data: FlagRetractionInput) => Promise<any>;
  onUnflag: (itemId: string) => Promise<any>;
  isPending?: boolean;
}

export default function FlagRetractionModal({
  open,
  onOpenChange,
  item,
  onFlag,
  onUnflag,
  isPending,
}: FlagRetractionModalProps) {
  const form = useForm<FlagRetractionFormValues>({
    resolver: zodResolver(flagRetractionSchema),
    defaultValues: {
      nature: 'retraction',
      reason: '',
      noticeUrl: '',
      date: new Date().toISOString().slice(0, 10),
    },
    mode: 'onSubmit',
  });

  const { register, handleSubmit, reset, control } = form;

  const [isUnflagging, setIsUnflagging] = useState(false);

  useEffect(() => {
    if (open && item) {
      const details = (item.retractionDetails as any) || {};
      reset({
        nature: ((item.retractionNature as any) || details.nature || 'retraction') as RetractionNature,
        reason: details.reason || '',
        noticeUrl: details.noticeUrl || '',
        date: details.date ? details.date.slice(0, 10) : new Date().toISOString().slice(0, 10),
      });
    }
  }, [open, item, reset]);

  const authorsText = useMemo(() => {
    if (!item?.authors || item.authors.length === 0) return null;
    if (item.authors.length <= 2) return item.authors.join(', ');
    return `${item.authors[0]} et al.`;
  }, [item?.authors]);

  if (!item) return null;

  const onValidSubmit = async (data: FlagRetractionFormValues) => {
    if (!item.id) return;

    try {
      await onFlag(item.id, {
        nature: data.nature,
        reason: data.reason.trim() || undefined,
        noticeUrl: data.noticeUrl.trim() || undefined,
        date: data.date || undefined,
      });
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error('Failed to flag retraction');
    }
  };

  const handleRemoveFlag = async () => {
    if (!item.id) return;
    setIsUnflagging(true);
    try {
      await onUnflag(item.id);
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error('Failed to remove retraction flag');
    } finally {
      setIsUnflagging(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onCloseAutoFocus={(e) => e.preventDefault()}
        className="sm:max-w-[500px] p-5 gap-0 bg-background border border-border shadow-raised-200 rounded-lg overflow-hidden font-sans"
      >
        {/* Clean Neutral Header with 1px bottom border */}
        <div className="pb-3 border-b border-border">
          <DialogHeader className="gap-1 text-left sm:text-left">
            <div className="flex items-center gap-2">
              <Flag className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
              <DialogTitle className="text-14 font-semibold text-foreground">
                Academic Integrity Flag
              </DialogTitle>
            </div>
            <DialogDescription className="text-12 text-muted-foreground leading-normal">
              Record a retraction notice, expression of concern, or data integrity flag for this publication.
            </DialogDescription>
          </DialogHeader>
        </div>

        <Form {...form}>
          <form onSubmit={handleSubmit(onValidSubmit)} className="space-y-3.5 pt-3.5">
            {/* Publication Reference Card */}
            <div className="rounded-md border border-border bg-muted/40 p-3 flex items-start gap-3">
              <div className="size-8 rounded-md bg-background border border-border flex items-center justify-center shrink-0 shadow-2xs mt-0.5">
                <FileText className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <div
                  className="text-12 font-medium text-foreground line-clamp-2 leading-snug"
                  title={item.title}
                >
                  {item.title || 'Untitled Publication'}
                </div>
                <div className="flex items-center gap-1.5 text-11 text-muted-foreground flex-wrap">
                  {authorsText && (
                    <span className="truncate max-w-[220px]">{authorsText}</span>
                  )}
                  {item.year && (
                    <>
                      <span className="text-border">•</span>
                      <span className="tabular-nums">{item.year}</span>
                    </>
                  )}
                  {item.doi && (
                    <>
                      <span className="text-border">•</span>
                      <span className="font-mono text-10">DOI: {item.doi}</span>
                    </>
                  )}
                </div>
              </div>
              {item.isRetracted && (
                <span className="shrink-0 px-2 py-0.5 text-10 font-medium bg-muted border border-border rounded-md text-foreground">
                  Flagged
                </span>
              )}
            </div>

            {/* Flag Type */}
            <div className="space-y-1.5">
              <Label htmlFor="retraction-nature" className="text-11 font-medium text-foreground">
                Flag Type
              </Label>
              <Controller
                name="nature"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(val: RetractionNature) => field.onChange(val)}
                  >
                    <SelectTrigger
                      id="retraction-nature"
                      className="w-full h-8 text-12 text-foreground rounded-md border-border bg-background focus:ring-1 focus:ring-ring focus:border-ring shadow-2xs"
                    >
                      <SelectValue placeholder="Select flag type" />
                    </SelectTrigger>
                    <SelectContent className="border border-border bg-popover text-popover-foreground shadow-raised-200 rounded-md">
                      <SelectItem value="retraction" className="text-12 cursor-pointer">
                        Retraction (Full Retraction)
                      </SelectItem>
                      <SelectItem value="expression_of_concern" className="text-12 cursor-pointer">
                        Expression of Concern
                      </SelectItem>
                      <SelectItem value="correction" className="text-12 cursor-pointer">
                        Publisher Correction / Erratum
                      </SelectItem>
                      <SelectItem value="manual" className="text-12 cursor-pointer">
                        Manual Flag / Untrusted Data
                      </SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            {/* Reason / Findings */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="retraction-reason" className="text-11 font-medium text-foreground">
                  Reason / Findings
                </Label>
                <span className="text-11 text-muted-foreground">Optional</span>
              </div>
              <Textarea
                id="retraction-reason"
                {...register('reason')}
                placeholder="Describe integrity findings, publisher notes, or reasons for concern..."
                rows={3}
                className="text-12 min-h-[72px] resize-none rounded-md border-border bg-background px-3 py-2 leading-normal focus-visible:ring-1 focus-visible:ring-ring focus-visible:border-ring placeholder:text-muted-foreground/60"
              />
            </div>

            {/* Two-column Notice URL & Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="notice-url" className="text-11 font-medium text-foreground">
                    Notice URL
                  </Label>
                  <span className="text-11 text-muted-foreground">Optional</span>
                </div>
                <div className="relative">
                  <Input
                    id="notice-url"
                    {...register('noticeUrl')}
                    placeholder="https://doi.org/... or notice link"
                    className="h-8 text-12 rounded-md border-border bg-background pr-8 focus-visible:ring-1 focus-visible:ring-ring focus-visible:border-ring placeholder:text-muted-foreground/60"
                  />
                  <Link2
                    className="size-3.5 text-muted-foreground absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none shrink-0"
                    strokeWidth={1.5}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="retraction-date" className="text-11 font-medium text-foreground">
                  Notice Date
                </Label>
                <Input
                  id="retraction-date"
                  type="date"
                  {...register('date')}
                  className="h-8 text-12 rounded-md border-border bg-background focus-visible:ring-1 focus-visible:ring-ring focus-visible:border-ring"
                />
              </div>
            </div>

            {/* Footer */}
            <DialogFooter className="pt-3 border-t border-border flex flex-row items-center justify-between sm:justify-between w-full">
              <div>
                {item.isRetracted ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleRemoveFlag}
                    disabled={isPending || isUnflagging}
                    className="h-8 px-3 text-12 font-medium rounded-md border-border bg-background text-foreground hover:bg-muted shadow-2xs cursor-pointer"
                  >
                    {isUnflagging ? (
                      <Loader2 className="size-3.5 animate-spin mr-1.5 shrink-0" />
                    ) : (
                      <FlagOff className="size-3.5 text-foreground mr-1.5 shrink-0" strokeWidth={1.5} />
                    )}
                    {isUnflagging ? 'Removing...' : 'Clear Flag'}
                  </Button>
                ) : null}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenChange(false)}
                  disabled={isPending}
                  className="h-8 px-3 text-12 font-medium rounded-md border-border bg-background text-foreground hover:bg-muted shadow-2xs cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isPending}
                  className="h-8 px-3.5 text-12 font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 shadow-none cursor-pointer"
                >
                  {isPending ? 'Saving...' : item.isRetracted ? 'Update Flag' : 'Save Flag'}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
