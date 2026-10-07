import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { integrationService } from '../services/integration.service';
import { openOAuthPopup } from '../utils/oauth-popup.util';
import type {
  IntegrationProvider,
  IntegrationStatusItem,
  SyncCollectionPayload,
} from '../types/integration.types';
import { getErrorMessage } from "@/shared/lib/utils";

export const INTEGRATIONS_QUERY_KEY = ['integrations', 'status'];

export const FALLBACK_INTEGRATIONS: IntegrationStatusItem[] = [
  {
    provider: 'zotero',
    name: 'Zotero',
    description: 'Sync collections, references, and PDF metadata from your personal or group library.',
    category: 'reference',
    status: 'revoked',
    needsReconnect: false,
  },
  {
    provider: 'mendeley',
    name: 'Mendeley',
    description: 'Connect your Elsevier Mendeley reference manager library directly to Flux.',
    category: 'reference',
    status: 'revoked',
    needsReconnect: false,
  },
  {
    provider: 'orcid',
    name: 'ORCID',
    description: 'Connect your researcher profile to automatically sync your published works.',
    category: 'identity',
    status: 'revoked',
    needsReconnect: false,
  },
  {
    provider: 'github',
    name: 'GitHub',
    description: 'Two-way sync manuscripts with GitHub repositories, branches, and commits.',
    category: 'git',
    status: 'revoked',
    needsReconnect: false,
  },
];

export function useIntegrations() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: INTEGRATIONS_QUERY_KEY,
    queryFn: () => integrationService.getStatuses(),
    staleTime: 1000 * 30, // 30 seconds
  });

  const connectMutation = useMutation({
    mutationFn: async (provider: IntegrationProvider) => {
      const { authUrl } = await integrationService.getAuthUrl(provider);
      const result = await openOAuthPopup(provider, authUrl);
      if (!result.success && !result.cancelled) {
        throw new Error('OAuth authorization did not complete successfully.');
      }
      return result;
    },
    onSuccess: (result, provider) => {
      if (result.success) {
        toast.success(`Successfully connected ${provider.toUpperCase()}!`);
        queryClient.invalidateQueries({ queryKey: INTEGRATIONS_QUERY_KEY });
      }
    },
    onError: (err: unknown) => {
      toast.error(`Connection failed: ${getErrorMessage(err) || 'Unknown error'}`);
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async (provider: IntegrationProvider) => {
      await integrationService.disconnect(provider);
    },
    onSuccess: (_, provider) => {
      toast.success(`Disconnected ${provider.toUpperCase()}`);
      queryClient.invalidateQueries({ queryKey: INTEGRATIONS_QUERY_KEY });
    },
    onError: (err: unknown) => {
      toast.error(`Failed to disconnect: ${getErrorMessage(err) || 'Unknown error'}`);
    },
  });

  return {
    ...query,
    integrations: (query.data && query.data.length > 0) ? query.data : FALLBACK_INTEGRATIONS,
    connect: connectMutation.mutateAsync,
    isConnecting: connectMutation.isPending,
    disconnect: disconnectMutation.mutateAsync,
    isDisconnecting: disconnectMutation.isPending,
  };
}

export function useRemoteCollections(provider: IntegrationProvider, enabled = true) {
  return useQuery({
    queryKey: ['integrations', provider, 'collections'],
    queryFn: () => integrationService.getCollections(provider),
    enabled,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

export function useSyncCollection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      provider,
      payload,
    }: {
      provider: IntegrationProvider;
      payload: SyncCollectionPayload;
    }) => {
      return await integrationService.syncCollection(provider, payload);
    },
    onSuccess: (data) => {
      toast.success(
        `Successfully synced ${data.collectionName} to ${data.targetBibFile}!`,
      );
      queryClient.invalidateQueries({ queryKey: INTEGRATIONS_QUERY_KEY });
    },
    onError: (err: unknown) => {
      toast.error(`Sync failed: ${getErrorMessage(err) || 'Could not sync collection'}`);
    },
  });
}
