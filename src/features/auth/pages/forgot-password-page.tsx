'use client';

import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';

import {
  useForgotPassword,
  forgotPasswordSchema,
  type ForgotPasswordSchema,
} from '@/features/auth';
import { Button, Input } from '@/shared/components/ui-version';

const ForgotPasswordPage = () => {
  const { sendResetLink, isPending, isSubmitted, error, handleTryAgain } =
    useForgotPassword();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ForgotPasswordSchema>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const email = watch('email');

  const onSubmit = (data: ForgotPasswordSchema) => {
    sendResetLink(data.email.trim());
  };

  if (isSubmitted) {
    return (
      <div className='flex min-h-screen items-start justify-center bg-background px-4'>
        <div className='mx-auto w-full max-w-sm pt-12 flex flex-col gap-6'>
          <div className='flex flex-col items-center gap-4'>
            <Link href='/'>
              <img src='/Flux.svg' alt='Flux' className='w-16 h-16' />
            </Link>
            <h2 className='text-2xl font-semibold text-center'>Check your email</h2>
          </div>
          <div className='mt-2 text-center'>
            <p className='text-gray-600'>
              We&apos;ve sent a password reset link to{' '}
              <span className='font-semibold text-foreground'>{email}</span>
            </p>
            <p className='mt-4 text-sm text-muted-foreground'>
              Didn&apos;t receive the email? Check your spam folder or{' '}
              <button
                onClick={handleTryAgain}
                className='text-primary font-semibold hover:underline'
              >
                try again
              </button>
            </p>
          </div>
          <Link href='/login' className='w-full mt-4'>
            <Button className='w-full h-12 text-base font-medium'>Back to Login</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className='flex min-h-screen items-start justify-center bg-background px-4'>
      <div className='mx-auto w-full max-w-sm pt-12 flex flex-col gap-6'>
        <div className='flex flex-col items-center gap-4'>
          <Link href='/'>
            <img src='/Flux.svg' alt='Flux' className='w-16 h-16' />
          </Link>
          <h2 className='text-2xl font-semibold text-center'>Forgot Password</h2>
          <p className='text-center text-muted-foreground text-sm'>
            Enter your email address and we&apos;ll send you a link to reset your password.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className='flex flex-col gap-4'>
          <div className='flex flex-col gap-1'>
            <Input
              type='email'
              placeholder='Email'
              className='h-12 text-base font-normal'
              {...register('email')}
            />
            {errors.email && (
              <p className='text-xs text-destructive'>{errors.email.message}</p>
            )}
          </div>

          {error && (
            <div className='p-3 text-sm text-destructive bg-destructive/10 rounded-md text-center'>
              {error}
            </div>
          )}

          <Button
            type='submit'
            className='w-full h-12 text-base mt-2 font-medium'
            disabled={isPending}
          >
            {isPending && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
            {isPending ? 'Sending...' : 'Send Reset Link'}
          </Button>
        </form>

        <div className='text-center text-gray-600 mt-2'>
          Remember your password?{' '}
          <Link href='/login' className='text-primary font-semibold hover:underline'>
            Login
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
