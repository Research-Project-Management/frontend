'use client';

import { useRef, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { motion, useInView } from 'framer-motion';
import {
  FileText,
  Braces,
  CheckSquare,
  Sparkles,
  Upload,
  Users,
  ArrowRight,
  ArrowUpRight,
} from 'lucide-react';

import Navbar from '../components/navbar';
import Footer from '../components/footer';
import { hasAuthToken, getAuthToken } from '@/shared/lib/token-storage';
import { isTokenValid } from '@/shared/utils/auth-token.util';

// ─── Animation Variants (Snappy Easings 200–350ms) ───────────────────────────

const snappyEase = [0.16, 1, 0.3, 1] as const;

const fadeUpBase = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: snappyEase },
  },
};

const staggerContainer = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.04,
    },
  },
};

const cardVariant = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: snappyEase },
  },
};

function makeDelayed(delay: number) {
  return {
    hidden: { opacity: 0, y: 14 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.35, ease: snappyEase, delay },
    },
  };
}

function makeFadeDelayed(delay: number) {
  return {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { duration: 0.3, ease: snappyEase, delay },
    },
  };
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

function useScrollReveal() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-60px 0px' });
  return { ref, isInView };
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const featuresReveal = useScrollReveal();
  const stepsReveal = useScrollReveal();
  const statsReveal = useScrollReveal();
  const ctaReveal = useScrollReveal();

  const router = useRouter();
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isAuthenticated = mounted && Boolean(user || (typeof window !== 'undefined' && hasAuthToken() && isTokenValid(getAuthToken())));

  return (
    <div className='min-h-screen flex flex-col bg-background text-foreground transition-colors duration-150'>
      <Navbar />

      {/* ── Hero Section ── */}
      <section className='pt-24 pb-14 sm:pt-28 lg:pt-32 lg:pb-20'>
        <div className='flux-container'>
          <div className='max-w-3xl mx-auto text-center space-y-5'>

            {/* Badge */}
            <motion.div
              variants={makeFadeDelayed(0)}
              initial='hidden'
              animate='visible'
              className='inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-11 font-medium tracking-wide text-muted-foreground shadow-hairline'
            >
              <span className='size-1.5 rounded-full bg-primary' aria-hidden='true' />
              Beta
            </motion.div>

            {/* H1 */}
            <motion.h1
              variants={makeDelayed(0.06)}
              initial='hidden'
              animate='visible'
              className='text-3xl font-semibold leading-tight tracking-tight sm:text-5xl lg:text-6xl text-foreground'
            >
              The workspace for
              <br />
              research teams
            </motion.h1>

            {/* Subtext */}
            <motion.p
              variants={makeDelayed(0.12)}
              initial='hidden'
              animate='visible'
              className='text-base sm:text-lg text-muted-foreground leading-relaxed max-w-xl mx-auto'
            >
              Write, collaborate, and manage your research — all in one place.
              Built for teams who move fast without losing context.
            </motion.p>

            {/* CTAs */}
            <motion.div
              variants={makeDelayed(0.18)}
              initial='hidden'
              animate='visible'
              className='flex flex-col sm:flex-row gap-2.5 justify-center pt-2'
            >
              <Link
                href={isAuthenticated ? '/home' : '/register'}
                className='group flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-4 text-13 font-medium text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer shrink-0 shadow-2xs'
              >
                Start for free
                <ArrowRight className='size-3.5 transition-transform group-hover:translate-x-0.5 shrink-0' aria-hidden='true' />
              </Link>
              <Link
                href={isAuthenticated ? '/home' : '/login'}
                className='flex h-9 items-center justify-center rounded-md border border-border bg-card shadow-hairline px-4 text-13 font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer shrink-0'
              >
                Sign in
              </Link>
            </motion.div>
          </div>

          {/* Screenshot Preview */}
          <motion.div
            variants={makeDelayed(0.24)}
            initial='hidden'
            animate='visible'
            className='mt-12 lg:mt-16 mx-auto max-w-5xl'
          >
            <div className='overflow-hidden rounded-lg border border-border bg-card shadow-overlay'>
              <img
                src='/screenshot.png'
                alt='Flux workspace showing project dashboard with kanban board and document editor'
                className='w-full h-auto object-cover'
                loading='eager'
              />
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Features ── */}
      <section
        id='features'
        ref={featuresReveal.ref}
        className='flux-section border-t border-border'
        aria-labelledby='features-heading'
      >
        <div className='flux-container'>
          <motion.div
            variants={fadeUpBase}
            initial='hidden'
            animate={featuresReveal.isInView ? 'visible' : 'hidden'}
            className='max-w-2xl mb-12'
          >
            <h2 id='features-heading' className='text-2xl font-semibold tracking-tight sm:text-3xl lg:text-4xl text-foreground'>
              Everything your team needs
            </h2>
            <p className='text-muted-foreground mt-2.5 text-base sm:text-lg leading-relaxed'>
              A focused set of tools designed for research workflows — from
              writing papers to managing project timelines.
            </p>
          </motion.div>

          <motion.div
            variants={staggerContainer}
            initial='hidden'
            animate={featuresReveal.isInView ? 'visible' : 'hidden'}
            className='grid gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-2 lg:grid-cols-3 shadow-hairline'
          >
            <FeatureCard
              icon={<FileText className='size-5 shrink-0' aria-hidden='true' />}
              title='Rich editor'
              description='Write documents with a powerful block editor. Supports markdown, code, math, and collaborative editing in real-time.'
            />
            <FeatureCard
              icon={<Braces className='size-5 shrink-0' aria-hidden='true' />}
              title='LaTeX compiler'
              description='Write and compile LaTeX directly in the browser. Multi-file projects, BibTeX, and instant PDF preview.'
            />
            <FeatureCard
              icon={<CheckSquare className='size-5 shrink-0' aria-hidden='true' />}
              title='Work item management'
              description='Track progress with work items, deadlines, and priorities. Kanban boards and list views to match your workflow.'
            />
            <FeatureCard
              icon={<Sparkles className='size-5 shrink-0' aria-hidden='true' />}
              title='AI assistant'
              description='Ask questions about your documents. The AI reads your uploaded files and gives contextual answers with sources.'
              isAi
            />
            <FeatureCard
              icon={<Upload className='size-5 shrink-0' aria-hidden='true' />}
              title='File storage'
              description='Upload and organize files per project. Version history, instant preview, and secure cloud storage included.'
            />
            <FeatureCard
              icon={<Users className='size-5 shrink-0' aria-hidden='true' />}
              title='Team collaboration'
              description='Invite members with role-based access. Real-time presence, comments, and activity feeds keep everyone aligned.'
            />
          </motion.div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section
        id='how-it-works'
        ref={stepsReveal.ref}
        className='flux-section border-t border-border bg-panel/30'
        aria-labelledby='how-heading'
      >
        <div className='flux-container'>
          <motion.div
            variants={fadeUpBase}
            initial='hidden'
            animate={stepsReveal.isInView ? 'visible' : 'hidden'}
            className='max-w-2xl mb-12'
          >
            <h2 id='how-heading' className='text-2xl font-semibold tracking-tight sm:text-3xl lg:text-4xl text-foreground'>
              From idea to publication
            </h2>
          </motion.div>

          <motion.div
            variants={staggerContainer}
            initial='hidden'
            animate={stepsReveal.isInView ? 'visible' : 'hidden'}
            className='grid lg:grid-cols-3 gap-8'
          >
            <StepCard
              step='01'
              title='Create a project'
              description='Organize your research by topic, deadline, or paper. Invite team members, advisors, and reviewers directly to your project.'
            />
            <StepCard
              step='02'
              title='Write and collaborate'
              description='Use the rich editor or LaTeX compiler to write papers together. Everything syncs in real-time across your team.'
            />
            <StepCard
              step='03'
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
            className='grid grid-cols-2 lg:grid-cols-4 gap-8 md:gap-12 py-4'
          >
            <div className='space-y-1'>
              <h3 className='text-3xl sm:text-4xl font-semibold tabular-nums tracking-tight text-foreground font-mono'>99.9%</h3>
              <p className='text-13 font-medium text-muted-foreground'>Uptime</p>
            </div>
            <div className='space-y-1'>
              <h3 className='text-3xl sm:text-4xl font-semibold tabular-nums tracking-tight text-foreground font-mono'>&lt;1s</h3>
              <p className='text-13 font-medium text-muted-foreground'>Compile time</p>
            </div>
            <div className='space-y-1'>
              <h3 className='text-3xl sm:text-4xl font-semibold tracking-tight text-foreground font-mono'>E2E</h3>
              <p className='text-13 font-medium text-muted-foreground'>Encrypted</p>
            </div>
            <div className='space-y-1'>
              <h3 className='text-3xl sm:text-4xl font-semibold tracking-tight text-foreground font-mono'>Free</h3>
              <p className='text-13 font-medium text-muted-foreground'>No credit card</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Ready to start CTA ── */}
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
            className='max-w-2xl mx-auto text-center space-y-5 rounded-lg border border-border bg-card p-8 sm:p-12 shadow-hairline'
          >
            <h2 id='cta-heading' className='text-2xl font-semibold tracking-tight sm:text-3xl text-foreground'>
              Ready to start?
            </h2>
            <p className='text-base text-muted-foreground max-w-lg mx-auto leading-relaxed'>
              Start your research project in under a minute. Free forever for small teams.
            </p>
            <div className='flex flex-col sm:flex-row gap-2.5 justify-center pt-2'>
              <Link
                href={isAuthenticated ? '/home' : '/register'}
                className='group flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-4 text-13 font-medium text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer shrink-0 shadow-2xs'
              >
                Get started
                <ArrowRight className='size-3.5 transition-transform group-hover:translate-x-0.5 shrink-0' aria-hidden='true' />
              </Link>
              <a
                href='https://github.com/Research-Project-TDTU'
                target='_blank'
                rel='noopener noreferrer'
                className='flex h-9 items-center justify-center gap-1.5 rounded-md border border-border bg-card shadow-hairline px-4 text-13 font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer shrink-0'
              >
                View on GitHub
                <ArrowUpRight className='size-3.5 shrink-0' aria-hidden='true' />
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function FeatureCard({
  icon,
  title,
  description,
  isAi = false,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  isAi?: boolean;
}) {
  return (
    <motion.div
      variants={cardVariant}
      className='group space-y-3 bg-card p-6 transition-colors hover:bg-muted/40 lg:p-7 relative'
    >
      <div className={`inline-flex ${isAi ? 'text-ai' : 'text-primary'} transition-transform duration-150 ease-out group-hover:scale-105 origin-left`}>
        {icon}
      </div>
      <h3 className='text-14 font-semibold text-foreground tracking-tight'>{title}</h3>
      <p className='text-13 text-muted-foreground leading-relaxed'>
        {description}
      </p>
    </motion.div>
  );
}

function StepCard({
  step,
  title,
  description,
}: {
  step: string;
  title: string;
  description: string;
}) {
  return (
    <motion.div variants={cardVariant} className='space-y-2.5 rounded-md border border-border bg-card p-6 shadow-hairline'>
      <span className='font-mono text-12 font-medium text-primary bg-primary-subtle px-2 py-0.5 rounded border border-primary-border w-fit inline-block'>
        {step}
      </span>
      <h3 className='text-base font-semibold text-foreground'>{title}</h3>
      <p className='text-13 text-muted-foreground leading-relaxed'>{description}</p>
    </motion.div>
  );
}
