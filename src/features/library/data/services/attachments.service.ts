import { apiGet, apiPost, apiPatch, apiDelete } from "@/shared/lib/api";
import type { AttachmentDto, AttachmentRevisionDto } from "../../types/library.types";
import { isProjectScope } from '../../domain';
export type { AttachmentDto, AttachmentRevisionDto };

export interface AddRevisionDto {
  fileId: string;
  filename?: string;
  comment?: string;
}

export interface RenameAttachmentInput {
  filename?: string;
  pattern?: string;
}

export interface BatchRenameAttachmentsInput {
  itemIds?: string[];
  attachmentIds?: string[];
  pattern?: string;
}

// ── Scope URL helpers ─────────────────────────────────────────────────────────

/** Builds a scoped URL for item-level attachment routes. */
function getItemAttachmentUrl(scopeId: string | undefined, itemId: string, suffix = ''): string {
  const base = isProjectScope(scopeId)
    ? `/api/v1/projects/${encodeURIComponent(scopeId!)}/library/items/${encodeURIComponent(itemId)}/attachments`
    : `/api/v1/library/items/${encodeURIComponent(itemId)}/attachments`;
  return suffix ? `${base}/${suffix}` : base;
}

/** Builds a scoped URL for attachment-level routes. */
function getAttachmentUrl(scopeId: string | undefined, attachmentId: string, suffix = ''): string {
  const base = isProjectScope(scopeId)
    ? `/api/v1/projects/${encodeURIComponent(scopeId!)}/library/attachments/${encodeURIComponent(attachmentId)}`
    : `/api/v1/library/attachments/${encodeURIComponent(attachmentId)}`;
  return suffix ? `${base}/${suffix}` : base;
}

/** Builds a scoped URL for file-level content routes. */
function getFileUrl(scopeId: string | undefined, fileId: string, suffix = ''): string {
  const base = isProjectScope(scopeId)
    ? `/api/v1/projects/${encodeURIComponent(scopeId!)}/library/files/${encodeURIComponent(fileId)}`
    : `/api/v1/library/files/${encodeURIComponent(fileId)}`;
  return suffix ? `${base}/${suffix}` : base;
}

// ── Exported functions ────────────────────────────────────────────────────────

export async function getAttachments(scopeId: string, itemId: string): Promise<AttachmentDto[]> {
  const response = await apiGet<{ attachments: AttachmentDto[] }>(
    getItemAttachmentUrl(scopeId, itemId),
  );
  return response.attachments || [];
}

/**
 * Get a single attachment by ID.
 * Backed by GET /api/v1/library/attachments/:attachmentId
 */
export async function getAttachment(
  scopeId: string,
  attachmentId: string,
): Promise<AttachmentDto> {
  const response = await apiGet<{ attachment: AttachmentDto }>(
    getAttachmentUrl(scopeId, attachmentId),
  );
  return (response as any).attachment ?? response;
}

export async function getAttachmentRevisions(
  scopeId: string,
  attachmentId: string,
): Promise<AttachmentRevisionDto[]> {
  const response = await apiGet<{ revisions: AttachmentRevisionDto[] }>(
    getAttachmentUrl(scopeId, attachmentId, 'revisions'),
  );
  return response.revisions || [];
}

/**
 * Upload a new file revision for an existing attachment.
 * Backed by POST /api/v1/library/attachments/:attachmentId/revisions
 */
export async function addRevision(
  scopeId: string,
  attachmentId: string,
  dto: AddRevisionDto,
): Promise<AttachmentRevisionDto> {
  const response = await apiPost<{ revision: AttachmentRevisionDto }>(
    getAttachmentUrl(scopeId, attachmentId, 'revisions'),
    dto,
  );
  return (response as any).revision ?? response;
}

export async function deleteAttachment(
  scopeId: string,
  attachmentId: string,
): Promise<boolean> {
  const response = await apiDelete<{ success: boolean }>(
    getAttachmentUrl(scopeId, attachmentId),
  );
  return response.success;
}

