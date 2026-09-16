'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { User, SlidersHorizontal, LogOut, Image as ImageIcon } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui";
import { useAuth } from '@/features/auth/hooks/use-auth';
import { Avatar, AvatarImage, AvatarFallback } from "@/shared/components/ui";
import { resolveFileUrl } from "@/shared/lib/file-client";
import { useUserCover } from '@/features/account/hooks/use-user-cover';
import { CoverModal } from '@/features/account/components/CoverModal';
import { useUpload } from '@/shared/hooks/use-upload';
import { toast } from 'sonner';

interface AccountDropdownProps {
  className?: string;
}

export default function AccountDropdown({}: AccountDropdownProps = {}) {
  const { user, isLoading, logout } = useAuth();
  const { cover, setCover } = useUserCover();
  const { uploadFile, isUploading } = useUpload();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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

  if (!mounted || isLoading) {
    return (
      <div className="size-8 flex items-center justify-center">
        <div className="size-7 rounded-full bg-muted border border-border/50 animate-pulse" />
      </div>
    );
  }

  if (!user) {
    return (
      <Link
        href="/login"
        className="flex items-center justify-center size-8 rounded-md text-foreground transition-colors hover:bg-muted cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
        aria-label="Sign in"
      >
        <Avatar className="size-7 rounded-full border border-border">
          <AvatarFallback className="text-11 font-medium bg-muted text-muted-foreground">U</AvatarFallback>
        </Avatar>
      </Link>
    );
  }

  return (
    <>
      <CoverModal
        currentCover={cover}
        onSelectCover={handleSelectCover}
        onUploadCustomCover={handleUploadCustomCover}
        isUploading={isUploading}
      >
        <button id="account-cover-modal-trigger" className="hidden" type="button" />
      </CoverModal>

      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center justify-center size-8 rounded-md transition-colors hover:bg-muted outline-none focus-visible:ring-1 focus-visible:ring-primary data-[state=open]:bg-muted cursor-pointer">
          <Avatar className="size-7 rounded-full shrink-0 border border-border/60">
            {user.avatar ? (
              <AvatarImage
                src={resolveFileUrl(user.avatar) || undefined}
                alt={String(user.name || '')}
                referrerPolicy="no-referrer"
              />
            ) : null}
            <AvatarFallback>{String(user.name || '').substring(0, 2).toUpperCase() || 'U'}</AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          onCloseAutoFocus={(e) => e.preventDefault()}
          className="w-68 p-0 overflow-hidden bg-popover rounded-md shadow-lg border border-border"
          alignOffset={0}
        >
          {/* Cover Banner Header with Change Background Button */}
          <div className="relative border-b border-border bg-popover overflow-hidden">
            <div className="relative h-20 w-full bg-muted overflow-hidden group">
              {cover ? (
                <img
                  src={cover}
                  alt="Profile Cover"
                  className="size-full object-cover"
                />
              ) : (
                <div className="size-full bg-gradient-to-r from-blue-500/30 via-indigo-500/20 to-purple-500/30" />
              )}
              <div className="absolute inset-0 bg-black/25 pointer-events-none" />

              {/* Change Cover Trigger Button */}
              <button
                type="button"
                onClick={() => {
                  document.getElementById('account-cover-modal-trigger')?.click();
                }}
                className="absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/55 hover:bg-black/75 text-white text-11 font-medium transition-colors cursor-pointer opacity-85 hover:opacity-100 backdrop-blur-xs outline-none"
                title="Change background"
              >
                <ImageIcon className="size-3 shrink-0" />
                <span>Cover</span>
              </button>
            </div>

            {/* Hanging Avatar & Name / Email */}
            <div className="flex flex-col items-center justify-center text-center px-4 pb-3.5 -mt-8 relative z-10">
              <Avatar className="size-14 rounded-full border-2 border-popover shadow-md shrink-0 bg-popover">
                {user.avatar ? (
                  <AvatarImage
                    src={resolveFileUrl(user.avatar) || undefined}
                    alt={String(user.name || '')}
                    referrerPolicy="no-referrer"
                  />
                ) : null}
                <AvatarFallback className="text-14 font-semibold">
                  {String(user.name || '').substring(0, 2).toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <p className="text-13 font-semibold text-foreground mt-2 max-w-full truncate tracking-tight">
                {user?.name || 'User'}
              </p>
              <p className="text-11 text-muted-foreground mt-0.5 max-w-full truncate">
                {user?.email || ''}
              </p>
            </div>
          </div>

          {/* Menu Items: Profile, Preferences, Sign out */}
          <div className="p-1.5 space-y-0.5">
            <DropdownMenuItem
              className="cursor-pointer gap-2.5 px-3 py-2 text-foreground"
              asChild
            >
              <Link href="/settings">
                <User className="size-4 text-foreground shrink-0" />
                <span>Profile</span>
              </Link>
            </DropdownMenuItem>

            <DropdownMenuItem
              className="cursor-pointer gap-2.5 px-3 py-2 text-foreground"
              asChild
            >
              <Link href="/settings/preferences">
                <SlidersHorizontal className="size-4 text-foreground shrink-0" />
                <span>Preferences</span>
              </Link>
            </DropdownMenuItem>

            <DropdownMenuSeparator className="my-1 bg-border" />

            <DropdownMenuItem
              onClick={() => logout()}
              className="cursor-pointer gap-2.5 px-3 py-2 text-destructive focus:text-destructive focus:bg-destructive/10"
            >
              <LogOut className="size-4 text-destructive shrink-0" />
              <span>Sign out</span>
            </DropdownMenuItem>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
