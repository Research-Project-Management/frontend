'use client';

import React from 'react';
import {
  MoreHorizontal,
  Pencil,
  Copy,
  FolderInput,
  Trash2,
  Tag,
  Calendar,
  User,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { Button } from '@/shared/components/ui/button';
import { StatusIcon } from '@/features/workspaces/projects/project-id/work-items/components/StatusIcon';
import {
  UrgentPriorityBoxIcon,
  HighPriorityBoxIcon,
  MediumPriorityBoxIcon,
  LowPriorityBoxIcon,
  NonePriorityBoxIcon,
} from '@/features/workspaces/projects/project-id/work-items/components/modals/Popovers';
import type { WorkItemDraft, TaskPriority } from '../../types/draft.types';

export interface ListItemProps {
  draft: WorkItemDraft;
  onEdit: (draft: WorkItemDraft) => void;
  onDuplicate: (draft: WorkItemDraft) => void;
  onMoveToProject: (draft: WorkItemDraft) => void;
  onDelete: (draft: WorkItemDraft) => void;
}

function PriorityPillIcon({ priority }: { priority?: TaskPriority | string }) {
  switch (priority) {
    case 'urgent':
      return <UrgentPriorityBoxIcon className="size-3.5 shrink-0" />;
    case 'high':
      return <HighPriorityBoxIcon className="size-3.5 shrink-0" />;
    case 'medium':
      return <MediumPriorityBoxIcon className="size-3.5 shrink-0" />;
    case 'low':
      return <LowPriorityBoxIcon className="size-3.5 shrink-0" />;
    default:
      return <NonePriorityBoxIcon className="size-3.5 shrink-0" />;
  }
}

export const ListItem: React.FC<ListItemProps> = ({
  draft,
  onEdit,
  onDuplicate,
  onMoveToProject,
  onDelete,
}) => {
  const title = draft.title?.trim() || 'Untitled draft';
  const projectIdentifier =
    draft.project?.identifier?.toUpperCase() ||
    draft.project?.name?.toUpperCase() ||
    'WORKSPACE';

  const priorityLabel = draft.priority || 'none';
  const stateLabel = draft.columnId
    ? draft.columnId.charAt(0).toUpperCase() + draft.columnId.slice(1).replace(/_/g, ' ')
    : 'Backlog';

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onEdit(draft);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onEdit(draft)}
      onKeyDown={handleKeyDown}
      className="group flex items-center justify-between gap-4 px-4 min-h-11 border-b border-border hover:bg-muted transition-colors duration-150 cursor-pointer bg-background focus-visible:outline-none focus-visible:bg-muted"
    >
      {/* Left: Project Identifier & Title */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <span className="font-mono text-12 font-medium text-muted-foreground w-28 shrink-0 truncate select-none">
          {projectIdentifier}
        </span>
        <span
          title={title}
          className={`text-13 leading-5 truncate ${
            !draft.title?.trim() ? 'italic text-muted-foreground' : 'text-foreground font-normal'
          }`}
        >
          {title}
        </span>
      </div>

      {/* Right: Property Pills & Quick Actions Row */}
      <div className="flex items-center gap-2 shrink-0 select-none">
        {/* State pill with dynamic StatusIcon */}
        <div className="h-6 px-2 rounded-md border border-border bg-background text-11 text-muted-foreground inline-flex items-center gap-1.5 shrink-0">
          <StatusIcon title={stateLabel} id={draft.columnId || undefined} className="size-3.5 shrink-0" />
          <span>{stateLabel}</span>
        </div>

        {/* Priority pill with pixel-perfect Priority Box Icon */}
        <div className="h-6 px-2 rounded-md border border-border bg-background text-11 text-muted-foreground capitalize inline-flex items-center gap-1.5 shrink-0">
          <PriorityPillIcon priority={draft.priority} />
          <span>{priorityLabel}</span>
        </div>

        {/* Labels pill / icon */}
        <div
          title={draft.labels?.length ? draft.labels.join(', ') : 'Labels'}
          className="size-6 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center shrink-0 transition-colors"
        >
          <Tag className="size-3.5 shrink-0" />
        </div>

        {/* Start date icon */}
        <div
          title={draft.startDate ? `Start: ${draft.startDate.split('T')[0]}` : 'Start date'}
          className="size-6 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center shrink-0 transition-colors"
        >
          <Calendar className="size-3.5 shrink-0" />
        </div>

        {/* Due date icon */}
        <div
          title={draft.dueDate ? `Due: ${draft.dueDate.split('T')[0]}` : 'Due date'}
          className="size-6 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center shrink-0 transition-colors"
        >
          <Calendar className="size-3.5 shrink-0" />
        </div>

        {/* Assignee icon */}
        <div
          title="Assignee"
          className="size-6 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center shrink-0 transition-colors"
        >
          <User className="size-3.5 shrink-0" />
        </div>

        {/* Quick action: Edit inline button visible on hover on md+ screens */}
        <div
          onClick={(e) => {
            e.stopPropagation();
            onEdit(draft);
          }}
          title="Edit draft"
          className="size-6 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground hidden sm:flex items-center justify-center shrink-0 transition-colors cursor-pointer"
        >
          <Pencil className="size-3.5 shrink-0" />
        </div>

        {/* Overflow Actions Dropdown */}
        <div onClick={(e) => e.stopPropagation()} className="shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted p-0 cursor-pointer"
              >
                <MoreHorizontal className="size-3.5 shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 bg-background border border-border">
              <DropdownMenuItem onClick={() => onEdit(draft)} className="gap-2 cursor-pointer text-12">
                <Pencil className="size-3.5 shrink-0" />
                Edit draft
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDuplicate(draft)} className="gap-2 cursor-pointer text-12">
                <Copy className="size-3.5 shrink-0" />
                Make a copy
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onMoveToProject(draft)} className="gap-2 cursor-pointer text-12">
                <FolderInput className="size-3.5 shrink-0" />
                Move to project
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-border" />
              <DropdownMenuItem
                onClick={() => onDelete(draft)}
                className="gap-2 text-destructive focus:text-destructive cursor-pointer text-12"
              >
                <Trash2 className="size-3.5 shrink-0" />
                Delete draft
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
};

export default ListItem;
