'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Loader2 } from 'lucide-react';

import { useAuth } from '../hooks/use-auth';
import { useRegister } from '../hooks/use-register';
import { registerSchema, type RegisterSchema } from '../schemas/auth.schema';
import { fetchAllWorkspaces } from '@/features/workspaces/shell/services/workspace.service';
import { Button, Input, Label } from '@/shared/components/ui';

const RegisterPage = () => {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { user, isLoading: isAuthLoading } = useAuth();
  const { register: registerUser, isPending, error, handleOAuthLogin } = useRegister();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterSchema>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '', confirmPassword: '' },
  });

  useEffect(() => {
    if (!isAuthLoading && user) {
      fetchAllWorkspaces()
        .then((data) => {
          if (data.workspaces && data.workspaces.length > 0) {
            router.replace(`/${data.workspaces[0].url}`);
          } else {
            router.replace('/create-workspace');
          }
        })
        .catch(() => {
          router.replace('/create-workspace');
        });
    }
  }, [isAuthLoading, user, router]);


  if (isAuthLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (user) return null;

  const onSubmit = (data: RegisterSchema) => {
    registerUser({
      name: data.name.trim(),
      email: data.email.trim(),
      password: data.password,
    });
  };

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

        <form onSubmit={handleSubmit(onSubmit)} className='flex flex-col gap-4'>
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
          <Link href='/login' className='text-primary font-semibold transition-opacity hover:opacity-80'>
            Sign in
          </Link>
        </div>

        <div className='relative'>
          <div className='absolute inset-0 flex items-center'>
            <span className='w-full border-t border-border' />
          </div>
          <div className='relative flex justify-center text-[11px] uppercase tracking-wider font-semibold text-muted-foreground'>
            <span className='bg-background px-2'>
              Or continue with
            </span>
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
