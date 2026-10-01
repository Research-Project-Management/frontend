import Link from 'next/link';

const GithubIcon = ({ className, 'aria-hidden': ariaHidden }: { className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden={ariaHidden}
  >
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.2c3-.3 6-1.6 6-6.5a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12.3 12.3 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.9 3 6.2 6 6.5a4.8 4.8 0 0 0-1 3.2v4" />
  </svg>
);

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className='border-t border-border bg-background' aria-label='Site footer'>
      <div className='flux-container py-12'>
        <div className='grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-10 lg:gap-12'>

          {/* Brand */}
          <div className='col-span-2 md:col-span-1 space-y-3'>
            <Link
              href='/'
              className='inline-flex items-center gap-2 shrink-0'
              aria-label='Flux home'
            >
              <img src='/Flux.svg' className='size-6 shrink-0 object-contain' alt='' aria-hidden='true' />
              <span className='font-semibold text-lg tracking-tight'>Flux</span>
            </Link>
            <p className='text-sm text-muted-foreground leading-relaxed max-w-xs'>
              The collaborative research workbench engineered for modern academic teams.
            </p>
            <a
              href='https://github.com/Research-Project-TDTU'
              target='_blank'
              rel='noopener noreferrer'
              className='inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-sm'
              aria-label='View Flux on GitHub (opens in new tab)'
            >
              <GithubIcon className='size-4' aria-hidden='true' />
              GitHub
            </a>
          </div>

          {/* Product */}
          <nav aria-label='Product links'>
            <h3 className='text-sm font-semibold text-foreground mb-3'>
              Product
            </h3>
            <ul className='space-y-1'>
              <FooterLink href='/#features' label='Features' />
              <FooterLink href='/#how-it-works' label='How it works' />
              <FooterLink href='https://github.com/Research-Project-TDTU' label='Documentation' isExternal />
              <FooterLink href='https://github.com/Research-Project-TDTU/flux/releases' label='Changelog' isExternal />
            </ul>
          </nav>

          {/* Team / Community */}
          <nav aria-label='Community links'>
            <h3 className='text-sm font-semibold text-foreground mb-3'>
              Community
            </h3>
            <ul className='space-y-1'>
              <FooterLink href='https://github.com/Research-Project-TDTU' label='GitHub Organization' isExternal />
              <FooterLink href='https://github.com/Research-Project-TDTU/flux/issues' label='Report an issue' isExternal />
              <FooterLink href='mailto:support@flux.ac.uk' label='Contact team' isExternal />
            </ul>
          </nav>

          {/* Legal */}
          <nav aria-label='Legal links'>
            <h3 className='text-sm font-semibold text-foreground mb-3'>
              Legal
            </h3>
            <ul className='space-y-1'>
              <FooterLink href='/#privacy' label='Privacy Policy' />
              <FooterLink href='/#terms' label='Terms of Service' />
            </ul>
          </nav>
        </div>

        {/* Bottom */}
        <div className='mt-12 pt-6 border-t border-border flex items-center justify-center text-center'>
          <p className='text-13 text-muted-foreground'>
            © {currentYear} Flux · TDTU Research Project Team. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterLink({
  href,
  label,
  isExternal,
}: {
  href: string;
  label: string;
  isExternal?: boolean;
}) {
  if (isExternal) {
    return (
      <li>
        <a
          href={href}
          target='_blank'
          rel='noopener noreferrer'
          className='inline-flex items-center py-1 text-13 text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-sm'
        >
          {label}
        </a>
      </li>
    );
  }

  return (
    <li>
      <Link
        href={href}
        className='inline-flex items-center py-1 text-13 text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-sm'
      >
        {label}
      </Link>
    </li>
  );
}
