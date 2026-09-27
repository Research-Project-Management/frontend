import React from 'react';

interface IconProps {
  className?: string;
}

export function ZoteroIcon({ className = 'size-6' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <rect width="24" height="24" rx="5" fill="#CC292B" />
      <path d="M6 7h12l-7.5 10H18v2H6l7.5-10H6V7z" fill="#FFFFFF" />
    </svg>
  );
}

export function MendeleyIcon({ className = 'size-6' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <rect width="24" height="24" rx="5" fill="#A81C2E" />
      <circle cx="12" cy="9" r="3.2" fill="#FFFFFF" />
      <circle cx="7" cy="14.5" r="2.4" fill="#FFFFFF" />
      <circle cx="17" cy="14.5" r="2.4" fill="#FFFFFF" />
      <path d="M9 13.5h6v2H9z" fill="#FFFFFF" />
    </svg>
  );
}

export function OrcidIcon({ className = 'size-6' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <rect width="24" height="24" rx="5" fill="#A6CE39" />
      <circle cx="8" cy="8" r="1.3" fill="#FFFFFF" />
      <path d="M7 10.5h2v6.5H7zm4-3.5h3.2c2.5 0 4.3 1.7 4.3 4.25s-1.8 4.25-4.3 4.25H11V7zm2 6.7h1.1c1.4 0 2.4-.9 2.4-2.45s-1-2.45-2.4-2.45H13v4.9z" fill="#FFFFFF" />
    </svg>
  );
}

export function GitHubIcon({ className = 'size-6' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <rect width="24" height="24" rx="5" fill="#181717" />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 4C7.58 4 4 7.58 4 12c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0020 12c0-4.42-3.58-8-8-8z"
        fill="#FFFFFF"
      />
    </svg>
  );
}

export function SlackIcon({ className = 'size-6' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313z" fill="#E01E5A" />
      <path d="M8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312z" fill="#36C5F0" />
      <path d="M18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312z" fill="#2EB67D" />
      <path d="M15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.528 2.528 0 0 1 2.52-2.52h6.313A2.528 2.528 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" fill="#ECB22E" />
    </svg>
  );
}

export function GitLabIcon({ className = 'size-6' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path d="m23.6 9.87-1.07-3.29a.86.86 0 0 0-.33-.42.88.88 0 0 0-.54-.15.89.89 0 0 0-.52.2.86.86 0 0 0-.29.44l-1.46 4.49H4.61L3.15 6.65a.86.86 0 0 0-.29-.44.89.89 0 0 0-.52-.2.88.88 0 0 0-.54.15.86.86 0 0 0-.33.42L.4 9.87a1.28 1.28 0 0 0 .46 1.44L12 19.33l11.14-8.02a1.28 1.28 0 0 0 .46-1.44Z" fill="#E24329" />
      <path d="M12 19.33 4.61 11.14h14.78L12 19.33Z" fill="#E24329" />
      <path d="M12 19.33 4.61 11.14H.86L12 19.33Z" fill="#FC6D26" />
      <path d="m19.39 11.14 7.47.01-11.14 8.18 3.67-8.19Z" fill="#FC6D26" />
      <path d="m.86 11.14 3.75-8.19 1.46 4.49L.86 11.14Z" fill="#FCA326" />
      <path d="m23.14 11.14-3.75-8.19-1.46 4.49 5.21 3.7Z" fill="#FCA326" />
    </svg>
  );
}

export function SentryIcon({ className = 'size-6' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M13.23 2.11a1.2 1.2 0 0 0-1.87-.21L.36 12.9a1.2 1.2 0 0 0 .82 2.06h3.4a1.2 1.2 0 0 0 1.15-.84l2.42-7.85 4.31 15.02a1.2 1.2 0 0 0 1.15.87h7.24a1.2 1.2 0 0 0 1.17-1.46l-8.62-18.59zm-1.8 14.16a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z" />
    </svg>
  );
}

export function OverleafIcon({ className = 'size-6' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <rect width="24" height="24" rx="5" fill="#4CA846" />
      <path d="M12 4.5c-4.14 0-7.5 3.36-7.5 7.5 0 3.2 2.02 5.94 4.88 7 1.88-3.5 1.12-6.5-.88-8 3 1.5 4 4.5 3.5 7.5 3.5-.5 6.5-3.5 6.5-6.5 0-4.14-3.36-7.5-6.5-7.5z" fill="#FFFFFF" />
    </svg>
  );
}
