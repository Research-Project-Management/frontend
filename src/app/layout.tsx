import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { Toaster } from "@/shared/components/ui/sonner";
import '@/shared/styles/globals.css';
import Providers from './providers';

const inter = localFont({
  src: [
    {
      path: './fonts/Inter-400.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: './fonts/Inter-500.woff2',
      weight: '500',
      style: 'normal',
    },
    {
      path: './fonts/Inter-600.woff2',
      weight: '600',
      style: 'normal',
    },
    {
      path: './fonts/Inter-700.woff2',
      weight: '700',
      style: 'normal',
    },
  ],
  variable: '--font-inter',
  display: 'swap',
});

const ibmPlexMono = localFont({
  src: [
    {
      path: './fonts/IBMPlexMono-400.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: './fonts/IBMPlexMono-500.woff2',
      weight: '500',
      style: 'normal',
    },
    {
      path: './fonts/IBMPlexMono-600.woff2',
      weight: '600',
      style: 'normal',
    },
    {
      path: './fonts/IBMPlexMono-700.woff2',
      weight: '700',
      style: 'normal',
    },
  ],
  variable: '--font-ibm-plex-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Flux - Keep Research Moving Forward',
  description:
    'The all-in-one workspace for research teams. Collaborate seamlessly, manage projects efficiently, and accelerate your research workflow with AI-powered tools.',
  keywords:
    'research management, project management, team collaboration, AI assistant, documentation, work item tracking, file storage',
  openGraph: {
    title: 'Flux - Keep Research Moving Forward',
    description:
      'The all-in-one workspace for research teams to collaborate and deliver results faster.',
    type: 'website',
  },
  icons: {
    icon: '/Flux.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${ibmPlexMono.variable} font-sans antialiased`}
      suppressHydrationWarning
    >
      <body
        className="font-sans antialiased bg-background text-foreground min-h-dvh flex flex-col"
        suppressHydrationWarning
      >
        <script
          id="flux-theme-init"
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('flux-theme')||'system';var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme:dark)').matches);if(d){document.documentElement.classList.add('dark')}else{document.documentElement.classList.remove('dark')};}catch(e){}})();`,
          }}
        />
        <Toaster />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
