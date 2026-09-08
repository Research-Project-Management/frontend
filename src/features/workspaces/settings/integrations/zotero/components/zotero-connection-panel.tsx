'use client';

import React, { useState, useEffect } from 'react';
import { useZoteroIntegration } from '../hooks/use-zotero-integration';
import { useWorkspace } from '@/features/workspaces/shell/hooks/use-workspace';
import type { RemoteLibrary, ZoteroBinding } from '../types/zotero.types';
import {
  Link2,
  RefreshCw,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Lock,
  ArrowLeftRight,
  HardDrive,
  ShieldAlert,
  ChevronDown,
  Layers,
  BookOpen,
  FolderSync,
} from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/shared/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';

interface ZoteroConnectionPanelProps {
  workspaceId: string;
}

export function ZoteroConnectionPanel({ workspaceId }: ZoteroConnectionPanelProps) {
  const { workspace, yourRole } = useWorkspace(workspaceId);
  const isManager = yourRole === 'OWNER' || yourRole === 'ADMIN';

  const [selectedBindingId, setSelectedBindingId] = useState<string | undefined>();

  const {
    connections,
    isLoadingConnections,
    bindings,
    isLoadingBindings,
    killSwitch,
    storageQuota,
    connect,
    isConnecting,
    revoke,
    isRevoking,
    createBinding,
    isCreatingBinding,
    updateSyncDirection,
    isUpdatingSyncDirection,
    pull,
    isPulling,
    reconcile,
    isReconciling,
    fetchRemoteLibraries,
  } = useZoteroIntegration(workspaceId, selectedBindingId);

  // Form states
  const [apiKey, setApiKey] = useState('');
  const [accountName, setAccountName] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Remote libraries browsing
  const [remoteLibraries, setRemoteLibraries] = useState<RemoteLibrary[]>([]);
  const [isLoadingLibraries, setIsLoadingLibraries] = useState(false);
  const [selectedLibraryId, setSelectedLibraryId] = useState<string>('');
  const [selectedLibraryType, setSelectedLibraryType] = useState<'user' | 'group'>('user');

  // Modal / confirmation states
  const [directionModalBinding, setDirectionModalBinding] = useState<ZoteroBinding | null>(null);
  const [lastRunStats, setLastRunStats] = useState<{
    itemsCreated: number;
    itemsUpdated: number;
    itemsSkipped?: number;
    itemsFailed?: number;
    versionAfter: string;
  } | null>(null);

  const activeConnection = connections.find((c) => c.status === 'active');

  // Set default selected binding when bindings change
  useEffect(() => {
    if (bindings.length > 0 && !selectedBindingId) {
      setSelectedBindingId(bindings[0].id);
    }
  }, [bindings, selectedBindingId]);

  // Fetch remote libraries when connection becomes active
  useEffect(() => {
    if (activeConnection) {
      setIsLoadingLibraries(true);
      fetchRemoteLibraries(activeConnection.id)
        .then((libs) => {
          setRemoteLibraries(libs);
          if (libs.length > 0) {
            setSelectedLibraryId(libs[0].id);
            setSelectedLibraryType(libs[0].type);
          }
        })
        .catch((err) => {
          setErrorMessage(`Failed to load remote libraries: ${err.message}`);
        })
        .finally(() => setIsLoadingLibraries(false));
    } else {
      setRemoteLibraries([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConnection?.id]);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!isManager) {
      setErrorMessage('Only Workspace Owners and Admins can connect integrations.');
      return;
    }

    if (!apiKey.trim()) {
      setErrorMessage('Please enter a valid Zotero API key with read permissions.');
      return;
    }

    try {
      const res = await connect({
        apiKey: apiKey.trim(),
        accountName: accountName.trim() || 'My Zotero Account',
      });

      if (res.error) {
        setErrorMessage(res.error.message);
        return;
      }

      setApiKey('');
      setAccountName('');
      setSuccessMessage('Zotero account connected successfully! Choose a remote library below to start syncing.');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to connect Zotero account');
    }
  };

  const handleCreateBinding = async () => {
    if (!activeConnection || !selectedLibraryId) return;
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await createBinding({
        connectionId: activeConnection.id,
        remoteLibraryType: selectedLibraryType,
        remoteLibraryId: selectedLibraryId,
      });

      setSelectedBindingId(res.data.id);
      setSuccessMessage(`Binding created for ${selectedLibraryType} library (${selectedLibraryId}). Ready for initial pull.`);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to create remote library binding');
    }
  };

  const handleRevoke = async () => {
    if (!activeConnection) return;
    if (!confirm('Are you sure you want to disconnect your Zotero account? Existing local items will remain preserved.')) return;

    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await revoke(activeConnection.id);
      setSelectedBindingId(undefined);
      setSuccessMessage('Zotero connection disconnected.');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to revoke connection');
    }
  };

  const handlePull = async (bindingId: string) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setLastRunStats(null);

    try {
      const res = await pull(bindingId);
      const stats = res.data;
      setLastRunStats(stats);
      setSuccessMessage(
        `Sync completed: ${stats.itemsCreated} created, ${stats.itemsUpdated} updated (version: ${stats.versionAfter}).`,
      );
    } catch (err: any) {
      setErrorMessage(err.message || 'Pull sync failed');
    }
  };

  const handleReconcile = async (bindingId: string) => {
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await reconcile(bindingId);
      setSuccessMessage(
        `Reconciliation completed: ${res.data.deletedItems} deleted items pruned (version: ${res.data.versionAfter}).`,
      );
    } catch (err: any) {
      setErrorMessage(err.message || 'Reconciliation failed');
    }
  };

  const handleToggleSyncDirection = async () => {
    if (!directionModalBinding) return;
    const targetDirection = directionModalBinding.syncDirection === 'two_way' ? 'read_only' : 'two_way';

    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await updateSyncDirection({
        bindingId: directionModalBinding.id,
        direction: targetDirection,
      });
      setSuccessMessage(`Sync direction updated to ${targetDirection === 'two_way' ? 'Two-Way Sync' : 'Read-Only'}.`);
      setDirectionModalBinding(null);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update sync direction');
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header Banner */}
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground flex items-center gap-2">
            <BookOpen className="size-6 text-primary shrink-0" />
            Zotero Reference Library Integration
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Connect your personal or group Zotero libraries for automatic metadata, collections, and citation synchronization.
          </p>
        </div>
        {!isManager && (
          <div className="flex items-center gap-1.5 text-xs text-warning bg-warning/10 px-3 py-1.5 rounded-md border border-warning/20">
            <Lock className="size-3.5 shrink-0" />
            View Only (Admin required for changes)
          </div>
        )}
      </div>

      {/* Kill Switch Alert if active */}
      {killSwitch?.workspaceDisabled && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-warning/10 border border-warning/30 text-warning">
          <ShieldAlert className="size-5 shrink-0" />
          <div className="text-sm">
            <span className="font-semibold">Two-way push is paused by workspace policy:</span>{' '}
            {killSwitch.reason || 'Operator maintenance mode active.'} Local edits will remain queued without remote write.
          </div>
        </div>
      )}

      {/* Status Messages */}
      {errorMessage && (
        <div className="flex items-center gap-3 p-3.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
          <AlertTriangle className="size-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="flex items-center gap-3 p-3.5 rounded-lg bg-success/10 border border-success/20 text-success text-sm">
          <CheckCircle2 className="size-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Step 1: Connect Account if no active connection */}
      {!activeConnection && (
        <div className="rounded-md border bg-card p-6 ">
          <h3 className="text-base font-semibold text-foreground mb-2 flex items-center gap-2">
            <Link2 className="size-4 text-primary shrink-0" />
            Connect Zotero Account
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Enter your Zotero API key. You can generate one at{' '}
            <a
              href="https://www.zotero.org/settings/keys/new"
              target="_blank"
              rel="noreferrer"
              className="text-primary underline hover:underline"
            >
              zotero.org/settings/keys
            </a>
            . Your secret key is encrypted server-side with AES-256-GCM and never returned to the client.
          </p>

          <form onSubmit={handleConnect} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="accountName">Account Label (Optional)</Label>
                <Input
                  id="accountName"
                  placeholder="e.g. Lab Research Library"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  disabled={!isManager || isConnecting}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="apiKey">Zotero API Key</Label>
                <Input
                  id="apiKey"
                  type="password"
                  placeholder="Paste your Zotero API Key"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  disabled={!isManager || isConnecting}
                />
              </div>
            </div>

            <Button type="submit" disabled={!isManager || isConnecting || !apiKey.trim()} className="gap-2">
              {isConnecting ? <RefreshCw className="size-4 animate-spin shrink-0" /> : <Link2 className="size-4 shrink-0" />}
              {isConnecting ? 'Validating API Key...' : 'Connect Account'}
            </Button>
          </form>
        </div>
      )}

      {/* Step 2: Connected Account & Library Bindings */}
      {activeConnection && (
        <div className="space-y-6">
          {/* Active Connection Summary Card */}
          <div className="rounded-md border bg-card p-5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                Z
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">{activeConnection.accountName}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-success/10 text-success font-medium border border-success/20">
                    Active
                  </span>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Zotero User ID: <span className="font-mono">{activeConnection.zoteroUserId || 'N/A'}</span> • Key Encrypted (AES-256-GCM)
                </div>
              </div>
            </div>

            {isManager && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRevoke}
                disabled={isRevoking}
                className="text-destructive hover:bg-destructive/10 border-destructive/20 gap-1.5"
              >
                <Trash2 className="size-3.5 shrink-0" />
                Disconnect Account
              </Button>
            )}
          </div>

          {/* Add Remote Library Binding Section */}
          <div className="rounded-md border bg-card p-5 space-y-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Layers className="size-4 text-primary shrink-0" />
              Bind Remote Library
            </h3>
            <p className="text-xs text-muted-foreground">
              Select which personal or group library from your Zotero account to synchronize into this workspace.
            </p>

            {isLoadingLibraries ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <RefreshCw className="size-3.5 animate-spin shrink-0" /> Loading accessible Zotero libraries...
              </div>
            ) : remoteLibraries.length > 0 ? (
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-[260px]">
                  <Select
                    value={`${selectedLibraryType}:${selectedLibraryId}`}
                    onValueChange={(val) => {
                      const [type, id] = val.split(':');
                      setSelectedLibraryType(type as 'user' | 'group');
                      setSelectedLibraryId(id);
                    }}
                    disabled={!isManager || isCreatingBinding}
                  >
                    <SelectTrigger className="w-full h-9 text-sm bg-background">
                      <SelectValue placeholder="Select remote Zotero library..." />
                    </SelectTrigger>
                    <SelectContent>
                      {remoteLibraries.map((lib) => (
                        <SelectItem
                          key={`${lib.type}:${lib.id}`}
                          value={`${lib.type}:${lib.id}`}
                          className="text-sm"
                        >
                          {lib.name} ({lib.type === 'user' ? 'My Personal Library' : 'Group Library'})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {isManager && (
                  <Button
                    size="sm"
                    onClick={handleCreateBinding}
                    disabled={isCreatingBinding || !selectedLibraryId}
                    className="gap-1.5"
                  >
                    {isCreatingBinding ? <RefreshCw className="size-3.5 animate-spin shrink-0" /> : <Link2 className="size-3.5 shrink-0" />}
                    Create Library Binding
                  </Button>
                )}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground italic">
                No accessible libraries found on remote Zotero account.
              </div>
            )}
          </div>

          {/* Active Bindings List & Sync Controls */}
          <div className="rounded-md border bg-card p-5 space-y-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center justify-between">
              <span className="flex items-center gap-2">
                <RefreshCw className="size-4 text-primary shrink-0" />
                Active Library Bindings ({bindings.length})
              </span>
              {storageQuota && !storageQuota.isUnavailable && (
                <span className="text-xs text-muted-foreground flex items-center gap-1 font-normal">
                  <HardDrive className="size-3.5 shrink-0" />
                  Zotero Storage: {(storageQuota.used / (1024 * 1024)).toFixed(1)}MB / {(storageQuota.total / (1024 * 1024)).toFixed(0)}MB
                </span>
              )}
            </h3>

            {isLoadingBindings ? (
              <div className="text-xs text-muted-foreground py-4 text-center">Loading bindings...</div>
            ) : bindings.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-6 text-center border rounded-lg border-dashed border-border bg-muted space-y-1.5">
                <FolderSync className="size-7 text-muted-foreground/50 shrink-0" />
                <p className="text-xs font-semibold text-foreground">No active library bindings</p>
                <p className="text-xs text-muted-foreground max-w-sm">
                  Select a remote library above to bind and synchronize with your Flux workspace.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {bindings.map((b) => {
                  const isTwoWay = b.syncDirection === 'two_way';
                  const isSelected = b.id === selectedBindingId;

                  return (
                    <div
                      key={b.id}
                      tabIndex={0}
                      onClick={() => setSelectedBindingId(b.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedBindingId(b.id);
                        }
                      }}
                      className={`p-4 rounded-lg border transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ring ${
                        isSelected ? 'border-primary/50 bg-primary/5' : 'bg-background hover:bg-muted'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm text-foreground">
                              {b.remoteLibraryType === 'user' ? 'Personal Library' : `Group Library (${b.remoteLibraryId})`}
                            </span>
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full font-medium border ${
                                isTwoWay
                                  ? 'bg-success/10 text-success border-success/20'
                                  : 'bg-primary/10 text-primary border-primary/20'
                              }`}
                            >
                              {isTwoWay ? 'Two-Way Sync' : 'Read-Only'}
                            </span>
                            <span className="text-xs text-muted-foreground font-mono">
                              v{b.lastSyncVersion}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Status: <span className="capitalize">{b.syncStatus}</span> • Last Sync:{' '}
                            {b.lastSyncAt ? new Date(b.lastSyncAt).toLocaleString() : 'Never'}
                          </div>
                        </div>

                        {/* Action Buttons */}
                        {isManager && (
                          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handlePull(b.id)}
                              disabled={isPulling}
                              className="gap-1 text-xs"
                            >
                              <RefreshCw className={`size-3 ${isPulling ? 'animate-spin' : ''}`} />
                              Pull Sync
                            </Button>

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleReconcile(b.id)}
                              disabled={isReconciling}
                              className="gap-1 text-xs"
                            >
                              <CheckCircle2 className="size-3 shrink-0" />
                              Reconcile
                            </Button>

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDirectionModalBinding(b)}
                              className="gap-1 text-xs text-foreground"
                            >
                              <ArrowLeftRight className="size-3 shrink-0" />
                              {isTwoWay ? 'Revert Read-Only' : 'Enable Two-Way'}
                            </Button>
                          </div>
                        )}
                      </div>

                      {/* Pull Run Result Stats */}
                      {isSelected && lastRunStats && (
                        <div className="mt-3 pt-3 border-t text-xs text-muted-foreground flex items-center gap-4 bg-muted p-2.5 rounded">
                          <span>Created: <strong className="text-foreground">{lastRunStats.itemsCreated}</strong></span>
                          <span>Updated: <strong className="text-foreground">{lastRunStats.itemsUpdated}</strong></span>
                          {lastRunStats.itemsSkipped !== undefined && (
                            <span>Skipped: <strong className="text-foreground">{lastRunStats.itemsSkipped}</strong></span>
                          )}
                          {lastRunStats.itemsFailed !== undefined && lastRunStats.itemsFailed > 0 && (
                            <span className="text-destructive">Failed: <strong>{lastRunStats.itemsFailed}</strong></span>
                          )}
                          <span>Synced Version: <strong className="font-mono text-foreground">{lastRunStats.versionAfter}</strong></span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Confirmation Modal for Two-Way Switch (Bước 4) */}
      <Dialog open={Boolean(directionModalBinding)} onOpenChange={(open) => !open && setDirectionModalBinding(null)}>
        {directionModalBinding && (
          <DialogContent className="max-w-md w-full p-6 space-y-4" showCloseButton={true}>
            <DialogHeader className="text-left space-y-2">
              <div className="flex items-center gap-2.5 text-warning">
                <AlertTriangle className="size-5 shrink-0" />
                <DialogTitle className="text-base font-semibold text-foreground">
                  {directionModalBinding.syncDirection === 'read_only'
                    ? 'Enable Controlled Two-Way Sync?'
                    : 'Revert to Read-Only Sync?'}
                </DialogTitle>
              </div>
              <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
                {directionModalBinding.syncDirection === 'read_only' ? (
                  <>
                    Enabling Two-Way sync allows local modifications to items, tags, and collections in Flux to propagate directly to your remote Zotero library.
                    <br /><br />
                    <strong className="text-foreground">Important:</strong> Conflicting simultaneous edits on both ends will be safely routed to the Conflict Inbox for 3-way resolution.
                  </>
                ) : (
                  <>
                    Reverting to Read-Only sync immediately halts all outgoing writes to Zotero. Any local changes will remain stored in Flux without modifying your remote library.
                  </>
                )}
              </DialogDescription>
            </DialogHeader>

            <DialogFooter className="flex items-center justify-end gap-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDirectionModalBinding(null)}
                disabled={isUpdatingSyncDirection}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleToggleSyncDirection}
                disabled={isUpdatingSyncDirection}
                className={directionModalBinding.syncDirection === 'read_only' ? 'bg-warning hover:bg-warning/90' : ''}
              >
                {isUpdatingSyncDirection ? (
                  <RefreshCw className="size-3.5 animate-spin shrink-0" />
                ) : (
                  'Confirm & Switch'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
