'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { Sparkles, Check } from 'lucide-react';
import { Button, Textarea, Switch, Skeleton } from "@/shared/components/ui";
import { toast } from 'sonner';
import { PageLayout, PageHeader, PageContent } from '@/shared/components/layout';
import { useProjectDetails, useUpdateProject } from '@/features/projects/shell/hooks/use-project';

const DEFAULT_SYSTEM_PROMPT =
  'You are an AI assistant specialized in in-depth scientific research. Provide precise answers adhering strictly to research methodology, always cite reference sources, and format formulas clearly.';

export default function AiPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params?.projectId || '';

  const { data: projectData, isLoading, isError } = useProjectDetails(projectId);
  const updateMutation = useUpdateProject();
  const project = (projectData as any)?.project || projectData;

  // Form states
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
  const [selectedModel, setSelectedModel] = useState('gemini-1.5-pro');
  const [enableRAG, setEnableRAG] = useState(true);
  const [contributorCanDraft, setContributorCanDraft] = useState(true);
  const [commenterFactCheck, setCommenterFactCheck] = useState(true);
  const [viewerSummaryOnly, setViewerSummaryOnly] = useState(true);

  // Sync from server settings
  useEffect(() => {
    if (project?.settings?.ai) {
      const ai = project.settings.ai;
      if (typeof ai.systemPrompt === 'string') setSystemPrompt(ai.systemPrompt);
      if (typeof ai.selectedModel === 'string') setSelectedModel(ai.selectedModel);
      if (typeof ai.enableRAG === 'boolean') setEnableRAG(ai.enableRAG);
      if (typeof ai.contributorCanDraft === 'boolean') setContributorCanDraft(ai.contributorCanDraft);
      if (typeof ai.commenterFactCheck === 'boolean') setCommenterFactCheck(ai.commenterFactCheck);
      if (typeof ai.viewerSummaryOnly === 'boolean') setViewerSummaryOnly(ai.viewerSummaryOnly);
    }
  }, [project?.settings?.ai]);

  const hasChanges = useMemo(() => {
    const ai = project?.settings?.ai || {};
    return (
      systemPrompt !== (ai.systemPrompt ?? DEFAULT_SYSTEM_PROMPT) ||
      selectedModel !== (ai.selectedModel ?? 'gemini-1.5-pro') ||
      enableRAG !== (ai.enableRAG ?? true) ||
      contributorCanDraft !== (ai.contributorCanDraft ?? true) ||
      commenterFactCheck !== (ai.commenterFactCheck ?? true) ||
      viewerSummaryOnly !== (ai.viewerSummaryOnly ?? true)
    );
  }, [project, systemPrompt, selectedModel, enableRAG, contributorCanDraft, commenterFactCheck, viewerSummaryOnly]);

  const handleSave = () => {
    const existingSettings = (project?.settings as any) || {};
    const newSettings = {
      ...existingSettings,
      ai: {
        systemPrompt,
        selectedModel,
        enableRAG,
        contributorCanDraft,
        commenterFactCheck,
        viewerSummaryOnly,
      },
    };

    updateMutation.mutate(
      {
        projectId,
        settings: newSettings,
      } as any,
      {
        onSuccess: () => toast.success('AI configuration saved', { id: 'settings-ai' }),
        onError: (err: any) => toast.error(err?.message || 'Failed to save AI configuration', { id: 'settings-ai' }),
      },
    );
  };

  if (isLoading) {
    return (
      <PageLayout>
        <PageHeader title="AI Assistant" icon={Sparkles} />
        <PageContent maxWidth="md">
          <div className="space-y-6">
            <Skeleton className="h-44 w-full rounded-md" />
            <Skeleton className="h-44 w-full rounded-md" />
          </div>
        </PageContent>
      </PageLayout>
    );
  }

  if (isError || !project) {
    return (
      <PageLayout>
        <PageHeader title="AI Assistant" icon={Sparkles} />
        <PageContent maxWidth="md">
          <div className="text-sm text-muted-foreground">
            Error loading project AI settings.
          </div>
        </PageContent>
      </PageLayout>
    );
  }

  const topBarActions = (
    <Button
      size="sm"
      onClick={handleSave}
      disabled={!hasChanges || updateMutation.isPending}
      className="h-8 text-xs font-medium px-3.5 rounded-md bg-primary hover:bg-primary-hover text-primary-foreground cursor-pointer shadow-none shrink-0"
    >
      Save settings
    </Button>
  );

  return (
    <PageLayout>
      <PageHeader
        title="AI Assistant"
        icon={Sparkles}
        actions={topBarActions}
      />

      <PageContent maxWidth="md">
        <div className="space-y-6">
          {/* ── Section 1: Research System Prompt ── */}
          <div className="space-y-4">
            <div className="pb-3 border-b border-border">
              <h2 className="text-14 font-semibold text-foreground">Research Context & System Prompt</h2>
              <p className="text-12 text-muted-foreground mt-0.5">
                Instruct the assistant on domain terminology, research scope, and preferred citation style.
              </p>
            </div>

            <Textarea
              rows={4}
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="Enter custom research guidance for the AI assistant..."
              className="text-13 rounded-md border-border bg-background focus:ring-1 focus:ring-primary resize-y"
            />

            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-11 text-muted-foreground mr-1">Suggested scopes:</span>
              {['Deep Learning', 'Computer Vision', 'NLP', 'Biomedical', 'Literature Review'].map((scope) => (
                <button
                  key={scope}
                  type="button"
                  onClick={() => setSystemPrompt((prev) => `${prev} Research scope: ${scope}.`)}
                  className="text-11 px-2 py-0.5 rounded border border-border bg-background hover:bg-muted text-foreground transition-colors cursor-pointer"
                >
                  + {scope}
                </button>
              ))}
            </div>
          </div>

          {/* ── Section 2: Model & Reasoning Engine ── */}
          <div className="space-y-4 pt-6">
            <div className="pb-3 border-b border-border">
              <h2 className="text-14 font-semibold text-foreground">Model & Inference Engine</h2>
              <p className="text-12 text-muted-foreground mt-0.5">
                Choose the foundation LLM suited for paper analysis and technical synthesis.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', desc: '1M token context, best for long papers & datasets' },
                { id: 'gpt-4o', name: 'GPT-4o', desc: 'Omni model, strong technical reasoning & code generation' },
                { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', desc: 'Superior academic writing & manuscript editing' },
              ].map((m) => {
                const isSelected = selectedModel === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSelectedModel(m.id)}
                    className={`flex flex-col text-left p-3.5 rounded-md border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-primary bg-primary/5 ring-1 ring-primary'
                        : 'border-border bg-background hover:bg-muted/50'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-13 font-semibold text-foreground">{m.name}</span>
                      {isSelected && <Check className="size-4 text-primary shrink-0" />}
                    </div>
                    <span className="text-11 text-muted-foreground mt-1.5 leading-relaxed">
                      {m.desc}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-border">
              <div className="space-y-0.5">
                <span className="text-13 font-medium text-foreground">Project RAG Knowledge Indexing</span>
                <p className="text-11 text-muted-foreground">
                  Automatically index project attachments, papers, and manuscripts into vector context.
                </p>
              </div>
              <Switch checked={enableRAG} onCheckedChange={setEnableRAG} />
            </div>
          </div>

          {/* ── Section 3: Role-based AI Permissions ── */}
          <div className="space-y-4 pt-6">
            <div className="pb-3 border-b border-border">
              <h2 className="text-14 font-semibold text-foreground">Role Permissions for Virtual Assistant</h2>
              <p className="text-12 text-muted-foreground mt-0.5">
                Define what capabilities each actor role can invoke with the AI assistant.
              </p>
            </div>

            <div className="divide-y divide-border">
              <div className="flex items-center justify-between py-3">
                <div className="space-y-0.5 pr-4">
                  <span className="text-13 font-medium text-foreground">
                    Contributor: AI Code & Paper Draft Generation
                  </span>
                  <p className="text-11 text-muted-foreground">
                    Allow researchers to invoke AI code scaffolding and manuscript section drafting.
                  </p>
                </div>
                <Switch checked={contributorCanDraft} onCheckedChange={setContributorCanDraft} />
              </div>

              <div className="flex items-center justify-between py-3">
                <div className="space-y-0.5 pr-4">
                  <span className="text-13 font-medium text-foreground">
                    Commenter (Supervisor): AI Review & Fact-Check Tool
                  </span>
                  <p className="text-11 text-muted-foreground">
                    Equip supervisors with one-click AI audit to check paper claims against references.
                  </p>
                </div>
                <Switch checked={commenterFactCheck} onCheckedChange={setCommenterFactCheck} />
              </div>

              <div className="flex items-center justify-between py-3">
                <div className="space-y-0.5 pr-4">
                  <span className="text-13 font-medium text-foreground">
                    Viewer (Evaluation Board): Executive Summary Only
                  </span>
                  <p className="text-11 text-muted-foreground">
                    Restrict external council members to read-only synthesized progress reports.
                  </p>
                </div>
                <Switch checked={viewerSummaryOnly} onCheckedChange={setViewerSummaryOnly} />
              </div>
            </div>
          </div>
        </div>
      </PageContent>
    </PageLayout>
  );
}
