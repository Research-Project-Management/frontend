'use client';

import React, { useState, useMemo } from 'react';
import {
  Search,
  Info,
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  Input,
} from '@/shared/components/ui';
import { cn } from '@/shared/lib/utils';

interface IconPickerProps {
  currentValue: string | null;
  onSelect: (value: string) => void;
  children: React.ReactNode;
}

const PALETTE = [
  { id: 'gray', hex: '#6b7280' },
  { id: 'slate', hex: '#475569' },
  { id: 'indigo', hex: '#6366f1' },
  { id: 'sky', hex: '#0ea5e9' },
  { id: 'green', hex: '#10b981' },
  { id: 'yellow', hex: '#eab308' },
  { id: 'orange', hex: '#f97316' },
  { id: 'rose', hex: '#f43f5e' },
];

const ICONS: { name: string; icon: LucideIcon }[] = [
  { name: 'search', icon: Search },
  { name: 'home', icon: Home },
  { name: 'settings', icon: Settings },
  { name: 'check', icon: Check },
  { name: 'check-circle', icon: CheckCircle },
  { name: 'heart', icon: Heart },
  { name: 'plus', icon: Plus },
  { name: 'trash', icon: Trash2 },
  { name: 'arrow-left', icon: ArrowLeft },
  { name: 'star', icon: Star },
  { name: 'log-out', icon: LogOut },
  { name: 'plus-circle', icon: PlusCircle },
  { name: 'x-circle', icon: XCircle },
  { name: 'chevron-down', icon: ChevronDown },
  { name: 'more-vertical', icon: MoreVertical },
  { name: 'check-square', icon: CheckSquare },
  { name: 'external-link', icon: ExternalLink },
  { name: 'refresh', icon: RefreshCw },
  { name: 'arrow-right', icon: ArrowRight },
  { name: 'circle', icon: Circle },
  { name: 'more-horizontal', icon: MoreHorizontal },
  { name: 'grid', icon: LayoutGrid },
  { name: 'target', icon: Target },
  { name: 'download', icon: Download },
  { name: 'minus', icon: Minus },
  { name: 'zap', icon: Zap },
  { name: 'arrow-up', icon: ArrowUp },
  { name: 'align-left', icon: AlignLeft },
  { name: 'key', icon: Key },
  { name: 'folder', icon: Folder },
  { name: 'file-text', icon: FileText },
  { name: 'bookmark', icon: Bookmark },
  { name: 'calendar', icon: Calendar },
  { name: 'clock', icon: Clock },
  { name: 'compass', icon: Compass },
  { name: 'cpu', icon: Cpu },
  { name: 'database', icon: Database },
  { name: 'flame', icon: Flame },
  { name: 'globe', icon: Globe },
  { name: 'hash', icon: Hash },
  { name: 'layers', icon: Layers },
  { name: 'link', icon: LinkIcon },
  { name: 'lock', icon: Lock },
  { name: 'mail', icon: Mail },
  { name: 'map-pin', icon: MapPin },
  { name: 'message', icon: MessageSquare },
  { name: 'moon', icon: Moon },
  { name: 'package', icon: Package },
  { name: 'paperclip', icon: Paperclip },
  { name: 'radio', icon: Radio },
  { name: 'send', icon: Send },
  { name: 'share', icon: Share2 },
  { name: 'shield', icon: Shield },
  { name: 'sun', icon: Sun },
  { name: 'tag', icon: Tag },
  { name: 'terminal', icon: Terminal },
  { name: 'user', icon: User },
  { name: 'users', icon: Users },
];

const EMOJIS = [
  '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂',
  '🙃', '🫠', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘',
  '😗', '😚', '😙', '😋', '😛', '😜', '🤪', '😝', '🤑',
  '🤗', '🫣', '🤫', '🤔', '🫡', '🤐', '🤨', '😐', '😑',
  '😶', '🫥', '😏', '😒', '🙄', '😬', '😮‍💨', '🤥', '😌',
  '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮',
  '🤧', '🥵', '🥶', '🥴', '😵', '😵‍💫', '🤯', '🤠', '🥳',
  '🥸', '😎', '🤓', '🧐', '😕', '🫤', '😟', '🙁', '😮',
  '😯', '😲', '😳', '🥺', '🥹', '😦', '😧', '😨', '😰',
  '😥', '😢', '😭', '😱', '😖', '😣', '😞', '😓', '😩',
  '😫', '🥱', '😤', '😡', '😠', '🤬', '😈', '👿', '💀',
  '☠️', '💩', '🤡', '👹', '👺', '👻', '👽', '👾', '🤖',
  '👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️',
  '🤞', '🫰', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕',
  '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏',
  '🙌', '🫶', '👐', '🤲', '🤝', '🙏', '✍️', '💅', '🤳',
  '💪', '🦾', '🦿', '🦵', '🦶', '👂', '🦻', '👃', '🧠',
  '🫀', '🫁', '🦷', '🦴', '👀', '👁️', '👅', '👄', '🫦',
  '🚀', '⭐', '🔥', '💡', '📚', '🔬', '🧪', '🧬', '💻',
  '📊', '📈', '📝', '🎯', '🏆', '💎', '🎨', '🧩', '⚡',
];

