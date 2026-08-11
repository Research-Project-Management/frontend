'use client';

import { useState } from 'react';
import { useAuth } from '@/features/auth';
import { useChangePassword } from '../hooks/use-security';
import { Button, Input } from '@/shared/components/ui';
import { Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { changePasswordSchema } from '../schemas/security.schema';
import * as z from 'zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/shared/components/ui/form';

export default function SecurityTab() {
  const { user } = useAuth();
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const changePasswordMutation = useChangePassword();

  const isOAuth = !!(user as any)?.googleId || !!(user as any)?.githubId;

  const form = useForm<z.infer<typeof changePasswordSchema>>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const onSubmit = (values: z.infer<typeof changePasswordSchema>) => {
    if (isOAuth) {
      toast.error('Password changes are not available for Google/GitHub accounts');
      return;
    }

    changePasswordMutation.mutate(
      {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
        confirmPassword: values.confirmPassword,
      },
      {
        onSuccess: () => {
          form.reset();
        },
      }
    );
  };

  return (
    <div className='p-6 md:px-8 w-full max-w-4xl mx-auto'>
      <div className='mb-8'>
        <h2 className='text-xl font-semibold text-foreground'>Change password</h2>
      </div>

      {isOAuth ? (
        <div className='rounded-lg bg-muted p-4 text-sm text-muted-foreground'>
          You are signed in with a third-party provider (Google/GitHub). Password change is not applicable.
        </div>
      ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-6'>
            <FormField
              control={form.control}
              name="currentPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Current password</FormLabel>
                  <FormControl>
                    <div className='relative md:max-w-sm'>
                      <Input
                        type={showCurrent ? 'text' : 'password'}
                        placeholder='Enter current password'
                        className='pr-10'
                        {...field}
                      />
                      <button
                        type='button'
                        onClick={() => setShowCurrent(!showCurrent)}
                        className='absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground'
                      >
                        {showCurrent ? <EyeOff className='size-4' /> : <Eye className='size-4' />}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
              <FormField
                control={form.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New password</FormLabel>
                    <FormControl>
                      <div className='relative'>
                        <Input
                          type={showNew ? 'text' : 'password'}
                          placeholder='Enter new password'
                          className='pr-10'
                          {...field}
                        />
                        <button
                          type='button'
                          onClick={() => setShowNew(!showNew)}
                          className='absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground'
                        >
                          {showNew ? <EyeOff className='size-4' /> : <Eye className='size-4' />}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm password</FormLabel>
                    <FormControl>
                      <div className='relative'>
                        <Input
                          type={showConfirm ? 'text' : 'password'}
                          placeholder='Confirm password'
                          className='pr-10'
                          {...field}
                        />
                        <button
                          type='button'
                          onClick={() => setShowConfirm(!showConfirm)}
                          className='absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground'
                        >
                          {showConfirm ? <EyeOff className='size-4' /> : <Eye className='size-4' />}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className='pt-4'>
              <Button
                type="submit"
                disabled={!form.formState.isDirty || changePasswordMutation.isPending}
              >
                {changePasswordMutation.isPending ? 'Updating...' : 'Update password'}
              </Button>
            </div>
          </form>
        </Form>
      )}

    </div>
  );
}
