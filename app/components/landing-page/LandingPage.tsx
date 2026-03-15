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
      <section className="pt-32 pb-20 lg:pt-40 lg:pb-28">
        <div className="container mx-auto px-6">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 border border-border rounded-full text-xs font-medium text-muted-foreground tracking-wide uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              Beta
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1]">
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
                className="group px-6 py-3 bg-foreground text-background rounded-lg font-medium text-sm hover:opacity-80 transition-opacity flex items-center justify-center gap-2"
              >
                Start for free
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <Link
                to="/login"
                className="px-6 py-3 border border-border text-foreground rounded-lg font-medium text-sm hover:bg-secondary transition-colors"
              >
                Sign in
              </Link>
            </div>
          </div>

          {/* Screenshot */}
          <div className="mt-16 lg:mt-20 max-w-5xl mx-auto">
            <div className="rounded-xl overflow-hidden border border-border bg-secondary/30">
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
      <section className="py-20 lg:py-28 border-t border-border">
        <div className="container mx-auto px-6">
          <div className="max-w-2xl mb-14">
            <p className="text-xs font-medium text-muted-foreground tracking-widest uppercase mb-3">
              Features
            </p>
            <h2 className="text-3xl lg:text-4xl font-bold tracking-tight">
              Everything your team needs
            </h2>
            <p className="text-muted-foreground mt-3 text-lg">
              A focused set of tools designed for research workflows — from
              writing papers to managing project timelines.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-px bg-border rounded-xl overflow-hidden border border-border">
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
      <section className="py-20 lg:py-28 border-t border-border">
        <div className="container mx-auto px-6">
          <div className="max-w-2xl mb-14">
            <p className="text-xs font-medium text-muted-foreground tracking-widest uppercase mb-3">
              How it works
            </p>
            <h2 className="text-3xl lg:text-4xl font-bold tracking-tight">
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
      <section className="py-16 border-t border-border">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div>
              <div className="text-3xl lg:text-4xl font-bold tracking-tight">
                99.9%
              </div>
              <div className="text-sm text-muted-foreground mt-1">Uptime</div>
            </div>
            <div>
              <div className="text-3xl lg:text-4xl font-bold tracking-tight">
                &lt;1s
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                Compile time
              </div>
            </div>
            <div>
              <div className="text-3xl lg:text-4xl font-bold tracking-tight">
                E2E
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                Encrypted
              </div>
            </div>
            <div>
              <div className="text-3xl lg:text-4xl font-bold tracking-tight">
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
      <section className="py-20 lg:py-28 border-t border-border">
        <div className="container mx-auto px-6">
          <div className="max-w-2xl mx-auto text-center space-y-6">
            <h2 className="text-3xl lg:text-4xl font-bold tracking-tight">
              Ready to start?
            </h2>
            <p className="text-lg text-muted-foreground">
              Create your workspace in under a minute. Free forever for small
              teams.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <Link
                to="/ws"
                className="group px-6 py-3 bg-foreground text-background rounded-lg font-medium text-sm hover:opacity-80 transition-opacity flex items-center justify-center gap-2"
              >
                Create workspace
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <a
                href="https://github.com/Research-Project-TDTU"
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-3 border border-border text-foreground rounded-lg font-medium text-sm hover:bg-secondary transition-colors flex items-center justify-center gap-2"
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
    <div className="bg-background p-6 lg:p-8 space-y-3 group hover:bg-secondary/40 transition-colors">
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
