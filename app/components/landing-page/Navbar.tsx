import { Link } from "react-router";
import Flux from "~/assets/Flux.svg?react";
import { ArrowRight, Menu, X } from "lucide-react";
import { useState, useEffect } from "react";

export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 z-50 w-full transition-all duration-300 ${
        isScrolled
          ? "bg-background/80 backdrop-blur-lg border-b border-border/50 "
          : "bg-transparent"
      }`}
    >
      <div className="container mx-auto px-4">
        <div
          className={
            `flex justify-between items-center ` +
            (isScrolled ? "h-20" : "h-24") +
            ` transition-all duration-300`
          }
        >
          {/* Logo */}
          <Link
            to="/"
            className="flex gap-2 items-center group"
            onClick={() => setIsMenuOpen(false)}
          >
            <Flux className="w-7 h-7 text-primary group-hover:scale-110 transition-transform" />
            <div className="font-bold text-2xl">Flux</div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden  items-center gap-8">
            <Link
              to="/"
              className="font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Features
            </Link>
            <Link
              to="/"
              className="font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Pricing
            </Link>
            <Link
              to="/docs"
              className="font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Docs
            </Link>
            <Link
              to="/about"
              className="font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              About
            </Link>
          </div>

          {/* Action Buttons */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              to="/login"
              className="px-4 py-2 font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Sign In
            </Link>
            <Link
              to="/ws"
              className="group px-5 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-all shadow-sm hover:shadow-md flex items-center gap-2"
            >
              Get Started
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="hidden p-2 hover:bg-secondary rounded-lg transition-colors"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Toggle menu"
          >
            {isMenuOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden py-4 border-t border-border animate-in slide-in-from-top-5 duration-300">
            <div className="flex flex-col gap-4">
              <Link
                to="/features"
                className="px-4 py-2 font-medium text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-all"
                onClick={() => setIsMenuOpen(false)}
              >
                Features
              </Link>
              <Link
                to="/pricing"
                className="px-4 py-2 font-medium text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-all"
                onClick={() => setIsMenuOpen(false)}
              >
                Pricing
              </Link>
              <Link
                to="/docs"
                className="px-4 py-2 font-medium text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-all"
                onClick={() => setIsMenuOpen(false)}
              >
                Docs
              </Link>
              <Link
                to="/about"
                className="px-4 py-2 font-medium text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-all"
                onClick={() => setIsMenuOpen(false)}
              >
                About
              </Link>
              <div className="pt-4 border-t border-border flex flex-col gap-3">
                <Link
                  to="/login"
                  className="px-4 py-2.5 font-medium text-center border border-border rounded-lg hover:bg-secondary transition-all"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="px-4 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-all text-center flex items-center justify-center gap-2"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Get Started
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
