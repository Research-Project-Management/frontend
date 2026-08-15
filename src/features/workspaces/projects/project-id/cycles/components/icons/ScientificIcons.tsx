import React from "react";

interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
}

export const SearchIcon = ({ size = 24, ...props }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M14 25C20.0751 25 25 20.0751 25 14C25 7.92487 20.0751 3 14 3C7.92487 3 3 7.92487 3 14C3 20.0751 7.92487 25 14 25Z" fill="#B2EBF2" stroke="#000000" strokeWidth="2" strokeLinejoin="round"/>
    <path d="M22 22L29 29" stroke="#000000" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M10 10C10 10 11 9 13 9" stroke="white" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

export const BooksIcon = ({ size = 24, ...props }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <rect x="5" y="18" width="22" height="6" rx="1" fill="#FF8A65" stroke="#000000" strokeWidth="2"/>
    <rect x="6" y="11" width="20" height="6" rx="1" fill="#64B5F6" stroke="#000000" strokeWidth="2"/>
    <rect x="7" y="4" width="18" height="6" rx="1" fill="#FFD54F" stroke="#000000" strokeWidth="2"/>
    <path d="M5 21H27" stroke="#000000" strokeWidth="1" strokeOpacity="0.2"/>
    <path d="M6 14H26" stroke="#000000" strokeWidth="1" strokeOpacity="0.2"/>
    <path d="M7 7H25" stroke="#000000" strokeWidth="1" strokeOpacity="0.2"/>
  </svg>
);

export const PuzzleIcon = ({ size = 24, ...props }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M12 5C12 3.34315 13.3431 2 15 2C16.6569 2 18 3.34315 18 5H24C25.1046 5 26 5.89543 26 7V13C27.6569 13 29 14.3431 29 16C29 17.6569 27.6569 19 26 19V25C26 26.1046 25.1046 27 24 27H18C18 28.6569 16.6569 30 15 30C13.3431 30 12 28.6569 12 27H6C4.89543 27 4 26.1046 4 25V19C5.65685 19 7 17.6569 7 16C7 14.3431 5.65685 13 4 13V7C4 5.89543 4.89543 5 6 5H12Z" fill="#81C784" stroke="#000000" strokeWidth="2" strokeLinejoin="round"/>
  </svg>
);

export const DataIcon = ({ size = 24, ...props }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M4 8C4 6.89543 4.89543 6 6 6H12L15 9H26C27.1046 9 28 9.89543 28 11V24C28 25.1046 27.1046 26 26 26H6C4.89543 26 4 25.1046 4 24V8Z" fill="#FFB74D" stroke="#000000" strokeWidth="2" strokeLinejoin="round"/>
    <path d="M4 13H28" stroke="#000000" strokeWidth="2"/>
    <rect x="20" y="11" width="6" height="2" fill="#FFE0B2"/>
  </svg>
);

export const AnalysisIcon = ({ size = 24, ...props }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <rect x="4" y="4" width="24" height="24" rx="2" fill="white" stroke="#000000" strokeWidth="2"/>
    <rect x="8" y="16" width="4" height="8" fill="#4CAF50" stroke="#000000" strokeWidth="1.5"/>
    <rect x="14" y="10" width="4" height="14" fill="#F44336" stroke="#000000" strokeWidth="1.5"/>
    <rect x="20" y="14" width="4" height="10" fill="#2196F3" stroke="#000000" strokeWidth="1.5"/>
  </svg>
);

export const WritingIcon = ({ size = 24, ...props }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M25 5L7 23V27H11L29 9L25 5Z" fill="#FFD54F" stroke="#000000" strokeWidth="2" strokeLinejoin="round"/>
    <path d="M22 8L26 12" stroke="#000000" strokeWidth="2"/>
    <path d="M6 30H26" stroke="#000000" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

export const RevisionIcon = ({ size = 24, ...props }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <rect x="4" y="4" width="24" height="24" rx="2" fill="#2196F3" stroke="#000000" strokeWidth="2"/>
    <path d="M22 14C22 10.6863 19.3137 8 16 8C12.6863 8 10 10.6863 10 14M10 18C10 21.3137 12.6863 24 16 24C19.3137 24 22 21.3137 22 18" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
    <path d="M22 11V14H19" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M10 21V18H13" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export const SubmissionIcon = ({ size = 24, ...props }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M4 12L16 6L28 12L16 18L4 12Z" fill="#455A64" stroke="#000000" strokeWidth="2" strokeLinejoin="round"/>
    <path d="M8 14V20C8 20 12 24 16 24C20 24 24 20 24 20V14" stroke="#000000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M28 12V22" stroke="#000000" strokeWidth="2" strokeLinecap="round"/>
    <circle cx="28" cy="22" r="2" fill="#000000"/>
  </svg>
);

export const CustomIcon = ({ size = 24, ...props }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <rect x="6" y="4" width="20" height="24" rx="2" fill="#CFD8DC" stroke="#000000" strokeWidth="2"/>
    <rect x="11" y="2" width="10" height="4" rx="1" fill="#455A64" stroke="#000000" strokeWidth="2"/>
    <path d="M10 12H22M10 18H22M10 24H18" stroke="#455A64" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

export const PHASE_ICON_MAP: Record<string, React.ReactNode> = {
  topic_selection: <SearchIcon />,
  literature_review: <BooksIcon />,
  methodology: <PuzzleIcon />,
  data_collection: <DataIcon />,
  data_analysis: <AnalysisIcon />,
  writing: <WritingIcon />,
  review_revision: <RevisionIcon />,
  submission: <SubmissionIcon />,
  custom: <CustomIcon />,
  // Mapping for INITIAL_PHASES IDs
  search: <SearchIcon />,
  book: <BooksIcon />,
  settings: <PuzzleIcon />,
  database: <DataIcon />,
  analysis: <AnalysisIcon />,
  refresh: <RevisionIcon />,
  cap: <SubmissionIcon />,
};

export const getPhaseIcon = (phaseId: string, fallback: string | React.ReactNode) => {
  if (PHASE_ICON_MAP[phaseId]) return PHASE_ICON_MAP[phaseId];
  const baseId = phaseId.split('_')[0];
  if (PHASE_ICON_MAP[baseId]) return PHASE_ICON_MAP[baseId];
  return fallback;
};
