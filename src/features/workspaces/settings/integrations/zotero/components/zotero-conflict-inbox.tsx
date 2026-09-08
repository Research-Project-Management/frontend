'use client';

import React, { useState } from 'react';
import { useZoteroIntegration } from '../hooks/use-zotero-integration';
import { useWorkspace } from '@/features/workspaces/shell/hooks/use-workspace';
import { ZoteroConflictDialog, type ConflictingField } from './zotero-conflict-dialog';
import type { ZoteroConflictItem } from '../types/zotero.types';
import {
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  Inbox,
  ArrowUpRight,
  Clock,
  Flame,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/shared/components/ui/button';

interface ZoteroConflictInboxProps {
  workspaceId: string;
  bindingId?: string;
}

export function ZoteroConflictInbox({ workspaceId, bindingId }: ZoteroConflictInboxProps) {
  const { yourRole } = useWorkspace(workspaceId);
  const isManager = yourRole === 'OWNER' || yourRole === 'ADMIN';

  const {
    conflicts,
    isLoadingConflicts,
    pendingPushes,
    isLoadingPendingPushes,
    pushItem,
    isPushingItem,
  } = useZoteroIntegration(workspaceId, bindingId);

  const [activeResolvingItem, setActiveResolvingItem] = useState<{
    item: ZoteroConflictItem;
    conflicts: ConflictingField[];
  } | null>(null);

  const [filterTab, setFilterTab] = useState<'conflicts' | 'pending'>('conflicts');
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const handleOpenResolver = (item: ZoteroConflictItem) => {
    const raw = item.rawPayload || {};
    const base = item.baseSnapshot || {};
    
    // Construct field conflicts
    const conflictingFields: ConflictingField[] = [];
    
    if (raw.title && raw.title !== item.title) {
      conflictingFields.push({
        field: 'title',
        baseValue: base.title || item.title,
        localValue: item.title,
        remoteValue: raw.title,
      });
    }

    if (raw.itemType && raw.itemType !== base.itemType) {
      conflictingFields.push({
        field: 'itemType',
        baseValue: base.itemType || 'journalArticle',
        localValue: base.itemType || 'journalArticle',
        remoteValue: raw.itemType,
      });
    }

    if (raw.DOI && raw.DOI !== base.doi) {
      conflictingFields.push({
        field: 'doi',
        baseValue: base.doi || '',
        localValue: base.doi || '',
        remoteValue: raw.DOI,
      });
    }

    if (conflictingFields.length === 0) {
      // Default fallback comparison
      conflictingFields.push({
        field: 'title',
        baseValue: base.title || item.title,
        localValue: item.title,
        remoteValue: raw.title || item.title,
      });
    }

    setActiveResolvingItem({
      item,
      conflicts: conflictingFields,
    });
  };

  const handleRetryPush = async (targetBindingId: string, itemId: string) => {
    setActionFeedback(null);
    try {
      await pushItem({ bindingId: targetBindingId, itemId });
      setActionFeedback('Push operation re-queued and executed successfully.');
    } catch (err: any) {
      setActionFeedback(`Push retry failed: ${err.message}`);
    }
  };

  return (
    <div className="rounded-md border bg-card p-6 space-y-6">
      {/* Header & Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
        <div>
          <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Inbox className="size-5 text-primary shrink-0" />
            Sync Conflict & Pending Push Inbox
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Review simultaneous modifications, resolve version discrepancies, and monitor queued outgoing writes.
          </p>
        </div>

        <div role="tablist" aria-label="Conflict inbox tabs" className="flex items-center gap-1 bg-muted p-1 rounded-lg text-xs">
          <button
            type="button"
            role="tab"
            aria-selected={filterTab === 'conflicts'}
            onClick={() => setFilterTab('conflicts')}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer ${
              filterTab === 'conflicts'
                ? 'bg-background text-foreground font-medium'
                : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            Conflicts (<span className="tabular-nums font-mono">{conflicts.length}</span>)
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filterTab === 'pending'}
            onClick={() => setFilterTab('pending')}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer ${
              filterTab === 'pending'
                ? 'bg-background text-foreground font-medium'
                : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            Pending / In-Flight (<span className="tabular-nums font-mono">{pendingPushes.length}</span>)
          </button>
        </div>
      </div>

      {actionFeedback && (
        <div className="p-3 bg-muted text-foreground text-xs rounded-lg border">
          {actionFeedback}
        </div>
      )}

      {/* Tab 1: Active Conflicts */}
      {filterTab === 'conflicts' && (
        <div className="space-y-3">
          {isLoadingConflicts ? (
            <div className="py-8 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
              <RefreshCw className="size-3.5 animate-spin shrink-0" /> Loading conflict inbox...
            </div>
          ) : conflicts.length === 0 ? (
            <div className="py-12 text-center space-y-2 border rounded-md border-dashed">
              <ShieldCheck className="size-8 text-success mx-auto opacity-80 shrink-0" />
              <div className="text-sm font-semibold text-foreground">Zero Active Conflicts</div>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                All catalog items and remote Zotero records are fully synchronized without version divergence.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {conflicts.map((c) => (
                <div
                  key={c.id}
                  className="p-4 rounded-lg border border-warning/30 bg-warning/5 flex flex-wrap items-center justify-between gap-3"
                >
                  <div className="space-y-1 max-w-lg">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-foreground">{c.title}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-warning/20 text-warning border border-warning/30">
                        Conflict Detected
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground font-mono">
                      Remote Key: {c.remoteKey} • Version: {c.remoteVersion} • Updated: {new Date(c.updatedAt).toLocaleString()}
                    </div>
                  </div>

                  {isManager && (
                    <Button
                      size="sm"
                      onClick={() => handleOpenResolver(c)}
                      className="bg-warning hover:bg-warning/90 gap-1.5 text-xs text-white"
                    >
                      <AlertTriangle className="size-3.5 shrink-0" />
                      Resolve Conflict
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Pending Pushes */}
      {filterTab === 'pending' && (
        <div className="space-y-3">
          {isLoadingPendingPushes ? (
            <div className="py-8 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
              <RefreshCw className="size-3.5 animate-spin shrink-0" /> Loading pending pushes...
            </div>
          ) : pendingPushes.length === 0 ? (
            <div className="py-12 text-center space-y-2 border rounded-md border-dashed">
              <CheckCircle2 className="size-8 text-success mx-auto opacity-80 shrink-0" />
              <div className="text-sm font-semibold text-foreground">No Pending Outgoing Pushes</div>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                No items are currently waiting to be pushed to remote Zotero libraries.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingPushes.map((p) => {
                const isFailed = p.syncState === 'failed';
                return (
                  <div
                    key={p.id}
                    className={`p-4 rounded-lg border flex flex-wrap items-center justify-between gap-3 ${
                      isFailed ? 'border-destructive/30 bg-destructive/5' : 'bg-muted'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-foreground">{p.title}</span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize border ${
                            isFailed
                              ? 'bg-destructive/10 text-destructive border-destructive/20'
                              : 'bg-primary/10 text-primary border-primary/20'
                          }`}
                        >
                          {p.syncState}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground font-mono">
                        Remote Key: {p.remoteKey} • Version: {p.remoteVersion}
                      </div>
                    </div>

                    {isManager && isFailed && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRetryPush(p.bindingId, p.itemId)}
                        disabled={isPushingItem}
                        className="gap-1.5 text-xs text-destructive hover:bg-destructive/10"
                      >
                        <RefreshCw className={`size-3.5 ${isPushingItem ? 'animate-spin' : ''}`} />
                        Retry Push
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 3-Way Conflict Resolver Dialog */}
      {activeResolvingItem && (
        <ZoteroConflictDialog
          workspaceId={workspaceId}
          bindingId={activeResolvingItem.item.bindingId}
          itemId={activeResolvingItem.item.itemId}
          itemTitle={activeResolvingItem.item.title}
          conflicts={activeResolvingItem.conflicts}
          isOpen={true}
          onClose={() => setActiveResolvingItem(null)}
          onResolved={() => {
            setActiveResolvingItem(null);
            setActionFeedback('Conflict successfully resolved and applied to database.');
          }}
        />
      )}
    </div>
  );
}
