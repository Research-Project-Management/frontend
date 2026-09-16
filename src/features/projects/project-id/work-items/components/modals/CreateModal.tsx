'use client';

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  Switch,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/components/ui";
import {
  Loader2,
  Bookmark,
  Plus,
} from 'lucide-react';
import { useParams } from 'next/navigation';
import { cn } from "@/shared/lib/utils";
import { useUpload } from "@/shared/hooks/use-upload";

import type {
  Item,
  Column,
  ItemMutationInput,
  Priority,
  ProjectMember,
  ItemAttachment,
  AttachPageItem,
  AttachPaperItem,
  AttachFileItem,
  AttachLinkItem,
  Cycle,
} from '../../types/work-item.types';
import {
  resolveColumnId,
  resolveStateId,
  normalizeStates,
  ItemHelpers,
  WorkItemHelpers,
  DEFAULT_STATES,
} from '../../utils/work-item.utils';
import { useLabelsQuery } from '../../hooks/use-label';
import { useCycles } from '../../hooks/use-cycle';
import {
  useTemplatesQuery,
  useCreateTemplateMutation,
} from '../../hooks/use-template';
import { useWatch } from 'react-hook-form';
import { Form } from '@/shared/components/ui';
import {
  useItemForm,
  useProjectStates,
  useProjectDetails,
  useProjectItems,
  type CreateWorkItemFormData,
} from '../../hooks/use-work-item';

import {
  Attachments,
  type AttachCenterData,
} from './Attachments';
import { useProjects } from '@/features/projects/shell/hooks/use-project';
import {
  StatePopover,
  MemberPopover,
  LabelPopover,
  PriorityPopover,
  SingleDatePopover,
  CyclePopover,
  ParentItemPopover,
  AttachPaperclipIcon,
  ProjectSelectorPopover,
} from './Popovers';

export interface CreateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  columns: Column[];
  members?: ProjectMember[];
  initialData?: Partial<Item>;
  cycleId?: string;
  project?: {
    id?: string;
    name?: string;
    identifier?: string;
    emoji?: string | null;
    icon?: string | null;
    modules?: string[];
  } | null;
  cycles?: Cycle[];
  availableItems?: Item[];
  onSubmit: (data: ItemMutationInput & { createMore?: boolean }) => Promise<void> | void;
  isSubmitting?: boolean;
}

const DEFAULT_EMPTY_ARRAY: string[] = [];
const DEFAULT_EMPTY_ATTACHMENTS: AttachCenterData = {
  pages: [],
  papers: [],
  files: [],
  links: [],
};

const pillBtnClass =
  'h-7 px-2.5 text-xs font-normal rounded-md border border-border bg-background hover:bg-muted text-foreground flex items-center gap-1.5 cursor-pointer transition-colors shadow-none shrink-0';

