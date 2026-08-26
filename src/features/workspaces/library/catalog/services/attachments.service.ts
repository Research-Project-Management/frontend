import { apiGet, apiDelete } from '@/shared/lib/api';

export interface AttachmentRevisionDto {
  id: string;
  attachmentId: string;
  revisionNumber: number;
  fileHash: string;
  sizeBytes: number;
  url: string;
  comment?: string;
  createdAt: string;
}

export interface AttachmentDto {
  id: string;
  catalogItemId: string;
  filename: string;
  url: string;
  mimeType: string;
  size: number;
  fileHash?: string;
  uploadedAt: string;
  revisions?: AttachmentRevisionDto[];
}

export async function getAttachments(workspaceId: string, paperId: string): Promise<AttachmentDto[]> {
  const response = await apiGet<{ attachments: AttachmentDto[] }>(
    `/api/library/papers/${workspaceId}/${paperId}/attachments`,
  );
  return response.attachments || [];
}

export async function getAttachmentRevisions(
  _workspaceId: string,
  attachmentId: string,
): Promise<AttachmentRevisionDto[]> {
  const response = await apiGet<{ revisions: AttachmentRevisionDto[] }>(
    `/api/library/attachments/${attachmentId}/revisions`,
  );
  return response.revisions || [];
}

export async function deleteAttachment(
  _workspaceId: string,
  attachmentId: string,
): Promise<boolean> {
  const response = await apiDelete<{ success: boolean }>(
    `/api/library/attachments/${attachmentId}`,
  );
  return response.success;
}
