'use client';

import React from 'react';
import { ArrowRight, AlertCircle } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import {
  ZoteroIcon,
  MendeleyIcon,
  OrcidIcon,
  GitHubIcon,
} from '@/shared/components/icons';
import { IntegrationProvider, IntegrationStatusItem } from '../types/integration.types';

interface IntegrationCardProps {
  item: IntegrationStatusItem;
  onConfigure: (item: IntegrationStatusItem) => void;
}

export function getProviderIcon(provider: IntegrationProvider): React.ComponentType<{ className?: string }> {
  switch (provider) {
    case 'zotero':
      return ZoteroIcon;
    case 'mendeley':
      return MendeleyIcon;
    case 'orcid':
      return OrcidIcon;
    case 'github':
      return GitHubIcon;
    default:
      return ZoteroIcon;
  }
}

export function IntegrationCard({ item, onConfigure }: IntegrationCardProps) {
  const Icon = getProviderIcon(item.provider);
  const isConnected = item.status === 'connected' && !item.needsReconnect;
  const needsReconnect = item.needsReconnect;

  return (
    <div className="flex flex-row items-center justify-between p-4 py-3.5 gap-0 rounded-lg border border-border bg-background hover:bg-muted/30 transition-colors">
      <div className="flex items-center gap-3.5 min-w-0 flex-1 mr-4">
        {/* App Icon occupies the full icon boundary directly without outer box */}
        <Icon className="size-11 shrink-0" />

        {/* Title and Description */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-14 font-semibold text-foreground truncate">
              {item.name}
            </h3>
            {isConnected && (
              <Badge
                variant="outline"
                className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-11 px-1.5 py-0 h-4.5 gap-1 shrink-0 font-normal"
              >
                <span className="size-1.5 rounded-full bg-emerald-500" />
                Connected
                {item.accountName && (
                  <span className="text-foreground font-normal">
                    · {item.accountName}
                  </span>
                )}
              </Badge>
            )}
            {needsReconnect && (
              <Badge
                variant="outline"
                className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 text-11 px-1.5 py-0 h-4.5 gap-1 shrink-0 font-normal"
              >
                <AlertCircle className="size-2.5" />
                Action required
              </Badge>
            )}
          </div>
          <p className="text-13 text-foreground font-normal mt-0.5 truncate">
            {item.description}
          </p>
        </div>
      </div>

      {/* Action link using global Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onConfigure(item)}
        className="h-8 px-2.5 text-13 font-medium text-foreground hover:text-foreground hover:bg-muted shrink-0"
      >
        <span>Configure</span>
        <ArrowRight className="size-3.5" />
      </Button>
    </div>
  );
}
