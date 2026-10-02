'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { Skeleton } from "@/shared/components/ui/skeleton";
import { FileText, LayoutGrid } from 'lucide-react';
import { WorkItemsIcon } from "@/shared/components/icons";
import TopBar from '../components/layout/TopBar';
import { Item } from '../components/module/Item';
import { useModules } from '../hooks/use-module';
import type { ModuleDef } from '../types/module.types';

// ── Module Registry ───────────────────────────────────────────────────────────

const MODULES: ModuleDef[] = [
  { id: 'work-items', label: 'Work items',  desc: 'Research activities, milestones and work item tracking', icon: WorkItemsIcon, locked: true },
  { id: 'pages',      label: 'Pages',       desc: 'Collaborative documents, notes and manuscripts', icon: FileText },
];

// ── Page ───────────────────────────────────────────────────────────────────────

export default function ModulesPage() {
  const { projectId } = useParams() as { projectId: string };
  const { active, toggle, isSaving, isLoading, isError, project } = useModules(projectId);

  if (isLoading) {
    return (
      <div className="flex flex-col h-full w-full bg-background">
        <TopBar
          title="Modules"
          Icon={LayoutGrid}
        />
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto p-5 md:p-6 space-y-6">
            <Skeleton className="h-64 w-full rounded-md" />
          </div>
        </div>
      </div>
    );
  }

  if (isError || !project) {
    return (
      <div className="flex flex-col h-full w-full bg-background">
        <TopBar
          title="Modules"
          Icon={LayoutGrid}
        />
        <div className="flex-1 p-5 md:p-6 text-sm text-muted-foreground">
          Error loading project.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full bg-background">
      <TopBar
        title="Modules"
        Icon={LayoutGrid}
      />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-5 md:p-6 space-y-6">
          {/* Module Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
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
      </div>
    </div>
  );
}
