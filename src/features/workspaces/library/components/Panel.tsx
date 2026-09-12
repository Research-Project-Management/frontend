'use client';

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  Info,
  AlignLeft,
  Paperclip,
  StickyNote,
  FolderTree,
  Folder,
  FolderPlus,
  Tag,
  Network,
  Quote,
  ChevronDown,
  Plus,
  PanelRight,
  X,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/shared/components/ui";
import dynamic from 'next/dynamic';
import InfoSection from './panel/InfoSection';
import AbstractSection from './panel/AbstractSection';
import CollectionsSection from './panel/CollectionsSection';
import NotesSection from './panel/NotesSection';
import TagsSection from './panel/TagsSection';
import CiteSection from './panel/CiteSection';
import RelatedSection from './panel/RelatedSection';

const AttachmentsSection = dynamic(() => import('./panel/AttachmentsSection'), {
  ssr: false,
});
import CreateCollectionModal from './modals/CreateCollectionModal';
import { useItems as usePapers } from '../hooks/use-items';
import { ItemService } from '../services/item.service';
import { useCollections } from '../hooks/use-collections';
import { useAttachments } from '../hooks/use-attachments';
import { useNotes } from '../hooks/use-notes';
import { useRelations } from '../hooks/use-relations';
import { useLibrarySidebarStore, type InspectorSectionId } from '../store/sidebar.store';
import { normalizeNotes, normalizeTags, convertToBibTeX, getPaperFileUrl } from '../utils/library.util';
import { ALL_ITEM_TYPES_FLAT } from '../schemas/item-type.schema';
import { cn } from "@/shared/lib/utils";
import { uploadLibraryFile } from '../services/upload.service';
import { toast } from 'sonner';
import { copyToClipboard } from "@/shared/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/components/ui";
import { apiPost, apiDelete } from "@/shared/lib/api";
import { useQueryClient } from '@tanstack/react-query';
import DeleteModal, { type DeleteModalConfig } from './modals/DeleteModal';
import type { Item, Collection, CollectionInput } from '../types/library.types';

export interface InspectorPanelProps {
  paper?: Item | null;
  item?: Item | null;
  collection?: Collection | null;
  workspaceId: string;
  onClose?: () => void;
}

export type SectionId = InspectorSectionId;

interface SectionDefinition {
  id: SectionId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}


const SECTIONS_CONFIG: SectionDefinition[] = [
  { id: 'info', label: 'Info', icon: Info },
  { id: 'abstract', label: 'Abstract', icon: AlignLeft },
  { id: 'files', label: 'Attachments', icon: Paperclip },
  { id: 'notes', label: 'Notes', icon: StickyNote },
  { id: 'collections', label: 'Libraries and Collections', icon: FolderTree },
  { id: 'tags', label: 'Tags', icon: Tag },
  { id: 'relations', label: 'Related', icon: Network },
  { id: 'cite', label: 'Citation', icon: Quote },
];

const DEFAULT_COLLAPSED_SECTIONS: Record<SectionId, boolean> = {
  info: false, // Mặc định mở khi mở panel lần đầu tiên
  abstract: true,
  files: true,
  notes: true,
  collections: true, // Mặc định đóng theo yêu cầu của user
  tags: true,
  relations: true,
  cite: true,
};

interface InspectorSectionHeaderProps {
  id: SectionId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  count?: number;
  isOpen: boolean;
  hasAdd?: boolean;
  paper: Item | null;
  onToggle: (id: SectionId) => void;
  onAdd?: (id: SectionId, e: React.MouseEvent) => void;
  customAddAction?: React.ReactNode;
}

