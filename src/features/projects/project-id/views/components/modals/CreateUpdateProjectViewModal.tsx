'use client';

import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Input,
  Textarea,
  Label,
} from '@/shared/components/ui';
import {
  Kanban,
  List,
  Table as TableIcon,
  Calendar,
  Clock,
  Globe,
  Lock,
  Loader2,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { viewFormSchema, type ViewFormValues } from '../../schemas/view.schema';
import type { WorkItemViewItem, ViewLayoutMode, ViewAccessType } from '../../types/view.types';

export interface CreateUpdateProjectViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: ViewFormValues) => Promise<void>;
  data?: WorkItemViewItem | null;
  isLoading?: boolean;
}

const LAYOUT_OPTIONS: Array<{
  key: ViewLayoutMode;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}> = [
  {
    key: 'list',
    label: 'List',
    icon: List,
    description: 'Compact vertical view',
  },
  {
    key: 'board',
    label: 'Board',
    icon: Kanban,
    description: 'Kanban columns grouped by state',
  },
  {
    key: 'table',
    label: 'Table',
    icon: TableIcon,
    description: 'Spreadsheet grid view',
  },
  {
    key: 'calendar',
    label: 'Calendar',
    icon: Calendar,
    description: 'Date scheduled view',
  },
  {
    key: 'timeline',
    label: 'Timeline',
    icon: Clock,
    description: 'Gantt roadmap view',
  },
];

export const CreateUpdateProjectViewModal: React.FC<CreateUpdateProjectViewModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  data,
  isLoading = false,
}) => {
  const isEditing = Boolean(data);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ViewFormValues>({
    resolver: zodResolver(viewFormSchema),
    defaultValues: {
      name: '',
      description: '',
      layout: 'list',
      access: 'public',
    },
  });

  const selectedLayout = watch('layout');
  const selectedAccess = watch('access');

  useEffect(() => {
    if (isOpen) {
      if (data) {
        reset({
          name: data.name || '',
          description: data.description || '',
          layout: (data.layout as ViewLayoutMode) || 'list',
          access: (data.access as ViewAccessType) || 'public',
        });
      } else {
        reset({
          name: '',
          description: '',
          layout: 'list',
          access: 'public',
        });
      }
    }
  }, [isOpen, data, reset]);

  const onFormSubmit = async (values: ViewFormValues) => {
    try {
      await onSubmit(values);
      onClose();
    } catch {
      // Error handled by mutation toast
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[560px] p-0 overflow-hidden bg-card border-border">
        <form onSubmit={handleSubmit(onFormSubmit)}>
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
            <DialogTitle className="text-lg font-semibold text-foreground">
              {isEditing ? 'Edit view' : 'Create view'}
            </DialogTitle>
          </DialogHeader>

          <div className="px-6 py-4 space-y-5">
            {/* View Name */}
            <div className="space-y-1.5">
              <Label htmlFor="view-name" className="text-xs font-medium text-foreground">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="view-name"
                {...register('name')}
                placeholder="e.g. Current Sprint Bugs, High Priority"
                autoFocus
                className={cn(
                  'h-9 text-sm bg-background border-input focus-visible:ring-1',
                  errors.name && 'border-destructive focus-visible:ring-destructive'
                )}
              />
              {errors.name && (
                <p className="text-xs text-destructive mt-1">{errors.name.message}</p>
              )}
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="view-description" className="text-xs font-medium text-muted-foreground">
                Description
              </Label>
              <Textarea
                id="view-description"
                {...register('description')}
                placeholder="What is this view for?"
                rows={3}
                className="text-sm bg-background border-input resize-none focus-visible:ring-1"
              />
              {errors.description && (
                <p className="text-xs text-destructive mt-1">{errors.description.message}</p>
              )}
            </div>

            {/* Layout Selector */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">Layout</Label>
              <div className="grid grid-cols-5 gap-2">
                {LAYOUT_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const isSelected = selectedLayout === opt.key;
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setValue('layout', opt.key, { shouldDirty: true })}
                      className={cn(
                        'flex flex-col items-center justify-center p-2.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer gap-1.5',
                        isSelected
                          ? 'border-primary bg-primary/10 text-primary shadow-xs'
                          : 'border-border bg-card hover:bg-accent/50 text-muted-foreground hover:text-foreground'
                      )}
                    >
                      <Icon className={cn('size-4', isSelected ? 'text-primary' : 'text-muted-foreground')} />
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Access Switcher */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">Access</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setValue('access', 'public', { shouldDirty: true })}
                  className={cn(
                    'flex items-center gap-2.5 p-3 rounded-lg border text-left cursor-pointer transition-colors',
                    selectedAccess === 'public'
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-border bg-card hover:bg-accent/50 text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Globe className={cn('size-4 shrink-0', selectedAccess === 'public' ? 'text-primary' : 'text-muted-foreground')} />
                  <div>
                    <div className="text-xs font-semibold text-foreground">Public view</div>
                    <div className="text-11 text-muted-foreground">Anyone in project can view</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setValue('access', 'private', { shouldDirty: true })}
                  className={cn(
                    'flex items-center gap-2.5 p-3 rounded-lg border text-left cursor-pointer transition-colors',
                    selectedAccess === 'private'
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-border bg-card hover:bg-accent/50 text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Lock className={cn('size-4 shrink-0', selectedAccess === 'private' ? 'text-primary' : 'text-muted-foreground')} />
                  <div>
                    <div className="text-xs font-semibold text-foreground">Private view</div>
                    <div className="text-11 text-muted-foreground">Only you can view and edit</div>
                  </div>
                </button>
              </div>
            </div>
          </div>

          <DialogFooter className="px-6 py-4 bg-muted/30 border-t border-border flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting || isLoading}
              className="cursor-pointer text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting || isLoading}
              className="cursor-pointer text-xs"
            >
              {(isSubmitting || isLoading) && (
                <Loader2 className="size-3.5 mr-1.5 animate-spin" />
              )}
              {isEditing ? 'Save changes' : 'Create view'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
