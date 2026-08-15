'use client';

import React, { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Library, Folder } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Input,
  Label,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/shared/components/ui';
import {
  collectionFormSchema,
  type CollectionFormValues,
} from '../../../schemas/library.schemas';
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
      color: '#3370ff',
      parent: defaultParentId ?? null,
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        name: 'Untitled',
        description: '',
        color: '#3370ff',
        parent: defaultParentId ?? null,
      });
    }
  }, [open, defaultParentId, reset]);

  const onValidSubmit = (data: CollectionFormValues) => {
    onSubmit({
      ...data,
      parent: data.parent === 'root' || !data.parent ? null : data.parent,
    });
    reset();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onCloseAutoFocus={(e) => e.preventDefault()}
        className="sm:max-w-md bg-popover"
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle className="text-base font-semibold text-foreground">
            New Collection
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onValidSubmit)} className="space-y-4 pt-2">
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
              className="h-9 text-sm"
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
                  <SelectTrigger className="w-full h-9 text-sm justify-between">
                    <SelectValue placeholder="Select location" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {/* Root My Library */}
                    <SelectItem value="root">
                      <div className="flex items-center gap-2">
                        <Library className="size-4 text-primary" />
                        <span>My Library</span>
                      </div>
                    </SelectItem>

                    {/* Existing Collections */}
                    {collections.map((col) => (
                      <SelectItem key={col._id} value={col._id}>
                        <div className="flex items-center gap-2 pl-2">
                          <Folder
                            className="size-4 shrink-0 text-amber-500/90"
                            style={col.color ? { color: col.color } : undefined}
                          />
                          <span className="truncate">{col.name}</span>
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
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending}
            >
              {isPending ? 'Creating...' : 'Create Collection'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
