'use client';

/**
 * ProjectReferencesTab.tsx
 *
 * Canonical Project Settings - Reference & Citation Integrations Tab (Block 7: UI Shell / Modals Layer).
 * Location: `features/editor/ui/modals/project-settings/ProjectReferencesTab.tsx`
 */

import React, { useState } from 'react';
import { RefreshCw, Blocks } from 'lucide-react';
import { useIntegrations, useRemoteCollections, useSyncCollection } from '@/features/settings/hooks/use-integrations';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { ZoteroIcon, MendeleyIcon } from '@/shared/components/icons/IntegrationIcons';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';

interface ProjectReferencesTabProps {
  projectId?: string;
  bibFiles: string[];
}

export function ProjectReferencesTab({ projectId, bibFiles }: ProjectReferencesTabProps) {
  const { integrations, connect, isConnecting } = useIntegrations();
  const zoteroIntegration = integrations.find((i) => i.provider === 'zotero');
  const mendeleyIntegration = integrations.find((i) => i.provider === 'mendeley');

  const isZoteroConnected = zoteroIntegration?.status === 'connected' && !zoteroIntegration.needsReconnect;
  const isMendeleyConnected = mendeleyIntegration?.status === 'connected' && !mendeleyIntegration.needsReconnect;

  const { data: zoteroCollections = [], isLoading: isLoadingCollections } = useRemoteCollections(
    'zotero',
    Boolean(isZoteroConnected),
  );

  const { data: mendeleyCollections = [], isLoading: isLoadingMendeleyCollections } = useRemoteCollections(
    'mendeley',
    Boolean(isMendeleyConnected),
  );

  const [selectedZoteroCollection, setSelectedZoteroCollection] = useState<string>('');
  const [selectedMendeleyCollection, setSelectedMendeleyCollection] = useState<string>('');
  const [targetBibFile, setTargetBibFile] = useState<string>(bibFiles[0] || 'references.bib');

  const syncMutation = useSyncCollection();

  const providers = [
    {
      id: 'zotero' as const,
      title: 'Zotero Integration',
      description: 'Sync your personal or group Zotero collections',
      icon: ZoteroIcon,
      isConnected: Boolean(isZoteroConnected),
      needsReconnect: Boolean(zoteroIntegration?.needsReconnect),
      collections: zoteroCollections,
      isLoadingCollections,
      selectedCollection: selectedZoteroCollection,
      setSelectedCollection: setSelectedZoteroCollection,
      selectLabel: 'Select Zotero Collection',
      loadingPlaceholder: 'Loading collections...',
      emptyPlaceholder: 'Choose a collection to sync',
      disconnectHint: 'Link your Zotero account to enable collection sync.',
      connectButtonLabel: 'Connect Zotero',
    },
    {
      id: 'mendeley' as const,
      title: 'Mendeley Integration',
      description: 'Link your Elsevier Mendeley reference library',
      icon: MendeleyIcon,
      isConnected: Boolean(isMendeleyConnected),
      needsReconnect: Boolean(mendeleyIntegration?.needsReconnect),
      collections: mendeleyCollections,
      isLoadingCollections: isLoadingMendeleyCollections,
      selectedCollection: selectedMendeleyCollection,
      setSelectedCollection: setSelectedMendeleyCollection,
      selectLabel: 'Select Mendeley Folder',
      loadingPlaceholder: 'Loading folders...',
      emptyPlaceholder: 'Choose a folder to sync',
      disconnectHint: 'Link your Mendeley account to enable folder sync.',
      connectButtonLabel: 'Connect Mendeley',
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
    <div className="space-y-6">
      {/* Overview Info Header */}
      <div className="p-3.5 rounded-md border border-border/70 bg-muted/30 text-xs text-muted-foreground leading-relaxed flex items-start gap-2.5">
        <Blocks className="size-4 text-foreground shrink-0 mt-0.5" />
        <div>
          Synchronize remote citation libraries into this LaTeX manuscript. Synced references are saved directly to a <code>.bib</code> file in your project files tree.
        </div>
      </div>

      {/* Target Bib File Selection */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-md border border-border bg-card gap-3 shadow-none">
        <div>
          <h4 className="text-xs font-semibold text-foreground">Target Bibliography File</h4>
          <p className="text-11 text-muted-foreground">The .bib file where synced references will be written</p>
        </div>
        <Select value={targetBibFile} onValueChange={setTargetBibFile}>
          <SelectTrigger aria-label="Target Bibliography File" className="w-48 h-8 text-xs font-medium cursor-pointer border-border bg-background">
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
      </div>

      {/* Reference Provider Cards */}
      {providers.map((p) => {
        const ProviderIcon = p.icon;
        return (
          <div key={p.id} className="p-4 rounded-md border border-border bg-card space-y-3 shadow-none">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex size-7 items-center justify-center rounded-md bg-muted/60 p-1.5 shrink-0">
                  <ProviderIcon className="size-4 shrink-0" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-foreground">{p.title}</h4>
                  <p className="text-11 text-muted-foreground">{p.description}</p>
                </div>
              </div>

              {p.isConnected ? (
                <Badge variant="outline" className="bg-success/15 text-success border-success/30 text-xs gap-1">
                  <span className="size-1.5 rounded-full bg-success" />
                  Connected
                </Badge>
              ) : p.needsReconnect ? (
                <Badge variant="outline" className="bg-warning/15 text-warning border-warning/30 text-xs">
                  Reconnect Required
                </Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground text-xs">
                  Not Connected
                </Badge>
              )}
            </div>

            {p.isConnected ? (
              <div className="pt-2 border-t border-border/50 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="flex-1">
                  <label className="text-11 text-muted-foreground block mb-1">
                    {p.selectLabel}:
                  </label>
                  <Select
                    value={p.selectedCollection}
                    onValueChange={p.setSelectedCollection}
                    disabled={p.isLoadingCollections}
                  >
                    <SelectTrigger aria-label={p.selectLabel} className="w-full sm:w-64 h-8 text-xs font-medium cursor-pointer border-border bg-background">
                      <SelectValue
                        placeholder={
                          p.isLoadingCollections ? p.loadingPlaceholder : p.emptyPlaceholder
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {p.collections.map((col) => (
                        <SelectItem key={col.id} value={col.id} className="cursor-pointer text-xs">
                          {col.name} ({col.itemCount} items)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  size="sm"
                  className="h-8 text-xs self-end sm:self-auto gap-1.5 motion-reduce:transition-none"
                  disabled={!p.selectedCollection || syncMutation.isPending}
                  onClick={() => handleSyncProvider(p.id, p.selectedCollection, p.collections)}
                >
                  <RefreshCw className={`size-3.5 ${syncMutation.isPending ? 'animate-spin motion-reduce:animate-none' : ''}`} />
                  {syncMutation.isPending ? 'Syncing...' : 'Sync to BibTeX'}
                </Button>
              </div>
            ) : (
              <div className="pt-2 border-t border-border/50 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {p.disconnectHint}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs motion-reduce:transition-none"
                  disabled={isConnecting}
                  onClick={() => connect(p.id)}
                >
                  {p.connectButtonLabel}
                </Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default ProjectReferencesTab;

