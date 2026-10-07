'use client';

import { useRef, useMemo } from 'react';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { useUpload } from "@/shared/hooks/use-upload";
import { useUpdateProfile } from '../../hooks/use-profile';
import { toast } from 'sonner';
import { Avatar, AvatarImage, AvatarFallback } from "@/shared/components/ui";
import { Button } from "@/shared/components/ui";
import { Input } from "@/shared/components/ui";
import { getErrorMessage } from "@/shared/lib/utils";
import { useForm, useWatch, type Control } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { updateProfileSchema } from '../../types/profile.schema';
import type { UpdateProfileFormValues } from '../../types/profile.types';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/shared/components/ui";
import { Loader2, AlertTriangle, Lock, Image as ImageIcon } from 'lucide-react';
import { useUserCover } from '../../hooks/use-user-cover';
import { CoverModal } from './CoverModal';

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
    <Avatar className="size-16 rounded-full border border-border bg-muted text-lg font-semibold shrink-0">
      {avatar ? <AvatarImage src={avatar} alt={currentName} referrerPolicy="no-referrer" /> : null}
      <AvatarFallback>{initials}</AvatarFallback>
    </Avatar>
  );
}

export function ProfileTab() {
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

  const { cover, setCover } = useUserCover();

  const handleSelectCover = (coverUrl: string) => {
    setCover(coverUrl);
    toast.success('Background updated');
  };

  const handleUploadCustomCover = async (file: File) => {
    try {
      const url = await uploadFile(file, 'user/covers');
      setCover(url);
      toast.success('Background uploaded');
    } catch {
      const localUrl = URL.createObjectURL(file);
      setCover(localUrl);
    }
  };

  if (isLoading || !user) return null;

  return (
    <div className="w-full max-w-3xl mx-auto p-6 md:p-8 space-y-6">
      {/* ── Section 1: Visual Banner & Identity ── */}
      <div className="relative w-full rounded-lg border border-border overflow-hidden bg-muted h-48 sm:h-56 flex flex-col justify-end p-5">
        {/* Background Cover Image or Default Gradient */}
        {cover ? (
          <img
            src={cover}
            alt="Profile Cover"
            className="absolute inset-0 size-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-r from-primary/25 via-primary/10 to-primary/20" />
        )}

        {/* Subtle overlay for text contrast */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent pointer-events-none" />

        {/* Content over Banner */}
        <div className="relative z-10 flex items-end justify-between gap-4 flex-wrap sm:flex-nowrap">
          {/* Left: Avatar & Info */}
          <div className="flex items-center gap-4 min-w-0">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={isUploading || updateProfileMutation.isPending}
              className="cursor-pointer group relative block shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 before:absolute before:-inset-2 md:before:hidden"
              title="Upload new picture"
              aria-label="Upload new profile picture"
            >
              <div className="size-16 sm:size-18 rounded-full border-2 border-white/85 bg-background flex items-center justify-center overflow-hidden">
                <ProfileAvatarDisplay control={form.control} fallbackName={user.name || ''} />
              </div>
              <div className="absolute inset-0 rounded-full bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-12 text-white font-medium">
                {isUploading ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none text-white" /> : 'Edit'}
              </div>
            </button>

            <div className="min-w-0 text-white">
              <h2 className="text-16 sm:text-18 font-semibold truncate leading-tight tracking-tight text-white">
                {user.name || 'User'}
              </h2>
              <p className="text-12 text-white/85 font-medium mt-0.5 tracking-wide truncate">
                {user.email}
              </p>
            </div>
          </div>

          {/* Right: Change Cover Modal Button */}
          <CoverModal
            currentCover={cover}
            onSelectCover={handleSelectCover}
            onUploadCustomCover={handleUploadCustomCover}
            isUploading={isUploading}
          >
            <button
              type="button"
              className="h-8 px-3 rounded-md border border-white/20 bg-background/90 hover:bg-background text-foreground text-12 font-medium flex items-center gap-1.5 transition-colors cursor-pointer select-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring shrink-0 backdrop-blur-xs relative before:absolute before:-inset-1.5 md:before:hidden"
            >
              <ImageIcon className="size-3.5 text-foreground shrink-0" />
              <span>Change cover</span>
            </button>
          </CoverModal>
        </div>

        <input
          type="file"
          ref={fileRef}
          className="hidden"
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleAvatarUpload(file);
          }}
        />
      </div>

      {/* ── Section 2: Personal Information Form ── */}
      <div className="space-y-6">
        <div className="pb-4 border-b border-border">
          <h3 className="text-14 font-semibold text-foreground tracking-tight">Personal Details</h3>
          <p className="text-12 text-muted-foreground mt-1">
            Manage your personal profile and display credentials across research projects.
          </p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-w-2xl">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-12 font-medium text-foreground">
                      First name <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="First name" className="h-8 text-13" {...field} />
                    </FormControl>
                    <FormMessage className="text-11" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-12 font-medium text-foreground">
                      Last name
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="Last name" className="h-8 text-13" {...field} />
                    </FormControl>
                    <FormMessage className="text-11" />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="displayName"
              render={({ field }) => (
                <FormItem className="space-y-1.5">
                  <FormLabel className="text-12 font-medium text-foreground">
                    Display name <span className="text-destructive">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="Display name" className="h-8 text-13" {...field} />
                  </FormControl>
                  <p className="text-11 text-muted-foreground">
                    Your primary identifier displayed on work items, peer reviews, and collaborative papers.
                  </p>
                  <FormMessage className="text-11" />
                </FormItem>
              )}
            />

            <div className="space-y-1.5 pt-1">
              <label className="text-12 font-medium text-foreground flex items-center gap-1.5">
                <span>Email address</span>
                <Lock className="size-3 text-muted-foreground shrink-0" />
              </label>
              <Input
                value={user.email}
                disabled
                className="h-8 text-13 bg-muted/60 text-muted-foreground cursor-not-allowed select-none"
              />
              <p className="text-11 text-muted-foreground">
                Account email is tied to your personal research workspace. Contact support to transfer.
              </p>
            </div>

            <div className="flex items-center justify-start pt-2">
              <Button
                type="submit"
                size="sm"
                className="h-8 px-4 text-13 font-medium cursor-pointer shadow-none relative before:absolute before:-inset-1.5 md:before:hidden"
                disabled={!form.formState.isDirty || updateProfileMutation.isPending}
              >
                {updateProfileMutation.isPending ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none mr-1.5 shrink-0" />
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
      <div className="rounded-md border border-destructive/20 bg-destructive/5 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="size-4 text-destructive shrink-0" strokeWidth={1.5} />
            <h3 className="text-13 font-semibold text-destructive">Deactivate Account</h3>
          </div>
          <p className="text-11 text-muted-foreground max-w-lg">
            Permanently remove your personal workspace and revoke access to all collaborative research projects.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-12 font-medium text-destructive border-destructive/30 hover:bg-destructive/10 shrink-0 cursor-pointer relative before:absolute before:-inset-1.5 md:before:hidden"
        >
          Deactivate account
        </Button>
      </div>
    </div>
  );
}

export default ProfileTab;
