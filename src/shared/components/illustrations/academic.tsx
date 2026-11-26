import React from 'react';
import { ILLUSTRATION_TOKENS as T, type IllustrationProps } from './tokens';

/**
 * Style 2: Layered Paper & Card Fan (Academic Documents, Library, Citations, Editor, Review, History, Logs).
 */
export function DocumentIllustration({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 160 164" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <ellipse cx="80" cy="140" rx="48" ry="8" fill={T.fill.tertiary} opacity="0.65" />
      <g transform="rotate(-7 80 82)">
        <rect x="42" y="28" width="68" height="92" rx="7" fill={T.fill.secondary} stroke={T.stroke.primary} strokeWidth="1.1" />
      </g>
      <g transform="rotate(4 80 82)">
        <rect x="48" y="26" width="68" height="92" rx="7" fill={T.fill.primary} stroke={T.stroke.tertiary} strokeWidth="1.25" />
        <rect x="60" y="42" width="28" height="5" rx="2.5" fill={T.accent} opacity="0.85" />
        <rect x="60" y="55" width="44" height="4" rx="2" fill={T.fill.quaternary} />
        <rect x="60" y="65" width="40" height="4" rx="2" fill={T.fill.quaternary} />
        <rect x="60" y="75" width="34" height="4" rx="2" fill={T.fill.tertiary} />
        <rect x="60" y="90" width="44" height="14" rx="3.5" fill={T.fill.secondary} stroke={T.stroke.primary} strokeWidth="0.9" />
      </g>
    </svg>
  );
}

export function PdfPreviewIllustration({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 160 164" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <ellipse cx="80" cy="140" rx="48" ry="8" fill={T.fill.tertiary} opacity="0.65" />
      <rect x="44" y="24" width="72" height="98" rx="8" fill={T.fill.primary} stroke={T.stroke.tertiary} strokeWidth="1.25" />
      {/* Corner fold */}
      <path d="M96 24V40C96 42.2 97.8 44 100 44H116" fill={T.fill.secondary} stroke={T.stroke.primary} strokeWidth="1.1" />
      {/* PDF ribbon */}
      <rect x="34" y="44" width="42" height="18" rx="4" fill={T.accentSoft} stroke={T.accent} strokeWidth="1.1" />
      <text x="55" y="56.5" textAnchor="middle" fill={T.accent} fontSize="9.5" fontWeight="600" fontFamily="var(--font-mono), monospace">
        PDF
      </text>
      <rect x="56" y="74" width="48" height="4" rx="2" fill={T.fill.quaternary} />
      <rect x="56" y="84" width="42" height="4" rx="2" fill={T.fill.quaternary} />
      <rect x="56" y="94" width="36" height="4" rx="2" fill={T.fill.tertiary} />
      <rect x="56" y="104" width="26" height="4" rx="2" fill={T.fill.tertiary} />
    </svg>
  );
}