function InspectorSectionHeader({
  id,
  label,
  icon: Icon,
  count,
  isOpen,
  hasAdd = false,
  paper,
  onToggle,
  onAdd,
  customAddAction,
}: InspectorSectionHeaderProps) {
  return (
    <div
      onClick={() => onToggle(id)}
      className={cn(
        "flex h-9 w-full items-center justify-between px-3 text-foreground select-none group bg-background",
        paper && !isOpen ? "hover:bg-muted cursor-pointer" : "cursor-default"
      )}
    >
      <div className="flex items-center gap-1.5 min-w-0 flex-1 mr-2">
        <div className="size-4 shrink-0 flex items-center justify-center">
          <Icon className="size-4 text-foreground shrink-0" />
        </div>
        <span className="truncate text-13 text-foreground font-sans font-medium tracking-tight">
          {label}{count !== undefined && count > 0 && <span className="text-11 font-normal text-muted-foreground font-mono tabular-nums ml-1">({count})</span>}
        </span>
      </div>

      <div className="flex items-center gap-0.5 shrink-0">
        {customAddAction ? (
          customAddAction
        ) : hasAdd ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (paper) {
                    onAdd?.(id, e);
                  }
                }}
                className="size-6 rounded-md flex items-center justify-center text-foreground hover:bg-muted outline-none focus-visible:ring-1 focus-visible:ring-primary cursor-pointer"
                aria-label={`Add ${label}`}
              >
                <Plus className="size-3.5 text-foreground shrink-0" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="left">Add {label}</TooltipContent>
          </Tooltip>
        ) : null}

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggle(id);
              }}
              className="size-6 rounded-md flex items-center justify-center text-foreground hover:bg-muted outline-none focus-visible:ring-1 focus-visible:ring-primary cursor-pointer"
              aria-label={isOpen ? `Collapse ${label}` : `Expand ${label}`}
            >
              <ChevronDown
                className={cn(
                  "size-3.5 text-foreground shrink-0",
                  paper && isOpen && "rotate-180"
                )}
              />
            </button>
          </TooltipTrigger>
          <TooltipContent side="left">{isOpen ? `Collapse ${label}` : `Expand ${label}`}</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

function InspectorTitleInput({
  title,
  onSave,
}: {
  title: string;
  onSave: (val: string) => void;
}) {
  const [draft, setDraft] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(title);
  }, [title]);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== title) {
      onSave(trimmed);
    } else if (!trimmed && title) {
      setDraft(title);
    }
  };

  return (
    <input
      ref={inputRef}
      value={draft}
      aria-label="Reference title"
      title={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          commit();
          inputRef.current?.blur();
        } else if (e.key === 'Escape') {
          setDraft(title);
          inputRef.current?.blur();
        }
      }}
      className="w-full text-13 font-medium text-foreground tracking-tight bg-transparent px-2 py-1 rounded-md border border-transparent focus:border-primary focus:ring-1 focus:ring-primary outline-none truncate font-sans"
    />
  );
}

