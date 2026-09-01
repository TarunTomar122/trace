import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { Mark } from '../components/Logo';
import { BRAND } from '../lib/brand';

export default function SignIn() {
  const { signIn } = useAuth();
  const nav = useNavigate();
  const loc = useLocation() as { state?: { from?: string } };
  const [email, setEmail] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes('@')) return;
    signIn(email);
    nav(loc.state?.from || '/today');
  };

  return (
    <div className="dawn grid min-h-[calc(100vh-4rem)] place-items-center px-5 py-14">
      <div className="w-full max-w-sm">
        <div className="card shadow-lift">
          <Mark size={34} />
          <h1 className="h-display mt-4 text-2xl">Welcome back.</h1>
          <p className="mt-1.5 text-[14.5px] text-muted">Sign in to hear today’s brief.</p>

          <form onSubmit={submit} className="mt-6 grid gap-3">
            <input
              className="input"
              type="email"
              placeholder="you@work.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
            />
            <button className="btn-primary btn-lg w-full" type="submit">
              Continue <ArrowRight size={18} />
            </button>
          </form>

          <div className="my-5 flex items-center gap-3 text-xs text-muted">
            <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
          </div>
          <div className="grid gap-2">
            <button className="btn-secondary w-full" onClick={() => { signIn('you@gmail.com'); nav('/today'); }}>
              Continue with Google
            </button>
            <button className="btn-secondary w-full" onClick={() => { signIn('you@icloud.com'); nav('/today'); }}>
              Continue with Apple
            </button>
          </div>
          {/* LIVE SWAP: wire these three to Firebase Auth (email link + Google/Apple providers). */}
        </div>

        <p className="mt-5 text-center text-sm text-muted">
          New to {BRAND.name}?{' '}
          <Link to="/onboarding" className="link-underline font-medium text-ink">
            Start free
          </Link>
        </p>
      </div>
    </div>
  );
}
