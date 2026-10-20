'use client';

import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Check, RefreshCw, ExternalLink, FolderOpen, GitCompare, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { ZoteroIcon, MendeleyIcon } from '@/shared/components/icons/IntegrationIcons';
import {
  useIntegrations,
  useRemoteCollections,
} from '@/features/settings/hooks/use-integrations';
import { integrationService } from '@/features/settings/services/integration.service';
import { IngestionService } from '@/features/library/sdk/library.client';
import { itemKeys } from '@/features/library/sdk/query-keys';
import { invalidateCollections } from '@/features/library/sdk/queries/collections.queries';
import { pollIngestionRunCompletion } from '@/features/library/sdk';
import type { Collection } from '@/features/library/domain/types/library.types';

export interface ExternalLibrarySyncModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultProvider?: 'zotero' | 'mendeley';
  scopeId?: string;
  collections?: Collection[];
  defaultCollectionId?: string | null;
}

export default function ExternalLibrarySyncModal({
  open,
  onOpenChange,
  defaultProvider = 'zotero',
  scopeId = 'user',
  collections = [],
  defaultCollectionId = null,
}: ExternalLibrarySyncModalProps) {
  const queryClient = useQueryClient();
  const [provider, setProvider] = useState<'zotero' | 'mendeley'>(defaultProvider);
  const [selectedRemoteCollection, setSelectedRemoteCollection] = useState<string>('all');
  const [targetCollectionId, setTargetCollectionId] = useState<string>(
    defaultCollectionId || '__root__',
  );
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    if (defaultProvider) {
      setProvider(defaultProvider);
    }
  }, [defaultProvider]);

  useEffect(() => {
    setTargetCollectionId(defaultCollectionId || '__root__');
  }, [defaultCollectionId]);

  const { integrations, connect, isConnecting, disconnect, isDisconnecting } =
    useIntegrations();

  const currentIntegration = integrations.find((i) => i.provider === provider);
  const isConnected =
    currentIntegration?.status === 'connected' &&
    !currentIntegration.needsReconnect;

  const {
    data: remoteCollections = [],
    isLoading: isLoadingRemoteCollections,
    refetch: refetchCollections,
  } = useRemoteCollections(provider, Boolean(open && isConnected));

  useEffect(() => {
    if (remoteCollections.length > 0 && !selectedRemoteCollection) {
      setSelectedRemoteCollection(remoteCollections[0]!.id);
    }
  }, [remoteCollections, selectedRemoteCollection]);

  const handleSyncToLibrary = async () => {
    if (!selectedRemoteCollection) {
      toast.warning('Please select a collection to import');
      return;
    }

    setIsSyncing(true);
    const toastId = toast.loading(
      `Fetching references from ${provider === 'zotero' ? 'Zotero' : 'Mendeley'}...`,
      { id: 'external-library-sync' },
    );

    try {
      const { bibtex } = await integrationService.getCollectionBibtex(
        provider,
        selectedRemoteCollection,
      );

      if (!bibtex || !bibtex.trim()) {
        toast.info('No references found in the selected collection.', {
          id: toastId,
        });
        return;
      }

      const destinationCollectionId =
        targetCollectionId && targetCollectionId !== '__root__'
          ? targetCollectionId
          : undefined;

      const remoteColName =
        remoteCollections.find((c) => c.id === selectedRemoteCollection)?.name ||
        'selected collection';

      const res = await IngestionService.ingest(scopeId, {
        source: 'bibtex',
        content: bibtex,
        collectionId: destinationCollectionId,
      });

      const resRecord = res as {
        data?: { runId?: string };
        runId?: string;
      } | null;
      const runId = resRecord?.data?.runId || resRecord?.runId;

      if (runId) {
        const pollOutcome = await pollIngestionRunCompletion(scopeId, runId, {
          fallbackTitle: remoteColName,
          maxWaitMs: 90000,
        });
        if (!pollOutcome.ok) {
          throw new Error(pollOutcome.error || 'Ingestion run failed to complete');
        }
      }

      await queryClient.invalidateQueries({ queryKey: itemKeys.all(scopeId) });
      await queryClient.invalidateQueries({ queryKey: itemKeys.counts(scopeId) });
      invalidateCollections(queryClient, scopeId);

      toast.success(
        `Successfully synced "${remoteColName}" into your Library!`,
        {
          description:
            'All references have been parsed, enriched, and added to your catalog.',
          id: toastId,
        },
      );
      onOpenChange(false);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Failed to sync references into Library.';
      toast.error('Library Sync Failed', {
        description: msg,
        id: toastId,
      });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] p-0 gap-0 overflow-hidden border-border bg-background">
        <DialogHeader className="px-5 pt-5 pb-3.5 border-b border-border">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
              {provider === 'zotero' ? (
                <ZoteroIcon className="size-4 shrink-0" />
              ) : (
                <MendeleyIcon className="size-4 shrink-0" />
              )}
              <span>
                Sync from {provider === 'zotero' ? 'Zotero' : 'Mendeley'} to Library
              </span>
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground pt-1">
            Import your personal or group reference collections directly into your
            Flux Library catalog with automatic deduplication and metadata enrichment.
          </DialogDescription>
        </DialogHeader>

        <div className="p-5 space-y-4">
          {/* Provider Switcher */}
          <div className="grid grid-cols-2 gap-2 p-1 rounded-lg bg-muted/60 border border-border">
            <button
              type="button"
              onClick={() => {
                setProvider('zotero');
                setSelectedRemoteCollection('all');
              }}
              className={`flex items-center justify-center gap-2 h-8 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                provider === 'zotero'
                  ? 'bg-background text-foreground shadow-xs border border-border/60'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <ZoteroIcon className="size-3.5" />
              <span>Zotero</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setProvider('mendeley');
                setSelectedRemoteCollection('all');
              }}
              className={`flex items-center justify-center gap-2 h-8 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                provider === 'mendeley'
                  ? 'bg-background text-foreground shadow-xs border border-border/60'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <MendeleyIcon className="size-3.5" />
              <span>Mendeley</span>
            </button>
          </div>

          {/* Account Status Card */}
          <div className="p-3.5 rounded-lg border border-border bg-card flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-foreground">
                  {provider === 'zotero' ? 'Zotero Account' : 'Mendeley Account'}
                </span>
                {isConnected ? (
                  <Badge
                    variant="outline"
                    className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-10 h-4 px-1.5 gap-1"
                  >
                    <Check className="size-2.5" />
                    Connected
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground text-10 h-4 px-1.5">
                    Not Connected
                  </Badge>
                )}
              </div>
              <p className="text-11 text-muted-foreground truncate mt-0.5">
                {isConnected
                  ? currentIntegration?.accountName ||
                    currentIntegration?.accountEmail ||
                    'Ready to sync collections'
                  : `Authorize your ${provider === 'zotero' ? 'Zotero' : 'Mendeley'} account to browse collections.`}
              </p>
            </div>

            {isConnected ? (
              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => refetchCollections()}
                  disabled={isLoadingRemoteCollections}
                  className="h-7 px-2 text-11"
                  title="Refresh collections list"
                >
                  <RefreshCw
                    className={`size-3 ${isLoadingRemoteCollections ? 'animate-spin' : ''}`}
                  />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => disconnect(provider)}
                  disabled={isDisconnecting}
                  className="h-7 text-11 px-2.5"
                >
                  Disconnect
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                size="sm"
                onClick={() => connect(provider)}
                disabled={isConnecting}
                className="h-7 text-xs gap-1.5 shrink-0"
              >
                <ExternalLink className="size-3" />
                {isConnecting ? 'Connecting...' : 'Connect Account'}
              </Button>
            )}
          </div>

          {/* Collection Pickers when connected */}
          {isConnected && (
            <div className="space-y-3.5 pt-1">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground block">
                  Source {provider === 'zotero' ? 'Zotero Collection' : 'Mendeley Folder'}
                </label>
                <Select
                  value={selectedRemoteCollection}
                  onValueChange={setSelectedRemoteCollection}
                  disabled={isLoadingRemoteCollections}
                >
                  <SelectTrigger className="w-full h-8.5 text-xs bg-background border-border">
                    <SelectValue
                      placeholder={
                        isLoadingRemoteCollections
                          ? 'Loading remote collections...'
                          : 'Choose a collection to import'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {remoteCollections.map((col) => (
                      <SelectItem
                        key={col.id}
                        value={col.id}
                        className="text-xs cursor-pointer"
                      >
                        {col.name} ({col.itemCount} items)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                  <FolderOpen className="size-3.5 text-muted-foreground" />
                  <span>Target Library Collection (Optional)</span>
                </label>
                <Select
                  value={targetCollectionId}
                  onValueChange={setTargetCollectionId}
                >
                  <SelectTrigger className="w-full h-8.5 text-xs bg-background border-border">
                    <SelectValue placeholder="My Library (Root)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__root__" className="text-xs cursor-pointer">
                      My Library (All Papers Root)
                    </SelectItem>
                    {collections.map((col) => (
                      <SelectItem
                        key={col.id}
                        value={col.id}
                        className="text-xs cursor-pointer"
                      >
                        {col.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="p-2.5 rounded-md bg-muted/40 border border-border/60 flex items-start gap-2 text-11 text-muted-foreground">
                <GitCompare className="size-3.5 text-primary shrink-0 mt-0.5" />
                <span>
                  Existing items with matching DOIs or citation keys are automatically
                  deduplicated so you can safely re-sync at any time.
                </span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="px-5 py-3 border-t border-border bg-muted/20 flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-8 text-xs"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!isConnected || !selectedRemoteCollection || isSyncing}
            onClick={handleSyncToLibrary}
            className="h-8 text-xs gap-1.5"
          >
            <RefreshCw className={`size-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Syncing to Library...' : 'Sync to Library'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
