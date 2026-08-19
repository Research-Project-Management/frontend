'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';

import { useAuth } from './use-auth';
import { registerUser } from '../services/auth.service';
import { registerSchema, type RegisterSchema } from '../schemas/auth.schema';
import { fetchAllWorkspaces } from '@/features/workspaces/shell/services/workspace.service';
import { env } from '@/config/env';
import type { RegisterPayload } from '../types/auth.types';

/**
 * Dedicated Hook for RegisterPage.
 * Encapsulates form state, validation, registration mutation, and routing.
 */
export const useRegister = () => {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const form = useForm<RegisterSchema>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '', confirmPassword: '' },
  });

  const registerMutation = useMutation({
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

  // Redirect if already authenticated
  useEffect(() => {
    let isMounted = true;
    if (!isAuthLoading && user) {
      fetchAllWorkspaces()
        .then((data) => {
          if (!isMounted) return;
          if (data?.workspaces && data.workspaces.length > 0) {
            router.replace(`/${data.workspaces[0].url}`);
          } else {
            router.replace('/create-workspace');
          }
        })
        .catch(() => {
          if (isMounted) {
            router.replace('/create-workspace');
          }
        });
    }
    return () => {
      isMounted = false;
    };
  }, [isAuthLoading, user, router]);

  const handleOAuthLogin = (provider: 'google' | 'github') => {
    window.location.href = `${env.NEXT_PUBLIC_API_URL}/auth/${provider}`;
  };

  const onSubmit = (data: RegisterSchema) => {
    registerMutation.mutate({
      name: data.name.trim(),
      email: data.email.trim(),
      password: data.password,
    });
  };

  return {
    form,
    user,
    isAuthLoading,
    showPassword,
    setShowPassword,
    showConfirmPassword,
    setShowConfirmPassword,
    isPending: registerMutation.isPending,
    error: (registerMutation.error as { message?: string })?.message ?? null,
    handleOAuthLogin,
    handleSubmit: form.handleSubmit(onSubmit),
  };
};
