import { z } from 'zod';
import {
  noteSchema,
  createNoteSchema,
  updateNoteSchema,
  noteResponseSchema,
  noteListResponseSchema,
} from '../schemas/note.schema';

export type Note = z.infer<typeof noteSchema>;
export type CreateNoteInput = z.infer<typeof createNoteSchema>;
export type UpdateNoteInput = z.infer<typeof updateNoteSchema>;
export type NoteResponse = z.infer<typeof noteResponseSchema>;
export type NoteListResponse = z.infer<typeof noteListResponseSchema>;
