import type { ReactNode } from 'react';
import Image from 'next/image';
import {
  FileText,
  Braces,
  CheckSquare,
  Bot,
  BookOpen,
  Users,
} from 'lucide-react';

import Navbar from '../components/navbar';
import Footer from '../components/footer';
import { HeroCta } from '../components/hero-cta';
import { SectionCta } from '../components/section-cta';
import {
  MotionReveal,
  MotionStaggerContainer,
  MotionItem,
} from '../components/motion-reveal';

export default function LandingPage() {
  return (
    <div className='min-h-screen flex flex-col bg-background text-foreground transition-colors duration-150'>
      <Navbar />

      {/* ── Hero Section ── */}
      <section className='pt-24 pb-14 sm:pt-28 lg:pt-32 lg:pb-20'>
        <div className='flux-container'>
          <div className='max-w-3xl mx-auto text-center space-y-5'>

            {/* Badge */}
            <MotionReveal delay={0} yOffset={8}>
              <div className='inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-11 font-medium tracking-wide text-muted-foreground shadow-hairline'>
                <span className='size-1.5 rounded-full bg-primary' aria-hidden='true' />
                Beta
              </div>
            </MotionReveal>

            {/* H1 */}
            <MotionReveal delay={0.06} yOffset={14}>
              <h1 className='text-3xl font-semibold leading-tight tracking-tight sm:text-5xl lg:text-6xl text-foreground'>
                The workspace for
                <br />
                research teams
              </h1>
            </MotionReveal>

            {/* Subtext */}
            <MotionReveal delay={0.12} yOffset={14}>
              <p className='text-base sm:text-lg text-muted-foreground leading-relaxed max-w-xl mx-auto'>
                Write, collaborate, and manage your research - all in one place.
                Built for teams who move fast without losing context.
              </p>
            </MotionReveal>

            {/* CTAs (Client Island for Auth State) */}
            <MotionReveal delay={0.18} yOffset={14}>
              <HeroCta />
            </MotionReveal>
          </div>

          {/* Screenshot Preview */}
          <MotionReveal delay={0.24} yOffset={16} className='mt-12 lg:mt-16 mx-auto max-w-5xl'>
            <div className='overflow-hidden rounded-lg border border-border bg-card shadow-overlay'>
              <Image
                src='/screenshot.png'
                alt='Flux workspace showing project dashboard with kanban board and document editor'
                width={2490}
                height={1447}
                priority
                quality={90}
                sizes='(max-width: 1024px) 100vw, 1024px'
                className='w-full h-auto object-cover'
              />
            </div>
          </MotionReveal>
        </div>
      </section>

      {/* ── Features ── */}
      <section
        id='features'
        className='flux-section border-t border-border'
        aria-labelledby='features-heading'
      >
        <div className='flux-container'>
          <MotionReveal className='max-w-2xl mb-12'>
            <h2 id='features-heading' className='text-2xl font-semibold tracking-tight sm:text-3xl lg:text-4xl text-foreground'>
              Everything your team needs
            </h2>
            <p className='text-muted-foreground mt-2.5 text-base sm:text-lg leading-relaxed'>
              A focused set of tools designed for research workflows - from
              writing papers to managing project timelines.
            </p>
          </MotionReveal>

          <MotionStaggerContainer className='grid gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-2 lg:grid-cols-3 shadow-hairline'>
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
              icon={<Bot className='size-5 shrink-0' aria-hidden='true' />}
              title='AI research assistant'
              description='Ask questions about your documents. The AI reads your uploaded files and gives contextual answers with verified citations.'
            />
            <FeatureCard
              icon={<BookOpen className='size-5 shrink-0' aria-hidden='true' />}
              title='Academic library'
              description='Multi-tier in-process PDF extraction, direct DOI resolution, and 2-way sync with Zotero and Mendeley. Manage references effortlessly.'
            />
            <FeatureCard
              icon={<Users className='size-5 shrink-0' aria-hidden='true' />}
              title='Team collaboration'
              description='Invite members with role-based access. Real-time presence, comments, and activity feeds keep everyone aligned.'
            />
          </MotionStaggerContainer>
        </div>
      </section>

      {/* ── How it works ── */}
      <section
        id='how-it-works'
        className='flux-section border-t border-border bg-panel/30'
        aria-labelledby='how-heading'
      >
        <div className='flux-container'>
          <MotionReveal className='max-w-2xl mb-12'>
            <h2 id='how-heading' className='text-2xl font-semibold tracking-tight sm:text-3xl lg:text-4xl text-foreground'>
              From idea to publication
            </h2>
          </MotionReveal>

          <MotionStaggerContainer className='grid lg:grid-cols-3 gap-8 md:gap-12'>
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
          </MotionStaggerContainer>
        </div>
      </section>

      {/* ── Stats ── */}
      <section
        className='flux-section border-t border-border'
        aria-label='Platform statistics'
      >
        <div className='flux-container'>
          <MotionStaggerContainer className='grid grid-cols-2 lg:grid-cols-4 gap-8 md:gap-12 py-4'>
            <MotionItem>
              <div className='space-y-1'>
                <div className='text-3xl sm:text-4xl font-semibold tabular-nums tracking-tight text-foreground font-mono'>99.9%</div>
                <p className='text-13 font-medium text-muted-foreground'>Uptime</p>
              </div>
            </MotionItem>
            <MotionItem>
              <div className='space-y-1'>
                <div className='text-3xl sm:text-4xl font-semibold tabular-nums tracking-tight text-foreground font-mono'>&lt;1s</div>
                <p className='text-13 font-medium text-muted-foreground'>Compile time</p>
              </div>
            </MotionItem>
            <MotionItem>
              <div className='space-y-1'>
                <div className='text-3xl sm:text-4xl font-semibold tracking-tight text-foreground font-mono'>CRDT</div>
                <p className='text-13 font-medium text-muted-foreground'>Real-time sync</p>
              </div>
            </MotionItem>
            <MotionItem>
              <div className='space-y-1'>
                <div className='text-3xl sm:text-4xl font-semibold tracking-tight text-foreground font-mono'>Free</div>
                <p className='text-13 font-medium text-muted-foreground'>No credit card</p>
              </div>
            </MotionItem>
          </MotionStaggerContainer>
        </div>
      </section>

      {/* ── Ready to start CTA ── */}
      <section
        className='flux-section border-t border-border'
        aria-labelledby='cta-heading'
      >
        <div className='flux-container'>
          <MotionReveal className='max-w-2xl mx-auto text-center space-y-5 rounded-lg border border-border bg-card p-8 sm:p-12 shadow-hairline'>
            <h2 id='cta-heading' className='text-2xl font-semibold tracking-tight sm:text-3xl text-foreground'>
              Ready to start?
            </h2>
            <p className='text-base text-muted-foreground max-w-lg mx-auto leading-relaxed'>
              Start your research project in under a minute. Free forever for small teams.
            </p>
            <SectionCta />
          </MotionReveal>
        </div>
      </section>

      <Footer />
    </div>
  );
}

// ─── Static Sub-components (Server Rendered) ──────────────────────────────────

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
    <MotionItem className='h-full'>
      <div className='group space-y-3 bg-card p-6 transition-colors hover:bg-muted/40 lg:p-7 relative h-full'>
        <div className='inline-flex text-foreground transition-transform duration-150 ease-out group-hover:scale-105 origin-left'>
          {icon}
        </div>
        <h3 className='text-14 font-semibold text-foreground tracking-tight'>{title}</h3>
        <p className='text-13 text-muted-foreground leading-relaxed'>
          {description}
        </p>
      </div>
    </MotionItem>
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
    <MotionItem>
      <div className='space-y-3'>
        <span className='font-mono text-12 font-medium text-muted-foreground tracking-wider'>
          {step}
        </span>
        <h3 className='text-base font-semibold text-foreground tracking-tight'>{title}</h3>
        <p className='text-13 text-muted-foreground leading-relaxed'>{description}</p>
      </div>
    </MotionItem>
  );
}
