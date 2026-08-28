'use client';

import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { useForgotPassword } from '../hooks/use-forgot-password';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';

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
      <div className='flex min-h-dvh items-center justify-center bg-background px-4 py-8'>
        <div className='mx-auto w-full max-w-sm flex flex-col gap-5'>
          <div className='flex flex-col items-center gap-3 text-center'>
            <Link href='/'>
              <img src='/Flux.svg' alt='Flux' className='w-14 h-14' />
            </Link>
            <h2 className='text-2xl font-semibold text-center'>Check your email</h2>
          </div>
          <div className='text-center'>
            <p className='text-muted-foreground'>
              We&apos;ve sent a password reset link to{' '}
              <span className='font-semibold text-foreground'>{email}</span>
            </p>
            <p className='mt-4 text-sm text-muted-foreground'>
              Didn&apos;t receive the email? Check your spam folder or{' '}
              <button
                onClick={handleTryAgain}
                className='text-primary font-semibold transition-opacity hover:opacity-80 cursor-pointer'
              >
                try again
              </button>
            </p>
          </div>
          <Link href='/login' className='w-full'>
            <Button className='w-full h-10 rounded-lg cursor-pointer'>Return to sign in</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className='flex min-h-dvh items-center justify-center bg-background px-4 py-8'>
      <div className='mx-auto w-full max-w-sm flex flex-col gap-5'>
        <div className='flex flex-col items-center gap-3 text-center'>
          <Link href='/'>
            <img src='/Flux.svg' alt='Flux' className='w-14 h-14' />
          </Link>
          <h2 className='text-2xl font-bold text-center'>Reset your password</h2>
        </div>

        <form onSubmit={handleSubmit} className='flex flex-col gap-3.5'>
          <div className='flex flex-col gap-1'>
            <Input
              id='email'
              type='email'
              placeholder='Email'
              aria-label='Email'
              className='h-10 rounded-lg'
              {...register('email')}
            />
            {errors.email && (
              <p className='text-xs text-destructive'>{errors.email.message}</p>
            )}
          </div>

          {error && (
            <div className='p-3 text-sm text-destructive bg-destructive/10 rounded-lg text-center'>
              {error}
            </div>
          )}

          <Button
            type='submit'
            className='w-full h-10 mt-1 rounded-lg cursor-pointer'
            disabled={isPending}
          >
            {isPending && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
            {isPending ? 'Sending...' : 'Send reset link'}
          </Button>
        </form>

        <div className='text-center text-sm text-muted-foreground'>
          <Link
            href='/login'
            className='text-primary font-semibold transition-opacity hover:opacity-80'
          >
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
