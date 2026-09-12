'use client';

import React, { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Library, Folder } from 'lucide-react';
import { Button } from "@/shared/components/ui";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/shared/components/ui";
import { Input } from "@/shared/components/ui";
import { Label } from "@/shared/components/ui";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/shared/components/ui";
import {
  collectionFormSchema,
  type CollectionFormValues,
} from '../../schemas/library.schema';
import type { Collection } from '@/features/workspaces/library/types/library.types';

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
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<CollectionFormValues>({
    resolver: zodResolver(collectionFormSchema),
    defaultValues: {
      name: 'Untitled',
      description: '',
      color: '#2563eb',
      parent: defaultParentId ?? null,
    },
  });

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
        className="sm:max-w-md bg-background border border-border shadow-none rounded-md"
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle className="text-base font-medium text-foreground">
            New Collection
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onValidSubmit)} className="space-y-4">
          {/* Name Field */}
          <div className="space-y-1.5">
            <Label htmlFor="collection-name" className="text-sm font-medium text-foreground">
              Name
            </Label>
            <Input
              id="collection-name"
              placeholder="Collection name"
              autoFocus
              onFocus={(e) => e.target.select()}
              className="h-9 text-sm text-foreground focus:border-primary focus:ring-1 focus:ring-primary/20 rounded-md border-border"
              {...register('name')}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          {/* Create In Field (Dropdown Select) */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-foreground">
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
                  <SelectTrigger className="w-full h-9 text-sm text-foreground justify-between rounded-md border-border">
                    <SelectValue placeholder="Select location" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60 bg-popover text-popover-foreground border border-border shadow-none rounded-md">
                    {/* Root My Library */}
                    <SelectItem value="root" className="rounded-sm">
                      <div className="flex items-center gap-2">
                        <Library className="size-4 text-foreground shrink-0" />
                        <span className="text-foreground">My Library</span>
                      </div>
                    </SelectItem>

                    {/* Existing Collections */}
                    {collections.map((col) => (
                      <SelectItem key={col.id} value={col.id} className="rounded-sm">
                        <div className="flex items-center gap-2 pl-2">
                          <Folder className="size-4 shrink-0 text-foreground" />
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
          <DialogFooter className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
              className="h-9 text-sm font-medium cursor-pointer text-foreground rounded-md"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="h-9 text-sm font-medium cursor-pointer rounded-md"
            >
              {isPending ? 'Creating...' : 'Create Collection'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
