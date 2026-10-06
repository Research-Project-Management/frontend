'use client';

/**
 * useFigureWizard.ts
 *
 * Dedicated hook for FigureWizardModal using react-hook-form and zod:
 * - Form validation with zodResolver
 * - Dynamic LaTeX figure generation
 * - Centralized toast notifications for insertion & clipboard copy
 */

import { useMemo, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import {
  figureWizardSchema,
  type FigureWizardFormValues,
} from '../schemas/figure-wizard.schema';

export interface UseFigureWizardOptions {
  onInsert: (latexCode: string) => void;
  onClose: () => void;
}

export function useFigureWizard({ onInsert, onClose }: UseFigureWizardOptions) {
  const form = useForm<FigureWizardFormValues>({
    resolver: zodResolver(figureWizardSchema) as any,
    defaultValues: {
      selectedFilename: '',
      caption: 'Figure caption',
      label: 'fig:my_figure',
      width: '0.8\\linewidth',
      placement: 'htbp',
      centering: true,
    },
  });

  const { watch, setValue } = form;
  const values = watch();

  const handleSelectImage = useCallback(
    (filename: string) => {
      setValue('selectedFilename', filename, { shouldValidate: true });
      const stem = filename
        .replace(/\.[^/.]+$/, '')
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '_');
      setValue('label', `fig:${stem}`);
    },
    [setValue],
  );

  const generatedLatex = useMemo(() => {
    const imgName = values.selectedFilename || 'example-image.png';

    let code = `\\begin{figure}[${values.placement}]\n`;
    if (values.centering) {
      code += `  \\centering\n`;
    }
    code += `  \\includegraphics[width=${values.width}]{${imgName}}\n`;
    if (values.caption) {
      code += `  \\caption{${values.caption}}\n`;
    }
    if (values.label) {
      code += `  \\label{${values.label}}\n`;
    }
    code += `\\end{figure}\n`;
    return code;
  }, [
    values.selectedFilename,
    values.placement,
    values.centering,
    values.width,
    values.caption,
    values.label,
  ]);

  const insertFigure = useCallback(() => {
    onInsert(generatedLatex);
    toast.success('Figure inserted into document');
    onClose();
  }, [onInsert, generatedLatex, onClose]);

  const copyFigureCode = useCallback(() => {
    navigator.clipboard.writeText(generatedLatex);
    toast.info('LaTeX code copied to clipboard');
  }, [generatedLatex]);

  return {
    form,
    values,
    generatedLatex,
    handleSelectImage,
    insertFigure,
    copyFigureCode,
  };
}
