import type { AttachCenterData, ItemAttachment } from '../types/attachment.types';

export const EMPTY_ATTACHMENTS: AttachCenterData = {
  pages: [],
  papers: [],
  files: [],
  links: [],
};

export const normalizeAttachments = (raw: unknown): AttachCenterData => {
  if (!raw) return { pages: [], papers: [], files: [], links: [] };
  if (Array.isArray(raw)) {
    return { pages: [], papers: [], files: raw as ItemAttachment[], links: [] };
  }
  const obj = raw as Partial<AttachCenterData>;
  return {
    pages: Array.isArray(obj.pages) ? obj.pages : [],
    papers: Array.isArray(obj.papers) ? obj.papers : [],
    files: Array.isArray(obj.files) ? obj.files : [],
    links: Array.isArray(obj.links) ? obj.links : [],
  };
};

export const formatMetaDate = (dateStr?: string | null): string | null => {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return dateStr;
  }
};

export const getTimeAgo = (dateStr?: string | null): string => {
  if (!dateStr) return 'recently';
  try {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return 'just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) return `${diffDays} days ago`;
    const diffMonths = Math.floor(diffDays / 30);
    return `${diffMonths} months ago`;
  } catch {
    return 'recently';
  }
};
