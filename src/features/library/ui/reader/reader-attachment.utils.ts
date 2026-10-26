import type { Item } from '@/features/library/domain/types/library.types';

export interface EpubOrSnapshotInfo {
  mode: 'epub' | 'snapshot';
  url: string;
}

export interface RawAttachmentItem {
  id?: string;
  url?: string;
  fileUrl?: string;
  mimeType?: string;
  filename?: string;
  attachmentType?: string;
  linkMode?: string;
}

export function resolveEpubOrSnapshot(
  paper?: Partial<Item> | Record<string, unknown> | null,
  paperUrl?: string | null,
  requestedAttId?: string | null,
  selectedAttachment?: RawAttachmentItem | null,
): EpubOrSnapshotInfo | null {
  if (!paper) return null;
  const itemLike = paper as Partial<Item>;
  const rawAtts: RawAttachmentItem[] = Array.isArray(itemLike.attachments)
    ? (itemLike.attachments as RawAttachmentItem[])
    : [];

  const activeAtt = requestedAttId
    ? rawAtts.find((a: RawAttachmentItem) => a.id === requestedAttId)
    : selectedAttachment;

  if (activeAtt) {
    const attMime = activeAtt.mimeType?.toLowerCase() || '';
    const attName = (activeAtt.filename || '').toLowerCase();
    const attUrl = (activeAtt.fileUrl || activeAtt.url || paperUrl || '') as string;
    const isSnapshot =
      activeAtt.attachmentType === 'snapshot' ||
      activeAtt.attachmentType === 'web_snapshot' ||
      activeAtt.linkMode === 'imported_url' ||
      attMime === 'text/html' ||
      attName.endsWith('.html');
    const isEpub =
      attMime.includes('epub') ||
      attName.endsWith('.epub') ||
      /\.epub(?:$|\?)/i.test(attUrl);

    if (isEpub) {
      return { mode: 'epub', url: attUrl };
    }
    if (isSnapshot) {
      return { mode: 'snapshot', url: attUrl };
    }
  }

  const primaryMime = itemLike.primaryFile?.mimeType?.toLowerCase() || '';
  const primaryName = String(
    itemLike.filename ||
    itemLike.primaryFile?.filename ||
    ''
  ).toLowerCase();

  if (
    primaryMime.includes('epub') ||
    primaryName.endsWith('.epub') ||
    (paperUrl && /\.epub(?:$|\?)/i.test(paperUrl))
  ) {
    return {
      mode: 'epub',
      url: paperUrl || itemLike.primaryFile?.url || '',
    };
  }

  const epubAtt = rawAtts.find(
    (a: RawAttachmentItem) =>
      a.mimeType?.toLowerCase().includes('epub') ||
      a.filename?.toLowerCase().endsWith('.epub'),
  );
  if (epubAtt && (epubAtt.url || epubAtt.fileUrl)) {
    return {
      mode: 'epub',
      url: (epubAtt.fileUrl || epubAtt.url) as string,
    };
  }

  if (!paperUrl) {
    const snapshotAtt = rawAtts.find(
      (a: RawAttachmentItem) =>
        a.attachmentType === 'snapshot' ||
        a.attachmentType === 'web_snapshot' ||
        a.linkMode === 'imported_url' ||
        a.mimeType === 'text/html' ||
        a.filename?.toLowerCase().endsWith('.html'),
    );
    if (snapshotAtt && (snapshotAtt.url || snapshotAtt.fileUrl)) {
      return {
        mode: 'snapshot',
        url: (snapshotAtt.fileUrl || snapshotAtt.url) as string,
      };
    }
  }

  return null;
}
