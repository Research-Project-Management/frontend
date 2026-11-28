import { pagesService } from '@/features/editor';
import type {
  Page,
  PageStatus,
  CreatePageInput,
  CreatePageResponse,
} from '../types/page.types';

export const PageService = {
  list: (spaceId: string, status?: string, search?: string): Promise<Page[]> =>
    pagesService.docs.listSpacePages<Page>(spaceId, status, search),

  create: async (input: CreatePageInput): Promise<CreatePageResponse> =>
    pagesService.docs.createSpacePage<Page>(input),

  delete: (pageId: string) => pagesService.docs.delete(pageId),

  getTrash: (spaceId: string): Promise<Page[]> =>
    pagesService.docs.getTrash<Page>(spaceId),

  restore: async (pageId: string) => {
    const page = (await pagesService.docs.restore(pageId)) as unknown as Page;
    return { success: true, page };
  },

  purge: (pageId: string) => pagesService.docs.purge(pageId),

  duplicate: (pageId: string) => pagesService.docs.duplicatePage<Page>(pageId),

  update: (
    pageId: string,
    data: {
      title?: string;
      status?: PageStatus;
      description?: string;
      compiler?: 'pdflatex' | 'xelatex' | 'lualatex' | 'latex';
      texlive?: string;
      spellLang?: string;
      rootDocId?: string;
    },
  ) => pagesService.docs.updateMetadata<Page>(pageId, data),

  replaceLabels: (spaceId: string, pageId: string, labelIds: string[]) =>
    pagesService.docs.replaceLabels(spaceId, pageId, labelIds),

  importZip: (spaceId: string, file: File) =>
    pagesService.export.importZip(spaceId, file),

  convertDocument: (
    spaceId: string,
    file: File,
    options: { format: 'docx' | 'md' },
  ) => pagesService.export.convertDocument(spaceId, file, options),

  importGithubRepo: (input: {
    spaceId: string;
    repoFullName: string;
    branch: string;
  }) => pagesService.git.importGithubRepo(input),
};
