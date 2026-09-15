import { apiGet, apiPost, apiDelete } from "@/shared/lib/api";
import type { AttachmentDto, AttachmentRevisionDto } from "../types/library.types";
export type { AttachmentDto, AttachmentRevisionDto };

export interface AddRevisionDto {
  fileId: string;
  filename?: string;
  comment?: string;
}

export async function getAttachments(_scopeId: string, itemId: string): Promise<AttachmentDto[]> {
  const response = await apiGet<{ attachments: AttachmentDto[] }>(
    `/api/v1/library/items/${encodeURIComponent(itemId)}/attachments`,
  );
  return response.attachments || [];
}

/**
 * Get a single attachment by ID.
 * Backed by GET /api/v1/library/attachments/:attachmentId
 */
export async function getAttachment(
  _scopeId: string,
  attachmentId: string,
): Promise<AttachmentDto> {
  const response = await apiGet<{ attachment: AttachmentDto }>(
    `/api/v1/library/attachments/${encodeURIComponent(attachmentId)}`,
  );
  return (response as any).attachment ?? response;
}

export async function getAttachmentRevisions(
  _scopeId: string,
  attachmentId: string,
): Promise<AttachmentRevisionDto[]> {
  const response = await apiGet<{ revisions: AttachmentRevisionDto[] }>(
    `/api/v1/library/attachments/${encodeURIComponent(attachmentId)}/revisions`,
  );
  return response.revisions || [];
}

/**
 * Upload a new file revision for an existing attachment.
 * Backed by POST /api/v1/library/attachments/:attachmentId/revisions
 */
export async function addRevision(
  _scopeId: string,
  attachmentId: string,
  dto: AddRevisionDto,
): Promise<AttachmentRevisionDto> {
  const response = await apiPost<{ revision: AttachmentRevisionDto }>(
    `/api/v1/library/attachments/${encodeURIComponent(attachmentId)}/revisions`,
    dto,
  );
  return (response as any).revision ?? response;
}

export async function deleteAttachment(
  _scopeId: string,
  attachmentId: string,
): Promise<boolean> {
  const response = await apiDelete<{ success: boolean }>(
    `/api/v1/library/attachments/${encodeURIComponent(attachmentId)}`,
  );
  return response.success;
}

export async function captureSnapshot(
  _scopeId: string,
  itemId: string,
  url?: string,
): Promise<AttachmentDto> {
  const response = await apiPost<{ attachment: AttachmentDto } | AttachmentDto>(
    `/api/v1/library/items/${encodeURIComponent(itemId)}/attachments/snapshot`,
    url ? { url } : {},
  );
  return (response as { attachment?: AttachmentDto }).attachment ?? (response as AttachmentDto);
}

export async function createAttachment(
  _scopeId: string,
  itemId: string,
  data: Record<string, unknown>,
): Promise<AttachmentDto> {
  const response = await apiPost<{ attachment?: AttachmentDto } | AttachmentDto>(
    `/api/v1/library/items/${encodeURIComponent(itemId)}/attachments`,
    data,
  );
  return (response as { attachment?: AttachmentDto }).attachment ?? (response as AttachmentDto);
}

export async function setPrimaryAttachment(
  _scopeId: string,
  itemId: string,
  attachmentId: string,
): Promise<{ success: boolean }> {
  return apiPost(
    `/api/v1/library/items/${encodeURIComponent(itemId)}/attachments/${encodeURIComponent(attachmentId)}/set-primary`,
    {},
  );
}

export function getFileContentUrl(_scopeId: string, fileId: string): string {
  return `/api/v1/library/files/${encodeURIComponent(fileId)}/content`;
}

export async function fetchFileContent(_scopeId: string, fileId: string): Promise<Blob> {
  return apiGet<Blob>(
    `/api/v1/library/files/${encodeURIComponent(fileId)}/content`,
  );
}

export function getAttachmentContentUrl(_scopeId: string, attachmentId: string): string {
  return `/api/v1/library/attachments/${encodeURIComponent(attachmentId)}/content`;
}

export async function fetchAttachmentContent(_scopeId: string, attachmentId: string): Promise<Blob> {
  return apiGet<Blob>(
    `/api/v1/library/attachments/${encodeURIComponent(attachmentId)}/content`,
  );
}

export async function uploadLibraryAttachment(
  _scopeId: string | undefined,
  formData: FormData,
): Promise<{ fileId: string; url: string; filename: string; size: number; mimeType: string }> {
  return apiPost(
    `/api/v1/library/attachments/upload`,
    formData,
  );
}

export const AttachmentsService = {
  getAttachments,
  getAttachment,
  getAttachmentRevisions,
  addRevision,
  deleteAttachment,
  createAttachment,
  setPrimaryAttachment,
  getFileContentUrl,
  fetchFileContent,
  getAttachmentContentUrl,
  fetchAttachmentContent,
  streamAttachmentContent: fetchAttachmentContent,
  streamFileContent: fetchFileContent,
  uploadAttachment: uploadLibraryAttachment,
  uploadFile: uploadLibraryAttachment,
  addAttachment: createAttachment,
  captureSnapshot,
  // Ergonomic aliases
  list: getAttachments,
  get: getAttachment,
  revisions: getAttachmentRevisions,
  delete: deleteAttachment,
  add: createAttachment,
  create: createAttachment,
  setPrimary: setPrimaryAttachment,
};

export const AttachmentService = AttachmentsService;
export const uploadAttachment = uploadLibraryAttachment;
