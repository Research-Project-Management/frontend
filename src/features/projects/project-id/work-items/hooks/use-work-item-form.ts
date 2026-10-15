'use client';

import { useMemo, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { prioritySchema, type Priority } from '@/features/projects/project-id/work-items/types/work-item.types';
import type { AttachCenterData } from '@/features/projects/project-id/work-items/components/modals/Attachments';

// ── Work Item Form & Mutation Controller ─────────────────────────────────────

export const createWorkItemFormSchema = z.object({
  title: z.string().trim().min(1, 'Title is required'),
  description: z.string(),
  columnId: z.string(),
  priority: prioritySchema,
  dueDate: z.string(),
  startDate: z.string(),
  parentId: z.string().nullable().optional(),
  parentItemId: z.string().nullable().optional(),
  parentWorkItemId: z.string().nullable().optional(),
  labels: z.array(z.string()),
  assigneeId: z.string().nullable(),
  assigneeIds: z.array(z.string()),
  attachments: z.custom<AttachCenterData>(),
  createMore: z.boolean(),
});

export type CreateWorkItemFormData = z.infer<typeof createWorkItemFormSchema>;

export interface UseWorkItemFormOptions {
  defaultColumnId?: string;
  initialValues?: Partial<CreateWorkItemFormData>;
}

export function useWorkItemForm(options: UseWorkItemFormOptions = {}) {
  const { defaultColumnId = 'backlog', initialValues } = options;

  const defaultValues: CreateWorkItemFormData = useMemo(
    () => ({
      title: initialValues?.title ?? '',
      description: initialValues?.description ?? '',
      columnId: initialValues?.columnId ?? defaultColumnId,
      priority: (initialValues?.priority as Priority) ?? 'none',
      dueDate: initialValues?.dueDate ?? '',
      startDate: initialValues?.startDate ?? '',
      parentId: initialValues?.parentId ?? initialValues?.parentItemId ?? initialValues?.parentWorkItemId ?? null,
      parentWorkItemId: initialValues?.parentWorkItemId ?? initialValues?.parentItemId ?? initialValues?.parentId ?? null,
      parentItemId: initialValues?.parentItemId ?? initialValues?.parentId ?? initialValues?.parentWorkItemId ?? null,
      labels: initialValues?.labels ?? [],
      assigneeId: initialValues?.assigneeId ?? null,
      assigneeIds: initialValues?.assigneeIds ?? [],
      attachments: initialValues?.attachments ?? {
        pages: [],
        papers: [],
        files: [],
        links: [],
      },
      createMore: initialValues?.createMore ?? false,
    }),
    [defaultColumnId, initialValues]
  );

  const form = useForm<CreateWorkItemFormData>({
    resolver: zodResolver(createWorkItemFormSchema),
    defaultValues,
    mode: 'onSubmit',
  });

  const { setValue, reset } = form;

  // Field setters
  const setColumnId = useCallback(
    (colId: string) => setValue('columnId', colId, { shouldDirty: true }),
    [setValue]
  );

  const setPriority = useCallback(
    (pri: Priority) => setValue('priority', pri, { shouldDirty: true }),
    [setValue]
  );

  const setDueDate = useCallback(
    (date: string) => setValue('dueDate', date, { shouldDirty: true }),
    [setValue]
  );

  const setStartDate = useCallback(
    (date: string) => setValue('startDate', date, { shouldDirty: true }),
    [setValue]
  );

  const setParentId = useCallback(
    (pId: string | null) => {
      setValue('parentId', pId, { shouldDirty: true });
      setValue('parentWorkItemId', pId, { shouldDirty: true });
      setValue('parentItemId', pId, { shouldDirty: true });
    },
    [setValue]
  );

  const setLabels = useCallback(
    (lbls: string[]) => setValue('labels', lbls, { shouldDirty: true }),
    [setValue]
  );

  const setAssignees = useCallback(
    (ids: string[]) => {
      setValue('assigneeIds', ids, { shouldDirty: true });
      setValue('assigneeId', ids[0] ?? null, { shouldDirty: true });
    },
    [setValue]
  );

  const setAttachments = useCallback(
    (data: AttachCenterData | ((prev: AttachCenterData) => AttachCenterData)) => {
      if (typeof data === 'function') {
        const current = form.getValues('attachments') as AttachCenterData;
        setValue('attachments', data(current), { shouldDirty: true });
      } else {
        setValue('attachments', data, { shouldDirty: true });
      }
    },
    [form, setValue]
  );

  const setCreateMore = useCallback(
    (val: boolean) => setValue('createMore', val, { shouldDirty: true }),
    [setValue]
  );

  const resetToDefaults = useCallback(() => {
    reset(defaultValues);
  }, [reset, defaultValues]);

  const restoreFromDraft = useCallback(
    (draft: Partial<CreateWorkItemFormData> & { content?: string }) => {
      const parent = draft.parentId ?? draft.parentItemId ?? draft.parentWorkItemId ?? null;
      reset({
        title: draft.title ?? '',
        description: draft.description || draft.content || '',
        columnId: draft.columnId ?? defaultColumnId,
        priority: (draft.priority as Priority) ?? 'none',
        dueDate: draft.dueDate ?? '',
        startDate: draft.startDate ?? '',
        parentId: parent,
        parentWorkItemId: parent,
        parentItemId: parent,
        labels: Array.isArray(draft.labels) ? draft.labels : [],
        assigneeId: draft.assigneeId ?? (draft.assigneeIds?.[0] ?? null),
        assigneeIds: Array.isArray(draft.assigneeIds)
          ? draft.assigneeIds
          : draft.assigneeId
            ? [draft.assigneeId]
            : [],
        attachments: draft.attachments ?? { pages: [], papers: [], files: [], links: [] },
        createMore: false,
      });
    },
    [reset, defaultColumnId]
  );

  return {
    form,
    control: form.control,
    register: form.register,
    handleSubmit: form.handleSubmit,
    errors: form.formState.errors,
    isDirty: form.formState.isDirty,
    isSubmitting: form.formState.isSubmitting,
    getValues: form.getValues,
    setValue,
    reset,
    resetToDefaults,
    restoreFromDraft,
    setColumnId,
    setPriority,
    setDueDate,
    setStartDate,
    setParentId,
    setParentWorkItemId: setParentId,
    setParentItemId: setParentId,
    setLabels,
    setAssignees,
    setAttachments,
    setCreateMore,
  };
}
