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
  Landmark,
  Tag,
  Network,
  Quote,
  ChevronDown,
  Plus,
  PanelRight,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '@/shared/components/ui/dropdown-menu';
import InfoSection from './panel/InfoSection';
import AbstractSection from './panel/AbstractSection';
import CollectionsSection from './panel/CollectionsSection';
import NotesSection from './panel/NotesSection';
import TagsSection from './panel/TagsSection';
import CiteSection from './panel/CiteSection';
import AttachmentsSection from './panel/AttachmentsSection';
import RelatedSection from './panel/RelatedSection';
import CreateCollectionModal from './modals/CreateCollectionModal';
import { useItems as usePapers } from '../hooks/library/use-items';
import { useCollections } from '../hooks/library/use-collections';
import { useAttachments } from '../hooks/library/use-attachments';
import { useNotes } from '../hooks/library/use-notes';
import { useRelatedPapers } from '../hooks/library/use-library';
import { useLibraryClipboard } from '../hooks/library/use-clipboard';
import { useLibrarySidebarStore, type InspectorSectionId } from '../store/sidebar.store';
import { normalizeNotes, convertToBibTeX, generateCitationKey, getPaperFileUrl } from '../utils/library.util';
import { ALL_ITEM_TYPES_FLAT } from '../schemas/item-type.schema';
import { cn } from '@/shared/lib/utils';
import { useUpload } from '@/shared/hooks/use-upload';
import { apiPost, apiDelete } from '@/shared/lib/api';
import { useQueryClient } from '@tanstack/react-query';
import DeleteModal, { type DeleteModalConfig } from './modals/DeleteModal';
import type { CatalogItem, Collection } from '../types/library.types';

