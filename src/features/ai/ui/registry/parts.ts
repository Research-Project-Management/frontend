import type React from 'react';
import type { HitlDecision, MessagePart } from '../../types/message';

export type PartRendererProps = {
  part: MessagePart;
  compact?: boolean;
  onResumeHitl?: (decisions: HitlDecision[]) => void | Promise<void>;
};

export type PartRenderer = React.ComponentType<PartRendererProps>;

const customPartRegistry = new Map<MessagePart['type'], PartRenderer>();

export function registerPartRenderer(
  type: MessagePart['type'],
  component: PartRenderer,
): void {
  customPartRegistry.set(type, component);
}

export function getPartRenderer(
  type: MessagePart['type'],
): PartRenderer | undefined {
  return customPartRegistry.get(type);
}
