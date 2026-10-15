import type { LucideIcon } from 'lucide-react';
import type React from 'react';

export interface ModuleDef {
  id: string;
  label: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }> | LucideIcon;
  locked?: boolean;
}
