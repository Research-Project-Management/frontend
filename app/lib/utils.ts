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
  
  let roleName = "member";

  // Handle legacy string role
  if (typeof member.role === "string") {
    roleName = member.role;
  }
  // Handle new role object
  else if (member.role && typeof member.role === "object") {
    roleName = member.role.name || member.legacyRole || "member";
  }
  // Fallback
  else {
    roleName = member.legacyRole || "member";
  }

  // If the role name is a 24-char hex string (ObjectId), it's probably not intended for display
  const isHexId = /^[0-9a-fA-F]{24}$/.test(roleName);
  if (isHexId) return "member";

  return roleName;
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

/**
 * Generate a unique filename by appending a counter suffix when a name conflicts.
 * Example: "report.tex" → "report (1).tex" → "report (2).tex"
 *
 * @param name          Desired filename (e.g. "report.tex")
 * @param existingNames Set of filenames already present in the target location
 */
export function generateUniqueName(name: string, existingNames: Set<string>): string {
  if (!existingNames.has(name)) return name;

  const dot = name.lastIndexOf(".");
  const baseName = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : "";

  let counter = 1;
  let candidate = `${baseName} (${counter})${ext}`;
  while (existingNames.has(candidate)) {
    counter++;
    candidate = `${baseName} (${counter})${ext}`;
  }
  return candidate;
}

// Re-export format utilities for convenience
export { formatFileSize, getInitials, formatRelativeTime, truncateText } from "./format";
