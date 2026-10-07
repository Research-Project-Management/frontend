import { z } from 'zod';

export const notificationsSchema = z.object({
  propertyChanges: z.boolean(),
  stateChange: z.boolean(),
  workItemCompleted: z.boolean(),
  comments: z.boolean(),
  mentions: z.boolean(),
});

export type NotificationsFormValues = z.infer<typeof notificationsSchema>;
