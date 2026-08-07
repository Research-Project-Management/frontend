'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';

import { useAuth, useLogin, loginSchema, type LoginSchema } from '@/features/auth';
import { Button, Input, Spinner } from '@/shared/components/ui-version';

const LoginPage = () => {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();
  const { login, isPending, error, handleOAuthLogin } = useLogin();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginSchema>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  useEffect(() => {
    if (!isAuthLoading && user) {
      router.replace('/create');
    }
  }, [isAuthLoading, user, router]);


  if (isAuthLoading) return <Spinner fullScreen />;
  if (user) return null;

  const onSubmit = (data: LoginSchema) => {
    login({ email: data.email.trim(), password: data.password });
  };

  return (
    <div className='flex min-h-screen items-start justify-center bg-background px-4'>
      <div className='mx-auto w-full max-w-sm pt-12 flex flex-col gap-6'>
        <div className='flex flex-col items-center gap-4'>
          <Link href='/'>
            <img src='/Flux.svg' alt='Flux' className='w-16 h-16' />
          </Link>
          <h2 className='text-2xl font-bold text-center'>Login to Flux</h2>
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

          <div className='flex flex-col gap-1'>
            <Input
              type='password'
              placeholder='Password'
              className='h-12 text-base font-normal'
              {...register('password')}
            />
            {errors.password && (
              <p className='text-xs text-destructive'>{errors.password.message}</p>
            )}
          </div>

          <div className='text-right'>
            <Link
              href='/forgot-password'
              className='text-sm text-gray-600 hover:text-primary transition-colors'
            >
              Forgot password?
            </Link>
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
            {isPending ? 'Logging in...' : 'Login'}
          </Button>
        </form>

        <div className='text-center text-gray-600'>
          Don&apos;t have an account?{' '}
          <Link href='/register' className='text-primary font-semibold hover:underline'>
            Register
          </Link>
        </div>

        <div className='flex flex-col gap-4 mt-2'>
          <Button
            variant='outline'
            type='button'
            onClick={() => handleOAuthLogin('google')}
            className='w-full gap-2 h-12 font-normal text-gray-700'
          >
            <img src='/google.svg' alt='Google' className='w-5 h-5' />
            Login with Google
          </Button>
          <Button
            variant='outline'
            type='button'
            onClick={() => handleOAuthLogin('github')}
            className='w-full gap-2 h-12 font-normal text-gray-700'
          >
            <img src='/github.svg' alt='Github' className='w-5 h-5' />
            Login with Github
          </Button>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
