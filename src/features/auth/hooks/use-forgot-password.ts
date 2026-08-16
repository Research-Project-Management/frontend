'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';

import { forgotPassword } from '../services/auth.service';

export const useForgotPassword = () => {
  const [isSubmitted, setIsSubmitted] = useState(false);

  const { mutate, isPending, error, reset } = useMutation({
    mutationFn: (email: string) => forgotPassword(email),
    onSuccess: () => {
      setIsSubmitted(true);
    },
  });

  const handleTryAgain = () => {
    setIsSubmitted(false);
    reset(); // clears mutation error state
  };

  return {
    sendResetLink: mutate,
    isPending,
    isSubmitted,
    error: (error as { message?: string })?.message ?? null,
    handleTryAgain,
  };
};
