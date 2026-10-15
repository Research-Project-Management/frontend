import React from 'react';
import { vi } from 'vitest';
import '@testing-library/jest-dom';
import { ReadableStream, TransformStream, WritableStream } from 'node:stream/web';

if (typeof globalThis.ReadableStream === 'undefined') {
  (globalThis as any).ReadableStream = ReadableStream;
}
if (typeof globalThis.TransformStream === 'undefined') {
  (globalThis as any).TransformStream = TransformStream;
}
if (typeof globalThis.WritableStream === 'undefined') {
  (globalThis as any).WritableStream = WritableStream;
}

if (typeof globalThis.DOMMatrix === 'undefined') {
  (globalThis as any).DOMMatrix = class DOMMatrix {
    a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
    m11 = 1; m12 = 0; m13 = 0; m14 = 0;
    m21 = 0; m22 = 1; m23 = 0; m24 = 0;
    m31 = 0; m32 = 0; m33 = 1; m34 = 0;
    m41 = 0; m42 = 0; m43 = 0; m44 = 1;
    is2D = true;
    isIdentity = true;
    multiply() { return this; }
    translate() { return this; }
    scale() { return this; }
    transformPoint(point: any) { return point; }
  };
}

if (typeof (globalThis as any).Path2D === 'undefined') {
  (globalThis as any).Path2D = class Path2D {};
}

if (typeof window !== 'undefined') {
  if (!window.matchMedia) {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => true,
      }),
    });
  }

  if (!window.ResizeObserver) {
    (window as any).ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }

  if (!window.HTMLElement.prototype.scrollIntoView) {
    window.HTMLElement.prototype.scrollIntoView = function () {};
  }
  if (!window.HTMLElement.prototype.hasPointerCapture) {
    window.HTMLElement.prototype.hasPointerCapture = function () { return false; };
  }
  if (!window.HTMLElement.prototype.setPointerCapture) {
    window.HTMLElement.prototype.setPointerCapture = function () {};
  }
  if (!window.HTMLElement.prototype.releasePointerCapture) {
    window.HTMLElement.prototype.releasePointerCapture = function () {};
  }
}

