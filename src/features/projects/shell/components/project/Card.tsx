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
  Tag,
  Copy,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/components/ui";
import { ProjectAvatar } from "@/shared/components/ui";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/shared/components/ui";
import { cn } from "@/shared/lib/utils";
import { useFavorites } from '../../hooks/use-favorites';
import { useArchiveProject, useDuplicateProject } from '../../hooks/use-project';
import {
  getProjectKey,
  getBannerGradient,
  isProjectPrivate,
} from '../../utils/projects-page.util';
import type { Project } from '../../types/project.types';

export type CardProps = {
  project: Project;
  onArchive?: (projectId: string) => void;
  onManageTags?: (project: Project) => void;
};

export function Card({ project, onArchive, onManageTags }: CardProps) {
  const projectId = project.id || '';
  const projectKey = (project as any).key || project.identifier || getProjectKey(project.name);
  const isPrivate = isProjectPrivate(project);

  const { isFavorite, toggleFavorite } = useFavorites();
  const favorited = isFavorite(projectId);

  const archiveProjectMutation = useArchiveProject();
  const duplicateProjectMutation = useDuplicateProject();
  const canArchive = project.permissions?.canArchive ?? (project.yourRole === 'owner');

  // Find lead from members or creator
  const leadMember = project.members?.find(
    (m: any) => m.role === 'owner' || m.role === 'lead'
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
      const url = `${window.location.origin}/projects/${projectId}/work-items`;
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
    <div className="group relative flex flex-col rounded-lg border border-border bg-card overflow-hidden transition-all duration-200 hover:border-border min-w-0">
      {/* Banner / Cover Header */}
      <div className={cn('relative h-24 w-full bg-gradient-to-tr overflow-hidden', bannerClass)}>
        <div className="absolute inset-0 bg-background/20 backdrop-blur-[0.5px]" />

        {/* Favorite & Options Quick Actions */}
        <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
          <button
            type="button"
            onClick={handleToggleStar}
            className={cn(
              'size-7 rounded-md flex items-center justify-center transition-all cursor-pointer',
              favorited
                ? 'text-warning bg-muted backdrop-blur-xs'
                : 'text-foreground hover:bg-muted opacity-0 group-hover:opacity-100 backdrop-blur-xs'
            )}
            title={favorited ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Star className={cn('size-3.5 shrink-0', favorited && 'fill-warning')} />
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="size-7 rounded-md flex items-center justify-center text-foreground hover:bg-muted transition-all opacity-0 group-hover:opacity-100 cursor-pointer backdrop-blur-xs"
                title="Project options"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="size-4 shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 p-1 text-xs">
              <DropdownMenuItem
                onClick={handleCopyLink}
                className="cursor-pointer font-medium flex items-center gap-2"
              >
                <Link2 className="size-3.5 shrink-0" />
                <span>Copy link</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onManageTags?.(project);
                }}
                className="cursor-pointer font-medium flex items-center gap-2"
              >
                <Tag className="size-3.5 shrink-0 text-muted-foreground" />
                <span>Manage Tags & Folders</span>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="cursor-pointer font-medium">
                <Link
                  href={`/projects/${projectId}/settings`}
                  className="flex items-center gap-2 w-full shrink-0"
                >
                  <Settings className="size-3.5 shrink-0" />
                  <span>Settings</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  duplicateProjectMutation.mutate({ projectId });
                }}
                disabled={duplicateProjectMutation.isPending}
                className="cursor-pointer font-medium flex items-center gap-2"
              >
                <Copy className="size-3.5 shrink-0 text-muted-foreground" />
                <span>{duplicateProjectMutation.isPending ? 'Duplicating…' : 'Duplicate project'}</span>
              </DropdownMenuItem>
              {canArchive && (
                <DropdownMenuItem
                  onClick={handleArchive}
                  className="cursor-pointer font-medium text-warning flex items-center gap-2"
                >
                  <Archive className="size-3.5 shrink-0" />
                  <span>Archive project</span>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Avatar Icon Badge (overlapping banner bottom) */}
      <div className="absolute top-16 left-4 size-10 rounded-lg bg-background border border-border flex items-center justify-center shrink-0 overflow-hidden shadow-xs">
        <ProjectAvatar avatar={project.avatar} name={project.name} id={projectId} size="lg" />
      </div>

      {/* Card Body */}
      <div className="pt-6 px-4 pb-4 flex flex-col justify-between flex-1 gap-3 min-w-0">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <Link
              href={`/projects/${projectId}/work-items`}
              className="text-sm font-semibold text-foreground tracking-tight truncate block hover:underline shrink-0"
            >
              {project.name}
            </Link>
            <span className="text-xs font-mono font-medium text-muted-foreground px-1 py-0.2 rounded bg-muted border border-border shrink-0">
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

          {/* Project Tags */}
          {project.projectLabelsList && project.projectLabelsList.length > 0 && (
            <div className="flex flex-wrap items-center gap-1 pt-1.5 min-w-0">
              {project.projectLabelsList.slice(0, 3).map((label) => (
                <span
                  key={label.id}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-10 font-medium border shrink-0"
                  style={{
                    backgroundColor: `${label.color}15`,
                    borderColor: `${label.color}35`,
                    color: label.color,
                  }}
                >
                  <span
                    className="size-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: label.color }}
                  />
                  <span className="truncate max-w-[90px]">{label.name}</span>
                </span>
              ))}
              {project.projectLabelsList.length > 3 && (
                <span className="text-10 text-muted-foreground font-mono px-1 py-0.5 rounded bg-muted border border-border">
                  +{project.projectLabelsList.length - 3}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Card Footer Info: Visibility & Members/Lead */}
        <div className="pt-2 border-t border-border flex items-center justify-between text-xs text-muted-foreground min-w-0">
          {/* Left: Visibility */}
          <div className="flex items-center gap-1.5 shrink-0">
            {isPrivate ? (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground font-medium">
                <Lock className="size-3 shrink-0" />
                <span>Private</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground font-medium">
                <Globe className="size-3 shrink-0" />
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
                  <AvatarFallback className="text-xs bg-muted font-medium">
                    {leadUser.name ? leadUser.name.charAt(0).toUpperCase() : 'U'}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs font-medium text-foreground truncate max-w-[80px]">
                  {leadUser.name || 'Lead'}
                </span>
              </div>
            ) : membersList.length > 0 ? (
              <div className="flex -space-x-1.5 overflow-hidden">
                {(Array.isArray(membersList) ? membersList : []).slice(0, 3).map((m: any, idx: number) => {
                  const u = m.user || {};
                  return (
                    <Avatar key={u.id || idx} className="size-4.5 border border-background shrink-0">
                      <AvatarImage src={u.avatar} alt={u.name} />
                      <AvatarFallback className="text-xs bg-muted font-medium">
                        {u.name ? u.name.charAt(0).toUpperCase() : 'U'}
                      </AvatarFallback>
                    </Avatar>
                  );
                })}
                {extraMembersCount > 0 && (
                  <span className="flex size-4.5 items-center justify-center rounded-full bg-muted text-xs font-medium border border-background">
                    +{extraMembersCount}
                  </span>
                )}
              </div>
            ) : (
              <span className="text-xs text-muted-foreground/60 italic">No members</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Card;
