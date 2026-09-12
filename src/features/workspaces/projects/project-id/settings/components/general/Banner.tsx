'use client';

import React from 'react';
import {
  Search,
  Home,
  Settings,
  Check,
  CheckCircle,
  Heart,
  Plus,
  Trash2,
  ArrowLeft,
  Star,
  LogOut,
  PlusCircle,
  XCircle,
  ChevronDown,
  MoreVertical,
  CheckSquare,
  ExternalLink,
  RefreshCw,
  ArrowRight,
  Circle,
  MoreHorizontal,
  LayoutGrid,
  Target,
  Download,
  Minus,
  Zap,
  ArrowUp,
  AlignLeft,
  Key,
  Folder,
  FileText,
  Bookmark,
  Calendar,
  Clock,
  Compass,
  Cpu,
  Database,
  Flame,
  Globe,
  Hash,
  Layers,
  Link as LinkIcon,
  Lock,
  Mail,
  MapPin,
  MessageSquare,
  Moon,
  Package,
  Paperclip,
  Radio,
  Send,
  Share2,
  Shield,
  Sun,
  Tag,
  Terminal,
  User,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { Avatar } from "@/shared/components/ui";
import { IconPicker, ProjectAvatar } from "@/shared/components/ui";
import { CoverModal } from './CoverModal';

interface GeneralBannerProps {
  name: string;
  identifier: string;
  isPrivate: boolean;
  avatar: string | null;
  cover?: string | null;
  isUploading: boolean;
  onSelectAvatar: (value: string) => void;
  onSelectCover: (coverUrl: string) => void;
  onUploadCustomCover: (file: File) => Promise<void>;
}

export function GeneralBanner({
  name,
  identifier,
  isPrivate,
  avatar,
  cover,
  isUploading,
  onSelectAvatar,
  onSelectCover,
  onUploadCustomCover,
}: GeneralBannerProps) {
  const displayId = identifier.trim() || (name ? name.slice(0, 3).toUpperCase() : 'PRJ');
  const networkLabel = isPrivate ? 'Private' : 'Public';

  return (
    <div className="relative w-full rounded-md border border-border overflow-hidden bg-muted h-44 sm:h-52 flex flex-col justify-end p-5 ">
      {/* Background Cover Image or Default Gradient */}
      {cover ? (
        <img
          src={cover}
          alt="Project Cover"
          className="absolute inset-0 size-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-r from-muted via-muted/80 to-muted" />
      )}

      {/* Subtle overlay for text contrast */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent pointer-events-none" />

      {/* Content over Banner */}
      <div className="relative z-10 flex items-end justify-between gap-4 flex-wrap sm:flex-nowrap">
        {/* Left: Avatar / Emoji / Icon Picker Trigger & Project Info */}
        <div className="flex items-center gap-3.5 min-w-0">
          <IconPicker currentValue={avatar} onSelect={onSelectAvatar}>
            <button
              type="button"
              className="cursor-pointer group relative block shrink-0 outline-none focus-visible:ring-1 focus-visible:ring-primary"
              title="Change emoji or icon"
            >
              <div className="size-14 rounded-lg border-2 border-border bg-background flex items-center justify-center overflow-hidden">
                <ProjectAvatar avatar={avatar} name={name} size="2xl" />
              </div>
              <div className="absolute inset-0 rounded-lg bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-xs text-white font-medium">
                Edit
              </div>
            </button>
          </IconPicker>

          <div className="min-w-0 text-white ">
            <h2 className="text-base font-semibold truncate leading-tight tracking-tight">
              {name || 'Untitled project'}
            </h2>
            <p className="text-xs text-white/85 font-medium mt-0.5 tracking-wide">
              {displayId} &nbsp;.&nbsp; {networkLabel}
            </p>
          </div>
        </div>

        {/* Right: Change Cover Modal Button */}
        <CoverModal
          currentCover={cover}
          onSelectCover={onSelectCover}
          onUploadCustomCover={onUploadCustomCover}
          isUploading={isUploading}
        >
          <button
            type="button"
            className="h-8 px-3 rounded-md border border-border bg-background/90 hover:bg-background text-foreground text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary shrink-0"
          >
            <span>Change cover</span>
          </button>
        </CoverModal>
      </div>
    </div>
  );
}
