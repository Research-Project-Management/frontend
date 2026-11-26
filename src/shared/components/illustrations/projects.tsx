import React from 'react';
import { ILLUSTRATION_TOKENS as T, type IllustrationProps } from './tokens';

/**
 * Style 1: 3D Isometric Spatial Stack (Projects, Drafts, Work Items, Archive).
 */
function IsometricBaseSlabs() {
  return (
    <>
      <g opacity="0.22">
        <path
          d="M16 124L80 94L144 124L80 154L16 124Z"
          fill={T.fill.secondary}
          stroke={T.stroke.primary}
          strokeWidth="0.9"
          strokeLinejoin="round"
        />
      </g>
      <g opacity="0.58">
        <path
          d="M16 108L80 78L144 108L80 138L16 108Z"
          fill={T.fill.secondary}
          stroke={T.stroke.primary}
          strokeWidth="0.9"
          strokeLinejoin="round"
        />
      </g>
      <path
        d="M16 92L80 62L144 92L80 122L16 92Z"
        fill={T.fill.primary}
        stroke={T.stroke.primary}
        strokeWidth="1"
        strokeLinejoin="round"
      />
    </>
  );
}

export function ProjectsIllustration({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 160 164" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <IsometricBaseSlabs />
      {/* Upright isometric workspace card */}
      <g transform="translate(0, -4)">
        <rect x="44" y="24" width="72" height="54" rx="7" fill={T.fill.primary} stroke={T.stroke.tertiary} strokeWidth="1.25" />
        <rect x="44" y="24" width="72" height="14" rx="7" fill={T.fill.secondary} />
        <line x1="44" y1="38" x2="116" y2="38" stroke={T.stroke.primary} strokeWidth="1" />
        <circle cx="53" cy="31" r="2.2" fill={T.accent} />
        <circle cx="61" cy="31" r="2.2" fill={T.fill.quaternary} />
        <rect x="52" y="45" width="24" height="24" rx="3.5" fill={T.accentSoft} stroke={T.accent} strokeWidth="0.9" />
        <rect x="82" y="45" width="26" height="10" rx="2.5" fill={T.fill.tertiary} />
        <rect x="82" y="59" width="20" height="10" rx="2.5" fill={T.fill.secondary} stroke={T.stroke.primary} strokeWidth="0.8" />
      </g>
    </svg>
  );
}

export function DraftsIllustration({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 160 164" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <IsometricBaseSlabs />
      <g transform="translate(0, -2)">
        <rect x="52" y="20" width="56" height="68" rx="6" fill={T.fill.primary} stroke={T.stroke.tertiary} strokeWidth="1.25" />
        <rect x="61" y="33" width="26" height="4" rx="2" fill={T.stroke.secondary} />
        <rect x="61" y="43" width="38" height="3.5" rx="1.75" fill={T.fill.quaternary} />
        <rect x="61" y="51" width="32" height="3.5" rx="1.75" fill={T.fill.quaternary} />
        <rect x="61" y="59" width="20" height="3.5" rx="1.75" fill={T.fill.tertiary} />
        {/* Floating pen badge */}
        <circle cx="106" cy="70" r="12" fill={T.fill.primary} stroke={T.accent} strokeWidth="1.2" />
        <path d="M102 74L109.5 66.5M108 65L111 68L104 75L100.5 75.5L101 72L108 65Z" stroke={T.accent} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

export function WorkItemsIllustration({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 160 164" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <IsometricBaseSlabs />
      <rect x="44" y="22" width="72" height="60" rx="7" fill={T.fill.primary} stroke={T.stroke.tertiary} strokeWidth="1.25" />
      {/* Row 1 - checked */}
      <rect x="53" y="33" width="10" height="10" rx="3" fill={T.accentSoft} stroke={T.accent} strokeWidth="1.1" />
      <path d="M55.8 38L57.5 39.8L60.6 36.2" stroke={T.accent} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="69" y="35.5" width="36" height="5" rx="2.5" fill={T.fill.quaternary} />
      {/* Row 2 */}
      <rect x="53" y="49" width="10" height="10" rx="3" fill={T.fill.secondary} stroke={T.stroke.primary} strokeWidth="1" />
      <rect x="69" y="51.5" width="28" height="5" rx="2.5" fill={T.fill.tertiary} />
      {/* Row 3 */}
      <rect x="53" y="65" width="10" height="10" rx="3" fill={T.fill.secondary} stroke={T.stroke.primary} strokeWidth="1" />
      <rect x="69" y="67.5" width="32" height="5" rx="2.5" fill={T.fill.tertiary} />
    </svg>
  );
}

export function ArchiveIllustration({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 160 164" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <IsometricBaseSlabs />
      <rect x="46" y="38" width="68" height="44" rx="6" fill={T.fill.primary} stroke={T.stroke.tertiary} strokeWidth="1.25" />
      <rect x="41" y="26" width="78" height="15" rx="4.5" fill={T.fill.secondary} stroke={T.stroke.tertiary} strokeWidth="1.25" />
      <rect x="68" y="52" width="24" height="6" rx="3" fill={T.accentSoft} stroke={T.accent} strokeWidth="1" />
    </svg>
  );
}
