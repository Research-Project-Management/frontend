'use client';

/**
 * ReferencesTab.tsx
 *
 * Bibliography sync tab (Zotero & Mendeley) inside SettingsModal.
 */

import React, { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import {
  useIntegrations,
  useRemoteCollections,
  useSyncCollection,
} from '@/features/settings/hooks/use-integrations';
import { Button } from '@/shared/components/ui/button';
import { ZoteroIcon, MendeleyIcon } from '@/shared/components/icons/IntegrationIcons';
import { useSettingsStore } from '@/features/editor/core/store/settings.store';
import { DEFAULT_BIB_FILE } from '@/features/editor/domain/constants/editor.constants';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { SettingRow } from './settings-common';

interface ReferencesTabProps {
  projectId?: string;
  bibFiles: string[];
}

export function ReferencesTab({ projectId, bibFiles }: ReferencesTabProps) {
  const { integrations, connect, isConnecting } = useIntegrations();
  const zoteroIntegration = integrations.find((i) => i.provider === 'zotero');
  const mendeleyIntegration = integrations.find((i) => i.provider === 'mendeley');

  const isZoteroConnected =
    zoteroIntegration?.status === 'connected' && !zoteroIntegration.needsReconnect;
  const isMendeleyConnected =
    mendeleyIntegration?.status === 'connected' && !mendeleyIntegration.needsReconnect;

  const { data: zoteroCollections = [], isLoading: isLoadingCollections } = useRemoteCollections(
    'zotero',
    Boolean(isZoteroConnected),
  );

  const { data: mendeleyCollections = [], isLoading: isLoadingMendeleyCollections } =
    useRemoteCollections('mendeley', Boolean(isMendeleyConnected));

  const configuredBibFile = useSettingsStore((s) => s.mainBibFile) || DEFAULT_BIB_FILE;
  const [selectedZoteroCollection, setSelectedZoteroCollection] = useState<string>('');
  const [selectedMendeleyCollection, setSelectedMendeleyCollection] = useState<string>('');
  const [targetBibFile, setTargetBibFile] = useState<string>(bibFiles[0] || configuredBibFile);

  const syncMutation = useSyncCollection();

  const providers = [
    {
      id: 'zotero' as const,
      title: 'Zotero',
      description: 'Sync Zotero collections to BibTeX',
      icon: ZoteroIcon,
      isConnected: Boolean(isZoteroConnected),
      needsReconnect: Boolean(zoteroIntegration?.needsReconnect),
      collections: zoteroCollections,
      isLoadingCollections,
      selectedCollection: selectedZoteroCollection,
      setSelectedCollection: setSelectedZoteroCollection,
      selectLabel: 'Collection',
      loadingPlaceholder: 'Loading collections...',
      emptyPlaceholder: 'Select collection',
      connectButtonLabel: 'Connect',
    },
    {
      id: 'mendeley' as const,
      title: 'Mendeley',
      description: 'Sync Mendeley folders to BibTeX',
      icon: MendeleyIcon,
      isConnected: Boolean(isMendeleyConnected),
      needsReconnect: Boolean(mendeleyIntegration?.needsReconnect),
      collections: mendeleyCollections,
      isLoadingCollections: isLoadingMendeleyCollections,
      selectedCollection: selectedMendeleyCollection,
      setSelectedCollection: setSelectedMendeleyCollection,
      selectLabel: 'Folder',
      loadingPlaceholder: 'Loading folders...',
      emptyPlaceholder: 'Select folder',
      connectButtonLabel: 'Connect',
    },
  ];

  const handleSyncProvider = async (
    providerId: 'zotero' | 'mendeley',
    selectedCollectionId: string,
    collections: Array<{ id: string; name: string }>,
  ) => {
    if (!projectId || !selectedCollectionId) return;
    const col = collections.find((c) => c.id === selectedCollectionId);

    await syncMutation.mutateAsync({
      provider: providerId,
      payload: {
        projectId,
        collectionId: selectedCollectionId,
        collectionName: col?.name || selectedCollectionId,
        targetBibFile,
      },
    });
  };

  return (
    <div className="space-y-5">
      <SettingRow title="Target .bib file" description="File where synced references are saved">
        <Select value={targetBibFile} onValueChange={setTargetBibFile}>
          <SelectTrigger
            aria-label="Target bibliography file"
            className="w-40 h-8 text-xs font-medium cursor-pointer border-border bg-background"
          >
            <SelectValue placeholder="Select .bib file" />
          </SelectTrigger>
          <SelectContent>
            {bibFiles.map((file) => (
              <SelectItem key={file} value={file} className="cursor-pointer text-xs">
                {file}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SettingRow>

      <div className="space-y-3">
        {providers.map((p) => {
          const ProviderIcon = p.icon;
          return (
            <div
              key={p.id}
              className="p-3.5 rounded-lg border border-border bg-card/40 space-y-3"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex size-7 items-center justify-center rounded-md bg-muted p-1.5 shrink-0">
                    <ProviderIcon className="size-4 shrink-0" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-[13px] font-medium text-foreground">{p.title}</h4>
                    <p className="text-xs text-muted-foreground truncate">{p.description}</p>
                  </div>
                </div>

                {!p.isConnected && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs shrink-0 cursor-pointer"
                    disabled={isConnecting}
                    onClick={() => connect(p.id)}
                  >
                    {p.needsReconnect ? 'Reconnect' : p.connectButtonLabel}
                  </Button>
                )}
              </div>

              {p.isConnected && (
                <div className="pt-2.5 border-t border-border/50 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                  <Select
                    value={p.selectedCollection}
                    onValueChange={p.setSelectedCollection}
                    disabled={p.isLoadingCollections}
                  >
                    <SelectTrigger
                      aria-label={p.selectLabel}
                      className="w-full sm:flex-1 h-8 text-xs font-medium cursor-pointer border-border bg-background"
                    >
                      <SelectValue
                        placeholder={
                          p.isLoadingCollections ? p.loadingPlaceholder : p.emptyPlaceholder
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {p.collections.map((col) => (
                        <SelectItem key={col.id} value={col.id} className="cursor-pointer text-xs">
                          {col.name} ({col.itemCount})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button
                    size="sm"
                    className="h-8 text-xs shrink-0 gap-1.5 cursor-pointer"
                    disabled={!p.selectedCollection || syncMutation.isPending}
                    onClick={() => handleSyncProvider(p.id, p.selectedCollection, p.collections)}
                  >
                    <RefreshCw
                      className={`size-3.5 ${syncMutation.isPending ? 'animate-spin' : ''}`}
                    />
                    {syncMutation.isPending ? 'Syncing...' : 'Sync'}
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ReferencesTab;
