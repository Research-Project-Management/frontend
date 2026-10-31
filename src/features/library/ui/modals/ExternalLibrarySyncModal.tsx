'use client';

import React, { useState, useEffect } from 'react';
import {
  Check,
  RefreshCw,
  ExternalLink,
  FolderOpen,
  GitCompare,
  Key,
  ShieldCheck,
} from 'lucide-react';
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
import { Input } from '@/shared/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { ZoteroIcon } from '@/shared/components/icons/IntegrationIcons';
import {
  useIntegrations,
  useRemoteCollections,
} from '@/features/settings/hooks/use-integrations';
import { integrationService } from '@/features/settings/services/integration.service';
import { useSyncExternalBibtexMutation } from '@/features/library/sdk/queries/ingestion.queries';
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
  scopeId = 'user',
  collections = [],
  defaultCollectionId = null,
}: ExternalLibrarySyncModalProps) {
  const syncExternalBibtexMutation = useSyncExternalBibtexMutation(scopeId);
  const [selectedRemoteCollection, setSelectedRemoteCollection] =
    useState<string>('');
  const [targetCollectionId, setTargetCollectionId] = useState<string>(
    defaultCollectionId || '__root__',
  );
  const [isSyncing, setIsSyncing] = useState(false);
  const [zoteroUserId, setZoteroUserId] = useState('');
  const [apiKey, setApiKey] = useState('');

  useEffect(() => {
    setTargetCollectionId(defaultCollectionId || '__root__');
  }, [defaultCollectionId]);

  const {
    integrations,
    connect,
    isConnecting,
    connectZoteroApiKey,
    isConnectingZoteroApiKey,
    disconnect,
    isDisconnecting,
  } = useIntegrations();

  const currentIntegration = integrations.find((i) => i.provider === 'zotero');
  const isConnected =
    currentIntegration?.status === 'connected' &&
    !currentIntegration.needsReconnect;

  const {
    data: remoteCollections = [],
    isLoading: isLoadingRemoteCollections,
    refetch: refetchCollections,
  } = useRemoteCollections('zotero', Boolean(open && isConnected));

  useEffect(() => {
    if (
      remoteCollections.length > 0 &&
      (!selectedRemoteCollection ||
        !remoteCollections.some((c) => c.id === selectedRemoteCollection))
    ) {
      setSelectedRemoteCollection(remoteCollections[0]!.id);
    }
  }, [remoteCollections, selectedRemoteCollection]);

  const handleConnectWithApiKey = async () => {
    const uid = zoteroUserId.trim();
    const key = apiKey.trim();

    if (!uid || !key) {
      toast.warning('Please enter both your Zotero User ID and Personal API Key.');
      return;
    }

    try {
      await connectZoteroApiKey({
        zoteroUserId: uid,
        apiKey: key,
      });
      toast.success('Successfully connected to Zotero.');
      void refetchCollections();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Failed to verify Zotero API Key.';
      toast.error('Zotero Connection Failed', { description: msg });
    }
  };

  const handleSyncToLibrary = async () => {
    if (!selectedRemoteCollection) {
      toast.warning('Please select a collection to import');
      return;
    }

    setIsSyncing(true);
    const toastId = toast.loading('Fetching references from Zotero...', {
      id: 'external-library-sync',
    });

    try {
      const { bibtex } = await integrationService.getCollectionBibtex(
        'zotero',
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
        'Zotero Collection';

      await syncExternalBibtexMutation.mutateAsync({
        bibtex,
        collectionId: destinationCollectionId,
        remoteCollectionName: remoteColName,
      });

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
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (isSyncing) return;
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-[500px] p-0 gap-0 overflow-hidden border-border bg-background">
        <DialogHeader className="px-5 pt-5 pb-3.5 border-b border-border">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
              <ZoteroIcon className="size-4 shrink-0" />
              <span>Sync from Zotero to Library</span>
            </DialogTitle>
            {isConnected && (
              <Badge
                variant="outline"
                className="bg-success/10 text-success border-success/30 text-10 h-4 px-1.5 gap-1"
              >
                <Check className="size-2.5" />
                Connected
              </Badge>
            )}
          </div>
          <DialogDescription className="text-xs text-muted-foreground pt-1">
            Import your personal or group reference collections directly into your
            Flux Library catalog with automatic deduplication and metadata enrichment.
          </DialogDescription>
        </DialogHeader>

        <div className="p-5 space-y-4">
          {!isConnected ? (
            <div className="space-y-4">
              {/* Personal API Key Authentication */}
              <div className="p-4 rounded-lg border border-border bg-card space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                    <Key className="size-3.5 text-muted-foreground" />
                    <span>Connect with Zotero Personal API Key</span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => connect('zotero')}
                    disabled={isConnecting}
                    className="h-7 text-11 gap-1 px-2.5 cursor-pointer"
                  >
                    <ExternalLink className="size-3" />
                    {isConnecting ? 'Authorizing...' : 'OAuth Sign In'}
                  </Button>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground flex items-center justify-between">
                    <span>Zotero User ID</span>
                    <a
                      href="https://www.zotero.org/settings/keys"
                      target="_blank"
                      rel="noreferrer"
                      className="text-11 text-muted-foreground hover:text-foreground hover:underline inline-flex items-center gap-1"
                    >
                      <span>Find User ID in Settings</span>
                      <ExternalLink className="size-2.5" />
                    </a>
                  </label>
                  <Input
                    type="text"
                    placeholder="e.g. 12345678"
                    value={zoteroUserId}
                    onChange={(e) => setZoteroUserId(e.target.value)}
                    className="h-8 text-xs font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground flex items-center justify-between">
                    <span>Personal API Key</span>
                    <a
                      href="https://www.zotero.org/settings/keys/new"
                      target="_blank"
                      rel="noreferrer"
                      className="text-11 text-muted-foreground hover:text-foreground hover:underline inline-flex items-center gap-1"
                    >
                      <span>Create New API Key</span>
                      <ExternalLink className="size-2.5" />
                    </a>
                  </label>
                  <Input
                    type="password"
                    placeholder="Enter Zotero API Key (with library read access)"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="h-8 text-xs font-mono"
                  />
                </div>

                <div className="pt-1">
                  <Button
                    type="button"
                    onClick={handleConnectWithApiKey}
                    disabled={
                      isConnectingZoteroApiKey ||
                      !zoteroUserId.trim() ||
                      !apiKey.trim()
                    }
                    className="w-full h-8 text-xs font-medium gap-1.5 cursor-pointer"
                  >
                    {isConnectingZoteroApiKey ? (
                      <RefreshCw className="size-3.5 animate-spin" />
                    ) : (
                      <ShieldCheck className="size-3.5" />
                    )}
                    <span>
                      {isConnectingZoteroApiKey
                        ? 'Verifying Credentials...'
                        : 'Connect Zotero Account'}
                    </span>
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Account Status Card */}
              <div className="p-3.5 rounded-lg border border-border bg-card flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-foreground">
                      Zotero Account
                    </span>
                  </div>
                  <p className="text-11 text-muted-foreground truncate mt-0.5">
                    {currentIntegration?.accountName ||
                      currentIntegration?.accountEmail ||
                      'Ready to sync collections'}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => refetchCollections()}
                    disabled={isLoadingRemoteCollections}
                    className="h-7 px-2 text-11 cursor-pointer"
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
                    onClick={() => disconnect('zotero')}
                    disabled={isDisconnecting}
                    className="h-7 text-11 px-2.5 cursor-pointer"
                  >
                    Disconnect
                  </Button>
                </div>
              </div>

              {/* Collection Pickers */}
              <div className="space-y-3.5">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground block">
                    Source Zotero Collection
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
                  <GitCompare className="size-3.5 text-foreground shrink-0 mt-0.5" />
                  <span>
                    Existing items with matching DOIs or citation keys are automatically
                    deduplicated so you can safely re-sync at any time.
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="px-5 py-3 border-t border-border bg-muted/20 flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isSyncing}
            onClick={() => onOpenChange(false)}
            className="h-8 text-xs cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!isConnected || !selectedRemoteCollection || isSyncing}
            onClick={handleSyncToLibrary}
            className="h-8 text-xs gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`size-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Syncing to Library...' : 'Sync to Library'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
