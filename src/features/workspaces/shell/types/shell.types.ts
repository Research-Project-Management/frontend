// ── Shell types ───────────────────────────────────────────────────────────────

export type NavItem = {
  label: string;
  to: string;
  icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  imageSrc?: string;
};
