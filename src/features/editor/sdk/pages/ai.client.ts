/**
 * ai.client.ts
 *
 * Client-side LaTeX error remediation and AI authoring helpers.
 */

import { apiPost } from '@/shared/lib/api';
import { usePageStore } from '@/features/editor/core/store/editor.store';
import {
  fixLatexError,
  type AiErrorFixParams,
  type AiErrorFixResult,
} from '@/features/editor/domain/ai/ai-error-assist';

export type { AiErrorFixParams, AiErrorFixResult };

export interface AiLatexGenerationOptions {
  spaceId?: string;
  pageId?: string;
  image?: File | Blob | null;
}

interface SyncChatResponseDto {
  role?: string;
  content?: string;
  widgets?: Array<{
    type?: string;
    patches?: Array<{ replaceText?: string }>;
  }>;
}

export function stripLatexCodeFences(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';

  const fencedMatch = trimmed.match(/```(?:latex|tex|math)?\s*\r?\n?([\s\S]*?)```/i);
  if (fencedMatch && fencedMatch[1] !== undefined) {
    return fencedMatch[1].trim();
  }

  return trimmed
    .replace(/^```(?:latex|tex|math)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
}

async function blobToDataUrl(blob: File | Blob): Promise<{
  dataUrl: string;
  mimeType: string;
  name: string;
}> {
  const mimeType = blob.type || 'image/png';
  const name = blob instanceof File && blob.name ? blob.name : 'attachment.png';

  if (typeof FileReader !== 'undefined') {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error || new Error('Failed to read image file'));
      reader.readAsDataURL(blob);
    });
    return { dataUrl, mimeType, name };
  }

  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = typeof btoa === 'function' ? btoa(binary) : Buffer.from(bytes).toString('base64');
  return { dataUrl: `data:${mimeType};base64,${base64}`, mimeType, name };
}

function resolveAiContextIds(options?: AiLatexGenerationOptions): {
  spaceId: string;
  pageId?: string;
} {
  const pageState =
    typeof usePageStore?.getState === 'function' ? usePageStore.getState() : undefined;
  const spaceId =
    options?.spaceId?.trim() ||
    pageState?.spaceId?.trim() ||
    pageState?.projectId?.trim() ||
    'personal';
  const pageId =
    options?.pageId?.trim() ||
    pageState?.rootPageId?.trim() ||
    pageState?.parentPageId?.trim() ||
    pageState?.currentPage?.id ||
    undefined;
  return { spaceId, pageId };
}

async function executeSyncLatexPrompt(params: {
  systemInstruction: string;
  userPrompt: string;
  options?: AiLatexGenerationOptions;
}): Promise<string> {
  const { spaceId, pageId } = resolveAiContextIds(params.options);
  const imagePayload = params.options?.image
    ? await blobToDataUrl(params.options.image)
    : null;

  const userContent = [
    params.userPrompt.trim(),
    imagePayload ? `[Attached image: ${imagePayload.name}]` : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  if (!userContent) {
    throw new Error('A prompt or reference image is required.');
  }

  const attachments = imagePayload
    ? [
        {
          type: 'image_url',
          name: imagePayload.name,
          mimeType: imagePayload.mimeType,
          url: imagePayload.dataUrl,
          dataUrl: imagePayload.dataUrl,
        },
      ]
    : undefined;

  const res = await apiPost<SyncChatResponseDto>('/api/ai/editor-chat/sync', {
    spaceId,
    ...(pageId ? { pageId } : {}),
    intentHint: 'direct',
    messages: [
      {
        role: 'system',
        content: params.systemInstruction,
      },
      {
        role: 'user',
        content: userContent,
        ...(attachments ? { attachments } : {}),
      },
    ],
    ...(imagePayload
      ? {
          context: {
            image_data_url: imagePayload.dataUrl,
            attachments,
          },
        }
      : {}),
  });

  const rawContent =
    res?.content?.trim() ||
    res?.widgets
      ?.find((w) => w?.type === 'editor_patches')
      ?.patches?.map((p) => p?.replaceText || '')
      .filter(Boolean)
      .join('\n') ||
    '';

  return stripLatexCodeFences(rawContent);
}

/**
 * Suggest a fix for a LaTeX compilation error using client-side heuristics.
 */
export async function suggestLatexFix(
  params: AiErrorFixParams,
): Promise<AiErrorFixResult> {
  return fixLatexError(params);
}

/**
 * Generate a publication-grade LaTeX table via `/api/ai/editor-chat/sync`.
 */
export async function generateLatexTable(
  prompt: string,
  options?: AiLatexGenerationOptions,
): Promise<string> {
  return executeSyncLatexPrompt({
    systemInstruction:
      'You are an expert academic LaTeX typesetter. Return ONLY valid, compilable LaTeX table code (such as \\begin{table}...\\begin{tabular}...\\end{tabular}...\\end{table}) with no surrounding commentary or markdown prose.',
    userPrompt:
      prompt.trim() ||
      'Transcribe the attached image into a clean, compilable LaTeX table.',
    options,
  });
}

/**
 * Generate a publication-grade LaTeX equation via `/api/ai/editor-chat/sync`.
 */
export async function generateLatexEquation(
  prompt: string,
  options?: AiLatexGenerationOptions,
): Promise<string> {
  return executeSyncLatexPrompt({
    systemInstruction:
      'You are an expert mathematical LaTeX typesetter. Return ONLY valid, compilable LaTeX equation code (e.g. \\begin{equation}...\\end{equation} or raw math expression) with no surrounding commentary or markdown prose.',
    userPrompt:
      prompt.trim() ||
      'Transcribe the attached formula image into clean, compilable LaTeX equation code.',
    options,
  });
}

export const ai = {
  suggestLatexFix,
  generateLatexTable,
  generateLatexEquation,
  stripLatexCodeFences,
};
