import {
  Inbox,
  Files,
  Award,
  ShieldAlert,
  Trash2,
  Star,
  type LucideIcon,
} from 'lucide-react';

export interface SystemNavStats {
  retractedCount?: number;
  unfiledCount?: number;
  duplicateCount?: number;
  starredCount?: number;
}

export interface SystemNavItemConfig {
  id: string;
  label: string;
  href: (basePath: string) => string;
  icon: LucideIcon;
  isActive: (pathname: string, currentFilter: string | null, isUserScope: boolean, basePath: string) => boolean;
  getBadge?: (stats: SystemNavStats) => number | null;
}

/**
 * Registry of system smart filters displayed below the collections tree.
 * To add a new filter (e.g., Starred, Unread, AI Summaries), simply add an entry here.
 */
export const SYSTEM_BOTTOM_NAV_ITEMS: SystemNavItemConfig[] = [
  {
    id: 'starred',
    label: 'Starred Items',
    href: (basePath) => `${basePath}/starred`,
    icon: Star,
    isActive: (pathname, currentFilter, isUserScope, basePath) =>
      isUserScope &&
      (pathname === `${basePath}/starred` || (pathname === basePath && currentFilter === 'starred')),
    getBadge: (stats) => stats.starredCount || null,
  },
  {
    id: 'unfiled',
    label: 'Unfiled Items',
    href: (basePath) => `${basePath}/unfiled`,
    icon: Inbox,
    isActive: (pathname, currentFilter, isUserScope, basePath) =>
      isUserScope &&
      (pathname === `${basePath}/unfiled` || (pathname === basePath && currentFilter === 'unfiled')),
    getBadge: (stats) => stats.unfiledCount || null,
  },
  {
    id: 'duplicates',
    label: 'Duplicate Items',
    href: (basePath) => `${basePath}/duplicates`,
    icon: Files,
    isActive: (pathname, currentFilter, _isUserScope, basePath) =>
      pathname === `${basePath}/duplicates` || (pathname === basePath && currentFilter === 'duplicates'),
    getBadge: (stats) => stats.duplicateCount || null,
  },
  {
    id: 'my-publications',
    label: 'My Publications',
    href: (basePath) => `${basePath}/my-publications`,
    icon: Award,
    isActive: (pathname, currentFilter, isUserScope, basePath) =>
      isUserScope &&
      (pathname === `${basePath}/my-publications` ||
        (pathname === basePath &&
          (currentFilter === 'my-publications' || currentFilter === 'publications'))),
  },
  {
    id: 'retracted',
    label: 'Retracted Items',
    href: (basePath) => `${basePath}/retracted`,
    icon: ShieldAlert,
    isActive: (pathname, currentFilter, isUserScope, basePath) =>
      isUserScope &&
      (pathname === `${basePath}/retracted` || (pathname === basePath && currentFilter === 'retracted')),
    getBadge: (stats) => stats.retractedCount || null,
  },
  {
    id: 'trash',
    label: 'Trash',
    href: (basePath) => `${basePath}/trash`,
    icon: Trash2,
    isActive: (pathname, currentFilter, isUserScope, basePath) =>
      isUserScope &&
      (pathname === `${basePath}/trash` || (pathname === basePath && currentFilter === 'trash')),
  },
];
