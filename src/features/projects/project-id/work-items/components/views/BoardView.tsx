'use client';

import React, { useMemo, useState, useRef, useEffect } from 'react';
import {
  closestCorners,
  DndContext,
  DragOverlay,
  defaultDropAnimationSideEffects,
  useDroppable,
  type DropAnimation,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { createPortal } from 'react-dom';
import {
  Plus,
  MoreHorizontal,
  Trash2,
  Copy,
  UserPlus,
  UserMinus,
  RotateCcw,
  Clock3,
  User,
  Tag,
  ChevronDown,
  Paperclip,
  Link2,
  CheckSquare,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/components/ui";
import { Button } from "@/shared/components/ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui";
import { cn } from "@/shared/lib/utils";
import { useKanban, useCard, type ItemCardLabel } from '../../hooks/use-view';
import {
  PriorityPopover,
  DatePopover,
  MemberPopover,
  LabelPopover,
  AvatarStack,
} from '../modals/Popovers';
import { ItemHelpers, resolveColumnId, getItemBucketKey } from '../../utils/work-item.utils';
import {
  type Item,
  type Column as ColumnType,
  type DisplayOptions,
  type BaseWorkItemViewProps,
  type WorkItemCardHandlers,
  type Priority,
} from '../../types/work-item.types';
import { StatusIcon } from '@/shared/components/icons';

export type { ItemCardLabel };

// ── Icons & Themes ──────────────────────────────────────────────────────────

export function ModuleGridIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      className={cn("size-3.5 shrink-0", className)}
    >
      <rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <rect x="9" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

export function CollapseColumnIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      className={cn("size-3.5 shrink-0", className)}
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2.5 6.5h4v-4M6.5 6.5L2 2M13.5 9.5h-4v4M9.5 9.5L14 14" />
    </svg>
  );
}

export function ExpandColumnIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      className={cn("size-3.5 shrink-0", className)}
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6.5 2.5h-4v4M2.5 2.5L7 7M9.5 13.5h4v-4M13.5 13.5L9 9" />
    </svg>
  );
}

const PRIORITY_THEME_CLASSES: Record<string, string> = {
  urgent:
    'text-destructive bg-destructive/10 border-destructive/30 hover:bg-destructive/20 shadow-none font-normal',
  high:
    'text-amber-700 dark:text-amber-300 bg-amber-500/15 border-amber-500/30 hover:bg-amber-500/25 shadow-none font-normal',
  medium:
    'text-foreground bg-muted border-border hover:bg-muted/80 shadow-none font-normal',
  low:
    'text-muted-foreground bg-muted/40 border-border/70 hover:bg-muted shadow-none font-normal',
  none:
    'text-muted-foreground/60 bg-transparent hover:bg-muted/50 border-border/40 shadow-none font-normal',
};

function formatDateDisplay(dateStr?: string | null): string {
  return ItemHelpers.formatDate(dateStr);
}

// ── Card Component ──────────────────────────────────────────────────────────

export interface CardProps {
  card: Item;
  columns?: ColumnType[];
  projectStates?: ColumnType[];
  displayOptions?: DisplayOptions;
  labelMap?: Map<string, ItemCardLabel>;
  currentUserId?: string | null;
  currentUserAvatar?: string;
  members?: any[];
  onEdit?: (card: Item) => void;
  onDuplicate?: (card: Item) => void;
  onDelete?: (card: Item) => void;
  onJoin?: (card: Item) => void;
  onLeave?: (card: Item) => void;
  onMoveCard?: (cardId: string, newColumnId: string) => void;
  onUpdateItem?: (cardId: string, data: any) => void;
  isReadOnly?: boolean;
  isDragging?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (itemId: string) => void;
}

