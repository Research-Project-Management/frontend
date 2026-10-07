import { z } from 'zod';

export const figureWizardSchema = z.object({
  selectedFilename: z.string().min(1, 'Please select or upload an image'),
  caption: z.string().default('Figure caption'),
  label: z.string().default('fig:my_figure'),
  width: z.string().default('0.8\\linewidth'),
  placement: z.string().default('htbp'),
  centering: z.boolean().default(true),
});

export type FigureWizardFormValues = z.infer<typeof figureWizardSchema>;
