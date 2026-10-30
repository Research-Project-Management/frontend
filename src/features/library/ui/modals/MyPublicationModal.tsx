'use client';

import React, { useState, useId } from 'react';
import { Award, ShieldCheck, FileText, Globe, Lock, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Switch } from '@/shared/components/ui/switch';
import { Label } from '@/shared/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import type { Item } from '@/features/library/domain/types/library.types';

export interface MyPublicationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: Item | null;
  onConfirm: (options: {
    contributorId?: string | null;
    isPublic?: boolean;
    openAccessLicense?: string | null;
    includeAttachments?: boolean;
  }) => Promise<void> | void;
}

export function MyPublicationModal({
  open,
  onOpenChange,
  item,
  onConfirm,
}: MyPublicationModalProps) {
  const contributorSelectId = useId();
  const licenseSelectId = useId();

  const [selectedContributorId, setSelectedContributorId] = useState<string>('unlinked');
  const [isPublic, setIsPublic] = useState<boolean>(true);
  const [includeAttachments, setIncludeAttachments] = useState<boolean>(true);
  const [openAccessLicense, setOpenAccessLicense] = useState<string>('CC-BY-4.0');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const contributors = Array.isArray(item?.contributors)
    ? item.contributors
    : [];

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      await onConfirm({
        contributorId:
          selectedContributorId &&
          selectedContributorId !== 'unlinked' &&
          !selectedContributorId.startsWith('contrib-')
            ? selectedContributorId
            : null,
        isPublic,
        includeAttachments,
        openAccessLicense: isPublic ? openAccessLicense : null,
      });
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (isSubmitting) return; onOpenChange(v); }}>
      <DialogContent
        className="sm:max-w-[540px] p-6 rounded-lg border border-border bg-background shadow-raised-200"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader className="flex flex-row items-start gap-3.5 space-y-0 text-left">
          <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-500 dark:text-amber-400">
            <Award className="size-5 shrink-0" strokeWidth={1.75} />
          </div>

          <div className="min-w-0 flex-1">
            <DialogTitle className="text-15 font-semibold text-foreground tracking-tight">
              Add to My Publications
            </DialogTitle>
            <DialogDescription className="mt-1 text-12 text-muted-foreground leading-normal">
              Confirm authorship to claim this work in your personal academic portfolio.
            </DialogDescription>
          </div>
        </DialogHeader>

        {/* Paper Summary Card */}
        {item && (
          <div className="mt-3 p-3 rounded-md bg-muted/60 border border-border/70 flex flex-col gap-1">
            <span className="text-11 font-medium text-muted-foreground uppercase tracking-wider">
              {item.itemType || 'Publication'}
            </span>
            <p className="text-13 font-medium text-foreground line-clamp-2">
              {item.title || 'Untitled Document'}
            </p>
            <div className="flex items-center gap-2 text-11 text-muted-foreground">
              {item.year && <span>{item.year}</span>}
              {item.publicationTitle && (
                <>
                  <span>•</span>
                  <span className="truncate max-w-[280px]">{item.publicationTitle}</span>
                </>
              )}
            </div>
          </div>
        )}

        {/* Disclaimer Note */}
        <div className="mt-2 p-2.5 rounded-md bg-primary/5 border border-primary/20 text-11 text-foreground flex items-start gap-2">
          <ShieldCheck className="size-4 shrink-0 text-primary mt-0.5" />
          <p className="leading-relaxed">
            <strong>Authorship Notice:</strong> Only add work that you authored or co-authored yourself.
            Items in My Publications can be displayed on your public research profile.
          </p>
        </div>

        {/* Author Identity Linkage */}
        {contributors.length > 0 && (
          <div className="mt-4 flex flex-col gap-1.5">
            <Label htmlFor={contributorSelectId} className="text-12 font-medium text-foreground">
              Which author represents you?
            </Label>
            <Select
              value={selectedContributorId}
              onValueChange={setSelectedContributorId}
            >
              <SelectTrigger id={contributorSelectId} className="h-8 text-12">
                <SelectValue placeholder="Select your name in author list" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unlinked" className="text-12">
                  (General Author — not linked to a specific position)
                </SelectItem>
                {contributors.map((c, index) => {
                  const val = c.id || `contrib-${index}`;
                  return (
                    <SelectItem key={val} value={val} className="text-12">
                      {c.fullName || `${c.firstName || ''} ${c.lastName || ''}`.trim() || 'Author'}{' '}
                      {c.creatorType ? `(${c.creatorType})` : ''}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Visibility and Licensing Controls */}
        <div className="mt-4 space-y-3 pt-3 border-t border-border">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-12 font-medium text-foreground flex items-center gap-1.5">
                <Globe className="size-3.5 text-muted-foreground" />
                Show on public profile
              </Label>
              <p className="text-11 text-muted-foreground">
                Make this citation visible on your public portfolio page
              </p>
            </div>
            <Switch checked={isPublic} onCheckedChange={setIsPublic} />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-12 font-medium text-foreground flex items-center gap-1.5">
                <FileText className="size-3.5 text-muted-foreground" />
                Include attached full-text files
              </Label>
              <p className="text-11 text-muted-foreground">
                Allow visitors to download open-access PDF attachments
              </p>
            </div>
            <Switch
              checked={includeAttachments}
              onCheckedChange={setIncludeAttachments}
              disabled={!isPublic}
            />
          </div>

          {isPublic && (
            <div className="pt-2 flex flex-col gap-1.5">
              <Label htmlFor={licenseSelectId} className="text-12 font-medium text-foreground flex items-center gap-1.5">
                <Lock className="size-3.5 text-muted-foreground" />
                Open Access License
              </Label>
              <Select
                value={openAccessLicense}
                onValueChange={setOpenAccessLicense}
              >
                <SelectTrigger id={licenseSelectId} className="h-8 text-12">
                  <SelectValue placeholder="Select license" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CC-BY-4.0" className="text-12">
                    CC-BY 4.0 (Creative Commons Attribution)
                  </SelectItem>
                  <SelectItem value="CC-BY-NC-4.0" className="text-12">
                    CC-BY-NC 4.0 (Non-Commercial)
                  </SelectItem>
                  <SelectItem value="CC0-1.0" className="text-12">
                    CC0 1.0 (Public Domain Dedication)
                  </SelectItem>
                  <SelectItem value="All-Rights-Reserved" className="text-12">
                    All Rights Reserved / Publisher Restricted
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter className="mt-5 flex w-full flex-row items-center justify-end gap-2 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="h-8 px-3 text-13 font-medium cursor-pointer rounded-md hover:bg-muted"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="h-8 px-3 text-13 font-medium cursor-pointer rounded-md bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-1.5"
          >
            {isSubmitting && <Loader2 className="size-3.5 animate-spin" />}
            Confirm Authorship
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default MyPublicationModal;
