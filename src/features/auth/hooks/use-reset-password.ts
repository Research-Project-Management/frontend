'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { resetPassword } from '../services/auth.service';
import { resetPasswordSchema, type ResetPasswordSchema } from '../schemas/auth.schema';
import { getErrorMessage } from '@/shared/lib/utils';

/**
 * Dedicated Hook for ResetPasswordPage.
 * Validates cryptographic reset token from URL and updates user credentials.
 */
export const useResetPassword = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<ResetPasswordSchema>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const onSubmit = async (data: ResetPasswordSchema) => {
    if (!token) {
      setError('Password reset token is missing or invalid. Please request a new link.');
      return;
    }

    setIsPending(true);
    setError(null);
    try {
      await resetPassword(token, data.password);
      toast.success('Password updated successfully! Please sign in with your new password.');
      router.push('/login');
    } catch (err: unknown) {
      const message = getErrorMessage(err) || 'Failed to reset password. The link may have expired.';
      setError(message);
    } finally {
      setIsPending(false);
    }
  };

  return {
    form,
    token,
    isPending,
    error,
    showPassword,
    setShowPassword,
    showConfirmPassword,
    setShowConfirmPassword,
    handleSubmit: form.handleSubmit(onSubmit),
  };
};
