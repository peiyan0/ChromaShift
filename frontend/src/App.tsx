import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link as RouterLink, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';

import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import EmailVerification from './pages/auth/EmailVerification';

import { DashboardHistory } from './components/DashboardHistory';
import { DragDropUpload } from './components/DragDropUpload';
import { CalibrationWizard } from './components/CalibrationWizard';
import { WorkspaceStudio } from './components/WorkspaceStudio';
import { PromoteModal } from './components/PromoteModal';
import { VisionTest } from './components/VisionTest';
import { AdminAnalytics } from './components/AdminAnalytics';
import { LandingPage } from './components/LandingPage';
import { LogoIcon } from './components/LogoIcon';

import { FiSun, FiMoon, FiMenu, FiX, FiLogOut } from 'react-icons/fi';

// ─── Logo Mark ───────────────────────────────────────────
const Logo = () => (
  <RouterLink to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
    <LogoIcon size={24} />
    <span style={{
      fontFamily: 'var(--font-heading)',
      fontSize: '1.25rem',
      fontWeight: 'var(--fw-bold)',
      letterSpacing: '-0.03em',
      color: 'var(--text-primary)'
    }}>
      Chroma<span style={{ color: 'var(--primary)' }}>Shift</span>
    </span>
  </RouterLink>
);

// ─── Nav Link Pill ────────────────────────────────────────
interface NavLinkProps {
  to: string;
  label: string;
  onClick?: () => void;
}
const NavLink = ({ to, label, onClick }: NavLinkProps) => {
  const location = useLocation();
  const isActive = location.pathname === to;
  // Convert route into a safe ID selector target, e.g. /test-vision -> nav-test-vision
  const idTarget = `nav-${to.substring(1).replace('/', '-')}`;
  return (
    <RouterLink
      id={idTarget}
      to={to}
      onClick={onClick}
      className={`btn btn-sm ${isActive ? 'btn-secondary' : 'btn-ghost'}`}
      style={{ fontWeight: isActive ? 'var(--fw-bold)' : 'var(--fw-medium)' }}
    >
      {label}
    </RouterLink>
  );
};

// ─── Theme Toggle ─────────────────────────────────────────
const ThemeToggle = () => {
  const [theme, setTheme] = useState(() => document.documentElement.getAttribute('data-theme') || 'light');

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    setTheme(next);
  };

  return (
    <button
      onClick={toggle}
      className="btn btn-ghost"
      style={{ padding: '8px', borderRadius: '50%', width: '36px', height: '36px', minWidth: '36px' }}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
    >
      {theme === 'dark' ? <FiSun size={18} /> : <FiMoon size={18} />}
    </button>
  );
};

