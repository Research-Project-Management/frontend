'use client';

import { useQuery } from "@tanstack/react-query";
import { fetchUser } from '@/features/auth';
import type { TypeUser } from "@/features/profile/types/profile.types";

export function useUser() {
  const { data: user, isLoading, error } = useQuery<TypeUser>({
    queryKey: ["user"],
    queryFn: fetchUser,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: false,
  });

  return {
    user,
    isLoading,
    error,
    isAuthenticated: !!user && !error,
  };
}

