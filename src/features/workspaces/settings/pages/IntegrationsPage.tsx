'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { Puzzle } from 'lucide-react';
import { TopBar } from '../components/layout/TopBar';
import { ZoteroConnectionPanel } from '../integrations/zotero/components/zotero-connection-panel';
import { ZoteroConflictInbox } from '../integrations/zotero/components/zotero-conflict-inbox';

export default function IntegrationsPage() {
  const params = useParams();
  const rawId = params?.workspaceId;
  const workspaceId = typeof rawId === 'string' ? rawId : Array.isArray(rawId) ? rawId[0] : '';

  if (!workspaceId) {
    return (
      <div className="flex h-full w-full flex-col bg-background">
        <TopBar title="Integrations" Icon={Puzzle} />
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="size-12 rounded-full bg-muted flex items-center justify-center mb-3">
            <Puzzle className="size-6 text-muted-foreground" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">Workspace not found</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm">
            Could not find the workspace identifier. Please select a valid workspace.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col bg-background">
      <TopBar title="Integrations" Icon={Puzzle} />

      <div className="flex-1 overflow-y-auto px-6 md:px-10 lg:px-12 py-8 md:py-10">
        <div className="w-full max-w-5xl mx-auto space-y-8">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Workspace Integrations</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Configure external integrations, reference managers, and bidirectional synchronization pipelines.
            </p>
          </div>

          <ZoteroConnectionPanel workspaceId={workspaceId} />

          <ZoteroConflictInbox workspaceId={workspaceId} />
        </div>
      </div>
    </div>
  );
}
