'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { loginUser } from '../services/auth-service';
import { queryKeys } from '@/shared/constants';
import { API_BASE_URL } from '@/shared/constants';

export const useLogin = () => {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { mutate, isPending, error } = useMutation({
    mutationFn: loginUser,
    onSuccess: (user) => {
      queryClient.setQueryData(queryKeys.auth.session, user);
      router.push('/create-workspace');
    },
    onError: (err: unknown) => {
      const message =
        (err as { message?: string })?.message ?? 'Login failed. Please try again.';
      toast.error(message);
    },
  });

  const handleOAuthLogin = (provider: 'google' | 'github') => {
    window.location.href = `${API_BASE_URL}/auth/${provider}`;
  };

  return {
    login: mutate,
    isPending,
    error: (error as { message?: string })?.message ?? null,
    handleOAuthLogin,
  };
};
