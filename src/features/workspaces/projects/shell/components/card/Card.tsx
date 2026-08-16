'use client';

import React from "react";
import Link from "next/link";
import { Lock, Globe, UserSquare2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/components/ui";
import { cn } from "@/shared/lib/utils";
import type { Project } from "../../types/project.types";

type CardProps = {
  project: Project;
  workspaceId: string;
};

// Curated cover banner gradients matching academic sanctuary design
const BANNER_GRADIENTS = [
  "from-blue-600/90 via-sky-600/80 to-indigo-800",
  "from-teal-600/90 via-emerald-600/80 to-cyan-800",
  "from-amber-600/90 via-orange-600/80 to-stone-800",
  "from-slate-700 via-zinc-800 to-neutral-900",
  "from-cyan-600/90 via-blue-600/80 to-slate-800",
  "from-sky-700 via-slate-800 to-stone-900",
];

function getProjectKey(name: string): string {
  if (!name) return "PROJ";
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) {
    return (words[0].substring(0, 3) + words[1].substring(0, 2)).toUpperCase();
  }
  return name.substring(0, 5).toUpperCase();
}

function getBannerGradient(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % BANNER_GRADIENTS.length;
  return BANNER_GRADIENTS[index];
}

export function Card({ project, workspaceId }: CardProps) {
  const projectKey = (project as any).key || getProjectKey(project.name);
  const isPrivate = (project as any).settings?.isPrivate ?? false;

  // Find lead from members or creator
  const leadMember = project.members?.find(
    (m: any) => m.role === "manager" || m.role === "lead" || m.role === "owner",
  );
  const leadUser = leadMember?.user || (project.createdBy?._id ? project.createdBy : null);

  const bannerClass = getBannerGradient(project._id);

  return (
    <Link
      href={`/${workspaceId}/projects/${project._id}/overview`}
      className="group relative flex flex-col rounded-lg border border-border bg-card overflow-hidden shadow-xs transition-all duration-200 hover:shadow-md hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      {/* Banner */}
      <div className={cn("relative h-24 w-full bg-gradient-to-tr overflow-hidden", bannerClass)}>
        <div className="absolute inset-0 bg-black/20 backdrop-blur-[0.5px]" />
        {/* Subtle mesh wave overlay */}
        <div className="absolute inset-0 opacity-30 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white/20 via-transparent to-transparent" />
      </div>

      {/* Avatar Badge overlapping banner */}
      <div className="absolute top-16 left-4 size-10 rounded-lg bg-background border border-border shadow-xs flex items-center justify-center text-xl shrink-0 transition-transform group-hover:scale-105">
        {project.avatar ? (
          <span>{project.avatar}</span>
        ) : (
          <span className="text-sm font-bold text-foreground">
            {project.name ? project.name.charAt(0).toUpperCase() : "P"}
          </span>
        )}
      </div>

      {/* Card Body */}
      <div className="pt-6 px-4 pb-4 flex flex-col justify-between flex-1 gap-3">
        {/* Title & Key */}
        <div className="space-y-0.5">
          <h3 className="text-sm font-semibold text-foreground tracking-tight truncate group-hover:text-primary transition-colors">
            {project.name}
          </h3>
          <p className="text-[11px] font-mono font-medium tracking-wide text-muted-foreground uppercase">
            {projectKey}
          </p>
        </div>

        {/* Lead */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {leadUser ? (
            <>
              <Avatar className="size-4 shrink-0">
                <AvatarImage src={leadUser.avatar} alt={leadUser.name} />
                <AvatarFallback className="text-[9px] bg-muted">
                  {leadUser.name ? leadUser.name.charAt(0).toUpperCase() : "U"}
                </AvatarFallback>
              </Avatar>
              <span className="truncate max-w-[140px]">{leadUser.name || "Lead"}</span>
            </>
          ) : (
            <>
              <UserSquare2 className="size-4 shrink-0 text-foreground" />
              <span>No lead</span>
            </>
          )}
        </div>

        {/* Status Badge */}
        <div className="pt-1 flex items-center justify-between">
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            Joined
          </span>

          {/* Privacy icon */}
          {isPrivate ? (
            <span title="Private project">
              <Lock className="size-3 text-foreground" />
            </span>
          ) : (
            <span title="Public project">
              <Globe className="size-3 text-foreground" />
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

export default Card;
