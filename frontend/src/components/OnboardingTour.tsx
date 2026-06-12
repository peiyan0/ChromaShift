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
      content: 'Let\'s take a quick tour to show you how to calibrate and view media correctly.',
      route: '/'
    },
    {
      target: 'nav-settings',
      title: '1. Diagnose Vision',
      content: 'Click "Test Vision" to diagnose your color vision parameters and save your personalized vision corrections profile.',
      route: '/'
    },
    {
      target: 'nav-upload',
      title: '2. Upload Files',
      content: 'Go to the "Upload" tab to process images, videos, or PDF documents locally using our segment-aware AI.',
      route: '/'
    },
    {
      target: 'nav-hub',
      title: '3. View Processed Files',
      content: 'Access your calibrated assets at any time in the "Media Hub" dashboard.',
      route: '/'
    },
    {
      target: 'nav-test-vision',
      title: '4. Visual Metrics',
      content: 'Review quantitative data checks, color diagnostic patterns, and performance metrics inside "Visual Metrics".',
      route: '/'
    },
    {
      target: 'nav-survey',
      title: '5. Usability Survey & Feedback',
      content: 'Submit demographic details, SUS confidence scores, and task ratings using the "Usability Survey" tab.',
      route: '/'
    }
  ];

  useEffect(() => {
    const hasCompletedTour = localStorage.getItem('chromashift_onboarding_completed');
    if (!hasCompletedTour && location.pathname === '/') {
      setCurrentStep(0);
      setVisible(true);
    }
  }, [location.pathname]);

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
          {currentStep === steps.length - 1 ? 'Get Started' : 'Next'}
        </button>
      </div>
    </div>
  );
};
