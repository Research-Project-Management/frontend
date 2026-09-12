'use client';

import { useRef, useMemo } from 'react';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { useUpload } from "@/shared/hooks/use-upload";
import { useUpdateProfile } from '../hooks/use-profile';
import { toast } from 'sonner';
import { Avatar, AvatarImage, AvatarFallback } from "@/shared/components/ui";
import { Button } from "@/shared/components/ui";
import { Input } from "@/shared/components/ui";
import { getErrorMessage } from "@/shared/lib/utils";
import { useForm, useWatch, type Control } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { updateProfileSchema } from '../schemas/profile.schema';
import type { UpdateProfileFormValues } from '../types/profile.types';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/shared/components/ui";

interface ProfileAvatarDisplayProps {
  control: Control<UpdateProfileFormValues>;
  fallbackName: string;
}

function ProfileAvatarDisplay({ control, fallbackName }: ProfileAvatarDisplayProps) {
  const avatar = useWatch({ control, name: 'avatar' });
  const firstName = useWatch({ control, name: 'firstName' });
  const lastName = useWatch({ control, name: 'lastName' });
  const currentName = `${firstName || ''} ${lastName || ''}`.trim() || fallbackName;
  const initials = currentName.substring(0, 2).toUpperCase() || 'U';

  return (
    <Avatar className='size-20 rounded-full bg-background text-2xl font-semibold'>
      {avatar ? <AvatarImage src={avatar} alt={currentName} referrerPolicy="no-referrer" /> : null}
      <AvatarFallback>{initials}</AvatarFallback>
    </Avatar>
  );
}

export default function ProfileTab() {
  const { user, isLoading } = useAuth();
  const { uploadFile, isUploading } = useUpload();
  const fileRef = useRef<HTMLInputElement>(null);
  const updateProfileMutation = useUpdateProfile();

  const userProfileValues = useMemo(() => {
    if (!user) return undefined;
    const parts = (user.name || '').split(' ');
    const firstName = parts[0] || '';
    const lastName = parts.slice(1).join(' ') || '';
    return {
      firstName,
      lastName,
      displayName: user.name || '',
      avatar: user.avatar || '',
    };
  }, [user]);

  const form = useForm<UpdateProfileFormValues>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      displayName: '',
      avatar: '',
    },
    values: userProfileValues,
    resetOptions: {
      keepDirtyValues: true,
    },
  });

  const handleAvatarUpload = async (file: File) => {
    try {
      const finalUrl = await uploadFile(file, 'workspace/avatars');
      form.setValue('avatar', finalUrl, { shouldDirty: true });
      const currentValues = form.getValues();
      const currentName = `${currentValues.firstName || ''} ${currentValues.lastName || ''}`.trim();
      const computedName = (
        currentValues.displayName?.trim() ||
        currentName ||
        user?.name ||
        ''
      );
      updateProfileMutation.mutate({
        name: computedName,
        avatar: finalUrl,
      });
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || 'Failed to upload avatar');
    }
  };

  const onSubmit = (values: UpdateProfileFormValues) => {
    const computedName = (
      values.displayName?.trim() ||
      `${values.firstName.trim()} ${values.lastName?.trim() || ''}`.trim() ||
      user?.name ||
      ''
    );
    updateProfileMutation.mutate({
      name: computedName,
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
              className='absolute right-4 bottom-4 z-10 bg-background/50 backdrop-blur-sm cursor-pointer'
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
                className='relative group overflow-hidden rounded-full ring-4 ring-background bg-background transition-transform hover:scale-105 active:scale-95 cursor-pointer'
              >
                <ProfileAvatarDisplay control={form.control} fallbackName={user.name || ''} />
                <div className='absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity'>
                  <span className='text-xs text-white font-medium'>Upload</span>
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
                  className='bg-muted text-muted-foreground'
                />
                <button type='button' className='text-xs text-foreground underline underline-offset-2 mt-1 inline-block cursor-pointer'>
                  Change email
                </button>
              </div>
            </div>

            <div>
              <Button
                type='submit'
                className='cursor-pointer'
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
            <Button variant='outline' className='text-destructive hover:bg-destructive/10 shrink-0 cursor-pointer'>
              Deactivate account
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}


