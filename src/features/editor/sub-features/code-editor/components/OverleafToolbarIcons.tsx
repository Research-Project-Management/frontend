import React from 'react';

export interface IconProps {
  className?: string;
  size?: number;
}

// 1. Bot (AI Assistant)
export function OverleafBotIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 640 512" fill="currentColor" className={className} aria-hidden="true">
      <path d="M320 0c17.7 0 32 14.3 32 32l0 64 120 0c39.8 0 72 32.2 72 72l0 272c0 39.8-32.2 72-72 72l-304 0c-39.8 0-72-32.2-72-72l0-272c0-39.8 32.2-72 72-72l120 0 0-64c0-17.7 14.3-32 32-32zM208 384c-8.8 0-16 7.2-16 16s7.2 16 16 16l32 0c8.8 0 16-7.2 16-16s-7.2-16-16-16l-32 0zm96 0c-8.8 0-16 7.2-16 16s7.2 16 16 16l32 0c8.8 0 16-7.2 16-16s-7.2-16-16-16l-32 0zm96 0c-8.8 0-16 7.2-16 16s7.2 16 16 16l32 0c8.8 0 16-7.2 16-16s-7.2-16-16-16l-32 0zM264 256a40 40 0 1 0 -80 0 40 40 0 1 0 80 0zm152 40a40 40 0 1 0 0-80 40 40 0 1 0 0 80zM48 224l16 0 0 192-16 0c-26.5 0-48-21.5-48-48l0-96c0-26.5 21.5-48 48-48zm544 0c26.5 0 48 21.5 48 48l0 96c0 26.5-21.5 48-48 48l-16 0 0-192 16 0z" />
    </svg>
  );
}

// 2. Undo
export function OverleafUndoIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 512 512" fill="currentColor" className={className} aria-hidden="true">
      <path d="M48.5 224L40 224c-13.3 0-24-10.7-24-24L16 72c0-9.7 5.8-18.5 14.8-22.2s19.3-1.7 26.2 5.2L98.6 96.6c87.6-86.5 228.7-86.2 315.8 1c87.5 87.5 87.5 229.3 0 316.8s-229.3 87.5-316.8 0c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0c62.5 62.5 163.8 62.5 226.3 0s62.5-163.8 0-226.3c-62.2-62.2-162.7-62.5-225.3-1L185 183c6.9 6.9 8.9 17.2 5.2 26.2s-12.5 14.8-22.2 14.8L48.5 224z" />
    </svg>
  );
}

// 3. Redo
export function OverleafRedoIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 512 512" fill="currentColor" className={className} aria-hidden="true">
      <path d="M463.5 224l8.5 0c13.3 0 24-10.7 24-24l0-128c0-9.7-5.8-18.5-14.8-22.2s-19.3-1.7-26.2 5.2L413.4 96.6c-87.6-86.5-228.7-86.2-315.8 1c-87.5 87.5-87.5 229.3 0 316.8s229.3 87.5 316.8 0c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0c-62.5 62.5-163.8 62.5-226.3 0s-62.5-163.8 0-226.3c62.2-62.2 162.7-62.5 225.3-1L327 183c-6.9 6.9-8.9 17.2-5.2 26.2s12.5 14.8 22.2 14.8l119.5 0z" />
    </svg>
  );
}

// 4. Headings (Small T + Large T + Dropdown Chevron)
export function OverleafHeadingsIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 38 16" fill="currentColor" className={className} aria-hidden="true">
      <path d="M8 1h12v2.5h-4.5V15h-3V3.5H8V1z" />
      <path d="M0 6h8v2H5v7H3V8H0V6z" />
      <path d="M26 6.5l4 4 4-4 1.2 1.2-5.2 5.2-5.2-5.2L26 6.5z" />
    </svg>
  );
}

