export interface SavedFeedSubscription {
  id: string;
  name: string;
  url: string;
  lastRefreshed?: string;
  retentionDays?: number; // 0 = never, 7, 14, 30, 90
}

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
