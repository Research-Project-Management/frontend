/**
 * download.ts
 *
 * Browser file download trigger and filename sanitization helpers.
 */

export function triggerFileDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function sanitizeArchiveName(title: string | undefined, fallback: string): string {
  const cleaned = (title || '')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '_');
  return cleaned || fallback;
}

export function sanitizeDocExportSlug(title: string | undefined, fallback = 'document'): string {
  const cleaned = (title || fallback)
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  return cleaned || fallback;
}
