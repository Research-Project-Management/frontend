'use client';

import React, { useState } from 'react';
import { ChevronLeft, ShieldCheck, AlertCircle, Unplug } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Card } from '@/shared/components/ui/card';
import type { IntegrationProvider, IntegrationStatusItem } from '../../types/integration.types';
import { getProviderIcon } from './IntegrationCard';

interface IntegrationDetailViewProps {
  item: IntegrationStatusItem;
  onBack: () => void;
  onConnect: (provider: IntegrationProvider) => Promise<unknown>;
  onDisconnect: (provider: IntegrationProvider) => Promise<unknown>;
  isConnecting?: boolean;
}

export function IntegrationDetailView({
  item,
  onBack,
  onConnect,
  onDisconnect,
  isConnecting = false,
}: IntegrationDetailViewProps) {
  const [isLocalProcessing, setIsLocalProcessing] = useState(false);

  const Icon = getProviderIcon(item.provider);
  const isConnected = item.status === 'connected' && !item.needsReconnect;
  const needsReconnect = item.needsReconnect;
  const isProcessing = isConnecting || isLocalProcessing;

  const handleConnect = async () => {
    setIsLocalProcessing(true);
    try {
      await onConnect(item.provider);
    } finally {
      setIsLocalProcessing(false);
    }
  };

  const handleDisconnect = async () => {
    setIsLocalProcessing(true);
    try {
      await onDisconnect(item.provider);
    } finally {
      setIsLocalProcessing(false);
    }
  };

  const getActionTitle = () => {
    if (item.provider === 'orcid') return 'Connect Profile';
    return 'Connect Account';
  };

  const getActionDescription = () => {
    if (item.provider === 'orcid') {
      return 'Connect your ORCID researcher record with Flux';
    }
    return `Connect your ${item.name} library and account with Flux`;
  };

  return (
    <div className="w-full max-w-5xl mx-auto p-6 md:p-8 space-y-6">
      {/* Back navigation using global Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onBack}
        className="h-8 px-2 text-13 font-medium text-foreground hover:text-foreground hover:bg-muted -ml-2 gap-1.5 relative before:absolute before:-inset-1.5 md:before:hidden"
      >
        <ChevronLeft className="size-4 text-foreground" />
        <span>Back to integrations</span>
      </Button>

      {/* Header Banner */}
      <div className="rounded-lg bg-muted/40 border border-border/40 p-5 flex items-center gap-4">
        <Icon className="size-12 shrink-0" />
        <div className="min-w-0 flex-1">
          <h2 className="text-16 font-semibold text-foreground">
            {item.name}
          </h2>
          <p className="text-13 font-normal text-foreground mt-0.5">
            {item.description}
          </p>
        </div>
      </div>

      {/* Connection Action Box using global Card */}
      <Card className="p-5 py-5 gap-0 flex flex-col sm:flex-row sm:items-center sm:justify-between rounded-lg">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-14 font-semibold text-foreground">
              {isConnected ? 'Connected Account' : getActionTitle()}
            </h3>
            {isConnected && (
              <Badge
                variant="outline"
                className="bg-success/10 text-success border-success/20 text-11 px-1.5 py-0 h-4.5 gap-1 shrink-0 font-normal"
              >
                <span className="size-1.5 rounded-full bg-success" />
                Connected
              </Badge>
            )}
            {needsReconnect && (
              <Badge
                variant="outline"
                className="bg-warning/10 text-warning border-warning/20 text-11 px-1.5 py-0 h-4.5 gap-1 shrink-0 font-normal"
              >
                <AlertCircle className="size-2.5" />
                Action required
              </Badge>
            )}
          </div>
          <p className="text-13 font-normal text-foreground mt-0.5">
            {isConnected
              ? `Connected as ${item.accountName || item.accountEmail || 'Authorized User'}`
              : getActionDescription()}
          </p>
          {isConnected && item.lastSyncedAt && (
            <div className="flex items-center gap-2 text-11 text-foreground font-normal mt-1.5">
              <span>Last synced: {new Date(item.lastSyncedAt).toLocaleString()}</span>
              <span>·</span>
              <span className="flex items-center gap-1 text-success">
                <ShieldCheck className="size-3" />
                AES-256 Vault Secured
              </span>
            </div>
          )}
        </div>

        {/* Action Button on the Right */}
        <div className="shrink-0 pt-3 sm:pt-0">
          {isConnected ? (
            <Button
              variant="outline"
              size="sm"
              disabled={isProcessing}
              onClick={handleDisconnect}
              className="text-13 text-destructive hover:bg-destructive/10 hover:text-destructive h-8 px-3 relative before:absolute before:-inset-1 md:before:hidden"
            >
              <Unplug className="size-3.5 mr-1.5" />
              Disconnect
            </Button>
          ) : needsReconnect ? (
            <Button
              variant="default"
              size="sm"
              disabled={isProcessing}
              onClick={handleConnect}
              className="text-13 font-medium h-8 px-4 relative before:absolute before:-inset-1 md:before:hidden"
            >
              {isProcessing ? 'Connecting...' : 'Reconnect'}
            </Button>
          ) : (
            <Button
              variant="default"
              size="sm"
              disabled={isProcessing}
              onClick={handleConnect}
              className="text-13 font-medium h-8 px-4 relative before:absolute before:-inset-1 md:before:hidden"
            >
              {isProcessing ? 'Connecting...' : 'Connect'}
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}

export default IntegrationDetailView;
