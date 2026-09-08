'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar';
import { Button } from '@/shared/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/shared/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';
import { Input } from '@/shared/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
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
  Terminal,
  Check,
  Zap,
  ChevronDown,
} from "lucide-react";
import { useParams } from "next/navigation";
import { useUpload } from "@/shared/hooks/use-upload";
import { useAuth } from '@/features/auth/hooks/use-auth';
import { cn } from "@/shared/lib/utils";
import { toast } from "sonner";

import type {
  WorkItem,
  WorkItemMutationInput,
  WorkItemPriority,
  WorkItemRecurrence,
  WorkItemReminder,
  Task,
  Column,
  TaskMutationInput,
  TaskPriority,
  TaskIssueType,
  TaskRelation,
  Checklist,
  TaskRecurrence,
  TaskReminder,
  Project,
  ProjectMember,
} from '../../../types/work-item.types';
import {
  resolveTaskColumnId,
  resolveTaskColumnColor,
} from "../../../types/work-item.types";
import {
  useTaskComments,
  useAddComment,
  useUpdateComment,
  useReactComment,
  useDeleteComment,
  useTaskActivityLogs,
  useLabelsQuery,
  WorkItemHelpers,
  TaskHelpers,
} from "../../../hooks/use-work-item";

import { WorkItemActivities as TaskActivities, type ActivityEntry } from "./WorkItemActivities";
import { WorkItemChecklist as TaskChecklist } from "./WorkItemChecklist";
import { WorkItemAttachments as TaskAttachments, type TaskAttachment } from "./WorkItemAttachments";
import { MemberPopover } from "./popovers/MemberPopover";
import { LabelPopover } from "./popovers/LabelPopover";
import { DatePopover } from "./popovers/DatePopover";
import { PriorityPopover, PRIORITY_CONFIG } from "./popovers/PriorityPopover";
import { TaskTypePopover } from "./popovers/TaskTypePopover";
import { StoryPointsPopover } from "./popovers/StoryPointsPopover";
import { TaskRelations } from "./TaskRelations";
import { TaskAiActions } from "./TaskAiActions";

function resolveTaskAssigneeId(assignee?: Task["assigneeId"] | string | null): string | null {
  if (!assignee) return null;
  if (typeof assignee === "string") return assignee;
  return assignee.id ?? null;
}

const EMPTY_ATTACHMENTS: TaskAttachment[] = [];

export type WorkItemDetailModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card?: Partial<WorkItem>;
  columns: Column[];
  project?: Project;
  members?: ProjectMember[];
  onSave: (card: WorkItemMutationInput) => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onRemoveFromCycle?: () => void;
  isReadOnly?: boolean;
};

export type TaskDetailModalProps = WorkItemDetailModalProps;

