'use client';

import React from 'react';
import { Camera, Loader2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui';

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
    <div className="flex items-center gap-5">
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={isUploadingAvatar}
        className="relative group size-16 shrink-0 rounded-lg flex items-center justify-center text-2xl font-semibold overflow-hidden transition-opacity hover:opacity-90 cursor-pointer"
      >
        <div className="size-full">
          <Avatar className="size-full">
            {currentAvatar && <AvatarImage src={currentAvatar} className="object-cover" />}
            <AvatarFallback className="bg-primary/10 text-primary font-semibold text-lg uppercase">
              {initial}
            </AvatarFallback>
          </Avatar>
        </div>
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          {isUploadingAvatar ? (
            <Loader2 className="size-5 text-white animate-spin" />
          ) : (
            <Camera className="size-5 text-white" />
          )}
        </div>
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
      </button>

      <div className="flex flex-col gap-0.5 min-w-0">
        <h2 className="text-base font-semibold text-foreground truncate">
          {name || 'Untitled Workspace'}
        </h2>
        <p className="text-sm text-muted-foreground truncate">{slug}</p>
      </div>
    </div>
  );
}

export default AvatarSection;
