import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Toaster } from 'sonner';
import '@/shared/styles/globals.css';
import Providers from './providers';

const geistSans = Geist({
  variable: '--font-sans',
  subsets: ['latin'],
  display: 'swap',
});

const geistMono = Geist_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
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
      className={`${geistSans.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <body
        className="font-sans antialiased bg-background text-foreground selection:bg-primary/20 selection:text-primary min-h-dvh flex flex-col"
      >
        <Toaster
          position="bottom-right"
          closeButton
          richColors
          toastOptions={{
            classNames: {
              toast:
                'bg-background text-foreground border border-border shadow-md font-sans rounded-xl p-3.5 flex items-start gap-3',
              title: 'font-medium text-sm text-foreground',
              description: 'text-muted-foreground text-xs mt-0.5',
              closeButton:
                '!bg-transparent !border-none !text-muted-foreground hover:!text-foreground !top-2.5 !right-2.5',
            },
          }}
        />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
