'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';

import { useAuth } from './use-auth';
import { loginUser } from '../services/auth.service';
import { authKeys } from '../constants/auth.keys';
import { loginSchema, type LoginSchema } from '../schemas/auth.schema';
import { fetchAllWorkspaces } from '@/features/workspaces/shell/services/workspace.service';
import { env } from '@/config/env';

/**
 * Dedicated Hook for LoginPage.
 * Encapsulates form state, validation, OAuth params, mutation, and routing.
 */
export const useLogin = () => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, isLoading: isAuthLoading } = useAuth();

  const [showPassword, setShowPassword] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(null);

  const form = useForm<LoginSchema>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const loginMutation = useMutation({
    mutationFn: loginUser,
    onSuccess: (authenticatedUser) => {
      queryClient.setQueryData(authKeys.session(), authenticatedUser);

      const params =
        typeof window !== 'undefined'
          ? new URLSearchParams(window.location.search)
          : null;
      const redirect = params?.get('redirect');
      if (redirect && redirect.startsWith('/')) {
        router.push(redirect);
        return;
      }

      // Direct routing to /projects (Overleaf/Google Drive style)
      router.push('/projects');
    },
    onError: (err: unknown) => {
      const message =
        (err as { message?: string })?.message ?? 'Login failed. Please try again.';
      toast.error(message);
    },
  });

  // Check URL search params for OAuth error messages
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlErr = params.get('error');
      if (urlErr) {
        if (urlErr === 'google_token_failed') {
          setOauthError('Failed to authenticate with Google. Please try again.');
        } else if (urlErr === 'oauth_error') {
          setOauthError('OAuth authentication error occurred. Please try again.');
        } else {
          setOauthError(`Authentication failed: ${urlErr}`);
        }
      }
    }
  }, []);

  // Redirect if already authenticated
  useEffect(() => {
    let isMounted = true;
    if (!isAuthLoading && user) {
      const params =
        typeof window !== 'undefined'
          ? new URLSearchParams(window.location.search)
          : null;
      const redirect = params?.get('redirect');
      if (redirect && redirect.startsWith('/')) {
        router.replace(redirect);
        return;
      }

      router.replace('/projects');
    }
    return () => {
      isMounted = false;
    };
  }, [isAuthLoading, user, router]);

  const handleOAuthLogin = (provider: 'google' | 'github') => {
    window.location.href = `${env.NEXT_PUBLIC_API_URL}/auth/${provider}`;
  };

  const onSubmit = (data: LoginSchema) => {
    loginMutation.mutate({ email: data.email.trim(), password: data.password });
  };

  return {
    form,
    user,
    isAuthLoading,
    showPassword,
    setShowPassword,
    oauthError,
    isPending: loginMutation.isPending,
    error: (loginMutation.error as { message?: string })?.message ?? oauthError,
    handleOAuthLogin,
    handleSubmit: form.handleSubmit(onSubmit),
  };
};
