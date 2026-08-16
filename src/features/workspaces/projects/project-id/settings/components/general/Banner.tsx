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
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui';
import { IconPicker } from './IconPicker';
import { CoverModal } from './CoverModal';

const ICON_MAP: Record<string, LucideIcon> = {
  search: Search,
  home: Home,
  settings: Settings,
  check: Check,
  'check-circle': CheckCircle,
  heart: Heart,
  plus: Plus,
  trash: Trash2,
  'arrow-left': ArrowLeft,
  star: Star,
  'log-out': LogOut,
  'plus-circle': PlusCircle,
  'x-circle': XCircle,
  'chevron-down': ChevronDown,
  'more-vertical': MoreVertical,
  'check-square': CheckSquare,
  'external-link': ExternalLink,
  refresh: RefreshCw,
  'arrow-right': ArrowRight,
  circle: Circle,
  'more-horizontal': MoreHorizontal,
  grid: LayoutGrid,
  target: Target,
  download: Download,
  minus: Minus,
  zap: Zap,
  'arrow-up': ArrowUp,
  'align-left': AlignLeft,
  key: Key,
  folder: Folder,
  'file-text': FileText,
  bookmark: Bookmark,
  calendar: Calendar,
  clock: Clock,
  compass: Compass,
  cpu: Cpu,
  database: Database,
  flame: Flame,
  globe: Globe,
  hash: Hash,
  layers: Layers,
  link: LinkIcon,
  lock: Lock,
  mail: Mail,
  'map-pin': MapPin,
  message: MessageSquare,
  moon: Moon,
  package: Package,
  paperclip: Paperclip,
  radio: Radio,
  send: Send,
  share: Share2,
  shield: Shield,
  sun: Sun,
  tag: Tag,
  terminal: Terminal,
  user: User,
  users: Users,
};

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

function renderAvatarContent(avatar: string | null, name: string) {
  if (!avatar) {
    return (
      <AvatarFallback className="rounded-lg text-xl bg-muted/90 text-foreground font-semibold">
        {name ? name.charAt(0).toUpperCase() : 'P'}
      </AvatarFallback>
    );
  }

  // Check if it's a vector icon: "icon:name:color"
  if (avatar.startsWith('icon:')) {
    const [, iconName, color] = avatar.split(':');
    const IconComp = ICON_MAP[iconName] || Settings;
    return (
      <div className="size-full flex items-center justify-center bg-card rounded-lg">
        <IconComp className="size-7" style={{ color: color || '#6366f1' }} />
      </div>
    );
  }

  // Check if it's a web URL image
  if (avatar.startsWith('http') || avatar.startsWith('/') || avatar.startsWith('data:')) {
    return <AvatarImage src={avatar} className="object-cover" />;
  }

  // Otherwise it's an emoji string (e.g. "👌", "🚀")
  return (
    <div className="size-full flex items-center justify-center bg-card rounded-lg text-2xl select-none">
      {avatar}
    </div>
  );
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
    <div className="relative w-full rounded-lg border border-border/80 overflow-hidden bg-neutral-200 dark:bg-neutral-800 h-44 sm:h-52 flex flex-col justify-end p-5 shadow-xs">
      {/* Background Cover Image or Default Gradient */}
      {cover ? (
        <img
          src={cover}
          alt="Project Cover"
          className="absolute inset-0 size-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-r from-neutral-300 via-neutral-200 to-neutral-300 dark:from-neutral-900 dark:via-neutral-800 dark:to-neutral-900" />
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
              className="cursor-pointer group relative block shrink-0 outline-none"
              title="Change emoji or icon"
            >
              <Avatar className="size-14 rounded-lg border-2 border-white/80 dark:border-white/20 bg-background shadow-md">
                {renderAvatarContent(avatar, name)}
              </Avatar>
              <div className="absolute inset-0 rounded-lg bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[10px] text-white font-medium">
                Edit
              </div>
            </button>
          </IconPicker>

          <div className="min-w-0 text-white drop-shadow-sm">
            <h2 className="text-base font-bold truncate leading-tight tracking-tight">
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
            className="h-8 px-3 rounded-lg border border-white/40 bg-white/90 hover:bg-white text-neutral-900 dark:bg-black/70 dark:hover:bg-black/90 dark:text-white dark:border-white/20 text-xs font-medium flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer outline-none shrink-0"
          >
            <span>Change cover</span>
          </button>
        </CoverModal>
      </div>
    </div>
  );
}