// 5. Bold (B)
export function OverleafBoldIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 384 512" fill="currentColor" className={className} aria-hidden="true">
      <path d="M0 64C0 46.3 14.3 32 32 32l48 0 16 0 128 0c70.7 0 128 57.3 128 128c0 31.3-11.3 60.1-30 82.3c37.1 22.4 62 63.1 62 109.7c0 70.7-57.3 128-128 128L96 480l-16 0-48 0c-17.7 0-32-14.3-32-32s14.3-32 32-32l16 0 0-160L48 96 32 96C14.3 96 0 81.7 0 64zM224 224c35.3 0 64-28.7 64-64s-28.7-64-64-64L112 96l0 128 112 0zM112 288l0 128 144 0c35.3 0 64-28.7 64-64s-28.7-64-64-64l-32 0-112 0z" />
    </svg>
  );
}

// 6. Italic (I)
export function OverleafItalicIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 384 512" fill="currentColor" className={className} aria-hidden="true">
      <path d="M128 64c0-17.7 14.3-32 32-32l192 0c17.7 0 32 14.3 32 32s-14.3 32-32 32l-58.7 0L160 416l64 0c17.7 0 32 14.3 32 32s-14.3 32-32 32L32 480c-17.7 0-32-14.3-32-32s14.3-32 32-32l58.7 0L224 96l-64 0c-17.7 0-32-14.3-32-32z" />
    </svg>
  );
}

// 7. Math Formula (+ - * /)
export function OverleafMathFormulaIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" fillRule="evenodd" className={className} aria-hidden="true">
      <path d="M1 3.5A2.5 2.5 0 0 1 3.5 1h9A2.5 2.5 0 0 1 15 3.5v9a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 1 12.5v-9zM4.5 3.5h1.2v1.3h1.3v1.2H5.7v1.3H4.5V6H3.2V4.8h1.3V3.5zm5 1.9h3.2v1.2H9.5V5.4zm-5 4.4l1 1 1-1 .8.8-1 1 1 1-.8.8-1-1-1 1-.8-.8 1-1-1-1 .8-.8zm5 1.4h3.2v1.2H9.5v-1.2zm1.6-1.8a.7.7 0 1 0 0-1.4.7.7 0 0 0 0 1.4zm0 4.8a.7.7 0 1 0 0-1.4.7.7 0 0 0 0 1.4z" />
    </svg>
  );
}

// 8. Omega (Greek letter Omega)
export function OverleafOmegaIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className={className} aria-hidden="true">
      <path d="M14.5 13.5H11c-.3 0-.5-.2-.5-.5 0-.8-.3-1.6-.9-2.2-.6-.6-1.3-.9-2.1-.9s-1.5.3-2.1.9c-.6.6-.9 1.4-.9 2.2 0 .3-.2.5-.5.5H1.5c-.3 0-.5-.2-.5-.5s.2-.5.5-.5h2.2C3.2 11.7 3 10.4 3 9c0-2.8 2.2-5 5-5s5 2.2 5 5c0 1.4-.2 2.7-.7 3.5h2.2c.3 0 .5.2.5.5s-.2.5-.5.5z" />
    </svg>
  );
}

// 9. Link (Chain link + plus badge)
export function OverleafLinkIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 18 16" fill="currentColor" className={className} aria-hidden="true">
      <g transform="scale(0.024) translate(0, 30)">
        <path d="M579.8 267.7c56.5-56.5 56.5-148 0-204.5c-50-50-128.8-56.5-186.3-15.4l-1.6 1.1c-14.4 10.3-17.7 30.3-7.4 44.6s30.3 17.7 44.6 7.4l1.6-1.1c32.1-22.9 76-19.3 103.8 8.6c31.5 31.5 31.5 82.5 0 114L422.3 334.8c-31.5 31.5-82.5 31.5-114 0c-27.9-27.9-31.5-71.8-8.6-103.8l1.1-1.6c10.3-14.4 6.9-34.4-7.4-44.6s-34.4-6.9-44.6 7.4l-1.1 1.6C206.5 251.2 213 330 263 380c56.5 56.5 148 56.5 204.5 0L579.8 267.7zM60.2 244.3c-56.5 56.5-56.5 148 0 204.5c50 50 128.8 56.5 186.3 15.4l1.6-1.1c14.4-10.3 17.7-30.3 7.4-44.6s-30.3-17.7-44.6-7.4l-1.6 1.1c-32.1 22.9-76 19.3-103.8-8.6C74 372 74 321 105.5 289.5L217.7 177.2c31.5-31.5 82.5-31.5 114 0c27.9 27.9 31.5 71.8 8.6 103.9l-1.1 1.6c-10.3 14.4-6.9 34.4 7.4 44.6s34.4 6.9 44.6-7.4l1.1-1.6C433.5 260.8 427 182 377 132c-56.5-56.5-148-56.5-204.5 0L60.2 244.3z" />
      </g>
      <path d="M14.5 10v1.8H12.7v1.4h1.8V15h1.4v-1.8h1.8v-1.4h-1.8V10h-1.4z" />
    </svg>
  );
}

