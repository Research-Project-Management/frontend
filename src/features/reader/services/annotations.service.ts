/**
 * annotations.service.ts
 *
 * Facade delegating to readerService.annotations (features/reader/data/reader.service.ts)
 * 100% self-contained within features/reader with no dependencies on features/library.
 */

import { readerService } from '../data/reader.service';
import type {
  ReaderAnnotation,
  CreateAnnotationDto,
  UpdateAnnotationDto,
} from '../types/reader.types';

export type CreateAnnotationDTO = CreateAnnotationDto;
export type UpdateAnnotationDTO = UpdateAnnotationDto;

export const AnnotationsService = {
  getByAttachment: (
    scopeIdOrAttachmentId: string | undefined,
    attachmentId?: string,
  ): Promise<ReaderAnnotation[]> => {
    if (attachmentId !== undefined) {
      return readerService.annotations.getByAttachment(scopeIdOrAttachmentId, attachmentId);
    }
    return readerService.annotations.getByAttachment(undefined, scopeIdOrAttachmentId || '');
  },

  create: (
    scopeIdOrAttachmentId: string | undefined,
    attachmentIdOrDto: string | CreateAnnotationDto,
    maybeDto?: CreateAnnotationDto,
  ): Promise<ReaderAnnotation> => {
    if (typeof attachmentIdOrDto === 'string') {
      return readerService.annotations.create(
        scopeIdOrAttachmentId,
        attachmentIdOrDto,
        maybeDto || ({} as CreateAnnotationDto),
      );
    }
    return readerService.annotations.create(
      undefined,
      scopeIdOrAttachmentId || '',
      attachmentIdOrDto,
    );
  },

  update: (
    scopeIdOrId: string | undefined,
    attachmentIdOrDto: string | UpdateAnnotationDto,
    idOrExpectedVersion?: string | number,
    expectedVersionOrDto?: number | UpdateAnnotationDto,
    maybeDto?: UpdateAnnotationDto,
  ): Promise<ReaderAnnotation> => {
    if (typeof attachmentIdOrDto === 'string' && typeof idOrExpectedVersion === 'string') {
      return readerService.annotations.update(
        scopeIdOrId,
        attachmentIdOrDto,
        idOrExpectedVersion,
        typeof expectedVersionOrDto === 'number' ? expectedVersionOrDto : undefined,
        typeof expectedVersionOrDto === 'object' ? (expectedVersionOrDto as UpdateAnnotationDto) : maybeDto,
      );
    }
    const id = scopeIdOrId || '';
    const dto = (typeof attachmentIdOrDto === 'object' ? attachmentIdOrDto : {}) as UpdateAnnotationDto;
    return readerService.annotations.update(undefined, '', id, undefined, dto);
  },

  delete: (
    scopeIdOrId: string | undefined,
    attachmentId?: string,
    id?: string,
    expectedVersion?: number,
  ): Promise<{ deleted: boolean; id: string }> => {
    if (attachmentId && id) {
      return readerService.annotations.delete(scopeIdOrId, attachmentId, id, expectedVersion);
    }
    return readerService.annotations.delete(undefined, '', scopeIdOrId || '', expectedVersion);
  },

  batch: (
    scopeIdOrAttachmentId: string | undefined,
    attachmentIdOrOps:
      | string
      | {
          creates?: CreateAnnotationDto[];
          updates?: Array<UpdateAnnotationDto & { id: string }>;
          deletes?: string[];
          upserts?: any[];
        },
    maybeOps?: {
      creates?: CreateAnnotationDto[];
      updates?: Array<UpdateAnnotationDto & { id: string }>;
      deletes?: string[];
      upserts?: any[];
    },
  ) => {
    if (typeof attachmentIdOrOps === 'string') {
      return readerService.annotations.batch(
        scopeIdOrAttachmentId,
        attachmentIdOrOps,
        maybeOps || {},
      );
    }
    return readerService.annotations.batch(
      undefined,
      scopeIdOrAttachmentId || '',
      attachmentIdOrOps,
    );
  },

  extractNotes: (
    scopeIdOrAttachmentId: string | undefined,
    itemIdOrOptions?: string | { noteId?: string; tagColor?: boolean; includeComments?: boolean },
    options?: { noteId?: string; tagColor?: boolean; includeComments?: boolean },
  ) => {
    if (typeof itemIdOrOptions === 'string') {
      return readerService.annotations.extractNotes(scopeIdOrAttachmentId, itemIdOrOptions, options);
    }
    return readerService.annotations.extractNotes(
      undefined,
      scopeIdOrAttachmentId || '',
      itemIdOrOptions,
    );
  },

  importExternal: (
    scopeIdOrAttachmentId: string | undefined,
    attachmentId?: string,
  ) => {
    if (attachmentId) {
      return readerService.annotations.importExternal(scopeIdOrAttachmentId, attachmentId);
    }
    return readerService.annotations.importExternal(undefined, scopeIdOrAttachmentId || '');
  },
};

export default AnnotationsService;
