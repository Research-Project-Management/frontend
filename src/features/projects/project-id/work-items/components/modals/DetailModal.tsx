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
  Bell,
  BellOff,
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
} from "./Popovers";
import { Relations } from "./Relations";

function resolveAssigneeId(assignee?: any): string | null {
  if (!assignee) return null;
  if (typeof assignee === "string") return assignee;
  return assignee.id ?? null;
}

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

export type DetailModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: Partial<Item>;
  card?: Partial<Item>;
  columns: Column[];
  project?: Project;
  members?: ProjectMember[];
  availableItems?: Item[];
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
  const projectLabels = useMemo(() => {
    if (Array.isArray(rawLabels)) return rawLabels;
    if (Array.isArray((rawLabels as any)?.labels)) return (rawLabels as any).labels;
    return [];
  }, [rawLabels]);
  const firstColumnId = resolveStateId(columns[0]);
  const projectModules: string[] = (project as any)?.modules ?? ['work-items', 'cycles', 'views', 'pages'];

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
  const [commentText, setCommentText] = useState("");
  const [showDetailActivity, setShowDetailActivity] = useState(false);
  const [showDescriptionActions, setShowDescriptionActions] = useState(false);
  const descriptionDraftRef = useRef("");
  const commentTextareaRef = useRef<HTMLTextAreaElement>(null);
  const dialogScrollRef = useRef<HTMLDivElement>(null);
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
  const [openAttachmentPopover, setOpenAttachmentPopover] = useState(false);
  const [dragActive, setDragActive] = useState(false);

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

  const handleConvertSubItem = async (sub: any, sIdx: number) => {
    try {
      await convertSubItemToRoot.mutateAsync({ id: sub.id, itemId: sub.id, workItemId: sub.id });
      const updated = subItems.filter((_, i) => i !== sIdx);
      setSubItems(updated);
    } catch {}
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
      setLabels(ItemHelpers.uniqueLabels(card.labels));
      setDueDate(card.dueDate || "");
      setStartDate(card.startDate || "");
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

  // Sub-item quick actions
  const handleAddSubItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubItemTitle.trim()) return;
    const title = newSubItemTitle.trim();
    setNewSubItemTitle("");

    if (workItemId) {
      try {
        const res: any = await createSubItemMutation.mutateAsync({
          id: workItemId,
          itemId: workItemId,
          workItemId: workItemId,
          title,
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
      } catch {
        // Error toast handled by mutation
      }
    } else {
      const newSub: SubItem = {
        id: `sub_${Date.now()}`,
        title,
        completed: false,
        columnId: defaultUnstartedColumnId,
        rank: subItems.length,
      };
      setSubItems((prev) => [...prev, newSub]);
      notifySubItemAdded();
    }
  };

  // AI Appends
  const handleAiAppendSubItems = async (newItems: Array<{ title: string; completed: boolean }>) => {
    if (workItemId) {
      try {
        const results = await Promise.all(
          newItems.map((item) =>
            createSubItemMutation.mutateAsync({
              id: workItemId,
              itemId: workItemId,
              workItemId: workItemId,
              title: item.title,
              columnId: defaultUnstartedColumnId,
            })
          )
        );
        const createdSubs: SubItem[] = results.map((res: any) => {
          const t = res?.subItem || res?.workItem || res?.item || res;
          return {
            id: t.id,
            title: t.title,
            identifier: t.identifier,
            columnId: t.columnId || defaultUnstartedColumnId,
            completed: t.completed || false,
            rank: t.rank || 0,
            assigneeId: t.assigneeId || null,
            assignee: t.assignee || null,
            dueDate: t.dueDate || null,
          };
        });
        setSubItems((prev) => [...prev, ...createdSubs]);
      } catch {
        // Handled
      }
    } else {
      const createdSubs: SubItem[] = newItems.map((item: any, idx: number) => ({
        id: `sub_${Date.now()}_${idx}`,
        title: item.title,
        completed: item.completed,
        columnId: defaultUnstartedColumnId,
        rank: subItems.length + idx,
      }));
      setSubItems((prev) => [...prev, ...createdSubs]);
    }
  };

  const handleAiAppendCriteria = (criteriaItems: string[]) => {
    const criteriaMarkdown = `\n\n### Acceptance Criteria\n${criteriaItems.map((crit) => `- [ ] ${crit}`).join('\n')}`;
    const newDesc = (description || '') + criteriaMarkdown;
    setDescription(newDesc);
    descriptionDraftRef.current = newDesc;
    safeSave({ ...currentPayload, description: newDesc, content: newDesc });
  };

  // Attach Center Actions (Pages, Papers, Files, Links)
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
    } catch {
      // Error toast already handled by uploadFilesWithToast
    }
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

  // Compact Pill Button Class
  const actionBtnClass =
    'h-7 px-2.5 text-12 font-medium rounded-md bg-background hover:bg-muted text-foreground border border-border shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer shrink-0';

  const renderStatusSelector = () => {
    const activeCol = columns.find((c) => resolveColumnId(c) === columnId);
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild disabled={isReadOnly}>
          <button
            type="button"
            className={cn(
              'h-7 px-2.5 text-12 font-medium rounded-md bg-background hover:bg-muted text-foreground border border-border shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 outline-none',
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

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent
        ref={dialogScrollRef}
        showCloseButton={false}
        className="w-[94vw] max-w-[900px] sm:max-w-[900px] max-h-[85vh] p-0 border border-border rounded-md overflow-hidden flex flex-col bg-background text-foreground duration-150"
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
              <span>{card?.identifier ? card.identifier : "Work Item Detail"}</span>
              {isArchived && (
                <span className="px-1.5 py-0.5 rounded-md text-10 font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
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
                    {currentUserId && workItemId && (
                      <DropdownMenuItem
                        onClick={handleToggleSubscribe}
                        className="rounded-md py-1.5 text-xs text-foreground cursor-pointer"
                      >
                        {isSubscribed ? (
                          <BellOff className="mr-2 size-3.5 shrink-0 text-foreground" />
                        ) : (
                          <Bell className="mr-2 size-3.5 shrink-0 text-foreground" />
                        )}
                        <span>{isSubscribed ? "Unsubscribe from updates" : "Subscribe to updates"}</span>
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
                    className="font-mono text-11 font-semibold text-muted-foreground hover:text-foreground px-2 py-0.5 rounded-md border border-border bg-background hover:bg-muted shadow-2xs transition-colors cursor-pointer flex items-center gap-1 shrink-0"
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
                  {subItems.length > 0 && (
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
                    {(selectedMembers.length > 0 || selectedLabelsList.length > 0 || dueDate || startDate) && (
                      <div className="flex flex-wrap items-center gap-1 pt-0.5">
                        {selectedMembers.map((member) => (
                          <div
                            key={member.id}
                            className="flex items-center gap-1 bg-muted rounded-md px-1.5 py-0.5 text-10 font-medium text-foreground border border-border"
                          >
                            <Avatar className="size-3.5 shrink-0">
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
                                <X className="size-2.5 shrink-0" />
                              </button>
                            )}
                          </div>
                        ))}

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
                            <Clock className="size-3 shrink-0 text-foreground" />
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



                        <Popover open={openAttachmentPopover} onOpenChange={setOpenAttachmentPopover}>
                          <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className={actionBtnClass}>
                              <Paperclip className="size-3.5 shrink-0 text-foreground" />
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
                    )}
                  </div>

                  {/* Dependencies & Relations */}
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

                  {/* Sub-items Section */}
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between">
                      <label className="text-11 font-semibold text-muted-foreground tracking-normal flex items-center gap-1.5">
                        <GitBranch className="size-3.5 shrink-0" />
                        <span>Sub-items ({subItems.filter((s: any) => s.completed || s.stateGroup === 'completed' || s.state?.group === 'completed' || s.columnId === 'done').length}/{subItems.length})</span>
                      </label>
                    </div>

                    {subItems.length > 0 && (
                      <div className="divide-y divide-border rounded-md border border-border bg-background overflow-hidden">
                        {subItems.map((sub: any, sIdx: number) => {
                          const isSubDone = Boolean(sub.completed || sub.stateGroup === 'completed' || sub.state?.group === 'completed' || sub.columnId === 'done');
                          return (
                            <div key={sub.id || sIdx} className="flex items-center justify-between px-2.5 py-1.5 text-xs hover:bg-muted transition-colors group">
                              <div className="flex items-center gap-2 min-w-0 flex-1">
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
                                    'size-3.5 rounded-md border flex items-center justify-center transition-colors cursor-pointer',
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
                                    onClick={() => handleConvertSubItem(sub, sIdx)}
                                    className="hover:text-primary p-0.5 text-foreground cursor-pointer transition-colors"
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
                                    className="hover:text-red-500 p-0.5 text-foreground cursor-pointer transition-colors"
                                    title="Delete sub-item"
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
                      <form onSubmit={handleAddSubItem} className="flex items-center gap-1.5">
                        <Input
                          value={newSubItemTitle}
                          onChange={(e) => setNewSubItemTitle(e.target.value)}
                          placeholder="+ Add sub-item..."
                          className="h-7 text-xs"
                        />
                        {newSubItemTitle.trim() && (
                          <Button type="submit" size="sm" className="h-7 text-xs shrink-0 px-2.5">
                            Add
                          </Button>
                        )}
                      </form>
                    )}
                  </div>

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
                </div>

                {/* Right Column: Compact Activities & Comments Timeline */}
                <div className="border-t lg:border-t-0 lg:border-l border-border pt-4 lg:pt-0 lg:pl-5 sticky top-0">
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
      </DialogContent>
    </Dialog>
  );
}

export const WorkItemDetailModal = DetailModal;
export default DetailModal;
