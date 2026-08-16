import { z } from "zod";
import {
  taskLabelSchema,
  labelSchema,
  createLabelSchema,
  updateLabelSchema,
} from "../schemas/label.schema";

export type TaskLabel = z.infer<typeof taskLabelSchema>;
export type Label = z.infer<typeof labelSchema>;
export type CreateLabelInput = z.infer<typeof createLabelSchema>;
export type UpdateLabelInput = z.infer<typeof updateLabelSchema>;