// ─── App Shell Layout ─────────────────────────────────────
const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const { logout, isGuest, isAdmin } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isPromoteOpen, setIsPromoteOpen] = useState(false);

  // Close mobile menu on resize
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 992) {
        setMobileOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const navLinks = [
    { to: '/upload', label: 'Upload' },
    { to: '/hub', label: 'Media Hub' },
    { to: '/test-vision', label: 'Visual Metrics' },
    { to: '/survey', label: 'Usability Survey' },
    { to: '/settings', label: 'Vision Profile' },
  ];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      
      {/* Skip Link for Accessibility */}
      <a href="#main-content" className="skip-link">Skip to main content</a>

      {/* Guest Session Banner */}
      {isGuest && (
        <div style={{
          background: 'var(--primary)',
          color: 'white',
          padding: '8px 16px',
          textAlign: 'center',
          fontSize: '0.85rem',
          fontWeight: 'var(--fw-medium)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'wrap',
          zIndex: 101
        }}>
          <span>🎨 Guest session — calibration auto-prunes in 24 hours.</span>
          <button
            onClick={() => setIsPromoteOpen(true)}
            className="btn btn-sm btn-outline"
            style={{ color: 'white', borderColor: 'rgba(255, 255, 255, 0.4)', background: 'rgba(255, 255, 255, 0.1)' }}
          >
            Save Account
          </button>
        </div>
      )}

      {/* Sticky Header */}
      <header className="glass-header">
        <div className="container hstack" style={{ justifyContent: 'space-between', height: '64px' }}>
          
          <div className="hstack gap-3">
            <Logo />
            {isGuest && (
              <span className="badge badge-primary" style={{ fontSize: '0.65rem', padding: '4px 8px' }}>
                Guest
              </span>
            )}
          </div>

          {/* Desktop Nav */}
          <nav className="hstack gap-1" style={{ display: 'none' }} className-desktop="hstack">
            {navLinks.map(link => (
              <NavLink key={link.to} to={link.to} label={link.label} />
            ))}
            {isAdmin && (
              <NavLink to="/admin/analytics" label="🛡 Admin" />
            )}
          </nav>

          {/* Desktop Auth and Settings */}
          <div className="hstack gap-2">
            <ThemeToggle />

            <div className="hstack gap-2" style={{ display: 'none' }} className-desktop="hstack">
              <span style={{ width: '1px', height: '16px', backgroundColor: 'var(--border-primary)' }} />
              {isGuest ? (
                <>
                  <button onClick={() => setIsPromoteOpen(true)} className="btn btn-sm btn-primary">
                    Save Progress
                  </button>
                  <RouterLink to="/auth/login" className="btn btn-sm btn-ghost">
                    Log In
                  </RouterLink>
                </>
              ) : (
                <button onClick={logout} className="btn btn-sm btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FiLogOut size={14} />
                  <span>Log Out</span>
                </button>
              )}
            </div>

            {/* Mobile Hamburger Toggle */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="btn btn-ghost"
              style={{ padding: '8px', display: 'flex', borderRadius: '50%', width: '36px', height: '36px', minWidth: '36px' }}
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <FiX size={20} /> : <FiMenu size={20} />}
            </button>
          </div>
        </div>
      </header>

      {/* Custom responsive utility stylesheet overrides */}
      <style>{`
        @media (min-width: 992px) {
          [className-desktop~="hstack"] {
            display: flex !important;
          }
          button[aria-expanded] {
            display: none !important;
          }
        }
      `}</style>

      {/* Mobile Nav Drawer */}
      {mobileOpen && (
        <div style={{
          position: 'fixed',
          top: '64px',
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'var(--bg-primary)',
          zIndex: 'var(--z-overlay)',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          borderTop: '1px solid var(--border-primary)',
          animation: 'fade-in 0.2s ease-out'
        }}>
          <div className="vstack gap-2">
            {navLinks.map(link => (
              <NavLink key={link.to} to={link.to} label={link.label} onClick={() => setMobileOpen(false)} />
            ))}
            {isAdmin && (
              <NavLink to="/admin/analytics" label="🛡 Admin Panel" onClick={() => setMobileOpen(false)} />
            )}
          </div>
          <span style={{ height: '1px', backgroundColor: 'var(--border-primary)' }} />
          <div className="vstack gap-2">
            {isGuest ? (
              <>
                <button
                  onClick={() => { setMobileOpen(false); setIsPromoteOpen(true); }}
                  className="btn btn-primary"
                  style={{ width: '100%' }}
                >
                  Save Account
                </button>
                <RouterLink
                  to="/auth/login"
                  className="btn btn-outline"
                  onClick={() => setMobileOpen(false)}
                  style={{ width: '100%' }}
                >
                  Log In
                </RouterLink>
              </>
            ) : (
              <button
                onClick={() => { setMobileOpen(false); logout(); }}
                className="btn btn-outline"
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                <FiLogOut size={16} />
                <span>Log Out</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main id="main-content" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div className="container" style={{ paddingTop: '32px', paddingBottom: '64px', flex: 1, display: 'flex', flexDirection: 'column' }}>
          {children}
        </div>
      </main>

      {/* Editorial Footer */}
      <footer style={{
        borderTop: '1px solid var(--border-primary)',
        backgroundColor: 'var(--bg-secondary)',
        padding: '32px 0',
        fontSize: '0.875rem',
        color: 'var(--text-secondary)'
      }}>
        <div className="container" style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '24px'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px'
          }}>
            <Logo />
            <div className="hstack gap-4" style={{ flexWrap: 'wrap' }}>
              <RouterLink to="/" className="btn-ghost" style={{ fontSize: '0.85rem' }}>Home</RouterLink>
              <RouterLink to="/hub" className="btn-ghost" style={{ fontSize: '0.85rem' }}>Media Hub</RouterLink>
              <RouterLink to="/test-vision" className="btn-ghost" style={{ fontSize: '0.85rem' }}>Visual Metrics</RouterLink>
            </div>
          </div>
          <div style={{
            display: 'flex',
            justifyContent: 'between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            fontSize: '0.75rem',
            color: 'var(--text-muted)'
          }}>
            <span>© {new Date().getFullYear()} ChromaShift. All rights reserved.</span>
            <span>Empowering the chromatic digital divide for the 300 million.</span>
          </div>
        </div>
      </footer>

      {/* Promoted account dialog */}
      <PromoteModal isOpen={isPromoteOpen} onClose={() => setIsPromoteOpen(false)} />

      {/* Floating Usability Test / Survey Button */}
      <RouterLink 
        to="/survey" 
        className="btn btn-primary"
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 9999,
          boxShadow: '0 8px 24px rgba(79, 70, 229, 0.4)',
          background: 'var(--primary-gradient)',
          border: 'none',
          padding: '10px 20px',
          fontSize: '0.85rem',
          borderRadius: 'var(--radius-full)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          textDecoration: 'none',
          color: 'white',
          transition: 'transform 0.2s ease, box-shadow 0.2s ease'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 12px 28px rgba(79, 70, 229, 0.5)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 8px 24px rgba(79, 70, 229, 0.4)';
        }}
      >
        <span>Help us test / Usability Survey</span>
      </RouterLink>
    </div>
  );
};

import { SurveyWizard } from './components/SurveyWizard';

import { OnboardingTour } from './components/OnboardingTour';

// ─── Router ───────────────────────────────────────────────
function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <OnboardingTour />
        <Routes>
          <Route path="/auth/login"    element={<Login />} />
          <Route path="/auth/register" element={<Register />} />
          <Route path="/auth/verify"   element={<EmailVerification />} />

          <Route path="/" element={<AppLayout><LandingPage /></AppLayout>} />

          <Route path="/hub" element={
            <ProtectedRoute><AppLayout><DashboardHistory /></AppLayout></ProtectedRoute>
          } />
          <Route path="/upload" element={
            <ProtectedRoute><AppLayout><DragDropUpload /></AppLayout></ProtectedRoute>
          } />
          <Route path="/settings" element={
            <ProtectedRoute><AppLayout><CalibrationWizard /></AppLayout></ProtectedRoute>
          } />
          <Route path="/test-vision" element={
            <ProtectedRoute><AppLayout><VisionTest /></AppLayout></ProtectedRoute>
          } />
          <Route path="/admin/analytics" element={
            <ProtectedRoute><AppLayout><AdminAnalytics /></AppLayout></ProtectedRoute>
          } />
          <Route path="/workspace/:jobId" element={
            <ProtectedRoute><AppLayout><WorkspaceStudio /></AppLayout></ProtectedRoute>
          } />
          <Route path="/survey" element={
            <ProtectedRoute><AppLayout><SurveyWizard performanceMetrics={{}} onComplete={() => {}} /></AppLayout></ProtectedRoute>
          } />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
