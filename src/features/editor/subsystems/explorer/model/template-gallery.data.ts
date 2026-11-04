/**
 * template-gallery.data.ts
 *
 * Academic & Document LaTeX Template Metadata & Types.
 * Layer 1: Domain Core / Document Models.
 * Authoritative template files (main.tex, references.bib, .cls, .sty) are stored and served
 * by `backend/src/modules/manuscripts/templates/domain/official-template.catalog.ts`.
 */

export type TemplateCategory = 'Conference' | 'Journal' | 'Preprint' | 'Thesis' | 'Resume';
export type AcademicTemplateCategory = TemplateCategory;

export type TemplateIconName =
  | 'Layout'
  | 'BookOpen'
  | 'Scroll'
  | 'FileCode'
  | 'GraduationCap'
  | 'FileText';

export interface ProjectTemplate {
  id: string;
  name: string;
  category: TemplateCategory;
  publisher: string;
  description: string;
  iconName: TemplateIconName;
  badge: string;
  mainTex: string;
  bibTex?: string;
}

export type RawAcademicTemplate = ProjectTemplate;
export type AcademicTemplate = ProjectTemplate;

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: 'ieee-conference',
    name: 'IEEE Conference Paper (2-Column)',
    category: 'Conference',
    publisher: 'IEEE',
    description: 'Standard IEEE 2-column format for conference proceedings, symposiums, and technical workshops.',
    iconName: 'Layout',
    badge: 'IEEEtran',
    mainTex: '% Loading IEEE Conference template from server...',
  },
  {
    id: 'acm-sigconf',
    name: 'ACM Master Article (SIGCONF)',
    category: 'Conference',
    publisher: 'ACM',
    description: 'ACM Primary Article Template for SIGGRAPH, CHI, KDD, and international ACM conference proceedings.',
    iconName: 'BookOpen',
    badge: 'acmart',
    mainTex: '% Loading ACM SIGCONF template from server...',
  },
  {
    id: 'springer-lncs',
    name: 'Springer LNCS (Computer Science)',
    category: 'Conference',
    publisher: 'Springer',
    description: 'Lecture Notes in Computer Science proceedings, CCIS, and Springer Nature conference series.',
    iconName: 'Scroll',
    badge: 'llncs',
    mainTex: '% Loading Springer LNCS template from server...',
  },
  {
    id: 'arxiv-preprint',
    name: 'arXiv Preprint (Single Column)',
    category: 'Preprint',
    publisher: 'arXiv',
    description: 'Clean, elegant, modern preprint layout for arXiv, bioRxiv, and peer review submissions.',
    iconName: 'FileCode',
    badge: 'article',
    mainTex: '% Loading arXiv Preprint template from server...',
  },
  {
    id: 'thesis-dissertation',
    name: 'Academic Thesis / Dissertation',
    category: 'Thesis',
    publisher: 'University',
    description: 'Comprehensive chapter-based thesis structure with title page, abstract, table of contents, and chapters.',
    iconName: 'GraduationCap',
    badge: 'report',
    mainTex: '% Loading Thesis template from server...',
  },
  {
    id: 'academic-cv',
    name: 'Academic Curriculum Vitae (CV)',
    category: 'Resume',
    publisher: 'Academic',
    description: 'Professional LaTeX CV highlighting education, research publications, grants, and teaching experience.',
    iconName: 'FileText',
    badge: 'curriculum vitae',
    mainTex: '% Loading Academic CV template from server...',
  },
];

export const ACADEMIC_TEMPLATES = PROJECT_TEMPLATES;
export const RAW_ACADEMIC_TEMPLATES = PROJECT_TEMPLATES;

