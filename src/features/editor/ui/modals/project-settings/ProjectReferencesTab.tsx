'use client';

/**
 * ProjectReferencesTab.tsx
 *
 * Canonical Project Settings - Reference & Citation Integrations Tab (Block 7: UI Shell / Modals Layer).
 * Location: `features/editor/ui/modals/ProjectReferencesTab.tsx`
 */

import React, { useState } from 'react';
import Link from 'next/link';
import { RefreshCw, ExternalLink, Check, AlertCircle, BookOpen, Blocks } from 'lucide-react';
import { useIntegrations, useRemoteCollections, useSyncCollection } from '@/features/settings/hooks/use-integrations';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { ZoteroIcon, MendeleyIcon } from '@/shared/components/icons';
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

  const handleSyncZotero = async () => {
    if (!projectId || !selectedZoteroCollection) return;
    const col = zoteroCollections.find((c) => c.id === selectedZoteroCollection);

    await syncMutation.mutateAsync({
      provider: 'zotero',
      payload: {
        projectId,
        collectionId: selectedZoteroCollection,
        collectionName: col?.name || selectedZoteroCollection,
        targetBibFile,
      },
    });
  };

  const handleSyncMendeley = async () => {
    if (!projectId || !selectedMendeleyCollection) return;
    const col = mendeleyCollections.find((c) => c.id === selectedMendeleyCollection);

    await syncMutation.mutateAsync({
      provider: 'mendeley',
      payload: {
        projectId,
        collectionId: selectedMendeleyCollection,
        collectionName: col?.name || selectedMendeleyCollection,
        targetBibFile,
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Overview Info Header */}
      <div className="p-3.5 rounded-lg border border-border/70 bg-muted/30 text-xs text-muted-foreground leading-relaxed flex items-start gap-2.5">
        <Blocks className="size-4 text-primary shrink-0 mt-0.5" />
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

      {/* Zotero Section */}
      <div className="p-4 rounded-md border border-border bg-card space-y-3 shadow-none">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex size-7 items-center justify-center rounded-md bg-muted/60 p-1.5 shrink-0">
              <ZoteroIcon className="size-4 shrink-0" />
            </div>
            <div>
              <h4 className="text-xs font-semibold text-foreground">Zotero Integration</h4>
              <p className="text-11 text-muted-foreground">Sync your personal or group Zotero collections</p>
            </div>
          </div>

          {isZoteroConnected ? (
            <Badge variant="outline" className="bg-success/15 text-success border-success/30 text-xs gap-1">
              <span className="size-1.5 rounded-full bg-success" />
              Connected
            </Badge>
          ) : zoteroIntegration?.needsReconnect ? (
            <Badge variant="outline" className="bg-warning/15 text-warning border-warning/30 text-xs">
              Reconnect Required
            </Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground text-xs">
              Not Connected
            </Badge>
          )}
        </div>

        {isZoteroConnected ? (
          <div className="pt-2 border-t border-border/50 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex-1">
              <label className="text-11 text-muted-foreground block mb-1">
                Select Zotero Collection:
              </label>
              <Select
                value={selectedZoteroCollection}
                onValueChange={setSelectedZoteroCollection}
                disabled={isLoadingCollections}
              >
                <SelectTrigger aria-label="Select Zotero Collection" className="w-full sm:w-64 h-8 text-xs font-medium cursor-pointer border-border bg-background">
                  <SelectValue
                    placeholder={
                      isLoadingCollections ? 'Loading collections...' : 'Choose a collection to sync'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {zoteroCollections.map((col) => (
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
              disabled={!selectedZoteroCollection || syncMutation.isPending}
              onClick={handleSyncZotero}
            >
              <RefreshCw className={`size-3.5 ${syncMutation.isPending ? 'animate-spin motion-reduce:animate-none' : ''}`} />
              {syncMutation.isPending ? 'Syncing...' : 'Sync to BibTeX'}
            </Button>
          </div>
        ) : (
          <div className="pt-2 border-t border-border/50 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Link your Zotero account to enable collection sync.
            </span>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs motion-reduce:transition-none"
              disabled={isConnecting}
              onClick={() => connect('zotero')}
            >
              Connect Zotero
            </Button>
          </div>
        )}
      </div>

      {/* Mendeley Section */}
      <div className="p-4 rounded-md border border-border bg-card space-y-3 shadow-none">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex size-7 items-center justify-center rounded-md bg-muted/60 p-1.5 shrink-0">
              <MendeleyIcon className="size-4 shrink-0" />
            </div>
            <div>
              <h4 className="text-xs font-semibold text-foreground">Mendeley Integration</h4>
              <p className="text-11 text-muted-foreground">Link your Elsevier Mendeley reference library</p>
            </div>
          </div>

          {isMendeleyConnected ? (
            <Badge variant="outline" className="bg-success/15 text-success border-success/30 text-xs gap-1">
              <span className="size-1.5 rounded-full bg-success" />
              Connected
            </Badge>
          ) : mendeleyIntegration?.needsReconnect ? (
            <Badge variant="outline" className="bg-warning/15 text-warning border-warning/30 text-xs">
              Reconnect Required
            </Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground text-xs">
              Not Connected
            </Badge>
          )}
        </div>

        {isMendeleyConnected ? (
          <div className="pt-2 border-t border-border/50 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex-1">
              <label className="text-11 text-muted-foreground block mb-1">
                Select Mendeley Folder:
              </label>
              <Select
                value={selectedMendeleyCollection}
                onValueChange={setSelectedMendeleyCollection}
                disabled={isLoadingMendeleyCollections}
              >
                <SelectTrigger aria-label="Select Mendeley Folder" className="w-full sm:w-64 h-8 text-xs font-medium cursor-pointer border-border bg-background">
                  <SelectValue
                    placeholder={
                      isLoadingMendeleyCollections ? 'Loading folders...' : 'Choose a folder to sync'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {mendeleyCollections.map((col) => (
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
              disabled={!selectedMendeleyCollection || syncMutation.isPending}
              onClick={handleSyncMendeley}
            >
              <RefreshCw className={`size-3.5 ${syncMutation.isPending ? 'animate-spin motion-reduce:animate-none' : ''}`} />
              {syncMutation.isPending ? 'Syncing...' : 'Sync to BibTeX'}
            </Button>
          </div>
        ) : (
          <div className="pt-2 border-t border-border/50 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Link your Mendeley account to enable folder sync.
            </span>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs motion-reduce:transition-none"
              disabled={isConnecting}
              onClick={() => connect('mendeley')}
            >
              Connect Mendeley
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default ProjectReferencesTab;
