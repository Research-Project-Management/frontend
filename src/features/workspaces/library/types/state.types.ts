import { z } from 'zod';
import {
  readStatusSchema,
  itemStateSchema,
  itemStateResponseSchema,
  batchItemStateResponseSchema,
  updateItemStateSchema,
} from '../schemas/state.schema';

export type ReadStatus = z.infer<typeof readStatusSchema>;
export type ItemStateData = z.infer<typeof itemStateSchema>;
export type UserItemStateData = ItemStateData;

export type UpdateItemStateInput = z.infer<typeof updateItemStateSchema>;
export type ItemStateResponse = z.infer<typeof itemStateResponseSchema>;
export type BatchItemStateResponse = z.infer<typeof batchItemStateResponseSchema>;
