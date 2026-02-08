import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  
  return twMerge(clsx(inputs))
}

/**
 * Get role name from member role object or legacy string
 * Handles backward compatibility with both new role objects and legacy string roles
 */
export function getRoleName(member: any): string {
  if (!member) return "member";
  
  // Handle legacy string role
  if (typeof member.role === "string") {
    return member.role;
  }
  
  // Handle new role object
  if (member.role && typeof member.role === "object") {
    return member.role.name || member.legacyRole || "member";
  }
  
  // Fallback to legacyRole or default
  return member.legacyRole || "member";
}

/**
 * Get role color from member role object
 * Returns undefined if no color is set
 */
export function getRoleColor(member: any): string | undefined {
  if (!member || typeof member.role !== "object") {
    return undefined;
  }
  
  return member.role?.color;
}

// Re-export format utilities for convenience
export { formatFileSize, getInitials, formatRelativeTime, truncateText } from "./format";
