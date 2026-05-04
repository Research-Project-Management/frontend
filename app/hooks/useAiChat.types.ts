/**
 * useAiChat.types.ts — Shared types for useAiChat
 * (Kept separate to avoid circular import issues)
 */

export interface SlashCommand {
  cmd: string;
  label: string;
  description: string;
  hint: string;
  needsSelection: boolean;
}
