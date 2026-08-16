'use client';

import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

import { changePassword } from '../services/auth.service';
import type { ChangePasswordPayload } from '../types/auth.types';

export const useChangePassword = () => {
  const { mutate, isPending, isSuccess, error, reset } = useMutation({
    mutationFn: (payload: ChangePasswordPayload) => changePassword(payload),
    onSuccess: () => {
      toast.success('Password changed successfully');
    },
    onError: (err: unknown) => {
      const message =
        (err as { message?: string })?.message ?? 'Failed to change password';
      toast.error(message);
    },
  });

  return {
    changePassword: mutate,
    isPending,
    isSuccess,
    error: (error as { message?: string })?.message ?? null,
    reset,
  };
};
