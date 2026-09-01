import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './index.css';
import { AuthProvider } from './lib/auth';
import { MarketingLayout, AppLayout, RequireAuth } from './components/Layout';
import { ScrollTop } from './components/ScrollTop';

import Landing from './pages/Landing';
import HowItWorks from './pages/HowItWorks';
import Pricing from './pages/Pricing';
import SignIn from './pages/SignIn';
import Onboarding from './pages/Onboarding';
import Welcome from './pages/Welcome';
import Today from './pages/Today';
import Library from './pages/Library';
import Profile from './pages/Profile';
import NotFound from './pages/NotFound';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ScrollTop />
        <Routes>
          <Route element={<MarketingLayout />}>
            <Route path="/" element={<Landing />} />
            <Route path="/how-it-works" element={<HowItWorks />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/signin" element={<SignIn />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/welcome" element={<Welcome />} />
          </Route>
          <Route element={<RequireAuth />}>
            <Route element={<AppLayout />}>
              <Route path="/today" element={<Today />} />
              <Route path="/library" element={<Library />} />
              <Route path="/profile" element={<Profile />} />
            </Route>
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
