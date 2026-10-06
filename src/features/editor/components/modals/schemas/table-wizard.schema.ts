import { z } from 'zod';

export const tableWizardSchema = z.object({
  tableStyle: z.enum(['booktabs', 'bordered', 'minimal']).default('booktabs'),
  defaultAlign: z.enum(['l', 'c', 'r']).default('c'),
  caption: z.string().default('Summary of results'),
  label: z.string().default('tab:results'),
  placement: z.string().default('htbp'),
  centering: z.boolean().default(true),
  firstRowIsHeader: z.boolean().default(true),
});

export type TableWizardFormValues = z.infer<typeof tableWizardSchema>;
