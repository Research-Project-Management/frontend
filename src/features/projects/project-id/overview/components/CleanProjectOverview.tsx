'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  FolderKanban,
  FileText,
  BookOpen,
  MessageSquare,
  ArrowUpRight,
  Settings,
  Layers,
  HardDrive,
  TrendingUp,
  Microscope,
} from 'lucide-react';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import type { ProjectOverviewData } from '../types/overview.types';
import { WorkItemProgressCard } from './WorkItemProgressCard';
import { ProjectStatusCard } from './ProjectStatusCard';
import { ProjectPropertiesSidebar } from './ProjectPropertiesSidebar';
import { RecentActivityList } from './RecentActivityList';
import { AddStatusUpdateModal } from './AddStatusUpdateModal';
import { useCreateProjectStatusUpdate } from '../hooks/use-project-overview';

export interface CleanProjectOverviewProps {
  data: ProjectOverviewData;
}

export function CleanProjectOverview({ data }: CleanProjectOverviewProps) {
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const { project, metrics, recentActivities, currentUpdate, assets } = data;
  const createUpdateMutation = useCreateProjectStatusUpdate(project.id);

  const pagesCount = assets?.pagesCount ?? 0;
  const libraryCount = assets?.libraryCount ?? 0;
  const filesCount = assets?.filesCount ?? 0;

  return (
    <div className="max-w-6xl mx-auto w-full flex flex-col gap-6 py-2 px-1">
      {/* 1. PROJECT HERO / HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-border/60">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="size-12 rounded-xl border border-border bg-muted/40 flex items-center justify-center text-foreground font-semibold text-lg select-none shrink-0 overflow-hidden shadow-2xs">
            {project.avatar ? (
              <span className="text-2xl">{project.avatar}</span>
            ) : (
              <FolderKanban className="size-6 text-muted-foreground" strokeWidth={1.5} />
            )}
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-20 font-semibold tracking-tight text-foreground truncate">
                {project.name}
              </h1>
              <Badge
                variant="outline"
                className="h-5 px-1.5 text-11 font-mono font-medium text-muted-foreground bg-muted/30 border-border/80"
              >
                {project.identifier}
              </Badge>
            </div>
            {project.description ? (
              <p className="text-13 text-muted-foreground truncate max-w-2xl mt-0.5">
                {project.description}
              </p>
            ) : null}
          </div>
        </div>

        {/* Quick Project Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <Button
            asChild
            variant="outline"
            size="sm"
            className="h-8 px-2.5 text-12 font-medium border-border hover:bg-muted"
          >
            <Link href={`/projects/${project.id}/work-items`}>
              <Layers className="size-3.5 mr-1.5 text-muted-foreground" />
              <span>Work Items</span>
            </Link>
          </Button>

          <Button
            asChild
            variant="outline"
            size="sm"
            className="h-8 px-2.5 text-12 font-medium border-border hover:bg-muted"
          >
            <Link href={`/projects/${project.id}/experiments`}>
              <Microscope className="size-3.5 mr-1.5 text-muted-foreground" />
              <span>Experiments</span>
            </Link>
          </Button>

          <Button
            asChild
            variant="outline"
            size="sm"
            className="h-8 px-2.5 text-12 font-medium border-border hover:bg-muted"
          >
            <Link href={`/projects/${project.id}/analytics`}>
              <TrendingUp className="size-3.5 mr-1.5 text-muted-foreground" />
              <span>Analytics</span>
            </Link>
          </Button>

          <Button
            asChild
            variant="outline"
            size="sm"
            className="h-8 px-2.5 text-12 font-medium border-border hover:bg-muted"
          >
            <Link href={`/projects/${project.id}/messages`}>
              <MessageSquare className="size-3.5 mr-1.5 text-muted-foreground" />
              <span>Chat</span>
            </Link>
          </Button>

          <Button
            asChild
            variant="ghost"
            size="sm"
            className="h-8 size-8 p-0 text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <Link href={`/projects/${project.id}/settings`}>
              <Settings className="size-4" />
              <span className="sr-only">Project Settings</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* 2. RESEARCH ASSETS BAR (Pages & Manuscripts, Storage & Lab Data, Literature & Citations, Analytics) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Manuscripts & Pages */}
        <Link
          href={`/projects/${project.id}/pages`}
          className="group flex items-center justify-between p-3.5 rounded-lg border border-border/70 bg-card hover:border-primary/40 hover:bg-muted/30 transition-all shadow-2xs"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="size-9 rounded-md bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0 group-hover:scale-105 transition-transform">
              <FileText className="size-4" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-13 font-semibold text-foreground group-hover:text-primary transition-colors">
                Manuscripts & Docs
              </span>
              <span className="text-11 text-muted-foreground truncate font-mono">
                {pagesCount > 0 ? `${pagesCount} LaTeX documents` : 'No documents yet'}
              </span>
            </div>
          </div>
          <ArrowUpRight className="size-4 text-muted-foreground/60 group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all shrink-0" />
        </Link>

        {/* Research Experiments & Datasets */}
        <Link
          href={`/projects/${project.id}/experiments`}
          className="group flex items-center justify-between p-3.5 rounded-lg border border-border/70 bg-card hover:border-primary/40 hover:bg-muted/30 transition-all shadow-2xs"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="size-9 rounded-md bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-600 dark:text-sky-400 shrink-0 group-hover:scale-105 transition-transform">
              <Microscope className="size-4" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-13 font-semibold text-foreground group-hover:text-primary transition-colors">
                Experiments & Data
              </span>
              <span className="text-11 text-muted-foreground truncate font-mono">
                {filesCount > 0 ? `${filesCount} runs & datasets` : 'Model runs & datasets'}
              </span>
            </div>
          </div>
          <ArrowUpRight className="size-4 text-muted-foreground/60 group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all shrink-0" />
        </Link>

        {/* References & Citations */}
        <Link
          href="/library"
          className="group flex items-center justify-between p-3.5 rounded-lg border border-border/70 bg-card hover:border-primary/40 hover:bg-muted/30 transition-all shadow-2xs"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="size-9 rounded-md bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0 group-hover:scale-105 transition-transform">
              <BookOpen className="size-4" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-13 font-semibold text-foreground group-hover:text-primary transition-colors">
                Literature & Citations
              </span>
              <span className="text-11 text-muted-foreground truncate font-mono">
                {libraryCount > 0 ? `${libraryCount} indexed references` : 'Curate citations'}
              </span>
            </div>
          </div>
          <ArrowUpRight className="size-4 text-muted-foreground/60 group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all shrink-0" />
        </Link>

        {/* Analytics & Research Velocity */}
        <Link
          href={`/projects/${project.id}/analytics`}
          className="group flex items-center justify-between p-3.5 rounded-lg border border-border/70 bg-card hover:border-primary/40 hover:bg-muted/30 transition-all shadow-2xs"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="size-9 rounded-md bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-600 dark:text-violet-400 shrink-0 group-hover:scale-105 transition-transform">
              <TrendingUp className="size-4" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-13 font-semibold text-foreground group-hover:text-primary transition-colors">
                Analytics & Velocity
              </span>
              <span className="text-11 text-muted-foreground truncate">
                Metrics & team velocity
              </span>
            </div>
          </div>
          <ArrowUpRight className="size-4 text-muted-foreground/60 group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all shrink-0" />
        </Link>
      </div>

      {/* 3. TWO-COLUMN MAIN CONTENT (Work Items Progress & Health on Left, Properties & Team on Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-1">
        {/* Left Column (8 cols): Progress, Health, and Activity */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          {/* Work Item Progress Card */}
          <WorkItemProgressCard
            projectId={project.id}
            metrics={metrics}
          />

          {/* Project Status & Health Card */}
          <ProjectStatusCard
            projectId={project.id}
            currentUpdate={currentUpdate}
            isModalOpen={isStatusModalOpen}
            onModalOpenChange={setIsStatusModalOpen}
          />

          {/* Recent Activity Feed */}
          <RecentActivityList activities={recentActivities} />
        </div>

        {/* Right Column (4 cols): Project Properties & Team Members */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <ProjectPropertiesSidebar
            project={project}
            currentUpdate={currentUpdate}
          />
        </div>
      </div>

      {/* Status Update Modal */}
      {isStatusModalOpen && (
        <AddStatusUpdateModal
          open={isStatusModalOpen}
          onOpenChange={setIsStatusModalOpen}
          onSubmit={async (updateData) => {
            await createUpdateMutation.mutateAsync(updateData);
            setIsStatusModalOpen(false);
          }}
        />
      )}
    </div>
  );
}

export default CleanProjectOverview;