export function CardUI({
  card,
  columns = [],
  projectStates,
  displayOptions,
  labelMap,
  currentUserId,
  currentUserAvatar,
  members = [],
  onEdit,
  onDuplicate,
  onDelete,
  onJoin,
  onLeave,
  onMoveCard,
  onUpdateItem,
  isReadOnly = false,
  isDragging = false,
  isSelected = false,
  onToggleSelect,
}: CardProps) {
  const [priorityOpen, setPriorityOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [memberOpen, setMemberOpen] = useState(false);
  const [labelOpen, setLabelOpen] = useState(false);

  const resolvedAssignees = useMemo(() => {
    return ItemHelpers.resolveAssignees(card, members);
  }, [card, members]);

  const { state, actions } = useCard({
    card,
    labelMap,
    currentUserId,
    currentUserAvatar,
    onEdit,
    onDuplicate,
    onDelete,
    onJoin,
    onLeave,
    isReadOnly,
  });

  const {
    dates,
    labels,
    assignee,
  } = state;

  const {
    duplicate,
    remove,
    join,
    leave,
    edit,
  } = actions;

  // State matching (resolve true work item state regardless of board grouping)
  const matchedState = useMemo(() => {
    if (card.state && typeof card.state === 'object') {
      return {
        id: card.state.id,
        title: card.state.name,
        name: card.state.name,
        group: card.state.group,
        color: card.state.color,
        accentColor: card.state.color,
      };
    }
    const stateList = projectStates && projectStates.length > 0 ? projectStates : columns;
    const found = stateList.find((c) => resolveColumnId(c) === card.columnId);
    if (found) return found;
    if (!displayOptions?.groupBy || displayOptions.groupBy === 'state') {
      return columns.find((c) => resolveColumnId(c) === card.columnId);
    }
    return stateList[0];
  }, [card.state, card.columnId, projectStates, columns, displayOptions?.groupBy]);

  const isDone = Boolean(
    card.completed ||
    (card as any).stateGroup === 'completed' ||
    (card as any).state?.group === 'completed' ||
    matchedState?.group === 'completed' ||
    card.columnId === 'done' ||
    card.columnId === 'completed'
  );

  const isCancelled = Boolean(
    (card as any).stateGroup === 'cancelled' ||
    (card as any).state?.group === 'cancelled' ||
    matchedState?.group === 'cancelled' ||
    card.columnId === 'cancelled' ||
    card.columnId === 'cancel'
  );

  const colTitle = matchedState?.title || matchedState?.name || 'Backlog';
  const currentColor = matchedState?.color || matchedState?.accentColor || '#6B7280';
  const stateGroup = matchedState?.group || (card as any).stateGroup || (card as any).state?.group || colTitle;

  const priorityKey = (card.priority || 'none').toLowerCase() as Priority;

  // Formatted date range (unified single badge, never separated)
  const formattedDateRange = ItemHelpers.formatDateRange(card.startDate, card.dueDate);
  const isOverdue = dates.isOverdue;

  // Modules resolution
  const modulesList = Array.isArray((card as any).modules) ? (card as any).modules : [];
  const singleModule = (card as any).module;
  const hasModules = modulesList.length > 0 || Boolean(singleModule);
  const moduleText = useMemo(() => {
    if (modulesList.length > 1) {
      return `${modulesList.length} modules`;
    }
    if (modulesList.length === 1) {
      const m = modulesList[0];
      return typeof m === 'string' ? m : (m?.name || m?.title || '1 module');
    }
    if (singleModule) {
      return typeof singleModule === 'string' ? singleModule : (singleModule?.name || singleModule?.title || '1 module');
    }
    return '';
  }, [modulesList, singleModule]);

  // Sub-items
  const childWorkItems = (card as any).childWorkItems ?? (card as any).subItems ?? (card as any).children ?? [];
  const childWorkItemTotal = childWorkItems.length;
  const childWorkItemDone = childWorkItems.filter((st: any) =>
    st.completed || st.stateGroup === 'completed' || st.state?.group === 'completed' || st.columnId === 'done'
  ).length;

  // Attachments count
  const attachmentsCount = useMemo(() => {
    if (typeof (card as any).attachmentCount === 'number') return (card as any).attachmentCount;
    if (Array.isArray(card.attachments)) return card.attachments.length;
    const attachObj = card.attachments || (card as any).attach;
    if (attachObj && typeof attachObj === 'object') {
      const files = Array.isArray((attachObj as any).files) ? (attachObj as any).files.length : 0;
      const pages = Array.isArray((attachObj as any).pages) ? (attachObj as any).pages.length : 0;
      const papers = Array.isArray((attachObj as any).papers) ? (attachObj as any).papers.length : 0;
      return files + pages + papers;
    }
    return 0;
  }, [card.attachments, (card as any).attach, (card as any).attachmentCount]);

  // Links count
  const linksCount = useMemo(() => {
    if (typeof (card as any).linkCount === 'number') return (card as any).linkCount;
    if (Array.isArray((card as any).links)) return (card as any).links.length;
    const attachObj = card.attachments || (card as any).attach;
    if (attachObj && typeof attachObj === 'object' && Array.isArray((attachObj as any).links)) {
      return (attachObj as any).links.length;
    }
    return 0;
  }, [(card as any).links, card.attachments, (card as any).attach, (card as any).linkCount]);

  const showSubItems = displayOptions?.properties?.childWorkItemCount !== false && childWorkItemTotal > 0;
  const showAttach = displayOptions?.properties?.attachmentCount !== false && attachmentsCount > 0;
  const showLinks = displayOptions?.properties?.link !== false && linksCount > 0;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => edit()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          edit();
        }
      }}
      aria-label={`Work item: ${card.title}`}
      className={cn(
        'group relative min-w-0 rounded-md border border-border bg-card p-3.5 shadow-none hover:border-border-hover dark:hover:border-border transition-all cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ring select-none',
        isDragging && 'opacity-40',
        isSelected && 'ring-1 ring-ring border-ring bg-muted/40'
      )}
    >
      {/* Row 1: Identifier | Options Menu */}
      <div className="flex items-center justify-between gap-1.5 min-w-0">
        <div
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          className="flex items-center gap-1.5 min-w-0 overflow-hidden"
        >
          {/* Identifier */}
          {(card.identifier || card.sequenceNumber) && (displayOptions?.properties?.id !== false) && (
            <span className="font-mono text-11 font-medium text-muted-foreground uppercase tracking-tight shrink-0 tabular-nums">
              {card.identifier || `ISSUE-${card.sequenceNumber}`}
            </span>
          )}
        </div>

        {/* Right: Options Menu */}
        {!isReadOnly && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1 shrink-0 ml-auto"
          >
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Options for ${card.title}`}
                  className="size-5.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors rounded-sm flex items-center justify-center cursor-pointer"
                >
                  <MoreHorizontal className="size-3.5 shrink-0" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40 z-100 rounded-md">
                {onDuplicate && (
                  <DropdownMenuItem onClick={duplicate} className="rounded-md cursor-pointer">
                    <Copy className="mr-2 size-3.5 shrink-0 text-foreground" />
                    Duplicate
                  </DropdownMenuItem>
                )}
                {currentUserId && (
                  <DropdownMenuItem onClick={assignee.isCurrentUser ? leave : join} className="rounded-md cursor-pointer">
                    {assignee.isCurrentUser ? (
                      <>
                        <UserMinus className="mr-2 size-3.5 shrink-0 text-foreground" />
                        Leave card
                      </>
                    ) : (
                      <>
                        <UserPlus className="mr-2 size-3.5 shrink-0 text-foreground" />
                        Join card
                      </>
                    )}
                  </DropdownMenuItem>
                )}
                {onDelete && (
                  <DropdownMenuItem
                    onClick={remove}
                    className="text-destructive focus:text-destructive rounded-md cursor-pointer"
                  >
                    <Trash2 className="mr-2 size-3.5 shrink-0" />
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      {/* Row 2: Title */}
      <p
        className={cn(
          'mt-1.5 text-13 font-medium text-foreground leading-snug line-clamp-2 select-text',
          isCancelled && 'line-through text-muted-foreground',
          isDone && !isCancelled && 'text-muted-foreground'
        )}
      >
        {card.title}
      </p>

      {/* Row 3: Unified Footer (Priority, Dates, Labels, Modules, Indicators | Assignee) */}
      <div className="mt-2.5 flex items-center justify-between gap-1.5 min-w-0">
        {/* Left: Metadata badges */}
        <div className="flex items-center gap-1.5 flex-wrap min-w-0 flex-1">
          {/* 1. Priority */}
          {displayOptions?.properties?.priority !== false && (
            <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
              <PriorityPopover
                open={priorityOpen}
                onOpenChange={setPriorityOpen}
                priority={priorityKey as Priority}
                setPriority={(p) => onUpdateItem?.(card.id, { priority: p })}
                isReadOnly={isReadOnly}
                actionBtnClass={cn(
                  'h-5 px-1.5 text-10 font-normal rounded-sm border transition-colors shadow-none flex items-center gap-1 cursor-pointer shrink-0',
                  PRIORITY_THEME_CLASSES[priorityKey] || PRIORITY_THEME_CLASSES.none
                )}
              />
            </div>
          )}

          {/* 2. Date */}
          {displayOptions?.properties?.dueDate !== false && formattedDateRange && (
            <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
              <DatePopover
                open={dateOpen}
                onOpenChange={setDateOpen}
                startDate={card.startDate || null}
                dueDate={card.dueDate || null}
                label={formattedDateRange}
                isReadOnly={isReadOnly}
                onApplyDates={(payload) => {
                  onUpdateItem?.(card.id, {
                    startDate: payload.startDate,
                    dueDate: payload.dueDate,
                  });
                }}
                actionBtnClass={cn(
                  'h-5 px-1.5 text-10 font-mono tabular-nums font-normal rounded-sm border flex items-center justify-center transition-colors cursor-pointer gap-1 shrink-0',
                  isOverdue
                    ? 'text-destructive border-destructive/40 bg-destructive/5 hover:bg-destructive/10'
                    : 'border-border bg-muted/20 text-foreground hover:bg-muted'
                )}
              />
            </div>
          )}

          {/* 3. Labels (compact pills: max 2 + counter pill to prevent any lone drop) */}
          {displayOptions?.properties?.labels !== false && labels.length > 0 && (
            <>
              {labels.slice(0, 2).map((lbl: any) => {
                const lblName = lbl.title || lbl.name || lbl.id || '';
                const lblColor = lbl.color || '#8b5cf6';
                return (
                  <button
                    key={lbl.id || lblName}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setLabelOpen(true);
                    }}
                    className="inline-flex items-center gap-1 h-5 px-1.5 rounded-sm border border-border/70 bg-muted/20 text-10 text-foreground font-normal hover:bg-muted transition-colors shrink-0 cursor-pointer"
                    title={`Label: ${lblName}`}
                  >
                    <span
                      className="size-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: lblColor }}
                    />
                    <span className="truncate max-w-[85px]">{lblName}</span>
                  </button>
                );
              })}
              {labels.length > 2 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setLabelOpen(true);
                  }}
                  className="inline-flex items-center h-5 px-1.5 rounded-sm border border-border/70 bg-muted/20 text-10 font-mono text-muted-foreground shrink-0 hover:bg-muted cursor-pointer"
                  title={labels.slice(2).map((l: any) => l.title || l.name).join(', ')}
                >
                  +{labels.length - 2}
                </button>
              )}
            </>
          )}

          {/* 4. Module Badge */}
          {hasModules && (
            <div
              onClick={(e) => {
                e.stopPropagation();
                onEdit?.(card);
              }}
              className="inline-flex items-center gap-1 px-1.5 h-5 rounded-sm border border-border/70 bg-muted/20 text-10 text-foreground hover:bg-muted transition-colors cursor-pointer shrink-0"
              title={moduleText}
            >
              <ModuleGridIcon className="size-3 shrink-0" />
              <span className="truncate max-w-[85px]">{moduleText}</span>
            </div>
          )}

          {/* 5. Subitem Indicator */}
          {showSubItems && (
            <div
              className="inline-flex items-center gap-1 px-1.5 h-5 rounded-sm text-10 text-foreground border border-border/70 bg-muted/20 shrink-0"
              title={`${childWorkItemDone}/${childWorkItemTotal} sub-items`}
            >
              <CheckSquare className="size-2.5 shrink-0" />
              <span className="tabular-nums font-mono text-10">{childWorkItemDone}/{childWorkItemTotal}</span>
            </div>
          )}

          {/* 6. Attachments Indicator */}
          {showAttach && (
            <div
              className="inline-flex items-center gap-1 px-1.5 h-5 rounded-sm text-10 text-foreground border border-border/70 bg-muted/20 shrink-0"
              title={`${attachmentsCount} attachment${attachmentsCount > 1 ? 's' : ''}`}
            >
              <Paperclip className="size-2.5 shrink-0" />
              <span className="tabular-nums font-mono text-10">{attachmentsCount}</span>
            </div>
          )}

          {/* 7. Links Indicator */}
          {showLinks && (
            <div
              className="inline-flex items-center gap-1 px-1.5 h-5 rounded-sm text-10 text-foreground border border-border/70 bg-muted/20 shrink-0"
              title={`${linksCount} link${linksCount > 1 ? 's' : ''}`}
            >
              <Link2 className="size-2.5 shrink-0" />
              <span className="tabular-nums font-mono text-10">{linksCount}</span>
            </div>
          )}

          {/* Quick Add Date if empty - visible on hover */}
          {displayOptions?.properties?.dueDate !== false && !formattedDateRange && !isReadOnly && (
            <div className="shrink-0 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
              <DatePopover
                open={dateOpen}
                onOpenChange={setDateOpen}
                startDate={card.startDate || null}
                dueDate={card.dueDate || null}
                label="Dates"
                isReadOnly={isReadOnly}
                onApplyDates={(payload) => {
                  onUpdateItem?.(card.id, {
                    startDate: payload.startDate,
                    dueDate: payload.dueDate,
                  });
                }}
                actionBtnClass="size-5 p-0 rounded-sm border border-border/60 bg-transparent hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer shrink-0 [&>span]:hidden"
              />
            </div>
          )}

          {/* Quick Add Label - only visible on hover if no labels exist yet */}
          {displayOptions?.properties?.labels !== false && labels.length === 0 && !isReadOnly && (
            <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
              <LabelPopover
                open={labelOpen}
                onOpenChange={setLabelOpen}
                labels={ItemHelpers.uniqueLabels(card.labels as any)}
                setLabels={(updater) => {
                  const current = ItemHelpers.uniqueLabels(card.labels as any);
                  const next = typeof updater === 'function' ? updater(current) : updater;
                  onUpdateItem?.(card.id, { labels: next });
                }}
                iconOnly
                actionBtnClass="size-5 p-0 rounded-sm border border-border/60 bg-transparent hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer shrink-0 [&>span]:hidden"
              />
            </div>
          )}
        </div>

        {/* Right: Assignee Avatar */}
        {displayOptions?.properties?.assignee !== false && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="shrink-0 ml-auto flex items-center self-center"
          >
            {resolvedAssignees.length > 1 ? (
              <button
                type="button"
                onClick={() => setMemberOpen(true)}
                disabled={isReadOnly}
                className="cursor-pointer hover:ring-1 hover:ring-ring focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none transition-all rounded-full shrink-0"
                title={`${resolvedAssignees.length} assignees`}
              >
                <AvatarStack users={resolvedAssignees} size="xs" max={2} />
              </button>
            ) : resolvedAssignees.length === 1 ? (
              <button
                type="button"
                onClick={() => setMemberOpen(true)}
                disabled={isReadOnly}
                className="size-5 rounded-full border border-border overflow-hidden flex items-center justify-center shrink-0 cursor-pointer hover:ring-1 hover:ring-ring focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none transition-all"
                title={resolvedAssignees[0].name || 'Assignee'}
              >
                <Avatar className="size-full shrink-0">
                  <AvatarImage src={resolvedAssignees[0].avatar || undefined} />
                  <AvatarFallback className="text-9 font-medium bg-muted text-foreground">
                    {(resolvedAssignees[0].name || 'U').charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </button>
            ) : !isReadOnly ? (
              <button
                type="button"
                onClick={() => setMemberOpen(true)}
                className="size-5 rounded-md border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center cursor-pointer transition-colors sm:opacity-0 sm:group-hover:opacity-100"
                title="Assign member"
              >
                <User className="size-3" />
              </button>
            ) : null}

            <MemberPopover
              open={memberOpen}
              onOpenChange={setMemberOpen}
              members={members}
              assigneeId={ItemHelpers.resolveAssigneeId(card) || null}
              setAssigneeId={(mId) => onUpdateItem?.(card.id, { assigneeId: mId || null })}
              actionBtnClass="hidden"
            />
          </div>
        )}
      </div>
    </div>
  );
}

export function Card(props: CardProps) {
  const { card } = props;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: card.id,
    data: {
      type: 'Item',
      item: card,
    },
    disabled: props.isReadOnly,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <CardUI {...props} isDragging={isDragging} />
    </div>
  );
}

// ── Column Component ────────────────────────────────────────────────────────

export interface ColumnProps extends BaseWorkItemViewProps, Partial<WorkItemCardHandlers> {
  column: ColumnType;
  cards: Item[];
  columns?: ColumnType[];
  projectStates?: ColumnType[];
  droppableId?: string;
  laneId?: string;
  subGroupBy?: string;
  labelMap?: Map<string, ItemCardLabel>;
  onAddCard?: (columnId: string, title?: string, swimlaneData?: { subGroupBy?: string; laneId?: string }) => void;
  onUpdateItem?: (itemId: string, data: any) => void;
}

export function Column({
  column,
  cards,
  columns = [],
  projectStates,
  displayOptions,
  labelMap,
  currentUserId,
  currentUserAvatar,
  members = [],
  droppableId,
  laneId,
  subGroupBy,
  onAddCard,
  onEditCard,
  onDeleteCard,
  onDuplicateCard,
  onJoinCard,
  onLeaveCard,
  onMoveCard,
  onUpdateItem,
  isReadOnly = false,
  selectedIds = [],
  onToggleSelect,
}: ColumnProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [quickTitle, setQuickTitle] = useState('');
  const [isQuickAdding, setIsQuickAdding] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const columnId = resolveColumnId(column);
  const columnColor = column.color || column.accentColor || '#6B7280';

  const effectiveDroppableId = droppableId || columnId;
  const { setNodeRef, isOver } = useDroppable({
    id: effectiveDroppableId,
    data: {
      type: 'Column',
      column,
      laneId,
      subGroupBy,
    },
  });

  const cardIds = useMemo(() => cards.map((c) => c.id), [cards]);

  useEffect(() => {
    if (isQuickAdding && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isQuickAdding]);

  const handleQuickAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTitle.trim() || !onAddCard) return;
    onAddCard(
      columnId,
      quickTitle.trim(),
      laneId && subGroupBy && subGroupBy !== 'none'
        ? { subGroupBy, laneId }
        : undefined
    );
    setQuickTitle('');
    setIsQuickAdding(false);
  };

  // Collapsed Vertical Column Strip (Plane-style, e.g. "In Progress 2")
  if (isCollapsed) {
    return (
      <div
        ref={setNodeRef}
        onClick={() => setIsCollapsed(false)}
        className={cn(
          'flex flex-col items-center py-3 w-11 shrink-0 rounded-md bg-muted/40 dark:bg-muted/15 border border-border/50 transition-all cursor-pointer hover:bg-muted/60 h-full min-h-[350px] select-none',
          isOver && 'bg-muted/60'
        )}
      >
        <div className="shrink-0 mb-2">
          <StatusIcon
            id={columnId}
            title={column.title || column.name}
            group={column.group}
            color={columnColor}
            className="size-4 shrink-0"
          />
        </div>

        <div className="flex-1 relative w-full flex items-center justify-center my-3 select-none overflow-hidden">
          <span className="text-xs font-semibold text-foreground tracking-tight flex items-center gap-1.5 whitespace-nowrap rotate-90 select-none">
            <span className="max-w-[160px] truncate">{column.title || column.name}</span>
            <span className="font-mono text-11 text-foreground tabular-nums">
              {cards.length}
            </span>
          </span>
        </div>

        <div
          className="flex flex-col items-center gap-1.5 mt-auto pt-2 shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-foreground hover:text-foreground cursor-pointer rounded-md hover:bg-background/80 transition-colors"
            onClick={() => setIsCollapsed(false)}
            title="Expand column"
          >
            <ExpandColumnIcon className="size-3.5 shrink-0" />
          </Button>

          {!isReadOnly && onAddCard && (
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-foreground hover:text-foreground cursor-pointer rounded-md hover:bg-background/80 transition-colors"
              onClick={() => {
                setIsCollapsed(false);
                setIsQuickAdding(true);
              }}
              title="Add work item"
            >
              <Plus className="size-3.5 shrink-0" />
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Expanded Column
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex flex-col w-[320px] shrink-0 h-full min-h-[350px] rounded-md bg-muted/40 dark:bg-muted/15 border border-border/50 transition-colors',
        isOver && 'bg-muted/60'
      )}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between px-3 py-2.5 shrink-0 select-none">
        <div className="flex items-center gap-2 min-w-0">
          <StatusIcon
            id={columnId}
            title={column.title || column.name}
            group={column.group}
            color={columnColor}
            className="size-4 shrink-0"
          />
          <h3 className="text-xs font-semibold text-foreground truncate">
            {column.title || column.name}
          </h3>
          <span className="text-xs font-normal text-foreground ml-0.5 tabular-nums">
            {cards.length}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-6 text-foreground hover:text-foreground cursor-pointer transition-colors rounded-md"
            onClick={() => setIsCollapsed(true)}
            title="Collapse column"
          >
            <CollapseColumnIcon className="size-3.5 shrink-0" />
          </Button>

          {!isReadOnly && onAddCard && (
            <Button
              variant="ghost"
              size="icon"
              className="size-6 text-foreground hover:text-foreground cursor-pointer transition-colors rounded-md"
              onClick={() => setIsQuickAdding(true)}
              title="Add work item"
            >
              <Plus className="size-3.5 shrink-0" />
            </Button>
          )}
        </div>
      </div>

      {/* Cards List */}
      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-2.5 min-h-[60px] kanban-scrollbar">
        {isQuickAdding && (
          <form onSubmit={handleQuickAddSubmit} className="p-3 bg-card rounded-md border border-border shadow-none space-y-2.5">
            <input
              ref={inputRef}
              value={quickTitle}
              onChange={(e) => setQuickTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setIsQuickAdding(false);
                  setQuickTitle('');
                }
              }}
              placeholder="What needs to be done?"
              className="w-full text-xs bg-transparent border-none p-0 outline-none placeholder:text-muted-foreground text-foreground"
            />
            <div className="flex items-center justify-end gap-1.5 pt-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 text-11 px-2 text-foreground hover:text-foreground rounded-md"
                onClick={() => setIsQuickAdding(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                className="h-6 text-11 px-2.5 rounded-md"
                disabled={!quickTitle.trim()}
              >
                Add
              </Button>
            </div>
          </form>
        )}

        <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
          {cards.map((card) => (
            <Card
              key={card.id}
              card={card}
              columns={columns}
              projectStates={projectStates}
              displayOptions={displayOptions}
              labelMap={labelMap}
              currentUserId={currentUserId}
              currentUserAvatar={currentUserAvatar}
              members={members}
              onEdit={onEditCard}
              onDuplicate={onDuplicateCard}
              onDelete={onDeleteCard}
              onJoin={onJoinCard}
              onLeave={onLeaveCard}
              onMoveCard={onMoveCard}
              onUpdateItem={onUpdateItem}
              isReadOnly={isReadOnly}
              isSelected={selectedIds.includes(card.id)}
              onToggleSelect={onToggleSelect}
            />
          ))}
        </SortableContext>

        {!isQuickAdding && !isReadOnly && onAddCard && (
          <button
            type="button"
            onClick={() => setIsQuickAdding(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-13 text-foreground hover:text-foreground cursor-pointer rounded-md hover:bg-muted/60 transition-colors w-full text-left font-normal"
          >
            <Plus className="size-3.5 shrink-0" />
            <span>New work item</span>
          </button>
        )}
      </div>
    </div>
  );
}

// ── BoardView Component ─────────────────────────────────────────────────────

export interface BoardViewProps extends BaseWorkItemViewProps, Partial<WorkItemCardHandlers> {
  items?: Item[];
  itemsByColumnId?: Map<string, Item[]>;
  columns: ColumnType[];
  projectStates?: ColumnType[];
  labelMap?: Map<string, ItemCardLabel>;
  onAddCard?: (columnId: string, title?: string, swimlaneData?: { subGroupBy?: string; laneId?: string }) => void;
  onMoveCard?: (itemId: string, newColumnId: string, laneData?: { subGroupBy?: string; laneId?: string }) => void;
  onReorderCard?: (itemId: string, newColumnId: string, rank: number) => void;
  onUpdateItem?: (itemId: string, data: any) => void;
}

export type BoardProps = BoardViewProps;

interface SwimlaneDef {
  id: string;
  title: string;
  color?: string;
  icon?: React.ReactNode;
}

export function BoardView({
  items: propItems = [],
  itemsByColumnId: propItemsByColumnId,
  columns,
  projectStates,
  displayOptions,
  labelMap,
  currentUserId,
  currentUserAvatar,
  members = [],
  onAddCard,
  onEditCard,
  onDeleteCard,
  onDuplicateCard,
  onJoinCard,
  onLeaveCard,
  onMoveCard,
  onReorderCard,
  onUpdateItem,
  isReadOnly = false,
  selectedIds = [],
  onToggleSelect,
}: BoardViewProps) {
  const items = propItems;
  const itemsByColumnId = propItemsByColumnId;
  const subGroupBy = displayOptions?.subGroupBy || 'none';
  const VALID_SWIMLANE_OPTIONS = ['priority', 'assignee', 'labels'] as const;
  const isSwimlanesActive = Boolean(
    subGroupBy &&
    subGroupBy !== 'none' &&
    VALID_SWIMLANE_OPTIONS.includes(subGroupBy as any) &&
    subGroupBy !== displayOptions?.groupBy
  );

  const [collapsedLanes, setCollapsedLanes] = useState<Record<string, boolean>>({});

  const toggleLaneCollapse = (laneId: string) => {
    setCollapsedLanes((prev) => ({ ...prev, [laneId]: !prev[laneId] }));
  };

  const swimlanes = useMemo<Array<SwimlaneDef & { itemsByColumn: Map<string, Item[]>; count: number; completedCount: number }>>(() => {
    if (!isSwimlanesActive) return [];

    let defs: SwimlaneDef[] = [];
    if (subGroupBy === 'priority') {
      defs = [
        { id: 'urgent', title: 'Urgent', color: '#ef4444' },
        { id: 'high', title: 'High', color: '#f97316' },
        { id: 'medium', title: 'Medium', color: '#f59e0b' },
        { id: 'low', title: 'Low', color: '#3b82f6' },
        { id: 'none', title: 'No Priority', color: '#6b7280' },
      ];
    } else if (subGroupBy === 'assignee') {
      const memberLanes: SwimlaneDef[] = (members || []).map((m: any, idx: number) => {
        const userId = m.userId || m.user?.id || m.id || `member-${idx}`;
        const name = m.user?.name || m.name || 'Member';
        const avatar = m.user?.avatar || m.avatar;
        return {
          id: userId,
          title: name,
          color: '#6366f1',
          icon: (
            <Avatar className="size-4 shrink-0">
              <AvatarImage src={avatar || undefined} />
              <AvatarFallback className="text-9">{name.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
          ),
        };
      });
      defs = [
        ...memberLanes,
        {
          id: '__unassigned__',
          title: 'Unassigned',
          color: '#9ca3af',
          icon: <User className="size-3.5 text-foreground shrink-0" />,
        },
      ];
    } else if (subGroupBy === 'labels') {
      const allLabels = new Set<string>();
      items.forEach((t: Item) => {
        if (Array.isArray(t.labels)) {
          t.labels.forEach((lbl: any) => {
            const str = typeof lbl === 'string' ? lbl : lbl?.name || lbl?.id;
            if (str) allLabels.add(str);
          });
        }
      });
      const labelLanes: SwimlaneDef[] = Array.from(allLabels).map((lbl) => {
        const meta = labelMap?.get(lbl);
        return {
          id: lbl,
          title: meta?.name || lbl,
          color: meta?.color || '#8b5cf6',
          icon: <Tag className="size-3.5 text-purple-500 shrink-0" />,
        };
      });
      defs = [
        ...labelLanes,
        {
          id: '__no_label__',
          title: 'No Label',
          color: '#9ca3af',
          icon: <Tag className="size-3.5 text-foreground shrink-0" />,
        },
      ];
    } else {
      return [];
    }

    const columnIds = columns.map((c) => resolveColumnId(c));

    const result = defs.map((lane) => {
      const laneMap = new Map<string, Item[]>();
      columnIds.forEach((cid) => laneMap.set(cid, []));
      let count = 0;
      let completedCount = 0;

      items.forEach((t: Item) => {
        let itemLaneId = 'none';
        if (subGroupBy === 'priority') {
          itemLaneId = (t.priority || 'none').toLowerCase();
        } else if (subGroupBy === 'assignee') {
          itemLaneId = ItemHelpers.resolveAssigneeId(t) || '__unassigned__';
        } else if (subGroupBy === 'labels') {
          const first = (t.labels && t.labels.length > 0) ? t.labels[0] : null;
          itemLaneId = first ? (typeof first === 'string' ? first : (first as any).name || (first as any).id || '__no_label__') : '__no_label__';
        }

        if (itemLaneId === lane.id) {
          count++;
          if (t.completed || (t as any).stateGroup === 'completed' || (t as any).state?.group === 'completed' || t.columnId === 'done' || t.columnId === 'completed') {
            completedCount++;
          }
          const colId = getItemBucketKey(t, displayOptions?.groupBy) || t.columnId || columnIds[0] || 'backlog';
          const list = laneMap.get(colId);
          if (list) {
            list.push(t);
          } else {
            laneMap.set(colId, [t]);
          }
        }
      });

      return {
        ...lane,
        itemsByColumn: laneMap,
        count,
        completedCount,
      };
    });

    if (displayOptions?.showEmptyGroups === false) {
      const filtered = result.filter((l) => l.count > 0);
      return filtered.length > 0 ? filtered : result;
    }

    return result;
  }, [isSwimlanesActive, subGroupBy, members, columns, items, labelMap, displayOptions?.showEmptyGroups, displayOptions?.groupBy]);

  const { state: kanbanState, actions: kanbanActions } = useKanban({
    items,
    columns,
    itemsByColumnId,
    groupBy: displayOptions?.groupBy,
    onMoveCard,
    onReorderCard,
    isReadOnly,
    subGroupBy,
  });

  const { itemsByColumn, activeItem, sensors } = kanbanState;
  const { dragStart, dragEnd, dragCancel } = kanbanActions;

  const visibleColumns = useMemo(() => {
    if (displayOptions?.showEmptyGroups === false) {
      const nonEmpty = columns.filter((col) => {
        const colId = resolveColumnId(col);
        const colCards = (itemsByColumnId ? itemsByColumnId.get(colId) : itemsByColumn.get(colId)) || [];
        return colCards.length > 0;
      });
      return nonEmpty.length > 0 ? nonEmpty : columns;
    }
    return columns;
  }, [columns, itemsByColumn, itemsByColumnId, displayOptions?.showEmptyGroups]);

  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const dropAnimationConfig: DropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
      styles: {
        active: {
          opacity: '0.4',
        },
      },
    }),
  };

  return (
    <div className="flex-1 h-full overflow-x-auto overflow-y-auto p-2 sm:p-2.5 min-w-0 bg-background kanban-scrollbar select-none">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={dragStart}
        onDragEnd={dragEnd}
        onDragCancel={dragCancel}
      >
        {isSwimlanesActive && swimlanes.length > 0 ? (
          <div className="space-y-3 pb-3 min-w-max">
            {swimlanes.map((lane) => {
              const isCollapsed = Boolean(collapsedLanes[lane.id]);
              return (
                <div
                  key={lane.id}
                  className="rounded-md border border-border/50 bg-card/40 overflow-hidden shadow-none"
                >
                  {/* Swimlane Header */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleLaneCollapse(lane.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleLaneCollapse(lane.id);
                      }
                    }}
                    className="flex items-center justify-between px-3.5 py-2 bg-muted/60 hover:bg-muted cursor-pointer select-none transition-colors border-b border-border/40"
                  >
                    <div className="flex items-center gap-2">
                      <ChevronDown
                        className={cn(
                          'size-4 text-foreground transition-transform duration-150',
                          isCollapsed && '-rotate-90'
                        )}
                      />
                      {lane.icon ? (
                        lane.icon
                      ) : (
                        <span
                          className="size-2 rounded-full shrink-0"
                          style={{ backgroundColor: lane.color || '#6b7280' }}
                        />
                      )}
                      <span className="text-xs font-semibold text-foreground">
                        {lane.title}
                      </span>
                      <span className="font-mono text-10 font-medium text-foreground bg-muted px-1.5 py-0.2 rounded-md tabular-nums">
                        {lane.count}
                      </span>
                      {lane.count > 0 && lane.completedCount > 0 && (
                        <span className="text-10 text-foreground font-medium flex items-center gap-1">
                          <span>•</span>
                          <span>{Math.round((lane.completedCount / lane.count) * 100)}% done</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Swimlane Columns Grid */}
                  {!isCollapsed && (
                    <div className="flex items-stretch gap-3 p-2.5 overflow-x-auto min-w-max pb-2 kanban-scrollbar">
                      {columns.map((col) => {
                        const colId = resolveColumnId(col);
                        const columnCards = lane.itemsByColumn.get(colId) || [];
                        return (
                          <Column
                            key={`${lane.id}:::${colId}`}
                            column={col}
                            cards={columnCards}
                            columns={columns}
                            projectStates={projectStates || columns}
                            droppableId={`${lane.id}:::${colId}`}
                            laneId={lane.id}
                            subGroupBy={subGroupBy}
                            displayOptions={displayOptions}
                            labelMap={labelMap}
                            currentUserId={currentUserId}
                            currentUserAvatar={currentUserAvatar}
                            members={members}
                            onAddCard={onAddCard}
                            onEditCard={onEditCard}
                            onDeleteCard={onDeleteCard}
                            onDuplicateCard={onDuplicateCard}
                            onJoinCard={onJoinCard}
                            onLeaveCard={onLeaveCard}
                            onMoveCard={onMoveCard}
                            onUpdateItem={onUpdateItem}
                            isReadOnly={isReadOnly}
                            selectedIds={selectedIds}
                            onToggleSelect={onToggleSelect}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex h-full items-stretch gap-3 min-w-max pb-2">
            {visibleColumns.map((col) => {
              const colId = resolveColumnId(col);
              const columnCards = (itemsByColumnId ? itemsByColumnId.get(colId) : itemsByColumn.get(colId)) || [];
              return (
                <Column
                  key={colId}
                  column={col}
                  cards={columnCards}
                  columns={columns}
                  projectStates={projectStates || columns}
                  displayOptions={displayOptions}
                  labelMap={labelMap}
                  currentUserId={currentUserId}
                  currentUserAvatar={currentUserAvatar}
                  members={members}
                  onAddCard={onAddCard}
                  onEditCard={onEditCard}
                  onDeleteCard={onDeleteCard}
                  onDuplicateCard={onDuplicateCard}
                  onJoinCard={onJoinCard}
                  onLeaveCard={onLeaveCard}
                  onMoveCard={onMoveCard}
                  onUpdateItem={onUpdateItem}
                  isReadOnly={isReadOnly}
                  selectedIds={selectedIds}
                  onToggleSelect={onToggleSelect}
                />
              );
            })}
          </div>
        )}

        {isMounted &&
          createPortal(
            <DragOverlay dropAnimation={dropAnimationConfig}>
              {activeItem ? (
                <div className="w-[320px] rotate-1 cursor-grabbing opacity-90">
                  <CardUI
                    card={activeItem}
                    columns={columns}
                    projectStates={projectStates || columns}
                    displayOptions={displayOptions}
                    labelMap={labelMap}
                    currentUserId={currentUserId}
                    currentUserAvatar={currentUserAvatar}
                    members={members}
                    isReadOnly={isReadOnly}
                    isDragging={false}
                  />
                </div>
              ) : null}
            </DragOverlay>,
            document.body
          )}
      </DndContext>
    </div>
  );
}

export const Board = BoardView;
export default BoardView;
