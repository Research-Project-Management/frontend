'use client';

import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Form } from '@/shared/components/ui/form';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Checkbox } from '@/shared/components/ui/checkbox';
import {
  addLinkSchema,
  applyServerErrorToForm,
  type AddLinkFormValues,
} from '@/features/library/types/core.types';

export interface AddLinkData {
  url: string;
  title?: string;
  attachOaPdf?: boolean;
  saveSnapshot?: boolean;
  filename?: string;
  mimeType?: string;
  size?: number;
  [key: string]: unknown;
}

interface AddLinkModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: AddLinkData) => Promise<unknown> | void;
  isPending?: boolean;
}

export function AddLinkModal({
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
      attachOaPdf: true,
      saveSnapshot: true,
    },
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  });

  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isDirty },
  } = form;

  useEffect(() => {
    if (open) {
      reset({
        url: '',
        title: '',
        attachOaPdf: true,
        saveSnapshot: true,
      });
    }
  }, [open, reset]);

  const handleOpenChange = (v: boolean) => {
    if (isPending) return;
    if (!v) {
      reset({
        url: '',
        title: '',
        attachOaPdf: true,
        saveSnapshot: true,
      });
    }
    onOpenChange(v);
  };

  const onValidSubmit = async (data: AddLinkFormValues) => {
    const trimmedUrl = data.url.trim();
    if (!trimmedUrl) return;

    const trimmedTitle = data.title?.trim();

    try {
      await onSubmit({
        url: trimmedUrl,
        title: trimmedTitle || undefined,
        attachOaPdf: data.attachOaPdf ?? true,
        saveSnapshot: data.saveSnapshot ?? true,
      });
      reset({
        url: '',
        title: '',
        attachOaPdf: true,
        saveSnapshot: true,
      });
      onOpenChange(false);
    } catch (err: unknown) {
      applyServerErrorToForm(err, setError, {
        allowedFields: ['url', 'title'] as const,
        fallbackField: 'url',
        fallbackMessage: 'Unable to resolve or import this identifier/URL',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        onCloseAutoFocus={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => {
          if (isDirty || isPending) e.preventDefault();
        }}
        className="sm:max-w-[500px] p-6 bg-background border border-border shadow-raised-200 rounded-lg"
      >
        <DialogHeader className="text-left pb-1">
          <DialogTitle className="text-14 font-semibold text-foreground tracking-tight">
            Add Item by Identifier
          </DialogTitle>
          <DialogDescription className="sr-only">
            Enter a DOI, ISBN, arXiv ID, PubMed ID, or URL to add to your
            library.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={handleSubmit(onValidSubmit)}
            className="space-y-4 pt-1"
          >
            <div className="space-y-1.5">
              <Label
                htmlFor="link-url-input"
                className="text-11 font-medium text-foreground"
              >
                Identifier or URL
              </Label>
              <Input
                id="link-url-input"
                {...register('url')}
                aria-invalid={Boolean(errors.url)}
                aria-describedby={errors.url ? 'link-url-error' : undefined}
                placeholder="Enter DOI, ISBN, arXiv ID, PubMed ID, or URL..."
                className="h-8 text-13 font-mono text-foreground placeholder:text-muted-foreground rounded-md border-border hover:border-border-hover focus-visible:border-primary focus-visible:ring-ring"
                autoFocus
              />
              {errors.url && (
                <p
                  id="link-url-error"
                  role="alert"
                  className="text-11 text-destructive font-medium"
                >
                  {errors.url.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="link-title-input"
                className="text-11 font-medium text-foreground"
              >
                Title (Optional)
              </Label>
              <Input
                id="link-title-input"
                placeholder="Leave blank to auto-detect title"
                {...register('title')}
                className="h-8 text-13 text-foreground placeholder:text-muted-foreground rounded-md border-border hover:border-border-hover focus-visible:border-primary focus-visible:ring-ring"
              />
            </div>

            <div className="flex flex-col gap-2 pt-1">
              <Controller
                name="attachOaPdf"
                control={control}
                render={({ field }) => (
                  <label className="flex items-center gap-2 text-12 text-foreground cursor-pointer select-none">
                    <Checkbox
                      checked={field.value ?? true}
                      onCheckedChange={(checked) =>
                        field.onChange(Boolean(checked))
                      }
                    />
                    <span>Automatically attach associated Open-Access PDFs</span>
                  </label>
                )}
              />
              <Controller
                name="saveSnapshot"
                control={control}
                render={({ field }) => (
                  <label className="flex items-center gap-2 text-12 text-foreground cursor-pointer select-none">
                    <Checkbox
                      checked={field.value ?? true}
                      onCheckedChange={(checked) =>
                        field.onChange(Boolean(checked))
                      }
                    />
                    <span>
                      Automatically save Web Snapshot (.html) for web pages
                    </span>
                  </label>
                )}
              />
            </div>

            <DialogFooter className="flex justify-end gap-2 pt-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => handleOpenChange(false)}
                disabled={isPending}
                className="h-8 px-3 text-13 font-medium cursor-pointer text-foreground rounded-md hover:bg-muted"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                className="h-8 px-3 text-13 font-medium cursor-pointer min-w-[90px] rounded-md shadow-none"
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
