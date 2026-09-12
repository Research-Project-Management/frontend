'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/components/ui";
import { Button } from "@/shared/components/ui";
import { Dialog, DialogContent, DialogTitle } from "@/shared/components/ui";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/shared/components/ui";
import { Input } from "@/shared/components/ui";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui";
import {
  MoreHorizontal,
  X,
  Copy,
  Trash2,
  UserMinus,
  UserPlus,
  RotateCcw,
  Clock,
  Paperclip,
  GitBranch,
  Check,
  Zap,
  ArrowUpRight,
  Archive,
  ArchiveRestore,
  Bookmark,
} from "lucide-react";
import { useParams } from "next/navigation";
import { useAuth } from '@/features/auth/hooks/use-auth';
import { cn } from "@/shared/lib/utils";

import type {
  Task,
  Column,
  TaskMutationInput,
  TaskPriority,
  TaskRelation,
  SubtaskMinimal,
  TaskRecurrence,
  TaskReminder,
  Project,
  ProjectMember,
} from '../../types/types';
import {
  resolveTaskColumnId,
  resolveTaskColumnColor,
  resolveStateId,
} from "../../types/types";
import {
  useTaskComments,
  useAddComment,
  useUpdateComment,
  useReactComment,
  useDeleteComment,
  useCreateSubtask,
  useTaskActivityLogs,
  useLabelsQuery,
  useConvertSubtaskToRoot,
  useSubtaskNotification,
  useCopyTaskText,
  useUploadFilesWithToast,
  useAddRelationMutation,
  useRemoveRelationMutation,
  useArchiveTask,
  useRestoreTask,
  useCreateTemplateMutation,
} from "../../hooks/use-tasks";
import { TaskHelpers } from "../../utils/util";

import { Activities as TaskActivities, type ActivityEntry } from "./Activities";
import { Attachments as TaskAttachments, type TaskAttachment } from "./Attachments";
import { TaskUpdates } from "./TaskUpdates";
import {
  MemberPopover,
  LabelPopover,
  DatePopover,
  PriorityPopover,
} from "./Popovers";
import { TaskRelations } from "./TaskRelations";

function resolveTaskAssigneeId(assignee?: any): string | null {
  if (!assignee) return null;
  if (typeof assignee === "string") return assignee;
  return assignee.id ?? null;
}

const EMPTY_ATTACHMENTS: TaskAttachment[] = [];

export type DetailModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card?: Partial<Task>;
  columns: Column[];
  project?: Project;
  members?: ProjectMember[];
  availableTasks?: Task[];
  onSave: (card: TaskMutationInput) => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onRemoveFromCycle?: () => void;
  isReadOnly?: boolean;
};

export type TaskDetailModalProps = DetailModalProps;

