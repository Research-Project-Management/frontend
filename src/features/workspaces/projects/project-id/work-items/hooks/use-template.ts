'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { TemplateService } from '../services/template.service';

export const templateKeys = {
  all: ['templates'] as const,
  project: (projectId: string) => ['templates', projectId] as const,
  detail: (projectId: string, id: string) => ['template', projectId, id] as const,
};

export const useTemplatesQuery = (projectId: string) =>
  useQuery({
    queryKey: templateKeys.project(projectId),
    queryFn: () => TemplateService.getTemplates(projectId),
    enabled: Boolean(projectId),
  });

export const useCreateTemplateMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      data,
    }: {
      projectId: string;
      data: {
        name: string;
        description?: string;
        title?: string;
        content?: string;
        priority?: string;
        labels?: string[];
        defaultCycleId?: string;
        defaultColumnId?: string;
        isShared?: boolean;
      };
    }) => TemplateService.createTemplate(projectId, data),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: templateKeys.project(vars.projectId) });
      toast.success('Template saved');
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to save template'),
  });
};

export const useInstantiateTemplateMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      templateId,
      overrides,
    }: {
      projectId: string;
      templateId: string;
      overrides?: Record<string, unknown>;
    }) => TemplateService.instantiateTemplate(projectId, templateId, { overrides }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-items'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Work item created from template');
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to instantiate template'),
  });
};

export const useDeleteTemplateMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, templateId }: { projectId: string; templateId: string }) =>
      TemplateService.deleteTemplate(projectId, templateId),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: templateKeys.project(vars.projectId) });
      toast.success('Template deleted');
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to delete template'),
  });
};
