'use client';

import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { registerUser } from '../services/auth.service';
import { env } from '@/config/env';
import type { RegisterPayload } from '../types/auth.types';


export const useRegister = () => {
  const router = useRouter();

  const { mutate, isPending, error } = useMutation({
    mutationFn: (payload: RegisterPayload) => registerUser(payload),
    onSuccess: () => {
      toast.success('Account created! Please log in.');
      router.push('/login');
    },
    onError: (err: unknown) => {
      const message =
        (err as { message?: string })?.message ?? 'Registration failed. Please try again.';
      toast.error(message);
    },
  });

  const handleOAuthLogin = (provider: 'google' | 'github') => {
    window.location.href = `${env.NEXT_PUBLIC_API_URL}/auth/${provider}`;
  };

  return {
    register: mutate,
    isPending,
    error: (error as { message?: string })?.message ?? null,
    handleOAuthLogin,
  };
};