export function DetailModal({
  open,
  onOpenChange,
  card,
  columns,
  project,
  members = [],
  availableTasks = [],
  onSave,
  onDelete,
  onDuplicate,
  onRemoveFromCycle,
  isReadOnly = false,
}: DetailModalProps) {
  const { workspaceId, projectId: routeProjectId } = useParams() as { workspaceId: string; projectId?: string };
  const currentProjectId = routeProjectId || (project as any)?.id || card?.projectId;
  const { user: currentUser } = useAuth();
  const copyTaskText = useCopyTaskText();
  const convertSubtaskToRoot = useConvertSubtaskToRoot();
  const { notifySubtaskAdded } = useSubtaskNotification();
  const uploadFilesWithToast = useUploadFilesWithToast();
  const { data: rawLabels } = useLabelsQuery(workspaceId || '', 'task', currentProjectId);
  const workspaceLabels = useMemo(() => {
    if (Array.isArray(rawLabels)) return rawLabels;
    if (Array.isArray((rawLabels as any)?.labels)) return (rawLabels as any).labels;
    return [];
  }, [rawLabels]);
  const firstColumnId = resolveStateId(columns[0]);
  const projectModules: string[] = (project as any)?.modules ?? ['overview', 'tasks', 'pages', 'stickies', 'storage'];

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [columnId, setColumnId] = useState(firstColumnId);
  const [relations, setRelations] = useState<TaskRelation[]>(card?.relations || []);
  const [priority, setPriority] = useState<TaskPriority>(card?.priority || "none");
  const [dueDate, setDueDate] = useState("");
  const [startDate, setStartDate] = useState("");
  const [recurrence, setRecurrence] = useState<TaskRecurrence>("none");
  const [reminder, setReminder] = useState<TaskReminder>("1day");
  const [labels, setLabels] = useState<string[]>([]);
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [showDetailActivity, setShowDetailActivity] = useState(false);
  const [showDescriptionActions, setShowDescriptionActions] = useState(false);
  const descriptionDraftRef = useRef("");
  const commentTextareaRef = useRef<HTMLTextAreaElement>(null);
  const dialogScrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [subtasks, setSubtasks] = useState<any[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [completed, setCompleted] = useState(false);
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [commentFocusToken, setCommentFocusToken] = useState(0);
  const [commentCaretPosition, setCommentCaretPosition] = useState(0);
  const initialSnapshotRef = useRef("");
  const autosaveSignatureRef = useRef("");
  const autosaveReadyRef = useRef(false);

  // Popover States
  const [openPriorityPopover, setOpenPriorityPopover] = useState(false);
  const [openMemberPopover, setOpenMemberPopover] = useState(false);
  const [openLabelPopover, setOpenLabelPopover] = useState(false);
  const [openDatePopover, setOpenDatePopover] = useState(false);
  const [openAttachmentPopover, setOpenAttachmentPopover] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const taskId = card?.id || null;
  const currentUserId = currentUser?.id || null;
  const isCurrentUserAssignee = Boolean(currentUserId && assigneeId === currentUserId);
  const canComment = Boolean(taskId);
  const { data: taskComments = [] } = useTaskComments(open && taskId ? taskId : "");
  const { data: taskActivity = [], error: activityError, isLoading: activityLoading } = useTaskActivityLogs(open && taskId ? taskId : "");
  const createTaskCommentMutation = useAddComment();
  const updateTaskCommentMutation = useUpdateComment();
  const reactTaskCommentMutation = useReactComment();
  const deleteTaskCommentMutation = useDeleteComment();
  const createSubtaskMutation = useCreateSubtask();
  const addRelationMutation = useAddRelationMutation();
  const removeRelationMutation = useRemoveRelationMutation();
  const archiveTaskMutation = useArchiveTask();
  const restoreTaskMutation = useRestoreTask();
  const createTemplateMutation = useCreateTemplateMutation();

  const isArchived = Boolean((card as any)?.archivedAt);

  const handleArchiveTask = async () => {
    if (!taskId) return;
    await archiveTaskMutation.mutateAsync(taskId);
    onOpenChange(false);
  };

  const handleRestoreTask = async () => {
    if (!taskId) return;
    await restoreTaskMutation.mutateAsync(taskId);
  };

  const handleSaveAsTemplate = async () => {
    if (!currentProjectId || !title.trim()) {
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
  };

  const handleConvertSubtask = async (sub: any, sIdx: number) => {
    const success = await convertSubtaskToRoot(sub.id);
    if (success) {
      const updated = subtasks.filter((_, i) => i !== sIdx);
      setSubtasks(updated);
    }
  };

  useEffect(() => {
    if (!open) return;

    if (card) {
      setTitle(card.title ?? "");
      setDescription(card.description || card.content || "");
      descriptionDraftRef.current = card.description || card.content || "";
      setColumnId(card.columnId || firstColumnId);
      setRelations(card.relations || []);
      setPriority(card.priority || "none");
      setLabels(TaskHelpers.uniqueLabels(card.labels));
      setDueDate(card.dueDate || "");
      setStartDate(card.startDate || "");
      setRecurrence(card.recurrence || "none");
      setReminder(card.reminder || "1day");
      setSubtasks(Array.isArray(card.subtasks) ? card.subtasks : []);
      setCompleted(card.completed || false);
      setAttachments(
        Array.isArray(card.attachments)
          ? card.attachments
          : (card.attachments?.files || [])
      );

      const assignee = (card as any).assignee || card.assigneeId;
      setAssigneeId(resolveTaskAssigneeId(assignee));
    } else {
      setTitle("");
      setDescription("");
      descriptionDraftRef.current = "";
      setColumnId(firstColumnId);
      setRelations([]);
      setPriority("none");
      setLabels([]);
      setDueDate("");
      setStartDate("");
      setRecurrence("none");
      setReminder("1day");
      setAssigneeId(null);
      setSubtasks([]);
      setCompleted(false);
      setAttachments(EMPTY_ATTACHMENTS);
    }

    setCommentText("");
    setCommentCaretPosition(0);
    setShowDetailActivity(false);
    setShowDescriptionActions(false);
    initialSnapshotRef.current = TaskHelpers.createSnapshot({
      title: card?.title || "",
      content: card?.description || card?.content || "",
      columnId: card?.columnId || firstColumnId,
      relations: card?.relations || [],
      priority: card?.priority || "none",
      dueDate: card?.dueDate || "",
      startDate: card?.startDate || "",
      labels: TaskHelpers.uniqueLabels(card?.labels),
      assigneeId: resolveTaskAssigneeId((card as any)?.assignee || card?.assigneeId),
      completed: card?.completed || false,
      attachments: card?.attachments ?? EMPTY_ATTACHMENTS,
    });
    autosaveSignatureRef.current = initialSnapshotRef.current;
    autosaveReadyRef.current = false;
  }, [open, card, firstColumnId]);

  const currentPayload = useMemo<TaskMutationInput>(() => {
    return {
      title: title.trim(),
      content: description.trim(),
      description: description.trim(),
      columnId,
      relations,
      priority,
      dueDate: dueDate || null,
      startDate: startDate || null,
      labels,
      assigneeId,
      completed,
      attachments,
      recurrence,
      reminder,
    };
  }, [
    title,
    description,
    columnId,
    relations,
    priority,
    dueDate,
    startDate,
    recurrence,
    reminder,
    labels,
    assigneeId,completed,
    attachments,
  ]);

  const hasUnsavedChanges = useMemo(() => {
    if (!open) return false;
    return TaskHelpers.createSnapshot(currentPayload) !== initialSnapshotRef.current;
  }, [open, currentPayload]);

  const safeSave = useCallback((payload: TaskMutationInput) => {
    if (isReadOnly) return;
    if (!taskId && !payload.title?.trim()) return;
    onSave(payload);
  }, [isReadOnly, taskId, onSave]);

  useEffect(() => {
    if (!open || isReadOnly || !taskId) return;

    if (!autosaveReadyRef.current) {
      autosaveReadyRef.current = true;
      return;
    }

    if (!hasUnsavedChanges) return;

    const payloadSnapshot = TaskHelpers.createSnapshot(currentPayload);
    if (payloadSnapshot === autosaveSignatureRef.current) return;

    const timer = setTimeout(() => {
      autosaveSignatureRef.current = payloadSnapshot;
      safeSave(currentPayload);
    }, 400);

    return () => clearTimeout(timer);
  }, [open, hasUnsavedChanges, currentPayload, isReadOnly, safeSave, taskId]);

  const handleClose = () => {
    onOpenChange(false);
  };

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      handleClose();
      return;
    }
    onOpenChange(true);
  };

  const handleColumnChange = (newColId: string) => {
    setColumnId(newColId);
    safeSave({ ...currentPayload, columnId: newColId });
  };

  const handleJoinTask = () => {
    if (!currentUserId || isReadOnly) return;
    setAssigneeId(currentUserId);
    safeSave({ ...currentPayload, assigneeId: currentUserId });
  };

  const handleLeaveTask = () => {
    if (!isCurrentUserAssignee || isReadOnly) return;
    setAssigneeId(null);
    safeSave({ ...currentPayload, assigneeId: null });
  };

  const handleCopyIdentifier = () => {
    if (card?.identifier) {
      copyTaskText(card.identifier, `Copied identifier: ${card.identifier}`);
    }
  };

  // Subtask quick actions
  const handleAddSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubtaskTitle.trim()) return;
    const title = newSubtaskTitle.trim();
    setNewSubtaskTitle("");

    if (taskId) {
      try {
        const res = await createSubtaskMutation.mutateAsync({
          taskId,
          title,
          columnId: 'todo',
        });
        const created = res.task;
        const newSub: SubtaskMinimal = {
          id: created.id,
          title: created.title,
          identifier: created.identifier,
          columnId: created.columnId || 'todo',
          completed: created.completed || false,
          rank: created.rank || subtasks.length,
          assigneeId: created.assigneeId || null,
          assignee: created.assignee || null,
          dueDate: created.dueDate || null,
        };
        setSubtasks((prev) => [...prev, newSub]);
      } catch {
        // Error toast handled by mutation
      }
    } else {
      const newSub: SubtaskMinimal = {
        id: `sub_${Date.now()}`,
        title,
        completed: false,
        columnId: 'todo',
        rank: subtasks.length,
      };
      setSubtasks((prev) => [...prev, newSub]);
      notifySubtaskAdded();
    }
  };

  // AI Appends
  const handleAiAppendSubtasks = async (newItems: Array<{ title: string; completed: boolean }>) => {
    if (taskId) {
      try {
        const results = await Promise.all(
          newItems.map((item) =>
            createSubtaskMutation.mutateAsync({
              taskId,
              title: item.title,
              columnId: 'todo',
            })
          )
        );
        const createdSubs: SubtaskMinimal[] = results.map((res: any) => ({
          id: res.task.id,
          title: res.task.title,
          identifier: res.task.identifier,
          columnId: res.task.columnId || 'todo',
          completed: res.task.completed || false,
          rank: res.task.rank || 0,
          assigneeId: res.task.assigneeId || null,
          assignee: res.task.assignee || null,
          dueDate: res.task.dueDate || null,
        }));
        setSubtasks((prev) => [...prev, ...createdSubs]);
      } catch {
        // Handled
      }
    } else {
      const createdSubs: SubtaskMinimal[] = newItems.map((item: any, idx: number) => ({
        id: `sub_${Date.now()}_${idx}`,
        title: item.title,
        completed: item.completed,
        columnId: 'todo',
        rank: subtasks.length + idx,
      }));
      setSubtasks((prev) => [...prev, ...createdSubs]);
    }
  };

  const handleAiAppendCriteria = (criteriaItems: string[]) => {
    const criteriaMarkdown = `\n\n### Acceptance Criteria\n${criteriaItems.map((crit) => `- [ ] ${crit}`).join('\n')}`;
    const newDesc = (description || '') + criteriaMarkdown;
    setDescription(newDesc);
    descriptionDraftRef.current = newDesc;
    safeSave({ ...currentPayload, description: newDesc, content: newDesc });
  };

  // File Attachment Actions
  const handleAttachFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const fileList = Array.from(files);
    try {
      const results = await uploadFilesWithToast(fileList, {
        showSuccessToast: false,
        errorMessage: 'Failed to upload attachment',
      });
      const newAttachments: TaskAttachment[] = results.map(({ file: f, url: uploadedUrl }) => ({
        id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        name: f.name,
        type: f.type,
        size: `${Math.round(f.size / 1024)} KB`,
        createdAt: new Date().toISOString(),
        url: uploadedUrl || URL.createObjectURL(f),
      }));
      const updated = [...attachments, ...newAttachments];
      setAttachments(updated);
      setOpenAttachmentPopover(false);
      if (!isReadOnly) onSave({ ...currentPayload, attachments: updated as any });
    } catch {
      // Error toast already handled by uploadFilesWithToast
    }
  };

  const handleRenameAttachment = (attachmentId: string, newName: string) => {
    const updated = attachments.map((a) => (a.id === attachmentId ? { ...a, name: newName } : a));
    setAttachments(updated);
    if (!isReadOnly) onSave({ ...currentPayload, attachments: updated as any });
  };

  const handleRemoveAttachment = (attachmentId: string) => {
    const updated = attachments.filter((a) => a.id !== attachmentId);
    setAttachments(updated);
    if (!isReadOnly) onSave({ ...currentPayload, attachments: updated as any });
  };

  // Comment Actions
  const handleSaveComment = (text: string) => {
    if (!taskId || !text.trim()) return;
    createTaskCommentMutation.mutate({ taskId, content: text.trim() });
    setCommentText("");
  };

  const handleUpdateComment = (commentId: string, content: string) => {
    if (!taskId || !content.trim()) return;
    updateTaskCommentMutation.mutate({ taskId, commentId, content: content.trim() });
  };

  const handleDeleteComment = (commentId: string) => {
    if (!taskId) return;
    deleteTaskCommentMutation.mutate({ taskId, commentId });
  };

  const handleReactComment = (commentId: string, emoji: string) => {
    if (!taskId) return;
    reactTaskCommentMutation.mutate({ taskId, commentId, emoji });
  };

  // Selected Member & Labels for display
  const selectedMember = useMemo(() => {
    if (!assigneeId) return null;
    const m = (members as any[]).find((mem: any) => (mem.user?.id || mem.userId || mem.id) === assigneeId);
    return m ? { name: m.user?.name || m.name || 'Member', avatar: m.user?.avatar || m.avatar } : null;
  }, [assigneeId, members]);

  const selectedLabelsList = useMemo(() => {
    const safeLabels = Array.isArray(workspaceLabels) ? workspaceLabels : [];
    const safeSelected = Array.isArray(labels) ? labels : [];
    return safeLabels.filter((l: any) => safeSelected.includes(l.id));
  }, [workspaceLabels, labels]);

  const progressRollup = useMemo(() => {
    return TaskHelpers.calculateProgressRollup(subtasks);
  }, [subtasks]);

  const visibleActivities = useMemo<ActivityEntry[]>(() => {
    const commentsList = Array.isArray(taskComments)
      ? taskComments
      : (taskComments as any)?.comments || (taskComments as any)?.data || [];
    const commentEntries: ActivityEntry[] = commentsList.map((c: any) => {
      let reactionEmoji: string | undefined = undefined;
      if (c.reactions) {
        if (typeof c.reactions === 'object' && !Array.isArray(c.reactions)) {
          const activeEmojis = Object.entries(c.reactions)
            .filter(([_, uids]) => Array.isArray(uids) && uids.length > 0)
            .map(([emoji]) => emoji);
          if (activeEmojis.length > 0) {
            reactionEmoji = activeEmojis.join(' ');
          }
        } else if (Array.isArray(c.reactions) && c.reactions.length > 0) {
          reactionEmoji = c.reactions[0]?.emoji || c.reactions[0];
        }
      }

      return {
        id: c.id,
        kind: 'comment',
        author: c.author?.name || 'User',
        avatarUrl: c.author?.avatar,
        authorInitials: TaskHelpers.getInitials(c.author?.name),
        content: c.content || '',
        timestamp: TaskHelpers.formatActivityTime(c.createdAt),
        createdAt: c.createdAt ? new Date(c.createdAt).getTime() : Date.now(),
        reactionEmoji,
        permissions: {
          canEdit: true,
          canDelete: true,
        },
      };
    });

    const activityList = Array.isArray(taskActivity)
      ? taskActivity
      : (taskActivity as any)?.activity || (taskActivity as any)?.activities || (taskActivity as any)?.data || [];
    const logEntries: ActivityEntry[] = activityList.map((a: any) => ({
      id: a.id || `log_${Math.random()}`,
      kind: 'activity',
      author: a.user?.name || a.author?.name || 'System',
      avatarUrl: a.user?.avatar || a.author?.avatar,
      authorInitials: TaskHelpers.getInitials(a.user?.name || a.author?.name),
      content: a.message || a.action || 'updated this task',
      timestamp: TaskHelpers.formatActivityTime(a.createdAt),
      createdAt: a.createdAt ? new Date(a.createdAt).getTime() : Date.now(),
    }));

    return [...commentEntries, ...logEntries].sort(
      (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
    );
  }, [taskComments, taskActivity]);

  // Compact Pill Button Class
  const actionBtnClass =
    'h-7 px-2.5 text-xs font-medium rounded-md bg-muted hover:bg-muted text-foreground border border-border shadow-none flex items-center gap-1.5 transition-colors cursor-pointer shrink-0';

  const renderStatusSelector = () => {
    const activeCol = columns.find((c) => resolveTaskColumnId(c) === columnId);
    const activeColColor = resolveTaskColumnColor(columnId, activeCol?.accentColor);
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild disabled={isReadOnly}>
          <button
            type="button"
            className={cn(
              'h-7 px-2.5 text-xs font-medium rounded-md bg-muted hover:bg-muted text-foreground border border-border shadow-none flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 outline-none',
              isReadOnly && 'opacity-60 cursor-not-allowed'
            )}
          >
            <span className="size-2 rounded-full shrink-0 bg-muted-foreground" />
            <span>{activeCol?.title || columnId}</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" sideOffset={4} className="w-44 p-1 text-xs z-100 rounded-md border-border bg-popover">
          {columns.map((col) => {
            const cId = resolveTaskColumnId(col);
            const color = resolveTaskColumnColor(cId, col.accentColor);
            const isCurrent = columnId === cId;
            return (
              <DropdownMenuItem
                key={cId}
                onClick={() => handleColumnChange(cId)}
                className={cn(
                  'flex items-center justify-between px-2.5 py-1.5 rounded-sm text-xs font-medium transition-colors hover:bg-muted cursor-pointer text-left',
                  isCurrent && 'bg-muted text-foreground font-semibold'
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                  <span className="truncate">{col.title}</span>
                </div>
                {isCurrent && <Check className="size-3.5 shrink-0 text-primary" />}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent
        ref={dialogScrollRef}
        showCloseButton={false}
        className="w-[94vw] max-w-[900px] sm:max-w-[900px] max-h-[85vh] p-0 border border-border rounded-lg overflow-hidden flex flex-col bg-background text-foreground duration-150"
        style={{
          width: "min(900px, 94vw)",
          maxWidth: "900px",
          maxHeight: "85vh",
        }}
      >
        <div className="flex h-full min-h-0 flex-col bg-background text-foreground overflow-hidden">
          {/* Top Modal Header */}
          <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-border bg-background shrink-0">
            <DialogTitle className="text-base sm:text-lg font-semibold text-foreground tracking-tight flex items-center gap-2">
              <span>{card?.identifier ? card.identifier : "Task Detail"}</span>
              {isArchived && (
                <span className="px-1.5 py-0.5 rounded text-10 font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  Archived
                </span>
              )}
            </DialogTitle>

            {/* Menu Actions & Close */}
            <div className="flex items-center gap-0.5">
              <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 rounded-md text-foreground hover:bg-muted cursor-pointer outline-none"
                      aria-label="More actions"
                    >
                      <MoreHorizontal className="size-3.5 shrink-0" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48 rounded-md border-border p-1">
                    {!isReadOnly && onDuplicate && (
                      <DropdownMenuItem onClick={onDuplicate} className="rounded-sm py-1.5 text-xs">
                        <Copy className="mr-2 h-3.5 w-3.5 shrink-0 text-foreground" />
                        <span>Duplicate</span>
                      </DropdownMenuItem>
                    )}
                    {!isReadOnly && taskId && (
                      <DropdownMenuItem
                        onClick={isArchived ? handleRestoreTask : handleArchiveTask}
                        className="rounded-sm py-1.5 text-xs"
                      >
                        {isArchived ? (
                          <>
                            <ArchiveRestore className="mr-2 h-3.5 w-3.5 shrink-0 text-foreground" />
                            <span>Restore issue</span>
                          </>
                        ) : (
                          <>
                            <Archive className="mr-2 h-3.5 w-3.5 shrink-0 text-foreground" />
                            <span>Archive issue</span>
                          </>
                        )}
                      </DropdownMenuItem>
                    )}
                    {!isReadOnly && (
                      <DropdownMenuItem onClick={handleSaveAsTemplate} className="rounded-sm py-1.5 text-xs">
                        <Bookmark className="mr-2 h-3.5 w-3.5 shrink-0 text-foreground" />
                        <span>Save as template</span>
                      </DropdownMenuItem>
                    )}
                    {currentUserId && (
                      <DropdownMenuItem
                        onClick={isCurrentUserAssignee ? handleLeaveTask : handleJoinTask}
                        className="rounded-sm py-1.5 text-xs"
                      >
                        {isCurrentUserAssignee ? (
                          <UserMinus className="mr-2 h-3.5 w-3.5 shrink-0 text-foreground" />
                        ) : (
                          <UserPlus className="mr-2 h-3.5 w-3.5 shrink-0 text-foreground" />
                        )}
                        <span>{isCurrentUserAssignee ? "Leave work item" : "Join work item"}</span>
                      </DropdownMenuItem>
                    )}
                    {onRemoveFromCycle && (
                      <DropdownMenuItem onClick={onRemoveFromCycle} className="rounded-sm py-1.5 text-xs">
                        <RotateCcw className="mr-2 h-3.5 w-3.5 shrink-0 text-foreground" />
                        <span>Remove from cycle</span>
                      </DropdownMenuItem>
                    )}
                    {!isReadOnly && onDelete && (
                      <DropdownMenuItem
                        onClick={onDelete}
                        className="rounded-sm py-1.5 text-xs text-destructive focus:bg-destructive focus:text-destructive-foreground"
                      >
                        <Trash2 className="mr-2 h-3.5 w-3.5 shrink-0" />
                        <span>Delete work item</span>
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>

              <Button
                variant="ghost"
                size="icon"
                aria-label="Close dialog"
                className="size-7 rounded-md text-foreground hover:bg-muted cursor-pointer outline-none"
                onClick={handleClose}
              >
                <X className="size-4 shrink-0" />
              </Button>
            </div>
          </div>

          {/* Properties Toolbar Bar */}
          <div className="flex items-center justify-between px-3.5 py-1.5 border-b border-border bg-background sticky top-0 z-30 shrink-0 min-h-10">
              <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                {renderStatusSelector()}

                {card?.identifier && (
                  <button
                    type="button"
                    onClick={handleCopyIdentifier}
                    className="font-mono text-11 font-semibold text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded-sm bg-muted hover:bg-muted transition-colors cursor-pointer flex items-center gap-1 shrink-0"
                    title="Click to copy identifier"
                    aria-label="Copy identifier"
                  >
                    <span>{card.identifier}</span>
                  </button>
                )}
              </div>
            </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0">
              <div className="grid grid-cols-1 items-start gap-5 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_285px]">
                {/* Left Column: Work Item Main Info */}
                <div className="min-w-0 space-y-3.5">
                  {/* Title Input */}
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Work item title"
                    aria-label="Work item title"
                    disabled={isReadOnly}
                    className="w-full text-base sm:text-lg font-semibold text-foreground outline-none bg-transparent placeholder:text-muted-foreground border-none p-0 focus:ring-0 tracking-tight"
                  />

                  {/* Progress Rollup Bar */}
                  {subtasks.length > 0 && (
                    <div className="space-y-1 p-2 rounded-md bg-muted border border-border">
                      <div className="flex items-center justify-between text-11">
                        <span className="font-semibold text-foreground flex items-center gap-1">
                          <Zap className="size-3 shrink-0 text-amber-500" />
                          Overall Completion
                        </span>
                        <span className="font-semibold text-muted-foreground tabular-nums">{progressRollup}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                          style={{ width: `${progressRollup}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Description Editor (Fast Inline Auto-saving Box) */}
                  <div className="space-y-2">
                    <textarea
                      value={description}
                      aria-label="Work item description"
                      onChange={(e) => {
                        setDescription(e.target.value);
                        setShowDescriptionActions(true);
                      }}
                      placeholder="Add a detailed description..."
                      disabled={isReadOnly}
                      rows={3}
                      className="w-full resize-none rounded-md border border-border bg-background p-2.5 text-xs text-foreground outline-none focus:border-primary transition-colors leading-relaxed min-h-[85px]"
                    />
                    {showDescriptionActions && !isReadOnly && (
                      <div className="flex gap-1.5">
                        <Button
                          size="sm"
                          className="h-7 text-xs px-2.5"
                          onClick={() => {
                            setShowDescriptionActions(false);
                            descriptionDraftRef.current = description;
                            onSave(currentPayload);
                          }}
                        >
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs px-2.5"
                          onClick={() => {
                            setDescription(descriptionDraftRef.current);
                            setShowDescriptionActions(false);
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Secondary Properties Toolbar (Assignee, Labels, Dates, Attach, AI) */}
                  <div className="space-y-1.5">
                    {/* Active Chips */}
                    {(selectedMember || selectedLabelsList.length > 0 || dueDate || startDate) && (
                      <div className="flex flex-wrap items-center gap-1 pt-0.5">
                        {selectedMember && (
                          <div className="flex items-center gap-1 bg-muted rounded-md px-1.5 py-0.5 text-10 font-medium text-foreground border border-border">
                            <Avatar className="size-3.5">
                              <AvatarImage src={selectedMember.avatar} />
                              <AvatarFallback className="text-9">
                                {selectedMember.name.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <span>{selectedMember.name}</span>
                            {!isReadOnly && (
                              <button
                                type="button"
                                onClick={() => {
                                  setAssigneeId(null);
                                  onSave({ ...currentPayload, assigneeId: null });
                                }}
                                className="hover:text-red-500 cursor-pointer ml-0.5"
                              >
                                <X className="size-2.5 shrink-0" />
                              </button>
                            )}
                          </div>
                        )}

                        {selectedLabelsList.map((l: any) => (
                          <span
                            key={l.id}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-10 font-semibold text-white shadow-xs"
                            style={{ backgroundColor: l.color }}
                          >
                            {l.name}
                            {!isReadOnly && (
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = labels.filter((id) => id !== l.id);
                                  setLabels(updated);
                                  onSave({ ...currentPayload, labels: updated });
                                }}
                                className="hover:opacity-80 cursor-pointer"
                              >
                                <X className="size-2.5 shrink-0" />
                              </button>
                            )}
                          </span>
                        ))}

                        {(startDate || dueDate) && (
                          <div className="flex items-center gap-1 bg-muted rounded-md px-1.5 py-0.5 text-10 font-medium text-foreground border border-border">
                            <Clock className="size-3 shrink-0 text-muted-foreground" />
                            <span>
                              {startDate && new Date(startDate).toLocaleDateString('vi-VN', { day: 'numeric', month: 'short' })}
                              {startDate && dueDate ? ' - ' : ''}
                              {dueDate && new Date(dueDate).toLocaleDateString('vi-VN', { day: 'numeric', month: 'short' })}
                            </span>
                            {!isReadOnly && (
                              <button
                                type="button"
                                onClick={() => {
                                  setStartDate("");
                                  setDueDate("");
                                  setRecurrence("none");
                                  setReminder("1day");
                                  onSave({
                                    ...currentPayload,
                                    startDate: null,
                                    dueDate: null,
                                  });
                                }}
                                className="hover:text-red-500 cursor-pointer ml-0.5"
                              >
                                <X className="size-2.5 shrink-0" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Actions Toolbar - All Buttons in 1 Single Row with Monochrome Icons */}
                    {!isReadOnly && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {renderStatusSelector()}

                        <MemberPopover
                          open={openMemberPopover}
                          onOpenChange={setOpenMemberPopover}
                          assigneeId={assigneeId}
                          setAssigneeId={(id) => {
                            setAssigneeId(id);
                            onSave({ ...currentPayload, assigneeId: id });
                          }}
                          members={members}
                          actionBtnClass={actionBtnClass}
                        />

                        <PriorityPopover
                          open={openPriorityPopover}
                          onOpenChange={setOpenPriorityPopover}
                          priority={priority}
                          setPriority={(p) => {
                            setPriority(p);
                            onSave({ ...currentPayload, priority: p });
                          }}
                          actionBtnClass={actionBtnClass}
                        />

                        <LabelPopover
                          open={openLabelPopover}
                          onOpenChange={setOpenLabelPopover}
                          labels={labels}
                          setLabels={(l) => {
                            const updated = typeof l === 'function' ? l(labels) : l;
                            setLabels(updated);
                            onSave({ ...currentPayload, labels: updated });
                          }}
                          actionBtnClass={actionBtnClass}
                        />

                        <DatePopover
                          open={openDatePopover}
                          onOpenChange={setOpenDatePopover}
                          startDate={startDate}
                          dueDate={dueDate}
                          recurrence={recurrence}
                          reminder={reminder}
                          onApplyDates={(data) => {
                            setStartDate(data.startDate || "");
                            setDueDate(data.dueDate || "");
                            setRecurrence(data.recurrence || "none");
                            setReminder(data.reminder || "1day");
                            onSave({
                              ...currentPayload,
                              startDate: data.startDate,
                              dueDate: data.dueDate,
                            });
                          }}
                          actionBtnClass={actionBtnClass}
                        />



                        <Popover open={openAttachmentPopover} onOpenChange={setOpenAttachmentPopover}>
                          <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className={actionBtnClass}>
                              <Paperclip className="size-3.5 shrink-0 text-muted-foreground" />
                              <span>Attach</span>
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent align="start" className="w-72 rounded-md p-0 border-border flex flex-col z-100">
                            <div className="flex items-center justify-between px-3 py-1.5 border-b border-border shrink-0">
                              <span className="text-xs font-semibold text-foreground">Attach Files</span>
                              <Button variant="ghost" size="icon" className="size-5 text-foreground" onClick={() => setOpenAttachmentPopover(false)}>
                                <X className="size-3 shrink-0" />
                              </Button>
                            </div>
                            <div className="p-2.5 space-y-2">
                              <div
                                onDragOver={(e) => {
                                  e.preventDefault();
                                  setDragActive(true);
                                }}
                                onDragLeave={() => setDragActive(false)}
                                onDrop={(e) => {
                                  e.preventDefault();
                                  setDragActive(false);
                                  handleAttachFiles(e.dataTransfer.files);
                                }}
                                onClick={() => fileInputRef.current?.click()}
                                className={cn(
                                  'border border-dashed rounded-md p-3 text-center cursor-pointer transition-colors',
                                  dragActive ? 'border-primary bg-muted' : 'border-border hover:bg-muted'
                                )}
                              >
                                <Paperclip className="mx-auto h-5 w-5 shrink-0 text-muted-foreground mb-1" />
                                <p className="text-xs font-semibold text-foreground">Click or drag & drop</p>
                                <p className="text-10 text-muted-foreground mt-0.5">Images, PDFs, Documents</p>
                                <input
                                  ref={fileInputRef}
                                  type="file"
                                  multiple
                                  className="hidden"
                                  onChange={(e) => handleAttachFiles(e.target.files)}
                                />
                              </div>
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                    )}
                  </div>

                  {/* Dependencies & Relations */}
                  <TaskRelations
                    relations={relations}
                    currentTaskId={taskId || undefined}
                    availableTasks={availableTasks}
                    onAddRelation={(newRel) => {
                      const updated = [...relations, newRel];
                      setRelations(updated);
                      if (taskId && newRel.targetTaskId) {
                        addRelationMutation.mutate({
                          taskId,
                          type: newRel.type,
                          targetTaskId: newRel.targetTaskId,
                        });
                      } else {
                        onSave({ ...currentPayload, relations: updated });
                      }
                    }}
                    onRemoveRelation={(relId, targetTaskId) => {
                      const updated = relations.filter((r) => r.id !== relId);
                      setRelations(updated);
                      if (taskId) {
                        removeRelationMutation.mutate({
                          taskId,
                          relationId: relId,
                          targetTaskId,
                        });
                      } else {
                        onSave({ ...currentPayload, relations: updated });
                      }
                    }}
                    isReadOnly={isReadOnly}
                  />

                  {/* Subtasks Section */}
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between">
                      <label className="text-11 font-semibold text-muted-foreground tracking-normal flex items-center gap-1.5">
                        <GitBranch className="size-3.5 shrink-0" />
                        <span>Subtasks ({subtasks.filter((s: any) => s.completed || s.columnId === 'done').length}/{subtasks.length})</span>
                      </label>
                    </div>

                    {subtasks.length > 0 && (
                      <div className="divide-y divide-border rounded-md border border-border bg-background overflow-hidden">
                        {subtasks.map((sub: any, sIdx: number) => {
                          const isSubDone = sub.completed || sub.columnId === 'done';
                          return (
                            <div key={sub.id || sIdx} className="flex items-center justify-between px-2.5 py-1.5 text-xs hover:bg-muted transition-colors group">
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <button
                                  type="button"
                                  disabled={isReadOnly}
                                  onClick={() => {
                                    const updated = subtasks.map((s, i) =>
                                      i === sIdx ? { ...s, completed: !isSubDone, columnId: !isSubDone ? 'done' : 'todo' } : s
                                    );
                                    setSubtasks(updated);
                                  }}
                                  className={cn(
                                    'size-3.5 rounded-sm border flex items-center justify-center transition-colors cursor-pointer',
                                    isSubDone ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-border hover:border-primary'
                                  )}
                                >
                                  {isSubDone && <Check className="size-2.5 shrink-0" />}
                                </button>
                                <span className={cn("font-medium text-xs", isSubDone ? 'line-through text-muted-foreground' : 'text-foreground')}>
                                  {sub.title}
                                </span>
                              </div>

                              {!isReadOnly && (
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    type="button"
                                    onClick={() => handleConvertSubtask(sub, sIdx)}
                                    className="hover:text-primary p-0.5 text-muted-foreground cursor-pointer transition-colors"
                                    title="Convert to independent work item"
                                  >
                                    <ArrowUpRight className="size-3.5 shrink-0" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updated = subtasks.filter((_, i) => i !== sIdx);
                                      setSubtasks(updated);
                                      onSave({ ...currentPayload });
                                    }}
                                    className="hover:text-red-500 p-0.5 text-muted-foreground cursor-pointer transition-colors"
                                    title="Delete subtask"
                                  >
                                    <X className="size-3 shrink-0" />
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {!isReadOnly && (
                      <form onSubmit={handleAddSubtask} className="flex items-center gap-1.5">
                        <Input
                          value={newSubtaskTitle}
                          onChange={(e) => setNewSubtaskTitle(e.target.value)}
                          placeholder="+ Add subtask..."
                          className="h-7 text-xs"
                        />
                        {newSubtaskTitle.trim() && (
                          <Button type="submit" size="sm" className="h-7 text-xs shrink-0 px-2.5">
                            Add
                          </Button>
                        )}
                      </form>
                    )}
                  </div>

                  {/* Attachments Section */}
                  <TaskAttachments
                    attachments={attachments}
                    onRenameAttachment={handleRenameAttachment}
                    onRemoveAttachment={handleRemoveAttachment}
                    isReadOnly={isReadOnly}
                  />

                  {/* Progress Briefings / Status Updates Section */}
                  {taskId && (
                    <TaskUpdates
                      taskId={taskId}
                      projectId={currentProjectId}
                      isReadOnly={isReadOnly}
                    />
                  )}
                </div>

                {/* Right Column: Compact Activities & Comments Timeline */}
                <div className="border-t lg:border-t-0 lg:border-l border-border pt-4 lg:pt-0 lg:pl-5 sticky top-0">
                  <TaskActivities
                    commentText={commentText}
                    setCommentText={setCommentText}
                    commentTextareaRef={commentTextareaRef}
                    onSaveComment={handleSaveComment}
                    onUpdateComment={handleUpdateComment}
                    onDeleteComment={handleDeleteComment}
                    onReactComment={handleReactComment}
                    attachmentLinks={attachments.map((item) => ({ name: item.name, url: item.url }))}
                    commentFocusToken={commentFocusToken}
                    commentCaretPosition={commentCaretPosition}
                    onCommentCaretChange={setCommentCaretPosition}
                    canComment={canComment}
                    isSavingComment={createTaskCommentMutation.isPending}
                    isUpdatingComment={updateTaskCommentMutation.isPending}
                    showDetailActivity={showDetailActivity}
                    setShowDetailActivity={setShowDetailActivity}
                    activityLoading={activityLoading}
                    activityError={Boolean(activityError)}
                    activities={visibleActivities}
                    isReadOnly={isReadOnly}
                  />
                </div>
              </div>
            </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export const TaskDetailModal = DetailModal;
export const WorkItemDetailModal = DetailModal;
export const TaskDialog = DetailModal;
export default DetailModal;
