import { apiGet, apiPost, apiDelete } from "@/shared/lib/api";
import type {
  Item,
  AttachPageInput,
  AttachPaperInput,
  AttachFileInput,
  AttachLinkInput,
  AttachPageItem,
  AttachPaperItem,
  AttachFileItem,
  AttachLinkItem,
} from "../types/work-item.types";

export const AttachmentService = {
  presignAttachment: (itemId: string, data: { filename: string; mimeType?: string; size?: number }) =>
    apiPost<{ uploadUrl: string; storageKey: string; publicUrl: string }>(
      `/api/work-items/${itemId}/attachments/presign`,
      data,
    ),

  getAttachment: (attachmentId: string) =>
    apiGet<unknown>(`/api/attachments/${attachmentId}`),

  uploadAttachment: (itemId: string, formData: FormData) =>
    apiPost(`/api/work-items/${itemId}/attachments`, formData),

  deleteAttachment: (itemId: string, attachmentId: string) =>
    apiDelete(`/api/work-items/${itemId}/attachments/${attachmentId}`),

  attachPage: (itemId: string, data: AttachPageInput) =>
    apiPost<{ message: string; task: Item; item?: Item; page: AttachPageItem }>(
      `/api/work-items/${itemId}/attach/pages`,
      data,
    ),

  detachPage: (itemId: string, pageId: string) =>
    apiDelete<{ message: string; task: Item; item?: Item }>(
      `/api/work-items/${itemId}/attach/pages/${pageId}`,
    ),

  attachPaper: (itemId: string, data: AttachPaperInput) =>
    apiPost<{ message: string; task: Item; item?: Item; paper: AttachPaperItem }>(
      `/api/work-items/${itemId}/attach/papers`,
      data,
    ),

  detachPaper: (itemId: string, paperId: string) =>
    apiDelete<{ message: string; task: Item; item?: Item }>(
      `/api/work-items/${itemId}/attach/papers/${paperId}`,
    ),

  attachFile: (itemId: string, data: AttachFileInput) =>
    apiPost<{ message: string; task: Item; item?: Item; file: AttachFileItem }>(
      `/api/work-items/${itemId}/attach/files`,
      data,
    ),

  detachFile: (itemId: string, fileId: string) =>
    apiDelete<{ message: string; task: Item; item?: Item }>(
      `/api/work-items/${itemId}/attach/files/${fileId}`,
    ),

  attachLink: (itemId: string, data: AttachLinkInput) =>
    apiPost<{ message: string; task: Item; item?: Item; link: AttachLinkItem }>(
      `/api/work-items/${itemId}/attach/links`,
      data,
    ),

  detachLink: (itemId: string, linkIndex: number) =>
    apiDelete<{ message: string; task: Item; item?: Item }>(
      `/api/work-items/${itemId}/attach/links/${linkIndex}`,
    ),
};
