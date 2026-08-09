import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from 'sonner';
import '@/shared/styles/globals.css';
import Providers from './providers';

const inter = Inter({ 
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
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
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans`} suppressHydrationWarning>
        <Providers>
          {children}
          <Toaster richColors position='top-right' />
        </Providers>

      </body>
    </html>
  );
}
