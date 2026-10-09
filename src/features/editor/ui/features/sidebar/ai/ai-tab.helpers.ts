import {
  FileText,
  FileImage,
  FileSpreadsheet,
  FileCode,
  File,
} from 'lucide-react';

export const ACCEPTED_TYPES =
  '.pdf,.doc,.docx,.txt,.md,.csv,.xls,.xlsx,.png,.jpg,.jpeg,.json,.ts,.tsx,.js,.py';

export interface AttachedFile {
  id: string;
  name: string;
  size?: number;
}

export interface UploadingFileItem {
  id: string;
  name: string;
  size?: number;
  progress: number;
  stage: 'uploading' | 'processing';
}

export function formatBytes(bytes?: number): string {
  if (!bytes || isNaN(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getFileMeta(name: string, size?: number) {
  const parts = (name || '').split('.');
  const ext = parts.length > 1 ? (parts.pop() || '').toLowerCase() : '';
  const sizeText = size ? formatBytes(size) : '';

  if (ext === 'pdf') {
    return {
      type: 'PDF',
      icon: FileText,
      iconColor: 'text-destructive',
      sizeText,
    };
  }
  if (['doc', 'docx'].includes(ext)) {
    return {
      type: 'Word',
      icon: FileText,
      iconColor: 'text-foreground/80',
      sizeText,
    };
  }
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) {
    return {
      type: 'Image',
      icon: FileImage,
      iconColor: 'text-primary',
      sizeText,
    };
  }
  if (['xls', 'xlsx', 'csv'].includes(ext)) {
    return {
      type: 'Sheet',
      icon: FileSpreadsheet,
      iconColor: 'text-foreground/80',
      sizeText,
    };
  }
  if (
    [
      'ts',
      'tsx',
      'js',
      'jsx',
      'json',
      'py',
      'java',
      'cpp',
      'c',
      'go',
      'rs',
      'md',
      'txt',
    ].includes(ext)
  ) {
    return {
      type: 'Code',
      icon: FileCode,
      iconColor: 'text-foreground/80',
      sizeText,
    };
  }
  return {
    type: 'File',
    icon: File,
    iconColor: 'text-muted-foreground',
    sizeText,
  };
}

export const QUICK_ACTIONS = [
  {
    id: 'polish',
    label: 'Academic Polish',
    prompt:
      'Rewrite this text in a rigorous, concise, and formal academic style using standard LaTeX.',
  },
  {
    id: 'fix_latex',
    label: 'Fix LaTeX Errors',
    prompt:
      'Inspect the LaTeX syntax in this selection, fix any syntax or math formula issues, and briefly explain the changes.',
  },
  {
    id: 'explain',
    label: 'Explain Content',
    prompt:
      'Provide a detailed explanation of the mathematical derivation, algorithm, or theoretical concept in this LaTeX snippet.',
  },
  {
    id: 'abstract',
    label: 'Draft Abstract',
    prompt:
      'Based on the current document context, compose a concise, publication-ready academic abstract between 150-250 words.',
  },
  {
    id: 'bibtex',
    label: 'BibTeX Suggestions',
    prompt:
      'Suggest classic references and properly formatted BibTeX citation entries appropriate for this topic.',
  },
];
