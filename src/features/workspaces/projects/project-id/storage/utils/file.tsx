import React from 'react';
import { Folder, FileText, Video, Music, Archive, Image as ImageIcon, File as FileIcon } from 'lucide-react';
import type { FileType, StorageItem } from '@/features/workspaces/projects/project-id/storage/types/storage.types';

export function getFileType(item: StorageItem): FileType {
  if (item.isFolder) return "folder";

  const mimeType = item.mimeType || "";
  if (mimeType.startsWith("image/")) return "image";

  // Fallback to extension check
  const ext = item.filename?.split(".").pop()?.toLowerCase();
  if (
    [
      "jpg",
      "jpeg",
      "png",
      "gif",
      "webp",
      "svg",
      "bmp",
      "ico",
      "tif",
      "tiff",
    ].includes(ext || "")
  ) {
    return "image";
  }

  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  if (
    mimeType.includes("pdf") ||
    mimeType.includes("document") ||
    mimeType.includes("text")
  )
    return "document";
  if (
    mimeType.includes("zip") ||
    mimeType.includes("rar") ||
    mimeType.includes("tar")
  )
    return "archive";
  return "other";
}

export function getFileIcon(type: FileType, size: number = 20) {
  const className = `size-${size}`;
  switch (type) {
    case "folder":
      return <Folder className={className} />;
    case "document":
      return <FileText className={className} />;
    case "image":
      return <ImageIcon className={className} />;
    case "video":
      return <Video className={className} />;
    case "audio":
      return <Music className={className} />;
    case "archive":
      return <Archive className={className} />;
    default:
      return <FileIcon className={className} />;
  }
}

export function getFileColor(type: FileType): string {
  switch (type) {
    case 'folder':   return 'oklch(60% 0.04 255)';
    case 'document': return 'oklch(63% 0.20 18)';
    case 'image':    return 'oklch(65% 0.17 152)';
    case 'video':    return 'oklch(63% 0.20 290)';
    case 'audio':    return 'oklch(65% 0.20 340)';
    case 'archive':  return 'oklch(72% 0.17 65)';
    default:         return 'oklch(60% 0.04 255)';
  }
}

export function formatFileSize(bytes?: number): string {
  if (!bytes) return "—";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

export function formatMimeType(item: StorageItem): string {
  if (item.isFolder) return "Folder";
  const ext = item.filename?.split(".").pop()?.toUpperCase();
  if (ext) {
    if (ext === "PDF") return "PDF Document";
    if (ext === "DOCX" || ext === "DOC") return "Word Document";
    if (ext === "XLSX" || ext === "XLS") return "Excel Spreadsheet";
    if (ext === "PPTX" || ext === "PPT") return "PowerPoint Presentation";
    if (["JPG", "JPEG", "PNG", "GIF", "WEBP", "SVG"].includes(ext)) return `${ext} Image`;
    if (["MP4", "MOV", "AVI", "MKV"].includes(ext)) return `${ext} Video`;
    if (["MP3", "WAV", "OGG"].includes(ext)) return `${ext} Audio`;
    if (["ZIP", "RAR", "TAR", "GZ", "7Z"].includes(ext)) return `${ext} Archive`;
    return `${ext} File`;
  }
  return item.mimeType || "Unknown";
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  return date.toLocaleDateString();
}
