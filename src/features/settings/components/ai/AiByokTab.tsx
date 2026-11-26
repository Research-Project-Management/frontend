'use client';

import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, ShieldCheck, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  getUserSettings,
  updateAiByokSettings,
  type UpdateAiByokPayload,
} from '../../services/profile.service';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Switch } from '@/shared/components/ui/switch';
import { getErrorMessage } from '@/shared/lib/utils';

const AI_PROVIDER_PRESETS: Record<
  string,
  { label: string; baseUrl: string; defaultModel: string; placeholderKey: string }
> = {
  openai: {
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o',
    placeholderKey: 'sk-proj-...',
  },
  openrouter: {
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'anthropic/claude-3.7-sonnet',
    placeholderKey: 'sk-or-v1-...',
  },
  groq: {
    label: 'Groq Cloud',
    baseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'openai/gpt-oss-120b',
    placeholderKey: 'gsk_...',
  },
  deepseek: {
    label: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    placeholderKey: 'sk-...',
  },
  custom: {
    label: 'Custom OpenAI-Compatible',
    baseUrl: '',
    defaultModel: '',
    placeholderKey: 'sk-...',
  },
};

const DEFAULT_BYOK_PROVIDER = 'openai';

export function AiByokTab() {
  const queryClient = useQueryClient();
  const defaultPreset = AI_PROVIDER_PRESETS[DEFAULT_BYOK_PROVIDER];

  const [byokEnabled, setByokEnabled] = useState(false);
  const [byokProvider, setByokProvider] = useState(DEFAULT_BYOK_PROVIDER);
  const [byokModel, setByokModel] = useState(defaultPreset.defaultModel);
  const [byokBaseUrl, setByokBaseUrl] = useState(defaultPreset.baseUrl);
  const [byokApiKeyInput, setByokApiKeyInput] = useState('');

  const { data: userSettingsData } = useQuery({
    queryKey: ['user', 'settings'],
    queryFn: getUserSettings,
  });

  const savedByok = userSettingsData?.settings?.editorConfig?.aiByok;

  useEffect(() => {
    if (!savedByok) return;
    const prov = savedByok.provider || 'openai';
    const preset = AI_PROVIDER_PRESETS[prov] ?? AI_PROVIDER_PRESETS.openai;
    setByokEnabled(Boolean(savedByok.enabled));
    setByokProvider(prov);
    setByokModel(savedByok.model || preset.defaultModel);
    setByokBaseUrl(savedByok.baseUrl || preset.baseUrl);
  }, [savedByok]);

  const { mutate: mutateByok, isPending: isByokSaving } = useMutation({
    mutationFn: (payload: UpdateAiByokPayload) => updateAiByokSettings(payload),
    onSuccess: (res) => {
      queryClient.setQueryData(['user', 'settings'], res);
      setByokApiKeyInput('');
      toast.success('AI settings saved');
    },
    onError: (err: unknown) => {
      toast.error(getErrorMessage(err) || 'Failed to save AI settings');
    },
  });

  const handleProviderChange = useCallback((nextProvider: string) => {
    setByokProvider(nextProvider);
    const preset = AI_PROVIDER_PRESETS[nextProvider];
    if (preset) {
      setByokBaseUrl(preset.baseUrl);
      if (preset.defaultModel) {
        setByokModel(preset.defaultModel);
      }
    }
  }, []);

  const handleSaveByok = useCallback(() => {
    mutateByok({
      enabled: byokEnabled,
      provider: byokProvider,
      model: byokModel.trim(),
      baseUrl: byokBaseUrl.trim(),
      ...(byokApiKeyInput.trim() ? { apiKey: byokApiKeyInput.trim() } : {}),
    });
  }, [mutateByok, byokEnabled, byokProvider, byokModel, byokBaseUrl, byokApiKeyInput]);

  const handleClearByokKey = useCallback(() => {
    mutateByok({
      enabled: false,
      provider: byokProvider,
      model: byokModel.trim(),
      baseUrl: byokBaseUrl.trim(),
      clearApiKey: true,
    });
  }, [mutateByok, byokProvider, byokModel, byokBaseUrl]);

  return (
    <div className="w-full max-w-[780px] mx-auto py-8 px-6 pb-20">
      <div className="space-y-1">
        <div className="pb-3 border-b border-border flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <KeyRound className="size-4 text-foreground" />
              <h3 className="text-14 font-semibold text-foreground tracking-tight">
                Personal API Key
              </h3>
            </div>
            <p className="text-12 text-muted-foreground mt-1">
              Connect your own AI provider to use your preferred model and personal usage limits across Flux AI.
            </p>
          </div>
          {savedByok?.hasApiKey && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-0.5 text-11 font-medium text-success border border-success/20 shrink-0">
              <ShieldCheck className="size-3.5" />
              Key Saved ({savedByok.apiKeyHint})
            </span>
          )}
        </div>

        <div className="divide-y divide-border">
          {/* Enable BYOK toggle */}
          <div className="flex items-center justify-between py-3.5 gap-4">
            <div className="flex flex-col min-w-0 pr-2">
              <span className="text-13 font-medium text-foreground">
                Use Personal API Key
              </span>
              <span className="text-12 text-muted-foreground mt-0.5">
                Use your own API key instead of Flux&apos;s default AI quota.
              </span>
            </div>
            <Switch
              checked={byokEnabled}
              onCheckedChange={setByokEnabled}
              aria-label="Toggle personal API key"
              className="shrink-0"
            />
          </div>

          {/* Provider Preset */}
          <div className="flex items-center justify-between py-3.5 gap-4">
            <div className="flex flex-col min-w-0 pr-2">
              <span className="text-13 font-medium text-foreground">Provider</span>
              <span className="text-12 text-muted-foreground mt-0.5">
                Choose your AI provider, or select Custom for any OpenAI-compatible endpoint.
              </span>
            </div>
            <Select value={byokProvider} onValueChange={handleProviderChange}>
              <SelectTrigger
                aria-label="Select AI Provider"
                className="w-[220px] h-8 text-12 bg-background border border-border rounded-md shrink-0 cursor-pointer"
              >
                <SelectValue placeholder="Select Provider" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(AI_PROVIDER_PRESETS).map(([key, item]) => (
                  <SelectItem key={key} value={key}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Model Identifier */}
          <div className="flex items-center justify-between py-3.5 gap-4">
            <div className="flex flex-col min-w-0 pr-2">
              <span className="text-13 font-medium text-foreground">Model</span>
              <span className="text-12 text-muted-foreground mt-0.5">
                Model ID used for AI responses (e.g. gpt-4o, claude-3.7-sonnet).
              </span>
            </div>
            <Input
              value={byokModel}
              onChange={(e) => setByokModel(e.target.value)}
              placeholder="gpt-4o"
              aria-label="Model"
              className="w-[220px] h-8 text-12 bg-background"
            />
          </div>

          {/* Base URL (only shown for Custom OpenAI-Compatible) */}
          {byokProvider === 'custom' && (
            <div className="flex items-center justify-between py-3.5 gap-4">
              <div className="flex flex-col min-w-0 pr-2">
                <span className="text-13 font-medium text-foreground">API Base URL</span>
                <span className="text-12 text-muted-foreground mt-0.5">
                  Endpoint URL for your OpenAI-compatible provider (must start with https://).
                </span>
              </div>
              <Input
                value={byokBaseUrl}
                onChange={(e) => setByokBaseUrl(e.target.value)}
                placeholder="https://api.openai.com/v1"
                aria-label="API Base URL"
                className="w-[220px] h-8 text-12 bg-background"
              />
            </div>
          )}

          {/* API Key Input */}
          <div className="flex items-center justify-between py-3.5 gap-4">
            <div className="flex flex-col min-w-0 pr-2">
              <span className="text-13 font-medium text-foreground">API Key</span>
              <span className="text-12 text-muted-foreground mt-0.5">
                {savedByok?.hasApiKey
                  ? `Saved key: ${savedByok.apiKeyHint}. Leave blank to keep it, or enter a new key to replace it.`
                  : 'Your secret API key. Stored securely and encrypted.'}
              </span>
            </div>
            <Input
              type="password"
              value={byokApiKeyInput}
              onChange={(e) => setByokApiKeyInput(e.target.value)}
              placeholder={
                savedByok?.hasApiKey
                  ? savedByok.apiKeyHint
                  : (AI_PROVIDER_PRESETS[byokProvider]?.placeholderKey ?? 'sk-...')
              }
              aria-label="Personal AI API Key"
              autoComplete="off"
              className="w-[220px] h-8 text-12 bg-background font-mono"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-4">
            {savedByok?.hasApiKey && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleClearByokKey}
                disabled={isByokSaving}
                className="h-8 text-12 text-destructive hover:text-destructive"
              >
                <Trash2 className="size-3.5 mr-1.5" />
                Remove Key
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              onClick={handleSaveByok}
              disabled={isByokSaving}
              className="h-8 text-12"
            >
              {isByokSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AiByokTab;