// 10. Comment (Speech bubble with plus)
export function OverleafCommentIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 512 512" fill="currentColor" className={className} aria-hidden="true">
      <path d="M256 448c141.4 0 256-93.1 256-208S397.4 32 256 32S0 125.1 0 240c0 45.1 17.7 86.8 47.7 120.9c-1.9 24.5-11.4 46.3-21.4 62.9c-5.5 9.2-11.1 16.6-15.2 21.6c-2.1 2.5-3.7 4.4-4.9 5.7c-.6 .6-1 1.1-1.3 1.4l-.3 .3c0 0 0 0 0 0c0 0 0 0 0 0s0 0 0 0s0 0 0 0c-4.6 4.6-5.9 11.4-3.4 17.4c2.5 6 8.3 9.9 14.8 9.9c28.7 0 57.6-8.9 81.6-19.3c22.9-10 42.4-21.9 54.3-30.6c31.8 11.5 67 17.9 104.1 17.9zM224 160c0-8.8 7.2-16 16-16l32 0c8.8 0 16 7.2 16 16l0 48 48 0c8.8 0 16 7.2 16 16l0 32c0 8.8-7.2 16-16 16l-48 0 0 48c0 8.8-7.2 16-16 16l-32 0c-8.8 0-16-7.2-16-16l0-48-48 0c-8.8 0-16-7.2-16-16l0-32c0-8.8 7.2-16 16-16l48 0 0-48z" />
    </svg>
  );
}

// 11. Label / Tag
export function OverleafTagIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 448 512" fill="currentColor" className={className} aria-hidden="true">
      <path d="M0 80L0 229.5c0 17 6.7 33.3 18.7 45.3l176 176c25 25 65.5 25 90.5 0L418.7 317.3c25-25 25-65.5 0-90.5l-176-176c-12-12-28.3-18.7-45.3-18.7L48 32C21.5 32 0 53.5 0 80zm112 32a32 32 0 1 1 0 64 32 32 0 1 1 0-64z" />
    </svg>
  );
}

// 12. Citation / Book with bookmark
export function OverleafBookIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 448 512" fill="currentColor" className={className} aria-hidden="true">
      <path d="M0 96C0 43 43 0 96 0l96 0 0 190.7c0 13.4 15.5 20.9 26 12.5L272 160l54 43.2c10.5 8.4 26 .9 26-12.5L352 0l32 0 32 0c17.7 0 32 14.3 32 32l0 320c0 17.7-14.3 32-32 32l0 64c17.7 0 32 14.3 32 32s-14.3 32-32 32l-32 0L96 512c-53 0-96-43-96-96L0 96zM64 416c0 17.7 14.3 32 32 32l256 0 0-64L96 384c-17.7 0-32 14.3-32 32z" />
    </svg>
  );
}

// 13. Figure / Image with sparkle star in corner
export function OverleafFigureIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 18 16" fill="currentColor" fillRule="evenodd" className={className} aria-hidden="true">
      <path d="M1 2a1.5 1.5 0 0 1 1.5-1.5h8.8a1.5 1.5 0 0 1 1.5 1.5v1.2a2.8 2.8 0 0 0-1.5.5V2.5a.3.3 0 0 0-.3-.3H2.5a.3.3 0 0 0-.3.3v10.4c0 .2.1.3.3.3h9.4a.3.3 0 0 0 .3-.3V8.8c.5.2 1 .3 1.5.3V13a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 1 13V2z" />
      <path d="M3 11.5l2.5-3 2 2.2 2-2.5 2.5 3.3H3z" />
      <path d="M15.5 1c0 1.2.8 2 2 2-1.2 0-2 .8-2 2 0-1.2-.8-2-2-2 1.2 0 2-.8 2-2z" />
    </svg>
  );
}

