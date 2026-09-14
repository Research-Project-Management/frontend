'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { Puzzle, Loader2 } from 'lucide-react';
import { TopBar } from '../components/layout/TopBar';
import { ZoteroConnectionPanel } from '../integrations/zotero/components/zotero-connection-panel';
import { ZoteroConflictInbox } from '../integrations/zotero/components/zotero-conflict-inbox';
import { useWorkspace } from '@/features/workspaces/shell/hooks/use-workspace';

export default function IntegrationsPage() {
  const params = useParams();
  const rawId = params?.workspaceId || params?.projectId;
  const urlId = typeof rawId === 'string' ? rawId : Array.isArray(rawId) ? rawId[0] : undefined;
  const { workspace, isLoading } = useWorkspace(urlId);
  const workspaceId = workspace?.id || urlId || 'flux';

  if (isLoading) {
    return (
      <div className="flex h-full w-full flex-col bg-background">
        <TopBar title="Integrations" Icon={Puzzle} />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col bg-background">
      <TopBar
        title="Integrations"
        description="Configure external reference managers and bidirectional synchronization pipelines."
        Icon={Puzzle}
      />

      <div className="flex-1 overflow-y-auto p-6 md:p-8">
        <div className="w-full max-w-5xl mx-auto space-y-6">
          <ZoteroConnectionPanel workspaceId={workspaceId} />

          <ZoteroConflictInbox workspaceId={workspaceId} />
        </div>
      </div>
    </div>
  );
}
