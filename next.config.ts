import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Webpack config to support SVG as React components and Monaco Editor / PDF.js
  webpack: (config, { isServer }) => {
    // Support SVG as React components (replaces vite-plugin-svgr)
    config.module.rules.push({
      test: /\.svg$/,
      use: ['@svgr/webpack'],
    });

    if (!isServer) {
      // Monaco Editor worker files
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
      };
    }
    return config;
  },
  // Image domains (add as needed)
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  experimental: {
    turbo: {
      rules: {
        '*.svg': {
          loaders: ['@svgr/webpack'],
          as: '*.js',
        },
      },
    },
    optimizePackageImports: [
      'lucide-react',
      '@heroicons/react',
      'framer-motion',
      'date-fns',
      '@radix-ui/react-icons',
      '@/features/projects',
      '@/features/workspaces',
      '@/features/settings',
      '@/features/tasks',
      '@/features/cycles',
      '@/features/stickies',
      '@/features/storage',
      '@/features/library',
    ],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
