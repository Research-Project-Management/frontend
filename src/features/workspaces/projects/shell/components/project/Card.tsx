'use client';

import React from 'react';
import Link from 'next/link';
import {
  Lock,
  Globe,
  UserSquare2,
  Star,
  MoreHorizontal,
  Link2,
  Settings,
  Archive,
  Share2,
} from 'lucide-react';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui';
import { cn } from '@/shared/lib/utils';
import { useFavorites } from '../../hooks/use-favorites';
import { useArchiveProject } from '../../hooks/use-project';
import {
  getProjectKey,
  getBannerGradient,
  isProjectPrivate,
} from '../../utils/projects-page.util';
import type { Project } from '../../types/project.types';

export type CardProps = {
  project: Project;
  workspaceId: string;
  onArchive?: (projectId: string) => void;
};

export function Card({ project, workspaceId, onArchive }: CardProps) {
  const projectId = project.id || '';
  const projectKey = (project as any).key || project.identifier || getProjectKey(project.name);
  const isPrivate = isProjectPrivate(project);

  const { isFavorite, toggleFavorite } = useFavorites(workspaceId);
  const favorited = isFavorite(projectId);

  const archiveProjectMutation = useArchiveProject();

  // Find lead from members or creator
  const leadMember = project.members?.find(
    (m: any) => m.role === 'manager' || m.role === 'lead' || m.role === 'owner' || m.role === 'admin'
  );
  const leadUser =
    leadMember?.user ||
    (project.createdBy?.id ? project.createdBy : null);

  const membersList = project.members || [];
  const extraMembersCount = Math.max(0, membersList.length - 3);

  const bannerClass = getBannerGradient(projectId || 'default');

  const handleCopyLink = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (typeof window !== 'undefined') {
      const url = `${window.location.origin}/${workspaceId}/projects/${projectId}/overview`;
      navigator.clipboard.writeText(url);
    }
  };

  const handleToggleStar = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleFavorite(projectId);
  };

  const handleArchive = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onArchive) {
      onArchive(projectId);
    } else {
      archiveProjectMutation.mutate({ projectId });
    }
  };

  return (
    <div className="group relative flex flex-col rounded-lg border border-border bg-card overflow-hidden shadow-xs transition-all duration-200 hover:shadow-md hover:border-border min-w-0">
      {/* Banner / Cover Header */}
      <div className={cn('relative h-24 w-full bg-gradient-to-tr overflow-hidden', bannerClass)}>
        <div className="absolute inset-0 bg-black/20 backdrop-blur-[0.5px]" />

        {/* Favorite & Options Quick Actions */}
        <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
          <button
            type="button"
            onClick={handleToggleStar}
            className={cn(
              'size-7 rounded-md flex items-center justify-center transition-all cursor-pointer',
              favorited
                ? 'text-amber-400 bg-black/30 backdrop-blur-xs'
                : 'text-white/70 hover:text-white hover:bg-black/30 opacity-0 group-hover:opacity-100 backdrop-blur-xs'
            )}
            title={favorited ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Star className={cn('size-3.5', favorited && 'fill-amber-400')} />
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="size-7 rounded-md flex items-center justify-center text-white/70 hover:text-white hover:bg-black/30 transition-all opacity-0 group-hover:opacity-100 cursor-pointer backdrop-blur-xs"
                title="Project options"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="size-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 p-1 text-xs">
              <DropdownMenuItem
                onClick={handleCopyLink}
                className="cursor-pointer font-medium flex items-center gap-2"
              >
                <Link2 className="size-3.5" />
                <span>Copy link</span>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="cursor-pointer font-medium">
                <Link
                  href={`/${workspaceId}/projects/${projectId}/settings`}
                  className="flex items-center gap-2 w-full"
                >
                  <Settings className="size-3.5" />
                  <span>Settings</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleArchive}
                className="cursor-pointer font-medium text-amber-600 dark:text-amber-400 flex items-center gap-2"
              >
                <Archive className="size-3.5" />
                <span>Archive project</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Avatar Icon Badge (overlapping banner bottom) */}
      <div className="absolute top-16 left-4 size-10 rounded-lg bg-background border border-border shadow-xs flex items-center justify-center text-xl shrink-0">
        {project.avatar ? (
          <span>{project.avatar}</span>
        ) : (
          <span className="text-sm font-bold text-foreground">
            {project.name ? project.name.charAt(0).toUpperCase() : 'P'}
          </span>
        )}
      </div>

      {/* Card Body */}
      <div className="pt-6 px-4 pb-4 flex flex-col justify-between flex-1 gap-3 min-w-0">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <Link
              href={`/${workspaceId}/projects/${projectId}/overview`}
              className="text-sm font-semibold text-foreground tracking-tight truncate block hover:underline"
            >
              {project.name}
            </Link>
            <span className="text-[10px] font-mono font-medium text-muted-foreground uppercase px-1 py-0.2 rounded bg-muted/60 border border-border/40 shrink-0">
              {projectKey}
            </span>
          </div>

          {project.description ? (
            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
              {project.description}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground/50 italic">No description provided</p>
          )}
        </div>

        {/* Card Footer Info: Visibility & Members/Lead */}
        <div className="pt-2 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground min-w-0">
          {/* Left: Visibility */}
          <div className="flex items-center gap-1.5 shrink-0">
            {isPrivate ? (
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground font-medium">
                <Lock className="size-3" />
                <span>Private</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground font-medium">
                <Globe className="size-3" />
                <span>Public</span>
              </span>
            )}
          </div>

          {/* Right: Lead or Member Avatars Stack */}
          <div className="flex items-center gap-1.5 shrink-0">
            {leadUser ? (
              <div className="flex items-center gap-1">
                <Avatar className="size-4.5 border border-background shrink-0">
                  <AvatarImage src={leadUser.avatar} alt={leadUser.name} />
                  <AvatarFallback className="text-[9px] bg-muted font-medium">
                    {leadUser.name ? leadUser.name.charAt(0).toUpperCase() : 'U'}
                  </AvatarFallback>
                </Avatar>
                <span className="text-[11px] font-medium text-foreground truncate max-w-[80px]">
                  {leadUser.name || 'Lead'}
                </span>
              </div>
            ) : membersList.length > 0 ? (
              <div className="flex -space-x-1.5 overflow-hidden">
                {membersList.slice(0, 3).map((m: any, idx: number) => {
                  const u = m.user || {};
                  return (
                    <Avatar key={u.id || idx} className="size-4.5 border border-background">
                      <AvatarImage src={u.avatar} alt={u.name} />
                      <AvatarFallback className="text-[9px] bg-muted font-medium">
                        {u.name ? u.name.charAt(0).toUpperCase() : 'U'}
                      </AvatarFallback>
                    </Avatar>
                  );
                })}
                {extraMembersCount > 0 && (
                  <span className="flex size-4.5 items-center justify-center rounded-full bg-muted text-[9px] font-medium border border-background">
                    +{extraMembersCount}
                  </span>
                )}
              </div>
            ) : (
              <span className="text-[11px] text-muted-foreground/60 italic">No members</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Card;
