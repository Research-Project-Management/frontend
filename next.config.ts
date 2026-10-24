import type { NextConfig } from 'next';

const isStandalone =
  process.env.STANDALONE === 'true' || process.env.DOCKER_BUILD === 'true';

const nextConfig: NextConfig = {
  reactCompiler: true,
  distDir: process.env.NEXT_DIST_DIR || '.next',
  reactStrictMode: false,
  poweredByHeader: false,
  compress: true,
  devIndicators: false,
  output: isStandalone ? 'standalone' : undefined,
  serverExternalPackages: ['pdfjs-dist'],
  allowedDevOrigins: [
    'localhost:2915',
    '127.0.0.1:2915',
    'localhost:3000',
    '127.0.0.1:3000',
    'localhost',
    '127.0.0.1',
  ],

  transpilePackages: ['yjs', 'y-protocols', 'y-codemirror.next'],

  turbopack: {
    resolveAlias: {
      'pdfjs-dist': 'pdfjs-dist/legacy/build/pdf.mjs',
      yjs: 'yjs/dist/yjs.mjs',
      'y-codemirror.next': 'y-codemirror.next/src/index.js',
    },
    resolveExtensions: ['.tsx', '.ts', '.jsx', '.js', '.json', '.mjs'],
  },

  webpack: (config, { isServer }) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      yjs$: 'yjs/dist/yjs.mjs',
      'y-codemirror.next$': 'y-codemirror.next/src/index.js',
    };

    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        'pdfjs-dist$': 'pdfjs-dist/build/pdf.min.mjs',
      };
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
      };
    } else {
      config.resolve.alias = {
        ...config.resolve.alias,
        'pdfjs-dist$': 'pdfjs-dist/legacy/build/pdf.mjs',
      };
    }

    return config;
  },

  images: {
    qualities: [75, 85, 90, 100],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },

  compiler: {
    removeConsole:
      process.env.NODE_ENV === 'production'
        ? {
            exclude: ['error', 'warn'],
          }
        : false,
  },

  experimental: {
    turbopackRustReactCompiler: true,
    turbopackFileSystemCacheForDev: true,
    turbopackFileSystemCacheForBuild: false,
    proxyClientMaxBodySize: '100mb',
    optimizePackageImports: [
      'lucide-react',
      'framer-motion',
      'date-fns',
      '@tanstack/react-query',
      'recharts',
      'katex',
      'cmdk',
      '@dnd-kit/core',
      '@dnd-kit/sortable',
      '@dnd-kit/utilities',
      '@radix-ui/react-accordion',
      '@radix-ui/react-alert-dialog',
      '@radix-ui/react-aspect-ratio',
      '@radix-ui/react-checkbox',
      '@radix-ui/react-collapsible',
      '@radix-ui/react-context-menu',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-hover-card',
      '@radix-ui/react-label',
      '@radix-ui/react-menubar',
      '@radix-ui/react-navigation-menu',
      '@radix-ui/react-popover',
      '@radix-ui/react-progress',
      '@radix-ui/react-radio-group',
      '@radix-ui/react-scroll-area',
      '@radix-ui/react-select',
      '@radix-ui/react-separator',
      '@radix-ui/react-slider',
      '@radix-ui/react-slot',
      '@radix-ui/react-switch',
      '@radix-ui/react-tabs',
      '@radix-ui/react-toggle',
      '@radix-ui/react-toggle-group',
      '@radix-ui/react-tooltip',
      '@tanstack/react-virtual',
      'vaul',
      'embla-carousel-react',
      'react-day-picker',
      'zustand',
      'dompurify',
      '@codemirror/view',
      '@codemirror/state',
      '@codemirror/language',
      '@codemirror/commands',
      '@codemirror/lint',
      '@codemirror/autocomplete',
      '@codemirror/search',
      'socket.io-client',
      'sonner',
      'tailwind-merge',
      'clsx',
      'axios',
    ],
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' blob: https://cdn.jsdelivr.net https://cdnjs.cloudflare.com",
              "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com",
              "img-src 'self' blob: data: https:",
              "font-src 'self' data: https:",
              "connect-src 'self' blob: data: http: https: ws: wss:",
              "frame-src 'self' blob: https:",
              "worker-src 'self' blob:",
              "object-src 'none'",
              "base-uri 'self'",
              "frame-ancestors 'none'",
            ].join('; '),
          },
        ],
      },
    ];
  },

  async redirects() {
    const excludedPrefixes =
      'api|auth|health|projects|library|storage|settings|stickies|your-work|ai|dashboard|editor|invite|workspace-invites|login|register|forgot-password|reset-password|pages';
    return [
      {
        source: `/:workspaceId((?!${excludedPrefixes}).+)/projects/:projectId/:path*`,
        destination: '/projects/:projectId/:path*',
        permanent: false,
      },
      {
        source: `/:workspaceId((?!${excludedPrefixes}).+)/projects/:projectId`,
        destination: '/projects/:projectId',
        permanent: false,
      },
      {
        source: `/:workspaceId((?!${excludedPrefixes}).+)/projects`,
        destination: '/projects',
        permanent: false,
      },
      {
        source: `/:workspaceId((?!${excludedPrefixes}).+)/library/:path*`,
        destination: '/library/:path*',
        permanent: false,
      },
      {
        source: `/:workspaceId((?!${excludedPrefixes}).+)/library`,
        destination: '/library',
        permanent: false,
      },
      {
        source: `/:workspaceId((?!${excludedPrefixes}).+)/storage/:path*`,
        destination: '/storage/:path*',
        permanent: false,
      },
      {
        source: `/:workspaceId((?!${excludedPrefixes}).+)/storage`,
        destination: '/storage',
        permanent: false,
      },
      {
        source: `/:workspaceId((?!${excludedPrefixes}).+)/settings/:path*`,
        destination: '/settings/:path*',
        permanent: false,
      },
      {
        source: `/:workspaceId((?!${excludedPrefixes}).+)/settings`,
        destination: '/settings',
        permanent: false,
      },
      {
        source: `/:workspaceId((?!${excludedPrefixes}).+)/stickies`,
        destination: '/stickies',
        permanent: false,
      },
      {
        source: `/:workspaceId((?!${excludedPrefixes}).+)/your-work`,
        destination: '/your-work',
        permanent: false,
      },
      {
        source: `/:workspaceId((?!${excludedPrefixes}).+)/ai/:path*`,
        destination: '/ai/:path*',
        permanent: false,
      },
      {
        source: `/:workspaceId((?!${excludedPrefixes}).+)/ai`,
        destination: '/ai',
        permanent: false,
      },
      {
        source: `/:workspaceId((?!${excludedPrefixes}).+)/editor/:path*`,
        destination: '/editor/:path*',
        permanent: false,
      },
      {
        source: '/dashboard',
        destination: '/home',
        permanent: true,
      },
      {
        source: '/dashboard/:path*',
        destination: '/home/:path*',
        permanent: true,
      },
      {
        source: '/archives',
        destination: '/projects/archives',
        permanent: true,
      },
      {
        source: '/projects/sticky',
        destination: '/stickies',
        permanent: true,
      },
      {
        source: '/projects/stickies',
        destination: '/stickies',
        permanent: true,
      },
      {
        source: '/editor',
        destination: '/projects',
        permanent: false,
      },
      {
        source: '/ws',
        destination: '/projects',
        permanent: false,
      },
    ];
  },

  async rewrites() {
    const backendUrl =
      process.env.INTERNAL_API_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      'http://127.0.0.1:3000';
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
      {
        source: '/auth/:path*',
        destination: `${backendUrl}/auth/:path*`,
      },
      {
        source: '/socket.io/:path*',
        destination: `${backendUrl}/socket.io/:path*`,
      },
      {
        source: '/notifications',
        destination: `${backendUrl}/notifications`,
      },
      {
        source: '/notifications/:path*',
        destination: `${backendUrl}/notifications/:path*`,
      },
      {
        source: '/:path*/pdf.worker.mjs',
        destination: '/pdf.worker.mjs',
      },
      {
        source: '/:path*/pdf.worker.min.mjs',
        destination: '/pdf.worker.min.mjs',
      },
    ];
  },
};

export default nextConfig;
