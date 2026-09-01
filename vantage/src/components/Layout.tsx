import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { Nav } from './Nav';
import { Footer } from './Footer';
import { useAuth } from '../lib/auth';

export function MarketingLayout() {
  return (
    <>
      <Nav />
      <main>
        <Outlet />
      </main>
      <Footer />
    </>
  );
}

export function AppLayout() {
  return (
    <>
      <Nav />
      <main className="container-x py-8 md:py-12">
        <Outlet />
      </main>
    </>
  );
}

export function RequireAuth() {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return null;
  if (!user) return <Navigate to="/signin" state={{ from: loc.pathname }} replace />;
  return <Outlet />;
}
