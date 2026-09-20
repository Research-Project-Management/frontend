/**
 * mention.util.ts
 *
 * Utilities for @mention parsing, tokenization, autocomplete detection,
 * and collaborator filtering in editor comments and review discussions.
 * Follows Overleaf collaboration standards with Unicode & Vietnamese support.
 */

export interface MentionMember {
  id: string;
  name: string;
  email?: string;
  avatar?: string | null;
  role?: string;
}

export interface MentionQueryDetection {
  active: boolean;
  query: string;
  startIndex: number;
  endIndex: number;
}

export interface MentionItem {
  name: string;
  id?: string;
  raw: string;
}

export type MentionToken =
  | { type: 'text'; content: string }
  | { type: 'mention'; content: string; name: string; id?: string };

/**
 * Detects if the cursor is currently right after an `@` trigger.
 * Prevents false positives like email addresses (e.g. user@domain.com).
 */
export function detectMentionQuery(
  text: string,
  cursorIndex: number,
): MentionQueryDetection {
  if (cursorIndex <= 0 || cursorIndex > text.length) {
    return { active: false, query: '', startIndex: -1, endIndex: -1 };
  }

  // Look backwards from cursorIndex
  let atIndex = -1;
  for (let i = cursorIndex - 1; i >= 0; i--) {
    const ch = text[i];
    if (ch === '\n') break; // stop at line boundary
    if (ch === '@') {
      // Ensure '@' is preceded by start of string, whitespace, or open punctuation
      if (i === 0 || /[\s(\[{<"'`:]/.test(text[i - 1])) {
        atIndex = i;
        break;
      }
    }
  }

  if (atIndex === -1) {
    return { active: false, query: '', startIndex: -1, endIndex: -1 };
  }

  const queryCandidate = text.slice(atIndex + 1, cursorIndex);

  // Reject if query contains closing brackets or newline or too many words (> 3 spaces)
  if (/[\])\r\n]/.test(queryCandidate) || (queryCandidate.match(/\s/g)?.length ?? 0) > 3) {
    return { active: false, query: '', startIndex: -1, endIndex: -1 };
  }

  return {
    active: true,
    query: queryCandidate,
    startIndex: atIndex,
    endIndex: cursorIndex,
  };
}

/**
 * Extracts all @mentions from a text string.
 * Supports:
 *   - Rich format: @[Display Name](userId) or @[Display Name]
 *   - Plain format: @DisplayName or @username
 */
export function extractMentions(text: string): MentionItem[] {
  if (!text) return [];

  const mentions: MentionItem[] = [];
  const seen = new Set<string>();

  // 1. Rich tokens: @[Name](id) or @[Name]
  const richRegex = /@\[([^\]]+)\](?:\(([^)]+)\))?/g;
  let match: RegExpExecArray | null;
  while ((match = richRegex.exec(text)) !== null) {
    const name = match[1]?.trim();
    const id = match[2]?.trim();
    const key = id || name;
    if (name && !seen.has(key)) {
      seen.add(key);
      mentions.push({ name, id, raw: match[0] });
    }
  }

  // 2. Plain tokens: @Name (Unicode letters, numbers, _, -, .)
  const plainRegex = /(?:^|[\s(\[{<"'`])@([a-zA-Z0-9_\u00C0-\u024F\u1EA0-\u1EF9.-]+)/g;
  while ((match = plainRegex.exec(text)) !== null) {
    const name = match[1]?.trim();
    if (name && !seen.has(name) && !name.startsWith('[')) {
      seen.add(name);
      mentions.push({ name, raw: `@${name}` });
    }
  }

  return mentions;
}

/**
 * Tokenizes text into plain text chunks and @mention tokens for safe rendering.
 */
export function parseMentionTokens(text: string): MentionToken[] {
  if (!text) return [];

  // Regex matching either rich token @[Name](id) / @[Name] OR plain token @Name
  // We use positive lookbehind or string boundary check
  const tokenRegex = /(@\[([^\]]+)\](?:\(([^)]+)\))?)|(?:(?:^|(?<=[\s(\[{<"'`]))@([a-zA-Z0-9_\u00C0-\u024F\u1EA0-\u1EF9.-]+))/g;
  const tokens: MentionToken[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(text)) !== null) {
    const matchStart = match.index;
    const matchEnd = tokenRegex.lastIndex;

    // Push preceding text if any
    if (matchStart > lastIndex) {
      tokens.push({
        type: 'text',
        content: text.slice(lastIndex, matchStart),
      });
    }

    if (match[1]) {
      // Rich token: @[Name](id) or @[Name]
      const name = match[2] || '';
      const id = match[3];
      tokens.push({
        type: 'mention',
        content: match[1],
        name,
        id,
      });
    } else if (match[4]) {
      // Plain token: @Name
      const name = match[4];
      tokens.push({
        type: 'mention',
        content: `@${name}`,
        name,
      });
    }

    lastIndex = matchEnd;
  }

  if (lastIndex < text.length) {
    tokens.push({
      type: 'text',
      content: text.slice(lastIndex),
    });
  }

  return tokens;
}

/**
 * Format a mention token for insertion into textarea.
 * Rich token @[Name](id) preserves accurate user ID and multi-word names.
 */
export function formatMention(
  member: { name: string; id?: string },
  format: 'rich' | 'plain' = 'rich',
): string {
  if (format === 'rich' && member.id) {
    return `@[${member.name}](${member.id})`;
  }
  return `@${member.name}`;
}

/**
 * Filters a list of members against a search query.
 */
export function filterMentionMembers(
  members: MentionMember[],
  query: string,
): MentionMember[] {
  const clean = query.trim().toLowerCase();
  if (!clean) return members;

  return members.filter((m) => {
    const nameMatch = m.name?.toLowerCase().includes(clean);
    const emailMatch = m.email?.toLowerCase().includes(clean);
    return Boolean(nameMatch || emailMatch);
  });
}
