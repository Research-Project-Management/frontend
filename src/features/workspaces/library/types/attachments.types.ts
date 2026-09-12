import { z } from 'zod';
import {
  attachmentSchema,
  attachmentRevisionSchema,
  attachmentTypeSchema,
  attachmentExtractionStatusSchema,
  addRevisionSchema,
  createAttachmentSchema,
  updateAttachmentSchema,
} from '../schemas/attachment.schema';

export type ItemAttachment = z.infer<typeof attachmentSchema>;
export type AttachmentDto = ItemAttachment;
export type AttachmentRevision = z.infer<typeof attachmentRevisionSchema>;
export type AttachmentRevisionDto = AttachmentRevision;
export type AttachmentType = z.infer<typeof attachmentTypeSchema>;
export type AttachmentExtractionStatus = z.infer<
  typeof attachmentExtractionStatusSchema
>;

export type AddRevisionInput = z.infer<typeof addRevisionSchema>;
export type CreateAttachmentInput = z.infer<typeof createAttachmentSchema>;
export type UpdateAttachmentInput = z.infer<typeof updateAttachmentSchema>;
