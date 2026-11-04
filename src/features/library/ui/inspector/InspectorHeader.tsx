'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldAlert,
  X,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  Plus,
  Info,
  AlignLeft,
  Paperclip,
  StickyNote,
  FolderTree,
  Tag,
  Network,
  Quote,
  PanelRight,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip';
import {
  useUpdateLibraryItemMutation,
  useBatchRestoreItemsMutation,
  useDeleteLibraryItemsMutation,
} from '@/features/library/sdk/queries/catalog.queries';
import { useRetraction } from '@/features/library/sdk/queries/ingestion.queries';
import {
  useLibraryCommandStore,
  createRestoreCommand,
} from '@/features/library/core/manager/library-command.manager';
import type { InspectorSectionId } from '@/features/library/core/store/library-ui.store';
import type { Item } from '@/features/library/domain/types/core.types';
import { getTitleFieldForType } from '@/features/library/domain/types/item-types.types';
import { getItemDisplayTitle } from '@/features/library/domain/metadata-mapper';
import { buildInspectorFieldPatch } from '@/features/library/domain/item-field-schema';
import dynamic from 'next/dynamic';
import {
  isItemRetracted,
  getRetractionInfo,
} from '@/features/library/domain/system-views.policy';

const RetractionNoticeModal = dynamic(
  () => import('@/features/library/ui/modals/DeleteModal').then((m) => m.RetractionNoticeModal),
  { ssr: false },
);
const DeleteModal = dynamic(
  () => import('@/features/library/ui/modals/DeleteModal'),
  { ssr: false },
);

export interface InspectorSectionProps {
  id: InspectorSectionId;
  title: string;
  count?: number;
  isExpanded: boolean;
  isHighlighted?: boolean;
  onToggleExpand: () => void;
  onAdd?: () => void;
  actionSlot?: React.ReactNode;
  children: React.ReactNode;
  contentClassName?: string;
  canEdit?: boolean;
  keepMounted?: boolean;
}

