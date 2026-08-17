'use client';

import { useQuery } from '@tanstack/react-query';
import { getUser } from '../services/auth.service';
import { queryKeys } from '@/shared/constants';

/**
 * Fetch and cache the current authenticated user session.
 *
 * Single responsibility: data only, no side effects.
 * Redirect logic belongs in the layout that needs protection.
 *
 * @example
 * const { user, isLoading, isError } = useAuth();
 */
export const useAuth = () => {
  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.auth.session,
    queryFn: getUser,
    staleTime: 5 * 60 * 1_000, // 5 minutes
    refetchOnWindowFocus: false,
    retry: false,
  });

  return { user: data ?? null, isLoading, isError };
};