export async function captureSnapshot(
  scopeId: string,
  itemId: string,
  url?: string,
): Promise<AttachmentDto> {
  const response = await apiPost<{ attachment: AttachmentDto } | AttachmentDto>(
    getItemAttachmentUrl(scopeId, itemId, 'snapshot'),
    url ? { url } : {},
  );
  return (response as { attachment?: AttachmentDto }).attachment ?? (response as AttachmentDto);
}

export async function createAttachment(
  scopeId: string,
  itemId: string,
  data: Record<string, unknown>,
): Promise<AttachmentDto> {
  const response = await apiPost<{ attachment?: AttachmentDto } | AttachmentDto>(
    getItemAttachmentUrl(scopeId, itemId),
    data,
  );
  return (response as { attachment?: AttachmentDto }).attachment ?? (response as AttachmentDto);
}

export async function setPrimaryAttachment(
  scopeId: string,
  itemId: string,
  attachmentId: string,
): Promise<{ success: boolean }> {
  return apiPost(
    getItemAttachmentUrl(scopeId, itemId, `${encodeURIComponent(attachmentId)}/set-primary`),
    {},
  );
}

export function getFileContentUrl(scopeId: string, fileId: string): string {
  return getFileUrl(scopeId, fileId, 'content');
}

export async function fetchFileContent(scopeId: string, fileId: string): Promise<Blob> {
  return apiGet<Blob>(getFileUrl(scopeId, fileId, 'content'));
}

export function getAttachmentContentUrl(scopeId: string, attachmentId: string): string {
  return getAttachmentUrl(scopeId, attachmentId, 'content');
}

export async function fetchAttachmentContent(scopeId: string, attachmentId: string): Promise<Blob> {
  return apiGet<Blob>(getAttachmentUrl(scopeId, attachmentId, 'content'));
}

export async function uploadLibraryAttachment(
  scopeId: string | undefined,
  formData: FormData,
): Promise<{ fileId: string; url: string; filename: string; size: number; mimeType: string }> {
  const isProject = isProjectScope(scopeId);
  const uploadUrl = isProject
    ? `/api/v1/projects/${encodeURIComponent(scopeId!)}/library/attachments/upload`
    : `/api/v1/library/attachments/upload`;
  const response = await apiPost<any>(uploadUrl, formData);
  const data = (response as any)?.data || response;
  return {
    fileId: String(data?.fileId || data?.id || ''),
    url: String(data?.url || ''),
    filename: String(data?.filename || ''),
    size: Number(data?.size || 0),
    mimeType: String(data?.mimeType || 'application/pdf'),
  };
}

export async function renameAttachment(
  scopeId: string,
  attachmentId: string,
  dto: RenameAttachmentInput,
): Promise<{ attachment: AttachmentDto; oldFilename: string; newFilename: string }> {
  const response = await apiPatch<{ attachment: AttachmentDto; oldFilename: string; newFilename: string }>(
    getAttachmentUrl(scopeId, attachmentId, 'rename'),
    dto,
  );
  return response;
}

export async function batchRenameAttachments(
  scopeId: string,
  dto: BatchRenameAttachmentsInput,
): Promise<{
  renamedCount: number;
  results: Array<{ attachmentId: string; itemId: string; oldFilename: string; newFilename: string }>;
}> {
  const batchBase = isProjectScope(scopeId)
    ? `/api/v1/projects/${encodeURIComponent(scopeId!)}/library/attachments/batch-rename`
    : `/api/v1/library/attachments/batch-rename`;
  const response = await apiPost<{
    renamedCount: number;
    results: Array<{ attachmentId: string; itemId: string; oldFilename: string; newFilename: string }>;
  }>(
    batchBase,
    dto,
  );
  return response;
}

export const AttachmentsService = {
  getAttachments,
  getAttachment,
  getAttachmentRevisions,
  addRevision,
  deleteAttachment,
  createAttachment,
  renameAttachment,
  batchRenameAttachments,
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
  rename: renameAttachment,
  batchRename: batchRenameAttachments,
  add: createAttachment,
  create: createAttachment,
  setPrimary: setPrimaryAttachment,
};

export const AttachmentService = AttachmentsService;
export const uploadAttachment = uploadLibraryAttachment;

