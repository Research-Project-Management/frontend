'use client';

import React, { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Library, Folder } from 'lucide-react';
import { Button } from "@/shared/components/ui";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, Form } from "@/shared/components/ui";
import { Input } from "@/shared/components/ui";
import { Label } from "@/shared/components/ui";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/shared/components/ui";
import {
  collectionFormSchema,
  type CollectionFormValues,
} from '../../schemas/library.schema';
import type { Collection } from '@/features/library/types/library.types';

interface CreateCollectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CollectionFormValues) => void;
  isPending?: boolean;
  collections?: Collection[];
  defaultParentId?: string | null;
}

export default function CreateCollectionModal({
  open,
  onOpenChange,
  onSubmit,
  isPending,
  collections = [],
  defaultParentId = null,
}: CreateCollectionModalProps) {
  const form = useForm<CollectionFormValues>({
    resolver: zodResolver(collectionFormSchema),
    defaultValues: {
      name: 'Untitled',
      description: '',
      color: '#2563eb',
      parent: defaultParentId ?? null,
    },
  });

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = form;

  useEffect(() => {
    if (open) {
      reset({
        name: 'Untitled',
        description: '',
        color: '#2563eb',
        parent: defaultParentId ?? null,
      });
    }
  }, [open, defaultParentId, reset]);

  const onValidSubmit = (data: CollectionFormValues) => {
    const rawParent = data.parent === 'root' || !data.parent ? null : data.parent;
    onSubmit({
      name: data.name.trim() || 'Untitled',
      description: data.description?.trim() || '',
      color: data.color || '#2563eb',
      parentId: rawParent,
      parent: rawParent,
    });
    onOpenChange(false);
    reset();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onCloseAutoFocus={(e) => e.preventDefault()}
        className="sm:max-w-[520px] p-6 bg-background border border-border shadow-raised-200 rounded-lg"
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle className="text-base font-medium text-foreground">
            New Collection
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={handleSubmit(onValidSubmit)} className="space-y-4">
            {/* Name Field */}
            <div className="space-y-1.5">
              <Label htmlFor="collection-name" className="text-11 font-medium text-muted-foreground">
                Name
              </Label>
              <Input
                id="collection-name"
                placeholder="Collection name"
                autoFocus
                onFocus={(e) => e.target.select()}
                className="h-8 text-12 text-foreground focus:border-primary focus:ring-1 focus:ring-primary/20 rounded-md border-border"
                {...register('name')}
              />
              {errors.name && (
                <p className="text-11 text-destructive">{errors.name.message}</p>
              )}
            </div>

            {/* Create In Field (Dropdown Select) */}
            <div className="space-y-1.5">
              <Label className="text-11 font-medium text-muted-foreground">
                Create in
              </Label>
              <Controller
                name="parent"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value || 'root'}
                    onValueChange={(val) => field.onChange(val === 'root' ? null : val)}
                  >
                    <SelectTrigger className="w-full h-8 text-12 text-foreground justify-between rounded-md border-border">
                      <SelectValue placeholder="Select location" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60 bg-popover text-popover-foreground border border-border shadow-raised-200 rounded-md">
                      {/* Root My Library */}
                      <SelectItem value="root" className="rounded-sm text-12">
                        <div className="flex items-center gap-2">
                          <Library className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
                          <span className="text-foreground">My Library</span>
                        </div>
                      </SelectItem>

                      {/* Existing Collections */}
                      {collections.map((col) => (
                        <SelectItem key={col.id} value={col.id} className="rounded-sm text-12">
                          <div className="flex items-center gap-2 pl-2">
                            <Folder className="size-4 shrink-0 text-foreground" strokeWidth={1.5} />
                            <span className="truncate text-foreground">{col.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            {/* Footer with Cancel next to Create Collection on the right */}
            <DialogFooter className="flex justify-end gap-2 pt-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
                className="h-8 px-3 text-12 font-medium cursor-pointer text-foreground rounded-md hover:bg-muted"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                className="h-8 px-3 text-12 font-medium cursor-pointer rounded-md shadow-none"
              >
                {isPending ? 'Creating...' : 'Create Collection'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
