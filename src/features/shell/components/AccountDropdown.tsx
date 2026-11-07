'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  User,
  SlidersHorizontal,
  LogOut,
  Image as ImageIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { useAuth } from '@/features/auth/hooks/use-auth';
import { Avatar, AvatarImage, AvatarFallback } from "@/shared/components/ui/avatar";
import { resolveFileUrl } from "@/shared/lib/file-client";
import { useUserCover } from '@/features/settings/hooks/use-user-cover';
import { useUpload } from "@/shared/hooks/use-upload";
import { useWorkspaceContextStore } from '../store/workspace-context.store';
import { useLibraryUIStore } from '@/features/library/core/store/library-ui.store';
import dynamic from 'next/dynamic';

const CoverModal = dynamic(
  () => import('@/shared/components/ui/cover-modal').then((m) => m.CoverModal),
  { ssr: false }
);

interface AccountDropdownProps {
  className?: string;
  align?: 'start' | 'end';
}

export default function AccountDropdown({ align = 'end' }: AccountDropdownProps = {}) {
  const router = useRouter();
  const { user, isLoading, logout } = useAuth();
  const { cover, setCover } = useUserCover();
  const { uploadFile, isUploading } = useUpload();
  const setPersonalSpace = useWorkspaceContextStore((s) => s.setPersonalSpace);
  const setLibraryScope = useLibraryUIStore((s) => s.setActiveScope);
  const [mounted, setMounted] = useState(false);
  const [isCoverModalOpen, setIsCoverModalOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    return () => {
      if (cover && cover.startsWith('blob:')) {
        URL.revokeObjectURL(cover);
      }
    };
  }, [cover]);

  const handleSelectCover = (coverUrl: string) => {
    setCover(coverUrl);
    toast.success('Background updated');
  };

  const handleUploadCustomCover = async (file: File) => {
    try {
      const url = await uploadFile(file, { prefix: 'user/covers' });
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
        className="relative flex items-center justify-center size-8 rounded-md text-foreground transition-colors hover:bg-muted cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary before:absolute before:-inset-1.5 md:before:hidden"
        aria-label="Sign in"
      >
        <Avatar className="size-7 rounded-full border border-border">
          <AvatarFallback className="text-11 font-medium bg-muted text-muted-foreground">U</AvatarFallback>
        </Avatar>
      </Link>
    );
  }

  const userInitials = (() => {
    const raw = String(user?.name || '').trim();
    if (!raw) return 'U';
    const parts = raw.split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return raw.slice(0, 2).toUpperCase();
  })();

  return (
    <>
      {isCoverModalOpen && (
        <CoverModal
          open={isCoverModalOpen}
          onOpenChange={setIsCoverModalOpen}
          currentCover={cover}
          onSelectCover={handleSelectCover}
          onUploadCustomCover={handleUploadCustomCover}
          isUploading={isUploading}
        />
      )}

      <DropdownMenu>
        <DropdownMenuTrigger className="relative flex items-center justify-center size-8 rounded-md transition-colors hover:bg-background/80 outline-none focus-visible:ring-1 focus-visible:ring-primary data-[state=open]:bg-background cursor-pointer before:absolute before:-inset-1.5 md:before:hidden">
          <Avatar className="size-7 rounded-full shrink-0 border border-border/60">
            {user.avatar ? (
              <AvatarImage
                src={resolveFileUrl(user.avatar) || undefined}
                alt={String(user.name || '')}
                referrerPolicy="no-referrer"
              />
            ) : null}
            <AvatarFallback className="text-11 font-semibold">{userInitials}</AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align={align}
          onCloseAutoFocus={(e) => e.preventDefault()}
          className="w-72 p-0 overflow-hidden bg-popover rounded-md shadow-raised-200 border border-border select-none"
          alignOffset={0}
        >
          {/* Cover Banner Header with Change Background Button */}
          <div className="relative bg-popover overflow-hidden">
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
                onClick={() => setIsCoverModalOpen(true)}
                className="absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/55 hover:bg-black/75 text-white text-11 font-medium transition-colors cursor-pointer opacity-85 hover:opacity-100 backdrop-blur-xs outline-none"
                title="Change background"
              >
                <ImageIcon className="size-3 shrink-0" />
                <span>Cover</span>
              </button>
            </div>

            {/* Hanging Avatar & Name / Email */}
            <div className="flex flex-col items-center justify-center text-center px-4 pb-2.5 -mt-8 relative z-10">
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

          {/* Navigate to Profile & Preferences */}
          <div className="p-1.5 space-y-0.5 border-t border-border">
            <DropdownMenuItem
              onSelect={() => {
                setPersonalSpace();
                setLibraryScope({ type: 'user', id: 'user', name: 'My Library' });
                router.push('/settings');
              }}
              className="cursor-pointer gap-2.5 px-3 py-1.5 text-13 text-foreground hover:bg-muted focus:bg-muted rounded-md transition-colors"
            >
              <User className="size-4 text-muted-foreground shrink-0" />
              <span className="font-medium">Profile</span>
            </DropdownMenuItem>

            <DropdownMenuItem
              onSelect={() => {
                setPersonalSpace();
                setLibraryScope({ type: 'user', id: 'user', name: 'My Library' });
                router.push('/settings/preferences');
              }}
              className="cursor-pointer gap-2.5 px-3 py-1.5 text-13 text-foreground hover:bg-muted focus:bg-muted rounded-md transition-colors"
            >
              <SlidersHorizontal className="size-4 text-muted-foreground shrink-0" />
              <span className="font-medium">Preferences</span>
            </DropdownMenuItem>
          </div>

          {/* Sign Out */}
          <div className="p-1.5 border-t border-border">
            <DropdownMenuItem
              onClick={() => logout()}
              className="cursor-pointer gap-2.5 px-3 py-1.5 text-13 text-destructive hover:text-destructive focus:text-destructive focus:bg-destructive/10 rounded-md transition-colors"
            >
              <LogOut className="size-4 text-destructive shrink-0" />
              <span className="font-medium">Sign out</span>
            </DropdownMenuItem>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
