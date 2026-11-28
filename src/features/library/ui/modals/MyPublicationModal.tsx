'use client';

import { useState, useId, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, ShieldCheck } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { Label } from '@/shared/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import {
  ALL_ITEM_TYPES_FLAT,
  myPublicationFormSchema,
  type MyPublicationFormValues,
  type Item,
} from '@/features/library/types/core.types';

interface MyPublicationModalProps {
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
  const licenseSelectId = useId();
  const isPublicCheckboxId = useId();
  const includeAttachmentsCheckboxId = useId();

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const form = useForm<MyPublicationFormValues>({
    resolver: zodResolver(myPublicationFormSchema),
    defaultValues: {
      contributorId: 'unlinked',
      isPublic: true,
      includeAttachments: true,
      openAccessLicense: 'CC-BY-4.0',
    },
  });

  const { control, handleSubmit, reset, watch } = form;
  const isPublic = watch('isPublic');
  const includeAttachments = watch('includeAttachments');

  useEffect(() => {
    if (open) {
      reset({
        contributorId: 'unlinked',
        isPublic: true,
        includeAttachments: true,
        openAccessLicense: 'CC-BY-4.0',
      });
      setIsSubmitting(false);
    }
  }, [open, item?.id, reset]);

  const itemTypeLabel = item?.itemType
    ? ALL_ITEM_TYPES_FLAT.find((t) => t.value === item.itemType)?.label ||
      item.itemType
    : 'Publication';

  const onValidSubmit = async (data: MyPublicationFormValues) => {
    setIsSubmitting(true);
    try {
      await onConfirm({
        contributorId: null,
        isPublic: data.isPublic,
        includeAttachments: data.isPublic ? data.includeAttachments : false,
        openAccessLicense:
          data.isPublic && data.includeAttachments
            ? data.openAccessLicense
            : null,
      });
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (isSubmitting) return;
        onOpenChange(v);
      }}
    >
      <DialogContent
        className="sm:max-w-[460px] p-6 rounded-lg border border-border bg-background shadow-raised-200 gap-0"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <form onSubmit={handleSubmit(onValidSubmit)} className="space-y-4">
          <DialogHeader className="text-left pb-0">
            <DialogTitle className="text-14 font-semibold text-foreground tracking-tight">
              Add to My Publications
            </DialogTitle>
            <DialogDescription className="text-12 text-muted-foreground">
              Only add work that you authored or co-authored yourself.
            </DialogDescription>
          </DialogHeader>

          {item && (
            <div className="rounded-md border border-border bg-muted/40 px-3 py-2.5 space-y-0.5">
              <p className="text-13 font-medium text-foreground line-clamp-2 leading-snug">
                {item.title || 'Untitled Document'}
              </p>
              <div className="flex items-center gap-1.5 text-11 text-muted-foreground truncate">
                <span>{itemTypeLabel}</span>
                {item.year && (
                  <>
                    <span>•</span>
                    <span>{item.year}</span>
                  </>
                )}
                {item.publicationTitle && (
                  <>
                    <span>•</span>
                    <span className="truncate">{item.publicationTitle}</span>
                  </>
                )}
              </div>
            </div>
          )}

          <div className="flex items-start gap-2.5 rounded-md border border-border bg-muted/40 p-2.5 text-12 text-muted-foreground leading-normal">
            <ShieldCheck className="size-4 text-primary shrink-0 mt-0.5" strokeWidth={1.5} />
            <span>
              By adding this work to <strong>My Publications</strong>, you confirm that you authored or co-authored it and hold the necessary rights to distribute it.
            </span>
          </div>

          <div className="flex flex-col gap-2.5 pt-0.5">
            <Controller
              name="isPublic"
              control={control}
              render={({ field }) => (
                <label
                  htmlFor={isPublicCheckboxId}
                  className="flex items-center gap-2 text-12 text-foreground cursor-pointer select-none"
                >
                  <Checkbox
                    id={isPublicCheckboxId}
                    checked={field.value}
                    onCheckedChange={(checked) =>
                      field.onChange(Boolean(checked))
                    }
                  />
                  <span>Show citation on my public research profile</span>
                </label>
              )}
            />

            {isPublic && (
              <Controller
                name="includeAttachments"
                control={control}
                render={({ field }) => (
                  <label
                    htmlFor={includeAttachmentsCheckboxId}
                    className="flex items-center gap-2 text-12 text-foreground cursor-pointer select-none"
                  >
                    <Checkbox
                      id={includeAttachmentsCheckboxId}
                      checked={field.value}
                      onCheckedChange={(checked) =>
                        field.onChange(Boolean(checked))
                      }
                    />
                    <span>Include attached full-text PDF files</span>
                  </label>
                )}
              />
            )}
          </div>

          {isPublic && includeAttachments && (
            <div className="space-y-1.5">
              <Label
                htmlFor={licenseSelectId}
                className="text-11 font-medium text-foreground"
              >
                Distribution License
              </Label>
              <Controller
                name="openAccessLicense"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger
                      id={licenseSelectId}
                      className="w-full h-8 text-12 text-foreground justify-between rounded-md border-border bg-background hover:border-border-hover focus-visible:border-primary cursor-pointer"
                    >
                      <SelectValue placeholder="Select license" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60 bg-popover text-popover-foreground border border-border shadow-raised-200 rounded-md">
                      <SelectItem value="CC-BY-4.0" className="text-12 py-1.5 px-2">
                        CC-BY 4.0 (Creative Commons Attribution)
                      </SelectItem>
                      <SelectItem value="CC-BY-NC-4.0" className="text-12 py-1.5 px-2">
                        CC-BY-NC 4.0 (Non-Commercial)
                      </SelectItem>
                      <SelectItem value="CC0-1.0" className="text-12 py-1.5 px-2">
                        CC0 1.0 (Public Domain Dedication)
                      </SelectItem>
                      <SelectItem value="All-Rights-Reserved" className="text-12 py-1.5 px-2">
                        All Rights Reserved / Publisher Copy
                      </SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          )}

          <DialogFooter className="flex items-center justify-end gap-2 pt-2 sm:space-x-0">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="h-8 px-3 text-13 font-medium cursor-pointer text-foreground rounded-md hover:bg-muted"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="h-8 px-3.5 text-13 font-medium cursor-pointer rounded-md shadow-none inline-flex items-center gap-1.5"
            >
              {isSubmitting && <Loader2 className="size-3.5 animate-spin" />}
              Add to Publications
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
