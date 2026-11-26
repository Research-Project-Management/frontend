import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Flux · Research & Collaboration Workspace',
    short_name: 'Flux',
    description:
      'The all-in-one workspace for research teams. Collaborate seamlessly, manage projects efficiently, and accelerate your research workflow.',
    start_url: '/home',
    display: 'standalone',
    background_color: '#09090b',
    theme_color: '#09090b',
    icons: [
      {
        src: '/Flux.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
  };
}