// Global fetch fallback to guarantee network isolation across unit test suites
if (typeof globalThis.fetch === 'undefined' || !(globalThis.fetch as any)._isMockFunction) {
  const defaultMockFetch = vi.fn().mockImplementation(async () => {
    return new Response(
      JSON.stringify({ ok: true, data: {}, items: [], collections: [], pagination: {} }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  });
  (defaultMockFetch as any)._isMockFunction = true;
  globalThis.fetch = defaultMockFetch;
}

// Global react-pdf mock for jsdom environment
vi.mock('react-pdf', () => ({
  Document: ({ children, onLoadSuccess }: any) => {
    React.useEffect(() => {
      onLoadSuccess?.({ numPages: 2 });
    }, [onLoadSuccess]);
    return React.createElement('div', { 'data-testid': 'mock-pdf-document' }, children);
  },
  Page: ({ pageNumber }: any) =>
    React.createElement('div', { 'data-testid': `mock-pdf-page-${pageNumber}`, style: { width: 600, height: 800 } }, `Page Content ${pageNumber}`),
  pdfjs: {
    GlobalWorkerOptions: {
      workerSrc: '',
    },
  },
}));

// Global mocks initialized before any hoisted vi.mock calls
const { globalToast, globalNavigation, defaultActiveDoc, globalReviewMocks } = vi.hoisted(() => {
  const globalToast = {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  };
  (globalThis as any).__globalToast = globalToast;

  const globalNavigation = {
    params: { projectId: 'proj-123', pageId: 'doc-1' } as Record<string, string>,
    pathname: '/editor/proj-123',
    router: {
      push: vi.fn(),
      replace: vi.fn(),
      prefetch: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
      refresh: vi.fn(),
    },
  };
  (globalThis as any).__globalNavigation = globalNavigation;

  const defaultActiveDoc = {
    isLoading: false,
    activePage: {
      id: 'doc-1',
      title: 'main.tex',
      content: '\\section{Introduction}\nThis is LaTeX source code.',
    },
    isAssetTab: false,
    displayPage: {
      id: 'doc-1',
      title: 'main.tex',
      content: '\\section{Introduction}\nThis is LaTeX source code.',
    },
    pageId: 'doc-1',
    fileId: 'doc-1',
    selectedAsset: null,
    selectFile: vi.fn(),
    parentPage: null,
    childFiles: [
      {
        id: 'doc-1',
        title: 'main.tex',
        content: '\\section{Introduction}\nThis is LaTeX source code.',
      },
      {
        id: 'doc-bib',
        title: 'ref.bib',
        content: '@article{einstein, author={A. Einstein}}',
      },
    ],
  };
  (globalThis as any).__mockActiveDocument = { ...defaultActiveDoc };

  const globalReviewMocks = {
    mockComments: [] as any[],
    mockSuggestions: [] as any[],
    mockMutateUpdate: vi.fn(),
    mockMutateResolve: vi.fn(),
    mockMutateDelete: vi.fn(),
    mockMutateDeleteReply: vi.fn(),
    mockMutateAddReply: vi.fn(),
    mockMutateCreate: vi.fn(),
    mockMutateAcceptSuggestion: vi.fn(),
    mockMutateRejectSuggestion: vi.fn(),
    mockMutateAcceptAll: vi.fn(),
    mockMutateRejectAll: vi.fn(),
  };
  (globalThis as any).__reviewMocks = globalReviewMocks;

  return { globalToast, globalNavigation, defaultActiveDoc, globalReviewMocks };
});

vi.mock('sonner', () => {
  return {
    toast: globalToast,
    Toaster: () => null,
  };
});

vi.mock('next/navigation', () => ({
  useRouter: () => globalNavigation.router,
  usePathname: () => globalNavigation.pathname,
  useSearchParams: () => new URLSearchParams(),
  useParams: () => globalNavigation.params,
}));

vi.mock('@/features/editor/ui/hooks/useActiveDocument', () => ({
  useActiveDocument: () => (globalThis as any).__mockActiveDocument,
}));

vi.mock('@/features/editor/subsystems/review/ui/hooks/useComment', () => {
  return {
    usePageComments: () => ({ data: globalReviewMocks.mockComments, isLoading: false, isError: false }),
    useResolveComment: () => ({ mutate: globalReviewMocks.mockMutateResolve, isPending: false }),
    useDeleteComment: () => ({ mutate: globalReviewMocks.mockMutateDelete, isPending: false }),
    useDeleteReply: () => ({ mutate: globalReviewMocks.mockMutateDeleteReply, isPending: false }),
    useAddReply: () => ({ mutate: globalReviewMocks.mockMutateAddReply, isPending: false }),
    useCreateComment: () => ({ mutate: globalReviewMocks.mockMutateCreate, isPending: false }),
    useUpdateComment: () => ({ mutate: globalReviewMocks.mockMutateUpdate, isPending: false }),
    commentKeys: { all: ['page-comments'], byPage: () => ['page-comments'] },
    useSafeQueryClient: vi.fn(),
  };
});

vi.mock('@/features/editor/subsystems/review/ui/hooks/useSuggestion', () => {
  return {
    usePageSuggestions: () => ({ data: globalReviewMocks.mockSuggestions, isLoading: false, isError: false }),
    useAcceptSuggestion: () => ({ mutate: globalReviewMocks.mockMutateAcceptSuggestion, isPending: false }),
    useRejectSuggestion: () => ({ mutate: globalReviewMocks.mockMutateRejectSuggestion, isPending: false }),
    useAcceptAllSuggestions: () => ({ mutate: globalReviewMocks.mockMutateAcceptAll, isPending: false }),
    useRejectAllSuggestions: () => ({ mutate: globalReviewMocks.mockMutateRejectAll, isPending: false }),
    useCreateSuggestion: () => ({ mutate: vi.fn(), isPending: false }),
    suggestionKeys: { all: ['page-suggestions'], byPage: () => ['page-suggestions'] },
  };
});


