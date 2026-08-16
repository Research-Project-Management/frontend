import type { LucideIcon } from 'lucide-react';

export interface ModuleDef {
  id: string;
  label: string;
  desc: string;
  icon: LucideIcon;
  locked?: boolean;
}
