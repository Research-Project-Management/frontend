'use client';

import React, { useState, useEffect, useId } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
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
import { Label } from '@/shared/components/ui/label';
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
import { useSyncExternalBibtexMutation } from '@/features/library/core/coordinator/curation.coordinator';
import {
  zoteroApiKeyConnectSchema,
  applyServerErrorToForm,
  type ZoteroApiKeyConnectFormValues,
  type Collection,
} from '@/features/library/types/core.types';

interface ExternalLibrarySyncModalProps {
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
  const zoteroUserIdInputId = useId();
  const zoteroApiKeyInputId = useId();
  const sourceCollectionSelectId = useId();
  const targetCollectionSelectId = useId();

  const connectForm = useForm<ZoteroApiKeyConnectFormValues>({
    resolver: zodResolver(zoteroApiKeyConnectSchema),
    defaultValues: {
      zoteroUserId: '',
      apiKey: '',
    },
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  });

  const {
    register,
    handleSubmit,
    reset: resetConnectForm,
    setError: setConnectError,
    formState: { errors: connectErrors, isDirty: isConnectFormDirty },
  } = connectForm;

  useEffect(() => {
    setTargetCollectionId(defaultCollectionId || '__root__');
  }, [defaultCollectionId]);

  useEffect(() => {
    if (!open) {
      resetConnectForm({ zoteroUserId: '', apiKey: '' });
    }
  }, [open, resetConnectForm]);

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

  const onValidConnectWithApiKey = async (data: ZoteroApiKeyConnectFormValues) => {
    try {
      await connectZoteroApiKey({
        zoteroUserId: data.zoteroUserId.trim(),
        apiKey: data.apiKey.trim(),
      });
      toast.success('Successfully connected to Zotero.');
      resetConnectForm({ zoteroUserId: '', apiKey: '' });
      void refetchCollections();
    } catch (err: unknown) {
      const msg = applyServerErrorToForm(err, setConnectError, {
        allowedFields: ['zoteroUserId', 'apiKey'] as const,
        fallbackField: 'apiKey',
        fallbackMessage: 'Failed to verify Zotero API Key.',
      });
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
      const destinationCollectionId =
        targetCollectionId && targetCollectionId !== '__root__'
          ? targetCollectionId
          : undefined;

      const remoteColName =
        remoteCollections.find((c) => c.id === selectedRemoteCollection)?.name ||
        'Zotero Collection';

      const syncRes = await syncExternalBibtexMutation.mutateAsync({
        provider: 'zotero',
        remoteCollectionId: selectedRemoteCollection,
        collectionId: destinationCollectionId,
        remoteCollectionName: remoteColName,
      });

      if (syncRes && typeof syncRes === 'object' && 'empty' in syncRes && syncRes.empty) {
        toast.info('No references found in the selected collection.', {
          id: toastId,
        });
        return;
      }

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
      <DialogContent
        onPointerDownOutside={(e) => {
          if (isConnectFormDirty || isSyncing || isConnectingZoteroApiKey) {
            e.preventDefault();
          }
        }}
        className="sm:max-w-[500px] p-0 gap-0 overflow-hidden border-border bg-background"
      >
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
              <form
                onSubmit={handleSubmit(onValidConnectWithApiKey)}
                className="p-4 rounded-lg border border-border bg-card space-y-3"
              >
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
                  <div className="flex items-center justify-between">
                    <Label
                      htmlFor={zoteroUserIdInputId}
                      className="text-xs font-medium text-foreground"
                    >
                      Zotero User ID
                    </Label>
                    <a
                      href="https://www.zotero.org/settings/keys"
                      target="_blank"
                      rel="noreferrer"
                      className="text-11 text-muted-foreground hover:text-foreground hover:underline inline-flex items-center gap-1"
                    >
                      <span>Find User ID in Settings</span>
                      <ExternalLink className="size-2.5" />
                    </a>
                  </div>
                  <Input
                    id={zoteroUserIdInputId}
                    type="text"
                    placeholder="e.g. 12345678"
                    aria-invalid={Boolean(connectErrors.zoteroUserId)}
                    aria-describedby={
                      connectErrors.zoteroUserId ? 'zotero-uid-error' : undefined
                    }
                    {...register('zoteroUserId')}
                    className="h-8 text-xs font-mono"
                  />
                  {connectErrors.zoteroUserId && (
                    <p
                      id="zotero-uid-error"
                      role="alert"
                      className="text-11 text-destructive font-medium"
                    >
                      {connectErrors.zoteroUserId.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label
                      htmlFor={zoteroApiKeyInputId}
                      className="text-xs font-medium text-foreground"
                    >
                      Personal API Key
                    </Label>
                    <a
                      href="https://www.zotero.org/settings/keys/new"
                      target="_blank"
                      rel="noreferrer"
                      className="text-11 text-muted-foreground hover:text-foreground hover:underline inline-flex items-center gap-1"
                    >
                      <span>Create New API Key</span>
                      <ExternalLink className="size-2.5" />
                    </a>
                  </div>
                  <Input
                    id={zoteroApiKeyInputId}
                    type="password"
                    placeholder="Enter Zotero API Key (with library read access)"
                    aria-invalid={Boolean(connectErrors.apiKey)}
                    aria-describedby={
                      connectErrors.apiKey ? 'zotero-apikey-error' : undefined
                    }
                    {...register('apiKey')}
                    className="h-8 text-xs font-mono"
                  />
                  {connectErrors.apiKey && (
                    <p
                      id="zotero-apikey-error"
                      role="alert"
                      className="text-11 text-destructive font-medium"
                    >
                      {connectErrors.apiKey.message}
                    </p>
                  )}
                </div>

                <div className="pt-1">
                  <Button
                    type="submit"
                    disabled={isConnectingZoteroApiKey}
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
              </form>
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
                  <Label
                    htmlFor={sourceCollectionSelectId}
                    className="text-xs font-medium text-foreground block"
                  >
                    Source Zotero Collection
                  </Label>
                  <Select
                    value={selectedRemoteCollection}
                    onValueChange={setSelectedRemoteCollection}
                    disabled={isLoadingRemoteCollections}
                  >
                    <SelectTrigger
                      id={sourceCollectionSelectId}
                      className="w-full h-8.5 text-xs bg-background border-border"
                    >
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
                  <Label
                    htmlFor={targetCollectionSelectId}
                    className="text-xs font-medium text-foreground flex items-center gap-1.5"
                  >
                    <FolderOpen className="size-3.5 text-muted-foreground" />
                    <span>Target Library Collection (Optional)</span>
                  </Label>
                  <Select
                    value={targetCollectionId}
                    onValueChange={setTargetCollectionId}
                  >
                    <SelectTrigger
                      id={targetCollectionSelectId}
                      className="w-full h-8.5 text-xs bg-background border-border"
                    >
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
