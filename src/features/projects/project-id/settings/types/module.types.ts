import type { LucideIcon } from 'lucide-react';
import type React from 'react';

export interface ModuleDef {
  id: string;
  label: string;
  desc: string;
  icon: React.ComponentType<any>;
  locked?: boolean;
}
