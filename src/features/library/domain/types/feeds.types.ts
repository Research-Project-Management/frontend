import { z } from 'zod';

export type FeedReadFilterType = 'all' | 'unread' | 'read';

export const feedRetentionDaysSchema = z.union([
  z.literal(0),
  z.literal(7),
  z.literal(14),
  z.literal(30),
  z.literal(90),
]);

export type FeedRetentionDays = z.infer<typeof feedRetentionDaysSchema>;

export const savedFeedSubscriptionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  url: z.string().url(),
  lastRefreshed: z.string().optional(),
  retentionDays: feedRetentionDaysSchema.optional().default(30),
});

export type SavedFeedSubscription = z.infer<typeof savedFeedSubscriptionSchema>;

export interface RetentionOption {
  value: FeedRetentionDays;
  label: string;
}

export const RETENTION_OPTIONS: RetentionOption[] = [
  { value: 7, label: 'Keep items from last 7 days' },
  { value: 14, label: 'Keep items from last 14 days' },
  { value: 30, label: 'Keep items from last 30 days (Recommended)' },
  { value: 90, label: 'Keep items from last 90 days' },
  { value: 0, label: 'Never delete (Keep all)' },
];

export const DEFAULT_ACADEMIC_FEEDS: SavedFeedSubscription[] = [
  {
    id: 'arxiv-cs-ai',
    name: 'arXiv: Artificial Intelligence (cs.AI)',
    url: 'https://rss.arxiv.org/rss/cs.AI',
    retentionDays: 30,
  },
  {
    id: 'arxiv-cs-cl',
    name: 'arXiv: Computation and Language (cs.CL)',
    url: 'https://rss.arxiv.org/rss/cs.CL',
    retentionDays: 30,
  },
  {
    id: 'nature-main',
    name: 'Nature — Current Issue Research',
    url: 'https://www.nature.com/nature.rss',
    retentionDays: 30,
  },
];

export const FEEDS_STORAGE_KEY = 'flux_library_rss_feeds_v1';
export const FEEDS_READ_STATE_KEY = 'flux_library_rss_read_entries_v1';