export function WorkItemDetailModal({
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
}: WorkItemDetailModalProps) {
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
  const [issueType, setIssueType] = useState<TaskIssueType>((card?.issueType as TaskIssueType) || "task");
  const [storyPoints, setStoryPoints] = useState<number | null>(card?.storyPoints ?? null);
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
  const [checklists, setChecklists] = useState<Checklist[]>([]);
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
  const [openTypePopover, setOpenTypePopover] = useState(false);
  const [openStoryPointsPopover, setOpenStoryPointsPopover] = useState(false);
  const [openPriorityPopover, setOpenPriorityPopover] = useState(false);
  const [openMemberPopover, setOpenMemberPopover] = useState(false);
  const [openLabelPopover, setOpenLabelPopover] = useState(false);
  const [openDatePopover, setOpenDatePopover] = useState(false);
  const [openChecklistPopover, setOpenChecklistPopover] = useState(false);
  const [openAttachmentPopover, setOpenAttachmentPopover] = useState(false);
  const [newChecklistTitle, setNewChecklistTitle] = useState("Checklist");
  const [dragActive, setDragActive] = useState(false);

  const taskId = card?.id || null;
  const isCreating = !taskId;
  const currentUserId = currentUser?.id || null;
  const isCurrentUserAssignee = Boolean(currentUserId && assigneeId === currentUserId);
  const canComment = Boolean(taskId);
  const { data: taskComments = [] } = useTaskComments(open && taskId ? taskId : "");
  const { data: taskActivity = [], error: activityError, isLoading: activityLoading } = useTaskActivityLogs(open && taskId ? taskId : "");
  const createTaskCommentMutation = useAddComment();
  const updateTaskCommentMutation = useUpdateComment();
  const reactTaskCommentMutation = useReactComment();
  const deleteTaskCommentMutation = useDeleteComment();

  useEffect(() => {
    if (!open) return;

    if (card) {
      setTitle(card.title ?? "");
      setDescription(card.description || card.content || "");
      descriptionDraftRef.current = card.description || card.content || "";
      setColumnId(card.columnId || firstColumnId);
      setIssueType((card.issueType as TaskIssueType) || "task");
      setStoryPoints(card.storyPoints ?? null);
      setRelations(card.relations || []);
      setPriority(card.priority || "none");
      setLabels(TaskHelpers.uniqueLabels(card.labels));
      setDueDate(card.dueDate || "");
      setStartDate(card.startDate || "");
      setRecurrence(card.recurrence || "none");
      setReminder(card.reminder || "1day");
      setSubtasks(Array.isArray(card.subtasks) ? card.subtasks : []);

      const rawChecklists = Array.isArray(card.checklists) ? card.checklists : [];
      const parsedChecklists = rawChecklists.map((c: any, index: number) => {
        if (!c.items && (c.text || c.title !== undefined || c.completed !== undefined || c.isCompleted !== undefined)) {
          return {
            id: c.id || `cl-${index}`,
            title: c.name || c.title || 'Checklist',
            items: [{
              id: c.id || `item-${index}`,
              title: c.text || c.title || '',
              completed: Boolean(c.completed ?? c.isCompleted),
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
            completed: Boolean(i.completed ?? i.isCompleted),
            assigneeId: i.assigneeId,
            dueDate: i.dueDate,
          })),
        };
      });
      setChecklists(parsedChecklists);

      setCompleted(card.completed || false);
      setAttachments(card.attachments || []);

      const assignee = (card as any).assignee || card.assigneeId;
      setAssigneeId(resolveTaskAssigneeId(assignee));
    } else {
      setTitle("");
      setDescription("");
      descriptionDraftRef.current = "";
      setColumnId(firstColumnId);
      setIssueType("task");
      setStoryPoints(null);
      setRelations([]);
      setPriority("none");
      setLabels([]);
      setDueDate("");
      setStartDate("");
      setRecurrence("none");
      setReminder("1day");
      setAssigneeId(null);
      setChecklists([]);
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
      description: card?.description || card?.content || "",
      columnId: card?.columnId || firstColumnId,
      issueType: (card?.issueType as TaskIssueType) || "task",
      storyPoints: card?.storyPoints ?? null,
      relations: card?.relations || [],
      priority: card?.priority || "none",
      dueDate: card?.dueDate || "",
      startDate: card?.startDate || "",
      recurrence: card?.recurrence || "none",
      reminder: card?.reminder || "1day",
      labels: TaskHelpers.uniqueLabels(card?.labels),
      assigneeId: resolveTaskAssigneeId((card as any)?.assignee || card?.assigneeId),
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
      issueType,
      storyPoints,
      relations,
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
  }, [
    title,
    description,
    columnId,
    issueType,
    storyPoints,
    relations,
    priority,
    dueDate,
    startDate,
    recurrence,
    reminder,
    labels,
    assigneeId,
    checklists,
    completed,
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

  const handleCreate = useCallback(() => {
    if (!title.trim() || isReadOnly) return;
    onSave(currentPayload);
  }, [title, isReadOnly, onSave, currentPayload]);

  useEffect(() => {
    if (!open || isReadOnly || isCreating) return;

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
  }, [open, hasUnsavedChanges, currentPayload, isReadOnly, safeSave, isCreating]);

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
    if (!isCreating) safeSave({ ...currentPayload, columnId: newColId });
  };

  const handleJoinTask = () => {
    if (!currentUserId || isReadOnly) return;
    setAssigneeId(currentUserId);
    if (!isCreating) safeSave({ ...currentPayload, assigneeId: currentUserId });
  };

  const handleLeaveTask = () => {
    if (!isCurrentUserAssignee || isReadOnly) return;
    setAssigneeId(null);
    if (!isCreating) safeSave({ ...currentPayload, assigneeId: null });
  };

  // Branch name copy
  const handleCopyBranch = () => {
    const branch = TaskHelpers.generateGitBranchName(card?.identifier, title);
    navigator.clipboard.writeText(`git checkout -b ${branch}`);
    toast.success(`Copied: git checkout -b ${branch}`);
  };

  const handleCopyIdentifier = () => {
    if (card?.identifier) {
      navigator.clipboard.writeText(card.identifier);
      toast.success(`Copied identifier: ${card.identifier}`);
    }
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
    if (!isCreating) safeSave({ ...currentPayload, checklists: TaskHelpers.normalizeChecklists(updated) });
  };

  const handleDeleteChecklist = (checklistId: string) => {
    const updated = checklists.filter((c) => c.id !== checklistId);
    setChecklists(updated);
    if (!isCreating) safeSave({ ...currentPayload, checklists: TaskHelpers.normalizeChecklists(updated) });
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
    if (!isCreating) safeSave({ ...currentPayload, checklists: TaskHelpers.normalizeChecklists(updated) });
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
    if (!isCreating) safeSave({ ...currentPayload, checklists: TaskHelpers.normalizeChecklists(updated) });
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
    if (!isCreating) safeSave({ ...currentPayload, checklists: TaskHelpers.normalizeChecklists(updated) });
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
    if (!isCreating) safeSave({ ...currentPayload, checklists: TaskHelpers.normalizeChecklists(updated) });
  };

  // Subtask quick actions
  const handleAddSubtask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubtaskTitle.trim()) return;
    const newSub = {
      id: `sub_${Date.now()}`,
      title: newSubtaskTitle.trim(),
      completed: false,
      columnId: 'todo',
    };
    const updated = [...subtasks, newSub];
    setSubtasks(updated);
    setNewSubtaskTitle("");
    toast.success('Subtask added');
  };

  // AI Appends
  const handleAiAppendSubtasks = (newItems: Array<{ title: string; completed: boolean }>) => {
    const createdSubs = newItems.map((item, idx) => ({
      id: `sub_${Date.now()}_${idx}`,
      title: item.title,
      completed: item.completed,
      columnId: 'todo',
    }));
    setSubtasks([...subtasks, ...createdSubs]);
  };

  const handleAiAppendCriteria = (criteriaItems: string[]) => {
    const criteriaChecklist: Checklist = {
      id: `cl_ai_${Date.now()}`,
      title: 'Acceptance Criteria',
      items: criteriaItems.map((crit, idx) => ({
        id: `item_crit_${Date.now()}_${idx}`,
        title: crit,
        completed: false,
      })),
    };
    const updated = [...checklists, criteriaChecklist];
    setChecklists(updated);
    if (!isCreating) safeSave({ ...currentPayload, checklists: TaskHelpers.normalizeChecklists(updated) });
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
      if (!isReadOnly && !isCreating) onSave({ ...currentPayload, attachments: updated });
    } catch {
      // Ignored
    }
  };

  const handleRenameAttachment = (attachmentId: string, newName: string) => {
    const updated = attachments.map((a) => (a.id === attachmentId ? { ...a, name: newName } : a));
    setAttachments(updated);
    if (!isReadOnly && !isCreating) onSave({ ...currentPayload, attachments: updated });
  };

  const handleRemoveAttachment = (attachmentId: string) => {
    const updated = attachments.filter((a) => a.id !== attachmentId);
    setAttachments(updated);
    if (!isReadOnly && !isCreating) onSave({ ...currentPayload, attachments: updated });
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
    return TaskHelpers.calculateProgressRollup(checklists, subtasks);
  }, [checklists, subtasks]);

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
    'h-7 px-2.5 text-xs font-medium rounded-md bg-muted/50 hover:bg-muted text-foreground border border-border/70 shadow-none flex items-center gap-1.5 transition-colors cursor-pointer shrink-0';

  const renderStatusSelector = () => {
    const activeCol = columns.find((c) => resolveTaskColumnId(c) === columnId);
    const activeColColor = resolveTaskColumnColor(columnId, activeCol?.accentColor);
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild disabled={isReadOnly}>
          <button
            type="button"
            className={cn(
              'h-7 px-2.5 text-xs font-medium rounded-md bg-muted/50 hover:bg-muted text-foreground border border-border/70 shadow-none flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 outline-none',
              isReadOnly && 'opacity-60 cursor-not-allowed'
            )}
          >
            <span className="size-2 rounded-full shrink-0 bg-muted-foreground" />
            <span>{activeCol?.title || columnId}</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" sideOffset={4} className="w-44 p-1 text-xs z-100 rounded-md border-border/70 shadow-xl bg-popover">
          {columns.map((col) => {
            const cId = resolveTaskColumnId(col);
            const color = resolveTaskColumnColor(cId, col.accentColor);
            const isCurrent = columnId === cId;
            return (
              <DropdownMenuItem
                key={cId}
                onClick={() => handleColumnChange(cId)}
                className={cn(
                  'flex items-center justify-between px-2.5 py-1.5 rounded-xs text-xs font-medium transition-colors hover:bg-muted cursor-pointer text-left',
                  isCurrent && 'bg-muted/80 text-foreground font-semibold'
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                  <span className="truncate">{col.title}</span>
                </div>
                {isCurrent && <Check className="size-3.5 text-primary" />}
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
        className={cn(
          "w-[94vw] max-h-[85vh] p-0 border border-border/80 shadow-2xl rounded-xl overflow-hidden flex flex-col bg-background text-foreground duration-150",
          isCreating ? "max-w-[640px] sm:max-w-[640px]" : "max-w-[900px] sm:max-w-[900px]"
        )}
        style={{
          width: isCreating ? "min(640px, 94vw)" : "min(900px, 94vw)",
          maxWidth: isCreating ? "640px" : "900px",
          maxHeight: "85vh",
        }}
      >
        <div className="flex h-full min-h-0 flex-col bg-background text-foreground overflow-hidden">
          {/* Top Modal Header */}
          <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-border/70 bg-muted/20 shrink-0">
            <DialogTitle className="text-base sm:text-lg font-bold text-foreground tracking-tight flex items-center gap-2">
              <span>{isCreating ? "Create Work Items" : (card?.identifier ? `${card.identifier}` : "Work Item Detail")}</span>
            </DialogTitle>

            {/* Menu Actions & Close */}
            <div className="flex items-center gap-0.5">
              {!isCreating && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 rounded-md text-foreground hover:bg-muted cursor-pointer outline-none"
                      aria-label="More actions"
                    >
                      <MoreHorizontal className="size-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48 rounded-md border-border/50 shadow-xl p-1">
                    {!isReadOnly && onDuplicate && (
                      <DropdownMenuItem onClick={onDuplicate} className="rounded-xs py-1.5 text-xs">
                        <Copy className="mr-2 h-3.5 w-3.5 text-foreground" />
                        <span>Duplicate</span>
                      </DropdownMenuItem>
                    )}
                    {currentUserId && (
                      <DropdownMenuItem
                        onClick={isCurrentUserAssignee ? handleLeaveTask : handleJoinTask}
                        className="rounded-xs py-1.5 text-xs"
                      >
                        {isCurrentUserAssignee ? (
                          <UserMinus className="mr-2 h-3.5 w-3.5 text-foreground" />
                        ) : (
                          <UserPlus className="mr-2 h-3.5 w-3.5 text-foreground" />
                        )}
                        <span>{isCurrentUserAssignee ? "Leave issue" : "Join issue"}</span>
                      </DropdownMenuItem>
                    )}
                    {onRemoveFromCycle && (
                      <DropdownMenuItem onClick={onRemoveFromCycle} className="rounded-xs py-1.5 text-xs">
                        <RotateCcw className="mr-2 h-3.5 w-3.5 text-foreground" />
                        <span>Remove from cycle</span>
                      </DropdownMenuItem>
                    )}
                    {!isReadOnly && onDelete && (
                      <DropdownMenuItem
                        onClick={onDelete}
                        className="rounded-xs py-1.5 text-xs text-destructive focus:bg-destructive/10 focus:text-destructive"
                      >
                        <Trash2 className="mr-2 h-3.5 w-3.5" />
                        <span>Delete issue</span>
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              <Button
                variant="ghost"
                size="icon"
                className="size-7 rounded-md text-foreground hover:bg-muted cursor-pointer outline-none"
                onClick={handleClose}
              >
                <X className="size-4" />
              </Button>
            </div>
          </div>

          {/* Properties Toolbar Bar (Only in Detail / Edit Mode) */}
          {!isCreating && (
            <div className="flex items-center justify-between px-3.5 py-1.5 border-b border-border/70 bg-background sticky top-0 z-30 shrink-0 min-h-10">
              <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                {renderStatusSelector()}

                <TaskTypePopover
                  open={openTypePopover}
                  onOpenChange={setOpenTypePopover}
                  issueType={issueType}
                  setIssueType={(type) => {
                    setIssueType(type);
                    onSave({ ...currentPayload, issueType: type });
                  }}
                  actionBtnClass={actionBtnClass}
                />

                {card?.identifier && (
                  <button
                    type="button"
                    onClick={handleCopyIdentifier}
                    className="font-mono text-[11px] font-bold text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded bg-muted/50 hover:bg-muted transition-colors cursor-pointer flex items-center gap-1 shrink-0"
                    title="Click to copy identifier"
                  >
                    <span>{card.identifier}</span>
                  </button>
                )}

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyBranch}
                  className="h-6.5 px-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground cursor-pointer flex items-center gap-1 shrink-0"
                  title="Copy git branch command"
                >
                  <Terminal className="size-3 text-emerald-500" />
                  <span className="hidden sm:inline">Copy Branch</span>
                </Button>
              </div>
            </div>
          )}

          {/* Body Content */}
          {isCreating ? (
            /* Creation Mode: Clean, Focused Single-Column Layout */
            <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 p-4 sm:p-5 space-y-4">
              {/* Title Input */}
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && title.trim()) {
                    e.preventDefault();
                    handleCreate();
                  }
                }}
                placeholder="Issue title"
                autoFocus
                disabled={isReadOnly}
<<<<<<< HEAD
                className="w-full text-base sm:text-lg font-bold text-foreground outline-none bg-transparent placeholder:text-muted-foreground/60 border-none p-0 focus:ring-0 tracking-tight"
=======
                className="w-full text-2xl font-semibold tracking-tight text-foreground outline-none bg-transparent placeholder:text-muted-foreground border-none p-1 -m-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-xs"
>>>>>>> origin/main
              />

              {/* Description */}
              <div className="space-y-1.5 pt-1">
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add a detailed description..."
                  disabled={isReadOnly}
                  rows={4}
                  className="w-full resize-none rounded-md border border-border/80 bg-background p-2.5 text-xs text-foreground outline-none focus:border-primary transition-colors leading-relaxed min-h-[95px]"
                />
              </div>

              {/* Secondary Properties Toolbar (Assignee, Labels, Dates, Checklist, Attach, AI) */}
              <div className="space-y-2">
                {/* Active Chips */}
                {(selectedMember || selectedLabelsList.length > 0 || dueDate || startDate) && (
                  <div className="flex flex-wrap items-center gap-1 pt-0.5">
                    {selectedMember && (
                      <div className="flex items-center gap-1 bg-muted/70 rounded-md px-1.5 py-0.5 text-[10px] font-medium text-foreground border border-border/50">
                        <Avatar className="size-3.5">
                          <AvatarImage src={selectedMember.avatar} />
                          <AvatarFallback className="text-[8px]">
                            {selectedMember.name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <span>{selectedMember.name}</span>
                        {!isReadOnly && (
                          <button
                            type="button"
                            onClick={() => setAssigneeId(null)}
                            className="hover:text-red-500 cursor-pointer ml-0.5"
                          >
                            <X className="size-2.5" />
                          </button>
                        )}
                      </div>
                    )}

                    {selectedLabelsList.map((l: any) => (
                      <span
                        key={l.id}
<<<<<<< HEAD
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold text-white shadow-xs"
=======
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-xs font-medium text-white shadow-xs"
>>>>>>> origin/main
                        style={{ backgroundColor: l.color }}
                      >
                        {l.name}
                        {!isReadOnly && (
                          <button
                            type="button"
                            onClick={() => {
                              const updated = labels.filter((id) => id !== l.id);
                              setLabels(updated);
                            }}
                            className="hover:opacity-80 cursor-pointer"
                          >
                            <X className="size-2.5" />
                          </button>
                        )}
                      </span>
                    ))}

                    {(startDate || dueDate) && (
                      <div className="flex items-center gap-1 bg-muted/70 rounded-md px-1.5 py-0.5 text-[10px] font-medium text-foreground border border-border/50">
                        <Clock className="size-3 text-muted-foreground" />
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
                            }}
                            className="hover:text-red-500 cursor-pointer ml-0.5"
                          >
                            <X className="size-2.5" />
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

                    <TaskTypePopover
                      open={openTypePopover}
                      onOpenChange={setOpenTypePopover}
                      issueType={issueType}
                      setIssueType={(type) => setIssueType(type)}
                      actionBtnClass={actionBtnClass}
                    />

                    <MemberPopover
                      open={openMemberPopover}
                      onOpenChange={setOpenMemberPopover}
                      assigneeId={assigneeId}
                      setAssigneeId={(id) => setAssigneeId(id)}
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
                      }}
                      actionBtnClass={actionBtnClass}
                    />

                    <Popover open={openChecklistPopover} onOpenChange={setOpenChecklistPopover}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className={actionBtnClass}>
                          <CheckSquare className="size-3.5 text-muted-foreground" />
                          <span>Checklist</span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent align="start" className="w-68 rounded-md p-0 shadow-xl border-border/50 flex flex-col z-100">
                        <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/50 shrink-0">
                          <span className="text-xs font-semibold text-foreground">Add Checklist</span>
                          <Button variant="ghost" size="icon" className="size-5 text-foreground" onClick={() => setOpenChecklistPopover(false)}>
                            <X className="size-3" />
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
                          className="p-2.5 space-y-2"
                        >
                          <Input
                            value={newChecklistTitle}
                            onChange={(e) => setNewChecklistTitle(e.target.value)}
                            placeholder="Checklist title"
                            autoFocus
                            className="h-7 text-xs"
                          />
                          <Button type="submit" size="sm" className="w-full h-7 text-xs">
                            Add
                          </Button>
                        </form>
                      </PopoverContent>
                    </Popover>

                    <Popover open={openAttachmentPopover} onOpenChange={setOpenAttachmentPopover}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className={actionBtnClass}>
                          <Paperclip className="size-3.5 text-muted-foreground" />
                          <span>Attach</span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent align="start" className="w-72 rounded-md p-0 shadow-xl border-border/50 flex flex-col z-100">
                        <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/50 shrink-0">
                          <span className="text-xs font-semibold text-foreground">Attach Files</span>
                          <Button variant="ghost" size="icon" className="size-5 text-foreground" onClick={() => setOpenAttachmentPopover(false)}>
                            <X className="size-3" />
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
                              dragActive ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
                            )}
                          >
                            <Paperclip className="mx-auto h-5 w-5 text-muted-foreground mb-1" />
                            <p className="text-xs font-semibold text-foreground">Click or drag & drop</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">Images, PDFs, Documents</p>
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

                    {/* Temporarily hidden: TaskAiActions */}
                  </div>
                )}
              </div>

              {/* Checklists Section */}
              {checklists.length > 0 && (
                <TaskChecklist
                  checklists={checklists}
                  onDeleteChecklist={handleDeleteChecklist}
                  onToggleItem={handleToggleChecklistItem}
                  onDeleteItem={handleDeleteChecklistItem}
                  onUpdateItem={handleUpdateChecklistItem}
                  onAddItem={handleAddChecklistItem}
                  isReadOnly={isReadOnly}
                />
              )}

              {/* Attachments Section */}
              {attachments.length > 0 && (
                <TaskAttachments
                  attachments={attachments}
                  onRenameAttachment={handleRenameAttachment}
                  onRemoveAttachment={handleRemoveAttachment}
                  isReadOnly={isReadOnly}
                />
              )}
            </div>
          ) : (
            /* Edit / View Mode: Full 2-Column Responsive Layout */
            <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0">
              <div className="grid grid-cols-1 items-start gap-5 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_285px]">
                {/* Left Column: Work Item Main Info */}
                <div className="min-w-0 space-y-3.5">
                  {/* Title Input */}
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Issue title"
                    disabled={isReadOnly}
                    className="w-full text-base sm:text-lg font-bold text-foreground outline-none bg-transparent placeholder:text-muted-foreground/60 border-none p-0 focus:ring-0 tracking-tight"
                  />

                  {/* Progress Rollup Bar */}
                  {(checklists.length > 0 || subtasks.length > 0) && (
                    <div className="space-y-1 p-2 rounded-md bg-muted/30 border border-border/50">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-foreground flex items-center gap-1">
                          <Zap className="size-3 text-amber-500" />
                          Overall Completion
                        </span>
                        <span className="font-bold text-muted-foreground">{progressRollup}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                          style={{ width: `${progressRollup}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Description */}
                  <div className="space-y-1.5 pt-1">
                    <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                      Description
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => {
                        setDescription(e.target.value);
                        setShowDescriptionActions(true);
                      }}
                      placeholder="Add a detailed description..."
                      disabled={isReadOnly}
                      rows={3}
                      className="w-full resize-none rounded-md border border-border/80 bg-background p-2.5 text-xs text-foreground outline-none focus:border-primary transition-colors leading-relaxed min-h-[85px]"
                    />
                    {showDescriptionActions && !isReadOnly && (
                      <div className="flex gap-1.5">
                        <Button
                          size="sm"
                          className="h-6.5 text-xs px-2.5"
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
                          className="h-6.5 text-xs px-2.5"
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

                  {/* Secondary Properties Toolbar (Assignee, Labels, Dates, Checklist, AI) */}
                  <div className="space-y-1.5">
                    {/* Active Chips */}
                    {(selectedMember || selectedLabelsList.length > 0 || dueDate || startDate) && (
                      <div className="flex flex-wrap items-center gap-1 pt-0.5">
                        {selectedMember && (
                          <div className="flex items-center gap-1 bg-muted/70 rounded-md px-1.5 py-0.5 text-[10px] font-medium text-foreground border border-border/50">
                            <Avatar className="size-3.5">
                              <AvatarImage src={selectedMember.avatar} />
                              <AvatarFallback className="text-[8px]">
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
                                <X className="size-2.5" />
                              </button>
                            )}
                          </div>
                        )}

                        {selectedLabelsList.map((l: any) => (
                          <span
                            key={l.id}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold text-white shadow-xs"
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
                                <X className="size-2.5" />
                              </button>
                            )}
                          </span>
                        ))}

                        {(startDate || dueDate) && (
                          <div className="flex items-center gap-1 bg-muted/70 rounded-md px-1.5 py-0.5 text-[10px] font-medium text-foreground border border-border/50">
                            <Clock className="size-3 text-muted-foreground" />
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
                                    recurrence: "none",
                                    reminder: "1day",
                                  });
                                }}
                                className="hover:text-red-500 cursor-pointer ml-0.5"
                              >
                                <X className="size-2.5" />
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

                        <TaskTypePopover
                          open={openTypePopover}
                          onOpenChange={setOpenTypePopover}
                          issueType={issueType}
                          setIssueType={(type) => {
                            setIssueType(type);
                            onSave({ ...currentPayload, issueType: type });
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

                        <Popover open={openChecklistPopover} onOpenChange={setOpenChecklistPopover}>
                          <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className={actionBtnClass}>
                              <CheckSquare className="size-3.5 text-muted-foreground" />
                              <span>Checklist</span>
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent align="start" className="w-68 rounded-md p-0 shadow-xl border-border/50 flex flex-col z-100">
                            <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/50 shrink-0">
                              <span className="text-xs font-semibold text-foreground">Add Checklist</span>
                              <Button variant="ghost" size="icon" className="size-5 text-foreground" onClick={() => setOpenChecklistPopover(false)}>
                                <X className="size-3" />
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
                              className="p-2.5 space-y-2"
                            >
                              <Input
                                value={newChecklistTitle}
                                onChange={(e) => setNewChecklistTitle(e.target.value)}
                                placeholder="Checklist title"
                                autoFocus
                                className="h-7 text-xs"
                              />
                              <Button type="submit" size="sm" className="w-full h-7 text-xs">
                                Add
                              </Button>
                            </form>
                          </PopoverContent>
                        </Popover>

                        <Popover open={openAttachmentPopover} onOpenChange={setOpenAttachmentPopover}>
                          <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className={actionBtnClass}>
                              <Paperclip className="size-3.5 text-muted-foreground" />
                              <span>Attach</span>
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent align="start" className="w-72 rounded-md p-0 shadow-xl border-border/50 flex flex-col z-100">
                            <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/50 shrink-0">
                              <span className="text-xs font-semibold text-foreground">Attach Files</span>
                              <Button variant="ghost" size="icon" className="size-5 text-foreground" onClick={() => setOpenAttachmentPopover(false)}>
                                <X className="size-3" />
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
                                  dragActive ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
                                )}
                              >
                                <Paperclip className="mx-auto h-5 w-5 text-muted-foreground mb-1" />
                                <p className="text-xs font-semibold text-foreground">Click or drag & drop</p>
                                <p className="text-[10px] text-muted-foreground mt-0.5">Images, PDFs, Documents</p>
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

                        {/* Temporarily hidden: TaskAiActions */}
                      </div>
                    )}
                  </div>

                  {/* Dependencies & Relations */}
                  <TaskRelations
                    relations={relations}
                    currentTaskId={taskId || undefined}
                    onAddRelation={(newRel) => {
                      const updated = [...relations, newRel];
                      setRelations(updated);
                      onSave({ ...currentPayload, relations: updated });
                    }}
                    onRemoveRelation={(relId) => {
                      const updated = relations.filter((r) => r.id !== relId);
                      setRelations(updated);
                      onSave({ ...currentPayload, relations: updated });
                    }}
                    isReadOnly={isReadOnly}
                  />

                  {/* Subtasks Section */}
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <GitBranch className="size-3.5" />
                        <span>Subtasks ({subtasks.filter((s: any) => s.completed || s.columnId === 'done').length}/{subtasks.length})</span>
                      </label>
                    </div>

                    {subtasks.length > 0 && (
                      <div className="divide-y divide-border/60 rounded-md border border-border/70 bg-background overflow-hidden">
                        {subtasks.map((sub: any, sIdx: number) => {
                          const isSubDone = sub.completed || sub.columnId === 'done';
                          return (
                            <div key={sub.id || sIdx} className="flex items-center justify-between px-2.5 py-1.5 text-xs hover:bg-muted/40 transition-colors group">
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
                                    'size-3.5 rounded-xs border flex items-center justify-center transition-colors cursor-pointer',
                                    isSubDone ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-border hover:border-primary'
                                  )}
                                >
                                  {isSubDone && <Check className="size-2.5" />}
                                </button>
                                <span className={cn("font-medium text-xs", isSubDone ? 'line-through text-muted-foreground' : 'text-foreground')}>
                                  {sub.title}
                                </span>
                              </div>

                              {!isReadOnly && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updated = subtasks.filter((_, i) => i !== sIdx);
                                    setSubtasks(updated);
                                  }}
                                  className="opacity-0 group-hover:opacity-100 hover:text-red-500 p-0.5 text-muted-foreground cursor-pointer transition-opacity"
                                >
                                  <X className="size-3" />
                                </button>
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
                </div>

                {/* Right Column: Compact Activities & Comments Timeline */}
                <div className="border-t lg:border-t-0 lg:border-l border-border/70 pt-4 lg:pt-0 lg:pl-5 sticky top-0">
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
          )}

          {/* Footer for Creation Mode */}
          {isCreating && (
            <div className="flex items-center justify-end gap-2 px-4 sm:px-5 py-3 border-t border-border/70 bg-muted/20 shrink-0">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClose}
                className="h-8 text-xs px-3 cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={!title.trim() || isReadOnly}
                onClick={handleCreate}
                className="h-8 text-xs px-4 font-semibold cursor-pointer"
              >
                Create Issue
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Aliases for backwards compatibility
export const TaskDetailModal = WorkItemDetailModal;
export const WorkItemDialog = WorkItemDetailModal;
export const TaskDialog = WorkItemDetailModal;
export default WorkItemDetailModal;
