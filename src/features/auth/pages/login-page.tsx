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
      <div className='flex min-h-screen items-center justify-center bg-background'>
        <Loader2 className='h-8 w-8 animate-spin text-primary shrink-0' />
      </div>
    );
  }

  if (user) return null;

  return (
    <div className='flex min-h-dvh items-center justify-center bg-background px-4 py-8'>
      <div className='mx-auto w-full max-w-sm flex flex-col gap-5'>
        <div className='flex flex-col items-center gap-3 text-center'>
          <Link className="shrink-0" href='/'>
            <img src='/Flux.svg' alt='Flux' className='w-14 h-14' />
          </Link>
          <h2 className='text-2xl font-semibold tracking-tight text-foreground'>Sign in to Flux</h2>
        </div>

        <form onSubmit={handleSubmit} className='flex flex-col gap-3.5'>
          <div className='flex flex-col gap-1'>
            <Input
              id='email'
              type='email'
              placeholder='Email'
              aria-label='Email'
              className='h-9 rounded-md'
              {...register('email')}
            />
            {errors.email && (
              <p className='text-xs text-destructive'>{errors.email.message}</p>
            )}
          </div>

          <div className='flex flex-col gap-1'>
            <div className='relative'>
              <Input
                id='password'
                type={showPassword ? 'text' : 'password'}
                placeholder='Password'
                aria-label='Password'
                className='h-9 pr-10 rounded-md'
                {...register('password')}
              />
              <button
                type='button'
                onClick={() => setShowPassword(!showPassword)}
                className='absolute right-3 top-1/2 -translate-y-1/2 text-foreground transition-colors cursor-pointer'
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className='h-4 w-4 shrink-0' /> : <Eye className='h-4 w-4 shrink-0' />}
              </button>
            </div>
            {errors.password && (
              <p className='text-xs text-destructive'>{errors.password.message}</p>
            )}
          </div>

          <div className='text-right'>
            <Link
              href='/forgot-password'
              className='text-sm text-foreground hover:underline transition-colors shrink-0'
            >
              Forgot password?
            </Link>
          </div>

          {error && (
            <div className='p-3 text-sm text-destructive bg-muted rounded-md border border-border text-center'>
              {error}
            </div>
          )}

          <Button
            type='submit'
            className='w-full h-9 mt-1 rounded-md cursor-pointer'
            disabled={isPending}
          >
            {isPending && <Loader2 className='mr-2 h-4 w-4 animate-spin shrink-0' />}
            {isPending ? 'Signing in...' : 'Sign in'}
          </Button>
        </form>

        <div className='text-center text-sm text-muted-foreground'>
          Don&apos;t have an account?{' '}
          <Link
            href='/register'
            className='text-primary font-semibold hover:underline shrink-0'
          >
            Sign up
          </Link>
        </div>

        <div className='flex flex-col gap-2.5'>
          <Button
            variant='outline'
            type='button'
            onClick={() => handleOAuthLogin('google')}
            className='w-full h-9 gap-1.5 text-foreground hover:bg-muted transition-colors rounded-md cursor-pointer'
          >
            <img src='/google.svg' alt='' aria-hidden='true' className='w-4 h-4' />
            Google
          </Button>
          <Button
            variant='outline'
            type='button'
            onClick={() => handleOAuthLogin('github')}
            className='w-full h-9 gap-1.5 text-foreground hover:bg-muted transition-colors rounded-md cursor-pointer'
          >
            <img src='/github.svg' alt='' aria-hidden='true' className='w-4 h-4' />
            Github
          </Button>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
