import type { AttachFileItem } from '../types/work-item.types';
import type { ItemAttachment } from '../types/attachment.types';

export function getAttachmentTypeLabel(attachment: ItemAttachment | AttachFileItem): string {
  const name = attachment.name?.trim() || '';
  const extension = name.includes('.') ? name.split('.').pop()?.toUpperCase() : '';
  const mimeType = attachment.type?.split('/')[0] || '';

  if (extension) return extension;
  if (mimeType === 'image') return 'IMG';
  if (mimeType === 'video') return 'VID';
  if (mimeType === 'audio') return 'AUD';
  if (mimeType === 'application') return 'FILE';

  return 'FILE';
}

export function formatAttachmentMeta(dateStr?: string): string {
  if (!dateStr) return 'Added';
  const createdDate = new Date(dateStr);
  if (Number.isNaN(createdDate.getTime())) return 'Added';

  const diffInMinutes = Math.floor((Date.now() - createdDate.getTime()) / 60000);
  if (diffInMinutes < 1) return 'Just now';
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;

  const diffInDays = Math.floor(diffInHours / 24);
  return `${diffInDays}d ago`;
}
