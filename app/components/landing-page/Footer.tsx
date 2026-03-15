import { Link } from "react-router";
import Flux from "~/assets/Flux.svg?react";
import { Github } from "lucide-react";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-border">
      <div className="container mx-auto px-6 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 lg:gap-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1 space-y-4">
            <Link to="/" className="inline-flex items-center gap-2">
              <Flux className="w-5 h-5 text-foreground" />
              <span className="font-semibold">Flux</span>
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed">
              The collaborative research workspace for modern teams.
            </p>
            <a
              href="https://github.com/Research-Project-TDTU"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Github className="w-4 h-4" />
              GitHub
            </a>
          </div>

          {/* Product */}
          <div className="space-y-3">
            <h3 className="text-xs font-medium text-muted-foreground tracking-widest uppercase">
              Product
            </h3>
            <ul className="space-y-2.5">
              <FooterLink to="/" label="Features" />
              <FooterLink to="/" label="Changelog" />
              <FooterLink to="/docs" label="Documentation" />
            </ul>
          </div>

          {/* Company */}
          <div className="space-y-3">
            <h3 className="text-xs font-medium text-muted-foreground tracking-widest uppercase">
              Company
            </h3>
            <ul className="space-y-2.5">
              <FooterLink to="/" label="About" />
              <FooterLink to="/" label="Blog" />
              <FooterLink to="/" label="Contact" />
            </ul>
          </div>

          {/* Legal */}
          <div className="space-y-3">
            <h3 className="text-xs font-medium text-muted-foreground tracking-widest uppercase">
              Legal
            </h3>
            <ul className="space-y-2.5">
              <FooterLink to="/" label="Privacy" />
              <FooterLink to="/" label="Terms" />
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-12 pt-6 border-t border-border">
          <p className="text-xs text-muted-foreground">
            © {currentYear} Flux · Made by Phong Thanh Dat
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterLink({ to, label }: { to: string; label: string }) {
  return (
    <li>
      <Link
        to={to}
        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        {label}
      </Link>
    </li>
  );
}
