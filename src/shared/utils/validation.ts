/**
 * shared/utils/validation.ts
 * Pure validation utilities — return boolean, no side effects.
 */

// ─── Email ────────────────────────────────────────────────────────────────────

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const isValidEmail = (value: string): boolean =>
  EMAIL_REGEX.test(value.trim());

// ─── URL ──────────────────────────────────────────────────────────────────────

export const isValidUrl = (value: string): boolean => {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
};

// ─── Password ─────────────────────────────────────────────────────────────────

export type PasswordStrength = 'weak' | 'fair' | 'strong' | 'very-strong';

/**
 * Check if a password meets minimum requirements.
 * Min 8 chars, at least 1 uppercase, 1 lowercase, 1 number.
 */
export const isStrongPassword = (value: string): boolean =>
  value.length >= 8 &&
  /[A-Z]/.test(value) &&
  /[a-z]/.test(value) &&
  /\d/.test(value);

/**
 * Get password strength score (0–4).
 */
export const getPasswordStrength = (value: string): PasswordStrength => {
  let score = 0;
  if (value.length >= 8) score++;
  if (value.length >= 12) score++;
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score++;
  if (/\d/.test(value) && /[^A-Za-z0-9]/.test(value)) score++;

  if (score <= 1) return 'weak';
  if (score === 2) return 'fair';
  if (score === 3) return 'strong';
  return 'very-strong';
};

// ─── String ───────────────────────────────────────────────────────────────────

export const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

export const isValidObjectId = (value: string): boolean =>
  /^[a-f\d]{24}$/i.test(value);
