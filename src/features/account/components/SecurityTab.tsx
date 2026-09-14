'use client';

import { useState } from 'react';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { useChangePassword } from '../hooks/use-security';
import { Button } from "@/shared/components/ui";
import { Input } from "@/shared/components/ui";
import { Eye, EyeOff, ShieldAlert } from 'lucide-react';
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
} from "@/shared/components/ui";

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
    <div className='p-6 md:px-8 w-full max-w-4xl mx-auto space-y-6'>
      {isOAuth ? (
        <div className='rounded-md border border-border bg-muted/20 p-4 flex items-start gap-3'>
          <ShieldAlert className='size-4 text-muted-foreground mt-0.5 shrink-0' />
          <div>
            <h4 className='text-13 font-medium text-foreground'>Managed by external provider</h4>
            <p className='text-12 text-muted-foreground mt-0.5'>
              Your account is authenticated via Google or GitHub. Password changes are managed directly with your identity provider.
            </p>
          </div>
        </div>
      ) : (
        <div className='rounded-md border border-border bg-card p-5 space-y-5'>
          <div className='border-b border-border pb-3'>
            <h3 className='text-13 font-medium text-foreground'>Password Management</h3>
            <p className='text-12 text-muted-foreground mt-0.5'>
              Ensure your account is using a long, random password to stay secure.
            </p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-4'>
              <FormField
                control={form.control}
                name="currentPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className='text-12 font-medium text-foreground'>Current password</FormLabel>
                    <FormControl>
                      <div className='relative max-w-md'>
                        <Input
                          type={showCurrent ? 'text' : 'password'}
                          placeholder='Enter current password'
                          className='h-8 text-13 pr-9 shadow-2xs'
                          {...field}
                        />
                        <button
                          type='button'
                          onClick={() => setShowCurrent(!showCurrent)}
                          className='absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer'
                        >
                          {showCurrent ? <EyeOff className='size-3.5 shrink-0' /> : <Eye className='size-3.5 shrink-0' />}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className='grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl'>
                <FormField
                  control={form.control}
                  name="newPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className='text-12 font-medium text-foreground'>New password</FormLabel>
                      <FormControl>
                        <div className='relative'>
                          <Input
                            type={showNew ? 'text' : 'password'}
                            placeholder='Enter new password'
                            className='h-8 text-13 pr-9 shadow-2xs'
                            {...field}
                          />
                          <button
                            type='button'
                            onClick={() => setShowNew(!showNew)}
                            className='absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer'
                          >
                            {showNew ? <EyeOff className='size-3.5 shrink-0' /> : <Eye className='size-3.5 shrink-0' />}
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
                      <FormLabel className='text-12 font-medium text-foreground'>Confirm password</FormLabel>
                      <FormControl>
                        <div className='relative'>
                          <Input
                            type={showConfirm ? 'text' : 'password'}
                            placeholder='Confirm password'
                            className='h-8 text-13 pr-9 shadow-2xs'
                            {...field}
                          />
                          <button
                            type='button'
                            onClick={() => setShowConfirm(!showConfirm)}
                            className='absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer'
                          >
                            {showConfirm ? <EyeOff className='size-3.5 shrink-0' /> : <Eye className='size-3.5 shrink-0' />}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className='pt-2 flex justify-start'>
                <Button
                  type="submit"
                  size="sm"
                  className='h-8 px-4 text-13 font-medium shadow-2xs cursor-pointer'
                  disabled={!form.formState.isDirty || changePasswordMutation.isPending}
                >
                  {changePasswordMutation.isPending ? 'Updating...' : 'Update password'}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      )}
    </div>
  );
}
