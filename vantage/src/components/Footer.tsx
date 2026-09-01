import { Link } from 'react-router-dom';
import { Mark } from './Logo';
import { BRAND } from '../lib/brand';

const cols = [
  {
    title: 'Product',
    links: [
      { to: '/how-it-works', label: 'How it works' },
      { to: '/pricing', label: 'Pricing' },
      { to: '/library', label: 'Past briefs' },
    ],
  },
  {
    title: 'Account',
    links: [
      { to: '/onboarding', label: 'Start free' },
      { to: '/signin', label: 'Sign in' },
      { to: '/profile', label: 'Your profile' },
    ],
  },
];

export function Footer() {
  return (
    <footer className="mt-24 border-t border-line">
      <div className="container-x grid gap-10 py-14 sm:grid-cols-2 md:grid-cols-4">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2.5">
            <Mark />
            <span className="font-display text-xl font-semibold tracking-tight">{BRAND.wordmark}</span>
          </div>
          <p className="mt-3 max-w-xs text-sm text-muted">{BRAND.promise}</p>
          <p className="mt-4 text-sm text-muted">
            Questions? <a className="link-underline text-ink" href={`mailto:${BRAND.supportEmail}`}>{BRAND.supportEmail}</a>
          </p>
        </div>
        {cols.map((c) => (
          <div key={c.title}>
            <h4 className="text-[13px] font-semibold text-ink">{c.title}</h4>
            <ul className="mt-3 space-y-2.5">
              {c.links.map((l) => (
                <li key={l.to}>
                  <Link to={l.to} className="text-sm text-muted transition hover:text-ink">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-line">
        <div className="container-x flex flex-col items-center justify-between gap-2 py-5 text-xs text-muted sm:flex-row">
          <p>© {new Date().getFullYear()} {BRAND.name}. Made for people with big plans and no time.</p>
          <div className="flex gap-4">
            <a href="#" className="hover:text-ink">Privacy</a>
            <a href="#" className="hover:text-ink">Terms</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
