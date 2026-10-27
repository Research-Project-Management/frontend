import { z } from 'zod';

export type FeedReadFilterType = 'all' | 'unread' | 'read';

export const feedRetentionDaysSchema = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(3),
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
  cleanupReadAfter: feedRetentionDaysSchema.optional().default(7),
  cleanupUnreadAfter: feedRetentionDaysSchema.optional().default(30),
});

export type SavedFeedSubscription = z.infer<typeof savedFeedSubscriptionSchema>;

export interface RetentionOption {
  value: FeedRetentionDays;
  label: string;
}

export const READ_RETENTION_OPTIONS: RetentionOption[] = [
  { value: 7, label: 'After 7 days' },
  { value: 1, label: 'After 1 day' },
  { value: 3, label: 'After 3 days' },
  { value: 14, label: 'After 14 days' },
  { value: 30, label: 'After 30 days' },
  { value: 0, label: 'Never' },
];

export const UNREAD_RETENTION_OPTIONS: RetentionOption[] = [
  { value: 30, label: '30 days' },
  { value: 7, label: '7 days' },
  { value: 14, label: '14 days' },
  { value: 90, label: '90 days' },
  { value: 0, label: 'Never' },
];

export const RETENTION_OPTIONS: RetentionOption[] = UNREAD_RETENTION_OPTIONS;

export const DEFAULT_ACADEMIC_FEEDS: SavedFeedSubscription[] = [
  {
    id: 'arxiv-cs-ai',
    name: 'arXiv: Artificial Intelligence (cs.AI)',
    url: 'https://rss.arxiv.org/rss/cs.AI',
    retentionDays: 30,
    cleanupReadAfter: 7,
    cleanupUnreadAfter: 30,
  },
  {
    id: 'arxiv-cs-cl',
    name: 'arXiv: Computation and Language (cs.CL)',
    url: 'https://rss.arxiv.org/rss/cs.CL',
    retentionDays: 30,
    cleanupReadAfter: 7,
    cleanupUnreadAfter: 30,
  },
  {
    id: 'nature-main',
    name: 'Nature — Current Issue Research',
    url: 'https://www.nature.com/nature.rss',
    retentionDays: 30,
    cleanupReadAfter: 7,
    cleanupUnreadAfter: 30,
  },
];
