import Link from 'next/link';
import { Github } from 'lucide-react';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className='border-t border-border'>
      <div className='flux-container py-12'>
        <div className='grid grid-cols-2 md:grid-cols-4 gap-8 lg:gap-12'>
          {/* Brand */}
          <div className='col-span-2 md:col-span-1 space-y-4'>
            <Link href='/' className='inline-flex items-center gap-2'>
              <img src='/Flux.svg' className='w-5 h-5 text-foreground' alt='Flux' />
              <span className='font-semibold'>Flux</span>
            </Link>
            <p className='text-sm text-muted-foreground leading-relaxed'>
              The collaborative research workspace for modern teams.
            </p>
            <a
              href='https://github.com/Research-Project-TDTU'
              target='_blank'
              rel='noopener noreferrer'
              className='inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors'
            >
              <Github className='w-4 h-4' />
              GitHub
            </a>
          </div>

          {/* Product */}
          <div className='space-y-3'>
            <h3 className='text-xs font-semibold text-muted-foreground uppercase'>
              Product
            </h3>
            <ul className='space-y-2.5'>
              <FooterLink href='/' label='Features' />
              <FooterLink href='/' label='Changelog' />
              <FooterLink href='/docs' label='Documentation' />
            </ul>
          </div>

          {/* Company */}
          <div className='space-y-3'>
            <h3 className='text-xs font-semibold text-muted-foreground uppercase'>
              Company
            </h3>
            <ul className='space-y-2.5'>
              <FooterLink href='/' label='About' />
              <FooterLink href='/' label='Blog' />
              <FooterLink href='/' label='Contact' />
            </ul>
          </div>

          {/* Legal */}
          <div className='space-y-3'>
            <h3 className='text-xs font-semibold text-muted-foreground uppercase'>
              Legal
            </h3>
            <ul className='space-y-2.5'>
              <FooterLink href='/' label='Privacy' />
              <FooterLink href='/' label='Terms' />
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className='mt-12 pt-6 border-t border-border'>
          <p className='text-xs text-muted-foreground'>
            © {currentYear} Flux · Made by Phong Thanh Dat
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
        className='text-sm text-muted-foreground hover:text-foreground transition-colors'
      >
        {label}
      </Link>
    </li>
  );
}
