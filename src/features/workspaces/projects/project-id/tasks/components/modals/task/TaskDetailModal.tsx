'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  Button,
  Avatar,
  AvatarFallback,
  AvatarImage,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui";
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
  CheckSquare,
  GitBranch,
} from "lucide-react";
import { useParams } from "next/navigation";
import { useUpload } from "@/shared/hooks/use-upload";
import { useAuth } from '@/features/auth/hooks/use-auth';
import { cn } from "@/shared/lib/utils";

import type {
  Task,
  Column,
  TaskMutationInput,
  TaskPriority,
  Checklist,
  TaskRecurrence,
  TaskReminder,
} from '../../../types/task.types';
import { resolveTaskColumnId, type Project, type ProjectMember } from "../../../types/task.types";
import {
  useTaskComments,
  useAddComment,
  useDeleteComment,
  useTaskActivityLogs,
  useLabelsQuery,
  TaskHelpers,
} from "../../../hooks/use-task";

import { TaskActivities, type ActivityEntry } from "./TaskActivities";
import { TaskChecklist } from "./TaskChecklist";
import { TaskAttachments, type TaskAttachment } from "./TaskAttachments";
import { MemberPopover } from "./popovers/MemberPopover";
import { LabelPopover } from "./popovers/LabelPopover";
import { DatePopover } from "./popovers/DatePopover";
import { PriorityPopover, PRIORITY_CONFIG } from "./popovers/PriorityPopover";

function resolveTaskAssigneeId(assignee?: Task["assigneeId"] | string | null): string | null {
  if (!assignee) return null;
  if (typeof assignee === "string") return assignee;
  return assignee.id ?? null;
}

const EMPTY_ATTACHMENTS: TaskAttachment[] = [];

export type TaskDetailModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card?: Partial<Task>;
  columns: Column[];
  project?: Project;
  members?: ProjectMember[];
  onSave: (card: TaskMutationInput) => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onRemoveFromCycle?: () => void;
  isReadOnly?: boolean;
};