export interface InspectorPanelProps {
  paper?: CatalogItem | null;
  item?: CatalogItem | null;
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

interface CollectionNode extends Collection {
  children?: CollectionNode[];
}

function buildCollectionTree(items: Collection[]): CollectionNode[] {
  const map = new Map<string, CollectionNode>();
  const roots: CollectionNode[] = [];

  items.forEach((item) => {
    map.set(item.id, { ...item, children: [] });
  });

  items.forEach((item) => {
    const parentId = item.parentId || (item as any).parent;
    if (parentId && map.has(parentId)) {
      map.get(parentId)!.children!.push(map.get(item.id)!);
    } else {
      roots.push(map.get(item.id)!);
    }
  });

  return roots;
}

function renderCollectionMenuItem(
  node: CollectionNode,
  onSelect: (id: string, name: string) => void
) {
  const hasChildren = node.children && node.children.length > 0;

  if (hasChildren) {
    return (
      <DropdownMenuSub key={node.id}>
        <DropdownMenuSubTrigger className="flex items-center gap-2 cursor-pointer py-1.5 px-2 rounded-md hover:bg-accent text-foreground text-xs">
          <Folder className="size-4 text-foreground shrink-0" />
          <span className="truncate flex-1">{node.name}</span>
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent className="w-52 p-1 rounded-md border border-border/70 shadow-md bg-popover text-popover-foreground text-xs font-sans">
          <DropdownMenuItem
            onClick={() => onSelect(node.id, node.name)}
            className="flex items-center gap-2 cursor-pointer py-1.5 px-2 rounded-md hover:bg-accent text-foreground font-medium text-xs"
          >
            <Folder className="size-4 text-foreground shrink-0" />
            <span className="truncate flex-1">{node.name} (Select)</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator className="my-1" />
          {node.children!.map((child) => renderCollectionMenuItem(child, onSelect))}
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    );
  }

  return (
    <DropdownMenuItem
      key={node.id}
      onClick={() => onSelect(node.id, node.name)}
      className="flex items-center gap-2 cursor-pointer py-1.5 px-2 rounded-md hover:bg-accent text-foreground text-xs"
    >
      <Folder className="size-4 text-foreground shrink-0" />
      <span className="truncate flex-1">{node.name}</span>
    </DropdownMenuItem>
  );
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
  paper: CatalogItem | null;
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
        paper && !isOpen ? "hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer" : "cursor-default"
      )}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
        <div className="size-4 shrink-0 flex items-center justify-center">
          <Icon className="size-4 text-foreground shrink-0" />
        </div>
        <span className="truncate text-[13px] text-foreground font-sans font-medium tracking-tight">
          {label}
        </span>
        {count !== undefined && count > 0 && (
          <span className="text-xs font-normal text-foreground font-mono tabular-nums shrink-0 ml-0.5">
            ({count})
          </span>
        )}
      </div>

      <div className="flex items-center gap-0.5 shrink-0">
        {customAddAction ? (
          customAddAction
        ) : hasAdd ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (paper) {
                onAdd?.(id, e);
              }
            }}
            className="size-6 rounded-md flex items-center justify-center text-foreground hover:bg-black/5 dark:hover:bg-white/5 outline-none cursor-pointer"
            aria-label={`Add ${label}`}
          >
            <Plus className="size-3.5 text-foreground shrink-0" />
          </button>
        ) : null}

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggle(id);
          }}
          className="size-6 rounded-md flex items-center justify-center text-foreground hover:bg-black/5 dark:hover:bg-white/5 outline-none cursor-pointer"
          aria-label={isOpen ? `Collapse ${label}` : `Expand ${label}`}
        >
          <ChevronDown
            className={cn(
              "size-3.5 text-foreground shrink-0",
              paper && isOpen && "rotate-180"
            )}
          />
        </button>
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
      className="w-full text-[13px] font-medium text-foreground tracking-tight bg-transparent px-2 py-1 rounded-md border border-transparent focus:border-primary focus:ring-1 focus:ring-primary outline-none truncate font-sans"
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
  const paper = propPaper || propItem || null;
  const targetWsId = paper?.workspaceId || workspaceId || '';
  const paperService = usePapers({ workspaceId: targetWsId });
  const collectionsState = useCollections(targetWsId);
  const collections = collectionsState?.state?.collections || [];
  const { notes: canonicalNotes, deleteNote } = useNotes(targetWsId, paper?.id);

  const {
    isInspectorOpen,
    setIsInspectorOpen,
    inspectorWidth,
    setInspectorWidth,
    activeInspectorTab,
    setActiveInspectorTab,
  } = useLibrarySidebarStore();

  const [collapsedSections, setCollapsedSections] = useState<Record<SectionId, boolean>>(DEFAULT_COLLAPSED_SECTIONS);
  const [visibleSections, setVisibleSections] = useState<Record<SectionId, boolean>>({
    info: true,
    abstract: true,
    files: true,
    notes: true,
    collections: true,
    tags: true,
    relations: true,
    cite: true,
  });

  const isSectionVisible = (sectionId: SectionId) => {
    return visibleSections[sectionId] !== false;
  };

  const [activeSectionId, setActiveSectionId] = useState<SectionId>('info');
  const [isAddRelatedOpen, setIsAddRelatedOpen] = useState(false);
  const [isCreateCollectionOpen, setIsCreateCollectionOpen] = useState(false);
  const [forceAddingNote, setForceAddingNote] = useState(false);
  const [forceAddingTag, setForceAddingTag] = useState(false);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [deleteModalConfig, setDeleteModalConfig] = useState<DeleteModalConfig | null>(null);
  const attachFileInputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { uploadFile, uploadFileDetailed } = useUpload();
  const { copyToClipboard } = useLibraryClipboard();
  const { add: addAttachment } = useAttachments(targetWsId, paper?.id || '');

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
      const { url: fileUrl, fileId } = await uploadFileDetailed(file, {
        prefix: `${workspaceId}/library`,
      });

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

      queryClient.invalidateQueries({ queryKey: ['catalog-items'] });
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

  const paperId = paper?.id;

  const handleUpdatePaper = (data: Partial<CatalogItem>) => {
    if (!paperId) return;
    paperService.actions.updatePaper({
      paperId,
      ...data,
      expectedVersion: paper?.version,
    });
  };


  const handleCreateCollectionSubmit = async (data: any) => {
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
      const newColId = (res as any)?.collection?.id || (res as any)?.id;
      if (paper?.id && newColId) {
        handleUpdatePaper({ collectionId: newColId });
      }
    } catch {
      // Error handled with toast in useCollections
    }
  };

  const handleCopyCitation = () => {
    if (!paper) return;
    const bib = convertToBibTeX(paper);
    copyToClipboard(bib, 'BibTeX citation copied to clipboard');
  };

  // Section Counts
  const filesCount = useMemo(() => {
    if (!paper) return 0;
    const paperUrl = getPaperFileUrl(paper);
    const rawAttachments = Array.isArray(paper.attachments) ? paper.attachments : [];
    const otherAtts = rawAttachments.filter((att: any) => {
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

  const tagsList = useMemo(() => {
    if (!paper) return [];
    const directTags = Array.isArray(paper.tags) ? paper.tags : [];
    const directLabels = Array.isArray(paper.labels) ? paper.labels : [];
    const directKeywords = Array.isArray(paper.keywords) ? paper.keywords : [];
    const itemTags = Array.isArray((paper as any).itemTags)
      ? (paper as any).itemTags.map((it: any) => it.tag?.name || it.name).filter(Boolean)
      : [];
    const merged = [...directTags, ...directLabels, ...directKeywords, ...itemTags].filter(Boolean);
    return Array.from(new Set(merged.map((t) => (typeof t === 'string' ? t.trim() : (t as any).name?.trim()))));
  }, [paper]);
  const tagsCount = tagsList.length;

  const relationsQuery = useRelatedPapers(workspaceId, paperId || '');
  const relationsCount = relationsQuery.data?.total || relationsQuery.data?.relatedPapers?.length || 0;

  const itemTypeLabel = useMemo(() => {
    if (!paper?.itemType) return 'Journal Article';
    const found = (ALL_ITEM_TYPES_FLAT as any[]).find((t: any) => t.value === paper.itemType);
    return found?.label || paper.itemType;
  }, [paper?.itemType]);

  const citeKey = useMemo(() => {
    if (!paper) return '';
    return generateCitationKey(paper);
  }, [paper]);

  // Hide or show section completely when clicking right panel bar icon
  const handleSectionIconClick = (sectionId: SectionId) => {
    if (!paper) return; // Nếu user chưa chọn paper nào -> hoàn toàn không thể tương tác!

    setActiveSectionId(sectionId);
    setActiveInspectorTab(sectionId);

    // If panel drawer is closed:
    if (!isInspectorOpen) {
      setIsInspectorOpen(true);
      // Mở panel drawer và đảm bảo section này hiện hoàn toàn
      setVisibleSections((prev) => ({
        ...prev,
        [sectionId]: true,
      }));
      setCollapsedSections((prev) => ({
        ...prev,
        [sectionId]: false,
      }));
      const scrollToTarget = () => {
        const el = document.getElementById(`inspector-section-${sectionId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      };
      setTimeout(scrollToTarget, 80);
      setTimeout(scrollToTarget, 180);
      return;
    }

    // If panel drawer is already open: toggle complete visibility (ẩn hoặc hiện section hoàn toàn)
    const currentlyVisible = isSectionVisible(sectionId);
    if (currentlyVisible) {
      if (!isSectionOpen(sectionId)) {
        // Section đang đóng -> mở ra và cuộn tới
        setCollapsedSections((prev) => ({
          ...prev,
          [sectionId]: false,
        }));
        setTimeout(() => {
          const el = document.getElementById(`inspector-section-${sectionId}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 50);
      } else {
        // Section đang mở -> ẩn hoàn toàn khỏi drawer
        setVisibleSections((prev) => ({
          ...prev,
          [sectionId]: false,
        }));
      }
    } else {
      // Hiện hoàn toàn section trong drawer và cuộn tới
      setVisibleSections((prev) => ({
        ...prev,
        [sectionId]: true,
      }));
      setCollapsedSections((prev) => ({
        ...prev,
        [sectionId]: false,
      }));
      setTimeout(() => {
        const el = document.getElementById(`inspector-section-${sectionId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 50);
    }
  };

  return (
    <div className="flex h-full shrink-0 select-none font-sans z-10">
      {/* ── Left Part: Collapsible Resizable Inspector Drawer ───────────────── */}
      {isInspectorOpen && (
        <aside
          aria-label="Document inspector"
          style={{
            width: `${inspectorWidth}px`,
          }}
          className="relative shrink-0 flex flex-col h-full border-l border-border bg-background select-none"
        >
          {/* Resizer Handle */}
          <div
            role="separator"
            aria-orientation="vertical"
            onMouseDown={handleMouseDown}
            onDoubleClick={() => setInspectorWidth(360)}
            className="absolute top-0 left-0 w-1.5 h-full cursor-col-resize hover:bg-primary/40 z-30 select-none group flex items-center justify-center -translate-x-1/2"
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
            <header className="h-12 px-3 border-b border-border bg-background flex items-center shrink-0 select-none">
              {/* Paper Title at the top */}
              <div className="w-full min-w-0">
                <InspectorTitleInput
                  title={paper.title || 'Untitled Reference'}
                  onSave={(newTitle) => handleUpdatePaper({ title: newTitle })}
                />
              </div>
            </header>
          ) : (
            /* Clean h-12 Header when no paper is selected (no Reference Details text, matching topbar line) */
            <header className="h-12 px-3 border-b border-border bg-background flex items-center shrink-0 select-none" />
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
                  <div className="p-1 bg-background">
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
                  <div className="p-1 bg-background">
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
                  <div className="p-1 bg-background">
                    <NotesSection
                      paper={{ ...paper, workspaceId: targetWsId }}
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
                            if (targetWsId) {
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
                            className="size-6 rounded-md flex items-center justify-center text-foreground hover:bg-black/5 dark:hover:bg-white/5 outline-none cursor-pointer"
                            aria-label="Add to collection"
                          >
                            <Plus className="size-3.5 text-foreground shrink-0" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="w-52 p-1.5 rounded-md border border-border/80 shadow-md bg-popover text-popover-foreground text-xs font-sans max-h-72 overflow-y-auto"
                        >
                          <DropdownMenuItem
                            onClick={() => {
                              setIsCreateCollectionOpen(true);
                            }}
                            className="flex items-center gap-2 cursor-pointer py-1.5 px-2 rounded-md hover:bg-accent text-foreground"
                          >
                            <FolderPlus className="size-4 text-foreground shrink-0" />
                            <span className="font-medium text-foreground">New Collection...</span>
                          </DropdownMenuItem>

                          {collections.length > 0 && <DropdownMenuSeparator className="my-1" />}

                          {buildCollectionTree(collections).map((col) =>
                            renderCollectionMenuItem(col, (colId) => {
                              handleUpdatePaper({ collectionId: colId });
                            })
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : null
                  }
                />
                {paper && isSectionOpen('collections') && (
                  <div className="bg-background">
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
                  <div className="bg-background">
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
                  <div className="p-1 bg-background">
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
                    <CiteSection paper={paper} workspaceId={workspaceId} />
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>
      )}

      {/* ── Right Part: Vertical Icon Panel Bar ─────────────────────────────── */}
      <aside
        aria-label="Inspector panel bar"
        className="w-10 shrink-0 h-full border-l border-border bg-background flex flex-col items-center z-20 select-none"
      >
        {/* Top: Toggle Panel Button Container - EXACTLY h-12 with line cách biên p-1 */}
        <div className="h-12 w-full flex flex-col items-center justify-between shrink-0">
          <div className="flex-1 flex items-center justify-center w-full">
            <button
              type="button"
              onClick={() => {
                if (!paper) return;
                setIsInspectorOpen(!isInspectorOpen);
              }}
              className="size-8 flex items-center justify-center rounded-md outline-none text-foreground hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
              aria-label={isInspectorOpen ? "Collapse panel" : "Expand panel"}
            >
              <PanelRight className="size-4 text-foreground shrink-0" />
            </button>
          </div>

          {/* Line cách biên p-2 (8px mỗi bên), tại đúng vị trí pixel 48 */}
          <div className="w-[calc(100%-16px)] mx-auto h-px bg-border/60 shrink-0" />
        </div>

        {/* Middle: 8 Section Icons - gap-1 and hover:bg-black/5 only, NO active effect */}
        <div className="flex flex-col items-center gap-1 w-full pt-1 px-1">
          {SECTIONS_CONFIG.map((sec) => {
            const Icon = sec.icon;

            return (
              <button
                key={sec.id}
                type="button"
                onClick={() => handleSectionIconClick(sec.id)}
                className="size-8 flex items-center justify-center rounded-md outline-none text-foreground hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
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

      {/* Add Related Paper Modal Controller */}
      {paper && isAddRelatedOpen && (
        <RelatedSection
          paper={paper}
          workspaceId={workspaceId}
          hideHeader
          isAddOpen={isAddRelatedOpen}
          onAddOpenChange={setIsAddRelatedOpen}
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







