import { toast } from 'sonner';
import { copyToClipboard } from '@/shared/lib/utils';

export { copyToClipboard };

/**
 * Shared Browser IO & Clipboard Utilities for Library Coordinators and Reader.
 *
 * Centralizes clipboard copying with toast feedback, Blob downloads, text file
 * downloads, and external/internal URL download triggers so coordinators do not
 * duplicate raw DOM `<textarea>`, `<a>`, or `URL.createObjectURL` boilerplate.
 */

export async function copyWithToastHelper(
  text: string,
  label: string = 'Copied to clipboard',
  toastId: string = 'library-clipboard',
): Promise<boolean> {
  if (!text || !text.trim()) {
    toast.error('Nothing to copy', { id: toastId });
    return false;
  }
  const ok = await copyToClipboard(text);
  if (ok) {
    toast.success(label, { id: toastId });
    return true;
  }
  toast.error('Failed to copy to clipboard', { id: toastId });
  return false;
}

export function triggerBrowserBlobDownload(
  blob: Blob,
  filename: string,
  revokeDelayMs: number = 10_000,
): void {
  if (typeof document === 'undefined' || typeof URL === 'undefined') return;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  try {
    link.click();
  } finally {
    if (link.parentNode) {
      link.parentNode.removeChild(link);
    }
    setTimeout(() => URL.revokeObjectURL(url), revokeDelayMs);
  }
}

export function triggerBrowserTextDownload(
  content: string,
  filename: string,
  mimeType: string = 'text/plain;charset=utf-8',
): void {
  const blob = new Blob([content], { type: mimeType });
  triggerBrowserBlobDownload(blob, filename);
}

export function triggerBrowserUrlDownload(url: string, filename: string): void {
  if (typeof document === 'undefined' || !url) return;
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  try {
    link.click();
  } finally {
    if (link.parentNode) {
      link.parentNode.removeChild(link);
    }
  }
}

export function openInNewTab(url: string): void {
  if (typeof window === 'undefined' || !url) return;
  window.open(url, '_blank', 'noopener,noreferrer');
}
