'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/components/ui";
import { Button } from "@/shared/components/ui";
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
  Bell,
  BellOff,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2,
  PanelRight,
  Link2,
  ArrowRight,
  Layers,
  Folder,
  Plus,
  CalendarDays,
  User,
  Sparkles,
} from "lucide-react";
import { useParams } from "next/navigation";
import { useAuth } from '@/features/auth/hooks/use-auth';
import { cn } from "@/shared/lib/utils";

import type {
  Item,
  Column,
  ItemMutationInput,
  Priority,
  Relation,
  SubItem,
  Project,
  ProjectMember,
  AttachPageItem,
  AttachPaperItem,
  AttachFileItem,
  AttachLinkItem,
  Cycle,
} from '../../types/work-item.types';
import {
  resolveColumnId,
  resolveStateId,
  ItemHelpers,
  WorkItemHelpers,
} from "../../utils/work-item.utils";
import { StatusIcon } from "@/shared/components/icons";
import {
  useComments,
  useAddComment,
  useUpdateComment,
  useReactComment,
  useDeleteComment,
} from "../../hooks/use-comment";
import {
  useCreateSubItem,
  useConvertSubItemToRoot,
  useSubItemNotification,
  useCopyItemText,
  useUpdateItem,
  useDeleteItem,
} from "../../hooks/use-work-item";
import { useActivityLogs } from "../../hooks/use-history";
import { useLabelsQuery } from "../../hooks/use-label";
import { useCycles } from "../../hooks/use-cycle";
import { useUploadFilesWithToast, useWorkItemAttachments } from "../../hooks/use-attachment";
import {
  useAddRelationMutation,
  useRemoveRelationMutation,
} from "../../hooks/use-relation";
import { useArchiveItem, useRestoreItem } from "../../hooks/use-archive";
import { useCreateTemplateMutation } from "../../hooks/use-template";
import {
  useSubscribeItemMutation,
  useUnsubscribeItemMutation,
} from "../../hooks/use-assignment";

import { Activities, type ActivityEntry } from "./Activities";
import { Attachments, type ItemAttachment, type AttachCenterData } from "./Attachments";
import { Updates } from "./WorkItemUpdates";
import {
  MemberPopover,
  LabelPopover,
  DatePopover,
  PriorityPopover,
  CyclePopover,
  ParentItemPopover,
} from "./Popovers";
import { Relations } from "./Relations";

const EMPTY_ATTACHMENTS: AttachCenterData = {
  pages: [],
  papers: [],
  files: [],
  links: [],
};

const normalizeAttachments = (raw: any): AttachCenterData => {
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
};

const formatMetaDate = (dateStr?: string | null) => {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return dateStr;
  }
};

const getTimeAgo = (dateStr?: string | null) => {
  if (!dateStr) return 'recently';
  try {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return 'just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) return `${diffDays} days ago`;
    const diffMonths = Math.floor(diffDays / 30);
    return `${diffMonths} months ago`;
  } catch {
    return 'recently';
  }
};

export type DetailModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: Partial<Item>;
  card?: Partial<Item>;
  columns: Column[];
  project?: Project;
  members?: ProjectMember[];
  availableItems?: Item[];
  cycles?: Cycle[];
  onSave: (data: ItemMutationInput) => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onRemoveFromCycle?: () => void;
  isReadOnly?: boolean;
};

