'use client';

import React from 'react';
import Link from 'next/link';
import {
  Globe,
  Lock,
  Star,
  MoreHorizontal,
  Pencil,
  Copy,
  Link as LinkIcon,
  ExternalLink,
  Trash2,
} from 'lucide-react';
import {
  Button,
  Avatar,
  AvatarFallback,
  AvatarImage,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/shared/components/ui';
import {
  ViewsOutlineIcon,
  BoardIcon,
  ListIcon,
  TableIcon,
  CalendarIcon,
  TimelineIcon,
} from '@/shared/components/icons';
import { cn } from '@/shared/lib/utils';
import { formatViewDate } from '../../utils/view-format.util';
import type { WorkItemViewItem } from '../../types/view.types';

interface ProjectViewListItemProps {
  view: WorkItemViewItem;
  projectId: string;
  onEdit: (view: WorkItemViewItem) => void;
  onDuplicate: (view: WorkItemViewItem) => void;
  onDelete: (view: WorkItemViewItem) => void;
  onToggleFavorite: (viewId: string) => void;
  onCopyLink: (view: WorkItemViewItem) => void;
}

export function ProjectViewListItem({
  view,
  projectId,
  onEdit,
  onDuplicate,
  onDelete,
  onToggleFavorite,
  onCopyLink,
}: ProjectViewListItemProps) {
  const isFavorite = Boolean(view.isFavorite);
  const isPublic = view.access === 'public';
  const viewUrl = `/projects/${projectId}/views/${view.id}`;

  const renderLayoutIcon = () => {
    switch (view.layout) {
      case 'board':
        return <BoardIcon className="size-4 text-muted-foreground group-hover:text-primary transition-colors" />;
      case 'list':
        return <ListIcon className="size-4 text-muted-foreground group-hover:text-primary transition-colors" />;
      case 'table':
        return <TableIcon className="size-4 text-muted-foreground group-hover:text-primary transition-colors" />;
      case 'calendar':
        return <CalendarIcon className="size-4 text-muted-foreground group-hover:text-primary transition-colors" />;
      case 'timeline':
        return <TimelineIcon className="size-4 text-muted-foreground group-hover:text-primary transition-colors" />;
      default:
        return <ViewsOutlineIcon className="size-4 text-muted-foreground group-hover:text-primary transition-colors" />;
    }
  };

  const creatorName = view.createdBy?.name || view.createdBy?.email || 'Member';
  const creatorInitials = creatorName.slice(0, 2).toUpperCase();

  return (
    <div className="group relative flex items-center justify-between gap-4 px-4 py-3 border-b border-border hover:bg-muted/40 transition-colors">
      {/* Left Item Details (Title, Icon, Description) */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <Link
          href={viewUrl}
          className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer focus:outline-none"
        >
          <div className="size-7 rounded-md bg-muted/60 flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors">
            {renderLayoutIcon()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-13 text-foreground group-hover:text-primary transition-colors truncate">
                {view.name}
              </span>
              <span className="text-10 font-mono uppercase px-1.5 py-0.2 rounded bg-muted/70 text-muted-foreground shrink-0">
                {view.layout}
              </span>
            </div>
            {view.description && (
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {view.description}
              </p>
            )}
          </div>
        </Link>
      </div>

      {/* Right Actionable Items (Access Icon, Creator, Date, Star, Quick Actions) */}
      <div className="flex items-center gap-3 shrink-0 text-muted-foreground">
        {/* Access level (Public / Private) */}
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="cursor-default flex items-center justify-center size-6 text-muted-foreground/80 hover:text-foreground">
                {isPublic ? (
                  <Globe className="size-3.5 text-muted-foreground hover:text-blue-500 transition-colors" />
                ) : (
                  <Lock className="size-3.5 text-muted-foreground hover:text-amber-500 transition-colors" />
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              {isPublic ? 'Public · Shared with project members' : 'Private · Only visible to you'}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Creator Avatar */}
        {view.createdBy && (
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="cursor-default">
                  <Avatar className="size-5 rounded-full border border-border">
                    {view.createdBy.avatar && (
                      <AvatarImage src={view.createdBy.avatar} alt={creatorName} />
                    )}
                    <AvatarFallback className="text-9 font-semibold bg-muted text-foreground">
                      {creatorInitials}
                    </AvatarFallback>
                  </Avatar>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                Created by {creatorName}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {/* Relative Updated Timestamp */}
        <span className="text-11 text-muted-foreground whitespace-nowrap hidden sm:inline-block">
          {formatViewDate(view.updatedAt || view.createdAt)}
        </span>

        {/* Favorite Star Button */}
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onToggleFavorite(view.id);
                }}
                className={cn(
                  'size-6 flex items-center justify-center rounded hover:bg-muted cursor-pointer transition-colors',
                  isFavorite
                    ? 'text-amber-500 fill-amber-500'
                    : 'text-muted-foreground/40 hover:text-muted-foreground'
                )}
              >
                <Star
                  className={cn(
                    'size-3.5',
                    isFavorite ? 'fill-amber-500 text-amber-500' : 'text-current'
                  )}
                />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              {isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Quick Actions Dropdown Menu (...) */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="size-7 p-0 rounded text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44 p-1">
            <DropdownMenuItem
              onClick={() => onEdit(view)}
              className="flex items-center gap-2 text-xs cursor-pointer px-2 py-1.5 rounded-sm"
            >
              <Pencil className="size-3.5 text-muted-foreground" />
              <span>Edit view</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onDuplicate(view)}
              className="flex items-center gap-2 text-xs cursor-pointer px-2 py-1.5 rounded-sm"
            >
              <Copy className="size-3.5 text-muted-foreground" />
              <span>Duplicate</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onCopyLink(view)}
              className="flex items-center gap-2 text-xs cursor-pointer px-2 py-1.5 rounded-sm"
            >
              <LinkIcon className="size-3.5 text-muted-foreground" />
              <span>Copy link</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => window.open(viewUrl, '_blank')}
              className="flex items-center gap-2 text-xs cursor-pointer px-2 py-1.5 rounded-sm"
            >
              <ExternalLink className="size-3.5 text-muted-foreground" />
              <span>Open in new tab</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="my-1" />
            <DropdownMenuItem
              onClick={() => onDelete(view)}
              className="flex items-center gap-2 text-xs cursor-pointer px-2 py-1.5 rounded-sm text-destructive focus:text-destructive focus:bg-destructive/10"
            >
              <Trash2 className="size-3.5" />
              <span>Delete view</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
