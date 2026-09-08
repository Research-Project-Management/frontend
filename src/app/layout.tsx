import type { Metadata } from 'next';
import { Inter, IBM_Plex_Mono } from 'next/font/google';
import { Toaster } from '@/shared/components/ui/sonner';
import '@/shared/styles/globals.css';
import Providers from './providers';

const inter = Inter({
  subsets: ['latin', 'vietnamese'],
  variable: '--font-sans',
  display: 'swap',
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Flux - Keep Research Moving Forward',
  description:
    'The all-in-one workspace for research teams. Collaborate seamlessly, manage projects efficiently, and accelerate your research workflow with AI-powered tools.',
  keywords:
    'research management, project management, team collaboration, AI assistant, documentation, task tracking, file storage',
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
      className={`${inter.variable} ${ibmPlexMono.variable}`}
      suppressHydrationWarning
    >
      <body
        className="font-sans antialiased bg-background text-foreground selection:bg-primary/20 selection:text-primary min-h-dvh flex flex-col"
      >
        <Toaster />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
