'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import { Sparkles, Bot, Save, Check, Loader2 } from 'lucide-react';
import { Button, Input, Textarea, Switch } from "@/shared/components/ui";
import { toast } from 'sonner';

export default function AiPage() {
  const params = useParams();
  const [isSaving, setIsSaving] = useState(false);

  // Form states
  const [systemPrompt, setSystemPrompt] = useState(
    'Bạn là trợ lý ảo hỗ trợ nghiên cứu khoa học chuyên sâu. Trả lời chính xác, bám sát phương pháp luận, luôn trích dẫn nguồn tài liệu tham khảo và định dạng công thức rõ ràng.'
  );
  const [selectedModel, setSelectedModel] = useState('gemini-1.5-pro');
  const [enableRAG, setEnableRAG] = useState(true);
  const [contributorCanDraft, setContributorCanDraft] = useState(true);
  const [commenterFactCheck, setCommenterFactCheck] = useState(true);
  const [viewerSummaryOnly, setViewerSummaryOnly] = useState(true);

  const handleSave = async () => {
    setIsSaving(true);
    // Simulate save or persist to project settings
    setTimeout(() => {
      setIsSaving(false);
      toast.success('AI configuration saved');
    }, 400);
  };

  return (
    <div className="max-w-5xl mx-auto p-6 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">
            AI
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure the virtual assistant context, model selection, and permissions for this project.
          </p>
        </div>

        <Button
          size="sm"
          onClick={handleSave}
          disabled={isSaving}
          className="h-8 text-xs font-medium px-3.5 rounded-md bg-primary hover:bg-primary-hover text-primary-foreground cursor-pointer shadow-none shrink-0"
        >
          {isSaving ? (
            <Loader2 className="mr-1.5 size-3.5 animate-spin shrink-0" />
          ) : (
            <Save className="mr-1.5 size-3.5 shrink-0" />
          )}
          Save settings
        </Button>
      </div>

      {/* ── Section 1: Research System Prompt ── */}
      <div className="rounded-md border border-border bg-card p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Research Context & System Prompt</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
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
              onClick={() => setSystemPrompt((prev) => `${prev} Phạm vi nghiên cứu: ${scope}.`)}
              className="text-11 px-2 py-0.5 rounded border border-border bg-background hover:bg-muted text-foreground transition-colors cursor-pointer"
            >
              + {scope}
            </button>
          ))}
        </div>
      </div>

      {/* ── Section 2: Model & Reasoning Engine ── */}
      <div className="rounded-md border border-border bg-card p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Model & Inference Engine</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
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
      <div className="rounded-md border border-border bg-card p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Role Permissions for Virtual Assistant</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Define what capabilities each actor role can invoke with the AI assistant.
          </p>
        </div>

        <div className="divide-y divide-border/60">
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
  );
}
