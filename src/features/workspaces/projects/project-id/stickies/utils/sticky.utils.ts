import type { Sticky } from '../types/sticky.types';

/**
 * Strips HTML tags and collapses whitespace to plain text
 */
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#160;/g, ' ')
    .replace(/&zwnj;/g, ' ')
    .replace(/&zwj;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Checks if a sticky note is empty (has no title, no text content, and no embedded media)
 */
export function isStickyEmpty(
  sticky?: Pick<Sticky, 'title' | 'content'> | { title?: string | null; content?: string | null } | null
): boolean {
  if (!sticky) return false;

  const hasTitle = Boolean(sticky.title && sticky.title.trim().length > 0);
  if (hasTitle) return false;

  const rawContent = sticky.content || '';
  if (rawContent.includes('<img') || rawContent.includes('<video') || rawContent.includes('<iframe')) {
    return false;
  }

  const textContent = stripHtml(rawContent);
  return textContent.length === 0;
}
