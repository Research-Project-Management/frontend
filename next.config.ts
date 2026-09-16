import type { NextConfig } from 'next';

const isStandalone =
  process.env.STANDALONE === 'true' || process.env.DOCKER_BUILD === 'true';

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || '.next',
  reactStrictMode: false,
  poweredByHeader: false,
  compress: true,
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

  turbopack: {
    resolveAlias: {
      'pdfjs-dist': 'pdfjs-dist/build/pdf.min.mjs',
      'monaco-editor/esm/vs/editor/editor.api': 'monaco-editor',
      'monaco-editor/esm/vs/editor/editor.api.js': 'monaco-editor',
      'monaco-editor/esm/vs': 'monaco-editor',
    },
    rules: {
      '*.svg': {
        loaders: ['@svgr/webpack'],
        as: '*.js',
      },
    },
  },

  webpack: (config, { isServer, dev }) => {
    config.module.rules.push({
      test: /\.svg$/,
      use: ['@svgr/webpack'],
    });

    config.resolve.alias = {
      ...config.resolve.alias,
      'pdfjs-dist$': 'pdfjs-dist/build/pdf.min.mjs',
      'monaco-editor/esm/vs/editor/editor.api$': 'monaco-editor',
      'monaco-editor/esm/vs/editor/editor.api.js$': 'monaco-editor',
      'monaco-editor/esm/vs': 'monaco-editor',
    };

    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
      };
    }

    return config;
  },

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },

  experimental: {
    optimizePackageImports: [
      'lucide-react',
      'framer-motion',
      'date-fns',
      '@tanstack/react-query',
      'recharts',
      'katex',
      '@dnd-kit/core',
      '@dnd-kit/sortable',
      '@dnd-kit/utilities',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-select',
      '@radix-ui/react-tooltip',
      '@radix-ui/react-popover',
      '@radix-ui/react-tabs',
      '@radix-ui/react-accordion',
      'cmdk',
      'sonner',
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
        source: '/ws',
        destination: '/projects',
        permanent: false,
      },
    ];
  },

  async rewrites() {
    const rawBackendUrl =
      process.env.INTERNAL_API_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      'http://localhost:3000';
    const backendUrl =
      rawBackendUrl.trim().replace(/\/+$/, '') || 'http://localhost:3000';
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
        source: '/health/:path*',
        destination: `${backendUrl}/health/:path*`,
      },
    ];
  },
};

export default nextConfig;
