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
      className={`fixed top-0 z-50 w-full transition-all duration-200 ${
        isScrolled
          ? "bg-background/90 backdrop-blur-md border-b border-border"
          : "bg-transparent"
      }`}
    >
      <div className="container mx-auto px-6">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link
            to="/"
            className="flex gap-2.5 items-center"
            onClick={() => setIsMenuOpen(false)}
          >
            <Flux className="w-6 h-6 text-foreground" />
            <div className="font-semibold text-lg tracking-tight">Flux</div>
          </Link>

          {/* Action Buttons */}
          <div className="hidden md:flex items-center gap-2">
            <Link
              to="/contact-sales"
              className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Contact Sales
            </Link>
            <Link
              to="/login"
              className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Sign in
            </Link>
            <Link
              to="/ws"
              className="group px-4 py-2 bg-foreground text-background rounded-lg text-sm font-medium hover:opacity-80 transition-opacity flex items-center gap-1.5"
            >
              Get started
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 hover:bg-secondary rounded-lg transition-colors"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Toggle menu"
          >
            {isMenuOpen ? (
              <X className="w-5 h-5" />
            ) : (
              <Menu className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden py-4 border-t border-border">
            <div className="flex flex-col gap-2">
              <Link
                to="/contact-sales"
                className="px-4 py-2.5 text-sm font-medium text-center border border-border rounded-lg hover:bg-secondary transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                Contact Sales
              </Link>
              <Link
                to="/login"
                className="px-4 py-2.5 text-sm font-medium text-center border border-border rounded-lg hover:bg-secondary transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                Sign in
              </Link>
              <Link
                to="/ws"
                className="px-4 py-2.5 bg-foreground text-background rounded-lg text-sm font-medium hover:opacity-80 transition-opacity text-center flex items-center justify-center gap-1.5"
                onClick={() => setIsMenuOpen(false)}
              >
                Get started
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
