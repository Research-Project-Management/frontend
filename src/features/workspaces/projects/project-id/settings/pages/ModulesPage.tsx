'use client';

import { useParams } from 'next/navigation';
import { Button } from '@/shared/components/ui/button';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { Loader2, LayoutDashboard, FileText, CheckSquare, HardDrive, StickyNote, RefreshCcw, BookOpen } from 'lucide-react';
import { Item } from '../components/module/Item';
import { useModules } from '../hooks/use-module';
import type { ModuleDef } from '../types/module.types';

// ── Module Registry ───────────────────────────────────────────────────────────

const MODULES: ModuleDef[] = [
  { id: 'overview',   label: 'Overview',   desc: 'Project dashboard and summary', icon: LayoutDashboard, locked: true },
  { id: 'pages',      label: 'Pages',      desc: 'Collaborative documents and notes', icon: FileText },
  { id: 'collection', label: 'Collection', desc: 'Project papers and bibliography collection', icon: BookOpen },
  { id: 'tasks',      label: 'Tasks',      desc: 'Issue tracking and work items', icon: CheckSquare },
  { id: 'cycles',     label: 'Cycles',     desc: 'Sprint-based iteration planning', icon: RefreshCcw },
  { id: 'storage',    label: 'Storage',    desc: 'File storage and attachments', icon: HardDrive },
  { id: 'stickies',   label: 'Stickies',   desc: 'Quick sticky notes', icon: StickyNote },
];

// ── Page ───────────────────────────────────────────────────────────────────────

export default function ModulesPage() {
  const { projectId } = useParams() as { projectId: string };
  const { active, toggle, hasChanges, save, isSaving, isLoading, isError, project } = useModules(projectId);

  if (isLoading) {
    return (
      <div className="px-6 md:px-10 lg:px-12 py-8 md:py-10 max-w-6xl mx-auto space-y-6">
        <Skeleton className="h-8 w-44 rounded-lg" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  if (isError || !project) {
    return <div className="px-6 md:px-10 lg:px-12 py-8 text-sm text-muted-foreground">Error loading project.</div>;
  }

  return (
    <div className="px-6 md:px-10 lg:px-12 py-8 md:py-10 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Modules</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Enable or disable features for this project.
          </p>
        </div>

        <Button
          size="sm"
          onClick={save}
          disabled={!hasChanges || isSaving}
          className="h-8 text-xs font-medium px-3.5 rounded-md bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer shadow-2xs shrink-0"
        >
          {isSaving && <Loader2 className="mr-2 size-3.5 animate-spin" />}
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
