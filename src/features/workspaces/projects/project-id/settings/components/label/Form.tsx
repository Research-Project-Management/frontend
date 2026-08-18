import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ColorPicker } from './ColorPicker';
import { labelFormSchema, type LabelFormSchema } from '@/features/workspaces/projects/project-id/tasks/schemas/label.schema';

interface FormProps {
  initialName?: string;
  initialColor?: string;
  submitText?: string;
  isLoading?: boolean;
  onSubmit: (name: string, color: string) => void;
  onCancel: () => void;
}

export function Form({
  initialName = '',
  initialColor = '#FF6900',
  submitText = 'Add',
  isLoading = false,
  onSubmit,
  onCancel,
}: FormProps) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<LabelFormSchema>({
    resolver: zodResolver(labelFormSchema),
    defaultValues: {
      name: initialName,
      color: initialColor,
    },
  });

  const color = watch('color');
  const name = watch('name');

  useEffect(() => {
    reset({
      name: initialName,
      color: initialColor,
    });
  }, [initialName, initialColor, reset]);

  const onFormSubmit = (data: LabelFormSchema) => {
    onSubmit(data.name.trim(), data.color);
  };

  return (
    <form
      onSubmit={handleSubmit(onFormSubmit)}
      className="flex items-center gap-3 rounded-lg border border-border/60 bg-background p-2.5 shadow-2xs"
    >
      {/* Color picker dropdown trigger */}
      <div className="pl-1 shrink-0 flex items-center">
        <ColorPicker
          color={color}
          onChange={(newColor) => setValue('color', newColor, { shouldDirty: true })}
        />
      </div>

      {/* Label title input */}
      <div className="flex-1 flex flex-col">
        <input
          type="text"
          placeholder="Label title"
          maxLength={60}
          disabled={isLoading}
          autoFocus
          {...register('name')}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onCancel();
          }}
          className="w-full h-8.5 rounded-md border border-border/80 bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground/70 outline-none focus:outline-none focus:ring-0 disabled:opacity-60"
        />
        {errors.name && (
          <p className="text-[11px] text-destructive mt-1">{errors.name.message}</p>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onCancel}
          disabled={isLoading}
          className="h-8.5 px-3 rounded-md border border-border bg-background text-xs font-medium text-foreground hover:bg-muted/70 transition-colors cursor-pointer disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!name?.trim() || isLoading}
          className="h-8.5 px-3.5 rounded-md bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? `${submitText}...` : submitText}
        </button>
      </div>
    </form>
  );
}

