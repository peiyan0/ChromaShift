import React, { useEffect, useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { FiCheckCircle, FiCircle } from 'react-icons/fi';

interface Step {
  id: string;
  label: string;
  desc: string;
  path: string;
  isComplete: () => boolean;
}

export const WorkflowSidebar: React.FC = () => {
  const location = useLocation();
  const [trigger, setTrigger] = useState(0);
  const [showCongrats, setShowCongrats] = useState(false);

  useEffect(() => {
    // Re-evaluate completion status on route change or custom events
    const handleStorage = () => setTrigger(prev => prev + 1);
    window.addEventListener('storage', handleStorage);
    window.addEventListener('chromashift_calibrated', handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('chromashift_calibrated', handleStorage);
    };
  }, [location.pathname]);

  // Set hub visited metric on route
  useEffect(() => {
    if (location.pathname.startsWith('/hub')) {
      localStorage.setItem('chromashift_visited_hub', 'true');
    }
  }, [location.pathname]);

  const steps: Step[] = [
    {
      id: 'calibrate',
      label: 'Calibrate Vision',
      desc: 'Complete vision test',
      path: '/settings',
      isComplete: () => {
        const cached = localStorage.getItem('chromashift_cvd_profile');
        if (cached) {
          try {
            return !!JSON.parse(cached).cvd_type;
          } catch {
            return false;
          }
        }
        return false;
      }
    },
    {
      id: 'upload',
      label: 'Upload Media',
      desc: 'Upload an image/video/PDF',
      path: '/upload',
      isComplete: () => {
        const guestJobs = localStorage.getItem('chromashift_guest_jobs');
        if (guestJobs && JSON.parse(guestJobs).length > 0) return true;
        return false;
      }
    },
    {
      id: 'hub',
      label: 'Media Hub',
      desc: 'View your remaps',
      path: '/hub',
      isComplete: () => {
        const guestJobs = localStorage.getItem('chromashift_guest_jobs');
        const visitedHub = localStorage.getItem('chromashift_visited_hub') === 'true';
        return !!guestJobs && JSON.parse(guestJobs).length > 0 && visitedHub;
      }
    },
    {
      id: 'metrics',
      label: 'Visual Metrics',
      desc: 'Test speed and accuracy',
      path: '/test-vision',
      isComplete: () => {
        return localStorage.getItem('chromashift_metrics_done') === 'true';
      }
    },
    {
      id: 'survey',
      label: 'Usability Survey',
      desc: 'Submit final feedback',
      path: '/survey',
      isComplete: () => {
        return localStorage.getItem('chromashift_survey_completed') === 'true';
      }
    }
  ];

  const allComplete = steps.every(s => s.isComplete());

  useEffect(() => {
    if (allComplete) {
      const dismissed = localStorage.getItem('chromashift_congrats_dismissed');
      if (!dismissed) {
        setShowCongrats(true);
      }
    }
  }, [allComplete, trigger]);

  const dismissCongrats = () => {
    localStorage.setItem('chromashift_congrats_dismissed', 'true');
    setShowCongrats(false);
  };

  return (
    <div className="workflow-sidebar-content">
      <h3 className="workflow-sidebar-title" style={{ fontSize: '1rem', color: 'var(--text-primary)', margin: 0, fontFamily: 'var(--font-heading)', marginBottom: '12px' }}>Workflow Steps</h3>
      <div className="workflow-sidebar-steps">
        {steps.map((step) => {
          const active = location.pathname.startsWith(step.path) || (step.path === '/hub' && location.pathname.startsWith('/workspace/'));
          const completed = step.isComplete();
          return (
            <Link
              key={step.id}
              to={step.path}
              className="workflow-sidebar-step"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                borderRadius: 'var(--radius-md)',
                textDecoration: 'none',
                backgroundColor: active ? 'var(--primary-glow)' : 'transparent',
                border: active ? '1px solid var(--primary)' : '1px solid transparent',
                color: active ? 'var(--primary)' : 'var(--text-secondary)',
                transition: 'all 0.2s ease',
                fontWeight: active ? 'bold' : 'normal'
              }}
            >
              {completed ? (
                <FiCheckCircle size={18} style={{ color: 'var(--color-success)', flexShrink: 0 }} />
              ) : (
                <FiCircle size={18} style={{ flexShrink: 0 }} />
              )}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span className="workflow-sidebar-label" style={{ fontSize: '0.85rem' }}>{step.label}</span>
                <span className="workflow-sidebar-desc" style={{ fontSize: '0.65rem', color: active ? 'var(--primary)' : 'var(--text-muted)', opacity: 0.8 }}>{step.desc}</span>
              </div>
            </Link>
          );
        })}
      </div>
      
      <div className="workflow-sidebar-footer" style={{
        padding: '16px',
        backgroundColor: 'var(--bg-primary)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-primary)',
        fontSize: '0.8rem',
        color: 'var(--text-secondary)'
      }}>
        <strong style={{ display: 'block', marginBottom: '8px', color: 'var(--text-primary)' }}>Next Step</strong>
        {(() => {
          const nextIncomplete = steps.find(s => !s.isComplete());
          if (nextIncomplete) {
            return `Please proceed to ${nextIncomplete.label}.`;
          }
          return "All steps complete! Thank you.";
        })()}
      </div>

      {showCongrats && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 999999,
          animation: 'fade-in 0.3s ease'
        }}>
          <div style={{
            backgroundColor: 'var(--bg-glass)', border: '1px solid var(--primary)',
            padding: '40px', borderRadius: '16px', textAlign: 'center',
            maxWidth: '400px', boxShadow: '0 0 40px rgba(100, 100, 255, 0.2)'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px', animation: 'bounce 1s ease infinite' }}>🎉</div>
            <h2 style={{ margin: '0 0 16px 0', color: 'var(--primary)' }}>Congratulations!</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: '1.5' }}>
              You have completed all the steps. Thank you for taking the time to test our platform and provide your valuable feedback!
            </p>
            <button 
              onClick={dismissCongrats}
              className="btn btn-primary"
              style={{ width: '100%', padding: '12px' }}
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
