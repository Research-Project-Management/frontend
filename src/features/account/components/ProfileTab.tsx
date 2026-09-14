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
import { Upload, Loader2, AlertTriangle, Lock } from 'lucide-react';

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
    <Avatar className='size-16 rounded-full border border-border bg-muted text-lg font-semibold shrink-0 shadow-2xs'>
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
    <div className='w-full max-w-3xl mx-auto p-6 md:p-8 space-y-6'>
      {/* ── Section 1: Avatar & Identity ── */}
      <div className='rounded-md border border-border bg-card p-5'>
        <div className='flex flex-col sm:flex-row sm:items-center gap-5'>
          <ProfileAvatarDisplay control={form.control} fallbackName={user.name || ''} />

          <div className='flex-1 min-w-0 space-y-2'>
            <div>
              <h2 className='text-sm font-semibold text-foreground tracking-tight truncate'>{user.name || 'Researcher'}</h2>
              <p className='text-xs text-muted-foreground truncate'>{user.email}</p>
            </div>

            <div className='flex items-center gap-2 pt-0.5'>
              <Button
                type='button'
                variant='outline'
                size='sm'
                onClick={() => fileRef.current?.click()}
                disabled={isUploading || updateProfileMutation.isPending}
                className='h-7.5 px-3 text-12 font-medium shadow-2xs cursor-pointer'
              >
                {isUploading ? (
                  <>
                    <Loader2 className='size-3.5 animate-spin mr-1.5 shrink-0' />
                    <span>Uploading...</span>
                  </>
                ) : (
                  <>
                    <Upload className='size-3.5 mr-1.5 shrink-0 text-muted-foreground' />
                    <span>Upload new picture</span>
                  </>
                )}
              </Button>

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
            <p className='text-11 text-muted-foreground'>
              Recommended square image, at least 256×256px (PNG, JPG or WebP).
            </p>
          </div>
        </div>
      </div>

      {/* ── Section 2: Personal Information Form ── */}
      <div className='rounded-md border border-border bg-card p-5'>
        <div className='mb-4'>
          <h3 className='text-13 font-semibold text-foreground tracking-tight'>Personal Details</h3>
          <p className='text-12 text-muted-foreground mt-0.5'>
            Manage your personal profile and display credentials across research projects.
          </p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-4'>
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem className='space-y-1.5'>
                    <FormLabel className='text-12 font-medium text-foreground'>
                      First name <span className='text-destructive'>*</span>
                    </FormLabel>
                    <FormControl>
                      <Input placeholder='First name' className='h-8 text-13' {...field} />
                    </FormControl>
                    <FormMessage className='text-11' />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem className='space-y-1.5'>
                    <FormLabel className='text-12 font-medium text-foreground'>
                      Last name
                    </FormLabel>
                    <FormControl>
                      <Input placeholder='Last name' className='h-8 text-13' {...field} />
                    </FormControl>
                    <FormMessage className='text-11' />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="displayName"
              render={({ field }) => (
                <FormItem className='space-y-1.5'>
                  <FormLabel className='text-12 font-medium text-foreground'>
                    Display name <span className='text-destructive'>*</span>
                  </FormLabel>
                  <FormControl>
                    <Input placeholder='Display name' className='h-8 text-13' {...field} />
                  </FormControl>
                  <p className='text-11 text-muted-foreground'>
                    Your primary identifier displayed on work items, peer reviews, and collaborative papers.
                  </p>
                  <FormMessage className='text-11' />
                </FormItem>
              )}
            />

            <div className='space-y-1.5 pt-1'>
              <label className='text-12 font-medium text-foreground flex items-center gap-1.5'>
                <span>Email address</span>
                <Lock className='size-3 text-muted-foreground shrink-0' />
              </label>
              <Input
                value={user.email}
                disabled
                className='h-8 text-13 bg-muted/60 text-muted-foreground cursor-not-allowed select-none'
              />
              <p className='text-11 text-muted-foreground'>
                Account email is tied to your personal research workspace. Contact support to transfer.
              </p>
            </div>

            <div className='flex items-center justify-end pt-2'>
              <Button
                type='submit'
                size='sm'
                className='h-8 px-4 text-13 font-medium bg-primary hover:bg-primary-hover text-primary-foreground shadow-none cursor-pointer'
                disabled={!form.formState.isDirty || updateProfileMutation.isPending}
              >
                {updateProfileMutation.isPending ? (
                  <>
                    <Loader2 className='size-3.5 animate-spin mr-1.5 shrink-0' />
                    <span>Saving...</span>
                  </>
                ) : (
                  'Save changes'
                )}
              </Button>
            </div>
          </form>
        </Form>
      </div>

      {/* ── Section 3: Account Deactivation (Danger Zone) ── */}
      <div className='rounded-md border border-destructive/20 bg-destructive/5 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4'>
        <div className='space-y-0.5'>
          <div className='flex items-center gap-1.5'>
            <AlertTriangle className='size-4 text-destructive shrink-0' />
            <h3 className='text-13 font-semibold text-destructive'>Deactivate Account</h3>
          </div>
          <p className='text-11 text-muted-foreground max-w-lg'>
            Permanently remove your personal workspace and revoke access to all collaborative research projects.
          </p>
        </div>
        <Button
          variant='outline'
          size='sm'
          className='h-8 text-12 font-medium text-destructive border-destructive/30 hover:bg-destructive/10 shadow-2xs shrink-0 cursor-pointer'
        >
          Deactivate account
        </Button>
      </div>
    </div>
  );
}


