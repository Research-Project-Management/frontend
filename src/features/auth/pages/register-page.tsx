'use client';

import Link from 'next/link';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useRegister } from '../hooks/use-register';
import { Button } from "@/shared/components/ui";
import { Input } from "@/shared/components/ui";

const GithubIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    aria-hidden="true"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
    />
  </svg>
);

const RegisterPage = () => {
  const {
    form: {
      register,
      formState: { errors },
    },
    user,
    isAuthLoading,
    showPassword,
    setShowPassword,
    showConfirmPassword,
    setShowConfirmPassword,
    isPending,
    error,
    handleOAuthLogin,
    handleSubmit,
  } = useRegister();

  if (isAuthLoading) {
    return (
      <main className='flex min-h-dvh items-center justify-center bg-background' suppressHydrationWarning>
        <Loader2 className='h-8 w-8 animate-spin text-primary shrink-0' />
        <span className='sr-only'>Loading session...</span>
      </main>
    );
  }

  if (user) {
    return (
      <main className='flex min-h-dvh items-center justify-center bg-background' suppressHydrationWarning>
        <Loader2 className='h-8 w-8 animate-spin text-primary shrink-0' />
        <span className='sr-only'>Redirecting to workspace...</span>
      </main>
    );
  }

  return (
    <main className='flex min-h-dvh items-center justify-center bg-background px-4 py-8' suppressHydrationWarning>
      <div className='mx-auto w-full max-w-sm flex flex-col gap-5'>
        <div className='flex flex-col items-center gap-3 text-center'>
          <Link className="shrink-0" href='/' aria-label='Flux home'>
            <img src='/Flux.svg' alt='Flux' className='w-12 h-12' />
          </Link>
          <h1 className='text-2xl font-semibold tracking-tight text-foreground'>Create your account</h1>
        </div>

        <form onSubmit={handleSubmit} className='flex flex-col gap-3.5'>
          <div className='flex flex-col gap-1.5'>
            <label htmlFor='name' className='sr-only'>
              Full name
            </label>
            <Input
              id='name'
              type='text'
              placeholder='Full name'
              autoComplete='name'
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? 'name-error' : undefined}
              className='h-9 rounded-md'
              {...register('name')}
            />
            {errors.name && (
              <p id='name-error' className='text-xs text-destructive'>{errors.name.message}</p>
            )}
          </div>

          <div className='flex flex-col gap-1.5'>
            <label htmlFor='email' className='sr-only'>
              Email
            </label>
            <Input
              id='email'
              type='email'
              placeholder='Email'
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
            <label htmlFor='password' className='sr-only'>
              Password
            </label>
            <div className='relative'>
              <Input
                id='password'
                type={showPassword ? 'text' : 'password'}
                placeholder='Password (min. 8 characters)'
                autoComplete='new-password'
                aria-invalid={Boolean(errors.password)}
                aria-describedby={errors.password ? 'password-error' : undefined}
                className='h-9 pr-10 rounded-md'
                {...register('password')}
              />
              <button
                type='button'
                onClick={() => setShowPassword(!showPassword)}
                className='absolute right-1.5 top-1/2 -translate-y-1/2 size-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring touch-manipulation before:absolute before:-inset-2 before:content-[""]'
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className='size-4 shrink-0' /> : <Eye className='size-4 shrink-0' />}
              </button>
            </div>
            {errors.password && (
              <p id='password-error' className='text-xs text-destructive'>{errors.password.message}</p>
            )}
          </div>

          <div className='flex flex-col gap-1.5'>
            <label htmlFor='confirmPassword' className='sr-only'>
              Confirm password
            </label>
            <div className='relative'>
              <Input
                id='confirmPassword'
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder='Confirm password'
                autoComplete='new-password'
                aria-invalid={Boolean(errors.confirmPassword)}
                aria-describedby={errors.confirmPassword ? 'confirm-password-error' : undefined}
                className='h-9 pr-10 rounded-md'
                {...register('confirmPassword')}
              />
              <button
                type='button'
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className='absolute right-1.5 top-1/2 -translate-y-1/2 size-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring touch-manipulation before:absolute before:-inset-2 before:content-[""]'
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
              >
                {showConfirmPassword ? <EyeOff className='size-4 shrink-0' /> : <Eye className='size-4 shrink-0' />}
              </button>
            </div>
            {errors.confirmPassword && (
              <p id='confirm-password-error' className='text-xs text-destructive'>{errors.confirmPassword.message}</p>
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
            {isPending ? 'Creating account...' : 'Create account'}
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
            <GithubIcon className='size-4 shrink-0' />
            GitHub
          </Button>
        </div>

        <div className='text-center text-sm text-muted-foreground pt-1'>
          Already have an account?{' '}
          <Link
            href='/login'
            className='text-primary font-semibold hover:underline shrink-0'
          >
            Sign in
          </Link>
        </div>
      </div>
    </main>
  );
};

export default RegisterPage;
