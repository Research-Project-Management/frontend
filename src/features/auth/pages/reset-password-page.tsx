'use client';

import Link from 'next/link';
import { Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react';
import { useResetPassword } from '../hooks/use-reset-password';
import { Button } from "@/shared/components/ui";
import { Input } from "@/shared/components/ui";

const ResetPasswordPage = () => {
  const {
    form: {
      register,
      formState: { errors },
    },
    token,
    isPending,
    error,
    showPassword,
    setShowPassword,
    showConfirmPassword,
    setShowConfirmPassword,
    handleSubmit,
  } = useResetPassword();

  return (
    <main className='flex min-h-dvh items-center justify-center bg-background px-4 py-8' suppressHydrationWarning>
      <div className='mx-auto w-full max-w-sm flex flex-col gap-5'>
        <div className='flex flex-col items-center gap-3 text-center'>
          <Link className="shrink-0" href='/' aria-label='Flux home'>
            <img src='/Flux.svg' alt='Flux' className='w-12 h-12' />
          </Link>
          <h1 className='text-2xl font-semibold tracking-tight text-foreground text-center'>
            Set new password
          </h1>
          <p className='text-13 text-muted-foreground'>
            Enter and confirm your new secure password.
          </p>
        </div>

        {!token ? (
          <div className='space-y-4 text-center'>
            <div
              role='alert'
              className='p-3 text-13 text-destructive bg-destructive/10 rounded-md border border-destructive/20 text-center flex items-center justify-center gap-2 font-medium'
            >
              <AlertCircle className='size-4 shrink-0' />
              <span>Missing reset token. Please request a new password reset link.</span>
            </div>
            <Button asChild className='w-full h-9 rounded-md cursor-pointer'>
              <Link href='/forgot-password'>Request reset link</Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className='flex flex-col gap-3.5'>
            <div className='flex flex-col gap-1.5'>
              <label htmlFor='password' className='sr-only'>
                New password
              </label>
              <div className='relative'>
                <Input
                  id='password'
                  type={showPassword ? 'text' : 'password'}
                  placeholder='New password (min. 8 characters)'
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
                Confirm new password
              </label>
              <div className='relative'>
                <Input
                  id='confirmPassword'
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder='Confirm new password'
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
              {isPending ? 'Updating...' : 'Set new password'}
            </Button>
          </form>
        )}

        <div className='text-center text-sm text-muted-foreground pt-1'>
          <Link
            href='/login'
            className='text-primary font-semibold hover:underline shrink-0'
          >
            Back to sign in
          </Link>
        </div>
      </div>
    </main>
  );
};

export default ResetPasswordPage;