export function InspectorSection({
  id,
  title,
  count,
  isExpanded,
  isHighlighted = false,
  onToggleExpand,
  onAdd,
  actionSlot,
  children,
  contentClassName = 'px-2.5 pt-1.5 pb-2.5',
  canEdit = true,
  keepMounted = false,
}: InspectorSectionProps) {
  return (
    <div
      id={`inspector-section-${id}`}
      className={cn(
        'group/section border-b border-border last:border-b-0 w-full transition-colors duration-300',
        isHighlighted && 'bg-muted/60',
      )}
    >
      <div
        onClick={onToggleExpand}
        className={cn(
          'flex items-center justify-between px-2.5 h-8 box-border select-none transition-colors w-full cursor-pointer hover:bg-muted/50',
          isHighlighted && 'bg-muted/80',
        )}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand();
          }}
          aria-expanded={isExpanded}
          aria-controls={`section-content-${id}`}
          className="flex-1 flex items-center gap-1.5 min-w-0 text-left outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-xs py-0.5 cursor-pointer"
        >
          <span className="text-12 font-medium text-foreground tracking-tight">
            {title}
          </span>
          {count !== undefined && count > 0 && (
            <span className="text-11 font-mono font-medium text-foreground px-1.5 py-0.5 rounded bg-muted">
              {count}
            </span>
          )}
        </button>

        <div role="presentation" className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
          {actionSlot}
          {onAdd && canEdit && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAdd();
                  }}
                  className="size-5 rounded flex items-center justify-center text-foreground hover:bg-muted cursor-pointer transition-colors relative before:absolute before:-inset-2.5 md:before:hidden"
                  aria-label={`Add ${title.toLowerCase()}`}
                >
                  <Plus className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={6}>
                {`Add ${title.toLowerCase()}`}
              </TooltipContent>
            </Tooltip>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleExpand();
                }}
                className="size-5 rounded flex items-center justify-center text-foreground hover:bg-muted cursor-pointer transition-colors relative before:absolute before:-inset-2.5 md:before:hidden"
                aria-label={isExpanded ? 'Collapse section' : 'Expand section'}
                aria-expanded={isExpanded}
                aria-controls={`section-content-${id}`}
              >
                {isExpanded ? (
                  <ChevronDown className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
                ) : (
                  <ChevronRight className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={6}>
              {isExpanded ? 'Collapse section' : 'Expand section'}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {(isExpanded || keepMounted) && (
        <div
          id={`section-content-${id}`}
          className={cn('bg-background', isExpanded ? contentClassName : 'hidden')}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export type InspectorTabKey = InspectorSectionId;

export const INSPECTOR_LEVELS: InspectorSectionId[] = [
  'cite',
  'relations',
  'tags',
  'collections',
  'notes',
  'files',
  'abstract',
  'info',
];

interface TabItem {
  id: InspectorTabKey;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number | string }>;
  badge?: number;
}

export interface InspectorTabsProps {
  activeTab: InspectorSectionId;
  onTabChange: (tab: InspectorSectionId) => void;
  attachmentCount?: number;
  noteCount?: number;
  tagsCount?: number;
  isInspectorOpen?: boolean;
  onToggleInspector?: () => void;
  hideRailToggle?: boolean;
  className?: string;
}

export function InspectorTabs({
  activeTab,
  onTabChange,
  attachmentCount = 0,
  noteCount = 0,
  tagsCount = 0,
  isInspectorOpen = true,
  onToggleInspector,
  hideRailToggle,
  className,
}: InspectorTabsProps) {
  const tabs: TabItem[] = [
    { id: 'info', label: 'Details', icon: Info },
    { id: 'abstract', label: 'Abstract', icon: AlignLeft },
    { id: 'files', label: 'Attachments', icon: Paperclip, badge: attachmentCount },
    { id: 'notes', label: 'Notes', icon: StickyNote, badge: noteCount },
    { id: 'collections', label: 'Collections', icon: FolderTree },
    { id: 'tags', label: 'Tags', icon: Tag, badge: tagsCount },
    { id: 'relations', label: 'Related', icon: Network },
    { id: 'cite', label: 'Citation', icon: Quote },
  ];

  return (
    <aside
      aria-label="Inspector panel bar"
      className={cn(
        'w-10 shrink-0 h-full min-h-full self-stretch border-l border-border bg-background flex flex-col items-center select-none z-20',
        className,
      )}
    >
      {!hideRailToggle && (
        <div className="h-11 w-full flex items-center justify-center shrink-0 border-b border-border">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onToggleInspector}
                className="size-8 flex items-center justify-center rounded-md outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors text-foreground hover:bg-muted cursor-pointer relative before:absolute before:-inset-1.5 md:before:hidden"
                aria-label={isInspectorOpen ? 'Collapse inspector' : 'Expand inspector'}
              >
                <PanelRight className="size-4 shrink-0 text-foreground" strokeWidth={1.5} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="left" sideOffset={6}>
              {isInspectorOpen ? 'Collapse inspector' : 'Expand inspector'}
            </TooltipContent>
          </Tooltip>
        </div>
      )}

      <div className={cn('flex flex-col items-center gap-1 w-full px-1', hideRailToggle ? 'pt-1' : 'pt-1.5')}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = isInspectorOpen && activeTab === tab.id;

          return (
            <Tooltip key={tab.id}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => {
                    if (!isInspectorOpen) {
                      onToggleInspector?.();
                    }
                    onTabChange(tab.id);
                  }}
                  className={cn(
                    'relative size-8 flex items-center justify-center rounded-md outline-none focus-visible:ring-1 focus-visible:ring-primary transition-colors cursor-pointer before:absolute before:-inset-1.5 md:before:hidden',
                    isActive
                      ? 'bg-muted text-foreground font-semibold'
                      : 'text-foreground hover:bg-muted font-normal',
                  )}
                  aria-label={tab.label}
                  aria-current={isActive ? 'true' : undefined}
                >
                  <Icon className="size-4 shrink-0 text-foreground" strokeWidth={1.5} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="left" sideOffset={6} className="text-11">
                <div className="flex items-center gap-1.5 font-medium">
                  <span>{tab.label}</span>
                  {tab.badge !== undefined && tab.badge > 0 && (
                    <span className="text-10 px-1 py-0.5 rounded bg-muted text-muted-foreground font-mono">
                      {tab.badge}
                    </span>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>

      <div className="flex-1" />
    </aside>
  );
}

interface InspectorHeaderProps {
  item: Item;
  scopeId?: string;
  canEdit?: boolean;
  onUpdateItem?: (data: Partial<Item>, options?: { silent?: boolean }) => void;
  onClose?: () => void;
}

export function InspectorHeader({
  item,
  scopeId,
  canEdit = true,
  onUpdateItem,
  onClose,
}: InspectorHeaderProps) {
  const displayTitle = getItemDisplayTitle(item) || item.title || '';
  const [titleDraft, setTitleDraft] = useState(displayTitle);
  const focusedItemIdRef = useRef<string | null>(null);
  const [isRetractionModalOpen, setIsRetractionModalOpen] = useState(false);
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);

  const isTrash = Boolean(item.deletedAt);
  const effectiveCanEdit = canEdit && !isTrash;

  const updateMutation = useUpdateLibraryItemMutation(scopeId);
  const restoreMutation = useBatchRestoreItemsMutation(scopeId);
  const deleteMutation = useDeleteLibraryItemsMutation(scopeId);
  const executeCommand = useLibraryCommandStore((s) => s.executeCommand);
  const { unflagItem, isUnflagging } = useRetraction(scopeId);

  const isRetracted = isItemRetracted(item);
  const { title: retractionTitle } = getRetractionInfo(item);

  useEffect(() => {
    setTitleDraft(displayTitle);
    focusedItemIdRef.current = item.id;
  }, [item.id, item.itemType, displayTitle]);

  const handleCommitTitle = () => {
    if (!effectiveCanEdit) return;
    if (focusedItemIdRef.current && focusedItemIdRef.current !== item.id) {
      return;
    }
    const cleanTitle = titleDraft.replace(/\r?\n+/g, ' ').trim();
    if (cleanTitle && cleanTitle !== displayTitle) {
      setTitleDraft(cleanTitle);
      const titleField = getTitleFieldForType(item.itemType);
      const patch = buildInspectorFieldPatch(item, titleField, cleanTitle);
      patch.title = cleanTitle;
      if (onUpdateItem) {
        onUpdateItem(patch, { silent: true });
      } else {
        updateMutation.mutate({
          itemId: item.id,
          data: patch,
          silent: true,
        });
      }
    } else if (!cleanTitle && displayTitle) {
      setTitleDraft(displayTitle);
    }
  };

  return (
    <div className="sticky top-0 z-10 flex flex-col shrink-0 select-none bg-background">
      <div className="h-11 px-1 sm:px-1.5 flex items-center gap-1 w-full min-w-0 border-b border-border bg-background shrink-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <input
              type="text"
              value={titleDraft}
              placeholder="Untitled Document"
              aria-label="Document Title"
              readOnly={!effectiveCanEdit}
              onChange={(e) => setTitleDraft(e.target.value)}
              onFocus={() => {
                focusedItemIdRef.current = item.id;
              }}
              onBlur={handleCommitTitle}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleCommitTitle();
                  (e.target as HTMLInputElement).blur();
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  setTitleDraft(displayTitle);
                  (e.target as HTMLInputElement).blur();
                }
              }}
              className={cn(
                'flex-1 min-w-0 h-8 text-13 font-semibold tracking-tight text-foreground font-sans select-text rounded-md outline-none truncate transition-colors',
                'px-1.5 border',
                effectiveCanEdit
                  ? [
                      'cursor-pointer hover:bg-muted hover:border-border',
                      'border-transparent focus:cursor-text focus:bg-background focus:border-primary focus:ring-1 focus:ring-ring focus:hover:bg-background',
                    ]
                  : ['border-transparent cursor-default'],
              )}
            />
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={6}>
            {titleDraft || 'Untitled Document'}
          </TooltipContent>
        </Tooltip>

        {isTrash && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => setIsRestoreModalOpen(true)}
                disabled={restoreMutation.isPending}
                className="size-7 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer shrink-0 transition-colors disabled:opacity-50 relative before:absolute before:-inset-1.5 md:before:hidden"
                aria-label="Restore reference to library"
              >
                <RotateCcw className="size-3.5 shrink-0" strokeWidth={1.5} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={6}>
              Restore reference to library
            </TooltipContent>
          </Tooltip>
        )}

        {isRetracted && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => setIsRetractionModalOpen(true)}
                className="size-7 flex items-center justify-center bg-destructive/10 text-destructive border border-destructive/25 rounded-md hover:bg-destructive/20 hover:border-destructive/40 transition-colors cursor-pointer shrink-0 select-none relative before:absolute before:-inset-1.5 md:before:hidden"
                aria-label="View retraction notice details"
              >
                <ShieldAlert
                  className="size-3.5 text-destructive shrink-0"
                  strokeWidth={1.5}
                />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={6}>
              {`${retractionTitle}. Click to view details.`}
            </TooltipContent>
          </Tooltip>
        )}

        {onClose && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onClose}
                className="md:hidden size-7 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer shrink-0 relative before:absolute before:-inset-2 md:before:hidden"
                aria-label="Close inspector"
              >
                <X className="size-4 shrink-0" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={6}>
              Close inspector
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      {isTrash && (
        <DeleteModal
          open={isRestoreModalOpen}
          onOpenChange={setIsRestoreModalOpen}
          title="Restore reference"
          description="Are you sure you want to restore this reference to your active library?"
          itemName={item.title || 'Untitled Document'}
          confirmLabel="Restore"
          cancelLabel="Cancel"
          buttonVariant="primary"
          icon={<RotateCcw className="size-4 shrink-0 text-primary" strokeWidth={1.5} />}
          isDeleting={restoreMutation.isPending}
          onConfirm={async () => {
            await executeCommand(
              createRestoreCommand({
                itemIds: [item.id],
                restoreMutation: { mutateAsync: restoreMutation.mutateAsync },
                deleteMutation: { mutateAsync: deleteMutation.mutateAsync },
              }),
              { silentToast: true },
            );
            setIsRestoreModalOpen(false);
          }}
        />
      )}

      {isRetracted && isRetractionModalOpen && (
        <RetractionNoticeModal
          open={isRetractionModalOpen}
          onOpenChange={setIsRetractionModalOpen}
          item={item}
          canEdit={effectiveCanEdit}
          onDismiss={async () => {
            await unflagItem(item.id);
          }}
          isDismissing={isUnflagging}
        />
      )}
    </div>
  );
}

export default InspectorHeader;
