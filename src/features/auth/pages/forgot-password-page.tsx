'use client';

import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { useForgotPassword } from '../hooks/use-forgot-password';
import { Button } from "@/shared/components/ui";
import { Input } from "@/shared/components/ui";

const ForgotPasswordPage = () => {
  const {
    form: {
      register,
      formState: { errors },
    },
    email,
    isPending,
    isSubmitted,
    error,
    handleTryAgain,
    handleSubmit,
  } = useForgotPassword();

  if (isSubmitted) {
    return (
      <main className='flex min-h-dvh items-center justify-center bg-background px-4 py-8' suppressHydrationWarning>
        <div className='mx-auto w-full max-w-sm flex flex-col gap-5'>
          <div className='flex flex-col items-center gap-3 text-center'>
            <Link className="shrink-0" href='/' aria-label='Flux home'>
              <img src='/Flux.svg' alt='Flux' className='w-12 h-12' />
            </Link>
            <h1 className='text-2xl font-semibold tracking-tight text-foreground text-center'>Check your email</h1>
          </div>
          <div className='text-center space-y-3'>
            <p className='text-sm text-muted-foreground leading-relaxed'>
              We&apos;ve sent a password reset link to{' '}
              <span className='font-semibold text-foreground'>{email}</span>
            </p>
            <p className='text-13 text-muted-foreground'>
              Didn&apos;t receive the email? Check your spam folder or{' '}
              <button
                type='button'
                onClick={handleTryAgain}
                className='text-primary font-semibold hover:underline cursor-pointer touch-manipulation py-0.5'
              >
                try again
              </button>
            </p>
          </div>
          <Button asChild className='w-full h-9 rounded-md cursor-pointer'>
            <Link href='/login'>Return to sign in</Link>
          </Button>
        </div>
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
          <h1 className='text-2xl font-semibold tracking-tight text-foreground text-center'>Reset your password</h1>
          <p className='text-13 text-muted-foreground'>
            Enter your registered email address to receive password reset instructions.
          </p>
        </div>

        <form onSubmit={handleSubmit} className='flex flex-col gap-3.5'>
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
            {isPending ? 'Sending...' : 'Send reset link'}
          </Button>
        </form>

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

export default ForgotPasswordPage;
