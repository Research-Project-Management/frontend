'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  BookOpen,
  CheckSquare,
  FlaskConical,
  FolderKanban,
  HardDrive,
  Home,
  MessageSquare,
  Monitor,
  Moon,
  Settings,
  Sparkles,
  Sun,
} from 'lucide-react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/shared/components/ui/command';
import { useTheme, type Theme } from '@/shared/providers/theme-provider';

const NAVIGATION_ITEMS = [
  { label: 'Home', href: '/home', icon: Home, keywords: ['dashboard', 'overview'] },
  { label: 'Projects', href: '/projects', icon: FolderKanban, keywords: ['workspace', 'manuscripts'] },
  { label: 'Library', href: '/library', icon: BookOpen, keywords: ['papers', 'citations', 'pdf'] },
  { label: 'Storage', href: '/storage', icon: HardDrive, keywords: ['files', 'drive'] },
  { label: 'AI Assistant', href: '/ai', icon: Sparkles, keywords: ['copilot', 'chat'] },
  { label: 'Chat', href: '/chat', icon: MessageSquare, keywords: ['messages', 'team'] },
  { label: 'Experiments', href: '/experiments', icon: FlaskConical, keywords: ['runs', 'metrics'] },
  { label: 'Your Work', href: '/your-work', icon: CheckSquare, keywords: ['tasks', 'assigned'] },
  { label: 'Settings', href: '/settings', icon: Settings, keywords: ['preferences', 'account'] },
] as const;

const THEME_ITEMS: Array<{ label: string; value: Theme; icon: typeof Sun }> = [
  { label: 'Switch to Light theme', value: 'light', icon: Sun },
  { label: 'Switch to Dark theme', value: 'dark', icon: Moon },
  { label: 'Switch to System theme', value: 'system', icon: Monitor },
];

/**
 * Global Command Palette (Ctrl/Cmd + K) for app-wide navigation and appearance actions.
 * Unmounts CommandDialog completely when closed.
 */
export function GlobalCommandPalette() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!open) return null;

  const navigateTo = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  const applyTheme = (nextTheme: Theme) => {
    setTheme(nextTheme);
    setOpen(false);
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Global Command Palette"
      description="Navigate anywhere or change appearance settings"
    >
      <CommandInput placeholder="Search pages or commands..." />
      <CommandList>
        <CommandEmpty>No matching commands found.</CommandEmpty>
        <CommandGroup heading="Navigation">
          {NAVIGATION_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <CommandItem
                key={item.href}
                value={`${item.label} ${item.keywords.join(' ')}`}
                onSelect={() => navigateTo(item.href)}
              >
                <Icon className="size-4" />
                <span>{item.label}</span>
              </CommandItem>
            );
          })}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Appearance">
          {THEME_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <CommandItem
                key={item.value}
                value={item.label}
                onSelect={() => applyTheme(item.value)}
              >
                <Icon className="size-4" />
                <span>{item.label}</span>
                {theme === item.value && (
                  <span className="ml-auto text-xs text-muted-foreground">Active</span>
                )}
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

export default GlobalCommandPalette;
