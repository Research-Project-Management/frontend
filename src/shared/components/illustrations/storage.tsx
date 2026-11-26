import React from 'react';
import { ILLUSTRATION_TOKENS as T, type IllustrationProps } from './tokens';

/**
 * Style 3: Floating Folder, Sticky Pinboard & Tags (Files, Storage, Stickies, Labels, Search).
 */
export function FilesIllustration({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 160 164" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <ellipse cx="80" cy="138" rx="52" ry="8" fill={T.fill.tertiary} opacity="0.65" />
      {/* Back folder tab */}
      <path
        d="M32 46C32 42.7 34.7 40 38 40H64L72 48H122C125.3 48 128 50.7 128 54V112C128 115.3 125.3 118 122 118H38C34.7 118 32 115.3 32 112V46Z"
        fill={T.fill.secondary}
        stroke={T.stroke.primary}
        strokeWidth="1.15"
      />
      {/* Peeking file cards */}
      <rect x="46" y="34" width="44" height="48" rx="5" fill={T.fill.primary} stroke={T.stroke.primary} strokeWidth="1" />
      <rect x="70" y="38" width="44" height="48" rx="5" fill={T.accentSoft} stroke={T.accent} strokeWidth="1" />
      {/* Front folder flap */}
      <path
        d="M28 66C28 62.7 30.7 60 34 60H126C129.3 60 132 62.7 132 66L127 112C126.6 115.4 123.8 118 120.4 118H39.6C36.2 118 33.4 115.4 33 112L28 66Z"
        fill={T.fill.primary}
        stroke={T.stroke.tertiary}
        strokeWidth="1.25"
      />
      <rect x="64" y="84" width="32" height="5" rx="2.5" fill={T.fill.quaternary} />
    </svg>
  );
}

export function StickiesIllustration({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 160 164" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <ellipse cx="80" cy="138" rx="50" ry="8" fill={T.fill.tertiary} opacity="0.65" />
      {/* Left tilted sticky */}
      <g transform="rotate(-9 56 80)">
        <rect x="28" y="44" width="54" height="58" rx="6" fill={T.fill.secondary} stroke={T.stroke.primary} strokeWidth="1.1" />
        <rect x="38" y="58" width="30" height="3.5" rx="1.75" fill={T.fill.quaternary} />
        <rect x="38" y="67" width="22" height="3.5" rx="1.75" fill={T.fill.tertiary} />
      </g>
      {/* Right tilted sticky */}
      <g transform="rotate(8 104 82)">
        <rect x="78" y="48" width="54" height="58" rx="6" fill={T.accentSoft} stroke={T.accent} strokeWidth="1.1" />
        <rect x="88" y="62" width="30" height="3.5" rx="1.75" fill={T.accent} opacity="0.55" />
        <rect x="88" y="71" width="22" height="3.5" rx="1.75" fill={T.accent} opacity="0.35" />
      </g>
      {/* Center pinned sticky */}
      <rect x="52" y="34" width="58" height="64" rx="6.5" fill={T.fill.primary} stroke={T.stroke.tertiary} strokeWidth="1.25" />
      <circle cx="81" cy="43" r="3.5" fill={T.accent} />
      <rect x="63" y="56" width="36" height="4" rx="2" fill={T.stroke.secondary} />
      <rect x="63" y="66" width="30" height="3.5" rx="1.75" fill={T.fill.quaternary} />
      <rect x="63" y="75" width="22" height="3.5" rx="1.75" fill={T.fill.tertiary} />
    </svg>
  );
}

export function LabelsIllustration({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 160 164" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <ellipse cx="80" cy="138" rx="48" ry="8" fill={T.fill.tertiary} opacity="0.65" />
      <g transform="rotate(-8 80 80)">
        <rect x="34" y="48" width="84" height="30" rx="15" fill={T.fill.secondary} stroke={T.stroke.primary} strokeWidth="1.1" />
        <circle cx="50" cy="63" r="4" fill={T.fill.quaternary} />
      </g>
      <g transform="rotate(5 80 88)">
        <rect x="40" y="64" width="86" height="32" rx="16" fill={T.fill.primary} stroke={T.stroke.tertiary} strokeWidth="1.25" />
        <circle cx="57" cy="80" r="4.5" fill={T.accent} />
        <rect x="69" y="77.5" width="40" height="5" rx="2.5" fill={T.stroke.secondary} />
      </g>
    </svg>
  );
}

export function SearchIllustration({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 160 164" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <ellipse cx="80" cy="138" rx="48" ry="8" fill={T.fill.tertiary} opacity="0.65" />
      {/* Background result card */}
      <rect x="34" y="34" width="76" height="72" rx="8" fill={T.fill.secondary} stroke={T.stroke.primary} strokeWidth="1.1" />
      <rect x="46" y="48" width="40" height="4.5" rx="2.25" fill={T.fill.quaternary} />
      <rect x="46" y="60" width="52" height="4" rx="2" fill={T.fill.tertiary} />
      <rect x="46" y="70" width="36" height="4" rx="2" fill={T.fill.tertiary} />
      {/* Magnifying glass */}
      <circle cx="94" cy="76" r="24" fill={T.fill.primary} stroke={T.stroke.tertiary} strokeWidth="1.35" />
      <circle cx="94" cy="76" r="17" fill={T.accentSoft} />
      <path d="M86 73C87.5 69.5 91 67.5 95 67.5" stroke={T.accent} strokeWidth="1.4" strokeLinecap="round" />
      <path d="M112 94L126 108" stroke={T.stroke.tertiary} strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
}