export function DetachedWindowIllustration({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 160 164" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <ellipse cx="80" cy="138" rx="52" ry="8" fill={T.fill.tertiary} opacity="0.6" />
      {/* Background main window */}
      <rect x="24" y="42" width="74" height="66" rx="7" fill={T.fill.secondary} stroke={T.stroke.primary} strokeWidth="1.15" />
      <line x1="24" y1="56" x2="98" y2="56" stroke={T.stroke.primary} strokeWidth="1" />
      <circle cx="33" cy="49" r="2" fill={T.stroke.secondary} />
      <circle cx="40" cy="49" r="2" fill={T.fill.quaternary} />
      {/* Popped-out window */}
      <rect x="66" y="24" width="70" height="68" rx="7" fill={T.fill.primary} stroke={T.stroke.tertiary} strokeWidth="1.25" />
      <line x1="66" y1="38" x2="136" y2="38" stroke={T.stroke.primary} strokeWidth="1" />
      <circle cx="75" cy="31" r="2" fill={T.accent} />
      <rect x="76" y="48" width="50" height="32" rx="4" fill={T.accentSoft} stroke={T.accent} strokeWidth="0.9" />
      {/* Pop-out arrow */}
      <path d="M97 68L107 58M107 58H100M107 58V65" stroke={T.accent} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function LibraryIllustration({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 160 164" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <ellipse cx="80" cy="140" rx="52" ry="8" fill={T.fill.tertiary} opacity="0.65" />
      {/* Fanned back cards */}
      <g transform="rotate(-11 80 96)">
        <rect x="44" y="32" width="66" height="86" rx="7" fill={T.fill.tertiary} stroke={T.stroke.primary} strokeWidth="1" />
      </g>
      <g transform="rotate(10 80 96)">
        <rect x="50" y="32" width="66" height="86" rx="7" fill={T.fill.secondary} stroke={T.stroke.primary} strokeWidth="1.1" />
      </g>
      {/* Front research paper card */}
      <rect x="46" y="28" width="68" height="90" rx="7" fill={T.fill.primary} stroke={T.stroke.tertiary} strokeWidth="1.25" />
      {/* Bookmark ribbon */}
      <path d="M94 28V50L100 45.5L106 50V28H94Z" fill={T.accentSoft} stroke={T.accent} strokeWidth="1.1" strokeLinejoin="round" />
      <rect x="56" y="44" width="28" height="4.5" rx="2.25" fill={T.stroke.secondary} />
      <rect x="56" y="56" width="46" height="3.5" rx="1.75" fill={T.fill.quaternary} />
      <rect x="56" y="65" width="42" height="3.5" rx="1.75" fill={T.fill.quaternary} />
      <rect x="56" y="74" width="34" height="3.5" rx="1.75" fill={T.fill.tertiary} />
      <rect x="56" y="90" width="20" height="14" rx="3" fill={T.fill.secondary} stroke={T.stroke.primary} strokeWidth="0.9" />
      <rect x="80" y="90" width="24" height="14" rx="3" fill={T.fill.secondary} stroke={T.stroke.primary} strokeWidth="0.9" />
    </svg>
  );
}

export function CitationsIllustration({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 160 164" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <ellipse cx="80" cy="138" rx="50" ry="8" fill={T.fill.tertiary} opacity="0.65" />
      <rect x="34" y="42" width="92" height="68" rx="8" fill={T.fill.secondary} stroke={T.stroke.primary} strokeWidth="1.1" />
      <rect x="42" y="30" width="84" height="68" rx="8" fill={T.fill.primary} stroke={T.stroke.tertiary} strokeWidth="1.25" />
      {/* Quote mark badge */}
      <circle cx="52" cy="40" r="14" fill={T.fill.primary} stroke={T.accent} strokeWidth="1.25" />
      <text x="52" y="46" textAnchor="middle" fill={T.accent} fontSize="18" fontWeight="600" fontFamily="Georgia, serif">
        “
      </text>
      <rect x="72" y="44" width="40" height="4.5" rx="2.25" fill={T.stroke.secondary} />
      <rect x="54" y="60" width="58" height="4" rx="2" fill={T.fill.quaternary} />
      <rect x="54" y="70" width="48" height="4" rx="2" fill={T.fill.quaternary} />
      <rect x="54" y="80" width="32" height="4" rx="2" fill={T.fill.tertiary} />
    </svg>
  );
}

export function ReviewIllustration({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 160 164" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <ellipse cx="80" cy="138" rx="50" ry="8" fill={T.fill.tertiary} opacity="0.65" />
      <rect x="36" y="28" width="76" height="90" rx="7" fill={T.fill.primary} stroke={T.stroke.tertiary} strokeWidth="1.25" />
      <rect x="48" y="44" width="44" height="4" rx="2" fill={T.fill.quaternary} />
      <rect x="48" y="55" width="52" height="8" rx="2.5" fill={T.accentSoft} />
      <rect x="48" y="70" width="48" height="4" rx="2" fill={T.fill.quaternary} />
      <rect x="48" y="80" width="36" height="4" rx="2" fill={T.fill.tertiary} />
      {/* Floating comment chip */}
      <rect x="78" y="70" width="54" height="36" rx="7" fill={T.fill.primary} stroke={T.accent} strokeWidth="1.2" />
      <rect x="88" y="82" width="34" height="3.5" rx="1.75" fill={T.stroke.secondary} />
      <rect x="88" y="90" width="24" height="3.5" rx="1.75" fill={T.fill.quaternary} />
    </svg>
  );
}

export function HistoryIllustration({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 160 164" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <ellipse cx="80" cy="138" rx="48" ry="8" fill={T.fill.tertiary} opacity="0.65" />
      {/* Vertical timeline rail */}
      <line x1="46" y1="30" x2="46" y2="116" stroke={T.stroke.primary} strokeWidth="1.5" strokeDasharray="3 3" />
      <circle cx="46" cy="40" r="5" fill={T.accent} />
      <circle cx="46" cy="72" r="4.5" fill={T.fill.primary} stroke={T.stroke.secondary} strokeWidth="1.5" />
      <circle cx="46" cy="104" r="4.5" fill={T.fill.primary} stroke={T.stroke.primary} strokeWidth="1.5" />
      {/* Version cards */}
      <rect x="60" y="28" width="66" height="24" rx="5.5" fill={T.fill.primary} stroke={T.stroke.tertiary} strokeWidth="1.2" />
      <rect x="69" y="37" width="34" height="4.5" rx="2.25" fill={T.accent} opacity="0.85" />
      <rect x="60" y="60" width="60" height="24" rx="5.5" fill={T.fill.secondary} stroke={T.stroke.primary} strokeWidth="1" />
      <rect x="69" y="70" width="30" height="4" rx="2" fill={T.fill.quaternary} />
      <rect x="60" y="92" width="54" height="24" rx="5.5" fill={T.fill.secondary} stroke={T.stroke.primary} strokeWidth="0.9" opacity="0.7" />
      <rect x="69" y="102" width="24" height="4" rx="2" fill={T.fill.quaternary} />
    </svg>
  );
}

export function LogsIllustration({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 160 164" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <ellipse cx="80" cy="138" rx="50" ry="8" fill={T.fill.tertiary} opacity="0.65" />
      <rect x="30" y="34" width="100" height="76" rx="8" fill={T.fill.primary} stroke={T.stroke.tertiary} strokeWidth="1.25" />
      <line x1="30" y1="50" x2="130" y2="50" stroke={T.stroke.primary} strokeWidth="1" />
      <circle cx="41" cy="42" r="2.2" fill={T.fill.quaternary} />
      <circle cx="49" cy="42" r="2.2" fill={T.fill.quaternary} />
      <rect x="42" y="62" width="38" height="4" rx="2" fill={T.fill.quaternary} />
      <rect x="42" y="72" width="52" height="4" rx="2" fill={T.fill.tertiary} />
      <rect x="42" y="82" width="32" height="4" rx="2" fill={T.fill.tertiary} />
      {/* Clean check badge */}
      <circle cx="114" cy="96" r="14" fill={T.fill.primary} stroke={T.accent} strokeWidth="1.3" />
      <path d="M108.5 96L112.2 99.8L119.5 92.2" stroke={T.accent} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
