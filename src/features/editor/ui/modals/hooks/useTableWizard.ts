'use client';

/**
 * useTableWizard.ts
 *
 * Dedicated hook for TableWizardModal using react-hook-form and zod:
 * - Form validation with zodResolver
 * - Visual table grid and CSV/TSV parser
 * - Dynamic LaTeX table generation (booktabs, bordered, minimal)
 * - Encapsulated toast notifications for insertion & clipboard copy
 */

import { useState, useMemo, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import {
  tableWizardSchema,
  type TableWizardFormValues,
} from '@/features/editor/domain/types';

export interface UseTableWizardOptions {
  onInsert: (latexCode: string) => void;
  onClose: () => void;
}

export function useTableWizard({ onInsert, onClose }: UseTableWizardOptions) {
  const [activeTab, setActiveTab] = useState<'visual' | 'paste'>('visual');

  // Visual builder state
  const [rows, setRows] = useState<number>(3);
  const [cols, setCols] = useState<number>(3);
  const [hoverRows, setHoverRows] = useState<number>(0);
  const [hoverCols, setHoverCols] = useState<number>(0);

  // Paste Excel/CSV state
  const [pastedText, setPastedText] = useState<string>('');

  const form = useForm<TableWizardFormValues>({
    resolver: zodResolver(tableWizardSchema) as any,
    defaultValues: {
      tableStyle: 'booktabs',
      defaultAlign: 'c',
      caption: 'Summary of results',
      label: 'tab:results',
      placement: 'htbp',
      centering: true,
      firstRowIsHeader: true,
    },
  });

  const { watch, setValue } = form;
  const values = watch();

  // Parse pasted Excel/CSV data
  const parsedData = useMemo(() => {
    if (!pastedText.trim()) return [];

    const sampleLine = pastedText.split(/\r?\n/)[0] || '';
    let delimiter = '\t';
    if (!sampleLine.includes('\t')) {
      if (sampleLine.includes(',')) delimiter = ',';
      else if (sampleLine.includes(';')) delimiter = ';';
    }

    const lines = pastedText.trim().split(/\r?\n/);
    return lines.map((line) => {
      if (delimiter === ',') {
        const regex = /(?:,|\n|^)("(?:(?:"")*[^"]*)*"|[^",\n]*|(?:\n|$))/g;
        const entries: string[] = [];
        let match;
        while ((match = regex.exec(line)) !== null) {
          let val = match[1] ?? '';
          if (val.startsWith('"') && val.endsWith('"')) {
            val = val.slice(1, -1).replace(/""/g, '"');
          }
          entries.push(val.trim());
          if (match.index + match[0].length >= line.length) break;
        }
        return entries.filter((_, idx, arr) => idx < arr.length || arr.some((item) => item.length > 0));
      }
      return line.split(delimiter).map((c) => c.trim());
    });
  }, [pastedText]);

  // Generate LaTeX Code
  const generatedLatex = useMemo(() => {
    const isPaste = activeTab === 'paste' && parsedData.length > 0;
    const effCols = isPaste ? Math.max(...parsedData.map((r) => r.length), 1) : cols;
    const effRows = isPaste ? parsedData.length : rows;

    let colSpec = '';
    if (values.tableStyle === 'bordered') {
      colSpec = `|${Array(effCols).fill(values.defaultAlign).join('|')}|`;
    } else {
      colSpec = Array(effCols).fill(values.defaultAlign).join('');
    }

    let body = '';

    if (isPaste) {
      parsedData.forEach((row, rIdx) => {
        const padded = [...row];
        while (padded.length < effCols) padded.push('');
        const sanitized = padded.map((cell) => cell.replace(/([%$#&_])/g, '\\$1'));

        if (rIdx === 0 && values.firstRowIsHeader) {
          body += `    ${sanitized.join(' & ')} \\\\\n`;
          if (values.tableStyle === 'booktabs') {
            body += `    \\midrule\n`;
          } else if (values.tableStyle === 'bordered') {
            body += `    \\hline\n`;
          }
        } else {
          body += `    ${sanitized.join(' & ')} \\\\\n`;
          if (values.tableStyle === 'bordered' && rIdx < effRows - 1) {
            body += `    \\hline\n`;
          }
        }
      });
    } else {
      for (let r = 0; r < effRows; r++) {
        const cells: string[] = [];
        for (let c = 0; c < effCols; c++) {
          if (r === 0) {
            cells.push(`Header ${c + 1}`);
          } else {
            cells.push(`Data ${r},${c + 1}`);
          }
        }
        body += `    ${cells.join(' & ')} \\\\\n`;
        if (r === 0) {
          if (values.tableStyle === 'booktabs') {
            body += `    \\midrule\n`;
          } else if (values.tableStyle === 'bordered') {
            body += `    \\hline\n`;
          }
        } else if (values.tableStyle === 'bordered' && r < effRows - 1) {
          body += `    \\hline\n`;
        }
      }
    }

    let result = '';
    result += `\\begin{table}[${values.placement}]\n`;
    if (values.centering) {
      result += `  \\centering\n`;
    }
    if (values.caption) {
      result += `  \\caption{${values.caption}}\n`;
    }
    if (values.label) {
      result += `  \\label{${values.label}}\n`;
    }
    result += `  \\begin{tabular}{${colSpec}}\n`;
    if (values.tableStyle === 'booktabs') {
      result += `    \\toprule\n`;
    } else if (values.tableStyle === 'bordered') {
      result += `    \\hline\n`;
    }

    result += body;

    if (values.tableStyle === 'booktabs') {
      result += `    \\bottomrule\n`;
    } else if (values.tableStyle === 'bordered') {
      result += `    \\hline\n`;
    }
    result += `  \\end{tabular}\n`;
    result += `\\end{table}\n`;

    return result;
  }, [
    activeTab,
    rows,
    cols,
    values.tableStyle,
    values.defaultAlign,
    values.caption,
    values.label,
    values.placement,
    values.centering,
    values.firstRowIsHeader,
    parsedData,
  ]);

  const insertTable = useCallback(() => {
    onInsert(generatedLatex);
    toast.success('Table inserted into document');
    onClose();
  }, [onInsert, generatedLatex, onClose]);

  const copyTableCode = useCallback(() => {
    navigator.clipboard.writeText(generatedLatex);
    toast.info('LaTeX code copied to clipboard');
  }, [generatedLatex]);

  return {
    activeTab,
    setActiveTab,
    rows,
    setRows,
    cols,
    setCols,
    hoverRows,
    setHoverRows,
    hoverCols,
    setHoverCols,
    pastedText,
    setPastedText,
    parsedData,
    form,
    values,
    setValue,
    generatedLatex,
    insertTable,
    copyTableCode,
  };
}