// 14. Table (Header + 3 columns)
export function OverleafTableIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 512 512" fill="currentColor" className={className} aria-hidden="true">
      <path d="M64 256l0-96 160 0 0 96L64 256zm0 64l160 0 0 96L64 416l0-96zm224 96l0-96 160 0 0 96-160 0zM448 256l-160 0 0-96 160 0 0 96zM64 32C28.7 32 0 60.7 0 96L0 416c0 35.3 28.7 64 64 64l384 0c35.3 0 64-28.7 64-64l0-320c0-35.3-28.7-64-64-64L64 32z" />
    </svg>
  );
}

// 15. List (Bullet points)
export function OverleafListIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 512 512" fill="currentColor" className={className} aria-hidden="true">
      <path d="M64 144a48 48 0 1 0 0-96 48 48 0 1 0 0 96zM192 64c-17.7 0-32 14.3-32 32s14.3 32 32 32l288 0c17.7 0 32-14.3 32-32s-14.3-32-32-32L192 64zm0 160c-17.7 0-32 14.3-32 32s14.3 32 32 32l288 0c17.7 0 32-14.3 32-32s-14.3-32-32-32l-288 0zm0 160c-17.7 0-32 14.3-32 32s14.3 32 32 32l288 0c17.7 0 32-14.3 32-32s-14.3-32-32-32l-288 0zM64 464a48 48 0 1 0 0-96 48 48 0 1 0 0 96zm48-208a48 48 0 1 0 -96 0 48 48 0 1 0 96 0z" />
    </svg>
  );
}

// 16. Pen (Edit mode)
export function OverleafPenIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 512 512" fill="currentColor" className={className} aria-hidden="true">
      <path d="M362.7 19.3L314.3 67.7 444.3 197.7l48.4-48.4c25-25 25-65.5 0-90.5L453.3 19.3c-25-25-65.5-25-90.5 0zm-71 71L58.6 323.5c-10.4 10.4-18 23.3-22.2 37.4L1 481.2C-1.5 489.7 .8 498.8 7 505s15.3 8.5 23.7 6.1l120.3-35.4c14.1-4.2 27-11.8 37.4-22.2L421.7 220.3 291.7 90.3z" />
    </svg>
  );
}

// 17. Search (Magnifying glass)
export function OverleafSearchIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 512 512" fill="currentColor" className={className} aria-hidden="true">
      <path d="M416 208c0 45.9-14.9 88.3-40 122.7L502.6 457.4c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L330.7 376c-34.4 25.2-76.8 40-122.7 40C93.1 416 0 322.9 0 208S93.1 0 208 0S416 93.1 416 208zM208 352a144 144 0 1 0 0-288 144 144 0 1 0 0 288z" />
    </svg>
  );
}

// 18. Caret Down
export function OverleafCaretDownIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 320 512" fill="currentColor" className={className} aria-hidden="true">
      <path d="M137.4 374.6c12.5 12.5 32.8 12.5 45.3 0l128-128c9.2-9.2 11.9-22.9 6.9-34.9s-16.6-19.8-29.6-19.8L32 192c-12.9 0-24.6 7.8-29.6 19.8s-2.2 25.7 6.9 34.9l128 128z" />
    </svg>
  );
}

// 19. More Horizontal (3 dots for responsive toolbar overflow)
export function OverleafMoreHorizontalIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className={className} aria-hidden="true">
      <circle cx="2.5" cy="8" r="1.5" />
      <circle cx="8" cy="8" r="1.5" />
      <circle cx="13.5" cy="8" r="1.5" />
    </svg>
  );
}

