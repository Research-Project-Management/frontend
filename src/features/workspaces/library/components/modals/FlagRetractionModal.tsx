'use client';

import React, { useState, useEffect } from 'react';
import { AlertTriangle, ShieldAlert } from 'lucide-react';
import { Button } from '@/shared/components/ui';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
  const [nature, setNature] = useState<RetractionNature>('retraction');
  const [reason, setReason] = useState('');
  const [noticeUrl, setNoticeUrl] = useState('');
  const [date, setDate] = useState('');

  useEffect(() => {
    if (open && item) {
      const details = (item.retractionDetails as any) || {};
      setNature((item.retractionNature as any) || details.nature || 'retraction');
      setReason(details.reason || '');
      setNoticeUrl(details.noticeUrl || '');
      setDate(details.date ? details.date.slice(0, 10) : new Date().toISOString().slice(0, 10));
    }
  }, [open, item]);

  if (!item) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!item.id) return;

    await onFlag(item.id, {
      nature,
      reason: reason.trim() || undefined,
      noticeUrl: noticeUrl.trim() || undefined,
      date: date || undefined,
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
            <ShieldAlert className="size-5 shrink-0" />
            <DialogTitle>Academic Integrity & Retraction</DialogTitle>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="bg-muted/40 p-2.5 rounded-md border text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">Publication: </span>
            <span className="line-clamp-2">{item.title}</span>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="retraction-nature" className="text-xs font-medium">
              Flag Type
            </Label>
            <Select
              value={nature}
              onValueChange={(val: RetractionNature) => setNature(val)}
            >
              <SelectTrigger id="retraction-nature" className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="retraction">Retraction (Full Retraction)</SelectItem>
                <SelectItem value="expression_of_concern">Expression of Concern</SelectItem>
                <SelectItem value="correction">Publisher Correction</SelectItem>
                <SelectItem value="manual">Manual Flag / Untrusted Data</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="retraction-reason" className="text-xs font-medium">
              Reason / Findings
            </Label>
            <Textarea
              id="retraction-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Data fabrication, methodology flaws, or authors retracted notice..."
              className="text-xs min-h-[70px]"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="notice-url" className="text-xs font-medium">
                Notice URL (Optional)
              </Label>
              <Input
                id="notice-url"
                value={noticeUrl}
                onChange={(e) => setNoticeUrl(e.target.value)}
                placeholder="https://doi.org/..."
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="retraction-date" className="text-xs font-medium">
                Retraction Date
              </Label>
              <Input
                id="retraction-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </div>

          <DialogFooter className="pt-3 border-t flex items-center justify-between sm:justify-between">
            {item.isRetracted ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRemoveFlag}
                disabled={isPending}
                className="text-xs text-destructive hover:bg-destructive/10"
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
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isPending}
                className="bg-rose-600 hover:bg-rose-700 text-white"
              >
                {isPending ? 'Saving...' : 'Save Retraction Flag'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
