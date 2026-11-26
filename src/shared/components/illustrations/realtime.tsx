import React from 'react';
import { ILLUSTRATION_TOKENS as T, type IllustrationProps } from './tokens';

/**
 * Style 4: Minimal Geometric, Orbit & Nodes (Chat, AI Assistant, Experiments).
 */
export function ChatIllustration({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 160 164" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <ellipse cx="80" cy="138" rx="48" ry="8" fill={T.fill.tertiary} opacity="0.65" />
      {/* Secondary bubble */}
      <rect x="54" y="32" width="74" height="44" rx="12" fill={T.fill.secondary} stroke={T.stroke.primary} strokeWidth="1.1" />
      <rect x="66" y="48" width="44" height="4" rx="2" fill={T.fill.quaternary} />
      <rect x="66" y="57" width="30" height="4" rx="2" fill={T.fill.tertiary} />
      {/* Primary foreground bubble */}
      <path
        d="M32 68C32 61.4 37.4 56 44 56H98C104.6 56 110 61.4 110 68V92C110 98.6 104.6 104 98 104H54L40 114V104H44C37.4 104 32 98.6 32 92V68Z"
        fill={T.fill.primary}
        stroke={T.stroke.tertiary}
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
      <circle cx="58" cy="80" r="3.5" fill={T.accent} />
      <circle cx="71" cy="80" r="3.5" fill={T.accent} opacity="0.65" />
      <circle cx="84" cy="80" r="3.5" fill={T.accent} opacity="0.35" />
    </svg>
  );
}

export function AiIllustration({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 160 164" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <ellipse cx="80" cy="138" rx="46" ry="7.5" fill={T.fill.tertiary} opacity="0.6" />
      {/* Subtle orbital rings */}
      <ellipse cx="80" cy="76" rx="50" ry="20" transform="rotate(-24 80 76)" stroke={T.stroke.primary} strokeWidth="1.1" strokeDasharray="4 4" />
      <ellipse cx="80" cy="76" rx="50" ry="20" transform="rotate(24 80 76)" stroke={T.stroke.primary} strokeWidth="1.1" />
      {/* Satellite nodes */}
      <circle cx="38" cy="94" r="4.5" fill={T.fill.primary} stroke={T.stroke.secondary} strokeWidth="1.2" />
      <circle cx="122" cy="58" r="5" fill={T.accentSoft} stroke={T.accent} strokeWidth="1.2" />
      <circle cx="116" cy="98" r="3.5" fill={T.fill.quaternary} />
      {/* Central core */}
      <circle cx="80" cy="76" r="22" fill={T.fill.primary} stroke={T.stroke.tertiary} strokeWidth="1.3" />
      <circle cx="80" cy="76" r="15" fill={T.accentSoft} />
      <path
        d="M80 65L82.6 73.4L91 76L82.6 78.6L80 87L77.4 78.6L69 76L77.4 73.4L80 65Z"
        fill={T.accent}
      />
    </svg>
  );
}

export function ExperimentsIllustration({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 160 164" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <ellipse cx="80" cy="138" rx="50" ry="8" fill={T.fill.tertiary} opacity="0.65" />
      <rect x="28" y="30" width="104" height="82" rx="8" fill={T.fill.primary} stroke={T.stroke.tertiary} strokeWidth="1.25" />
      {/* Grid guidelines */}
      <line x1="42" y1="52" x2="118" y2="52" stroke={T.fill.tertiary} strokeWidth="1" />
      <line x1="42" y1="72" x2="118" y2="72" stroke={T.fill.tertiary} strokeWidth="1" />
      <line x1="42" y1="92" x2="118" y2="92" stroke={T.stroke.primary} strokeWidth="1.1" />
      {/* Metric curve */}
      <path
        d="M44 86C56 84 62 66 76 68C90 70 98 48 114 46"
        stroke={T.accent}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <circle cx="44" cy="86" r="3.5" fill={T.fill.primary} stroke={T.accent} strokeWidth="1.4" />
      <circle cx="76" cy="68" r="3.5" fill={T.fill.primary} stroke={T.accent} strokeWidth="1.4" />
      <circle cx="114" cy="46" r="4.5" fill={T.accent} />
    </svg>
  );
}
