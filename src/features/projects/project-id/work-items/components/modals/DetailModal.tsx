'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from '@/shared/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';
import { Input } from '@/shared/components/ui/input';
import {
  MoreHorizontal,
  X,
  Copy,
  Trash2,
  UserMinus,
  UserPlus,
  GitBranch,
  Check,
  ArrowUpRight,
  Archive,
  ArchiveRestore,
  Bell,
  BellOff,
  ChevronRight,
  ChevronDown,
  Maximize2,
  Minimize2,
  PanelRight,
  Link2,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { useParams } from "next/navigation";
import { useAuth } from '@/features/auth/hooks/use-auth';
import { cn } from "@/shared/lib/utils";

import type {
  Item,
  ItemMutationInput,
  Priority,
  Relation,
  SubItem,
} from '@/features/projects/project-id/work-items/types/work-item.types';
import {
  resolveColumnId,
  resolveStateId,
  ItemHelpers,
} from "@/features/projects/project-id/work-items/utils/work-item.utils";
import {
  useComments,
  useAddComment,
  useUpdateComment,
  useReactComment,
  useDeleteComment,
} from "@/features/projects/project-id/work-items/hooks/use-comment";
import {
  useCreateSubItem,
  useConvertSubItemToRoot,
  useSubItemNotification,
  useCopyItemText,
  useUpdateItem,
  useDeleteItem,
} from "@/features/projects/project-id/work-items/hooks/use-work-item";
import { useActivityLogs } from "@/features/projects/project-id/work-items/hooks/use-history";
import { useWorkItemAttachments } from "@/features/projects/project-id/work-items/hooks/use-attachment";
import {
  useRelations,
  useAddRelationMutation,
  useRemoveRelationMutation,
} from "@/features/projects/project-id/work-items/hooks/use-relation";
import { useArchiveItem, useRestoreItem } from "@/features/projects/project-id/work-items/hooks/use-archive";
import {
  useSubscribeItemMutation,
  useUnsubscribeItemMutation,
} from "@/features/projects/project-id/work-items/hooks/use-assignment";

import { Activities } from "./Activities";
import { Attachments, type AttachCenterData } from "./Attachments";
import { StatePopover } from "@/features/projects/project-id/work-items/components/pickers/StatePicker";
import { MemberPopover } from "@/features/projects/project-id/work-items/components/pickers/MemberPicker";
import { LabelPopover } from "@/features/projects/project-id/work-items/components/pickers/LabelPicker";
import { DatePopover } from "@/features/projects/project-id/work-items/components/pickers/DatePicker";
import { PriorityPopover } from "@/features/projects/project-id/work-items/components/pickers/PriorityPicker";
import { ParentItemPopover } from "@/features/projects/project-id/work-items/components/pickers/ParentPicker";
import { Relations } from "./Relations";
import type { DetailModalProps } from "@/features/projects/project-id/work-items/types/modal.types";
import {
  EMPTY_ATTACHMENTS,
  normalizeAttachments,
  createAttachmentHandlers,
  buildActivityEntries,
  formatMetaDate,
  getTimeAgo,
} from "@/features/projects/project-id/work-items/utils/modal.utils";

export type { DetailModalProps };

export function DetailModal({
  open,
  onOpenChange,
  item: propItem,
  card: propCard,
  columns,
  project,
  members = [],
  availableItems: propAvailableItems,
  onSave,
  onDelete,
  onDuplicate,
  isReadOnly = false,
}: DetailModalProps) {
  const card = propItem || propCard;
  const availableItems = propAvailableItems || [];
  const { projectId: routeProjectId } = useParams() as { projectId?: string };
  const currentProjectId = routeProjectId || project?.id || card?.projectId;
  const { user: currentUser } = useAuth();
  const copyItemText = useCopyItemText();
  const convertSubItemToRoot = useConvertSubItemToRoot();
  const { notifySubItemAdded } = useSubItemNotification();

  const firstColumnId = resolveStateId(columns[0]);

  // Layout View Mode: 'side_peek' | 'modal' | 'full_screen'
  const [viewMode, setViewMode] = useState<'side_peek' | 'modal' | 'full_screen'>('side_peek');

  // Collapsible Sections
  const [showProperties, setShowProperties] = useState(true);

  // Core fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [columnId, setColumnId] = useState(firstColumnId);
  const [relations, setRelations] = useState<Relation[]>(card?.relations || []);
  const [priority, setPriority] = useState<Priority>(card?.priority || "none");
  const [dueDate, setDueDate] = useState("");
  const [startDate, setStartDate] = useState("");
  const [labels, setLabels] = useState<string[]>([]);
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [parentId, setParentId] = useState<string | null>(card?.parentId || null);
  const [commentText, setCommentText] = useState("");
  const [showDetailActivity, setShowDetailActivity] = useState(false);
  const [timeSpent, setTimeSpent] = useState<number | null>(() => {
    return typeof card?.timeSpent === 'number' ? card.timeSpent : null;
  });
  const [isAutosaving, setIsAutosaving] = useState(false);
  const [copiedIdentifier, setCopiedIdentifier] = useState(false);
  const commentTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [subItems, setSubItems] = useState<SubItem[]>([]);
  const [newSubItemTitle, setNewSubItemTitle] = useState("");
  const [completed, setCompleted] = useState(false);
  const [attachments, setAttachments] = useState<AttachCenterData>(EMPTY_ATTACHMENTS);
  const [commentCaretPosition, setCommentCaretPosition] = useState(0);
  const initialSnapshotRef = useRef("");
  const autosaveSignatureRef = useRef("");
  const autosaveReadyRef = useRef(false);
  const prevOpenRef = useRef(false);
  const prevCardIdRef = useRef<string | null>(null);

  // Popover States
  const [openStatePopover, setOpenStatePopover] = useState(false);
  const [openPriorityPopover, setOpenPriorityPopover] = useState(false);
  const [openMemberPopover, setOpenMemberPopover] = useState(false);
  const [openLabelPopover, setOpenLabelPopover] = useState(false);
  const [openDatePopover, setOpenDatePopover] = useState(false);
  const [openParentPopover, setOpenParentPopover] = useState(false);
  const [copiedGit, setCopiedGit] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const workItemId = card?.id || null;
  const currentUserId = currentUser?.id || null;
  const isCurrentUserAssignee = Boolean(currentUserId && (assigneeId === currentUserId || assigneeIds.includes(currentUserId)));
  const canComment = Boolean(workItemId);
  const { data: itemComments = [] } = useComments(open && workItemId ? workItemId : "");
  const { data: itemActivity = [], error: activityError, isLoading: activityLoading } = useActivityLogs(open && workItemId ? workItemId : "");
  const { data: fetchedAttachments } = useWorkItemAttachments(open && workItemId ? workItemId : "");
  const { data: fetchedRelationsData } = useRelations(open && workItemId ? workItemId : "");
  const createCommentMutation = useAddComment();
  const updateCommentMutation = useUpdateComment();
  const reactCommentMutation = useReactComment();
  const deleteCommentMutation = useDeleteComment();
  const createSubItemMutation = useCreateSubItem();
  const updateSubItemMutation = useUpdateItem();
  const deleteSubItemMutation = useDeleteItem();
  const addRelationMutation = useAddRelationMutation();
  const removeRelationMutation = useRemoveRelationMutation();
  const archiveItemMutation = useArchiveItem();
  const restoreItemMutation = useRestoreItem();
  const subscribeMutation = useSubscribeItemMutation();
  const unsubscribeMutation = useUnsubscribeItemMutation();

  const rawCard = card as (Item & {
    archivedAt?: string | null;
    creator?: { name?: string };
    createdByName?: string;
    subscribers?: string[];
    completedAt?: string;
  }) | null | undefined;

  const isArchived = Boolean(rawCard?.archivedAt);

  const subscriberList = useMemo(() => {
    const raw = rawCard?.subscriberIds || rawCard?.subscribers;
    return Array.isArray(raw) ? raw : [];
  }, [rawCard]);
  const isSubscribed = Boolean(currentUserId && subscriberList.includes(currentUserId));

  // Author & timestamps for metadata display
  const authorName = rawCard?.author?.name || rawCard?.creator?.name || rawCard?.createdByName || currentUser?.name || 'Member';
  const createdAtFormatted = formatMetaDate(rawCard?.createdAt) || formatMetaDate(new Date().toISOString());
  const updatedAtFormatted = formatMetaDate(rawCard?.updatedAt);
  const descriptionLastEdited = getTimeAgo(rawCard?.updatedAt || rawCard?.createdAt);

  const handleToggleSubscribe = async () => {
    if (!workItemId || !currentProjectId || !currentUserId) return;
    if (isSubscribed) {
      await unsubscribeMutation.mutateAsync({ projectId: currentProjectId, workItemId });
    } else {
      await subscribeMutation.mutateAsync({ projectId: currentProjectId, workItemId });
    }
  };

  const defaultUnstartedColumnId = useMemo(() => {
    if (!Array.isArray(columns) || columns.length === 0) return 'todo';
    const unstarted =
      columns.find((c) => c.group === 'unstarted' && c.isDefault) ||
      columns.find((c) => c.group === 'unstarted') ||
      columns.find((c) => c.isDefault) ||
      columns[0];
    return unstarted ? resolveColumnId(unstarted) : 'todo';
  }, [columns]);

  const defaultCompletedColumnId = useMemo(() => {
    if (!Array.isArray(columns) || columns.length === 0) return 'done';
    const completed =
      columns.find((c) => c.group === 'completed') ||
      columns[columns.length - 1];
    return completed ? resolveColumnId(completed) : 'done';
  }, [columns]);

  const handleArchiveItem = async () => {
    if (!workItemId) return;
    await archiveItemMutation.mutateAsync(workItemId);
    onOpenChange(false);
  };

  const handleRestoreItem = async () => {
    if (!workItemId) return;
    await restoreItemMutation.mutateAsync(workItemId);
  };

  const handleConvertSubItem = async (sub: SubItem, sIdx: number) => {
    try {
      await convertSubItemToRoot.mutateAsync({
        id: sub.id,
        itemId: sub.id,
        workItemId: sub.id,
        projectId: currentProjectId,
      });
      const updated = subItems.filter((_, i) => i !== sIdx);
      setSubItems(updated);
    } catch {}
  };

  // Keyboard Escape listener
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (
          openStatePopover ||
          openPriorityPopover ||
          openMemberPopover ||
          openLabelPopover ||
          openDatePopover ||
          openParentPopover
        ) {
          return;
        }
        onOpenChange(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    open,
    openStatePopover,
    openPriorityPopover,
    openMemberPopover,
    openLabelPopover,
    openDatePopover,
    openParentPopover,
    onOpenChange,
  ]);

  useEffect(() => {
    if (!open) {
      prevOpenRef.current = false;
      prevCardIdRef.current = null;
      return;
    }

    const currentId = card?.id || null;
    const isOpeningOrSwitchingCard =
      !prevOpenRef.current || currentId !== prevCardIdRef.current;

    if (!isOpeningOrSwitchingCard) {
      return;
    }

    prevOpenRef.current = true;
    prevCardIdRef.current = currentId;

    const effectiveAssigneeIds = card
      ? (Array.isArray(card.assigneeIds) && card.assigneeIds.length > 0
        ? card.assigneeIds
        : Array.isArray(card.assignees) && card.assignees.length > 0
        ? card.assignees.map((a) => a.id).filter(Boolean)
        : card.assigneeId
        ? [card.assigneeId]
        : card.assignee?.id
        ? [card.assignee.id]
        : [])
      : [];

    if (card) {
      setTitle(card.title ?? "");
      setDescription(card.description || card.content || "");
      setTimeSpent(typeof card?.timeSpent === 'number' ? card.timeSpent : null);
      setColumnId(card.columnId || firstColumnId);
      setRelations(card.relations || []);
      setPriority(card.priority || "none");
      setLabels(ItemHelpers.uniqueLabels(card.labels));
      setDueDate(card.dueDate || "");
      setStartDate(card.startDate || "");
      setParentId(card.parentId || null);
      setSubItems(
        Array.isArray(card.childWorkItems) && card.childWorkItems.length > 0
          ? card.childWorkItems
          : Array.isArray(card.subItems)
          ? card.subItems
          : []
      );
      setCompleted(card.completed || false);
      setAttachments(normalizeAttachments(card.attachments));
      setAssigneeIds(effectiveAssigneeIds);
      setAssigneeId(effectiveAssigneeIds[0] ?? null);
    } else {
      setTitle("");
      setDescription("");
      setTimeSpent(null);
      setColumnId(firstColumnId);
      setRelations([]);
      setPriority("none");
      setLabels([]);
      setDueDate("");
      setStartDate("");
      setAssigneeId(null);
      setAssigneeIds([]);
      setParentId(null);
      setSubItems([]);
      setCompleted(false);
      setAttachments(EMPTY_ATTACHMENTS);
    }

    setCommentText("");
    setCommentCaretPosition(0);
    setShowDetailActivity(false);
    initialSnapshotRef.current = ItemHelpers.createSnapshot({
      title: card?.title || "",
      content: card?.description || card?.content || "",
      columnId: card?.columnId || firstColumnId,
      relations: card?.relations || [],
      priority: card?.priority || "none",
      dueDate: card?.dueDate || "",
      startDate: card?.startDate || "",
      labels: Array.isArray(card?.labels)
        ? ItemHelpers.uniqueLabels(card.labels as (string | { id?: string; name?: string; color?: string; [key: string]: unknown })[])
        : [],
      assigneeId: effectiveAssigneeIds[0] ?? null,
      assigneeIds: effectiveAssigneeIds,
      parentId: card?.parentId || null,
      completed: card?.completed || false,
      attachments: normalizeAttachments(card?.attachments),
      timeSpent: typeof card?.timeSpent === 'number' ? card.timeSpent : null,
    });
    autosaveSignatureRef.current = initialSnapshotRef.current;
    autosaveReadyRef.current = false;
  }, [open, card, firstColumnId]);

  useEffect(() => {
    if (fetchedAttachments) {
      const normalized = normalizeAttachments(fetchedAttachments);
      setAttachments(normalized);
      if (initialSnapshotRef.current) {
        try {
          const parsed = JSON.parse(initialSnapshotRef.current) as Record<string, unknown>;
          parsed.attachments = normalized;
          initialSnapshotRef.current = JSON.stringify(parsed);
          autosaveSignatureRef.current = initialSnapshotRef.current;
        } catch {}
      }
    }
  }, [fetchedAttachments]);

  useEffect(() => {
    if (fetchedRelationsData) {
      const rawList: Relation[] = Array.isArray(fetchedRelationsData)
        ? fetchedRelationsData
        : Array.isArray((fetchedRelationsData as { relations?: Relation[] }).relations)
        ? (fetchedRelationsData as { relations: Relation[] }).relations
        : [];
      const mappedRelations: Relation[] = rawList.map((r: Relation) => ({
        id: r.id,
        type: r.type,
        targetId: r.targetWorkItemId || r.targetId || r.targetWorkItem?.id,
        targetWorkItemId: r.targetWorkItemId || r.targetWorkItem?.id,
        targetTitle: r.targetWorkItem?.title || r.targetTitle,
        targetIdentifier: r.targetWorkItem?.identifier || r.targetIdentifier,
      }));
      setRelations(mappedRelations);
    }
  }, [fetchedRelationsData]);

  const currentPayload = useMemo<ItemMutationInput>(() => {
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
      assigneeId: assigneeIds[0] ?? assigneeId ?? null,
      assigneeIds,
      completed,
      attachments,
      parentId: parentId || undefined,
      timeSpent: timeSpent !== null && !isNaN(timeSpent) ? timeSpent : null,
    };
  }, [
    title,
    description,
    columnId,
    relations,
    priority,
    dueDate,
    startDate,
    labels,
    assigneeId,
    assigneeIds,
    completed,
    attachments,
    parentId,
    timeSpent,
  ]);

  const hasUnsavedChanges = useMemo(() => {
    if (!open) return false;
    return ItemHelpers.createSnapshot(currentPayload) !== initialSnapshotRef.current;
  }, [open, currentPayload]);

  const safeSave = useCallback((payload: ItemMutationInput) => {
    if (isReadOnly) return;
    if (!workItemId && !payload.title?.trim()) return;
    onSave(payload);
  }, [isReadOnly, workItemId, onSave]);

  useEffect(() => {
    if (!open || isReadOnly || !workItemId) return;

    if (!autosaveReadyRef.current) {
      autosaveReadyRef.current = true;
      return;
    }

    if (!hasUnsavedChanges) {
      setIsAutosaving(false);
      return;
    }

    const payloadSnapshot = ItemHelpers.createSnapshot(currentPayload);
    if (payloadSnapshot === autosaveSignatureRef.current) {
      setIsAutosaving(false);
      return;
    }

    setIsAutosaving(true);
    const timer = setTimeout(() => {
      autosaveSignatureRef.current = payloadSnapshot;
      initialSnapshotRef.current = payloadSnapshot;
      // Exclude relations and attachments from field autosave for existing items to prevent race conditions with dedicated mutations
      const { relations: _relations, attachments: _attachments, ...fieldPayload } = currentPayload;
      safeSave(fieldPayload);
      setIsAutosaving(false);
    }, 400);

    return () => clearTimeout(timer);
  }, [open, hasUnsavedChanges, currentPayload, isReadOnly, safeSave, workItemId]);

  const handleClose = () => {
    onOpenChange(false);
  };

  const handleColumnChange = (newColId: string) => {
    setColumnId(newColId);
    safeSave({ ...currentPayload, columnId: newColId });
  };

  const handleJoinItem = () => {
    if (!currentUserId || isReadOnly) return;
    const nextIds = Array.from(new Set([...assigneeIds, currentUserId]));
    setAssigneeIds(nextIds);
    setAssigneeId(currentUserId);
    safeSave({ ...currentPayload, assigneeIds: nextIds, assigneeId: currentUserId });
  };

  const handleLeaveItem = () => {
    if (!isCurrentUserAssignee || isReadOnly) return;
    const nextIds = assigneeIds.filter((id) => id !== currentUserId);
    setAssigneeIds(nextIds);
    setAssigneeId(nextIds[0] ?? null);
    safeSave({ ...currentPayload, assigneeIds: nextIds, assigneeId: nextIds[0] ?? null });
  };

  const handleCopyIdentifier = () => {
    if (card?.identifier) {
      copyItemText(card.identifier, `Copied identifier: ${card.identifier}`);
      setCopiedIdentifier(true);
      setTimeout(() => setCopiedIdentifier(false), 2000);
    }
  };

  const handleCopyGitBranch = () => {
    const branchName = ItemHelpers.formatGitBranch({
      title: title || card?.title,
      identifier: card?.identifier,
    });
    copyItemText(branchName, `Copied git branch: ${branchName}`);
    setCopiedGit(true);
    setTimeout(() => setCopiedGit(false), 2000);
  };

  const handleCopyLink = () => {
    if (typeof window !== 'undefined') {
      const origin = window.location.origin;
      const permalink = currentProjectId
        ? `${origin}/projects/${currentProjectId}/work-items?itemId=${card?.identifier || card?.id || ''}`
        : window.location.href;
      copyItemText(permalink, 'Copied link to clipboard');
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  // Sub-item quick actions
  const handleAddSubItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubItemTitle.trim()) return;
    const itemTitle = newSubItemTitle.trim();
    setNewSubItemTitle("");

    if (workItemId) {
      try {
        const res = (await createSubItemMutation.mutateAsync({
          id: workItemId,
          itemId: workItemId,
          workItemId: workItemId,
          projectId: currentProjectId,
          title: itemTitle,
          columnId: defaultUnstartedColumnId,
        })) as { subItem?: SubItem; workItem?: SubItem; item?: SubItem } & Partial<SubItem>;
        const created = (res?.subItem || res?.workItem || res?.item || res) as Partial<SubItem>;
        const newSub: SubItem = {
          id: created.id || `sub_${Date.now()}`,
          title: created.title || itemTitle,
          identifier: created.identifier,
          columnId: created.columnId || defaultUnstartedColumnId,
          completed: created.completed || false,
          rank: created.rank || subItems.length,
          assigneeId: created.assigneeId || null,
          assignee: created.assignee || null,
          dueDate: created.dueDate || null,
        };
        setSubItems((prev) => [...prev, newSub]);
      } catch {}
    } else {
      const newSub: SubItem = {
        id: `sub_${Date.now()}`,
        title: itemTitle,
        completed: false,
        columnId: defaultUnstartedColumnId,
        rank: subItems.length,
      };
      setSubItems((prev) => [...prev, newSub]);
      notifySubItemAdded();
    }
  };

  const updateAttachmentsAndSave = useCallback(
    (updater: (prev: AttachCenterData) => AttachCenterData) => {
      const updated = updater(attachments);
      setAttachments(updated);
      const nextPayload = { ...currentPayload, attachments: updated };
      const nextSnap = ItemHelpers.createSnapshot(nextPayload);
      initialSnapshotRef.current = nextSnap;
      autosaveSignatureRef.current = nextSnap;
      safeSave(nextPayload);
    },
    [attachments, currentPayload, safeSave],
  );

  const {
    handleAttachPage,
    handleDetachPage,
    handleAttachPaper,
    handleDetachPaper,
    handleAttachFile,
    handleDetachFile,
    handleAttachLink,
    handleDetachLink,
    handleRenameAttachment,
    handleRemoveAttachment,
  } = useMemo(
    () => createAttachmentHandlers(updateAttachmentsAndSave),
    [updateAttachmentsAndSave],
  );

  // Comment Actions
  const handleSaveComment = (text: string) => {
    if (!workItemId || !text.trim()) return;
    createCommentMutation.mutate({ id: workItemId, itemId: workItemId, workItemId, content: text.trim() });
    setCommentText("");
  };

  const handleUpdateComment = (commentId: string, content: string) => {
    if (!workItemId || !content.trim()) return;
    updateCommentMutation.mutate({ id: workItemId, itemId: workItemId, workItemId, commentId, content: content.trim() });
  };

  const handleDeleteComment = (commentId: string) => {
    if (!workItemId) return;
    deleteCommentMutation.mutate({ id: workItemId, itemId: workItemId, workItemId, commentId });
  };

  const handleReactComment = (commentId: string, emoji: string) => {
    if (!workItemId) return;
    reactCommentMutation.mutate({ id: workItemId, itemId: workItemId, workItemId, commentId, emoji });
  };

  const progressRollup = useMemo(() => {
    return ItemHelpers.calculateProgressRollup(subItems);
  }, [subItems]);

  const visibleActivities = useMemo(
    () => buildActivityEntries(itemComments, itemActivity),
    [itemComments, itemActivity],
  );

  // Modern Action Button Style
  const actionBtnClass =
    'h-8 px-2.5 text-12 font-medium rounded-md bg-background hover:bg-muted text-foreground border border-border flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 relative before:absolute before:-inset-1 md:before:hidden';

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!open || !mounted) return null;

  // View Mode container classes
  const isSidePeek = viewMode === 'side_peek';
  const isFullScreen = viewMode === 'full_screen';
  const isModal = viewMode === 'modal';

  const modalContent = (
    <>
      {/* Backdrop for Side Peek & Modal */}
      {!isFullScreen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm transition-opacity animate-in fade-in duration-150"
          onClick={handleClose}
          aria-hidden="true"
        />
      )}

      {/* Main Drawer / Modal Container */}
      <div
        className={cn(
          "z-50 bg-background text-foreground flex flex-col overflow-hidden border-border",
          isSidePeek && "fixed inset-y-0 right-0 w-full sm:w-[680px] md:w-[760px] lg:w-[840px] xl:w-[900px] border-l shadow-raised-200 animate-in slide-in-from-right duration-200",
          isFullScreen && "fixed inset-0 w-full h-full animate-in fade-in duration-150",
          isModal && "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[94vw] max-w-[900px] max-h-[88vh] rounded-lg border shadow-raised-200 animate-in zoom-in-95 duration-150"
        )}
        role="dialog"
        aria-modal="true"
      >
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-3.5 sm:px-4 py-2 border-b border-border bg-background shrink-0 min-h-[46px]">
          {/* Left Controls: Collapse, View Mode, Breadcrumb */}
          <div className="flex items-center gap-1 min-w-0">
            {/* Close / Collapse Button */}
            <Button
              variant="ghost"
              size="icon"
              className="size-7 rounded-md text-foreground hover:bg-muted cursor-pointer shrink-0 relative before:absolute before:-inset-2 md:before:hidden focus-visible:ring-1 focus-visible:ring-ring"
              onClick={handleClose}
              title={isSidePeek ? "Close side drawer (Esc)" : "Close (Esc)"}
            >
              {isSidePeek ? (
                <ArrowRight className="size-4 shrink-0" />
              ) : (
                <X className="size-4 shrink-0" />
              )}
            </Button>

            {/* View Mode Toggle: Fullscreen */}
            <Button
              variant="ghost"
              size="icon"
              className="size-7 rounded-md text-foreground hover:bg-muted cursor-pointer shrink-0 relative before:absolute before:-inset-2 md:before:hidden focus-visible:ring-1 focus-visible:ring-ring"
              onClick={() => setViewMode(isFullScreen ? 'side_peek' : 'full_screen')}
              title={isFullScreen ? "Exit full screen" : "Full screen"}
            >
              {isFullScreen ? (
                <Minimize2 className="size-3.5 shrink-0" />
              ) : (
                <Maximize2 className="size-3.5 shrink-0" />
              )}
            </Button>

            {/* View Mode Toggle: Side Peek vs Modal */}
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "size-7 rounded-md text-foreground hover:bg-muted cursor-pointer shrink-0 relative before:absolute before:-inset-2 md:before:hidden focus-visible:ring-1 focus-visible:ring-ring",
                isSidePeek && "bg-muted"
              )}
              onClick={() => setViewMode(isSidePeek ? 'modal' : 'side_peek')}
              title={isSidePeek ? "Switch to center modal" : "Switch to side drawer"}
            >
              <PanelRight className="size-3.5 shrink-0" />
            </Button>

            <div className="h-3.5 w-px bg-border mx-1 shrink-0" />

            {/* Identifier Pill */}
            {card?.identifier && (
              <button
                type="button"
                onClick={handleCopyIdentifier}
                className="font-mono text-11 font-medium text-foreground px-2 py-0.5 rounded-sm border border-border bg-muted hover:bg-muted/80 transition-colors cursor-pointer flex items-center gap-1 shrink-0 truncate max-w-[140px] relative before:absolute before:-inset-1 md:before:hidden focus-visible:ring-1 focus-visible:ring-ring"
                title="Click to copy identifier"
              >
                {copiedIdentifier ? (
                  <Check className="size-3 text-foreground shrink-0" />
                ) : null}
                <span>{card.identifier}</span>
              </button>
            )}

            {isArchived && (
              <span className="px-1.5 py-0.5 rounded-md text-10 font-medium bg-muted text-foreground border border-border shrink-0">
                Archived
              </span>
            )}
          </div>

          {/* Right Controls: Subscribe, Copy Branch, Copy Link, More Actions */}
          <div className="flex items-center gap-1 shrink-0">
            {/* Subscribe toggle button */}
            {currentUserId && workItemId && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleToggleSubscribe}
                className="h-8 px-2.5 text-12 text-foreground hover:bg-muted cursor-pointer flex items-center gap-1.5 relative before:absolute before:-inset-1 md:before:hidden focus-visible:ring-1 focus-visible:ring-ring"
                title={isSubscribed ? "Unsubscribe from notifications" : "Subscribe to notifications"}
              >
                {isSubscribed ? (
                  <BellOff className="size-3.5 text-foreground shrink-0" />
                ) : (
                  <Bell className="size-3.5 shrink-0 text-foreground" />
                )}
                <span className="hidden md:inline text-11">
                  {isSubscribed ? "Subscribed" : "Subscribe"}
                </span>
              </Button>
            )}

            {/* Copy Link */}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleCopyLink}
              className="size-7 rounded-md text-foreground hover:bg-muted cursor-pointer shrink-0 relative before:absolute before:-inset-2 md:before:hidden focus-visible:ring-1 focus-visible:ring-ring"
              title={copiedLink ? "Copied link!" : "Copy link to work item"}
              aria-label="Copy link to work item"
            >
              {copiedLink ? <Check className="size-3.5 text-foreground shrink-0" /> : <Link2 className="size-3.5 shrink-0" />}
            </Button>

            {/* More actions dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 rounded-md text-foreground hover:bg-muted cursor-pointer outline-none shrink-0 relative before:absolute before:-inset-2 md:before:hidden focus-visible:ring-1 focus-visible:ring-ring"
                  aria-label="More actions"
                >
                  <MoreHorizontal className="size-3.5 shrink-0" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52 rounded-md border border-border p-1 z-100 bg-popover shadow-overlay">
                <DropdownMenuItem onClick={handleCopyGitBranch} className="rounded-md py-1.5 text-xs text-foreground cursor-pointer">
                  <GitBranch className="mr-2 size-3.5 shrink-0 text-foreground" />
                  <span>{copiedGit ? "Copied branch!" : "Copy git branch"}</span>
                </DropdownMenuItem>
                {!isReadOnly && onDuplicate && (
                  <DropdownMenuItem onClick={onDuplicate} className="rounded-md py-1.5 text-xs text-foreground cursor-pointer">
                    <Copy className="mr-2 size-3.5 shrink-0 text-foreground" />
                    <span>Duplicate</span>
                  </DropdownMenuItem>
                )}
                {!isReadOnly && workItemId && (
                  <DropdownMenuItem
                    onClick={isArchived ? handleRestoreItem : handleArchiveItem}
                    className="rounded-md py-1.5 text-xs text-foreground cursor-pointer"
                  >
                    {isArchived ? (
                      <>
                        <ArchiveRestore className="mr-2 size-3.5 shrink-0 text-foreground" />
                        <span>Restore work item</span>
                      </>
                    ) : (
                      <>
                        <Archive className="mr-2 size-3.5 shrink-0 text-foreground" />
                        <span>Archive work item</span>
                      </>
                    )}
                  </DropdownMenuItem>
                )}
                {currentUserId && (
                  <DropdownMenuItem
                    onClick={isCurrentUserAssignee ? handleLeaveItem : handleJoinItem}
                    className="rounded-md py-1.5 text-xs text-foreground cursor-pointer"
                  >
                    {isCurrentUserAssignee ? (
                      <UserMinus className="mr-2 size-3.5 shrink-0 text-foreground" />
                    ) : (
                      <UserPlus className="mr-2 size-3.5 shrink-0 text-foreground" />
                    )}
                    <span>{isCurrentUserAssignee ? "Leave work item" : "Join work item"}</span>
                  </DropdownMenuItem>
                )}
                {!isReadOnly && onDelete && (
                  <DropdownMenuItem
                    onClick={onDelete}
                    className="rounded-md py-1.5 text-xs text-foreground hover:bg-muted cursor-pointer"
                  >
                    <Trash2 className="mr-2 size-3.5 shrink-0 text-foreground" />
                    <span>Delete work item</span>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Scrollable Main Body Content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0">
          <div className="px-4 sm:px-7 py-4 sm:py-6 space-y-6 max-w-4xl mx-auto">
            
            {/* Title Section */}
            <div className="space-y-1">
              <input
                value={title}
                maxLength={255}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Work item title"
                aria-label="Work item title"
                disabled={isReadOnly}
                className="w-full text-16 sm:text-lg font-semibold text-foreground outline-none bg-transparent placeholder:text-muted-foreground/60 border-none p-0 focus:ring-0 tracking-tight"
              />
            </div>

            {/* Properties Section - Academic Library Inspector Style */}
            <div className="border-b border-border/60 pb-3">
              <button
                type="button"
                onClick={() => setShowProperties((prev) => !prev)}
                className="flex items-center justify-between w-full h-8 select-none transition-colors group cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-xs"
              >
                <span className="text-12 font-medium text-foreground tracking-tight">Properties</span>
                <div className="flex items-center gap-1">
                  {showProperties ? (
                    <ChevronDown className="size-3.5 text-foreground shrink-0" />
                  ) : (
                    <ChevronRight className="size-3.5 text-foreground shrink-0" />
                  )}
                </div>
              </button>
              {showProperties && (
                <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
                  {/* Left Column: Workflow State */}
                  <div className="space-y-2">
                    {/* Status */}
                    <div className="grid grid-cols-[84px_1fr] items-center gap-2 h-8">
                      <span className="text-muted-foreground text-11 font-medium select-none">Status</span>
                      <div className="flex items-center min-w-0">
                        <StatePopover
                          open={openStatePopover}
                          onOpenChange={setOpenStatePopover}
                          columnId={columnId}
                          setColumnId={handleColumnChange}
                          columns={columns}
                          actionBtnClass={actionBtnClass}
                          isReadOnly={isReadOnly}
                        />
                      </div>
                    </div>

                    {/* Priority */}
                    <div className="grid grid-cols-[84px_1fr] items-center gap-2 h-8">
                      <span className="text-muted-foreground text-11 font-medium select-none">Priority</span>
                      <div className="flex items-center min-w-0">
                        <PriorityPopover
                          open={openPriorityPopover}
                          onOpenChange={setOpenPriorityPopover}
                          priority={priority}
                          setPriority={(p) => {
                            setPriority(p);
                            safeSave({ ...currentPayload, priority: p });
                          }}
                          actionBtnClass={actionBtnClass}
                        />
                      </div>
                    </div>

                    {/* Assignees */}
                    <div className="grid grid-cols-[84px_1fr] items-center gap-2 h-8">
                      <span className="text-muted-foreground text-11 font-medium select-none">Assignees</span>
                      <div className="flex items-center min-w-0">
                        <MemberPopover
                          open={openMemberPopover}
                          onOpenChange={setOpenMemberPopover}
                          assigneeId={assigneeId}
                          setAssigneeId={(id) => {
                            setAssigneeId(id);
                            safeSave({ ...currentPayload, assigneeId: id });
                          }}
                          assigneeIds={assigneeIds}
                          setAssigneeIds={(ids) => {
                            setAssigneeIds(ids);
                            setAssigneeId(ids[0] ?? null);
                            safeSave({
                              ...currentPayload,
                              assigneeIds: ids,
                              assigneeId: ids[0] ?? null,
                            });
                          }}
                          isMulti={true}
                          members={members}
                          actionBtnClass={actionBtnClass}
                        />
                      </div>
                    </div>

                    {/* Dates */}
                    <div className="grid grid-cols-[84px_1fr] items-center gap-2 h-8">
                      <span className="text-muted-foreground text-11 font-medium select-none">Dates</span>
                      <div className="flex items-center min-w-0">
                        <DatePopover
                          open={openDatePopover}
                          onOpenChange={setOpenDatePopover}
                          startDate={startDate}
                          dueDate={dueDate}
                          onApplyDates={(data) => {
                            setStartDate(data.startDate || "");
                            setDueDate(data.dueDate || "");
                            safeSave({
                              ...currentPayload,
                              startDate: data.startDate,
                              dueDate: data.dueDate,
                            });
                          }}
                          actionBtnClass={actionBtnClass}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Hierarchy & Attributes */}
                  <div className="space-y-2">
                    {/* Parent Item */}
                    <div className="grid grid-cols-[84px_1fr] items-center gap-2 h-8">
                      <span className="text-muted-foreground text-11 font-medium select-none">Parent</span>
                      <div className="flex items-center min-w-0">
                        <ParentItemPopover
                          open={openParentPopover}
                          onOpenChange={setOpenParentPopover}
                          parentId={parentId}
                          setParentId={(pId) => {
                            setParentId(pId);
                            safeSave({ ...currentPayload, parentId: pId || undefined });
                          }}
                          items={availableItems}
                          actionBtnClass={actionBtnClass}
                          isReadOnly={isReadOnly}
                        />
                      </div>
                    </div>

                    {/* Labels */}
                    <div className="grid grid-cols-[84px_1fr] items-center gap-2 h-8">
                      <span className="text-muted-foreground text-11 font-medium select-none">Labels</span>
                      <div className="flex items-center min-w-0">
                        <LabelPopover
                          open={openLabelPopover}
                          onOpenChange={setOpenLabelPopover}
                          labels={labels}
                          setLabels={(l) => {
                            const updated = typeof l === 'function' ? l(labels) : l;
                            setLabels(updated);
                            safeSave({ ...currentPayload, labels: updated });
                          }}
                          actionBtnClass={actionBtnClass}
                          isReadOnly={isReadOnly}
                        />
                      </div>
                    </div>

                    {/* Time Spent */}
                    <div className="grid grid-cols-[84px_1fr] items-center gap-2 h-8">
                      <span className="text-muted-foreground text-11 font-medium select-none">Time Spent</span>
                      <div className="flex items-center gap-1.5">
                        <Input
                          type="number"
                          min={0}
                          step={0.5}
                          aria-label="Time spent in hours"
                          disabled={isReadOnly}
                          value={timeSpent ?? ''}
                          placeholder="0"
                          onChange={(e) => {
                            const val = e.target.value === '' ? null : parseFloat(e.target.value);
                            setTimeSpent(val);
                            safeSave({ ...currentPayload, timeSpent: val });
                          }}
                          className="h-8 w-20 text-xs px-2 text-right font-mono text-foreground bg-background border-border"
                        />
                        <span className="text-11 text-muted-foreground select-none">hrs</span>
                      </div>
                    </div>

                    {/* Audit Info */}
                    <div className="grid grid-cols-[84px_1fr] items-center gap-2 h-8 text-11 text-muted-foreground">
                      <span className="font-medium select-none">Audit</span>
                      <div className="flex items-center gap-1.5 text-foreground truncate min-w-0">
                        <span className="truncate">Created by <span className="font-medium">{authorName}</span></span>
                        {createdAtFormatted && (
                          <span className="font-mono text-10 text-muted-foreground tabular-nums shrink-0">• {createdAtFormatted}</span>
                        )}
                        {updatedAtFormatted && (
                          <span className="font-mono text-10 text-muted-foreground tabular-nums shrink-0">• Updated {updatedAtFormatted}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Description Section */}
            <div className="space-y-2">
              <textarea
                value={description}
                aria-label="Work item description"
                onChange={(e) => {
                  setDescription(e.target.value);
                }}
                placeholder="Add a detailed description..."
                disabled={isReadOnly}
                rows={3}
                className="w-full resize-none rounded-md border border-border bg-background p-3 text-13 text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring transition-colors leading-relaxed min-h-[90px]"
              />

              {/* Description Footer with Plane Last Edited Info & Auto-save Status */}
              <div className="flex items-center justify-between text-11 text-muted-foreground pt-0.5">
                <span>
                  Last edited by <span className="font-medium text-foreground">{authorName}</span> {descriptionLastEdited}
                </span>

                <div className="flex items-center gap-1.5 text-11 select-none">
                  {isAutosaving ? (
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <Loader2 className="size-3 animate-spin text-muted-foreground shrink-0" />
                      <span>Saving...</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-muted-foreground/80">
                      <Check className="size-3 text-muted-foreground shrink-0" />
                      <span>Saved</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Sub-items Section */}
            <div className="space-y-2.5 pt-1 border-b border-border/60 pb-4">
              <div className="flex items-center justify-between h-8">
                <div className="flex items-center gap-1.5">
                  <span className="text-12 font-medium text-foreground tracking-tight">Sub-items</span>
                  {subItems.length > 0 && (
                    <span className="text-11 font-mono font-medium text-foreground px-1.5 py-0.5 rounded bg-muted tabular-nums">
                      {subItems.filter((s: SubItem) => s.completed || s.columnId === 'done').length}/{subItems.length}
                    </span>
                  )}
                </div>
                {subItems.length > 0 && (
                  <span className="text-11 font-mono font-medium text-foreground tabular-nums">
                    {progressRollup}% done
                  </span>
                )}
              </div>

              {/* Progress Bar */}
              {subItems.length > 0 && (
                <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-200 ease-out"
                    style={{ width: `${progressRollup}%` }}
                  />
                </div>
              )}

              {/* Sub-items List */}
              {subItems.length > 0 && (
                <div className="divide-y divide-border rounded-md border border-border bg-background overflow-hidden">
                  {subItems.map((sub: SubItem, sIdx: number) => {
                    const isSubDone = Boolean(sub.completed || sub.stateGroup === 'completed' || sub.state?.group === 'completed' || sub.columnId === 'done');
                    const isSubCancelled = Boolean(sub.columnId === 'cancelled' || sub.stateGroup === 'cancelled' || sub.state?.group === 'cancelled');
                    return (
                      <div key={sub.id || sIdx} className="flex items-center justify-between px-3 py-2 text-xs hover:bg-muted/50 transition-colors group">
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <button
                            type="button"
                            disabled={isReadOnly}
                            onClick={() => {
                              const nextCompleted = !isSubDone;
                              const nextColumnId = nextCompleted ? defaultCompletedColumnId : defaultUnstartedColumnId;
                              const updated = subItems.map((s, i) =>
                                i === sIdx ? { ...s, completed: nextCompleted, columnId: nextColumnId } : s
                              );
                              setSubItems(updated);
                                if (sub.id && !String(sub.id).startsWith('sub_')) {
                                  updateSubItemMutation.mutate({
                                    id: sub.id,
                                    projectId: currentProjectId,
                                    completed: nextCompleted,
                                    columnId: nextColumnId,
                                  });
                                }
                              }}
                              aria-label={`Mark sub-item ${sub.title || 'untitled'} as ${isSubDone ? 'incomplete' : 'complete'}`}
                              className={cn(
                                'size-4 rounded-md border flex items-center justify-center transition-colors cursor-pointer relative before:absolute before:-inset-2.5 md:before:hidden',
                                isSubDone ? 'bg-primary border-primary text-primary-foreground' : 'border-border hover:border-foreground'
                              )}
                            >
                              {isSubDone && <Check className="size-3 shrink-0" />}
                            </button>
                            <span className={cn("font-medium text-xs", isSubCancelled ? 'line-through text-muted-foreground' : isSubDone ? 'text-muted-foreground' : 'text-foreground')}>
                              {sub.title}
                            </span>
                          </div>

                          {!isReadOnly && (
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                type="button"
                                onClick={() => handleConvertSubItem(sub, sIdx)}
                                className="p-1 text-foreground cursor-pointer transition-colors rounded-md hover:bg-muted relative before:absolute before:-inset-2 md:before:hidden"
                                title="Convert to independent work item"
                                aria-label="Convert to independent work item"
                              >
                                <ArrowUpRight className="size-3.5 shrink-0" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = subItems.filter((_, i) => i !== sIdx);
                                  setSubItems(updated);
                                  if (sub.id && !String(sub.id).startsWith('sub_')) {
                                    deleteSubItemMutation.mutate({ id: sub.id, projectId: currentProjectId });
                                  }
                                }}
                                className="p-1 text-foreground cursor-pointer transition-colors rounded-md hover:bg-muted relative before:absolute before:-inset-2 md:before:hidden"
                                title="Delete sub-item"
                                aria-label="Delete sub-item"
                              >
                                <X className="size-3.5 shrink-0" />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Inline Add Sub-item Form */}
                {!isReadOnly && (
                  <form onSubmit={handleAddSubItem} className="flex items-center gap-2">
                    <Input
                      id="sub-item-quick-input"
                      value={newSubItemTitle}
                      onChange={(e) => setNewSubItemTitle(e.target.value)}
                      placeholder="+ Add sub-item..."
                      className="h-8 text-13 placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring"
                    />
                    {newSubItemTitle.trim() && (
                      <Button type="submit" size="sm" className="h-8 text-12 shrink-0 px-3 relative before:absolute before:-inset-1 md:before:hidden bg-primary text-primary-foreground hover:bg-primary-hover">
                        Add
                      </Button>
                    )}
                  </form>
                )}
              </div>

              {/* Relations Section */}
              <Relations
                relations={relations}
                currentItemId={workItemId || undefined}
                availableItems={availableItems}
                onAddRelation={(newRel) => {
                  const prevRelations = relations;
                  const updated = [...relations, newRel];
                  setRelations(updated);
                  const target = newRel.targetId || newRel.targetWorkItemId;
                  if (workItemId && target) {
                    addRelationMutation.mutate(
                      {
                        id: workItemId,
                        itemId: workItemId,
                        workItemId,
                        type: newRel.type,
                        targetId: target,
                        targetWorkItemId: target,
                      },
                      {
                        onError: () => setRelations(prevRelations),
                      },
                    );
                  } else {
                    onSave({ ...currentPayload, relations: updated });
                  }
                }}
                onRemoveRelation={(relId, targetItemId) => {
                  const prevRelations = relations;
                  const updated = relations.filter((r) => r.id !== relId);
                  setRelations(updated);
                  if (workItemId) {
                    removeRelationMutation.mutate(
                      {
                        id: workItemId,
                        itemId: workItemId,
                        workItemId,
                        relationId: relId,
                        targetId: targetItemId,
                        targetWorkItemId: targetItemId,
                      },
                      {
                        onError: () => setRelations(prevRelations),
                      },
                    );
                  } else {
                    onSave({ ...currentPayload, relations: updated });
                  }
                }}
              isReadOnly={isReadOnly}
            />

            {/* Attachments Section */}
            <Attachments
              attachments={attachments}
              itemId={workItemId || undefined}
              projectId={currentProjectId}
              onRenameAttachment={handleRenameAttachment}
              onRemoveAttachment={handleRemoveAttachment}
              onAttachPage={handleAttachPage}
              onDetachPage={handleDetachPage}
              onAttachPaper={handleAttachPaper}
              onDetachPaper={handleDetachPaper}
              onAttachFile={handleAttachFile}
              onDetachFile={handleDetachFile}
              onAttachLink={handleAttachLink}
              onDetachLink={handleDetachLink}
              isReadOnly={isReadOnly}
            />

            {/* Activity & Comments Timeline with Filter Tabs */}
            <div className="pt-4 border-t border-border">
              <Activities
                commentText={commentText}
                setCommentText={setCommentText}
                commentTextareaRef={commentTextareaRef}
                onSaveComment={handleSaveComment}
                onUpdateComment={handleUpdateComment}
                onDeleteComment={handleDeleteComment}
                onReactComment={handleReactComment}
                attachmentLinks={(attachments.files || []).map((item) => ({ name: item.name, url: item.url }))}
                commentCaretPosition={commentCaretPosition}
                onCommentCaretChange={setCommentCaretPosition}
                canComment={canComment}
                isSavingComment={createCommentMutation.isPending}
                isUpdatingComment={updateCommentMutation.isPending}
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
    </>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}

export default DetailModal;
