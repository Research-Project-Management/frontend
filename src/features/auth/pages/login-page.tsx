'use client';

import Link from 'next/link';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useLogin } from '../hooks/use-login';
import { Button } from "@/shared/components/ui";
import { Input } from "@/shared/components/ui";

const LoginPage = () => {
  const {
    form: {
      register,
      formState: { errors },
    },
    user,
    isAuthLoading,
    showPassword,
    setShowPassword,
    isPending,
    error,
    handleOAuthLogin,
    handleSubmit,
  } = useLogin();

  if (isAuthLoading) {
    return (
      <div className='flex min-h-dvh items-center justify-center bg-background' suppressHydrationWarning>
        <Loader2 className='h-8 w-8 animate-spin text-primary shrink-0' />
        <span className='sr-only'>Loading session...</span>
      </div>
    );
  }

  if (user) return null;

  return (
    <div className='flex min-h-dvh items-center justify-center bg-background px-4 py-8' suppressHydrationWarning>
      <div className='mx-auto w-full max-w-sm flex flex-col gap-5'>
        <div className='flex flex-col items-center gap-3 text-center'>
          <Link className="shrink-0" href='/'>
            <img src='/Flux.svg' alt='Flux' className='w-12 h-12' />
          </Link>
          <h1 className='text-2xl font-semibold tracking-tight text-foreground'>Sign in to Flux</h1>
        </div>

        <form onSubmit={handleSubmit} className='flex flex-col gap-3.5'>
          <div className='flex flex-col gap-1.5'>
            <label htmlFor='email' className='text-13 font-medium text-foreground'>
              Email
            </label>
            <Input
              id='email'
              type='email'
              placeholder='name@example.com'
              autoComplete='email'
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? 'email-error' : undefined}
              className='h-9 rounded-md'
              {...register('email')}
            />
            {errors.email && (
              <p id='email-error' className='text-xs text-destructive'>{errors.email.message}</p>
            )}
          </div>

          <div className='flex flex-col gap-1.5'>
            <div className='flex items-center justify-between'>
              <label htmlFor='password' className='text-13 font-medium text-foreground'>
                Password
              </label>
              <Link
                href='/forgot-password'
                className='text-xs text-muted-foreground hover:text-foreground hover:underline transition-colors'
              >
                Forgot password?
              </Link>
            </div>
            <div className='relative'>
              <Input
                id='password'
                type={showPassword ? 'text' : 'password'}
                placeholder='Enter your password'
                autoComplete='current-password'
                aria-invalid={Boolean(errors.password)}
                aria-describedby={errors.password ? 'password-error' : undefined}
                className='h-9 pr-10 rounded-md'
                {...register('password')}
              />
              <button
                type='button'
                onClick={() => setShowPassword(!showPassword)}
                className='absolute right-1.5 top-1/2 -translate-y-1/2 size-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className='size-4 shrink-0' /> : <Eye className='size-4 shrink-0' />}
              </button>
            </div>
            {errors.password && (
              <p id='password-error' className='text-xs text-destructive'>{errors.password.message}</p>
            )}
          </div>

          {error && (
            <div
              role='alert'
              aria-live='assertive'
              className='p-3 text-13 text-destructive bg-destructive/10 rounded-md border border-destructive/20 text-center font-medium'
            >
              {error}
            </div>
          )}

          <Button
            type='submit'
            className='w-full h-9 mt-1 rounded-md cursor-pointer'
            disabled={isPending}
            aria-busy={isPending}
          >
            {isPending && <Loader2 className='mr-2 size-4 animate-spin shrink-0' />}
            {isPending ? 'Signing in...' : 'Sign in'}
          </Button>
        </form>

        <div className='relative flex items-center justify-center my-1'>
          <div className='absolute inset-0 flex items-center'>
            <div className='w-full border-t border-border' />
          </div>
          <div className='relative bg-background px-2 text-11 font-medium text-muted-foreground uppercase tracking-wider'>
            or continue with
          </div>
        </div>

        <div className='flex flex-col gap-2.5'>
          <Button
            variant='outline'
            type='button'
            onClick={() => handleOAuthLogin('google')}
            className='w-full h-9 gap-2 text-foreground cursor-pointer'
          >
            <img src='/google.svg' alt='' aria-hidden='true' className='size-4 shrink-0' />
            Google
          </Button>
          <Button
            variant='outline'
            type='button'
            onClick={() => handleOAuthLogin('github')}
            className='w-full h-9 gap-2 text-foreground cursor-pointer'
          >
            <img src='/github.svg' alt='' aria-hidden='true' className='size-4 shrink-0' />
            GitHub
          </Button>
        </div>

        <div className='text-center text-sm text-muted-foreground pt-1'>
          Don&apos;t have an account?{' '}
          <Link
            href='/register'
            className='text-primary font-semibold hover:underline shrink-0'
          >
            Sign up
          </Link>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
