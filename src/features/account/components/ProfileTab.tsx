'use client';

import { useRef, useEffect } from 'react';
import { useAuth } from '@/features/auth';
import { useUpload } from '@/shared/hooks';
import { useUpdateProfile } from '../hooks/use-profile';
import { toast } from 'sonner';
import { Avatar, AvatarImage, AvatarFallback } from '@/shared/components/ui/avatar';
import { Button, Input } from '@/shared/components/ui';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { updateProfileSchema } from '../schemas/profile.schema';
import * as z from 'zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/shared/components/ui/form';

export default function ProfileTab() {
  const { user, isLoading } = useAuth();
  const { uploadFile, isUploading } = useUpload();
  const fileRef = useRef<HTMLInputElement>(null);
  const updateProfileMutation = useUpdateProfile();

  const form = useForm<z.infer<typeof updateProfileSchema>>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      displayName: '',
      avatar: '',
    },
  });

  useEffect(() => {
    if (user) {
      const parts = (user.name || '').split(' ');
      const firstName = parts[0] || '';
      const lastName = parts.slice(1).join(' ') || '';
      form.reset({
        firstName,
        lastName,
        displayName: user.name || '',
        avatar: user.avatar || '',
      });
    }
  }, [user, form]);

  const currentAvatar = form.watch('avatar');
  const currentFirstName = form.watch('firstName');
  const currentLastName = form.watch('lastName');
  const currentName = `${currentFirstName} ${currentLastName || ''}`.trim();

  const handleAvatarUpload = async (file: File) => {
    try {
      const finalUrl = await uploadFile(file, 'workspace/avatars');
      form.setValue('avatar', finalUrl, { shouldDirty: true });
      updateProfileMutation.mutate({
        name: currentName.trim() || user?.name || '',
        avatar: finalUrl,
      });
    } catch (err: any) {
      toast.error(err.message || 'Failed to upload avatar');
    }
  };

  const onSubmit = (values: z.infer<typeof updateProfileSchema>) => {
    updateProfileMutation.mutate({
      name: `${values.firstName.trim()} ${values.lastName?.trim() || ''}`.trim(),
      avatar: values.avatar || null,
    });
  };

  if (isLoading || !user) return null;

  return (
    <div className='p-6 md:px-8 w-full max-w-4xl mx-auto'>
      <div className='flex flex-col gap-4'>
        {/* Profile Card / Cover */}
        <div>
          <div className='relative h-32 w-full rounded-t-lg bg-muted overflow-hidden'>
            {/* Noise texture overlay */}
            <div
              className='absolute inset-0 z-0 opacity-50'
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
                backgroundBlendMode: 'multiply',
              }}
            />
            <Button
              variant='outline'
              size='sm'
              className='absolute right-4 bottom-4 z-10 bg-background/50 backdrop-blur-sm'
            >
              Change cover
            </Button>
          </div>

          <div className='relative px-0 pb-2'>
            <div className='absolute -top-10 left-0'>
              <button
                type='button'
                onClick={() => fileRef.current?.click()}
                disabled={isUploading || updateProfileMutation.isPending}
                className='relative group overflow-hidden rounded-full ring-4 ring-background bg-background transition-transform hover:scale-105 active:scale-95'
              >
                <Avatar className='size-20 rounded-full bg-background text-2xl font-semibold'>
      {currentAvatar ? <AvatarImage src={currentAvatar} alt={String(currentName)} referrerPolicy="no-referrer" /> : null}
      <AvatarFallback>{String(currentName).substring(0, 2).toUpperCase() || 'U'}</AvatarFallback>
    </Avatar>
                <div className='absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity'>
                  <span className='text-[10px] text-white font-medium'>Upload</span>
                </div>
              </button>
              <input
                type='file'
                ref={fileRef}
                className='hidden'
                accept='image/*'
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleAvatarUpload(file);
                }}
              />
            </div>

            <div className='pt-12'>
              <h2 className='text-xl font-semibold text-foreground'>{user.name}</h2>
              <p className='text-sm text-muted-foreground'>{user.email}</p>
            </div>
          </div>
        </div>

        {/* Form Fields */}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-5'>
            <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      First name <span className='text-destructive'>*</span>
                    </FormLabel>
                    <FormControl>
                      <Input placeholder='' {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Last name
                    </FormLabel>
                    <FormControl>
                      <Input placeholder='' {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="displayName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Display name <span className='text-destructive'>*</span>
                    </FormLabel>
                    <FormControl>
                      <Input placeholder='' {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>

              <div className='space-y-2'>
                <FormLabel>
                  Email <span className='text-destructive'>*</span>
                </FormLabel>
                <Input
                  value={user.email}
                  disabled
                  className='bg-muted/50 text-muted-foreground'
                />
                <button type='button' className='text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 mt-1 inline-block'>
                  Change email
                </button>
              </div>
            </div>

            <div>
              <Button
                type='submit'
                disabled={!form.formState.isDirty || updateProfileMutation.isPending}
              >
                {updateProfileMutation.isPending ? 'Saving...' : 'Save changes'}
              </Button>
            </div>
          </form>
        </Form>

        {/* Danger Zone */}
        <div className='mt-8 pt-8 border-t border-border'>
          <div className='rounded-lg border border-border p-6 flex flex-col md:flex-row md:items-center justify-between gap-4'>
            <div>
              <h3 className='text-sm font-semibold text-foreground'>Deactivate account</h3>
              <p className='text-sm text-muted-foreground mt-1'>
                When deactivating an account, all of the data and resources within that account will be permanently removed and cannot be recovered.
              </p>
            </div>
            <Button variant='outline' className='text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0'>
              Deactivate account
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}


