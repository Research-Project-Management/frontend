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
  RotateCcw,
  Loader2,
  Bookmark,
  FileText,
  Plus,
  X,
} from 'lucide-react';
import { useParams } from 'next/navigation';
import { cn } from "@/shared/lib/utils";
import { useUpload } from "@/shared/hooks/use-upload";

import type {
  Task,
  Column,
  TaskMutationInput,
  TaskPriority,
  ProjectMember,
  TaskRecurrence,
  TaskReminder,
  AttachPageItem,
  AttachPaperItem,
  AttachLinkItem,
  Cycle,
} from '../../types/types';
import {
  resolveTaskColumnId,
  resolveTaskColumnColor,
  resolveStateId,
} from '../../types/types';
import {
  useLabelsQuery,
  useWorkItemDraftNotification,
  useDraftsQuery,
  useCreateDraftMutation,
  useDeleteDraftMutation,
  usePublishDraftMutation,
  useTemplatesQuery,
  useCreateTemplateMutation,
} from '../../hooks/use-tasks';
import { TaskHelpers } from '../../utils/util';

import {
  Attachments as TaskAttachments,
  type TaskAttachment,
  type AttachCenterData,
} from './Attachments';
import { useProjects } from '@/features/workspaces/projects/shell/hooks/use-project';
import {
  StatePopover,
  MemberPopover,
  LabelPopover,
  PriorityPopover,
  SingleDatePopover,
  CyclePopover,
  ParentTaskPopover,
  AttachPaperclipIcon,
  ProjectSelectorPopover,
} from './Popovers';

export interface CreateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  columns: Column[];
  members?: ProjectMember[];
  initialData?: Partial<Task>;
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
  availableTasks?: Task[];
  onSubmit: (data: TaskMutationInput & { createMore?: boolean }) => Promise<void> | void;
  isSubmitting?: boolean;
}