export function CreateModal({
  open,
  onOpenChange,
  columns = [],
  members = [],
  initialData,
  cycleId,
  project,
  cycles = [],
  availableItems = [],
  onSubmit,
  isSubmitting = false,
}: CreateModalProps) {
  const { projectId: routeProjectId, workspaceId = '' } = useParams() as {
    projectId?: string;
    workspaceId?: string;
  };
  const { projects = [] } = useProjects();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [openProjectPopover, setOpenProjectPopover] = useState(false);

  // Derived effective project ID without useEffect sync (rerender-derived-state-no-effect)
  const effectiveProjectId = selectedProjectId || initialData?.projectId || project?.id || routeProjectId || '';

  const activeProject = useMemo(() => {
    if (effectiveProjectId) {
      const found = projects.find((p: any) => p.id === effectiveProjectId);
      if (found) return found;
    }
    return project || (projects.length > 0 ? projects[0] : null);
  }, [effectiveProjectId, projects, project]);

  const currentProjectId = activeProject?.id || effectiveProjectId;
  const isDifferentProject = Boolean(selectedProjectId && selectedProjectId !== (project?.id || routeProjectId));

  const { data: remoteStates } = useProjectStates(currentProjectId);
  const { data: remoteCyclesData } = useCycles(currentProjectId);
  const { data: remoteDetails } = useProjectDetails(currentProjectId);
  const { data: remoteItemsData } = useProjectItems(currentProjectId);

  const effectiveColumns = useMemo<Column[]>(() => {
    if (isDifferentProject && Array.isArray(remoteStates) && remoteStates.length > 0) {
      return normalizeStates(remoteStates);
    }
    if (columns && columns.length > 0) return columns;
    if (Array.isArray(remoteStates) && remoteStates.length > 0) {
      return normalizeStates(remoteStates);
    }
    return [...DEFAULT_STATES];
  }, [isDifferentProject, remoteStates, columns]);

  const effectiveMembers = useMemo<ProjectMember[]>(() => {
    if (isDifferentProject && remoteDetails) {
      const proj = ('project' in remoteDetails && remoteDetails.project ? remoteDetails.project : remoteDetails) as any;
      return (proj?.members || []) as ProjectMember[];
    }
    if (members && members.length > 0) return members;
    if (remoteDetails) {
      const proj = ('project' in remoteDetails && remoteDetails.project ? remoteDetails.project : remoteDetails) as any;
      return (proj?.members || []) as ProjectMember[];
    }
    return [];
  }, [isDifferentProject, remoteDetails, members]);

  const effectiveCycles = useMemo<Cycle[]>(() => {
    if (isDifferentProject && remoteCyclesData) {
      if (Array.isArray(remoteCyclesData)) return remoteCyclesData as Cycle[];
      return ((remoteCyclesData as any).cycles || []) as Cycle[];
    }
    if (cycles && cycles.length > 0) return cycles;
    if (remoteCyclesData) {
      if (Array.isArray(remoteCyclesData)) return remoteCyclesData as Cycle[];
      return ((remoteCyclesData as any).cycles || []) as Cycle[];
    }
    return [];
  }, [isDifferentProject, remoteCyclesData, cycles]);

  const effectiveAvailableItems = useMemo<Item[]>(() => {
    if (isDifferentProject && remoteItemsData) {
      return (remoteItemsData as any).items || (remoteItemsData as any).workItems || [];
    }
    if (availableItems && availableItems.length > 0) return availableItems;
    if (remoteItemsData) {
      return (remoteItemsData as any).items || (remoteItemsData as any).workItems || [];
    }
    return [];
  }, [isDifferentProject, remoteItemsData, availableItems]);

  const isCyclesEnabled = true;

  const { uploadFile } = useUpload();
  const { data: rawLabels } = useLabelsQuery(currentProjectId, 'work-item');

  const projectLabels = useMemo(() => {
    if (Array.isArray(rawLabels)) return rawLabels;
    if (Array.isArray((rawLabels as any)?.labels)) return (rawLabels as any).labels;
    return [];
  }, [rawLabels]);

  const defaultColumnId = useMemo(() => {
    if (initialData?.columnId) return initialData.columnId;
    if (Array.isArray(effectiveColumns) && effectiveColumns.length > 0) {
      const defaultCol = effectiveColumns.find((c) => c.isDefault) || effectiveColumns[0];
      return resolveStateId(defaultCol);
    }
    return 'backlog';
  }, [initialData?.columnId, effectiveColumns]);

  // React Hook Form Integration (Skills: react-hook-form, formcfg-default-values, sub-usewatch-over-watch)
  const workItemForm = useItemForm({
    defaultColumnId,
    defaultCycleId: cycleId || null,
    initialValues: {
      columnId: initialData?.columnId || defaultColumnId,
      priority: (initialData?.priority as Priority) || 'none',
      dueDate: initialData?.dueDate || '',
      startDate: initialData?.startDate || '',
      cycleId: initialData?.cycleId || cycleId || null,
      parentId: initialData?.parentId || initialData?.parentWorkItemId || null,
      parentWorkItemId: initialData?.parentWorkItemId || initialData?.parentId || null,
      labels: initialData?.labels ? ItemHelpers.uniqueLabels(initialData.labels) : [],
    },
  });

  const {
    form,
    control,
    register,
    handleSubmit: handleFormSubmit,
    errors,
    setValue,
    resetToDefaults,
    restoreFromDraft,
    setColumnId,
    setPriority,
    setDueDate,
    setStartDate,
    setCycleId,
    setParentId,
    setLabels,
    setAssignees,
    setAttachments,
    setCreateMore,
  } = workItemForm;

  // Reactive field values via useWatch
  const title = useWatch({ control, name: 'title' }) ?? '';
  const description = useWatch({ control, name: 'description' }) ?? '';
  const columnId = useWatch({ control, name: 'columnId' }) ?? defaultColumnId;
  const priority = useWatch({ control, name: 'priority' }) ?? 'none';
  const dueDate = useWatch({ control, name: 'dueDate' }) ?? '';
  const startDate = useWatch({ control, name: 'startDate' }) ?? '';
  const selectedCycleId = useWatch({ control, name: 'cycleId' }) ?? (cycleId || null);
  const parentId = (useWatch({ control, name: 'parentId' as any }) as string | null) ?? null;
  const watchedLabels = useWatch({ control, name: 'labels' });
  const labels = watchedLabels ?? DEFAULT_EMPTY_ARRAY;
  const assigneeId = useWatch({ control, name: 'assigneeId' }) ?? null;
  const watchedAssigneeIds = useWatch({ control, name: 'assigneeIds' });
  const assigneeIds = watchedAssigneeIds ?? DEFAULT_EMPTY_ARRAY;
  const watchedAttachments = useWatch({ control, name: 'attachments' }) as AttachCenterData | undefined;
  const attachments = watchedAttachments ?? DEFAULT_EMPTY_ATTACHMENTS;
  const createMore = useWatch({ control, name: 'createMore' }) ?? false;

  const [showAttachCenter, setShowAttachCenter] = useState(false);

  // Synchronize columnId when effectiveColumns change (e.g. project switch)
  useEffect(() => {
    if (effectiveColumns.length > 0 && columnId) {
      const exists = effectiveColumns.some(
        (c) => resolveStateId(c) === columnId || resolveColumnId(c) === columnId || (c as any).id === columnId
      );
      if (!exists) {
        const defaultCol = effectiveColumns.find((c) => c.isDefault) || effectiveColumns[0];
        setColumnId(resolveStateId(defaultCol));
      }
    }
  }, [effectiveColumns, columnId, setColumnId]);

  // Popover States
  const [openStatePopover, setOpenStatePopover] = useState(false);
  const [openPriorityPopover, setOpenPriorityPopover] = useState(false);
  const [openMemberPopover, setOpenMemberPopover] = useState(false);
  const [openLabelPopover, setOpenLabelPopover] = useState(false);
  const [openStartDatePopover, setOpenStartDatePopover] = useState(false);
  const [openDueDatePopover, setOpenDueDatePopover] = useState(false);
  const [openCyclePopover, setOpenCyclePopover] = useState(false);
  const [openParentPopover, setOpenParentPopover] = useState(false);
  const [openTemplatesPopover, setOpenTemplatesPopover] = useState(false);

  // Templates Hooks
  const { data: projectTemplates = [] } = useTemplatesQuery(currentProjectId);
  const createTemplateMutation = useCreateTemplateMutation();

  const handleApplyTemplate = (tmpl: any) => {
    if (tmpl.title) setValue('title', tmpl.title, { shouldDirty: true });
    if (tmpl.content || tmpl.description) setValue('description', tmpl.content || tmpl.description, { shouldDirty: true });
    if (tmpl.priority) setPriority(tmpl.priority);
    if (tmpl.defaultColumnId) setColumnId(tmpl.defaultColumnId);
    if (tmpl.defaultCycleId) setCycleId(tmpl.defaultCycleId);
    if (tmpl.labels && Array.isArray(tmpl.labels)) setLabels(tmpl.labels);
    setOpenTemplatesPopover(false);
  };

  const handleSaveAsTemplateFromModal = async () => {
    if (!title.trim()) {
      return;
    }
    await createTemplateMutation.mutateAsync({
      projectId: currentProjectId,
      data: {
        name: `${title.trim()} (Template)`,
        description: description.trim() || undefined,
        title: title.trim(),
        content: description.trim() || undefined,
        priority: priority !== 'none' ? priority : undefined,
        labels: labels.length > 0 ? labels : undefined,
        defaultColumnId: columnId,
      },
    });
    setOpenTemplatesPopover(false);
  };

  const titleInputRef = useRef<HTMLInputElement>(null);
  const prevOpenRef = useRef(false);

  // Total attachments count
  const totalAttachments = useMemo(() => {
    const pagesCount = attachments.pages?.length || 0;
    const papersCount = attachments.papers?.length || 0;
    const filesCount = attachments.files?.length || 0;
    const linksCount = attachments.links?.length || 0;
    return pagesCount + papersCount + filesCount + linksCount;
  }, [attachments]);

  // Normalize attachments input
  const normalizeAttachments = useCallback((raw: any): AttachCenterData => {
    if (!raw) return { pages: [], papers: [], files: [], links: [] };
    if (Array.isArray(raw)) {
      return { pages: [], papers: [], files: raw, links: [] };
    }
    return {
      pages: Array.isArray(raw.pages) ? raw.pages : [],
      papers: Array.isArray(raw.papers) ? raw.papers : [],
      files: Array.isArray(raw.files) ? raw.files : [],
      links: Array.isArray(raw.links) ? raw.links : [],
    };
  }, []);

  // Form Reset
  const resetForm = useCallback((resetProperties = true) => {
    if (resetProperties) {
      resetToDefaults();
    } else {
      setValue('title', '');
      setValue('description', '');
      setValue('attachments', { pages: [], papers: [], files: [], links: [] });
      form.clearErrors();
    }
    setShowAttachCenter(false);
  }, [resetToDefaults, setValue, form]);

  // Discard form and close
  const handleDiscard = useCallback(() => {
    resetForm(true);
    onOpenChange(false);
  }, [resetForm, onOpenChange]);

  // Safe Form Initialization (Triggers ONLY when modal transitions from closed to open)
  useEffect(() => {
    const isOpeningTransition = !prevOpenRef.current && open;
    prevOpenRef.current = open;

    if (!isOpeningTransition) return;

    // Check if initialData was provided with any initial field
    const hasInitialData = Boolean(
      initialData &&
      (
        initialData.columnId ||
        initialData.priority ||
        initialData.dueDate ||
        initialData.startDate ||
        initialData.cycleId ||
        initialData.assigneeId ||
        ((initialData as any).assigneeIds && (initialData as any).assigneeIds.length > 0) ||
        (initialData.title && initialData.title.trim()) ||
        (initialData.description && initialData.description.trim()) ||
        (initialData.content && initialData.content.trim()) ||
        (initialData.labels && initialData.labels.length > 0) ||
        initialData.parentId ||
        initialData.parentWorkItemId
      )
    );

    if (hasInitialData) {
      const initialAssigneeIds = Array.isArray((initialData as any)?.assigneeIds)
        ? (initialData as any).assigneeIds
        : (initialData as any)?.assignees && Array.isArray((initialData as any).assignees)
        ? (initialData as any).assignees.map((a: any) => a.id).filter(Boolean)
        : (initialData as any)?.assignee?.id
        ? [(initialData as any).assignee.id]
        : initialData?.assigneeId
        ? [initialData.assigneeId]
        : [];

      restoreFromDraft({
        title: initialData?.title || '',
        description: initialData?.description || initialData?.content || '',
        columnId: initialData?.columnId || defaultColumnId,
        priority: (initialData?.priority as Priority) || 'none',
        dueDate: initialData?.dueDate || '',
        startDate: initialData?.startDate || '',
        cycleId: initialData?.cycleId || cycleId || null,
        parentId: initialData?.parentId || initialData?.parentWorkItemId || null,
        parentWorkItemId: initialData?.parentWorkItemId || initialData?.parentId || null,
        labels: initialData?.labels ? ItemHelpers.uniqueLabels(initialData.labels) : [],
        assigneeIds: initialAssigneeIds,
        assigneeId: initialAssigneeIds[0] ?? null,
        attachments: normalizeAttachments(initialData?.attachments),
      });
      return;
    }

    // Default clean state
    resetToDefaults();
  }, [open, initialData, defaultColumnId, cycleId, normalizeAttachments, restoreFromDraft, resetToDefaults]);

  const handleAttachPage = (page: { pageId: string; title: string }) => {
    setAttachments((prev) => ({
      ...prev,
      pages: [
        ...(prev.pages || []),
        {
          id: page.pageId,
          pageId: page.pageId,
          title: page.title,
          addedAt: new Date().toISOString(),
        } as AttachPageItem,
      ],
    }));
    setShowAttachCenter(true);
  };

  const handleDetachPage = (pageId: string) => {
    setAttachments((prev) => ({
      ...prev,
      pages: (prev.pages || []).filter(
        (p) => (p as any).pageId !== pageId && p.id !== pageId
      ),
    }));
  };

  const handleAttachPaper = (paper: {
    paperId: string;
    title: string;
    doi?: string;
    citationKey?: string;
  }) => {
    setAttachments((prev) => ({
      ...prev,
      papers: [
        ...(prev.papers || []),
        {
          id: paper.paperId,
          paperId: paper.paperId,
          title: paper.title,
          doi: paper.doi,
          citationKey: paper.citationKey,
          addedAt: new Date().toISOString(),
        } as AttachPaperItem,
      ],
    }));
    setShowAttachCenter(true);
  };

  const handleDetachPaper = (paperId: string) => {
    setAttachments((prev) => ({
      ...prev,
      papers: (prev.papers || []).filter(
        (p) => (p as any).paperId !== paperId && p.id !== paperId
      ),
    }));
  };

  const handleAttachFile = (file: {
    name: string;
    url: string;
    size?: number;
    type?: string;
    fileId?: string;
  }) => {
    const newFile: AttachFileItem = {
      id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      name: file.name,
      url: file.url,
      size: file.size ? `${Math.round(file.size / 1024)} KB` : undefined,
      type: file.type,
      createdAt: new Date().toISOString(),
      ...(file.fileId ? { fileId: file.fileId } : {}),
    };
    setAttachments((prev) => ({
      ...prev,
      files: [...(prev.files || []), newFile],
    }));
    setShowAttachCenter(true);
  };

  const handleDetachFile = (fileId: string) => {
    setAttachments((prev) => ({
      ...prev,
      files: (prev.files || []).filter((f) => (f as any).id !== fileId),
    }));
  };

  const handleAttachLink = (link: { title: string; url: string }) => {
    setAttachments((prev) => ({
      ...prev,
      links: [
        ...(prev.links || []),
        {
          title: link.title,
          url: link.url,
          addedAt: new Date().toISOString(),
        } as AttachLinkItem,
      ],
    }));
    setShowAttachCenter(true);
  };

  const handleDetachLink = (linkIndex: number) => {
    setAttachments((prev) => ({
      ...prev,
      links: (prev.links || []).filter((_, idx) => idx !== linkIndex),
    }));
  };

  const handleRenameAttachment = (attachmentId: string, newName: string) => {
    setAttachments((prev) => ({
      ...prev,
      files: (prev.files || []).map((a) =>
        (a as any).id === attachmentId ? { ...a, name: newName } : a
      ),
    }));
  };

  const handleRemoveAttachment = (attachmentId: string) => {
    handleDetachFile(attachmentId);
  };

  // Submit Handler
  const onValidSubmit = async (formData: CreateWorkItemFormData) => {
    const trimmedTitle = formData.title.trim();
    if (!trimmedTitle) {
      form.setError('title', { message: 'Title is required' });
      titleInputRef.current?.focus();
      return;
    }

    const payload: ItemMutationInput & { createMore?: boolean } = {
      title: trimmedTitle,
      content: formData.description.trim(),
      description: formData.description.trim(),
      projectId: activeProject?.id || currentProjectId || undefined,
      columnId: formData.columnId || defaultColumnId || 'backlog',
      priority: formData.priority,
      dueDate: formData.dueDate || null,
      startDate: formData.startDate || null,
      labels: formData.labels,
      assigneeId: formData.assigneeIds[0] ?? formData.assigneeId ?? null,
      assigneeIds: formData.assigneeIds,
      cycleId: formData.cycleId || null,
      parentId: formData.parentId || formData.parentWorkItemId || null,
      parentWorkItemId: formData.parentWorkItemId || formData.parentId || null,
      attachments: {
        pages: formData.attachments?.pages || [],
        papers: formData.attachments?.papers || [],
        files: formData.attachments?.files || [],
        links: formData.attachments?.links || [],
      },
      createMore: formData.createMore,
    };

    try {
      await onSubmit(payload);

      if (formData.createMore) {
        resetForm(false);
        titleInputRef.current?.focus();
      } else {
        onOpenChange(false);
      }
    } catch {
      // Error handled by mutation hook; preserve input
    }
  };

  const handleSubmit = handleFormSubmit(onValidSubmit, () => {
    titleInputRef.current?.focus();
  });

  const { ref: titleFormRef, ...titleRegisterRest } = register('title');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="w-full max-w-[960px] sm:max-w-[960px] p-0 gap-0 rounded-lg border border-border overflow-hidden bg-background flex flex-col max-h-[92vh]"
        style={{ width: 'min(960px, 96vw)', maxWidth: '960px' }}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault();
            handleSubmit();
          }
        }}
      >
        <Form {...form}>
          {/* Header */}
          <DialogHeader className="px-6 pt-5 pb-0 flex flex-row items-center justify-between shrink-0 space-y-0">
            <DialogTitle className="text-base font-semibold text-foreground tracking-tight">
              Create new work item
            </DialogTitle>
            <DialogDescription className="sr-only">
              Create a new work item in this project
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 px-6 pt-3 pb-5 space-y-3.5">
            {/* Project Selector Trigger & Popover */}
            <div className="flex items-center gap-2 pb-0.5">
              <ProjectSelectorPopover
                open={openProjectPopover}
                onOpenChange={setOpenProjectPopover}
                project={(activeProject as any) || undefined}
                projects={projects}
                onSelectProject={(proj) => {
                  setSelectedProjectId(proj.id);
                  setCycleId(null);
                  setParentId(null);
                  setAssignees([]);
                }}
                disabled={isSubmitting}
              />
            </div>

            {/* Title Box */}
            <div className="space-y-1">
              <div
                className={cn(
                  'rounded-md border border-border bg-background px-3.5 py-2.5 transition-colors focus-within:border-ring',
                  errors.title && 'border-destructive focus-within:border-destructive ring-1 ring-destructive'
                )}
              >
                <input
                  {...titleRegisterRest}
                  ref={(node) => {
                    titleFormRef(node);
                    (titleInputRef as React.MutableRefObject<HTMLInputElement | null>).current = node;
                  }}
                  aria-label="Work item title"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit();
                    }
                  }}
                  placeholder="Title"
                  autoFocus
                  disabled={isSubmitting}
                  className="w-full text-sm font-normal text-foreground outline-none bg-transparent placeholder:text-muted-foreground border-none p-0 focus:ring-0"
                />
              </div>
              {errors.title && (
                <p className="text-11 text-destructive font-medium px-1">
                  {errors.title.message || 'Title is required'}
                </p>
              )}
            </div>

            {/* Description Box */}
            <div className="rounded-md border border-border bg-background p-3.5 transition-colors focus-within:border-ring">
              <textarea
                {...register('description')}
                aria-label="Work item description"
                placeholder="Click to add description"
                disabled={isSubmitting}
                rows={5}
                className="w-full resize-none text-xs sm:text-sm text-foreground placeholder:text-muted-foreground outline-none bg-transparent border-none p-0 focus:ring-0 leading-relaxed min-h-[140px]"
              />
            </div>

          {/* Property Pills Toolbar (9 Pills) */}
          <div className="flex items-center gap-2 flex-wrap py-0.5">
            {/* 1. Status / Column */}
            <StatePopover
              open={openStatePopover}
              onOpenChange={setOpenStatePopover}
              columnId={columnId}
              setColumnId={setColumnId}
              columns={effectiveColumns}
              actionBtnClass={pillBtnClass}
              isReadOnly={isSubmitting}
            />

            {/* 2. Priority */}
            <PriorityPopover
              open={openPriorityPopover}
              onOpenChange={setOpenPriorityPopover}
              priority={priority}
              setPriority={(p) => setPriority(p)}
              actionBtnClass={pillBtnClass}
              defaultLabel="None"
            />

            {/* 3. Assignees */}
            <MemberPopover
              open={openMemberPopover}
              onOpenChange={setOpenMemberPopover}
              assigneeId={assigneeId}
              setAssigneeId={(id) => setAssignees(id ? [id] : [])}
              assigneeIds={assigneeIds}
              setAssigneeIds={setAssignees}
              isMulti={true}
              members={effectiveMembers}
              actionBtnClass={pillBtnClass}
              triggerLabel="Assignees"
            />

            {/* 4. Labels */}
            <LabelPopover
              open={openLabelPopover}
              onOpenChange={setOpenLabelPopover}
              labels={labels}
              setLabels={(l) => {
                const updated = typeof l === 'function' ? l(labels) : l;
                setLabels(updated);
              }}
              actionBtnClass={pillBtnClass}
            />

            {/* 5. Start date */}
            <SingleDatePopover
              label="Start date"
              date={startDate}
              onSelectDate={setStartDate}
              open={openStartDatePopover}
              onOpenChange={setOpenStartDatePopover}
              actionBtnClass={pillBtnClass}
            />

            {/* 6. Due date */}
            <SingleDatePopover
              label="Due date"
              date={dueDate}
              onSelectDate={setDueDate}
              open={openDueDatePopover}
              onOpenChange={setOpenDueDatePopover}
              actionBtnClass={pillBtnClass}
            />

            {/* 7. Cycle (conditional on project.modules) */}
            {isCyclesEnabled && (
              <CyclePopover
                open={openCyclePopover}
                onOpenChange={setOpenCyclePopover}
                cycleId={selectedCycleId}
                setCycleId={setCycleId}
                cycles={effectiveCycles}
                actionBtnClass={pillBtnClass}
              />
            )}

            {/* 8. Attach (replaces Modules) */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowAttachCenter((prev) => !prev)}
              className={cn(
                pillBtnClass,
                (showAttachCenter || totalAttachments > 0) &&
                  'border-ring bg-muted text-foreground font-medium'
              )}
            >
              <AttachPaperclipIcon />
              <span>
                {totalAttachments > 0 ? `Attach (${totalAttachments})` : 'Attach'}
              </span>
            </Button>

            {/* 9. Add parent */}
            <ParentItemPopover
              open={openParentPopover}
              onOpenChange={setOpenParentPopover}
              parentId={parentId}
              setParentId={setParentId}
              items={effectiveAvailableItems}
              actionBtnClass={pillBtnClass}
            />

            {/* 10. Templates */}
            <Popover open={openTemplatesPopover} onOpenChange={setOpenTemplatesPopover}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    pillBtnClass,
                    openTemplatesPopover && 'border-ring bg-muted font-medium'
                  )}
                >
                  <Bookmark className="size-3 shrink-0 text-foreground" />
                  <span>Templates {projectTemplates.length > 0 ? `(${projectTemplates.length})` : ''}</span>
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-64 p-1.5 rounded-md border-border bg-popover z-100 flex flex-col space-y-1">
                <div className="flex items-center justify-between px-2 py-1 border-b border-border mb-1">
                  <span className="text-11 font-semibold text-muted-foreground">Work Item Templates</span>
                </div>
                <div className="max-h-48 overflow-y-auto space-y-0.5">
                  {projectTemplates.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2 text-center">No saved templates</p>
                  ) : (
                    projectTemplates.map((t: any) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => handleApplyTemplate(t)}
                        className="w-full flex flex-col items-start px-2 py-1.5 rounded text-xs hover:bg-muted text-left transition-colors cursor-pointer"
                      >
                        <span className="font-semibold text-foreground truncate w-full">{t.name}</span>
                        {t.description && (
                          <span className="text-10 text-muted-foreground truncate w-full">{t.description}</span>
                        )}
                      </button>
                    ))
                  )}
                </div>
                {title.trim() && (
                  <div className="pt-1 border-t border-border">
                    <button
                      type="button"
                      onClick={handleSaveAsTemplateFromModal}
                      className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded text-xs font-medium text-foreground hover:bg-muted text-left transition-colors cursor-pointer"
                    >
                      <Plus className="size-3 shrink-0" />
                      <span>Save as template</span>
                    </button>
                  </div>
                )}
              </PopoverContent>
            </Popover>
          </div>

          {/* Attach Center Section */}
          {(showAttachCenter || totalAttachments > 0) && (
            <div className="pt-2 animate-in fade-in duration-200">
              <Attachments
                attachments={attachments}
                projectId={currentProjectId}
                onAttachPage={handleAttachPage}
                onDetachPage={handleDetachPage}
                onAttachPaper={handleAttachPaper}
                onDetachPaper={handleDetachPaper}
                onAttachFile={handleAttachFile}
                onDetachFile={handleDetachFile}
                onAttachLink={handleAttachLink}
                onDetachLink={handleDetachLink}
                onRenameAttachment={handleRenameAttachment}
                onRemoveAttachment={handleRemoveAttachment}
                isReadOnly={isSubmitting}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="flex items-center justify-between px-6 py-3.5 border-t border-border bg-background shrink-0">
          <div className="flex items-center gap-2" />

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Switch
                id="create-more-switch"
                checked={createMore}
                onCheckedChange={setCreateMore}
              />
              <label
                htmlFor="create-more-switch"
                className="text-12 text-muted-foreground cursor-pointer select-none font-medium"
              >
                Create more
              </label>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDiscard}
              disabled={isSubmitting}
              className="h-8 text-13 px-3 font-medium cursor-pointer rounded-md border border-border bg-background hover:bg-muted text-foreground shadow-2xs"
            >
              Discard
            </Button>

            <Button
              type="button"
              size="sm"
              disabled={isSubmitting}
              onClick={handleSubmit}
              className="h-8 text-13 px-4 font-medium cursor-pointer rounded-md bg-primary text-primary-foreground hover:bg-primary-hover flex items-center gap-1.5 shadow-none select-none"
            >
              {isSubmitting && <Loader2 className="size-3.5 animate-spin shrink-0" />}
              <span>{isSubmitting ? 'Creating...' : 'Create work item'}</span>
            </Button>
          </div>
        </DialogFooter>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default CreateModal;
