import Navbar from "./Navbar";
import Flux from "~/assets/Flux.svg?react";
import { Link } from "react-router";
import {
  FolderKanban,
  MessageSquare,
  FileText,
  CheckSquare,
  Upload,
  Users,
  ArrowRight,
  ArrowUpRight,
  Braces,
} from "lucide-react";
import Footer from "./Footer";

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />

      {/* Hero Section */}
      <section className="pt-28 pb-16 sm:pt-32 lg:pt-36 lg:pb-24">
        <div className="flux-container">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold uppercase text-muted-foreground">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              Beta
            </div>

            <h1 className="text-4xl font-bold leading-[1.12] sm:text-5xl lg:text-6xl">
              The workspace for
              <br />
              research teams
            </h1>

            <p className="text-lg text-muted-foreground leading-relaxed max-w-xl mx-auto">
              Write, collaborate, and manage your research — all in one place.
              Built for teams who want to move fast without losing context.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <Link
                to="/ws"
                className="group flex h-11 items-center justify-center gap-2 rounded-md bg-primary px-6 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                Start for free
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <Link
                to="/login"
                className="flex h-11 items-center justify-center rounded-md border border-border bg-card px-6 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
              >
                Sign in
              </Link>
            </div>
          </div>

          {/* Screenshot */}
          <div className="mt-14 lg:mt-18 mx-auto max-w-6xl">
            <div className="overflow-hidden rounded-lg border border-border bg-card shadow-lg">
              <img
                src="/screenshot.png"
                alt="Flux workspace"
                className="w-full h-auto"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="flux-section border-t border-border">
        <div className="flux-container">
          <div className="max-w-2xl mb-14">
            <p className="mb-3 text-xs font-semibold uppercase text-muted-foreground">
              Features
            </p>
            <h2 className="text-3xl font-bold lg:text-4xl">
              Everything your team needs
            </h2>
            <p className="text-muted-foreground mt-3 text-lg">
              A focused set of tools designed for research workflows — from
              writing papers to managing project timelines.
            </p>
          </div>

          <div className="grid overflow-hidden rounded-lg border border-border bg-border md:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              icon={<FileText className="w-5 h-5" />}
              title="Rich editor"
              description="Write documents with a powerful block editor. Supports markdown, code, math, and collaborative editing in real-time."
            />
            <FeatureCard
              icon={<Braces className="w-5 h-5" />}
              title="LaTeX compiler"
              description="Write and compile LaTeX directly in the browser. Multi-file projects, BibTeX, and instant PDF preview — like Overleaf."
            />
            <FeatureCard
              icon={<CheckSquare className="w-5 h-5" />}
              title="Task management"
              description="Track progress with tasks, deadlines, and priorities. Kanban boards and list views to match your workflow."
            />
            <FeatureCard
              icon={<MessageSquare className="w-5 h-5" />}
              title="AI assistant"
              description="Ask questions about your documents. The AI reads your uploaded files and gives contextual answers with sources."
            />
            <FeatureCard
              icon={<Upload className="w-5 h-5" />}
              title="File storage"
              description="Upload and organize files per project. Version history, instant preview, and secure cloud storage included."
            />
            <FeatureCard
              icon={<Users className="w-5 h-5" />}
              title="Team collaboration"
              description="Invite members with role-based access. Real-time presence, comments, and activity feeds keep everyone aligned."
            />
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="flux-section border-t border-border bg-card/50">
        <div className="flux-container">
          <div className="max-w-2xl mb-14">
            <p className="mb-3 text-xs font-semibold uppercase text-muted-foreground">
              How it works
            </p>
            <h2 className="text-3xl font-bold lg:text-4xl">
              From idea to publication
            </h2>
          </div>

          <div className="grid lg:grid-cols-3 gap-12">
            <StepCard
              number="01"
              title="Create a workspace"
              description="Set up your research workspace in seconds. Invite your team and organize projects by topic, deadline, or department."
            />
            <StepCard
              number="02"
              title="Write and collaborate"
              description="Use the rich editor or LaTeX compiler to write papers together. Everything syncs in real-time across your team."
            />
            <StepCard
              number="03"
              title="Ship your research"
              description="Export to PDF, compile LaTeX, and manage versions. Your work is always backed up and ready to submit."
            />
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="border-t border-border py-14 sm:py-16">
        <div className="flux-container">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div>
              <div className="text-3xl font-bold lg:text-4xl">
                99.9%
              </div>
              <div className="text-sm text-muted-foreground mt-1">Uptime</div>
            </div>
            <div>
              <div className="text-3xl font-bold lg:text-4xl">
                &lt;1s
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                Compile time
              </div>
            </div>
            <div>
              <div className="text-3xl font-bold lg:text-4xl">
                E2E
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                Encrypted
              </div>
            </div>
            <div>
              <div className="text-3xl font-bold lg:text-4xl">
                Free
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                No credit card
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="flux-section border-t border-border bg-card/50">
        <div className="flux-container">
          <div className="max-w-2xl mx-auto text-center space-y-6">
            <h2 className="text-3xl font-bold lg:text-4xl">
              Ready to start?
            </h2>
            <p className="text-lg text-muted-foreground">
              Create your workspace in under a minute. Free forever for small
              teams.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <Link
                to="/ws"
                className="group flex h-11 items-center justify-center gap-2 rounded-md bg-primary px-6 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                Create workspace
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <a
                href="https://github.com/Research-Project-TDTU"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-11 items-center justify-center gap-2 rounded-md border border-border bg-card px-6 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
              >
                View on GitHub
                <ArrowUpRight className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="group space-y-3 bg-card p-6 transition-colors hover:bg-accent/60 lg:p-8">
      <div className="text-foreground">{icon}</div>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">
        {description}
      </p>
    </div>
  );
}

function StepCard({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="space-y-3">
      <span className="text-xs font-mono text-muted-foreground">{number}</span>
      <h3 className="text-xl font-semibold">{title}</h3>
      <p className="text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}
