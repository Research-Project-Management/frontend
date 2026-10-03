'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Blocks } from 'lucide-react';
import { useIntegrations } from '../hooks/use-integrations';
import { IntegrationCard } from './IntegrationCard';
import { IntegrationDetailView } from './IntegrationDetailView';
import { PageLayout, PageHeader, PageContent } from '@/shared/components/layout';
import { Skeleton } from '@/shared/components/ui/skeleton';

export function IntegrationsHub() {
  const searchParams = useSearchParams();
  const providerParam = searchParams.get('provider');
  const [selectedProvider, setSelectedProvider] = useState<string | null>(providerParam);

  useEffect(() => {
    if (providerParam) {
      setSelectedProvider(providerParam);
    }
  }, [providerParam]);

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
    <PageLayout>
      <PageHeader title="Integrations" icon={Blocks} />

      {selectedItem ? (
        <PageContent maxWidth="full" noPadding>
          <IntegrationDetailView
            item={selectedItem}
            onBack={() => setSelectedProvider(null)}
            onConnect={connect}
            onDisconnect={disconnect}
            isConnecting={isConnecting}
          />
        </PageContent>
      ) : (
        <PageContent maxWidth="lg">
          <div className="space-y-4">
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
        </PageContent>
      )}
    </PageLayout>
  );
}
