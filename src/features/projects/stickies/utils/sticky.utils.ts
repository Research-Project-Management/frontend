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

let lastTime = 0;
let seq = 0;

/**
 * Generates an RFC 9562 compliant UUID v7 string.
 * Time-ordered 128-bit identifier with 48-bit millisecond precision and monotonic sequence.
 */
export function uuidv7(): string {
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }

  const now = Date.now();
  if (now > lastTime) {
    lastTime = now;
    seq = ((bytes[6] & 0x0f) << 8) | bytes[7];
  } else {
    seq = (seq + 1) & 0x0fff;
  }

  // 48-bit timestamp (milliseconds since Unix epoch)
  bytes[0] = (now / 0x10000000000) & 0xff;
  bytes[1] = (now / 0x100000000) & 0xff;
  bytes[2] = (now / 0x1000000) & 0xff;
  bytes[3] = (now / 0x10000) & 0xff;
  bytes[4] = (now / 0x100) & 0xff;
  bytes[5] = now & 0xff;

  // Version 7: 0b0111 (0x70) in upper 4 bits, top 4 bits of seq in lower 4 bits
  bytes[6] = 0x70 | ((seq >> 8) & 0x0f);
  bytes[7] = seq & 0xff;

  // Variant 1: 0b10 (0x80) in upper 2 bits (RFC 4122/9562)
  bytes[8] = 0x80 | (bytes[8] & 0x3f);

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Checks whether a given string is a valid UUID v7 format.
 */
export function isUuidV7(id?: string | null): boolean {
  if (!id || typeof id !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}
