'use client';

/**
 * useTemplateGalleryActions.ts
 *
 * Dedicated hook for TemplateGalleryModal:
 * - Template code application & clipboard copy
 * - Backend project scaffolding with fallback
 * - Encapsulated toast notifications
 */

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { manuscriptService } from '@/features/editor/services/manuscript.service';

export interface UseTemplateGalleryActionsOptions {
  selectedTemplate: any;
  engine: any;
  activeFileTitle?: string;
  projectId?: string;
  previewTab: 'main' | 'bib';
  onClose: () => void;
}

export function useTemplateGalleryActions({
  selectedTemplate,
  engine,
  activeFileTitle,
  projectId,
  previewTab,
  onClose,
}: UseTemplateGalleryActionsOptions) {
  const [isScaffolding, setIsScaffolding] = useState(false);

  const applyTemplate = useCallback(async () => {
    if (!selectedTemplate) return;
    try {
      if (engine) {
        engine.setContent(selectedTemplate.mainTex);
        toast.success(`Applied "${selectedTemplate.name}" to ${activeFileTitle || 'current document'}`);
        onClose();
      } else {
        navigator.clipboard.writeText(selectedTemplate.mainTex);
        toast.success(`Copied "${selectedTemplate.name}" template code to clipboard`);
        onClose();
      }
    } catch {
      toast.error('Could not apply template');
    }
  }, [selectedTemplate, engine, activeFileTitle, onClose]);

  const scaffoldProject = useCallback(async () => {
    if (!selectedTemplate) return;
    if (!projectId) {
      applyTemplate();
      return;
    }
    setIsScaffolding(true);
    try {
      await manuscriptService.templates.scaffold(projectId, selectedTemplate.id);
      toast.success(`Project scaffolded successfully with "${selectedTemplate.name}"!`);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('flux:filetree-updated'));
      }
      onClose();
    } catch (err) {
      console.warn('[TemplateGallery] Backend scaffolding failed, falling back to active file update:', err);
      applyTemplate();
    } finally {
      setIsScaffolding(false);
    }
  }, [selectedTemplate, projectId, applyTemplate, onClose]);

  const copyCode = useCallback(() => {
    if (!selectedTemplate) return;
    const code =
      previewTab === 'bib' && selectedTemplate.bibTex
        ? selectedTemplate.bibTex
        : selectedTemplate.mainTex;
    navigator.clipboard.writeText(code);
    toast.success('Template code copied to clipboard');
  }, [previewTab, selectedTemplate]);

  return {
    isScaffolding,
    applyTemplate,
    scaffoldProject,
    copyCode,
  };
}