interface WorkItemDraft {
  title: string;
  description: string;
  columnId?: string;
  priority?: TaskPriority;
  dueDate?: string;
  startDate?: string;
  cycleId?: string;
  parentTaskId?: string | null;
  recurrence?: TaskRecurrence;
  reminder?: TaskReminder;
  labels?: string[];
  assigneeId?: string | null;
  attachments?: AttachCenterData;
  updatedAt: number;
}

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
  availableTasks = [],
  onSubmit,
  isSubmitting = false,
}: CreateModalProps) {
  const { workspaceId, projectId: routeProjectId } = useParams() as {
    workspaceId: string;
    projectId?: string;
  };
  const { projects = [] } = useProjects(workspaceId);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    initialData?.projectId || routeProjectId || project?.id || ''
  );
  const [openProjectPopover, setOpenProjectPopover] = useState(false);

  useEffect(() => {
    if (project?.id) {
      setSelectedProjectId(project.id);
    }
  }, [project?.id]);

  const activeProject = useMemo(() => {
    if (selectedProjectId) {
      const found = projects.find((p: any) => p.id === selectedProjectId);
      if (found) return found;
    }
    return project || (projects.length > 0 ? projects[0] : null);
  }, [selectedProjectId, projects, project]);

  const currentProjectId = activeProject?.id || routeProjectId || initialData?.projectId || project?.id || '';
  const isCyclesEnabled = true;
  const draftStorageKey = `flux_work_item_draft_${currentProjectId || 'global'}`;

  const { uploadFile } = useUpload();
  const { notifyDiscard, notifyCleared } = useWorkItemDraftNotification();
  const { data: rawLabels } = useLabelsQuery(workspaceId || '', 'task', currentProjectId);

  const workspaceLabels = useMemo(() => {
    if (Array.isArray(rawLabels)) return rawLabels;
    if (Array.isArray((rawLabels as any)?.labels)) return (rawLabels as any).labels;
    return [];
  }, [rawLabels]);

  const defaultColumnId = useMemo(() => {
    if (initialData?.columnId) return initialData.columnId;
    if (columns.length > 0) return resolveStateId(columns[0]);
    return 'todo';
  }, [initialData?.columnId, columns]);

  // Form states
  const [title, setTitle] = useState('');
  const [titleError, setTitleError] = useState(false);
  const [description, setDescription] = useState('');
  const [columnId, setColumnId] = useState(defaultColumnId);
  const [priority, setPriority] = useState<TaskPriority>('none');
  const [dueDate, setDueDate] = useState('');
  const [startDate, setStartDate] = useState('');
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(cycleId || null);
  const [parentTaskId, setParentTaskId] = useState<string | null>(null);
  const [recurrence, setRecurrence] = useState<TaskRecurrence>('none');
  const [reminder, setReminder] = useState<TaskReminder>('1day');
  const [labels, setLabels] = useState<string[]>([]);
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<AttachCenterData>({
    pages: [],
    papers: [],
    files: [],
    links: [],
  });
  const [createMore, setCreateMore] = useState(false);
  const [showAttachCenter, setShowAttachCenter] = useState(false);
  const [hasRestoredDraft, setHasRestoredDraft] = useState(false);

  // Popover States
  const [openStatePopover, setOpenStatePopover] = useState(false);
  const [openPriorityPopover, setOpenPriorityPopover] = useState(false);
  const [openMemberPopover, setOpenMemberPopover] = useState(false);
  const [openLabelPopover, setOpenLabelPopover] = useState(false);
  const [openStartDatePopover, setOpenStartDatePopover] = useState(false);
  const [openDueDatePopover, setOpenDueDatePopover] = useState(false);
  const [openCyclePopover, setOpenCyclePopover] = useState(false);
  const [openParentPopover, setOpenParentPopover] = useState(false);
  const [openDraftsPopover, setOpenDraftsPopover] = useState(false);
  const [openTemplatesPopover, setOpenTemplatesPopover] = useState(false);

  // Cloud Drafts & Templates Hooks
  const { data: cloudDrafts = [] } = useDraftsQuery(currentProjectId);
  const createDraftMutation = useCreateDraftMutation();
  const deleteDraftMutation = useDeleteDraftMutation();
  const { data: projectTemplates = [] } = useTemplatesQuery(currentProjectId);
  const createTemplateMutation = useCreateTemplateMutation();

  const handleSaveCloudDraft = async () => {
    if (!title.trim()) {
      return;
    }
    await createDraftMutation.mutateAsync({
      projectId: currentProjectId,
      title: title.trim(),
      content: description.trim() || undefined,
      description: description.trim() || undefined,
      columnId,
      priority,
      dueDate: dueDate || null,
      startDate: startDate || null,
      cycleId: selectedCycleId || cycleId || null,
      labels,
      assigneeId,
      parentTaskId,
    });
  };

  const handleLoadDraft = (draft: any) => {
    setTitle(draft.title || '');
    setDescription(draft.content || draft.description || '');
    if (draft.columnId) setColumnId(draft.columnId);
    if (draft.priority) setPriority(draft.priority);
    if (draft.dueDate) setDueDate(draft.dueDate);
    if (draft.startDate) setStartDate(draft.startDate);
    if (draft.cycleId) setSelectedCycleId(draft.cycleId);
    if (draft.labels && Array.isArray(draft.labels)) setLabels(draft.labels);
    if (draft.assigneeId) setAssigneeId(draft.assigneeId);
    setOpenDraftsPopover(false);
  };

  const handleApplyTemplate = (tmpl: any) => {
    if (tmpl.title) setTitle(tmpl.title);
    if (tmpl.content || tmpl.description) setDescription(tmpl.content || tmpl.description);
    if (tmpl.priority) setPriority(tmpl.priority);
    if (tmpl.defaultColumnId) setColumnId(tmpl.defaultColumnId);
    if (tmpl.defaultCycleId) setSelectedCycleId(tmpl.defaultCycleId);
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
    setTitle('');
    setTitleError(false);
    setDescription('');
    setAttachments({ pages: [], papers: [], files: [], links: [] });
    setShowAttachCenter(false);

    if (resetProperties) {
      setPriority('none');
      setDueDate('');
      setStartDate('');
      setSelectedCycleId(cycleId || null);
      setParentTaskId(null);
      setRecurrence('none');
      setReminder('1day');
      setLabels([]);
      setAssigneeId(null);
      setColumnId(defaultColumnId);
    }
  }, [defaultColumnId, cycleId]);

  // Discard draft completely and close
  const handleDiscard = useCallback(() => {
    try {
      localStorage.removeItem(draftStorageKey);
    } catch {
      // Ignore localStorage error
    }
    resetForm(true);
    setHasRestoredDraft(false);
    onOpenChange(false);
    notifyDiscard();
  }, [draftStorageKey, resetForm, onOpenChange, notifyDiscard]);

  // Clear draft only and keep modal open
  const handleClearDraftOnly = useCallback(() => {
    try {
      localStorage.removeItem(draftStorageKey);
    } catch {
      // Ignore localStorage error
    }
    resetForm(true);
    setHasRestoredDraft(false);
    notifyCleared();
    titleInputRef.current?.focus();
  }, [draftStorageKey, resetForm, notifyCleared]);

  // Safe Form Initialization (Triggers ONLY when modal transitions from closed to open)
  useEffect(() => {
    const isOpeningTransition = !prevOpenRef.current && open;
    prevOpenRef.current = open;

    if (!isOpeningTransition) return;

    // Check if initialData was explicitly provided with content
    const hasInitialTitle = Boolean(initialData?.title && initialData.title.trim());
    const hasInitialDescription = Boolean(
      (initialData?.description && initialData.description.trim()) ||
      (initialData?.content && initialData.content.trim())
    );

    if (hasInitialTitle || hasInitialDescription) {
      setTitle(initialData?.title || '');
      setDescription(initialData?.description || initialData?.content || '');
      setColumnId(initialData?.columnId || defaultColumnId);
      setPriority(initialData?.priority || 'none');
      setDueDate(initialData?.dueDate || '');
      setStartDate(initialData?.startDate || '');
      setSelectedCycleId(initialData?.cycleId || cycleId || null);
      setParentTaskId(initialData?.parentTaskId || null);
      setRecurrence(initialData?.recurrence || 'none');
      setReminder(initialData?.reminder || '1day');
      setLabels(initialData?.labels ? TaskHelpers.uniqueLabels(initialData.labels) : []);
      setAssigneeId(
        (initialData as any)?.assignee?.id ||
        (initialData as any)?.assigneeId ||
        initialData?.assigneeId ||
        null
      );
      setAttachments(normalizeAttachments(initialData?.attachments));
      setHasRestoredDraft(false);
      return;
    }

    // Try restoring draft from localStorage to prevent any accidental data loss
    try {
      const savedDraftRaw = localStorage.getItem(draftStorageKey);
      if (savedDraftRaw) {
        const draft = JSON.parse(savedDraftRaw) as WorkItemDraft;
        if (draft && (draft.title?.trim() || draft.description?.trim())) {
          setTitle(draft.title || '');
          setDescription(draft.description || '');
          setColumnId(draft.columnId || initialData?.columnId || defaultColumnId);
          setPriority(draft.priority || 'none');
          setDueDate(draft.dueDate || '');
          setStartDate(draft.startDate || '');
          setSelectedCycleId(draft.cycleId || cycleId || null);
          setParentTaskId(draft.parentTaskId || null);
          setRecurrence(draft.recurrence || 'none');
          setReminder(draft.reminder || '1day');
          setLabels(Array.isArray(draft.labels) ? draft.labels : []);
          setAssigneeId(draft.assigneeId || null);
          setAttachments(normalizeAttachments(draft.attachments));
          setHasRestoredDraft(true);
          return;
        }
      }
    } catch {
      // LocalStorage read fallback
    }

    // Default clean state
    setTitle('');
    setDescription('');
    setColumnId(initialData?.columnId || defaultColumnId);
    setPriority(initialData?.priority || 'none');
    setDueDate(initialData?.dueDate || '');
    setStartDate(initialData?.startDate || '');
    setSelectedCycleId(cycleId || null);
    setParentTaskId(null);
    setRecurrence(initialData?.recurrence || 'none');
    setReminder(initialData?.reminder || '1day');
    setLabels(initialData?.labels ? TaskHelpers.uniqueLabels(initialData.labels) : []);
    setAssigneeId(
      (initialData as any)?.assignee?.id ||
      (initialData as any)?.assigneeId ||
      initialData?.assigneeId ||
      null
    );
    setAttachments(normalizeAttachments(initialData?.attachments));
    setHasRestoredDraft(false);
  }, [open, initialData, defaultColumnId, cycleId, draftStorageKey, normalizeAttachments]);

  // Auto-save draft to localStorage to ensure zero data loss
  useEffect(() => {
    if (!open) return;

    const hasContent = title.trim().length > 0 || description.trim().length > 0;
    if (!hasContent) {
      return;
    }

    const draft: WorkItemDraft = {
      title,
      description,
      columnId,
      priority,
      dueDate,
      startDate,
      cycleId: selectedCycleId || undefined,
      parentTaskId,
      recurrence,
      reminder,
      labels,
      assigneeId,
      attachments,
      updatedAt: Date.now(),
    };

    try {
      localStorage.setItem(draftStorageKey, JSON.stringify(draft));
    } catch {
      // Ignore quota error
    }
  }, [
    open,
    title,
    description,
    columnId,
    priority,
    dueDate,
    startDate,
    selectedCycleId,
    parentTaskId,
    recurrence,
    reminder,
    labels,
    assigneeId,
    attachments,
    draftStorageKey,
  ]);

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
  }) => {
    const newFile: TaskAttachment = {
      id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      name: file.name,
      url: file.url,
      size: file.size ? `${Math.round(file.size / 1024)} KB` : undefined,
      type: file.type,
      createdAt: new Date().toISOString(),
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
  const handleSubmit = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setTitleError(true);
      titleInputRef.current?.focus();
      return;
    }
    setTitleError(false);

    const payload: TaskMutationInput & { createMore?: boolean } = {
      title: trimmedTitle,
      content: description.trim(),
      description: description.trim(),
      projectId: activeProject?.id || currentProjectId || undefined,
      columnId,
      priority,
      dueDate: dueDate || null,
      startDate: startDate || null,
      recurrence: recurrence || 'none',
      reminder: reminder || '1day',
      labels,
      assigneeId,
      cycleId: selectedCycleId || cycleId || null,
      parentTaskId: parentTaskId || null,
      attachments: {
        pages: attachments.pages || [],
        papers: attachments.papers || [],
        files: attachments.files || [],
        links: attachments.links || [],
      },
      createMore,
    };

    try {
      await onSubmit(payload);

      // On successful creation, purge draft from localStorage
      try {
        localStorage.removeItem(draftStorageKey);
      } catch {
        // Ignore localStorage error
      }

      if (createMore) {
        resetForm(false);
        setHasRestoredDraft(false);
        titleInputRef.current?.focus();
      } else {
        onOpenChange(false);
      }
    } catch {
      // Error handled by mutation hook; preserve input
    }
  };

  const activeCol = columns.find((c) => resolveTaskColumnId(c) === columnId);
  const activeColColor = resolveTaskColumnColor(columnId, activeCol?.accentColor);

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
              }}
              disabled={isSubmitting}
            />
          </div>

          {/* Title Box */}
          <div className="space-y-1">
            <div
              className={cn(
                'rounded-md border border-border bg-background px-3.5 py-2.5 transition-colors focus-within:border-ring',
                titleError && 'border-destructive focus-within:border-destructive ring-1 ring-destructive'
              )}
            >
              <input
                ref={titleInputRef}
                value={title}
                aria-label="Work item title"
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (titleError && e.target.value.trim()) {
                    setTitleError(false);
                  }
                }}
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
            {titleError && (
              <p className="text-11 text-destructive font-medium px-1">
                Title is required
              </p>
            )}
          </div>

          {/* Description Box */}
          <div className="rounded-md border border-border bg-background p-3.5 transition-colors focus-within:border-ring">
            <textarea
              value={description}
              aria-label="Work item description"
              onChange={(e) => setDescription(e.target.value)}
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
              columns={columns}
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
              setAssigneeId={(id) => setAssigneeId(id)}
              members={members}
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
                setCycleId={setSelectedCycleId}
                cycles={cycles}
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
            <ParentTaskPopover
              open={openParentPopover}
              onOpenChange={setOpenParentPopover}
              parentId={parentTaskId}
              setParentId={setParentTaskId}
              tasks={availableTasks}
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

            {/* 11. Cloud Drafts */}
            <Popover open={openDraftsPopover} onOpenChange={setOpenDraftsPopover}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    pillBtnClass,
                    openDraftsPopover && 'border-ring bg-muted font-medium'
                  )}
                >
                  <FileText className="size-3 shrink-0 text-foreground" />
                  <span>Drafts {cloudDrafts.length > 0 ? `(${cloudDrafts.length})` : ''}</span>
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-72 p-1.5 rounded-md border-border bg-popover z-100 flex flex-col space-y-1">
                <div className="flex items-center justify-between px-2 py-1 border-b border-border mb-1">
                  <span className="text-11 font-semibold text-muted-foreground">Saved Cloud Drafts</span>
                  {title.trim() && (
                    <button
                      type="button"
                      onClick={handleSaveCloudDraft}
                      className="text-11 font-medium text-primary hover:underline cursor-pointer"
                    >
                      Save current
                    </button>
                  )}
                </div>
                <div className="max-h-48 overflow-y-auto space-y-0.5">
                  {cloudDrafts.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2 text-center">No cloud drafts</p>
                  ) : (
                    cloudDrafts.map((d: any) => (
                      <div
                        key={d.id}
                        className="w-full flex items-center justify-between px-2 py-1.5 rounded text-xs hover:bg-muted group transition-colors"
                      >
                        <button
                          type="button"
                          onClick={() => handleLoadDraft(d)}
                          className="flex-1 text-left truncate cursor-pointer font-medium text-foreground"
                        >
                          <span className="truncate block">{d.title || 'Untitled Draft'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await deleteDraftMutation.mutateAsync(d.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive p-1 rounded transition-opacity cursor-pointer ml-1"
                          title="Delete draft"
                        >
                          <X className="size-3 shrink-0" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Attach Center Section */}
          {(showAttachCenter || totalAttachments > 0) && (
            <div className="pt-2 animate-in fade-in duration-200">
              <TaskAttachments
                attachments={attachments}
                projectId={currentProjectId}
                workspaceId={workspaceId}
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
          <div className="flex items-center gap-2">
            {hasRestoredDraft && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground animate-in fade-in duration-200">
                <RotateCcw className="size-3 text-primary shrink-0" />
                <span>Draft restored</span>
                <button
                  type="button"
                  onClick={handleClearDraftOnly}
                  className="text-11 font-medium text-destructive hover:underline cursor-pointer ml-1"
                >
                  Discard draft
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Switch
                id="create-more-switch"
                checked={createMore}
                onCheckedChange={setCreateMore}
              />
              <label
                htmlFor="create-more-switch"
                className="text-xs text-muted-foreground cursor-pointer select-none font-medium"
              >
                Create more
              </label>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSaveCloudDraft}
              disabled={isSubmitting || !title.trim()}
              className="h-8 text-xs px-3 font-medium cursor-pointer rounded-md border-border hover:bg-muted text-foreground"
            >
              Save Draft
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDiscard}
              disabled={isSubmitting}
              className="h-8 text-xs px-3 font-medium cursor-pointer rounded-md border-border hover:bg-muted text-foreground"
            >
              Discard
            </Button>

            <Button
              type="button"
              size="sm"
              disabled={isSubmitting}
              onClick={handleSubmit}
              className="h-8 text-xs px-4 font-semibold cursor-pointer rounded-md bg-primary text-primary-foreground hover:bg-primary-hover flex items-center gap-1.5 shadow-none select-none"
            >
              {isSubmitting && <Loader2 className="size-3.5 animate-spin shrink-0" />}
              <span>{isSubmitting ? 'Saving...' : 'Save'}</span>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CreateModal;
