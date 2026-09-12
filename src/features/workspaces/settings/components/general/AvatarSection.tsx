'use client';

import React from 'react';
import { Camera, Loader2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/components/ui";
import { resolveFileUrl } from "@/shared/lib/file-client";

interface AvatarSectionProps {
  name: string;
  slug: string;
  currentAvatar?: string | null;
  isUploadingAvatar: boolean;
  fileRef: React.RefObject<HTMLInputElement | null>;
  onAvatarUpload: (file: File) => void;
}

export function AvatarSection({
  name,
  slug,
  currentAvatar,
  isUploadingAvatar,
  fileRef,
  onAvatarUpload,
}: AvatarSectionProps) {
  const initial = (name || 'W').charAt(0).toUpperCase();

  return (
    <div className="flex items-center gap-4 sm:gap-5">
      {/* ── Logo Box with rounded-lg ── */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => fileRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            fileRef.current?.click();
          }
        }}
        className="relative group size-16 shrink-0 rounded-lg flex items-center justify-center overflow-hidden transition-opacity hover:opacity-95 cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Avatar className="size-full rounded-lg">
          {currentAvatar && (
            <AvatarImage
              src={resolveFileUrl(currentAvatar) || undefined}
              alt={name}
              className="size-full object-cover rounded-lg"
              referrerPolicy="no-referrer"
            />
          )}
          <AvatarFallback className="size-full rounded-lg bg-primary text-primary-foreground font-medium text-2xl">
            {initial}
          </AvatarFallback>
        </Avatar>

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-lg">
          {isUploadingAvatar ? (
            <Loader2 className="size-5 text-white animate-spin shrink-0" />
          ) : (
            <Camera className="size-5 text-white shrink-0" />
          )}
        </div>
      </div>

      {/* ── Text Details ── */}
      <div className="flex flex-col gap-0.5 min-w-0">
        <h2 className="text-base sm:text-lg font-semibold tracking-tight text-foreground truncate">
          {name || 'my-workspace'}
        </h2>
        <p className="text-xs sm:text-sm text-muted-foreground truncate">{slug}</p>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={isUploadingAvatar}
          className="text-xs sm:text-sm text-primary font-medium hover:underline text-left cursor-pointer transition-colors w-fit pt-0.5 disabled:opacity-50"
        >
          Upload logo
        </button>
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onAvatarUpload(file);
        }}
      />
    </div>
  );
}

export default AvatarSection;
