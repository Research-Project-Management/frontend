import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Check, CheckSquare, ExternalLink, MoreHorizontal, Paperclip, X } from "lucide-react";

import type {
  Task,
  Column,
  TaskMutationInput,
  Checklist,
  ChecklistItem,
  TaskRecurrence,
  TaskReminder,
  TaskActivityLog,
} from "~/types/task";
import { resolveTaskColumnId } from "~/types/task";
import type { Project } from "~/query/project";
import {
  resolveTaskAssigneeId,
  useCreateTaskComment,
  useDeleteTaskComment,
  useReactTaskComment,
  useTaskComments,
  useUpdateTaskComment,
  useTaskActivity,
} from "~/query/task";
import { useAuth } from "~/hooks/useAuth";

import { TaskHeader } from "./Header";
import { TaskActions } from "./CardActions";
import { TaskActivities, type ActivityEntry } from "./Comment";

type Attachment = {
  id: string;
  name: string;
  type: string;
  size: string;
  createdAt: string;
  url: string;
};

const EMPTY_ATTACHMENTS: Attachment[] = [];

type TaskDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card?: Partial<Task>;
  columns: Column[];
  members: Project["members"];
  onSave: (card: TaskMutationInput) => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
};

function formatActivityTime(value?: string | Date) {
  if (!value) return "";
  const date = new Date(value);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  
  // "vừa xong" for within 2 minutes
  if (diffMinutes < 2) {
    return "vừa xong";
  }
  
  if (diffMinutes < 60) {
    return `${diffMinutes} phút trước`;
  }
  
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} giờ trước`;
  }
  
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) {
    return `${diffDays} ngày trước`;
  }
  
  return date.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "numeric",
    month: "short",
  });
}

function uniqueLabels(labels?: string[]) {
  return Array.from(new Set((labels ?? []).filter(Boolean)));
}

function getUserInitials(name?: string) {
  const normalizedName = name?.trim() || "";
  if (!normalizedName) return "U";

  return normalizedName
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
}

function createTaskSnapshot(payload: TaskMutationInput) {
  return JSON.stringify({
    title: payload.title ?? "",
    content: payload.content ?? "",
    description: payload.description ?? "",
    columnId: payload.columnId ?? "",
    dueDate: payload.dueDate ?? "",
    startDate: payload.startDate ?? "",
    recurrence: payload.recurrence ?? "none",
    reminder: payload.reminder ?? "1day",
    labels: [...(payload.labels ?? [])].sort(),
    assignee: payload.assignee ?? null,
    checklists: payload.checklists ?? [],
    completed: payload.completed ?? false,
    attachments: payload.attachments ?? [],
  });
}

function normalizeChecklistsForPayload(checklists: Checklist[] = []) {
  return checklists.map((checklist) => ({
    title: checklist.title,
    items: (checklist.items || []).map((item) => ({
      title: item.title,
      completed: item.completed,
      assigneeId: item.assigneeId,
      dueDate: item.dueDate,
    })),
  }));
}

function getAttachmentTypeLabel(attachment: Attachment) {
  const name = attachment.name.trim();
  const extension = name.includes(".") ? name.split(".").pop()?.toUpperCase() : "";
  const mimeType = attachment.type?.split("/")[0] || "";

  if (extension) return extension;
  if (mimeType === "image") return "IMG";
  if (mimeType === "video") return "VID";
  if (mimeType === "audio") return "AUD";
  if (mimeType === "application") return "FILE";

  return "FILE";
}

function formatAttachmentMeta(createdAt: string) {
  const createdDate = new Date(createdAt);
  if (Number.isNaN(createdDate.getTime())) return "Đã thêm";

  const diffInMinutes = Math.floor((Date.now() - createdDate.getTime()) / 60000);
  if (diffInMinutes < 1) return "Đã thêm vừa xong";
  if (diffInMinutes < 60) return `Đã thêm ${diffInMinutes} phút trước`;

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `Đã thêm ${diffInHours} giờ trước`;

  const diffInDays = Math.floor(diffInHours / 24);
  return `Đã thêm ${diffInDays} ngày trước`;
}

type AttachmentMenuItem = {
  id: string;
  label: string;
  tone?: "default" | "danger";
};

type ChecklistBlockProps = {
  checklist: Checklist;
  progress: number;
  onDelete: () => void;
  onToggleItem: (itemId: string) => void;
  onDeleteItem: (itemId: string) => void;
  onUpdateItem: (itemId: string, title: string) => void;
  onAddItem: (title: string) => void;
};

function ChecklistBlock({
  checklist,
  progress,
  onDelete,
  onToggleItem,
  onDeleteItem,
  onUpdateItem,
  onAddItem,
}: ChecklistBlockProps) {
  const [newItemTitle, setNewItemTitle] = useState("");
  const [showNewItemInput, setShowNewItemInput] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemTitle, setEditingItemTitle] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleteConfirming, setIsDeleteConfirming] = useState(false);
  const deleteConfirmTimeoutRef = useRef<number | null>(null);

  const handleAddItem = () => {
    const trimmedTitle = newItemTitle.trim();
    if (!trimmedTitle) return;

    onAddItem(trimmedTitle);
    setNewItemTitle("");
    setShowNewItemInput(false);
  };

  const handleStartEditItem = (itemId: string, title: string) => {
    setEditingItemId(itemId);
    setEditingItemTitle(title);
    setShowNewItemInput(false);
  };

  const handleSaveEditItem = () => {
    const trimmedTitle = editingItemTitle.trim();
    if (!editingItemId || !trimmedTitle) return;

    onUpdateItem(editingItemId, trimmedTitle);
    setEditingItemId(null);
    setEditingItemTitle("");
  };

  const handleConfirmDelete = () => {
    if (isDeleteConfirming) return;
    setIsDeleteConfirming(true);

    deleteConfirmTimeoutRef.current = window.setTimeout(() => {
      onDelete();
      setShowDeleteConfirm(false);
      setIsDeleteConfirming(false);
    }, 140);
  };

  useEffect(() => {
    return () => {
      if (deleteConfirmTimeoutRef.current) {
        window.clearTimeout(deleteConfirmTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="bg-white space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CheckSquare className="size-5 text-[#172b4d]" />
          <h4 className="text-[15px] font-bold leading-tight text-[#172b4d]">
            {checklist.title}
          </h4>
        </div>
        <button
          type="button"
          onClick={() => setShowDeleteConfirm(true)}
          className="rounded-md bg-[#f1f2f4] px-3 py-1.5 text-[13px] font-medium text-[#172b4d] hover:bg-[#eaecef]"
        >
          Xóa
        </button>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-[12px] font-semibold text-[#6b778c] min-w-8">{progress}%</span>
        <div className="flex-1 h-1.5 rounded-full bg-[#e9edf3] overflow-hidden">
          <div
            className="h-full bg-[#0c66e4] transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="space-y-2 pt-1">
        {checklist.items.length > 0 ? (
          checklist.items.map((item) => (
            editingItemId === item._id ? (
              <div key={item._id} className="flex items-start gap-3 text-[14px] text-[#172b4d]">
                <input
                  type="checkbox"
                  checked={item.completed}
                  onChange={() => onToggleItem(item._id)}
                  className="mt-2 size-4 rounded-sm border-[#b8c1cc] text-[#0c66e4] focus:ring-0"
                />
                <div className="flex-1 space-y-2">
                  <input
                    value={editingItemTitle}
                    onChange={(e) => setEditingItemTitle(e.target.value)}
                    className="h-9 w-full rounded-lg border border-[#d9d9d9] px-3 text-[14px] shadow-none outline-none focus:border-[#0c66e4]"
                    autoFocus
                  />
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      className="h-9 bg-[#0c66e4] px-4 text-white hover:bg-[#0c66e4]/90 shadow-none"
                      onClick={handleSaveEditItem}
                    >
                      Lưu
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-9 px-3 text-[#44546f] hover:bg-[#091e420f]"
                      onClick={() => {
                        setEditingItemId(null);
                        setEditingItemTitle("");
                      }}
                    >
                      Hủy
                    </Button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onDeleteItem(item._id)}
                  className="inline-flex size-7 items-center justify-center rounded-lg text-[#44546f] transition-colors hover:bg-[#091e420f] hover:text-[#c9372c]"
                  aria-label={`Xóa mục ${item.title}`}
                >
                  <X className="size-4" />
                </button>
              </div>
            ) : (
              <div key={item._id} className="group flex items-center gap-3 text-[14px] text-[#172b4d]">
                <input
                  type="checkbox"
                  checked={item.completed}
                  onChange={() => onToggleItem(item._id)}
                  className="size-4 rounded-sm border-[#b8c1cc] text-[#0c66e4] focus:ring-0"
                />
                <button
                  type="button"
                  onClick={() => handleStartEditItem(item._id, item.title)}
                  className={item.completed ? "line-through text-[#6b778c] flex-1 text-left" : "text-[#172b4d] flex-1 text-left"}
                >
                  {item.title}
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteItem(item._id)}
                  className="inline-flex size-7 items-center justify-center rounded-lg text-[#44546f] opacity-0 transition-colors hover:bg-[#091e420f] hover:text-[#c9372c] group-hover:opacity-100"
                  aria-label={`Xóa mục ${item.title}`}
                >
                  <X className="size-4" />
                </button>
              </div>
            )
          ))
        ) : (
          <p className="text-[13px] text-[#6b778c]">Chưa có mục nào.</p>
        )}
      </div>

      {showNewItemInput ? (
        <div className="space-y-2 pt-1">
          <input
            value={newItemTitle}
            onChange={(e) => setNewItemTitle(e.target.value)}
            placeholder="Thêm một mục..."
            className="h-9 w-full rounded-lg border border-[#d9d9d9] px-3 text-[14px] shadow-none"
            autoFocus
          />
          <div className="flex items-center gap-2">
            <Button
              type="button"
              className="h-9 bg-[#0c66e4] text-white hover:bg-[#0c66e4]/90 shadow-none"
              onClick={handleAddItem}
            >
              Thêm
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="h-9 px-3 text-[#44546f] hover:bg-[#091e420f]"
              onClick={() => {
                setNewItemTitle("");
                setShowNewItemInput(false);
              }}
            >
              Hủy
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="secondary"
          className="h-9 w-fit bg-[#f1f2f4] px-4 text-[14px] font-medium text-[#172b4d] shadow-none hover:bg-[#eaecef]"
          onClick={() => setShowNewItemInput(true)}
        >
          Thêm một mục
        </Button>
      )}

      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent
          className={`max-w-110 rounded-[18px] border-0 p-0 shadow-2xl transition-all duration-200 ${isDeleteConfirming ? "scale-[0.99] opacity-90" : "scale-100 opacity-100"}`}
          showCloseButton={false}
        >
          <div className="p-6">
            <DialogHeader className="space-y-2 text-left">
              <DialogTitle className="text-[18px] font-bold text-[#172b4d]">
                Xóa danh sách việc cần làm?
              </DialogTitle>
              <DialogDescription className="text-[14px] leading-6 text-[#44546f]">
                Mục này sẽ bị xóa khỏi thẻ và không thể khôi phục.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="border-t border-[#ececec] px-6 py-4">
            <DialogFooter className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                className="h-9 px-4 text-[#44546f] hover:bg-[#091e420f]"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleteConfirming}
              >
                Hủy
              </Button>
              <Button
                type="button"
                className="h-9 bg-[#c9372c] px-4 text-white shadow-none transition-all duration-200 hover:bg-[#c9372c]/90 active:scale-[0.98]"
                onClick={handleConfirmDelete}
                disabled={isDeleteConfirming}
              >
                Xóa
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function TaskDialog({
  open,
  onOpenChange,
  card,
  columns,
  members,
  onSave,
  onDelete,
  onDuplicate,
}: TaskDialogProps) {
  const { user: currentUser } = useAuth();
  const firstColumnId = resolveTaskColumnId(columns[0]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [columnId, setColumnId] = useState(firstColumnId);
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
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [completed, setCompleted] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [activeAttachmentMenuId, setActiveAttachmentMenuId] = useState<string | null>(null);
  const [attachmentMenuPlacement, setAttachmentMenuPlacement] = useState<"up" | "down">("up");
  const [renameAttachmentId, setRenameAttachmentId] = useState<string | null>(null);
  const [renameAttachmentName, setRenameAttachmentName] = useState("");
  const [commentFocusToken, setCommentFocusToken] = useState(0);
  const [commentCaretPosition, setCommentCaretPosition] = useState(0);
  const initialSnapshotRef = useRef("");
  const autosaveSignatureRef = useRef("");
  const autosaveReadyRef = useRef(false);

  const taskId = card?._id ?? null;
  const currentUserId = currentUser?._id ?? null;
  const isCurrentUserAssignee = Boolean(currentUserId && assigneeId === currentUserId);
  const canComment = Boolean(taskId);
  const { data: taskComments = [] } = useTaskComments(open ? taskId : null);
  const { data: taskActivity = [], error: activityError, isLoading: activityLoading } = useTaskActivity(open ? taskId : null);
  const createTaskCommentMutation = useCreateTaskComment();
  const updateTaskCommentMutation = useUpdateTaskComment();
  const deleteTaskCommentMutation = useDeleteTaskComment();
  const reactTaskCommentMutation = useReactTaskComment();

  useEffect(() => {
    if (!activeAttachmentMenuId) return;

    const handlePointerDownOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('[data-attachment-menu-root="true"]')) return;
      setActiveAttachmentMenuId(null);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveAttachmentMenuId(null);
      }
    };

    document.addEventListener("mousedown", handlePointerDownOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDownOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [activeAttachmentMenuId]);

  useEffect(() => {
    if (!open) return;

    if (card) {
      setTitle(card.title ?? "");
      setDescription(card.description || card.content || "");
      descriptionDraftRef.current = card.description || card.content || "";
      setColumnId(card.columnId || firstColumnId);
      setLabels(uniqueLabels(card.labels));
      setDueDate(card.dueDate || "");
      setStartDate(card.startDate || "");
      setRecurrence(card.recurrence || "none");
      setReminder(card.reminder || "1day");
      setChecklists(card.checklists || []);
      setCompleted(card.completed || false);
      setAttachments(card.attachments || []);

      const assignee = card.assignee;
      setAssigneeId(resolveTaskAssigneeId(assignee));
    } else {
      setTitle("");
      setDescription("");
      descriptionDraftRef.current = "";
      setColumnId(firstColumnId);
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
    initialSnapshotRef.current = createTaskSnapshot({
      title: card?.title || "",
      content: card?.description || card?.content || "",
      description: card?.description || card?.content || "",
      columnId: card?.columnId || firstColumnId,
      dueDate: card?.dueDate || "",
      startDate: card?.startDate || "",
      recurrence: card?.recurrence || "none",
      reminder: card?.reminder || "1day",
      labels: uniqueLabels(card?.labels),
      assignee:
        resolveTaskAssigneeId(card?.assignee as Task["assignee"] | string | null | undefined),
      checklists: card?.checklists || [],
      completed: card?.completed || false,
      attachments: card?.attachments ?? EMPTY_ATTACHMENTS,
    });
  }, [open, card, firstColumnId]);

  const commentActivities = useMemo<ActivityEntry[]>(() => {
    const commentEntries = taskComments.map((comment) => ({
      id: comment._id,
      author: comment.author?.name || "Người dùng",
      authorInitials: getUserInitials(comment.author?.name),
      avatarUrl: comment.author?.avatar || null,
      content: comment.content,
      timestamp: formatActivityTime(comment.createdAt),
      createdAt: new Date(comment.createdAt).getTime(),
      kind: "comment" as const,
      reactionEmoji: comment.currentUserReaction,
      permissions: {
        canEdit: Boolean(comment.permissions?.canEdit),
        canDelete: Boolean(comment.permissions?.canDelete),
      },
    }));

    const auditLogEntries = taskActivity.map((log: TaskActivityLog) => ({
      id: log._id,
      author: log.actor?.name || "Người dùng",
      authorInitials: getUserInitials(log.actor?.name),
      avatarUrl: log.actor?.avatar || null,
      content: log.description,
      timestamp: formatActivityTime(log.createdAt),
      createdAt: new Date(log.createdAt).getTime(),
      kind: "activity" as const,
    }));

    const combined = [...commentEntries, ...auditLogEntries];
    combined.sort((a, b) => b.createdAt - a.createdAt);

    return combined;
  }, [taskComments, taskActivity]);

  const handleSaveComment = (content: string) => {
    if (!taskId) return;
    createTaskCommentMutation.mutate({ taskId, content });
    setCommentCaretPosition(0);
  };

  const handleUpdateComment = (commentId: string, content: string) => {
    if (!taskId) return;
    updateTaskCommentMutation.mutate({ taskId, commentId, content });
  };

  const handleDeleteComment = (commentId: string) => {
    if (!taskId) return;
    deleteTaskCommentMutation.mutate({ taskId, commentId });
  };

  const handleReactComment = (commentId: string, emoji: string) => {
    if (!taskId) return;

    const currentReaction = taskComments.find((comment) => comment._id === commentId)?.currentUserReaction;
    reactTaskCommentMutation.mutate({
      taskId,
      commentId,
      emoji: currentReaction === emoji ? "" : emoji,
    });
  };

  const visibleActivities = useMemo(
    () =>
      showDetailActivity
        ? commentActivities
        : commentActivities.filter((item) => item.kind === "comment"),
    [commentActivities, showDetailActivity],
  );

  const buildPayload = (): TaskMutationInput => ({
    title: title.trim(),
    content: description,
    description,
    columnId,
    dueDate: dueDate || undefined,
    startDate: startDate || null,
    recurrence: recurrence || undefined,
    reminder: reminder || undefined,
    labels: uniqueLabels(labels),
    assignee: assigneeId,
    checklists: normalizeChecklistsForPayload(checklists),
    completed,
    attachments,
  });

  const saveTaskChanges = (payload: TaskMutationInput) => {
    initialSnapshotRef.current = createTaskSnapshot(payload);
    autosaveSignatureRef.current = JSON.stringify({
      columnId: payload.columnId ?? "",
      assignee: payload.assignee ?? null,
      dueDate: payload.dueDate ?? "",
      completed: payload.completed ?? false,
      checklists: payload.checklists ?? [],
      attachments: payload.attachments ?? [],
    });
    onSave(payload);
  };

  const hasChanges = useMemo(
    () => createTaskSnapshot(buildPayload()) !== initialSnapshotRef.current,
    [
      title,
      description,
      columnId,
      dueDate,
      startDate,
      recurrence,
      reminder,
      labels,
      assigneeId,
      checklists,
      completed,
      attachments,
    ]
  );

  const handleSave = () => {
    if (!title.trim()) return;
    saveTaskChanges(buildPayload());
  };

  const handleSaveDescription = () => {
    descriptionDraftRef.current = description;
    setShowDescriptionActions(false);
    saveTaskChanges(buildPayload());
  };

  const handleCancelDescription = () => {
    setDescription(descriptionDraftRef.current);
    setShowDescriptionActions(false);
  };

  const handleClose = () => {
    if (title.trim() && hasChanges) {
      saveTaskChanges(buildPayload());
    }
    onOpenChange(false);
  };

  const autosaveSignature = useMemo(
    () => JSON.stringify({
      columnId,
      assignee: assigneeId,
      dueDate: dueDate || "",
      completed,
      checklists: normalizeChecklistsForPayload(checklists),
      attachments,
    }),
    [columnId, assigneeId, dueDate, completed, checklists, attachments],
  );

  useEffect(() => {
    if (!open) return;
    autosaveSignatureRef.current = autosaveSignature;
    autosaveReadyRef.current = true;
  }, [open, taskId, autosaveSignature]);

  useEffect(() => {
    if (!open || !taskId || !autosaveReadyRef.current) return;
    if (autosaveSignature === autosaveSignatureRef.current) return;

    const timer = setTimeout(() => {
      saveTaskChanges(buildPayload());
    }, 350);

    return () => clearTimeout(timer);
  }, [autosaveSignature, open, taskId]);

  const handleColumnChange = (nextColumnId: string) => {
    setColumnId(nextColumnId);
  };

  const handleToggleCompleted = () => {
    setCompleted((prev) => !prev);
  };

  const handleJoinTask = () => {
    if (!currentUserId) return;
    setAssigneeId(currentUserId);
  };

  const handleLeaveTask = () => {
    if (!currentUserId || assigneeId !== currentUserId) return;
    setAssigneeId(null);
  };

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      handleClose();
      return;
    }
    onOpenChange(nextOpen);
  };

  const handleAddChecklist = (title: string) => {
    const newChecklist: Checklist = {
      _id: Math.random().toString(36).slice(2, 11),
      title,
      items: [],
    };
    setChecklists((prev) => [...prev, newChecklist]);
  };

  const handleDeleteChecklist = (checklistId: string) => {
    setChecklists((prev) => prev.filter((list) => list._id !== checklistId));
  };

  const handleAddChecklistItem = (checklistId: string, itemTitle: string) => {
    const trimmedTitle = itemTitle.trim();
    if (!trimmedTitle) return;

    const newItem: ChecklistItem = {
      _id: Math.random().toString(36).slice(2, 11),
      title: trimmedTitle,
      completed: false,
    };

    setChecklists((prev) =>
      prev.map((list) =>
        list._id === checklistId
          ? { ...list, items: [...list.items, newItem] }
          : list
      )
    );
  };

  const handleToggleChecklistItem = (checklistId: string, itemId: string) => {
    setChecklists((prev) =>
      prev.map((list) => {
        if (list._id !== checklistId) return list;
        return {
          ...list,
          items: list.items.map((item) =>
            item._id === itemId ? { ...item, completed: !item.completed } : item
          ),
        };
      })
    );
  };

  const handleDeleteChecklistItem = (checklistId: string, itemId: string) => {
    setChecklists((prev) =>
      prev.map((list) =>
        list._id === checklistId
          ? { ...list, items: list.items.filter((item) => item._id !== itemId) }
          : list
      )
    );
  };

  const handleUpdateChecklistItem = (checklistId: string, itemId: string, title: string) => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;

    setChecklists((prev) =>
      prev.map((list) =>
        list._id === checklistId
          ? {
              ...list,
              items: list.items.map((item) =>
                item._id === itemId ? { ...item, title: trimmedTitle } : item
              ),
            }
          : list
      )
    );
  };

  const handleRemoveAttachment = (attachmentId: string) => {
    setAttachments((prev) => prev.filter((item) => item.id !== attachmentId));
  };

  const handleOpenRenameAttachment = (attachment: Attachment) => {
    setRenameAttachmentId(attachment.id);
    setRenameAttachmentName(attachment.name);
    setActiveAttachmentMenuId(null);
  };

  const handleConfirmRenameAttachment = () => {
    const trimmedName = renameAttachmentName.trim();
    if (!renameAttachmentId || !trimmedName) return;

    setAttachments((prev) =>
      prev.map((item) =>
        item.id === renameAttachmentId ? { ...item, name: trimmedName } : item,
      ),
    );
    setRenameAttachmentId(null);
    setRenameAttachmentName("");
  };

  const handleCommentAttachment = (attachment: Attachment) => {
    setCommentText((current) => {
      const textarea = commentTextareaRef.current;
      const realCursor = textarea?.selectionStart ?? commentCaretPosition;
      const safeCursor = Math.max(0, Math.min(realCursor, current.length));
      
      if (current.includes(attachment.name)) return current;

      const next = `${current.slice(0, safeCursor)}${attachment.name}${current.slice(safeCursor)}`;
      setCommentCaretPosition(safeCursor + attachment.name.length);
      return next;
    });

    setCommentFocusToken((value) => value + 1);
    setActiveAttachmentMenuId(null);
  };

  const handleDownloadAttachment = (attachment: Attachment) => {
    const link = document.createElement("a");
    link.href = attachment.url;
    link.download = attachment.name;
    link.target = "_blank";
    link.rel = "noreferrer";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setActiveAttachmentMenuId(null);
  };

  const handleToggleAttachmentMenu = (
    attachmentId: string,
    event: ReactMouseEvent<HTMLButtonElement>,
  ) => {
    const triggerRect = event.currentTarget.getBoundingClientRect();
    const scrollContainer = dialogScrollRef.current;
    const estimatedMenuHeight = 190;
    const containerRect = scrollContainer?.getBoundingClientRect();

    const spaceBelow = containerRect
      ? containerRect.bottom - triggerRect.bottom
      : window.innerHeight - triggerRect.bottom;
    const spaceAbove = containerRect
      ? triggerRect.top - containerRect.top
      : triggerRect.top;

    const shouldOpenUp =
      spaceBelow < estimatedMenuHeight && spaceAbove > spaceBelow;

    setAttachmentMenuPlacement(shouldOpenUp ? "up" : "down");
    setActiveAttachmentMenuId((prev) => (prev === attachmentId ? null : attachmentId));
  };

  const attachmentMenuItems: AttachmentMenuItem[] = [
    { id: "edit", label: "Sửa" },
    { id: "comment", label: "Nhận xét" },
    { id: "download", label: "Tải xuống" },
    { id: "remove", label: "Loại bỏ", tone: "danger" },
  ];

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent
        ref={dialogScrollRef}
        showCloseButton={false}
        className="max-h-[92vh] overflow-y-auto rounded-[20px] border-0 p-0 shadow-2xl"
        style={{
          width: "min(1320px, 96vw)",
          maxWidth: "1320px",
          height: "auto",
          maxHeight: "92vh",
        }}
      >
        <DialogTitle className="sr-only">Chi tiết thẻ</DialogTitle>

          <div className="flex min-h-0 flex-col bg-white">
          <TaskHeader
            columnId={columnId}
            setColumnId={handleColumnChange}
            columns={columns}
            currentUserId={currentUserId}
            isCurrentUserAssignee={isCurrentUserAssignee}
            onJoin={handleJoinTask}
            onLeave={handleLeaveTask}
            onDuplicate={onDuplicate}
            onDelete={onDelete}
            onClose={handleClose}
          />
          <div className="flex flex-1 min-h-0">
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 px-9 pb-8 pt-8">
                <div className="flex items-center gap-3">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={handleToggleCompleted}
                          className={`flex size-7 shrink-0 items-center justify-center rounded-full border-[1.5px] transition-all ${
                            completed
                              ? "border-[#6a9923] bg-[#6a9923] text-white"
                              : "border-[#8c8c8c] bg-white text-transparent hover:border-[#172b4d]"
                          }`}
                        >
                          <Check
                            className={`h-4 w-4 stroke-3 ${
                              completed ? "opacity-100" : "opacity-0"
                            }`}
                          />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent
                        side="top"
                        className="bg-[#172b4d] text-white border-none rounded-[6px] text-[12px] font-medium py-1.5 px-3"
                      >
                        {completed ? "Đánh dấu chưa hoàn tất" : "Đánh dấu hoàn tất"}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  <textarea
                    rows={1}
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      e.currentTarget.style.height = "auto";
                      e.currentTarget.style.height = `${e.currentTarget.scrollHeight}px`;
                    }}
                    placeholder="Nhập tiêu đề thẻ..."
                    className={`min-h-9 flex-1 resize-none overflow-hidden rounded-lg border-none bg-transparent px-2 py-1 text-[24px] font-bold leading-tight outline-none placeholder:text-[#999] transition-all hover:bg-[#091e420f] focus:bg-white focus:ring-2 focus:ring-[#3884ff] ${
                      completed ? "text-[#6b778c]" : "text-[#172b4d]"
                    }`}
                  />
                </div>

                <div>
                  <TaskActions
                    labels={labels}
                    setLabels={setLabels}
                    dueDate={dueDate}
                    setDueDate={setDueDate}
                    startDate={startDate}
                    setStartDate={setStartDate}
                    recurrence={recurrence}
                    setRecurrence={setRecurrence}
                    reminder={reminder}
                    setReminder={setReminder}
                    assigneeId={assigneeId}
                    setAssigneeId={setAssigneeId}
                    members={members}
                    onAddChecklist={handleAddChecklist}
                    setAttachments={setAttachments}
                  />

                  <div className="mt-12">
                    <div className="mb-5 flex items-center gap-3">
                      <div className="size-6 flex items-center justify-center">
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="text-[#44546f]"
                        >
                          <line x1="21" y1="6" x2="3" y2="6"></line>
                          <line x1="15" y1="12" x2="3" y2="12"></line>
                          <line x1="17" y1="18" x2="3" y2="18"></line>
                        </svg>
                      </div>
                      <h3 className="text-[17px] font-bold text-[#172b4d]">Mô tả</h3>
                    </div>

                    <textarea
                      value={description}
                      onChange={(e) => {
                        setDescription(e.target.value);
                        setShowDescriptionActions(true);
                      }}
                      onFocus={() => {
                        descriptionDraftRef.current = description;
                        setShowDescriptionActions(true);
                      }}
                      placeholder="Thêm mô tả chi tiết hơn..."
                      className="min-h-35 w-full resize-none rounded-xl bg-transparent border border-[#d0d7e2] px-4 py-3 text-[15px] text-[#172b4d] shadow-none outline-none placeholder:text-[#6b778c] transition-all duration-200 hover:bg-[#091e420f] focus:bg-white focus:ring-2 focus:ring-[#3884ff] focus:border-[#3884ff]"
                    />
                    {showDescriptionActions ? (
                      <div className="mt-3 flex items-center gap-2 transition-all duration-200">
                        <Button
                          type="button"
                          className="h-9 bg-[#0c66e4] px-4 text-white shadow-none transition-all duration-200 hover:bg-[#0c66e4]/90 active:scale-[0.98] disabled:opacity-60"
                          onClick={handleSaveDescription}
                          disabled={!description.trim()}
                        >
                          Lưu
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          className="h-9 px-3 text-[#44546f] transition-all duration-200 hover:bg-[#091e420f] active:scale-[0.98] disabled:opacity-60"
                          onClick={handleCancelDescription}
                        >
                          Hủy
                        </Button>
                      </div>
                    ) : null}
                  </div>

                  {attachments.length > 0 ? (
                    <div className="mt-10">
                    <div className="mb-4 flex items-center gap-2">
                      <Paperclip className="size-4 text-[#44546f]" />
                      <h3 className="text-[16px] font-bold text-[#172b4d]">
                        Các tập tin đính kèm
                      </h3>
                    </div>
                    <div className="space-y-3 pl-1">
                      {attachments.map((item) => (
                        <div
                          key={item.id}
                          className="group flex items-center justify-between gap-4 rounded-xl px-2 py-2 transition-colors hover:bg-[#091e420a]"
                        >
                          <div className="flex min-w-0 flex-1 items-center gap-4">
                            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-[#f3f4f6] text-[15px] font-bold text-[#5b6472] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]">
                              {getAttachmentTypeLabel(item)}
                            </div>

                            <div className="min-w-0 flex-1">
                              <a
                                href={item.url}
                                target="_blank"
                                rel="noreferrer"
                                className="block min-w-0 max-w-full truncate text-[14px] font-semibold text-[#172b4d] hover:underline"
                                title={item.name}
                              >
                                {item.name}
                              </a>
                              <p className="mt-1 text-[12px] text-[#6b778c]">
                                {formatAttachmentMeta(item.createdAt)}
                              </p>
                            </div>
                          </div>

                          <div className="flex shrink-0 items-center gap-1 self-stretch">
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex size-8 items-center justify-center rounded-lg text-[#44546f] transition-colors hover:bg-[#091e420f] hover:text-[#172b4d]"
                              aria-label={`Mở ${item.name}`}
                            >
                              <ExternalLink className="size-4" />
                            </a>
                            <div className="relative" data-attachment-menu-root="true">
                              <button
                                type="button"
                                onClick={(event) => handleToggleAttachmentMenu(item.id, event)}
                                className="inline-flex size-8 items-center justify-center rounded-lg text-[#44546f] transition-colors hover:bg-[#091e420f] hover:text-[#172b4d]"
                                aria-label={`Tùy chọn ${item.name}`}
                              >
                                <MoreHorizontal className="size-4" />
                              </button>

                              {activeAttachmentMenuId === item.id ? (
                                <div
                                  className={`absolute right-0 z-30 w-44 rounded-xl border border-[#e5e7eb] bg-white p-1.5 shadow-[0_12px_30px_rgba(15,23,42,0.12)] ${
                                    attachmentMenuPlacement === "up"
                                      ? "bottom-full mb-2"
                                      : "top-full mt-2"
                                  }`}
                                >
                                  {attachmentMenuItems.map((menuItem) => (
                                    <button
                                      key={menuItem.id}
                                      type="button"
                                      onClick={() => {
                                        if (menuItem.id === "edit") {
                                          handleOpenRenameAttachment(item);
                                          return;
                                        }

                                        if (menuItem.id === "comment") {
                                          handleCommentAttachment(item);
                                          return;
                                        }

                                        if (menuItem.id === "download") {
                                          handleDownloadAttachment(item);
                                          return;
                                        }

                                        if (menuItem.id === "remove") {
                                          handleRemoveAttachment(item.id);
                                          setActiveAttachmentMenuId(null);
                                          return;
                                        }

                                        setActiveAttachmentMenuId(null);
                                      }}
                                      className={`flex w-full items-center rounded-lg px-3 py-2 text-left text-[14px] transition-colors ${
                                        menuItem.tone === "danger"
                                          ? "text-[#c9372c] hover:bg-[#fff1f0]"
                                          : "text-[#172b4d] hover:bg-[#f4f5f7]"
                                      }`}
                                    >
                                      {menuItem.label}
                                    </button>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    </div>
                  ) : null}

                  {checklists.length > 0 ? (
                    <div className="mt-10 space-y-4">
                      {checklists.map((list) => {
                        const completedCount = list.items.filter((item) => item.completed).length;
                        const progress = list.items.length
                          ? Math.round((completedCount / list.items.length) * 100)
                          : 0;

                        return (
                          <ChecklistBlock
                            key={list._id}
                            checklist={list}
                            progress={progress}
                            onDelete={() => handleDeleteChecklist(list._id)}
                            onToggleItem={(itemId) =>
                              handleToggleChecklistItem(list._id, itemId)
                            }
                            onDeleteItem={(itemId) => handleDeleteChecklistItem(list._id, itemId)}
                            onUpdateItem={(itemId, title) =>
                              handleUpdateChecklistItem(list._id, itemId, title)
                            }
                            onAddItem={(title) => handleAddChecklistItem(list._id, title)}
                          />
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              </div>

            </div>

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
            />
          </div>
        </div>

        <Dialog open={!!renameAttachmentId} onOpenChange={(open) => {
          if (!open) {
            setRenameAttachmentId(null);
            setRenameAttachmentName("");
          }
        }}>
          <DialogContent className="max-w-130 rounded-[18px] border-0 p-0 shadow-2xl" showCloseButton={false}>
            <div className="p-6">
              <DialogHeader className="space-y-2 text-left">
                <DialogTitle className="text-[18px] font-bold text-[#172b4d]">
                  Đổi tên tài liệu
                </DialogTitle>
                <DialogDescription className="text-[14px] leading-6 text-[#44546f]">
                  Cập nhật tên hiển thị của file đính kèm này.
                </DialogDescription>
              </DialogHeader>

              <div className="mt-4">
                <input
                  value={renameAttachmentName}
                  onChange={(e) => setRenameAttachmentName(e.target.value)}
                  className="h-10 w-full rounded-xl border border-[#d9d9d9] px-4 text-[14px] text-[#172b4d] outline-none focus:border-[#0c66e4]"
                  placeholder="Nhập tên file mới"
                  autoFocus
                />
              </div>
            </div>

            <div className="border-t border-[#ececec] px-6 py-4">
              <DialogFooter className="flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  className="h-9 px-4 text-[#44546f] hover:bg-[#091e420f]"
                  onClick={() => {
                    setRenameAttachmentId(null);
                    setRenameAttachmentName("");
                  }}
                >
                  Hủy
                </Button>
                <Button
                  type="button"
                  className="h-9 bg-[#0c66e4] px-4 text-white shadow-none hover:bg-[#0c66e4]/90"
                  onClick={handleConfirmRenameAttachment}
                  disabled={!renameAttachmentName.trim()}
                >
                  Lưu
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
