/**
 * topbar.util.ts — Topbar formatting & project export utilities
 */

/** Formats document and project title for topbar / browser tab */
export function formatEditorTitle(pageTitle?: string, projectTitle?: string): string {
  if (!pageTitle && !projectTitle) return "Editor";
  if (pageTitle && projectTitle && pageTitle !== projectTitle) {
    return `${pageTitle} - ${projectTitle}`;
  }
  return pageTitle || projectTitle || "Editor";
}

/** Generates clean download filename */
export function getExportFilename(title: string, extension: "pdf" | "zip" | "tex"): string {
  const clean = (title || "document").replace(/[^a-zA-Z0-9_-]/g, "_");
  return `${clean}.${extension}`;
}
