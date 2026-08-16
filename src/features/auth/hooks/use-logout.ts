'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { logoutUser } from '../services/auth.service';

export const useLogout = () => {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { mutate, isPending } = useMutation({
    mutationFn: logoutUser,
    onSuccess: () => {
      queryClient.clear(); // wipe all cached data (session, workspaces, etc.)
      router.replace('/login');
    },
    onError: () => {
      // Session is probably already invalid — clear cache and redirect anyway
      queryClient.clear();
      router.replace('/login');
      toast.error('Something went wrong. Please try again.');
    },
  });

  return { logout: mutate, isPending };
};
