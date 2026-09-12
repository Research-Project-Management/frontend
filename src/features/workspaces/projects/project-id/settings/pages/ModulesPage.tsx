'use client';

import { useParams } from 'next/navigation';
import { Button } from "@/shared/components/ui";
import { Skeleton } from "@/shared/components/ui";
import { Loader2, LayoutDashboard, FileText, HardDrive } from 'lucide-react';
import { WorkItemsIcon } from "@/shared/components/ui";
import { StickiesIcon } from "@/shared/components/ui";
import { Item } from '../components/module/Item';
import { useModules } from '../hooks/use-module';
import type { ModuleDef } from '../types/module.types';

// ── Module Registry ───────────────────────────────────────────────────────────

const MODULES: ModuleDef[] = [
  { id: 'overview',   label: 'Overview',   desc: 'Project dashboard, activity feed and progress summary', icon: LayoutDashboard, locked: true },
  { id: 'tasks',      label: 'Work items', desc: 'Research activities, milestones and task tracking', icon: WorkItemsIcon },
  { id: 'pages',      label: 'Pages',      desc: 'Collaborative documents, notes and manuscripts', icon: FileText },
  { id: 'stickies',   label: 'Stickies',   desc: 'Quick scratchpad notes and research ideas', icon: StickiesIcon },
  { id: 'storage',    label: 'Storage',    desc: 'Research datasets, file storage and attachments', icon: HardDrive },
];

// ── Page ───────────────────────────────────────────────────────────────────────

export default function ModulesPage() {
  const { projectId } = useParams() as { projectId: string };
  const { active, toggle, hasChanges, save, isSaving, isLoading, isError, project } = useModules(projectId);

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto p-6 md:p-8 space-y-6">
        <Skeleton className="h-8 w-44 rounded-md" />
        <Skeleton className="h-64 w-full rounded-md" />
      </div>
    );
  }

  if (isError || !project) {
    return <div className="max-w-5xl mx-auto p-6 md:p-8 text-sm text-muted-foreground">Error loading project.</div>;
  }

  return (
    <div className="max-w-5xl mx-auto p-6 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">Modules</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Enable or disable features for this project.
          </p>
        </div>

        <Button
          size="sm"
          onClick={save}
          disabled={!hasChanges || isSaving}
          className="h-8 text-xs font-medium px-3.5 rounded-md bg-primary hover:bg-primary-hover text-primary-foreground cursor-pointer shadow-none shrink-0"
        >
          {isSaving && <Loader2 className="mr-1.5 size-3.5 animate-spin shrink-0" />}
          Save changes
        </Button>
      </div>

      {/* Module Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {MODULES.map((mod) => (
          <Item
            key={mod.id}
            mod={mod}
            active={active.includes(mod.id)}
            disabled={isSaving}
            onToggle={() => toggle(mod.id)}
          />
        ))}
      </div>
    </div>
  );
}
