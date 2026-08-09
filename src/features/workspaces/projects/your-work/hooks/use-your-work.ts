'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { fetchYourWork } from '../services/your-work.service';

export const useYourWork = () => {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  return useQuery({
    queryKey: ['your-work', workspaceId],
    queryFn: ({ signal }) => fetchYourWork(workspaceId!, signal),
    enabled: !!workspaceId,
  });
};