export function DetailModal({
  open,
  onOpenChange,
  item: propItem,
  card: propCard,
  columns,
  project,
  members = [],
  availableItems: propAvailableItems,
  cycles: propCycles,
  onSave,
  onDelete,
  onDuplicate,
  onRemoveFromCycle,
  isReadOnly = false,
}: DetailModalProps) {
  const card = propItem || propCard;
  const availableItems = propAvailableItems || [];
  const { projectId: routeProjectId } = useParams() as { projectId?: string };
  const currentProjectId = routeProjectId || (project as any)?.id || card?.projectId;
  const { user: currentUser } = useAuth();
  const copyItemText = useCopyItemText();
  const convertSubItemToRoot = useConvertSubItemToRoot();
  const { notifySubItemAdded } = useSubItemNotification();
  const uploadFilesWithToast = useUploadFilesWithToast();
  const { data: rawLabels } = useLabelsQuery(currentProjectId, 'work-item');
  const { data: remoteCyclesData } = useCycles(currentProjectId || "");

  const projectLabels = useMemo(() => {
    if (Array.isArray(rawLabels)) return rawLabels;
    if (Array.isArray((rawLabels as any)?.labels)) return (rawLabels as any).labels;
    return [];
  }, [rawLabels]);

  const allCycles = useMemo<Cycle[]>(() => {
    if (propCycles && propCycles.length > 0) return propCycles;
    if (Array.isArray(remoteCyclesData)) return remoteCyclesData as Cycle[];
    if ((remoteCyclesData as any)?.cycles && Array.isArray((remoteCyclesData as any).cycles)) {
      return (remoteCyclesData as any).cycles;
    }
    return [];
  }, [propCycles, remoteCyclesData]);

  const firstColumnId = resolveStateId(columns[0]);

  // Layout View Mode: 'side_peek' | 'modal' | 'full_screen'
  const [viewMode, setViewMode] = useState<'side_peek' | 'modal' | 'full_screen'>('side_peek');

  // Collapsible Sections
  const [showProperties, setShowProperties] = useState(true);
  const [showDetails, setShowDetails] = useState(true);
  const [showProjectStructure, setShowProjectStructure] = useState(true);

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
  const [cycleId, setCycleId] = useState<string | null>(card?.cycleId || null);
  const [parentId, setParentId] = useState<string | null>(card?.parentId || null);
  const [moduleId, setModuleId] = useState<string | null>((card as any)?.moduleId || null);
  const [commentText, setCommentText] = useState("");
  const [showDetailActivity, setShowDetailActivity] = useState(false);
  const [showDescriptionActions, setShowDescriptionActions] = useState(false);
  const descriptionDraftRef = useRef("");
  const commentTextareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [subItems, setSubItems] = useState<SubItem[]>([]);
  const [newSubItemTitle, setNewSubItemTitle] = useState("");
  const [completed, setCompleted] = useState(false);
  const [attachments, setAttachments] = useState<AttachCenterData>(EMPTY_ATTACHMENTS);
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
  const [openCyclePopover, setOpenCyclePopover] = useState(false);
  const [openParentPopover, setOpenParentPopover] = useState(false);
  const [openAttachmentPopover, setOpenAttachmentPopover] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [copiedGit, setCopiedGit] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const workItemId = card?.id || null;
  const currentUserId = currentUser?.id || null;
  const isCurrentUserAssignee = Boolean(currentUserId && (assigneeId === currentUserId || assigneeIds.includes(currentUserId)));
  const canComment = Boolean(workItemId);
  const { data: itemComments = [] } = useComments(open && workItemId ? workItemId : "");
  const { data: itemActivity = [], error: activityError, isLoading: activityLoading } = useActivityLogs(open && workItemId ? workItemId : "");
  const { data: fetchedAttachments } = useWorkItemAttachments(open && workItemId ? workItemId : "");
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
  const createTemplateMutation = useCreateTemplateMutation();
  const subscribeMutation = useSubscribeItemMutation();
  const unsubscribeMutation = useUnsubscribeItemMutation();

  const isArchived = Boolean((card as any)?.archivedAt);

  const subscriberList = useMemo(() => {
    const raw = (card as any)?.subscriberIds || (card as any)?.subscribers;
    return Array.isArray(raw) ? raw : [];
  }, [card]);
  const isSubscribed = Boolean(currentUserId && subscriberList.includes(currentUserId));

  // Author & timestamps for Plane metadata display
  const authorName = (card as any)?.author?.name || (card as any)?.creator?.name || (card as any)?.createdByName || currentUser?.name || 'Plane';
  const createdAtFormatted = formatMetaDate((card as any)?.createdAt) || formatMetaDate(new Date().toISOString());
  const updatedAtFormatted = formatMetaDate((card as any)?.updatedAt);
  const completedAtFormatted = (card as any)?.completedAt ? formatMetaDate((card as any).completedAt) : (completed ? 'Completed' : null);
  const descriptionLastEdited = getTimeAgo((card as any)?.updatedAt || (card as any)?.createdAt);

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

  const handleSaveAsTemplate = async () => {
    if (!currentProjectId || !title.trim()) return;
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

  const handleConvertSubItem = async (sub: any, sIdx: number) => {
    try {
      await convertSubItemToRoot.mutateAsync({ id: sub.id, itemId: sub.id, workItemId: sub.id });
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
          openPriorityPopover ||
          openMemberPopover ||
          openLabelPopover ||
          openDatePopover ||
          openCyclePopover ||
          openParentPopover ||
          openAttachmentPopover
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
    openPriorityPopover,
    openMemberPopover,
    openLabelPopover,
    openDatePopover,
    openCyclePopover,
    openParentPopover,
    openAttachmentPopover,
    onOpenChange,
  ]);

  useEffect(() => {
    if (!open) return;

    if (card) {
      setTitle(card.title ?? "");
      setDescription(card.description || card.content || "");
      descriptionDraftRef.current = card.description || card.content || "";
      setColumnId(card.columnId || firstColumnId);
      setRelations(card.relations || []);
      setPriority(card.priority || "none");
      setLabels(ItemHelpers.uniqueLabels(card.labels));
      setDueDate(card.dueDate || "");
      setStartDate(card.startDate || "");
      setCycleId(card.cycleId || null);
      setParentId(card.parentId || null);
      setModuleId((card as any)?.moduleId || null);
      setSubItems(
        Array.isArray((card as any)?.childWorkItems) && (card as any).childWorkItems.length > 0
          ? (card as any).childWorkItems
          : Array.isArray((card as any)?.subItems)
          ? (card as any).subItems
          : []
      );
      setCompleted(card.completed || false);
      setAttachments(normalizeAttachments(card.attachments));

      const initialAssigneeIds = Array.isArray((card as any)?.assigneeIds) && (card as any).assigneeIds.length > 0
        ? (card as any).assigneeIds
        : (card as any)?.assignees && Array.isArray((card as any).assignees) && (card as any).assignees.length > 0
        ? (card as any).assignees.map((a: any) => a.id).filter(Boolean)
        : card?.assigneeId
        ? [card.assigneeId]
        : (card as any)?.assignee?.id
        ? [(card as any).assignee.id]
        : [];
      setAssigneeIds(initialAssigneeIds);
      setAssigneeId(initialAssigneeIds[0] ?? null);
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
      setAssigneeId(null);
      setAssigneeIds([]);
      setCycleId(null);
      setParentId(null);
      setModuleId(null);
      setSubItems([]);
      setCompleted(false);
      setAttachments(EMPTY_ATTACHMENTS);
    }

    setCommentText("");
    setCommentCaretPosition(0);
    setShowDetailActivity(false);
    setShowDescriptionActions(false);
    const initialAssigneeIds = Array.isArray((card as any)?.assigneeIds) && (card as any).assigneeIds.length > 0
      ? (card as any).assigneeIds
      : (card as any)?.assignees && Array.isArray((card as any).assignees) && (card as any).assignees.length > 0
      ? (card as any).assignees.map((a: any) => a.id).filter(Boolean)
      : card?.assigneeId
      ? [card.assigneeId]
      : (card as any)?.assignee?.id
      ? [(card as any).assignee.id]
      : [];
    initialSnapshotRef.current = ItemHelpers.createSnapshot({
      title: card?.title || "",
      content: card?.description || card?.content || "",
      columnId: card?.columnId || firstColumnId,
      relations: card?.relations || [],
      priority: card?.priority || "none",
      dueDate: card?.dueDate || "",
      startDate: card?.startDate || "",
      labels: ItemHelpers.uniqueLabels(card?.labels),
      assigneeId: initialAssigneeIds[0] ?? null,
      assigneeIds: initialAssigneeIds,
      cycleId: card?.cycleId || null,
      parentId: card?.parentId || null,
      completed: card?.completed || false,
      attachments: normalizeAttachments(card?.attachments),
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
          const parsed = JSON.parse(initialSnapshotRef.current) as Record<string, any>;
          parsed.attachments = normalized;
          initialSnapshotRef.current = JSON.stringify(parsed);
          autosaveSignatureRef.current = initialSnapshotRef.current;
        } catch {}
      }
    }
  }, [fetchedAttachments]);

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
      cycleId: cycleId || undefined,
      parentId: parentId || undefined,
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
    cycleId,
    parentId,
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

    if (!hasUnsavedChanges) return;

    const payloadSnapshot = ItemHelpers.createSnapshot(currentPayload);
    if (payloadSnapshot === autosaveSignatureRef.current) return;

    const timer = setTimeout(() => {
      autosaveSignatureRef.current = payloadSnapshot;
      safeSave(currentPayload);
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
    }
  };

  const handleCopyGitBranch = () => {
    const branchSlug = (title || card?.title || 'task')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 40);
    const branchName = card?.identifier
      ? `${card.identifier.toLowerCase()}-${branchSlug}`
      : `feature/${branchSlug}`;
    copyItemText(branchName, `Copied git branch: ${branchName}`);
    setCopiedGit(true);
    setTimeout(() => setCopiedGit(false), 2000);
  };

  const handleCopyLink = () => {
    if (typeof window !== 'undefined') {
      const url = window.location.href;
      copyItemText(url, 'Copied link to clipboard');
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
        const res: any = await createSubItemMutation.mutateAsync({
          id: workItemId,
          itemId: workItemId,
          workItemId: workItemId,
          title: itemTitle,
          columnId: defaultUnstartedColumnId,
        });
        const created = res?.subItem || res?.workItem || res?.item || res;
        const newSub: SubItem = {
          id: created.id,
          title: created.title,
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

  // Attach Center Actions
  const handleAttachFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const fileList = Array.from(files);
    try {
      const results = await uploadFilesWithToast(fileList, {
        showSuccessToast: false,
        errorMessage: 'Failed to upload attachment',
      });
      const newAttachments: ItemAttachment[] = results.map(
        ({ file: f, url: uploadedUrl, fileId }) => ({
          id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          name: f.name,
          type: f.type,
          size: `${Math.round(f.size / 1024)} KB`,
          createdAt: new Date().toISOString(),
          url: uploadedUrl || URL.createObjectURL(f),
          ...(fileId ? { fileId } : {}),
        }),
      );
      const updated: AttachCenterData = {
        ...attachments,
        files: [...(attachments.files || []), ...newAttachments],
      };
      setAttachments(updated);
      setOpenAttachmentPopover(false);
      safeSave({ ...currentPayload, attachments: updated as any });
    } catch {}
  };

  const handleAttachPage = (page: { pageId: string; title: string }) => {
    const updated: AttachCenterData = {
      ...attachments,
      pages: [
        ...(attachments.pages || []),
        {
          id: page.pageId,
          pageId: page.pageId,
          title: page.title,
          addedAt: new Date().toISOString(),
        } as AttachPageItem,
      ],
    };
    setAttachments(updated);
    safeSave({ ...currentPayload, attachments: updated as any });
  };

  const handleDetachPage = (pageId: string) => {
    const updated: AttachCenterData = {
      ...attachments,
      pages: (attachments.pages || []).filter(
        (p) => (p as any).pageId !== pageId && p.id !== pageId
      ),
    };
    setAttachments(updated);
    safeSave({ ...currentPayload, attachments: updated as any });
  };

  const handleAttachPaper = (paper: {
    paperId: string;
    title: string;
    doi?: string;
    citationKey?: string;
  }) => {
    const updated: AttachCenterData = {
      ...attachments,
      papers: [
        ...(attachments.papers || []),
        {
          id: paper.paperId,
          paperId: paper.paperId,
          title: paper.title,
          doi: paper.doi,
          citationKey: paper.citationKey,
          addedAt: new Date().toISOString(),
        } as AttachPaperItem,
      ],
    };
    setAttachments(updated);
    safeSave({ ...currentPayload, attachments: updated as any });
  };

  const handleDetachPaper = (paperId: string) => {
    const updated: AttachCenterData = {
      ...attachments,
      papers: (attachments.papers || []).filter(
        (p) => (p as any).paperId !== paperId && p.id !== paperId
      ),
    };
    setAttachments(updated);
    safeSave({ ...currentPayload, attachments: updated as any });
  };

  const handleAttachFile = (file: {
    name: string;
    url: string;
    size?: number;
    type?: string;
    fileId?: string;
  }) => {
    const newFile: ItemAttachment = {
      id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      name: file.name,
      url: file.url,
      size: file.size ? `${Math.round(file.size / 1024)} KB` : undefined,
      type: file.type,
      createdAt: new Date().toISOString(),
      ...(file.fileId ? { fileId: file.fileId } : {}),
    };
    const updated: AttachCenterData = {
      ...attachments,
      files: [...(attachments.files || []), newFile],
    };
    setAttachments(updated);
    safeSave({ ...currentPayload, attachments: updated as any });
  };

  const handleDetachFile = (fileId: string) => {
    const updated: AttachCenterData = {
      ...attachments,
      files: (attachments.files || []).filter((f) => (f as any).id !== fileId),
    };
    setAttachments(updated);
    safeSave({ ...currentPayload, attachments: updated as any });
  };

  const handleAttachLink = (link: { title: string; url: string }) => {
    const updated: AttachCenterData = {
      ...attachments,
      links: [
        ...(attachments.links || []),
        {
          title: link.title,
          url: link.url,
          addedAt: new Date().toISOString(),
        } as AttachLinkItem,
      ],
    };
    setAttachments(updated);
    safeSave({ ...currentPayload, attachments: updated as any });
  };

  const handleDetachLink = (linkIndex: number) => {
    const updated: AttachCenterData = {
      ...attachments,
      links: (attachments.links || []).filter((_, idx) => idx !== linkIndex),
    };
    setAttachments(updated);
    safeSave({ ...currentPayload, attachments: updated as any });
  };

  const handleRenameAttachment = (attachmentId: string, newName: string) => {
    const updated: AttachCenterData = {
      ...attachments,
      files: (attachments.files || []).map((a) =>
        (a as any).id === attachmentId ? { ...a, name: newName } : a
      ),
    };
    setAttachments(updated);
    safeSave({ ...currentPayload, attachments: updated as any });
  };

  const handleRemoveAttachment = (attachmentId: string) => {
    handleDetachFile(attachmentId);
  };

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

  // Selected Member & Labels for display
  const selectedMembers = useMemo(() => {
    return assigneeIds
      .map((id) => {
        const m = (members as any[]).find(
          (mem: any) => (mem.user?.id || mem.userId || mem.id) === id
        );
        return m
          ? {
              id,
              name: m.user?.name || m.name || 'Member',
              avatar: m.user?.avatar || m.avatar,
            }
          : null;
      })
      .filter(Boolean) as Array<{ id: string; name: string; avatar?: string | null }>;
  }, [assigneeIds, members]);

  const selectedLabelsList = useMemo(() => {
    const safeLabels = Array.isArray(projectLabels) ? projectLabels : [];
    const safeSelected = Array.isArray(labels) ? labels : [];
    return safeLabels.filter((l: any) => safeSelected.includes(l.id));
  }, [projectLabels, labels]);

  const progressRollup = useMemo(() => {
    return ItemHelpers.calculateProgressRollup(subItems);
  }, [subItems]);

  const visibleActivities = useMemo<ActivityEntry[]>(() => {
    const commentsList = Array.isArray(itemComments)
      ? itemComments
      : (itemComments as any)?.comments || (itemComments as any)?.data || [];
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
        authorInitials: ItemHelpers.getInitials(c.author?.name),
        content: c.content || '',
        timestamp: ItemHelpers.formatActivityTime(c.createdAt),
        createdAt: c.createdAt ? new Date(c.createdAt).getTime() : Date.now(),
        reactionEmoji,
        permissions: {
          canEdit: true,
          canDelete: true,
        },
      };
    });

    const activityList = Array.isArray(itemActivity)
      ? itemActivity
      : (itemActivity as any)?.activity || (itemActivity as any)?.activities || (itemActivity as any)?.data || [];
    const logEntries: ActivityEntry[] = activityList.map((a: any) => ({
      id: a.id || `log_${Math.random()}`,
      kind: 'activity',
      author: a.user?.name || a.author?.name || 'System',
      avatarUrl: a.user?.avatar || a.author?.avatar,
      authorInitials: ItemHelpers.getInitials(a.user?.name || a.author?.name),
      content: a.message || a.action || 'updated this item',
      timestamp: ItemHelpers.formatActivityTime(a.createdAt),
      createdAt: a.createdAt ? new Date(a.createdAt).getTime() : Date.now(),
    }));

    return [...commentEntries, ...logEntries].sort(
      (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
    );
  }, [itemComments, itemActivity]);

  // Modern Action Button Style
  const actionBtnClass =
    'h-7 px-2.5 text-xs font-medium rounded-md bg-background hover:bg-muted text-foreground border border-border shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer shrink-0';

  const renderStatusSelector = () => {
    const activeCol = columns.find((c) => resolveColumnId(c) === columnId);
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild disabled={isReadOnly}>
          <button
            type="button"
            className={cn(
              'h-7 px-2.5 text-xs font-medium rounded-md bg-background hover:bg-muted text-foreground border border-border shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 outline-none',
              isReadOnly && 'opacity-60 cursor-not-allowed'
            )}
          >
            <StatusIcon
              id={columnId}
              title={activeCol?.title || activeCol?.name}
              group={activeCol?.group}
              color={activeCol?.color || activeCol?.accentColor}
              className="size-3.5 shrink-0"
            />
            <span>{activeCol?.title || columnId}</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" sideOffset={4} className="w-44 p-1 text-xs z-100 rounded-md border-border bg-popover">
          {columns.map((col) => {
            const cId = resolveColumnId(col);
            const isCurrent = columnId === cId;
            return (
              <DropdownMenuItem
                key={cId}
                onClick={() => handleColumnChange(cId)}
                className={cn(
                  'flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-medium text-foreground transition-colors hover:bg-muted cursor-pointer text-left',
                  isCurrent && 'bg-muted text-foreground font-semibold'
                )}
              >
                <div className="flex items-center gap-2">
                  <StatusIcon
                    id={cId}
                    title={col.title || col.name}
                    group={col.group}
                    color={col.color || col.accentColor}
                    className="size-3.5 shrink-0"
                  />
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
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[1px] transition-opacity animate-in fade-in duration-150"
          onClick={handleClose}
          aria-hidden="true"
        />
      )}

      {/* Main Drawer / Modal Container */}
      <div
        className={cn(
          "z-50 bg-background text-foreground flex flex-col overflow-hidden border-border",
          isSidePeek && "fixed inset-y-0 right-0 w-full sm:w-[680px] md:w-[760px] lg:w-[840px] xl:w-[900px] border-l shadow-lg animate-in slide-in-from-right duration-200",
          isFullScreen && "fixed inset-0 w-full h-full animate-in fade-in duration-150",
          isModal && "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[94vw] max-w-[900px] max-h-[88vh] rounded-lg border shadow-lg animate-in zoom-in-95 duration-150"
        )}
        role="dialog"
        aria-modal="true"
      >
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-3.5 sm:px-4 py-2 border-b border-border bg-background/95 backdrop-blur-xs shrink-0 min-h-[46px]">
          {/* Left Controls: Collapse, View Mode, Breadcrumb */}
          <div className="flex items-center gap-1 min-w-0">
            {/* Close / Collapse Button */}
            <Button
              variant="ghost"
              size="icon"
              className="size-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer shrink-0"
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
              className="size-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer shrink-0"
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
                "size-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer shrink-0",
                isSidePeek && "text-foreground bg-muted/60"
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
                className="font-mono text-xs font-semibold text-muted-foreground hover:text-foreground px-2 py-0.5 rounded-md border border-border bg-background hover:bg-muted shadow-2xs transition-colors cursor-pointer flex items-center gap-1 shrink-0 truncate max-w-[140px]"
                title="Click to copy identifier"
              >
                <span>{card.identifier}</span>
              </button>
            )}

            {isArchived && (
              <span className="px-1.5 py-0.5 rounded-md text-10 font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shrink-0">
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
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer flex items-center gap-1.5"
                title={isSubscribed ? "Unsubscribe from notifications" : "Subscribe to notifications"}
              >
                {isSubscribed ? (
                  <BellOff className="size-3.5 text-primary shrink-0" />
                ) : (
                  <Bell className="size-3.5 shrink-0" />
                )}
                <span className="hidden md:inline text-11">
                  {isSubscribed ? "Subscribed" : "Subscribe"}
                </span>
              </Button>
            )}

            {/* Copy Git Branch */}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleCopyGitBranch}
              className="size-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer shrink-0"
              title={copiedGit ? "Copied branch!" : "Copy git branch name"}
            >
              {copiedGit ? <Check className="size-3.5 text-emerald-500 shrink-0" /> : <GitBranch className="size-3.5 shrink-0" />}
            </Button>

            {/* Copy Link */}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleCopyLink}
              className="size-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer shrink-0"
              title={copiedLink ? "Copied link!" : "Copy link to work item"}
            >
              {copiedLink ? <Check className="size-3.5 text-emerald-500 shrink-0" /> : <Link2 className="size-3.5 shrink-0" />}
            </Button>

            {/* More actions dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer outline-none shrink-0"
                  aria-label="More actions"
                >
                  <MoreHorizontal className="size-3.5 shrink-0" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52 rounded-md border-border p-1 z-100 bg-popover">
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
                {!isReadOnly && (
                  <DropdownMenuItem onClick={handleSaveAsTemplate} className="rounded-md py-1.5 text-xs text-foreground cursor-pointer">
                    <Bookmark className="mr-2 size-3.5 shrink-0 text-foreground" />
                    <span>Save as template</span>
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
                {onRemoveFromCycle && (
                  <DropdownMenuItem onClick={onRemoveFromCycle} className="rounded-md py-1.5 text-xs text-foreground cursor-pointer">
                    <RotateCcw className="mr-2 size-3.5 shrink-0 text-foreground" />
                    <span>Remove from cycle</span>
                  </DropdownMenuItem>
                )}
                {!isReadOnly && onDelete && (
                  <DropdownMenuItem
                    onClick={onDelete}
                    className="rounded-md py-1.5 text-xs text-destructive focus:bg-destructive focus:text-destructive-foreground cursor-pointer"
                  >
                    <Trash2 className="mr-2 size-3.5 shrink-0" />
                    <span>Delete work item</span>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Direct Close Button in Modal/Fullscreen */}
            {!isSidePeek && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClose}
                className="size-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer shrink-0"
              >
                <X className="size-4 shrink-0" />
              </Button>
            )}
          </div>
        </div>

        {/* Scrollable Main Body Content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0">
          <div className="px-4 sm:px-7 py-4 sm:py-6 space-y-6 max-w-4xl mx-auto">
            
            {/* Title & Character Length Counter (e.g. 19/255) */}
            <div className="space-y-1">
              <div className="flex items-start justify-between gap-2">
                <input
                  value={title}
                  maxLength={255}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Work item title"
                  aria-label="Work item title"
                  disabled={isReadOnly}
                  className="w-full text-xl sm:text-2xl font-semibold text-foreground outline-none bg-transparent placeholder:text-muted-foreground/60 border-none p-0 focus:ring-0 tracking-tight"
                />
                <span className="text-10 text-muted-foreground tabular-nums shrink-0 pt-1 select-none">
                  {title.length}/255
                </span>
              </div>
            </div>

            {/* Quick Properties Strip (Horizontal Row Directly Below Title) */}
            <div className="flex items-center gap-1.5 flex-wrap pt-0.5 pb-1">
              {renderStatusSelector()}

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
                assigneeIds={assigneeIds}
                setAssigneeIds={(ids) => {
                  setAssigneeIds(ids);
                  setAssigneeId(ids[0] ?? null);
                  onSave({
                    ...currentPayload,
                    assigneeIds: ids,
                    assigneeId: ids[0] ?? null,
                  });
                }}
                isMulti={true}
                members={members}
                actionBtnClass={actionBtnClass}
              />

              <DatePopover
                open={openDatePopover}
                onOpenChange={setOpenDatePopover}
                startDate={startDate}
                dueDate={dueDate}
                onApplyDates={(data) => {
                  setStartDate(data.startDate || "");
                  setDueDate(data.dueDate || "");
                  onSave({
                    ...currentPayload,
                    startDate: data.startDate,
                    dueDate: data.dueDate,
                  });
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

              <Popover open={openAttachmentPopover} onOpenChange={setOpenAttachmentPopover}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={actionBtnClass}>
                    <Paperclip className="size-3.5 shrink-0 text-foreground" />
                    <span>Attach</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-72 rounded-md p-0 border-border flex flex-col z-100 bg-popover">
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
                      <Paperclip className="mx-auto h-5 w-5 shrink-0 text-foreground mb-1" />
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

            {/* Active Property Badges */}
            {(selectedMembers.length > 0 || selectedLabelsList.length > 0 || dueDate || startDate) && (
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                {selectedMembers.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center gap-1.5 bg-muted/60 rounded-md px-2 py-0.5 text-xs font-medium text-foreground border border-border"
                  >
                    <Avatar className="size-4 shrink-0">
                      <AvatarImage src={member.avatar || undefined} />
                      <AvatarFallback className="text-9">
                        {member.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <span>{member.name}</span>
                    {!isReadOnly && (
                      <button
                        type="button"
                        onClick={() => {
                          const updated = assigneeIds.filter((id) => id !== member.id);
                          setAssigneeIds(updated);
                          setAssigneeId(updated[0] ?? null);
                          onSave({
                            ...currentPayload,
                            assigneeIds: updated,
                            assigneeId: updated[0] ?? null,
                          });
                        }}
                        className="hover:text-red-500 cursor-pointer ml-0.5"
                      >
                        <X className="size-3 shrink-0" />
                      </button>
                    )}
                  </div>
                ))}

                {selectedLabelsList.map((l: any) => (
                  <span
                    key={l.id}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium text-white shadow-xs"
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
                        <X className="size-3 shrink-0" />
                      </button>
                    )}
                  </span>
                ))}

                {(startDate || dueDate) && (
                  <div className="flex items-center gap-1.5 bg-muted/60 rounded-md px-2 py-0.5 text-xs font-medium text-foreground border border-border">
                    <Clock className="size-3.5 shrink-0 text-muted-foreground" />
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
                          onSave({
                            ...currentPayload,
                            startDate: null,
                            dueDate: null,
                          });
                        }}
                        className="hover:text-red-500 cursor-pointer ml-0.5"
                      >
                        <X className="size-3 shrink-0" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Description Section */}
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
                className="w-full resize-none rounded-md border border-border bg-background p-3 text-xs sm:text-sm text-foreground outline-none focus:border-primary transition-colors leading-relaxed min-h-[90px]"
              />

              {/* Description Footer with Plane Last Edited Info */}
              <div className="flex items-center justify-between text-11 text-muted-foreground pt-0.5">
                <span>
                  Last edited by <span className="font-medium text-foreground">{authorName}</span> {descriptionLastEdited}
                </span>

                {showDescriptionActions && !isReadOnly && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="h-7 text-xs px-3"
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
                      className="h-7 text-xs px-3"
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
            </div>

            {/* Action Bar / Shortcuts */}
            <div className="flex items-center gap-2 pt-1 border-t border-border flex-wrap">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const inputEl = document.getElementById('sub-item-quick-input');
                  if (inputEl) inputEl.focus();
                }}
                className="h-7 px-2.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer flex items-center gap-1.5"
              >
                <Plus className="size-3.5 shrink-0" />
                <span>Add sub-work item</span>
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setOpenAttachmentPopover(true)}
                className="h-7 px-2.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer flex items-center gap-1.5"
              >
                <Paperclip className="size-3.5 shrink-0" />
                <span>Attach file</span>
              </Button>
            </div>

            {/* Collapsible Properties Section (Plane Style Accordion) */}
            <div className="border border-border rounded-md bg-card overflow-hidden">
              {/* Accordion Header */}
              <button
                type="button"
                onClick={() => setShowProperties((prev) => !prev)}
                className="w-full flex items-center justify-between px-4 py-2.5 bg-muted/40 hover:bg-muted/70 transition-colors text-left cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Layers className="size-4 shrink-0 text-muted-foreground" />
                  <span className="text-xs font-semibold text-foreground tracking-tight">Properties</span>
                </div>
                {showProperties ? (
                  <ChevronUp className="size-4 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronDown className="size-4 text-muted-foreground shrink-0" />
                )}
              </button>

              {/* Accordion Body */}
              {showProperties && (
                <div className="divide-y divide-border p-3 sm:p-4 space-y-4">
                  {/* Details Subsection */}
                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={() => setShowDetails((prev) => !prev)}
                      className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    >
                      {showDetails ? <ChevronDown className="size-3.5 shrink-0" /> : <ChevronRight className="size-3.5 shrink-0" />}
                      <span>Details</span>
                    </button>

                    {showDetails && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-2">
                        {/* Parent Item */}
                        <div className="flex items-center justify-between text-xs py-1">
                          <span className="text-muted-foreground">Parent</span>
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

                        {/* Labels Selector */}
                        <div className="flex items-center justify-between text-xs py-1">
                          <span className="text-muted-foreground">Labels</span>
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
                    )}
                  </div>

                  {/* Project Structure Subsection */}
                  <div className="space-y-3 pt-3">
                    <button
                      type="button"
                      onClick={() => setShowProjectStructure((prev) => !prev)}
                      className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    >
                      {showProjectStructure ? <ChevronDown className="size-3.5 shrink-0" /> : <ChevronRight className="size-3.5 shrink-0" />}
                      <span>Project structure</span>
                    </button>

                    {showProjectStructure && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-2">
                        {/* Cycle Selector */}
                        <div className="flex items-center justify-between text-xs py-1">
                          <span className="text-muted-foreground">Cycle</span>
                          <CyclePopover
                            open={openCyclePopover}
                            onOpenChange={setOpenCyclePopover}
                            cycleId={cycleId}
                            setCycleId={(cId) => {
                              setCycleId(cId);
                              safeSave({ ...currentPayload, cycleId: cId || undefined });
                            }}
                            cycles={allCycles}
                            actionBtnClass={actionBtnClass}
                            isReadOnly={isReadOnly}
                          />
                        </div>

                        {/* Module Info */}
                        <div className="flex items-center justify-between text-xs py-1">
                          <span className="text-muted-foreground">Modules</span>
                          <span className="text-xs font-medium text-foreground truncate max-w-[140px]">
                            {(card as any)?.module?.name || (card as any)?.moduleName || 'Core Workflow'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Plane Metadata Timestamps Section */}
                  <div className="pt-3 space-y-1.5 text-xs pl-2 text-muted-foreground">
                    <div className="flex items-center justify-between py-0.5">
                      <span>Created by</span>
                      <span className="font-medium text-foreground">{authorName}</span>
                    </div>

                    {createdAtFormatted && (
                      <div className="flex items-center justify-between py-0.5">
                        <span>Created on</span>
                        <span className="text-foreground">{createdAtFormatted}</span>
                      </div>
                    )}

                    {updatedAtFormatted && (
                      <div className="flex items-center justify-between py-0.5">
                        <span>Updated on</span>
                        <span className="text-foreground">{updatedAtFormatted}</span>
                      </div>
                    )}

                    {completedAtFormatted && (
                      <div className="flex items-center justify-between py-0.5">
                        <span>Completed on</span>
                        <span className="text-foreground font-medium text-emerald-600 dark:text-emerald-400">
                          {completedAtFormatted}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Sub-items Section */}
            <div className="space-y-2.5 pt-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-foreground tracking-tight flex items-center gap-2">
                  <GitBranch className="size-4 shrink-0 text-muted-foreground" />
                  <span>
                    Sub-items ({subItems.filter((s: any) => s.completed || s.stateGroup === 'completed' || s.state?.group === 'completed' || s.columnId === 'done').length}/{subItems.length})
                  </span>
                </label>
                {subItems.length > 0 && (
                  <span className="text-xs font-semibold text-muted-foreground tabular-nums">
                    {progressRollup}% done
                  </span>
                )}
              </div>

              {/* Progress Bar */}
              {subItems.length > 0 && (
                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                    style={{ width: `${progressRollup}%` }}
                  />
                </div>
              )}

              {/* Sub-items List */}
              {subItems.length > 0 && (
                <div className="divide-y divide-border rounded-md border border-border bg-background overflow-hidden">
                  {subItems.map((sub: any, sIdx: number) => {
                    const isSubDone = Boolean(sub.completed || sub.stateGroup === 'completed' || sub.state?.group === 'completed' || sub.columnId === 'done');
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
                                  completed: nextCompleted,
                                  columnId: nextColumnId,
                                });
                              }
                            }}
                            className={cn(
                              'size-4 rounded-md border flex items-center justify-center transition-colors cursor-pointer',
                              isSubDone ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-border hover:border-primary'
                            )}
                          >
                            {isSubDone && <Check className="size-3 shrink-0" />}
                          </button>
                          <span className={cn("font-medium text-xs", isSubDone ? 'line-through text-muted-foreground' : 'text-foreground')}>
                            {sub.title}
                          </span>
                        </div>

                        {!isReadOnly && (
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={() => handleConvertSubItem(sub, sIdx)}
                              className="hover:text-primary p-1 text-muted-foreground cursor-pointer transition-colors rounded-md hover:bg-muted"
                              title="Convert to independent work item"
                            >
                              <ArrowUpRight className="size-3.5 shrink-0" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const updated = subItems.filter((_, i) => i !== sIdx);
                                setSubItems(updated);
                                if (sub.id && !String(sub.id).startsWith('sub_')) {
                                  deleteSubItemMutation.mutate({ id: sub.id });
                                }
                              }}
                              className="hover:text-red-500 p-1 text-muted-foreground cursor-pointer transition-colors rounded-md hover:bg-muted"
                              title="Delete sub-item"
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
                    className="h-8 text-xs"
                  />
                  {newSubItemTitle.trim() && (
                    <Button type="submit" size="sm" className="h-8 text-xs shrink-0 px-3">
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
                const updated = [...relations, newRel];
                setRelations(updated);
                const target = newRel.targetId || newRel.targetWorkItemId;
                if (workItemId && target) {
                  addRelationMutation.mutate({
                    id: workItemId,
                    itemId: workItemId,
                    workItemId,
                    type: newRel.type,
                    targetId: target,
                    targetWorkItemId: target,
                  });
                } else {
                  onSave({ ...currentPayload, relations: updated });
                }
              }}
              onRemoveRelation={(relId, targetItemId) => {
                const updated = relations.filter((r) => r.id !== relId);
                setRelations(updated);
                if (workItemId) {
                  removeRelationMutation.mutate({
                    id: workItemId,
                    itemId: workItemId,
                    workItemId,
                    relationId: relId,
                    targetId: targetItemId,
                    targetWorkItemId: targetItemId,
                  });
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

            {/* Progress Briefings / Status Updates Section */}
            {workItemId && (
              <Updates
                workItemId={workItemId}
                projectId={currentProjectId}
                isReadOnly={isReadOnly}
              />
            )}

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
                commentFocusToken={commentFocusToken}
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

export const WorkItemDetailModal = DetailModal;
export default DetailModal;