export default function InspectorPanel({
  paper: propPaper,
  item: propItem,
  collection,
  workspaceId,
  onClose,
}: InspectorPanelProps) {
  const incomingPaper = propPaper || propItem || null;
  const activeWorkspaceId = incomingPaper?.workspaceId || workspaceId || '';
  const [paper, setPaper] = useState<Item | null>(incomingPaper);
  const latestPaperRef = useRef<Item | null>(incomingPaper);
  const updateQueueRef = useRef<Promise<void>>(Promise.resolve());
  const paperService = usePapers({ workspaceId: activeWorkspaceId });
  const collectionsState = useCollections(activeWorkspaceId);
  const collections = collectionsState?.state?.collections || [];
  const { notes: canonicalNotes, deleteNote } = useNotes(activeWorkspaceId, paper?.id);

  const {
    isInspectorOpen,
    setIsInspectorOpen,
    inspectorWidth,
    setInspectorWidth,
    activeInspectorTab,
    setActiveInspectorTab,
  } = useLibrarySidebarStore();

  const [collapsedSections, setCollapsedSections] = useState<Record<SectionId, boolean>>(DEFAULT_COLLAPSED_SECTIONS);

  const isSectionVisible = (sectionId: SectionId) => !collapsedSections[sectionId];

  const [activeSectionId, setActiveSectionId] = useState<SectionId>('info');
  const [isAddRelatedOpen, setIsAddRelatedOpen] = useState(false);
  const [isCreateCollectionOpen, setIsCreateCollectionOpen] = useState(false);
  const [forceAddingNote, setForceAddingNote] = useState(false);
  const [forceAddingTag, setForceAddingTag] = useState(false);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [isPaperVerified, setIsPaperVerified] = useState(false);
  const [deleteModalConfig, setDeleteModalConfig] = useState<DeleteModalConfig | null>(null);
  const attachFileInputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const verifiedPaperId = isPaperVerified ? paper?.id || '' : '';
  const { add: addAttachment } = useAttachments(activeWorkspaceId, verifiedPaperId);

  // Table rows can be stale after another mutation. Keep the panel on the
  // newest server version so optimistic locking never reuses an old version.
  useEffect(() => {
    if (!incomingPaper) {
      latestPaperRef.current = null;
      setPaper(null);
      return;
    }

    setPaper((current) => {
      const shouldReplace =
        !current ||
        current.id !== incomingPaper.id ||
        (incomingPaper.version ?? -1) >= (current.version ?? -1);
      const next = shouldReplace ? incomingPaper : current;
      latestPaperRef.current = next;
      return next;
    });
  }, [incomingPaper]);

  useEffect(() => {
    if (!incomingPaper?.id || !activeWorkspaceId) return;

    setIsPaperVerified(false);
    let cancelled = false;
    void ItemService.getById(activeWorkspaceId, incomingPaper.id)
      .then((response) => {
        if (cancelled) return;
        const latest = response;
        if (!latest?.id) return;

        setPaper((current) => {
          if (current && current.id === latest.id && (current.version ?? -1) > (latest.version ?? -1)) {
            return current;
          }
          latestPaperRef.current = latest;
          return latest;
        });
        setIsPaperVerified(latest.id === incomingPaper.id);
      })
      .catch((error: any) => {
        setIsPaperVerified(false);
        if (error?.statusCode === 404 && !cancelled) {
          onClose?.();
        }
        // The item already rendered from the table remains usable; mutations
        // surface their own actionable errors through the existing toast.
      });

    return () => {
      cancelled = true;
    };
  }, [incomingPaper?.id, activeWorkspaceId, onClose]);

  // Nếu user chưa chọn paper nào, panel không tự động mở và tự động đóng nếu đang mở
  useEffect(() => {
    if (!paper && isInspectorOpen) {
      setIsInspectorOpen(false);
    }
  }, [paper, isInspectorOpen, setIsInspectorOpen]);

  // Khi chọn hoặc đổi paper, đảm bảo section info luôn được mở mặc định
  useEffect(() => {
    if (paper?.id) {
      setCollapsedSections((prev) => ({
        ...prev,
        info: false,
      }));
    }
  }, [paper?.id]);

  // Resize Dragging
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(inspectorWidth);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);
      startXRef.current = e.clientX;
      startWidthRef.current = inspectorWidth;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [inspectorWidth]
  );

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = startXRef.current - e.clientX;
      const maxAllowed = typeof window !== 'undefined' ? Math.min(960, Math.round(window.innerWidth * 0.7)) : 800;
      const clamped = Math.max(280, Math.min(maxAllowed, startWidthRef.current + deltaX));
      setInspectorWidth(clamped);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging, setInspectorWidth]);

  const isSectionOpen = (sectionId: SectionId) => {
    return collapsedSections[sectionId] === false;
  };

  const toggleSection = (sectionId: SectionId) => {
    if (!paper) return; // Trạng thái rỗng: click lên xuống không có gì xảy ra
    setCollapsedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  const handleAttachFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !paper || !paper.id) return;

    try {
      setIsUploadingAttachment(true);
      const { url: fileUrl, fileId } = await uploadLibraryFile(activeWorkspaceId, file);

      await addAttachment({
        filename: file.name,
        url: fileUrl,
        fileId: fileId || undefined,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
      });

      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      if (!paper.fileUrl && isPdf) {
        handleUpdatePaper({
          fileUrl,
          filename: file.name,
        });
      }

      queryClient.invalidateQueries({ queryKey: ['items'] });
      queryClient.invalidateQueries({ queryKey: ['attachments', paper.id] });
    } catch {
      // Toast notifications handled inside addAttachment mutation hook
    } finally {
      setIsUploadingAttachment(false);
      if (attachFileInputRef.current) {
        attachFileInputRef.current.value = '';
      }
    }
  };

  const handleAddClick = (sectionId: SectionId, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!paper) return; // Trạng thái rỗng: không có gì xảy ra

    switch (sectionId) {
      case 'info':
        setCollapsedSections((prev) => ({ ...prev, info: false }));
        break;
      case 'abstract':
        setCollapsedSections((prev) => ({ ...prev, abstract: false }));
        break;
      case 'files':
        // Mở file chooser để đính kèm file
        attachFileInputRef.current?.click();
        break;
      case 'notes':
        setCollapsedSections((prev) => ({ ...prev, notes: false }));
        setForceAddingNote(true);
        break;
      case 'collections':
        setCollapsedSections((prev) => ({ ...prev, collections: false }));
        setIsCreateCollectionOpen(true);
        break;
      case 'tags':
        setCollapsedSections((prev) => ({ ...prev, tags: false }));
        setForceAddingTag(false);
        setTimeout(() => setForceAddingTag(true), 10);
        break;
      case 'relations':
        setCollapsedSections((prev) => ({ ...prev, relations: false }));
        setIsAddRelatedOpen(true);
        break;
      case 'cite':
        setCollapsedSections((prev) => ({ ...prev, cite: false }));
        handleCopyCitation();
        break;
    }
  };

  const handleUpdatePaper = (data: Partial<Item>) => {
    const requestedItemId = latestPaperRef.current?.id;
    if (!requestedItemId) return;

    updateQueueRef.current = updateQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        const currentPaper = latestPaperRef.current;
        if (!currentPaper?.id || currentPaper.id !== requestedItemId) return;

        // Type conversion already returns the persisted item. Do not issue a
        // second update that would increment its version again.
        if ((data as any).id === currentPaper.id && (data as any).version !== undefined) {
          latestPaperRef.current = { ...currentPaper, ...data };
          setPaper((current) =>
            current?.id === currentPaper.id ? { ...current, ...data } : current,
          );
          return;
        }

        const result = await paperService.actions.updatePaper({
          paperId: currentPaper.id,
          ...data,
          expectedVersion: currentPaper.version,
        });
        const response = (result as any)?.res ?? result;
        const updated = response?.item || response?.paper || response;
        if (!updated?.id) return;

        latestPaperRef.current = { ...currentPaper, ...updated };
        setPaper((current) =>
          current?.id === updated.id ? { ...current, ...updated } : current,
        );
      })
      .catch(async () => {
        const currentPaper = latestPaperRef.current;
        if (!currentPaper?.id || currentPaper.id !== requestedItemId || !activeWorkspaceId) return;

        try {
          const response = await ItemService.getById(activeWorkspaceId, currentPaper.id);
          const latest = response;
          if (!latest?.id) return;
          latestPaperRef.current = latest;
          setPaper((current) =>
            current?.id === latest.id ? latest : current,
          );
        } catch {
          // The mutation hook already reports the original error to the user.
        }
      });
  };


  const handleCreateCollectionSubmit = async (data: CollectionInput) => {
    if (!collectionsState) return;
    try {
      const rawParent = data.parentId ?? data.parent ?? null;
      const cleanParentId = rawParent === 'root' || !rawParent ? null : rawParent;
      const res = await collectionsState.actions.createAsync({
        name: data.name?.trim() || 'Untitled',
        description: data.description?.trim() || '',
        color: data.color || '#2563eb',
        icon: data.icon || '',
        parentId: cleanParentId,
      });
      setIsCreateCollectionOpen(false);
      const resData = res as unknown as { collection?: { id?: string }; id?: string };
      const newColId = resData?.collection?.id || resData?.id;
      if (paper?.id && newColId) {
        handleUpdatePaper({ collectionId: newColId });
      }
    } catch {
      // Error handled with toast in useCollections
    }
  };

  const handleCopyCitation = async () => {
    if (!paper) return;
    const bib = convertToBibTeX(paper);
    const ok = await copyToClipboard(bib);
    if (ok) {
      toast.success('BibTeX citation copied to clipboard', { id: 'library-clipboard' });
    } else {
      toast.error('Failed to copy to clipboard', { id: 'library-clipboard' });
    }
  };

  // Section Counts
  const filesCount = useMemo(() => {
    if (!paper) return 0;
    const paperUrl = getPaperFileUrl(paper);
    const rawAttachments = Array.isArray(paper.attachments) ? paper.attachments : [];
    const otherAtts = rawAttachments.filter((att: Record<string, unknown>) => {
      const attUrl = att.fileUrl || att.url;
      if (paperUrl && attUrl && attUrl === paperUrl) return false;
      if (att.attachmentType === 'primary_pdf' || att.type === 'primary_pdf') return false;
      if (paper.filename && (att.filename === paper.filename || att.name === paper.filename)) return false;
      return true;
    });
    return (paperUrl ? 1 : 0) + otherAtts.length;
  }, [paper]);

  const notesCount = useMemo(() => {
    if (canonicalNotes && canonicalNotes.length > 0) return canonicalNotes.length;
    return normalizeNotes(paper?.notes).length;
  }, [canonicalNotes, paper?.notes]);

  const tagsList = useMemo(() => normalizeTags(paper), [paper]);
  const tagsCount = tagsList.length;

  const { total: relationsTotal } = useRelations(workspaceId, verifiedPaperId);
  const relationsCount = relationsTotal || 0;

  const itemTypeLabel = useMemo(() => {
    if (!paper?.itemType) return 'Journal Article';
    const found = ALL_ITEM_TYPES_FLAT.find((t) => t.value === paper.itemType);
    return found?.label || paper.itemType;
  }, [paper?.itemType]);

  const handleSectionIconClick = (sectionId: SectionId) => {
    if (!paper) return;

    setActiveSectionId(sectionId);
    setActiveInspectorTab(sectionId);

    // If panel is closed: open it and ensure section is expanded & visible
    if (!isInspectorOpen) {
      setIsInspectorOpen(true);
      setCollapsedSections((prev) => ({ ...prev, [sectionId]: false }));
      setTimeout(() => {
        const el = document.getElementById(`inspector-section-${sectionId}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 80);
      return;
    }

    // If panel is already open: toggle collapsed state
    const isCurrentlyOpen = !collapsedSections[sectionId];
    setCollapsedSections((prev) => ({ ...prev, [sectionId]: isCurrentlyOpen }));

    if (!isCurrentlyOpen) {
      setTimeout(() => {
        const el = document.getElementById(`inspector-section-${sectionId}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 50);
    }
  };

  return (
    <div className="flex h-full shrink-0 select-none font-sans z-10">
      {/* ── Left Part: Collapsible Resizable Inspector Drawer ───────────────── */}
      {isInspectorOpen && (
        <>
          {/* Mobile Backdrop Overlay */}
          <div
            className="fixed inset-0 z-40 bg-black/30 md:hidden"
            onClick={() => setIsInspectorOpen(false)}
            aria-hidden="true"
          />

          <aside
            aria-label="Document inspector"
            style={{
              width: `${inspectorWidth}px`,
              maxWidth: '100vw',
            }}
            className="fixed inset-y-0 right-0 z-50 md:static md:z-auto shrink-0 flex flex-col h-full border-l border-border bg-background select-none shadow-none max-w-full sm:max-w-[480px]"
          >
            {/* Resizer Handle (desktop only) */}
            <div
              role="separator"
              aria-orientation="vertical"
              onMouseDown={handleMouseDown}
              onDoubleClick={() => setInspectorWidth(360)}
              className="hidden md:flex absolute top-0 left-0 w-1.5 h-full cursor-col-resize hover:bg-primary/40 z-30 select-none group items-center justify-center -translate-x-1/2"
              title="Drag to resize inspector (double-click to reset)"
            >
              <div
                className={cn(
                  "w-0.5 h-8 rounded-full",
                  isDragging ? "bg-primary" : "bg-transparent group-hover:bg-foreground/20"
                )}
              />
            </div>

            {paper ? (
              <header className="h-11 px-3 border-b border-border bg-background flex items-center justify-between gap-2 shrink-0 select-none">
                {/* Paper Title at the top */}
                <div className="flex-1 min-w-0">
                  <InspectorTitleInput
                    title={paper.title || 'Untitled Reference'}
                    onSave={(newTitle) => handleUpdatePaper({ title: newTitle })}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setIsInspectorOpen(false)}
                  className="md:hidden p-1.5 rounded-md text-foreground hover:bg-muted cursor-pointer"
                  aria-label="Close inspector"
                >
                  <X className="size-4 shrink-0 text-foreground" />
                </button>
              </header>
            ) : (
              /* Clean h-11 Header when no paper is selected */
              <header className="h-11 px-3 border-b border-border bg-background flex items-center justify-end shrink-0 select-none">
                <button
                  type="button"
                  onClick={() => setIsInspectorOpen(false)}
                  className="md:hidden p-1.5 rounded-md text-foreground hover:bg-muted cursor-pointer"
                  aria-label="Close inspector"
                >
                  <X className="size-4 shrink-0 text-foreground" />
                </button>
              </header>
            )}

          {/* Continuous Scrollable Section Accordion Body (always rendered, never hidden by empty screen) */}
          <div
            ref={scrollContainerRef}
            tabIndex={0}
            role="region"
            aria-label="Reference details sections"
            className="flex-1 overflow-y-auto min-w-0 focus-visible:outline-none thin-scrollbar bg-background divide-y divide-border/50"
          >
            {/* 1. Info Section (No Plus) */}
            {isSectionVisible('info') && (
              <div id="inspector-section-info" className="bg-background">
                <InspectorSectionHeader
                  id="info"
                  label="Info"
                  icon={Info}
                  isOpen={isSectionOpen('info')}
                  hasAdd={false}
                  paper={paper}
                  onToggle={toggleSection}
                  onAdd={handleAddClick}
                />
                {paper && isSectionOpen('info') && (
                  <div className="p-1 bg-background">
                    <InfoSection paper={paper} onUpdatePaper={handleUpdatePaper} />
                  </div>
                )}
              </div>
            )}

            {/* 2. Abstract Section */}
            {isSectionVisible('abstract') && (
              <div id="inspector-section-abstract" className="bg-background">
                <InspectorSectionHeader
                  id="abstract"
                  label="Abstract"
                  icon={AlignLeft}
                  isOpen={isSectionOpen('abstract')}
                  hasAdd={false}
                  paper={paper}
                  onToggle={toggleSection}
                  onAdd={handleAddClick}
                />
                {paper && isSectionOpen('abstract') && (
                  <div className="p-2 bg-background">
                    <AbstractSection paper={paper} onUpdatePaper={handleUpdatePaper} hideHeader />
                  </div>
                )}
              </div>
            )}

            {/* 3. Attachments / Files Section */}
            {isSectionVisible('files') && (
              <div id="inspector-section-files" className="bg-background">
                <InspectorSectionHeader
                  id="files"
                  label="Attachments"
                  icon={Paperclip}
                  count={filesCount}
                  isOpen={isSectionOpen('files')}
                  hasAdd={true}
                  paper={paper}
                  onToggle={toggleSection}
                  onAdd={handleAddClick}
                />
                {paper && isSectionOpen('files') && filesCount > 0 && (
                  <div className="p-2 bg-background">
                    <AttachmentsSection
                      paper={paper}
                      workspaceId={workspaceId}
                      onAddAttachment={() => attachFileInputRef.current?.click()}
                      isUploading={isUploadingAttachment}
                      hideHeader
                    />
                  </div>
                )}
              </div>
            )}

            {/* 4. Notes Section */}
            {isSectionVisible('notes') && (
              <div id="inspector-section-notes" className="bg-background">
                <InspectorSectionHeader
                  id="notes"
                  label="Notes"
                  icon={StickyNote}
                  count={notesCount}
                  isOpen={isSectionOpen('notes')}
                  hasAdd={true}
                  paper={paper}
                  onToggle={toggleSection}
                  onAdd={handleAddClick}
                />
                {paper && isSectionOpen('notes') && (
                  <div className="p-2 bg-background">
                    <NotesSection
                      paper={{ ...paper, workspaceId: activeWorkspaceId }}
                      onUpdatePaper={handleUpdatePaper}
                      hideHeader
                      forceAdding={forceAddingNote}
                      onRequestDelete={(note) => {
                        setDeleteModalConfig({
                          open: true,
                          title: 'Move Note to Trash',
                          description: 'Are you sure you want to move this note to the trash?',
                          itemName: note.content,
                          confirmLabel: 'Move to trash',
                          onConfirm: async () => {
                            if (activeWorkspaceId) {
                              await deleteNote(note.id).catch(() => {});
                            }
                            setDeleteModalConfig(null);
                          },
                        });
                      }}
                    />
                  </div>
                )}
              </div>
            )}

            {/* 5. Collections Section */}
            {isSectionVisible('collections') && (
              <div id="inspector-section-collections" className="bg-background">
                <InspectorSectionHeader
                  id="collections"
                  label="Libraries and Collections"
                  icon={FolderTree}
                  isOpen={isSectionOpen('collections')}
                  paper={paper}
                  onToggle={toggleSection}
                  customAddAction={
                    paper ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            onClick={(e) => e.stopPropagation()}
                            className="size-6 rounded-md flex items-center justify-center text-foreground hover:bg-muted outline-none focus-visible:ring-1 focus-visible:ring-primary cursor-pointer"
                            aria-label="Add to collection"
                          >
                            <Plus className="size-3.5 text-foreground shrink-0" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="w-52 p-1.5 rounded-md border border-border bg-popover text-popover-foreground text-xs font-sans max-h-72 overflow-y-auto"
                        >
                          <DropdownMenuItem
                            onClick={() => {
                              setIsCreateCollectionOpen(true);
                            }}
                            className="flex items-center gap-2 cursor-pointer py-1.5 px-2 rounded-md hover:bg-muted text-foreground"
                          >
                            <FolderPlus className="size-3.5 text-foreground shrink-0" />
                            <span>Create Collection</span>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {collections.map((col) => (
                            <DropdownMenuItem
                              key={col.id}
                              onClick={() => {
                                handleUpdatePaper({ collectionId: col.id });
                              }}
                              className="flex items-center gap-2 cursor-pointer py-1.5 px-2 rounded-md hover:bg-muted text-foreground"
                            >
                              <Folder className="size-3.5 text-foreground shrink-0" />
                              <span className="truncate">{col.name}</span>
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : null
                  }
                />
                {paper && isSectionOpen('collections') && (
                  <div className="p-2 bg-background">
                    <CollectionsSection
                      paper={paper}
                      workspaceId={workspaceId}
                      onCreateCollection={() => setIsCreateCollectionOpen(true)}
                      hideHeader
                    />
                  </div>
                )}
              </div>
            )}

            {/* 6. Tags Section */}
            {isSectionVisible('tags') && (
              <div id="inspector-section-tags" className="bg-background">
                <InspectorSectionHeader
                  id="tags"
                  label="Tags"
                  icon={Tag}
                  count={tagsCount}
                  isOpen={isSectionOpen('tags')}
                  hasAdd={true}
                  paper={paper}
                  onToggle={toggleSection}
                  onAdd={handleAddClick}
                />
                {paper && isSectionOpen('tags') && (
                  <div className="p-2 bg-background">
                    <TagsSection
                      paper={paper}
                      onUpdatePaper={handleUpdatePaper}
                      hideHeader
                      forceAdding={forceAddingTag}
                      onCancelAdding={() => setForceAddingTag(false)}
                    />
                  </div>
                )}
              </div>
            )}

            {/* 7. Related Papers Section */}
            {isSectionVisible('relations') && (
              <div id="inspector-section-relations" className="bg-background">
                <InspectorSectionHeader
                  id="relations"
                  label="Related"
                  icon={Network}
                  count={relationsCount}
                  isOpen={isSectionOpen('relations')}
                  hasAdd={true}
                  paper={paper}
                  onToggle={toggleSection}
                  onAdd={handleAddClick}
                />
                {paper && isSectionOpen('relations') && relationsCount > 0 && (
                  <div className="p-2 bg-background">
                    <RelatedSection
                      paper={paper}
                      workspaceId={workspaceId}
                      hideHeader
                      isAddOpen={isAddRelatedOpen}
                      onAddOpenChange={setIsAddRelatedOpen}
                    />
                  </div>
                )}
              </div>
            )}

            {/* 8. Citations Section (No Plus) */}
            {isSectionVisible('cite') && (
              <div id="inspector-section-cite" className="bg-background">
                <InspectorSectionHeader
                  id="cite"
                  label="Citation"
                  icon={Quote}
                  isOpen={isSectionOpen('cite')}
                  hasAdd={false}
                  paper={paper}
                  onToggle={toggleSection}
                  onAdd={handleAddClick}
                />
                {paper && isSectionOpen('cite') && (
                  <div className="p-1 bg-background">
                    <CiteSection paper={paper} workspaceId={isPaperVerified ? workspaceId : ''} />
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>
        </>
      )}

      {/* ── Right Part: Vertical Icon Panel Bar ─────────────────────────────── */}
      <aside
        aria-label="Inspector panel bar"
        className="w-10 shrink-0 h-full border-l border-border bg-background hidden sm:flex flex-col items-center z-20 select-none"
      >
        {/* Top: Toggle Panel Button Container - EXACTLY h-11 with line cách biên p-1 */}
        <div className="h-11 w-full flex flex-col items-center justify-between shrink-0">
          <div className="flex-1 flex items-center justify-center w-full">
            <button
              type="button"
              onClick={() => {
                if (!paper) return;
                setIsInspectorOpen(!isInspectorOpen);
              }}
              className="size-8 flex items-center justify-center rounded-md outline-none focus-visible:ring-1 focus-visible:ring-primary text-foreground hover:bg-muted cursor-pointer"
              aria-label={isInspectorOpen ? "Collapse panel" : "Expand panel"}
            >
              <PanelRight className="size-4 text-foreground shrink-0" />
            </button>
          </div>

          {/* Line cách biên p-2 (8px mỗi bên), tại đúng vị trí pixel 48 */}
          <div className="w-[calc(100%-16px)] mx-auto h-px bg-border/60 shrink-0" />
        </div>

        {/* Middle: 8 Section Icons - gap-1 and hover:bg-muted only, NO active effect */}
        <div className="flex flex-col items-center gap-1 w-full pt-1 px-1">
          {SECTIONS_CONFIG.map((sec) => {
            const Icon = sec.icon;

            return (
              <button
                key={sec.id}
                type="button"
                onClick={() => handleSectionIconClick(sec.id)}
                className="size-8 flex items-center justify-center rounded-md outline-none focus-visible:ring-1 focus-visible:ring-primary text-foreground hover:bg-muted cursor-pointer"
                aria-label={sec.label}
              >
                <Icon className="size-4 text-foreground shrink-0" />
              </button>
            );
          })}
        </div>

        {/* Clean bottom spacer */}
        <div className="flex-1" />
      </aside>

      {/* Create Collection Dialog Modal */}
      <CreateCollectionModal
        open={isCreateCollectionOpen}
        onOpenChange={setIsCreateCollectionOpen}
        onSubmit={handleCreateCollectionSubmit}
        collections={collections}
        isPending={collectionsState?.state?.isCreating}
      />

      {/* Shared Abstract DeleteModal */}
      {deleteModalConfig && (
        <DeleteModal
          open={deleteModalConfig.open}
          onOpenChange={(open) => {
            if (!open) setDeleteModalConfig(null);
          }}
          title={deleteModalConfig.title}
          description={deleteModalConfig.description}
          itemName={deleteModalConfig.itemName}
          onConfirm={deleteModalConfig.onConfirm}
          isDeleting={deleteModalConfig.isDeleting}
          confirmLabel={deleteModalConfig.confirmLabel}
          cancelLabel={deleteModalConfig.cancelLabel}
          icon={deleteModalConfig.icon}
        />
      )}

      {/* Hidden file input for Attachments + button */}
      <input
        type="file"
        ref={attachFileInputRef}
        onChange={handleAttachFile}
        className="hidden"
        accept="application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,image/*"
      />
    </div>
  );
}
