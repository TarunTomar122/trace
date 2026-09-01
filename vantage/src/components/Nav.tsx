import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { Logo } from './Logo';
import { useAuth } from '../lib/auth';

const marketingLinks = [
  { to: '/how-it-works', label: 'How it works' },
  { to: '/pricing', label: 'Pricing' },
];

const appLinks = [
  { to: '/today', label: 'Today' },
  { to: '/library', label: 'Library' },
];

export function Nav() {
  const { user, signOut } = useAuth();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const links = user ? appLinks : marketingLinks;

  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-bg/80 backdrop-blur-md">
      <div className="container-x flex h-16 items-center justify-between">
        <Logo to={user ? '/today' : '/'} />

        <nav className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                `rounded-full px-3.5 py-2 text-sm font-medium transition ${
                  isActive ? 'text-ink' : 'text-muted hover:text-ink'
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          {user ? (
            <>
              <Link to="/profile" className="btn-ghost">
                {user.name}
              </Link>
              <button className="btn-secondary" onClick={() => { signOut(); nav('/'); }}>
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link to="/signin" className="btn-ghost">
                Sign in
              </Link>
              <Link to="/onboarding" className="btn-primary">
                Start free
              </Link>
            </>
          )}
        </div>

        <button className="md:hidden text-ink" onClick={() => setOpen((v) => !v)} aria-label="Menu">
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {open && (
        <div className="border-t border-line bg-bg px-5 py-4 md:hidden">
          <div className="flex flex-col gap-1">
            {links.map((l) => (
              <Link key={l.to} to={l.to} className="rounded-lg px-2 py-2.5 text-[15px] font-medium text-ink" onClick={() => setOpen(false)}>
                {l.label}
              </Link>
            ))}
            <div className="mt-2 flex flex-col gap-2">
              {user ? (
                <button className="btn-secondary" onClick={() => { signOut(); nav('/'); setOpen(false); }}>Sign out</button>
              ) : (
                <>
                  <Link to="/signin" className="btn-secondary" onClick={() => setOpen(false)}>Sign in</Link>
                  <Link to="/onboarding" className="btn-primary" onClick={() => setOpen(false)}>Start free</Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
