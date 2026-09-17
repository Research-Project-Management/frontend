'use client';

import React, { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, ShieldAlert } from 'lucide-react';
import { Button } from '@/shared/components/ui';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
} from '../../schemas/library.schema';

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

  if (!item) return null;

  const onValidSubmit = async (data: FlagRetractionFormValues) => {
    if (!item.id) return;

    await onFlag(item.id, {
      nature: data.nature,
      reason: data.reason.trim() || undefined,
      noticeUrl: data.noticeUrl.trim() || undefined,
      date: data.date || undefined,
    });
    onOpenChange(false);
  };

  const handleRemoveFlag = async () => {
    if (!item.id) return;
    await onUnflag(item.id);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px] p-6 rounded-lg border border-border bg-background shadow-raised-200 font-sans">
        <DialogHeader>
          <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
            <ShieldAlert className="size-4 shrink-0" strokeWidth={1.5} />
            <DialogTitle className="text-14 font-medium text-foreground">Academic Integrity & Retraction</DialogTitle>
          </div>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={handleSubmit(onValidSubmit)} className="space-y-4 pt-2">
            <div className="bg-muted/40 p-2.5 rounded-md border border-border text-12 text-muted-foreground">
              <span className="font-semibold text-foreground">Publication: </span>
              <span className="line-clamp-2">{item.title}</span>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="retraction-nature" className="text-11 font-medium text-muted-foreground">
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
                    <SelectTrigger id="retraction-nature" className="h-8 text-12 rounded-md border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="retraction">Retraction (Full Retraction)</SelectItem>
                      <SelectItem value="expression_of_concern">Expression of Concern</SelectItem>
                      <SelectItem value="correction">Publisher Correction</SelectItem>
                      <SelectItem value="manual">Manual Flag / Untrusted Data</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="retraction-reason" className="text-11 font-medium text-muted-foreground">
                Reason / Findings
              </Label>
              <Textarea
                id="retraction-reason"
                {...register('reason')}
                placeholder="e.g. Data fabrication, methodology flaws, or authors retracted notice..."
                className="text-12 min-h-[70px] rounded-md border-border"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="notice-url" className="text-11 font-medium text-muted-foreground">
                  Notice URL (Optional)
                </Label>
                <Input
                  id="notice-url"
                  {...register('noticeUrl')}
                  placeholder="https://doi.org/..."
                  className="h-8 text-12 rounded-md border-border"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="retraction-date" className="text-11 font-medium text-muted-foreground">
                  Retraction Date
                </Label>
                <Input
                  id="retraction-date"
                  type="date"
                  {...register('date')}
                  className="h-8 text-12 rounded-md border-border"
                />
              </div>
            </div>

            <DialogFooter className="pt-3 border-t border-border flex items-center justify-between sm:justify-between">
              {item.isRetracted ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleRemoveFlag}
                  disabled={isPending}
                  className="h-8 px-3 text-12 font-medium rounded-md border-border shadow-2xs text-destructive hover:bg-destructive/10"
                >
                  Clear Flag
                </Button>
              ) : <div />}

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenChange(false)}
                  className="h-8 px-3 text-12 font-medium rounded-md border-border shadow-2xs hover:bg-muted"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isPending}
                  className="h-8 px-3 text-12 font-medium rounded-md bg-rose-600 hover:bg-rose-700 text-white"
                >
                  {isPending ? 'Saving...' : 'Save Retraction Flag'}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
