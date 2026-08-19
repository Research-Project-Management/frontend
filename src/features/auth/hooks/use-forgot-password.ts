'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { forgotPassword } from '../services/auth.service';
import { forgotPasswordSchema, type ForgotPasswordSchema } from '../schemas/auth.schema';

/**
 * Dedicated Hook for ForgotPasswordPage.
 * Encapsulates form state, reset link dispatch, and submission states.
 */
export const useForgotPassword = () => {
  const [isPending, setIsPending] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<ForgotPasswordSchema>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const email = form.watch('email');

  const onSubmit = async (data: ForgotPasswordSchema) => {
    setIsPending(true);
    setError(null);
    try {
      await forgotPassword(data.email.trim());
      setIsSubmitted(true);
    } catch (err: unknown) {
      const message =
        (err as { message?: string })?.message ?? 'Failed to send reset link';
      setError(message);
    } finally {
      setIsPending(false);
    }
  };

  const handleTryAgain = () => {
    setIsSubmitted(false);
    setError(null);
    form.reset();
  };

  return {
    form,
    email,
    isPending,
    isSubmitted,
    error,
    handleTryAgain,
    handleSubmit: form.handleSubmit(onSubmit),
  };
};
