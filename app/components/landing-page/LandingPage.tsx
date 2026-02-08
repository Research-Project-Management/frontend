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
  Zap,
  Shield,
  Globe,
  ArrowRight,
  Sparkles,
  TrendingUp,
  Clock,
  Star,
} from "lucide-react";
import Footer from "./Footer";

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-linear-to-b from-orange-50/50 via-background to-background dark:from-orange-950/20 pt-16">
        {/* Background decorations */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-yellow-500/20 rounded-full blur-3xl"></div>
          <div className="absolute top-100 -left-40 w-80 h-80 bg-blue-500/30 rounded-full blur-3xl"></div>
          <div className="absolute top-10 left-40 w-100 h-80 bg-orange-500/30 rounded-full blur-3xl"></div>
        </div>

        <div className="container relative mx-auto px-4 py-16 lg:py-24">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left Content */}
            <div className="space-y-8 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500/10 border border-orange-500/20 rounded-full text-sm font-medium text-orange-800">
                <Sparkles className="w-4 h-4" />
                AI-Powered Research Management
              </div>

              <h1 className="text-5xl lg:text-6xl xl:text-7xl font-bold tracking-tight">
                Keep research{" "}
                <span className="text-primary">moving forward</span>
              </h1>

              <p className="text-xl text-muted-foreground leading-relaxed max-w-xl mx-auto lg:mx-0">
                The all-in-one workspace for research teams. Collaborate
                seamlessly, manage projects efficiently, and accelerate your
                research workflow with AI-powered tools.
              </p>

              {/* Stats */}
              <div className="flex flex-wrap justify-center lg:justify-start gap-8 py-4">
                <div className="text-center lg:text-left">
                  <div className="text-3xl font-bold text-primary">5+</div>
                  <div className="text-sm text-muted-foreground">
                    Active Users
                  </div>
                </div>
                <div className="text-center lg:text-left">
                  <div className="text-3xl font-bold text-primary">10+</div>
                  <div className="text-sm text-muted-foreground">
                    Projects Created
                  </div>
                </div>
                <div className="text-center lg:text-left">
                  <div className="text-3xl font-bold text-primary">99.9%</div>
                  <div className="text-sm text-muted-foreground">Uptime</div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start pt-4">
                <Link
                  to="/ws"
                  className="group px-8 py-4 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
                >
                  Get Started Free
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link
                  to="/login"
                  className="px-8 py-4 bg-secondary text-foreground rounded-xl font-semibold hover:bg-secondary/80 transition-all border border-border"
                >
                  Sign In
                </Link>
              </div>

              <p className="text-sm text-muted-foreground">
                No credit card required • Free forever plan
              </p>
            </div>

            {/* Right Content - Screenshot */}
            <div className="relative lg:order-last">
              <div className="relative">
                {/* Glow effect */}
                <div className="absolute inset-0 bg-linear-to-tr from-primary/20 to-blue-500/20 rounded-3xl blur-3xl"></div>

                {/* Screenshot */}
                <div className="relative rounded-xl overflow-hidden shadow-2xl shadow-blue-500/10 border border-border/50 bg-background">
                  <img
                    src="/screenshot.png"
                    alt="Flux Dashboard Screenshot"
                    className="w-full h-auto"
                  />
                </div>

                {/* Floating badges */}
                <div className="absolute -top-20 left-1/2 bg-background border border-border rounded-xl px-4 py-2 shadow-lg flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-green-500" />
                  <span className="text-sm font-semibold">
                    40% More Productive
                  </span>
                </div>
                <div className="absolute -bottom-16 -right-4 bg-background border border-border rounded-xl px-4 py-2 shadow-lg flex items-center gap-2">
                  <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                  <span className="text-sm font-semibold">4.9/5 Rating</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
        <div className="container relative mx-auto px-4">
          <div className="text-center mb-16 space-y-4">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full text-sm font-medium text-primary">
              <Zap className="w-4 h-4" />
              Powerful Features
            </div>
            <h2 className="text-4xl lg:text-5xl font-bold">
              Everything You Need
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              A complete suite of tools designed specifically for research teams
              to collaborate and deliver results faster
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
            <FeatureCard
              icon={<FolderKanban className="w-8 h-8" />}
              title="Smart Project Management"
              description="Organize research projects with customizable workspaces, Kanban boards, and automated workflows that adapt to your team's needs."
            />
            <FeatureCard
              icon={<FileText className="w-8 h-8" />}
              title="Rich Documentation"
              description="Create comprehensive docs with a powerful editor. Support for markdown, code blocks, diagrams, and collaborative editing."
            />
            <FeatureCard
              icon={<CheckSquare className="w-8 h-8" />}
              title="Advanced Task Tracking"
              description="Never miss a deadline with smart task management, dependencies, priorities, and automated reminders."
            />
            <FeatureCard
              icon={<MessageSquare className="w-8 h-8" />}
              title="AI Wiki Assistant"
              description="Chat with your entire knowledge base. Get instant answers from your documentation using advanced AI technology."
            />
            <FeatureCard
              icon={<Upload className="w-8 h-8" />}
              title="Secure File Storage"
              description="Store unlimited files with version control, preview support, and enterprise-grade security powered by Cloudflare R2."
            />
            <FeatureCard
              icon={<Users className="w-8 h-8" />}
              title="Team Collaboration"
              description="Work together seamlessly with role-based permissions, real-time updates, and activity tracking."
            />
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-24 bg-linear-to-b from-secondary/30 to-background">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl lg:text-5xl font-bold mb-4">
                Why Choose Flux?
              </h2>
              <p className="text-muted-foreground text-lg">
                Built for modern research teams who demand the best
              </p>
            </div>

            <div className="grid lg:grid-cols-3 gap-8">
              <BenefitCard
                icon={<Zap className="w-12 h-12 text-yellow-500" />}
                title="Lightning Fast"
                description="Built with cutting-edge technology stack. Experience instant page loads, real-time updates, and smooth interactions."
              />
              <BenefitCard
                icon={<Shield className="w-12 h-12 text-green-500" />}
                title="Enterprise Security"
                description="Bank-level encryption, secure authentication with OAuth, and compliance with global data protection standards."
              />
              <BenefitCard
                icon={<Globe className="w-12 h-12 text-blue-500" />}
                title="Work From Anywhere"
                description="Cloud-native architecture ensures your data is accessible from any device, with automatic sync across all platforms."
              />
            </div>

            {/* Additional Trust Indicators */}
            <div className="mt-16 pt-12 border-t border-border">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
                <div className="space-y-2">
                  <Clock className="w-8 h-8 mx-auto text-primary" />
                  <div className="text-2xl font-bold">99.9%</div>
                  <div className="text-sm text-muted-foreground">
                    Uptime SLA
                  </div>
                </div>
                <div className="space-y-2">
                  <Shield className="w-8 h-8 mx-auto text-primary" />
                  <div className="text-2xl font-bold">SOC 2</div>
                  <div className="text-sm text-muted-foreground">Compliant</div>
                </div>
                <div className="space-y-2">
                  <Users className="w-8 h-8 mx-auto text-primary" />
                  <div className="text-2xl font-bold">5+</div>
                  <div className="text-sm text-muted-foreground">
                    Happy Users
                  </div>
                </div>
                <div className="space-y-2">
                  <Globe className="w-8 h-8 mx-auto text-primary" />
                  <div className="text-2xl font-bold">1+</div>
                  <div className="text-sm text-muted-foreground">Countries</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative overflow-hidden bg-linear-to-br from-white via-white to-blue-600 text-primary py-24">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-white rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-white rounded-full blur-3xl"></div>
        </div>

        <div className="container relative mx-auto px-4 text-center">
          <div className="max-w-4xl mx-auto space-y-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full text-sm font-medium">
              <Sparkles className="w-4 h-4" />
              Start Your Free Trial Today
            </div>

            <h2 className="text-4xl lg:text-6xl font-bold leading-tight">
              Ready to Transform Your Research Workflow?
            </h2>

            <p className="text-xl opacity-90 max-w-2xl mx-auto leading-relaxed">
              Join thousands of research teams worldwide who trust Flux to
              manage their projects, collaborate efficiently, and deliver
              results faster.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-6">
              <Link
                to="/ws"
                className="group px-8 py-4 bg-white text-primary rounded-xl font-semibold hover:bg-gray-100 transition-all shadow-xl hover:shadow-2xl flex items-center gap-2"
              >
                Create Your Workspace Free
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                to="/login"
                className="px-8 py-4 bg-primary/10 border-2 border-white/30 backdrop-blur-sm text-primary rounded-xl font-semibold hover:bg-primary/20 transition-all"
              >
                Sign In
              </Link>
            </div>

            <div className="flex flex-wrap justify-center gap-8 pt-8 text-sm opacity-90">
              <div className="flex items-center gap-2">
                <CheckSquare className="w-5 h-5" />
                No credit card required
              </div>
              <div className="flex items-center gap-2">
                <CheckSquare className="w-5 h-5" />
                Free forever plan
              </div>
              <div className="flex items-center gap-2">
                <CheckSquare className="w-5 h-5" />
                Cancel anytime
              </div>
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
    <div className="group relative p-8 bg-background rounded-2xl border border-border hover:border-primary/50 hover:shadow-xl transition-all duration-300">
      {/* Gradient overlay on hover */}
      <div className="absolute inset-0 bg-linear-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl"></div>

      <div className="relative space-y-4">
        <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground group-hover:scale-110 transition-all duration-300">
          {icon}
        </div>
        <h3 className="text-xl font-bold group-hover:text-primary transition-colors">
          {title}
        </h3>
        <p className="text-muted-foreground leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

function BenefitCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="group text-center space-y-4 p-8 rounded-2xl hover:bg-background transition-all duration-300">
      <div className="inline-flex items-center justify-center p-5 bg-background border border-border rounded-2xl group-hover:scale-110 group-hover:shadow-lg transition-all duration-300">
        {icon}
      </div>
      <h3 className="text-2xl font-bold">{title}</h3>
      <p className="text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}
