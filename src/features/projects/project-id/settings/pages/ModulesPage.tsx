'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { Skeleton } from "@/shared/components/ui/skeleton";
import { FileText, LayoutGrid } from 'lucide-react';
import { WorkItemsIcon } from "@/shared/components/icons";
import { PageLayout, PageHeader, PageContent } from '@/shared/components/layout';
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
      <PageLayout>
        <PageHeader title="Modules" icon={LayoutGrid} />
        <PageContent maxWidth="md">
          <Skeleton className="h-64 w-full rounded-md" />
        </PageContent>
      </PageLayout>
    );
  }

  if (isError || !project) {
    return (
      <PageLayout>
        <PageHeader title="Modules" icon={LayoutGrid} />
        <PageContent maxWidth="md">
          <div className="text-sm text-muted-foreground">
            Error loading project.
          </div>
        </PageContent>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <PageHeader title="Modules" icon={LayoutGrid} />

      <PageContent maxWidth="md">
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
      </PageContent>
    </PageLayout>
  );
}