export function IconPicker({ currentValue, onSelect, children }: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'emoji' | 'icon'>('emoji');
  const [search, setSearch] = useState('');
  const [selectedColor, setSelectedColor] = useState('#6366f1');

  const filteredEmojis = useMemo(() => {
    if (!search.trim()) return EMOJIS;
    return EMOJIS;
  }, [search]);

  const filteredIcons = useMemo(() => {
    if (!search.trim()) return ICONS;
    const q = search.toLowerCase().trim();
    return ICONS.filter((i) => i.name.includes(q));
  }, [search]);

  const handleEmojiClick = (emoji: string) => {
    onSelect(emoji);
    setOpen(false);
  };

  const handleIconClick = (iconName: string) => {
    onSelect(`icon:${iconName}:${selectedColor}`);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>

      <PopoverContent
        align="start"
        className="w-72 p-3 rounded-lg border border-border/80 bg-background shadow-xl select-none"
      >
        {/* ── Top Tabs Segment Control ── */}
        <div className="grid grid-cols-2 p-0.5 rounded-lg bg-muted/60 border border-border/60">
          <button
            type="button"
            onClick={() => setTab('emoji')}
            className={cn(
              'h-7 text-xs font-medium rounded-md transition-all cursor-pointer',
              tab === 'emoji'
                ? 'bg-background text-foreground shadow-2xs font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Emoji
          </button>
          <button
            type="button"
            onClick={() => setTab('icon')}
            className={cn(
              'h-7 text-xs font-medium rounded-md transition-all cursor-pointer',
              tab === 'icon'
                ? 'bg-background text-foreground shadow-2xs font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Icon
          </button>
        </div>

        {/* ── Search Input ── */}
        <div className="relative mt-2.5">
          <Input
            placeholder="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8.5 text-xs rounded-lg border-border/80 pl-3 pr-8 focus:ring-0 focus:outline-none"
          />
          {tab === 'emoji' && (
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-sm pointer-events-none">
              {currentValue && !currentValue.startsWith('http') && !currentValue.startsWith('icon:')
                ? currentValue
                : '👋'}
            </span>
          )}
        </div>

        {/* ── Tab Content: Emoji ── */}
        {tab === 'emoji' && (
          <div className="mt-2.5">
            <div className="text-[11px] font-medium text-muted-foreground pb-1.5 px-0.5">
              Smileys & emotion
            </div>
            <div className="max-h-56 overflow-y-auto grid grid-cols-9 gap-1 p-0.5">
              {filteredEmojis.map((em, idx) => (
                <button
                  key={`${em}-${idx}`}
                  type="button"
                  onClick={() => handleEmojiClick(em)}
                  className="size-7 flex items-center justify-center rounded-md text-base hover:bg-muted/70 active:scale-95 transition-all cursor-pointer"
                >
                  {em}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Tab Content: Icon ── */}
        {tab === 'icon' && (
          <div className="mt-2.5 space-y-2.5">
            {/* Color Swatches */}
            <div className="flex items-center justify-between px-0.5 pt-0.5">
              {PALETTE.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedColor(c.hex)}
                  className={cn(
                    'size-5 rounded-full transition-transform cursor-pointer relative',
                    selectedColor === c.hex && 'scale-115 ring-2 ring-foreground/40 ring-offset-1'
                  )}
                  style={{ backgroundColor: c.hex }}
                  aria-label={c.id}
                />
              ))}
            </div>

            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground px-0.5">
              <Info className="size-3 shrink-0" />
              <span>Colors will be adjusted to ensure sufficient contrast.</span>
            </div>

            {/* Icon Grid */}
            <div className="max-h-48 overflow-y-auto grid grid-cols-8 gap-1 p-0.5 border-t border-border/60 pt-2">
              {filteredIcons.map(({ name, icon: IconComponent }) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => handleIconClick(name)}
                  className="size-7 flex items-center justify-center rounded-md hover:bg-muted/70 active:scale-95 transition-all cursor-pointer"
                  title={name}
                >
                  <IconComponent
                    className="size-4"
                    style={{ color: selectedColor }}
                  />
                </button>
              ))}
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