export function TaskDetailModal({
  open,
  onOpenChange,
  card,
  columns,
  members = [],
  onSave,
  onDelete,
  onDuplicate,
  onRemoveFromCycle,
  isReadOnly = false,
}: TaskDetailModalProps) {
  const { workspaceId } = useParams() as { workspaceId: string };
  const { user: currentUser } = useAuth();
  const { uploadFile } = useUpload();
  const { data: rawLabels } = useLabelsQuery(workspaceId || '', 'task');
  const workspaceLabels = useMemo(() => {
    if (Array.isArray(rawLabels)) return rawLabels;
    if (Array.isArray((rawLabels as any)?.labels)) return (rawLabels as any).labels;
    return [];
  }, [rawLabels]);
  const firstColumnId = resolveTaskColumnId(columns[0]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [columnId, setColumnId] = useState(firstColumnId);
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
  const [checklists, setChecklists] = useState<Checklist[]>([]);
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
  const [openChecklistPopover, setOpenChecklistPopover] = useState(false);
  const [openAttachmentPopover, setOpenAttachmentPopover] = useState(false);
  const [newChecklistTitle, setNewChecklistTitle] = useState("Checklist");
  const [dragActive, setDragActive] = useState(false);

  const taskId = card?.id || null;
  const currentUserId = currentUser?.id || null;
  const isCurrentUserAssignee = Boolean(currentUserId && assigneeId === currentUserId);
  const canComment = Boolean(taskId);
  const { data: taskComments = [] } = useTaskComments(open && taskId ? taskId : "");
  const { data: taskActivity = [], error: activityError, isLoading: activityLoading } = useTaskActivityLogs(open && taskId ? taskId : "");
  const createTaskCommentMutation = useAddComment();
  const updateTaskCommentMutation = { mutate: (_payload: any) => {}, isPending: false };
  const deleteTaskCommentMutation = useDeleteComment();

  useEffect(() => {
    if (!open) return;

    if (card) {
      setTitle(card.title ?? "");
      setDescription(card.description || card.content || "");
      descriptionDraftRef.current = card.description || card.content || "";
      setColumnId(card.columnId || firstColumnId);
      setPriority(card.priority || "none");
      setLabels(TaskHelpers.uniqueLabels(card.labels));
      setDueDate(card.dueDate || "");
      setStartDate(card.startDate || "");
      setRecurrence(card.recurrence || "none");
      setReminder(card.reminder || "1day");

      const rawChecklists = Array.isArray(card.checklists) ? card.checklists : [];
      const parsedChecklists = rawChecklists.map((c: any, index: number) => {
        if (!c.items && (c.text || c.title !== undefined || c.completed !== undefined)) {
          return {
            id: c.id || `cl-${index}`,
            title: c.name || 'Checklist',
            items: [{
              id: c.id || `item-${index}`,
              title: c.text || c.title || '',
              completed: Boolean(c.completed),
              assigneeId: c.assigneeId,
              dueDate: c.dueDate,
            }],
          };
        }
        return {
          id: c.id || `cl-${index}`,
          title: c.title || c.name || `Checklist ${index + 1}`,
          items: (Array.isArray(c.items) ? c.items : []).map((i: any, itemIndex: number) => ({
            id: i.id || `item-${index}-${itemIndex}`,
            title: i.title || i.text || '',
            completed: Boolean(i.completed),
            assigneeId: i.assigneeId,
            dueDate: i.dueDate,
          })),
        };
      });
      setChecklists(parsedChecklists);

      setCompleted(card.completed || false);
      setAttachments(card.attachments || []);

      const assignee = card.assigneeId;
      setAssigneeId(resolveTaskAssigneeId(assignee));
    } else {
      setTitle("");
      setDescription("");
      descriptionDraftRef.current = "";
      setColumnId(firstColumnId);
      setPriority("none");
      setLabels([]);
      setDueDate("");
      setStartDate("");
      setRecurrence("none");
      setReminder("1day");
      setAssigneeId(null);
      setChecklists([]);
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
      description: card?.description || card?.content || "",
      columnId: card?.columnId || firstColumnId,
      priority: card?.priority || "none",
      dueDate: card?.dueDate || "",
      startDate: card?.startDate || "",
      recurrence: card?.recurrence || "none",
      reminder: card?.reminder || "1day",
      labels: TaskHelpers.uniqueLabels(card?.labels),
      assigneeId: resolveTaskAssigneeId(card?.assigneeId as Task["assigneeId"] | string | null | undefined),
      checklists: card?.checklists || [],
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
      priority,
      dueDate: dueDate || null,
      startDate: startDate || null,
      recurrence: recurrence || "none",
      reminder: reminder || "1day",
      labels,
      assigneeId,
      checklists: TaskHelpers.normalizeChecklists(checklists),
      completed,
      attachments,
    };
  }, [title, description, columnId, dueDate, startDate, recurrence, reminder, labels, assigneeId, checklists, completed, attachments]);

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
    if (!open || isReadOnly) return;

    if (!autosaveReadyRef.current) {
      autosaveReadyRef.current = true;
      return;
    }

    if (!hasUnsavedChanges) return;
    if (!taskId && !currentPayload.title?.trim()) return;

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

  // Checklist Actions
  const handleAddChecklist = (checklistTitle: string) => {
    const newChecklist: Checklist = {
      id: `temp_${Date.now()}`,
      title: checklistTitle,
      items: [],
    };
    const updated = [...checklists, newChecklist];
    setChecklists(updated);
    safeSave({ ...currentPayload, checklists: TaskHelpers.normalizeChecklists(updated) });
  };

  const handleDeleteChecklist = (checklistId: string) => {
    const updated = checklists.filter((c) => c.id !== checklistId);
    setChecklists(updated);
    safeSave({ ...currentPayload, checklists: TaskHelpers.normalizeChecklists(updated) });
  };

  const handleToggleChecklistItem = (checklistId: string, itemId: string) => {
    const updated = checklists.map((c) => {
      if (c.id !== checklistId) return c;
      return {
        ...c,
        items: c.items.map((i) => (i.id === itemId ? { ...i, completed: !i.completed } : i)),
      };
    });
    setChecklists(updated);
    safeSave({ ...currentPayload, checklists: TaskHelpers.normalizeChecklists(updated) });
  };

  const handleDeleteChecklistItem = (checklistId: string, itemId: string) => {
    const updated = checklists.map((c) => {
      if (c.id !== checklistId) return c;
      return {
        ...c,
        items: c.items.filter((i) => i.id !== itemId),
      };
    });
    setChecklists(updated);
    safeSave({ ...currentPayload, checklists: TaskHelpers.normalizeChecklists(updated) });
  };

  const handleUpdateChecklistItem = (checklistId: string, itemId: string, newTitle: string) => {
    const updated = checklists.map((c) => {
      if (c.id !== checklistId) return c;
      return {
        ...c,
        items: c.items.map((i) => (i.id === itemId ? { ...i, title: newTitle } : i)),
      };
    });
    setChecklists(updated);
    safeSave({ ...currentPayload, checklists: TaskHelpers.normalizeChecklists(updated) });
  };

  const handleAddChecklistItem = (checklistId: string, itemTitle: string) => {
    const newItem = {
      id: `temp_item_${Date.now()}`,
      title: itemTitle,
      completed: false,
    };
    const updated = checklists.map((c) => {
      if (c.id !== checklistId) return c;
      return { ...c, items: [...c.items, newItem] };
    });
    setChecklists(updated);
    safeSave({ ...currentPayload, checklists: TaskHelpers.normalizeChecklists(updated) });
  };

  // Attachment Actions
  const handleAttachFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const fileList = Array.from(files);
    try {
      await Promise.all(fileList.map((f) => uploadFile(f)));
      const newAttachments: TaskAttachment[] = fileList.map((f) => ({
        id: `temp_att_${Date.now()}_${Math.random()}`,
        name: f.name,
        type: f.type,
        size: `${Math.round(f.size / 1024)} KB`,
        createdAt: new Date().toISOString(),
        url: URL.createObjectURL(f),
      }));
      const updated = [...attachments, ...newAttachments];
      setAttachments(updated);
      setOpenAttachmentPopover(false);
      if (!isReadOnly) onSave({ ...currentPayload, attachments: updated });
    } catch {
      // Ignored
    }
  };

  const handleRenameAttachment = (attachmentId: string, newName: string) => {
    const updated = attachments.map((a) => (a.id === attachmentId ? { ...a, name: newName } : a));
    setAttachments(updated);
    if (!isReadOnly) onSave({ ...currentPayload, attachments: updated });
  };

  const handleRemoveAttachment = (attachmentId: string) => {
    const updated = attachments.filter((a) => a.id !== attachmentId);
    setAttachments(updated);
    if (!isReadOnly) onSave({ ...currentPayload, attachments: updated });
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

  const handleReactComment = () => {};

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

  const visibleActivities = useMemo<ActivityEntry[]>(() => {
    const commentsList = Array.isArray(taskComments)
      ? taskComments
      : (taskComments as any)?.comments || (taskComments as any)?.data || [];
    const commentEntries: ActivityEntry[] = commentsList.map((c: any) => ({
      id: c.id,
      kind: 'comment',
      author: c.author?.name || 'User',
      avatarUrl: c.author?.avatar,
      authorInitials: TaskHelpers.getInitials(c.author?.name),
      content: c.content || '',
      timestamp: TaskHelpers.formatActivityTime(c.createdAt),
      createdAt: c.createdAt ? new Date(c.createdAt).getTime() : Date.now(),
      reactionEmoji: c.reactions?.[0]?.emoji,
      permissions: {
        canEdit: true,
        canDelete: true,
      },
    }));

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

  const actionBtnClass =
    'h-8 px-2.5 text-xs font-medium rounded-md bg-muted hover:bg-muted/80 text-foreground border-none shadow-none flex items-center gap-1.5 transition-colors cursor-pointer';

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent
        ref={dialogScrollRef}
        showCloseButton={false}
        className="max-h-[92vh] overflow-y-auto rounded-sm border-0 p-0 shadow-2xl"
        style={{
          width: "min(1320px, 96vw)",
          maxWidth: "1320px",
          height: "auto",
          maxHeight: "92vh",
        }}
      >
        <DialogTitle className="sr-only">Task detail</DialogTitle>

        <div className="flex min-h-0 flex-col bg-white">
          {/* Top Dialog Action Bar */}
          <div className="flex items-center justify-between px-7 py-5 border-b border-border bg-background sticky top-0 z-20 shrink-0">
            <Select value={columnId} onValueChange={handleColumnChange} disabled={isReadOnly}>
              <SelectTrigger className="h-9 w-auto min-w-30 rounded-sm border-0 bg-muted px-3 text-[14px] font-semibold text-foreground shadow-none hover:bg-muted/80 focus:ring-0 transition-colors">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent className="rounded-sm border-border/50 shadow-xl">
                {columns.map((col) => {
                  const val = resolveTaskColumnId(col);
                  return (
                    <SelectItem key={val} value={val} className="py-2.5">
                      {col.title}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-1">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-9 rounded-sm text-foreground hover:bg-muted cursor-pointer outline-none"
                    aria-label="More task actions"
                  >
                    <MoreHorizontal className="h-5 w-5 text-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" onCloseAutoFocus={(e) => e.preventDefault()} className="w-56 rounded-sm border-border/50 shadow-xl p-1.5">
                  {!isReadOnly && onDuplicate && (
                    <DropdownMenuItem onClick={onDuplicate} className="rounded-sm py-2.5">
                      <Copy className="mr-3 h-4 w-4 text-foreground" />
                      <span className="text-foreground">Duplicate</span>
                    </DropdownMenuItem>
                  )}
                  {currentUserId && (
                    <DropdownMenuItem
                      onClick={isCurrentUserAssignee ? handleLeaveTask : handleJoinTask}
                      className="rounded-sm py-2.5"
                    >
                      {isCurrentUserAssignee ? (
                        <UserMinus className="mr-3 h-4 w-4 text-foreground" />
                      ) : (
                        <UserPlus className="mr-3 h-4 w-4 text-foreground" />
                      )}
                      <span className="text-foreground">{isCurrentUserAssignee ? "Leave" : "Join"}</span>
                    </DropdownMenuItem>
                  )}
                  {onRemoveFromCycle && (
                    <DropdownMenuItem
                      onClick={onRemoveFromCycle}
                      className="rounded-sm py-2.5"
                    >
                      <RotateCcw className="mr-3 h-4 w-4 text-foreground" />
                      <span className="text-foreground">Remove from cycle</span>
                    </DropdownMenuItem>
                  )}
                  {!isReadOnly && onDelete && (
                    <DropdownMenuItem
                      onClick={onDelete}
                      className="rounded-sm py-2.5 text-destructive focus:bg-destructive/10 focus:text-destructive"
                    >
                      <Trash2 className="mr-3 h-4 w-4" />
                      <span>Delete task</span>
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                variant="ghost"
                size="icon"
                className="size-9 rounded-sm text-foreground hover:bg-muted cursor-pointer outline-none"
                onClick={handleClose}
              >
                <X className="h-5 w-5 text-foreground" />
              </Button>
            </div>
          </div>

          {/* Main Layout Grid */}
          <div className="grid grid-cols-1 items-start gap-12 px-10 py-8 lg:grid-cols-[minmax(0,1fr)_400px]">
            <div className="min-w-0 space-y-6">
              {/* Identifier & Parent Task Breadcrumb */}
              {(card?.identifier || card?.parentTask) && (
                <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                  {card?.parentTask && (
                    <span className="inline-flex items-center gap-1">
                      Parent: {card.parentTask.identifier ? `[${card.parentTask.identifier}]` : ''} {card.parentTask.title} &bull;
                    </span>
                  )}
                  {card?.identifier && (
                    <span className="bg-muted px-2 py-0.5 rounded text-[11px] font-bold text-foreground">
                      {card.identifier}
                    </span>
                  )}
                </div>
              )}

              {/* Title input */}
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Task title"
                disabled={isReadOnly}
                className="w-full text-[24px] font-bold text-foreground outline-none bg-transparent placeholder:text-muted-foreground border-none p-0 focus:ring-0"
              />

              {/* Task Actions Badges & Toolbars */}
              <div className="space-y-4">
                {(selectedMember || selectedLabelsList.length > 0 || dueDate || startDate || (priority && priority !== 'none')) && (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {priority && priority !== 'none' && (() => {
                      const pConfig = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.none;
                      const PIcon = pConfig.icon;
                      return (
                        <div className={cn("flex items-center gap-1.5 rounded-sm px-2 py-1 text-xs font-semibold border", pConfig.bg)}>
                          <PIcon className={cn("size-3.5", pConfig.color)} />
                          <span>{pConfig.label}</span>
                          {!isReadOnly && (
                            <button
                              type="button"
                              onClick={() => {
                                setPriority("none");
                                onSave({ ...currentPayload, priority: "none" });
                              }}
                              className="hover:opacity-75 cursor-pointer ml-0.5"
                            >
                              <X className="size-3" />
                            </button>
                          )}
                        </div>
                      );
                    })()}

                    {selectedMember && (
                      <div className="flex items-center gap-1.5 bg-muted rounded-md px-2 py-1 text-xs font-medium text-foreground">
                        <Avatar className="size-4">
                          <AvatarImage src={selectedMember.avatar} />
                          <AvatarFallback className="text-[9px]">
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
                            <X className="size-3" />
                          </button>
                        )}
                      </div>
                    )}

                    {selectedLabelsList.map((l: any) => (
                      <span
                        key={l.id}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-[11px] font-bold text-white shadow-xs"
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
                            <X className="size-3" />
                          </button>
                        )}
                      </span>
                    ))}

                    {(startDate || dueDate) && (
                      <div className="flex items-center gap-1.5 bg-muted rounded-md px-2 py-1 text-xs font-medium text-foreground">
                        <Clock className="size-3 text-muted-foreground" />
                        <span>
                          {startDate && new Date(startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                          {startDate && dueDate ? ' - ' : ''}
                          {dueDate && new Date(dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
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
                                recurrence: "none",
                                reminder: "1day",
                              });
                            }}
                            className="hover:text-red-500 cursor-pointer ml-0.5"
                          >
                            <X className="size-3" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Popovers Action Bar */}
                {!isReadOnly && (
                  <div className="flex flex-wrap items-center gap-1.5">
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
                          recurrence: data.recurrence || "none",
                          reminder: data.reminder || "1day",
                        });
                      }}
                      actionBtnClass={actionBtnClass}
                    />

                    {/* Checklist Popover */}
                    <Popover open={openChecklistPopover} onOpenChange={setOpenChecklistPopover}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={
                            openChecklistPopover
                              ? 'h-10 rounded-sm border border-border bg-muted px-4 text-[15px] font-medium text-foreground shadow-none'
                              : actionBtnClass
                          }
                        >
                          <CheckSquare className="mr-2 h-4 w-4 text-foreground" />
                          <span>Checklist</span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent
                        align="start"
                        side="bottom"
                        sideOffset={-14}
                        className="w-72 rounded-sm p-0 shadow-xl border-border/50 flex flex-col z-100"
                      >
                        <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 shrink-0">
                          <span className="text-sm font-semibold text-center flex-1 text-foreground">
                            Add checklist
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-foreground"
                            onClick={() => setOpenChecklistPopover(false)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            if (newChecklistTitle.trim()) {
                              handleAddChecklist(newChecklistTitle.trim());
                              setNewChecklistTitle("Checklist");
                              setOpenChecklistPopover(false);
                            }
                          }}
                          className="p-4 space-y-4"
                        >
                          <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-foreground">Title</label>
                            <Input
                              value={newChecklistTitle}
                              onChange={(e) => setNewChecklistTitle(e.target.value)}
                              placeholder="Checklist title"
                              autoFocus
                              className="h-9"
                            />
                          </div>
                          <Button type="submit" size="sm" className="w-full">
                            Add
                          </Button>
                        </form>
                      </PopoverContent>
                    </Popover>

                    {/* Attachment Popover */}
                    <Popover open={openAttachmentPopover} onOpenChange={setOpenAttachmentPopover}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={
                            openAttachmentPopover
                              ? 'h-10 rounded-sm border border-border bg-muted px-4 text-[15px] font-medium text-foreground shadow-none'
                              : actionBtnClass
                          }
                        >
                          <Paperclip className="mr-2 h-4 w-4 text-foreground" />
                          <span>Attachment</span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent
                        align="start"
                        side="bottom"
                        sideOffset={-14}
                        className="w-80 rounded-sm p-0 shadow-xl border-border/50 flex flex-col z-100"
                      >
                        <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 shrink-0">
                          <span className="text-sm font-semibold text-center flex-1 text-foreground">Attach</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-foreground"
                            onClick={() => setOpenAttachmentPopover(false)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="p-4 space-y-4">
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
                            className={`border-2 border-dashed rounded-sm p-6 text-center cursor-pointer transition-colors ${
                              dragActive ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
                            }`}
                          >
                            <Paperclip className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                            <p className="text-xs font-semibold text-foreground">Click to upload or drag and drop</p>
                            <p className="text-[11px] text-muted-foreground mt-1">SVG, PNG, JPG, PDF or Docs</p>
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

              {/* Description */}
              <div className="space-y-2 pt-2">
                <label className="text-[13px] font-bold text-muted-foreground uppercase tracking-wider">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value);
                    setShowDescriptionActions(true);
                  }}
                  placeholder="Add a more detailed description..."
                  disabled={isReadOnly}
                  rows={4}
                  className="w-full resize-none rounded-sm border border-border bg-background p-3 text-sm text-foreground outline-none focus:border-primary"
                />
                {showDescriptionActions && !isReadOnly && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
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

              {/* Attachments Section */}
              <TaskAttachments
                attachments={attachments}
                onRenameAttachment={handleRenameAttachment}
                onRemoveAttachment={handleRemoveAttachment}
                isReadOnly={isReadOnly}
              />

              {/* Checklists Section */}
              <TaskChecklist
                checklists={checklists}
                onDeleteChecklist={handleDeleteChecklist}
                onToggleItem={handleToggleChecklistItem}
                onDeleteItem={handleDeleteChecklistItem}
                onUpdateItem={handleUpdateChecklistItem}
                onAddItem={handleAddChecklistItem}
                isReadOnly={isReadOnly}
              />

              {/* Subtasks Section */}
              {Array.isArray(card?.subtasks) && card.subtasks.length > 0 && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[13px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <GitBranch className="size-4" /> Subtasks ({card.subtaskCompletedCount ?? card.subtasks.filter((s: any) => s.completed || s.columnId === 'done').length}/{card.subtasks.length})
                    </label>
                  </div>
                  <div className="divide-y divide-border/60 rounded-sm border border-border/80 bg-background overflow-hidden">
                    {card.subtasks.map((sub: any) => (
                      <div key={sub.id} className="flex items-center justify-between px-3.5 py-2.5 text-xs hover:bg-muted/40 transition-colors">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          {sub.identifier && (
                            <span className="font-semibold text-muted-foreground">{sub.identifier}</span>
                          )}
                          <span className={sub.completed || sub.columnId === 'done' ? 'line-through text-muted-foreground' : 'text-foreground font-medium'}>
                            {sub.title}
                          </span>
                        </div>
                        <span className="text-[11px] px-2 py-0.5 rounded-sm bg-muted capitalize font-medium text-foreground">
                          {sub.columnId || (sub.completed ? 'done' : 'todo')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Activities & Comments Timeline */}
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
      </DialogContent>
    </Dialog>
  );
}

// Aliases for backwards compatibility
export const TaskDialog = TaskDetailModal;
export default TaskDetailModal;
