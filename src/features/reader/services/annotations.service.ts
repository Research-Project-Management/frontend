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
  getByAttachment: (attachmentId: string): Promise<ReaderAnnotation[]> =>
    readerService.annotations.getByAttachment(attachmentId),

  create: (attachmentId: string, dto: CreateAnnotationDto): Promise<ReaderAnnotation> =>
    readerService.annotations.create(attachmentId, dto),

  update: (id: string, dto: UpdateAnnotationDto): Promise<ReaderAnnotation> =>
    readerService.annotations.update(id, dto),

  delete: (id: string): Promise<{ deleted: boolean; id: string }> =>
    readerService.annotations.delete(id),

  batch: (
    attachmentId: string,
    operations: {
      creates?: CreateAnnotationDto[];
      updates?: Array<UpdateAnnotationDto & { id: string }>;
      deletes?: string[];
    },
  ) => readerService.annotations.batch(attachmentId, operations),

  extractNotes: (
    attachmentId: string,
    options?: { noteId?: string; tagColor?: boolean; includeComments?: boolean },
  ) => readerService.annotations.extractNotes(attachmentId, options),

  importExternal: (attachmentId: string) =>
    readerService.annotations.importExternal(attachmentId),
};

export default AnnotationsService;
