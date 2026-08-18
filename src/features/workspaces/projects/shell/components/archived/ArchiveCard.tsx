'use client';

import React from 'react';
import Link from 'next/link';
import {
  Archive,
  RotateCcw,
  Trash2,
  Lock,
  Globe,
  UserSquare2,
} from 'lucide-react';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/shared/components/ui';
import { cn } from '@/shared/lib/utils';
import {
  getProjectKey,
  isProjectPrivate,
} from '../../utils/projects-page.util';
import { getArchiveBannerGradient } from '../../utils/archive-page.util';
import type { Project } from '../../types/project.types';

export type ArchiveCardProps = {
  project: Project;
  workspaceId: string;
  onRestore: (projectId: string, e: React.MouseEvent) => void;
  onDeletePermanent: (project: Project, e: React.MouseEvent) => void;
  isRestoring?: boolean;
};

export function ArchiveCard({
  project,
  workspaceId,
  onRestore,
  onDeletePermanent,
  isRestoring,
}: ArchiveCardProps) {
  const projectId = project.id || '';
  const projectKey = (project as any).key || project.identifier || getProjectKey(project.name);
  const isPrivate = isProjectPrivate(project);

  const leadMember = project.members?.find(
    (m: any) => m.role === 'manager' || m.role === 'lead' || m.role === 'owner' || m.role === 'admin'
  );
  const leadUser =
    leadMember?.user ||
    (project.createdBy?.id ? project.createdBy : null);
  const bannerClass = getArchiveBannerGradient(projectId || 'default');

  return (
    <div
      key={projectId}
      className="group relative flex flex-col rounded-lg border border-border/70 bg-card/60 grayscale-30 hover:grayscale-0 overflow-hidden shadow-xs transition-all duration-200 hover:shadow-md hover:border-border min-w-0"
    >
      {/* Banner */}
      <div className={cn('relative h-24 w-full bg-gradient-to-tr overflow-hidden', bannerClass)}>
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[0.5px]" />
        <div className="absolute top-2 right-2">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-amber-500/20 text-amber-500 border border-amber-500/30 backdrop-blur-xs">
            <Archive className="size-2.5" />
            <span>Archived</span>
          </span>
        </div>
      </div>

      {/* Avatar */}
      <div className="absolute top-16 left-4 size-10 rounded-lg bg-background border border-border shadow-xs flex items-center justify-center text-xl shrink-0">
        {project.avatar ? (
          <span>{project.avatar}</span>
        ) : (
          <span className="text-sm font-bold text-foreground">
            {project.name ? project.name.charAt(0).toUpperCase() : 'P'}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="pt-6 px-4 pb-4 flex flex-col justify-between flex-1 gap-3 min-w-0">
        <div className="space-y-0.5 min-w-0">
          <Link
            href={`/${workspaceId}/projects/${projectId}/overview`}
            className="text-sm font-semibold text-foreground tracking-tight truncate block hover:underline"
          >
            {project.name}
          </Link>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-mono text-[10px] uppercase">{projectKey}</span>
            <span>•</span>
            <span className="flex items-center gap-1">
              {isPrivate ? (
                <>
                  <Lock className="size-3" />
                  <span>Private</span>
                </>
              ) : (
                <>
                  <Globe className="size-3" />
                  <span>Public</span>
                </>
              )}
            </span>
          </div>
        </div>

        {project.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
            {project.description}
          </p>
        )}

        {/* Lead & Actions */}
        <div className="pt-2 border-t border-border/40 flex items-center justify-between gap-2 min-w-0">
          {/* Lead */}
          <div className="flex items-center gap-1 min-w-0">
            {leadUser ? (
              <div className="flex items-center gap-1 min-w-0">
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
            ) : (
              <span className="text-[11px] text-muted-foreground/60 italic">No lead</span>
            )}
          </div>

          {/* Actions: Restore & Delete Permanently */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={(e) => onRestore(projectId, e)}
              disabled={isRestoring}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-foreground hover:bg-muted/80 transition-colors cursor-pointer disabled:opacity-50"
              title="Restore project to workspace"
            >
              <RotateCcw className="size-3" />
              <span>Restore</span>
            </button>

            <button
              type="button"
              onClick={(e) => onDeletePermanent(project, e)}
              className="flex items-center justify-center size-7 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
              title="Delete permanently"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ArchiveCard;
