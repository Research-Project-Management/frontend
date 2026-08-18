'use client';

import { useRef, useEffect, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { motion, useInView } from 'framer-motion';
import {
  MessageSquare,
  FileText,
  CheckSquare,
  Upload,
  Users,
  ArrowRight,
  ArrowUpRight,
  Braces,
} from 'lucide-react';

import Navbar from '../components/navbar';
import Footer from '../components/footer';
import { fetchAllWorkspaces } from '@/features/workspaces/shell/services/workspace.service';

// ─── Animation variants ────────────────────────────────────────────────────────

const fadeUpBase = {
  hidden: { opacity: 0, y: 18 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] as const },
  },
};

const fadeInBase = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.5, ease: 'easeOut' as const },
  },
};

const staggerContainer = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.05,
    },
  },
};

const cardVariant = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] as const },
  },
};

function makeDelayed(delay: number) {
  return {
    hidden: { opacity: 0, y: 18 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] as const, delay },
    },
  };
}

function makeFadeDelayed(delay: number) {
  return {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { duration: 0.5, ease: 'easeOut' as const, delay },
    },
  };
}

// ─── Hooks ─────────────────────────────────────────────────────────────────────

function useScrollReveal() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-80px 0px' });
  return { ref, isInView };
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const featuresReveal = useScrollReveal();
  const stepsReveal = useScrollReveal();
  const statsReveal = useScrollReveal();
  const ctaReveal = useScrollReveal();

  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && user) {
      fetchAllWorkspaces()
        .then((data) => {
          if (data.workspaces && data.workspaces.length > 0) {
            router.replace(`/${data.workspaces[0].url}`);
          } else {
            router.replace('/create-workspace');
          }
        })
        .catch(() => {
          router.replace('/create-workspace');
        });
    }
  }, [isLoading, user, router]);

  return (
    <div className='min-h-screen flex flex-col bg-background'>
      <Navbar />

      {/* ── Hero ── */}
      <section className='pt-28 pb-16 sm:pt-32 lg:pt-36 lg:pb-24'>
        <div className='flux-container'>
          <div className='max-w-3xl mx-auto text-center space-y-6'>

            {/* Badge */}
            <motion.div
              variants={makeFadeDelayed(0)}
              initial='hidden'
              animate='visible'
              className='inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground'
            >
              <span className='w-1.5 h-1.5 rounded-full bg-primary/60' aria-hidden='true' />
              Beta
            </motion.div>

            {/* H1 */}
            <motion.h1
              variants={makeDelayed(0.08)}
              initial='hidden'
              animate='visible'
              className='text-4xl font-bold leading-[1.12] tracking-tight sm:text-5xl lg:text-6xl'
            >
              The workspace for
              <br />
              research teams
            </motion.h1>

            {/* Subtext */}
            <motion.p
              variants={makeDelayed(0.16)}
              initial='hidden'
              animate='visible'
              className='text-lg text-muted-foreground leading-relaxed max-w-xl mx-auto'
            >
              Write, collaborate, and manage your research — all in one place.
              Built for teams who move fast without losing context.
            </motion.p>

            {/* CTAs */}
            <motion.div
              variants={makeDelayed(0.24)}
              initial='hidden'
              animate='visible'
              className='flex flex-col sm:flex-row gap-3 justify-center pt-2'
            >
              <Link
                href='/create-workspace'
                className='group flex h-9 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0 cursor-pointer'
              >
                Start for free
                <ArrowRight className='w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5' aria-hidden='true' />
              </Link>
              <Link
                href='/login'
                className='flex h-9 items-center justify-center rounded-lg border border-border bg-card px-5 text-sm font-semibold text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0 cursor-pointer'
              >
                Sign in
              </Link>
            </motion.div>
          </div>

          {/* Screenshot */}
          <motion.div
            variants={makeDelayed(0.36)}
            initial='hidden'
            animate='visible'
            className='mt-14 lg:mt-18 mx-auto max-w-5xl'
          >
            <div className='overflow-hidden rounded-lg border border-border bg-card'>
              <img
                src='/screenshot.png'
                alt='Flux workspace showing project dashboard with kanban board and document editor'
                className='w-full h-auto'
                loading='eager'
              />
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Features ── */}
      <section
        ref={featuresReveal.ref}
        className='flux-section border-t border-border'
        aria-labelledby='features-heading'
      >
        <div className='flux-container'>
          <motion.div
            variants={fadeUpBase}
            initial='hidden'
            animate={featuresReveal.isInView ? 'visible' : 'hidden'}
            className='max-w-2xl mb-14'
          >
            <h2 id='features-heading' className='text-3xl font-bold lg:text-4xl'>
              Everything your team needs
            </h2>
            <p className='text-muted-foreground mt-3 text-lg leading-relaxed'>
              A focused set of tools designed for research workflows — from
              writing papers to managing project timelines.
            </p>
          </motion.div>

          <motion.div
            variants={staggerContainer}
            initial='hidden'
            animate={featuresReveal.isInView ? 'visible' : 'hidden'}
            className='grid overflow-hidden rounded-lg border border-border bg-border md:grid-cols-2 lg:grid-cols-3'
          >
            <FeatureCard
              icon={<FileText className='w-5 h-5' aria-hidden='true' />}
              title='Rich editor'
              description='Write documents with a powerful block editor. Supports markdown, code, math, and collaborative editing in real-time.'
            />
            <FeatureCard
              icon={<Braces className='w-5 h-5' aria-hidden='true' />}
              title='LaTeX compiler'
              description='Write and compile LaTeX directly in the browser. Multi-file projects, BibTeX, and instant PDF preview.'
            />
            <FeatureCard
              icon={<CheckSquare className='w-5 h-5' aria-hidden='true' />}
              title='Task management'
              description='Track progress with tasks, deadlines, and priorities. Kanban boards and list views to match your workflow.'
            />
            <FeatureCard
              icon={<MessageSquare className='w-5 h-5' aria-hidden='true' />}
              title='AI assistant'
              description='Ask questions about your documents. The AI reads your uploaded files and gives contextual answers with sources.'
            />
            <FeatureCard
              icon={<Upload className='w-5 h-5' aria-hidden='true' />}
              title='File storage'
              description='Upload and organize files per project. Version history, instant preview, and secure cloud storage included.'
            />
            <FeatureCard
              icon={<Users className='w-5 h-5' aria-hidden='true' />}
              title='Team collaboration'
              description='Invite members with role-based access. Real-time presence, comments, and activity feeds keep everyone aligned.'
            />
          </motion.div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section
        ref={stepsReveal.ref}
        className='flux-section border-t border-border bg-secondary/40'
        aria-labelledby='how-heading'
      >
        <div className='flux-container'>
          <motion.div
            variants={fadeUpBase}
            initial='hidden'
            animate={stepsReveal.isInView ? 'visible' : 'hidden'}
            className='max-w-2xl mb-14'
          >
            <h2 id='how-heading' className='text-3xl font-bold lg:text-4xl'>
              From idea to publication
            </h2>
          </motion.div>

          <motion.div
            variants={staggerContainer}
            initial='hidden'
            animate={stepsReveal.isInView ? 'visible' : 'hidden'}
            className='grid lg:grid-cols-3 gap-12'
          >
            <StepCard
              title='Create a workspace'
              description='Set up your research workspace in seconds. Invite your team and organize projects by topic, deadline, or department.'
            />
            <StepCard
              title='Write and collaborate'
              description='Use the rich editor or LaTeX compiler to write papers together. Everything syncs in real-time across your team.'
            />
            <StepCard
              title='Ship your research'
              description='Export to PDF, compile LaTeX, and manage versions. Your work is always backed up and ready to submit.'
            />
          </motion.div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section
        ref={statsReveal.ref}
        className='flux-section border-t border-border'
        aria-label='Platform statistics'
      >
        <div className='flux-container'>
          <motion.div
            variants={staggerContainer}
            initial='hidden'
            animate={statsReveal.isInView ? 'visible' : 'hidden'}
            className='grid grid-cols-2 lg:grid-cols-4 gap-8 md:gap-12 py-8'
          >
            <motion.div variants={fadeUpBase} className='group space-y-2'>
              <h3 className='text-4xl font-bold tracking-tight transition-transform duration-300 ease-out group-hover:-translate-y-1'>99.9%</h3>
              <p className='text-sm font-medium text-muted-foreground'>Uptime</p>
            </motion.div>
            <motion.div variants={fadeUpBase} className='group space-y-2'>
              <h3 className='text-4xl font-bold tracking-tight transition-transform duration-300 ease-out group-hover:-translate-y-1'>&lt;1s</h3>
              <p className='text-sm font-medium text-muted-foreground'>Compile time</p>
            </motion.div>
            <motion.div variants={fadeUpBase} className='group space-y-2'>
              <h3 className='text-4xl font-bold tracking-tight transition-transform duration-300 ease-out group-hover:-translate-y-1'>E2E</h3>
              <p className='text-sm font-medium text-muted-foreground'>Encrypted</p>
            </motion.div>
            <motion.div variants={fadeUpBase} className='group space-y-2'>
              <h3 className='text-4xl font-bold tracking-tight transition-transform duration-300 ease-out group-hover:-translate-y-1'>Free</h3>
              <p className='text-sm font-medium text-muted-foreground'>No credit card</p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section
        ref={ctaReveal.ref}
        className='flux-section border-t border-border'
        aria-labelledby='cta-heading'
      >
        <div className='flux-container'>
          <motion.div
            variants={fadeUpBase}
            initial='hidden'
            animate={ctaReveal.isInView ? 'visible' : 'hidden'}
            className='max-w-2xl mx-auto text-center space-y-6'
          >
            <h2 id='cta-heading' className='text-3xl font-bold lg:text-4xl'>
              Ready to start?
            </h2>
            <p className='text-lg text-muted-foreground'>
              Create your workspace in under a minute. Free forever for small
              teams.
            </p>
            <div className='flex flex-col sm:flex-row gap-3 justify-center pt-2'>
              <Link
                href='/create-workspace'
                className='group flex h-9 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0 cursor-pointer'
              >
                Create workspace
                <ArrowRight className='w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5' aria-hidden='true' />
              </Link>
              <a
                href='https://github.com/Research-Project-TDTU'
                target='_blank'
                rel='noopener noreferrer'
                className='flex h-9 items-center justify-center gap-2 rounded-lg border border-border bg-card px-5 text-sm font-semibold text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0 cursor-pointer'
              >
                View on GitHub
                <ArrowUpRight className='w-3.5 h-3.5' aria-hidden='true' />
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <motion.div
      variants={cardVariant}
      className='group space-y-3 bg-card p-6 transition-colors hover:bg-secondary lg:p-8'
    >
      <div className='inline-flex text-muted-foreground transition-transform duration-300 ease-out group-hover:scale-110 group-hover:text-foreground origin-left'>
        {icon}
      </div>
      <h3 className='text-base font-semibold'>{title}</h3>
      <p className='text-base text-muted-foreground leading-relaxed'>
        {description}
      </p>
    </motion.div>
  );
}

function StepCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <motion.div variants={cardVariant} className='space-y-3'>
      <h3 className='text-xl font-semibold transition-colors duration-200 group-hover:text-primary'>{title}</h3>
      <p className='text-muted-foreground leading-relaxed'>{description}</p>
    </motion.div>
  );
}
