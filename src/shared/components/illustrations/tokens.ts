export interface IllustrationProps {
  className?: string;
}

/**
 * Shared CSS custom property references for all Flux Empty & Error illustrations.
 * Backed by `:root` and `.dark` tokens in `src/shared/styles/globals.css`.
 */
export const ILLUSTRATION_TOKENS = {
  fill: {
    primary: 'var(--illustration-fill-primary, #FFFFFF)',
    secondary: 'var(--illustration-fill-secondary, #F4F5F5)',
    tertiary: 'var(--illustration-fill-tertiary, #EAEBEB)',
    quaternary: 'var(--illustration-fill-quaternary, #CFD2D3)',
  },
  stroke: {
    primary: 'var(--illustration-stroke-primary, #CFD2D3)',
    secondary: 'var(--illustration-stroke-secondary, #8A9093)',
    tertiary: 'var(--illustration-stroke-tertiary, #1D1F20)',
  },
  accent: 'var(--illustration-accent, #2563EB)',
  accentSoft: 'var(--illustration-accent-soft, rgba(37, 99, 235, 0.14))',
} as const;
