import { z } from 'zod';

export const preferencesSchema = z.object({
  theme: z.enum(['system', 'light', 'dark']),
  smoothCursor: z.boolean(),
  submitShortcut: z.enum(['enter', 'cmd_enter']),
  timezone: z.string(),
  language: z.enum(['en', 'vi']),
  firstDayOfWeek: z.enum(['sunday', 'monday']),
  weekendDays: z.enum(['sat_sun', 'fri_sat']),
});
