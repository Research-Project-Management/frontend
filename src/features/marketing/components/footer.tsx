import Link from 'next/link';
import { Github } from 'lucide-react';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className='border-t border-border' aria-label='Site footer'>
      <div className='flux-container py-12'>
        <div className='grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-10 lg:gap-12'>

          {/* Brand */}
          <div className='col-span-2 md:col-span-1 space-y-4'>
            <Link
              href='/'
              className='inline-flex items-center gap-2 min-h-[44px]'
              aria-label='Flux home'
            >
              <img src='/Flux.svg' className='h-8 w-auto object-contain' alt='' aria-hidden='true' />
              <span className='font-bold text-lg tracking-tight'>Flux</span>
            </Link>
            <p className='text-base text-muted-foreground leading-relaxed'>
              The collaborative research workspace for modern teams.
            </p>
            <a
              href='https://github.com/Research-Project-TDTU'
              target='_blank'
              rel='noopener noreferrer'
              className='inline-flex items-center gap-1.5 min-h-[44px] -mx-2 px-2 text-base text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm'
              aria-label='View Flux on GitHub (opens in new tab)'
            >
              <Github className='w-4 h-4' aria-hidden='true' />
              GitHub
            </a>
          </div>

          {/* Product */}
          <nav aria-label='Product links'>
            <h3 className='text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4'>
              Product
            </h3>
            <ul className='space-y-1'>
              <FooterLink href='/' label='Features' />
              <FooterLink href='/' label='Changelog' />
              <FooterLink href='/docs' label='Documentation' />
            </ul>
          </nav>

          {/* Company */}
          <nav aria-label='Company links'>
            <h3 className='text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4'>
              Company
            </h3>
            <ul className='space-y-1'>
              <FooterLink href='/' label='About' />
              <FooterLink href='/' label='Blog' />
              <FooterLink href='/' label='Contact' />
            </ul>
          </nav>

          {/* Legal */}
          <nav aria-label='Legal links'>
            <h3 className='text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4'>
              Legal
            </h3>
            <ul className='space-y-1'>
              <FooterLink href='/' label='Privacy' />
              <FooterLink href='/' label='Terms' />
            </ul>
          </nav>
        </div>

        {/* Bottom */}
        <div className='mt-12 pt-6 border-t border-border'>
          <p className='text-sm text-muted-foreground text-center'>
            © {currentYear} Flux · TDTU Research Project Team
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterLink({ href, label }: { href: string; label: string }) {
  return (
    <li>
      <Link
        href={href}
        className='inline-flex items-center min-h-[44px] -mx-2 px-2 text-base text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm'
      >
        {label}
      </Link>
    </li>
  );
}
