'use client';

import { useQuery } from '@tanstack/react-query';
import { libraryKeys } from '../../services/library.service';
import { getAsyncJobStatus } from '../../services/ingestion.service';

export function useAsyncJobStatus(jobId: string | null) {
  return useQuery({
    queryKey: jobId ? libraryKeys.job(jobId) : ['library', 'job', 'idle'],
    queryFn: () => (jobId ? getAsyncJobStatus(jobId) : null),
    enabled: Boolean(jobId),
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data || data.status === 'processing' || data.status === 'queued') {
        return 1000;
      }
      return false;
    },
  });
}
