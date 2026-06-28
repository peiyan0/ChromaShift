import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

interface TourStep {
  target: string;
  title: string;
  content: string;
  route: string;
}

export const OnboardingTour: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [currentStep, setCurrentStep] = useState<number>(-1);
  const [visible, setVisible] = useState<boolean>(false);

  const steps: TourStep[] = [
    {
      target: 'header',
      title: 'Welcome to ChromaShift!',
      content: 'Let\'s set up your personalized color filters in a few quick steps.',
      route: '/'
    },
    {
      target: 'nav-settings',
      title: '1. Color Profile',
      content: 'Take a quick test to calibrate colors specifically for your eyes.',
      route: '/settings'
    },
    {
      target: 'nav-upload',
      title: '2. Upload Media',
      content: 'Upload any image or video to adjust its colors instantly.',
      route: '/upload'
    },
    {
      target: 'nav-hub',
      title: '3. Media Hub',
      content: 'Access all your adjusted files and reports in one place.',
      route: '/hub'
    },
    {
      target: 'nav-metrics',
      title: '4. Visual Metrics',
      content: 'Test your speed and accuracy with and without filters.',
      route: '/test-vision'
    },
    {
      target: 'nav-survey',
      title: '5. Usability Survey',
      content: 'Provide your final feedback on the platform.',
      route: '/survey'
    }
  ];

  useEffect(() => {
    const checkTour = () => {
      const hasCompletedTour = localStorage.getItem('chromashift_onboarding_completed');
      if (!hasCompletedTour) {
        const stepIndex = steps.findIndex(
          s => s.route === location.pathname || (s.route === '/auth/login' && location.pathname === '/auth/register')
        );
        if (stepIndex !== -1) {
          setCurrentStep(stepIndex);
          setVisible(true);
        } else {
          setVisible(false);
        }
      }
    };

    checkTour();

    const handleStartTour = () => {
      localStorage.removeItem('chromashift_onboarding_completed');
      setCurrentStep(0);
      setVisible(true);
      if (location.pathname !== '/') {
        navigate('/');
      }
    };

    window.addEventListener('chromashift_start_tour', handleStartTour);
    return () => {
      window.removeEventListener('chromashift_start_tour', handleStartTour);
    };
  }, [location.pathname, navigate]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      const targetRoute = steps[nextStep].route;
      if (location.pathname !== targetRoute) {
        navigate(targetRoute);
      }
    } else {
      handleClose();
    }
  };

  const handleClose = () => {
    localStorage.setItem('chromashift_onboarding_completed', 'true');
    setVisible(false);
    navigate('/');
  };

  if (!visible || currentStep === -1) return null;

  const step = steps[currentStep];

  return (
    <div style={{
      position: 'fixed',
      bottom: '24px',
      left: '24px',
      maxWidth: '350px',
      backgroundColor: 'var(--bg-glass)',
      border: '1px solid var(--border-secondary)',
      borderRadius: 'var(--radius-lg)',
      padding: '20px',
      boxShadow: 'var(--shadow-xl)',
      zIndex: 99999,
      backdropFilter: 'blur(12px)',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      animation: 'slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
    }}>
      <div className="hstack" style={{ justifyContent: 'space-between' }}>
        <strong style={{ fontSize: '0.95rem', color: 'var(--primary)' }}>{step.title}</strong>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{currentStep + 1} of {steps.length}</span>
      </div>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.4', margin: 0 }}>
        {step.content}
      </p>
      <div className="hstack gap-2" style={{ justifyContent: 'flex-end', marginTop: '8px' }}>
        <button onClick={handleClose} className="btn btn-sm btn-ghost">Skip</button>
        <button onClick={handleNext} className="btn btn-sm btn-primary">
          {currentStep === steps.length - 1 
            ? (localStorage.getItem('chromashift_survey_completed') === 'true' ? 'Complete Tour' : 'Get Started') 
            : 'Next'}
        </button>
      </div>
    </div>
  );
};
