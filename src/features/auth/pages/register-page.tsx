'use client';

import Link from 'next/link';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useRegister } from '../hooks/use-register';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';

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
      <div className='flex min-h-screen items-center justify-center bg-background'>
        <Loader2 className='h-8 w-8 animate-spin text-primary' />
      </div>
    );
  }

  if (user) return null;

  return (
    <div className='flex min-h-dvh items-center justify-center bg-background px-4 py-8'>
      <div className='mx-auto w-full max-w-sm flex flex-col gap-5'>
        <div className='flex flex-col items-center gap-3 text-center'>
          <Link href='/'>
            <img src='/Flux.svg' alt='Flux' className='w-14 h-14' />
          </Link>
          <h2 className='text-2xl font-semibold tracking-tight text-foreground'>Create your account</h2>
        </div>

        <form onSubmit={handleSubmit} className='flex flex-col gap-3.5'>
          <div className='flex flex-col gap-1'>
            <Input
              id='name'
              type='text'
              placeholder='Full name'
              aria-label='Full name'
              className='h-10 rounded-lg'
              {...register('name')}
            />
            {errors.name && (
              <p className='text-xs text-destructive'>{errors.name.message}</p>
            )}
          </div>

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

          <div className='flex flex-col gap-1'>
            <div className='relative'>
              <Input
                id='password'
                type={showPassword ? 'text' : 'password'}
                placeholder='Password'
                aria-label='Password'
                className='h-10 pr-10 rounded-lg'
                {...register('password')}
              />
              <button
                type='button'
                onClick={() => setShowPassword(!showPassword)}
                className='absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer'
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className='h-4 w-4' /> : <Eye className='h-4 w-4' />}
              </button>
            </div>
            {errors.password && (
              <p className='text-xs text-destructive'>{errors.password.message}</p>
            )}
          </div>

          <div className='flex flex-col gap-1'>
            <div className='relative'>
              <Input
                id='confirmPassword'
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder='Confirm password'
                aria-label='Confirm password'
                className='h-10 pr-10 rounded-lg'
                {...register('confirmPassword')}
              />
              <button
                type='button'
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className='absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer'
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
              >
                {showConfirmPassword ? <EyeOff className='h-4 w-4' /> : <Eye className='h-4 w-4' />}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className='text-xs text-destructive'>{errors.confirmPassword.message}</p>
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
            {isPending ? 'Creating account...' : 'Create account'}
          </Button>
        </form>

        <div className='text-center text-sm text-muted-foreground'>
          Already have an account?{' '}
          <Link
            href='/login'
            className='text-primary font-semibold transition-opacity hover:opacity-80'
          >
            Sign in
          </Link>
        </div>

        <div className='flex flex-col gap-2.5'>
          <Button
            variant='outline'
            type='button'
            onClick={() => handleOAuthLogin('google')}
            className='w-full h-10 gap-2 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors rounded-lg cursor-pointer'
          >
            <img src='/google.svg' alt='' aria-hidden='true' className='w-4 h-4' />
            Google
          </Button>
          <Button
            variant='outline'
            type='button'
            onClick={() => handleOAuthLogin('github')}
            className='w-full h-10 gap-2 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors rounded-lg cursor-pointer'
          >
            <img src='/github.svg' alt='' aria-hidden='true' className='w-4 h-4' />
            Github
          </Button>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
