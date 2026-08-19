'use client';

import Link from 'next/link';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useRegister } from '../hooks/use-register';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';

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
    <div className='flex min-h-screen items-start justify-center bg-background px-4 py-12 sm:py-24'>
      <div className='mx-auto w-full max-w-sm flex flex-col gap-6'>
        <div className='flex flex-col items-center gap-4'>
          <Link href='/'>
            <img src='/Flux.svg' alt='Flux' className='w-16 h-16' />
          </Link>
          <div className='space-y-1.5 text-center'>
            <h2 className='text-2xl font-bold'>Create your account</h2>
            <p className='text-muted-foreground'>
              Join Flux to organize, write, and collaborate on your research.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className='flex flex-col gap-4'>
          <div className='flex flex-col gap-1.5'>
            <Label htmlFor='name'>Full name</Label>
            <Input
              id='name'
              type='text'
              placeholder='Jane Doe'
              className='h-10 rounded-lg'
              {...register('name')}
            />
            {errors.name && (
              <p className='text-xs text-destructive'>{errors.name.message}</p>
            )}
          </div>

          <div className='flex flex-col gap-1.5'>
            <Label htmlFor='email'>Email address</Label>
            <Input
              id='email'
              type='email'
              placeholder='you@example.com'
              className='h-10 rounded-lg'
              {...register('email')}
            />
            {errors.email && (
              <p className='text-xs text-destructive'>{errors.email.message}</p>
            )}
          </div>

          <div className='flex flex-col gap-1.5'>
            <Label htmlFor='password'>Password</Label>
            <div className='relative'>
              <Input
                id='password'
                type={showPassword ? 'text' : 'password'}
                placeholder='••••••••'
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

          <div className='flex flex-col gap-1.5'>
            <Label htmlFor='confirmPassword'>Confirm password</Label>
            <div className='relative'>
              <Input
                id='confirmPassword'
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder='••••••••'
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
            className='w-full h-10 mt-2 rounded-lg cursor-pointer'
            disabled={isPending}
          >
            {isPending && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
            {isPending ? 'Creating account...' : 'Create account'}
          </Button>
        </form>

        <div className='text-center text-muted-foreground'>
          Already have an account?{' '}
          <Link
            href='/login'
            className='text-primary font-semibold transition-opacity hover:opacity-80'
          >
            Sign in
          </Link>
        </div>

        <div className='relative'>
          <div className='absolute inset-0 flex items-center'>
            <span className='w-full border-t border-border' />
          </div>
          <div className='relative flex justify-center text-[11px] uppercase tracking-wider font-semibold text-muted-foreground'>
            <span className='bg-background px-2'>Or continue with</span>
          </div>
        </div>

        <div className='flex flex-col gap-3 mt-2'>
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
