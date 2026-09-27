'use client';

import React, { useState } from 'react';
import { Blocks } from 'lucide-react';
import { useIntegrations } from '../hooks/use-integrations';
import { IntegrationCard } from './IntegrationCard';
import { IntegrationDetailView } from './IntegrationDetailView';
import { TopBar } from '@/features/settings/components/layout/TopBar';
import { Skeleton } from '@/shared/components/ui';

export function IntegrationsHub() {
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);

  const {
    integrations,
    isLoading,
    connect,
    isConnecting,
    disconnect,
  } = useIntegrations();

  const selectedItem = selectedProvider
    ? integrations.find((i) => i.provider === selectedProvider)
    : null;

  return (
    <div className="flex h-full w-full flex-col bg-background">
      {/* TopBar aligned with Settings Layout */}
      <TopBar title="Integrations" Icon={Blocks} />

      <div className="flex-1 overflow-y-auto">
        {selectedItem ? (
          <IntegrationDetailView
            item={selectedItem}
            onBack={() => setSelectedProvider(null)}
            onConnect={connect}
            onDisconnect={disconnect}
            isConnecting={isConnecting}
          />
        ) : (
          <div className="w-full max-w-5xl mx-auto p-6 md:p-8 space-y-6">
            {/* Main Title & Subtitle */}
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Integrations
              </h1>
              <p className="text-13 text-foreground font-normal mt-1">
                Connect third-party apps to Flux to sync references, collections, and researcher profiles.
              </p>
            </div>

            {/* List of Integration Cards (Rows) - Strictly backend-supported */}
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((n) => (
                  <Skeleton
                    key={n}
                    className="h-18 rounded-lg w-full"
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {integrations.map((item) => (
                  <IntegrationCard
                    key={item.provider}
                    item={item}
                    onConfigure={(clickedItem) => setSelectedProvider(clickedItem.provider)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
