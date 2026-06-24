import React, { useState } from 'react';
import api from '../services/api';

// SVG Icons
const StudyIcon = () => (
  <svg width="40" height="40" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" style={{ color: 'var(--primary)' }}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
  </svg>
);

const SuccessIcon = () => (
  <svg width="60" height="60" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" style={{ color: 'var(--color-success)' }}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

interface SurveyWizardProps {
  performanceMetrics: any;
  onComplete: (participantUuid: string) => void;
  onBackToApp?: () => void;
}

export const SurveyWizard: React.FC<SurveyWizardProps> = ({ performanceMetrics, onComplete, onBackToApp }) => {
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  React.useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  React.useEffect(() => {
    const cached = localStorage.getItem('chromashift_cvd_profile');
    if (cached) {
      try {
        const profile = JSON.parse(cached);
        if (profile && profile.cvd_type) {
          const type = profile.cvd_type.toLowerCase();
          if (type.includes('deuteran')) setCvdType('Deuteran');
          else if (type.includes('protan')) setCvdType('Protan');
          else if (type.includes('tritan')) setCvdType('Tritan');
          else if (type.includes('normal')) setCvdType('Normal');
        }
      } catch (_) {}
    }
  }, []);

  const [step, setStep] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 1. Demographics States
  const [age, setAge] = useState<string>('');
  const [gender, setGender] = useState<string>('Male');
  const [occupation, setOccupation] = useState<string>('');
  const [education, setEducation] = useState<string>("Bachelor's");
  const [cvdType, setCvdType] = useState<string>('Normal');
  const [diagnosed, setDiagnosed] = useState<string>('Yes');
  const [priorTools, setPriorTools] = useState<string>('None');
  const [glassesFreq, setGlassesFreq] = useState<string>('Never');
  const [appComfort, setAppComfort] = useState<string>('Comf.');
  const [deviceFreq, setDeviceFreq] = useState<string>('15-30 hrs');

  // 2. SUS States (1 = Strongly Disagree, 5 = Strongly Agree)
  const [sus, setSus] = useState<Record<string, number>>({
    q1: 3, q2: 3, q3: 3, q4: 3, q5: 3, q6: 3, q7: 3, q8: 3, q9: 3, q10: 3
  });

  // 3. NASA TLX (0 to 20 scale)
  const [nasaMental, setNasaMental] = useState<number>(10);
  const [nasaPhysical, setNasaPhysical] = useState<number>(10);
  const [nasaTemporal, setNasaTemporal] = useState<number>(10);
  const [nasaPerformance, setNasaPerformance] = useState<number>(10);
  const [nasaEffort, setNasaEffort] = useState<number>(10);
  const [nasaFrustration, setNasaFrustration] = useState<number>(10);

  // 4. Custom Visual Comfort (1 to 5 scale)
  const [comfortQ1, setComfortQ1] = useState<number>(3);
  const [comfortQ2, setComfortQ2] = useState<number>(3);
  const [comfortQ3, setComfortQ3] = useState<number>(3);
  const [comfortQ4, setComfortQ4] = useState<number>(3);
  const [comfortQ5, setComfortQ5] = useState<number>(3);

  // 1a. Verification Checklist
  const [testedAllFeatures, setTestedAllFeatures] = useState<boolean>(false);

  // 5. Qualitative Feedback
  const [visualTransitions, setVisualTransitions] = useState<string>('');
  const [naturalness, setNaturalness] = useState<string>('');
  const [onboardingWizard, setOnboardingWizard] = useState<string>('');
  const [frustratingAspects, setFrustratingAspects] = useState<string>('');
  const [helpfulAspects, setHelpfulAspects] = useState<string>('');
  const [dailyLifeUse, setDailyLifeUse] = useState<string>('');
  const [scenariosUse, setScenariosUse] = useState<string>('');
  const [openFeedback, setOpenFeedback] = useState<string>('');

  const totalSteps = 6;
  const progressPercent = (step / totalSteps) * 100;

  const triggerNotification = (type: 'success' | 'error', text: string) => {
    setNotification({ type, text });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleSusChange = (question: string, val: number) => {
    setSus(prev => ({ ...prev, [question]: val }));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    
    let finalPerformance = null;
    if (performanceMetrics && Object.keys(performanceMetrics).length > 0) {
      finalPerformance = performanceMetrics;
    } else {
      const cached = sessionStorage.getItem('chromashift_pending_performance_metrics');
      if (cached) {
        try {
          finalPerformance = JSON.parse(cached);
        } catch (_) {}
      }
    }
    if (!finalPerformance) {
      finalPerformance = {
        task1: null,
        task2: null,
        task3: null,
        video: null,
        document: null,
        task6: null
      };
    }

    const pendingMode = sessionStorage.getItem('chromashift_pending_test_mode');
    const selectedMode = pendingMode === 'sandbox' ? 'sandbox' : 'study';

    const payload = {
      demographics: {
        age: age ? parseInt(age, 10) : null,
        gender,
        occupation,
        education_level: education,
        cvd_type: cvdType,
        is_diagnosed: diagnosed,
        prior_tool_use: priorTools,
        color_glasses_frequency: glassesFreq,
        web_app_comfort: appComfort,
        device_use_frequency: deviceFreq,
        selected_mode: selectedMode
      },
      performance: finalPerformance,
      surveys: {
        sus_q1: sus.q1,
        sus_q2: sus.q2,
        sus_q3: sus.q3,
        sus_q4: sus.q4,
        sus_q5: sus.q5,
        sus_q6: sus.q6,
        sus_q7: sus.q7,
        sus_q8: sus.q8,
        sus_q9: sus.q9,
        sus_q10: sus.q10,
        
        nasa_mental: nasaMental,
        nasa_physical: nasaPhysical,
        nasa_temporal: nasaTemporal,
        nasa_performance: nasaPerformance,
        nasa_effort: nasaEffort,
        nasa_frustration: nasaFrustration,
        
        comfort_q1: comfortQ1,
        comfort_q2: comfortQ2,
        comfort_q3: comfortQ3,
        comfort_q4: comfortQ4,
        comfort_q5: comfortQ5,
        interview_visual_transitions: visualTransitions,
        interview_naturalness: naturalness,
        interview_wizard_onboarding: onboardingWizard,
        interview_frustrating_aspects: frustratingAspects,
        interview_helpful_aspects: helpfulAspects,
        interview_open_feedback: `Daily Life Integration:\n${dailyLifeUse}\n\nDaily Useful Scenarios:\n${scenariosUse}\n\nGeneral Feedback/Comments:\n${openFeedback}`
      }
    };

    try {
      const res = await api.post('research/submit', payload);
      const participantUuid = res.data.participant_uuid;
      triggerNotification('success', 'Session Submitted! Your study data has been registered.');
      sessionStorage.removeItem('chromashift_pending_performance_metrics');
      localStorage.setItem('chromashift_survey_completed', 'true');
      setTimeout(() => {
        onComplete(participantUuid);
      }, 1500);
    } catch (e) {
      triggerNotification('error', 'Submission Error: Failed to upload study metrics.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const nextStep = () => setStep(prev => Math.min(prev + 1, totalSteps));
  const prevStep = () => setStep(prev => Math.max(prev - 1, 0));

  const susQuestions = [
    { key: "q1", label: "I would use ChromaShift often." },
    { key: "q2", label: "I found the platform easy to use." },
    { key: "q3", label: "I learned to use the platform quickly." },
    { key: "q4", label: "The features worked well together." },
    { key: "q5", label: "I felt confident using it." },
    { key: "q6", label: "The color test accurately captured how I see colors." },
    { key: "q7", label: "The corrected colors looked natural." },
    { key: "q8", label: "It helped me see colors that I normally struggle with." },
    { key: "q9", label: "I completed tasks faster with the corrected view." },
    { key: "q10", label: "I found it too complicated to use without help." }
  ];

  return (
    <>
      {/* Toast Notification */}
      {notification && (
        <div
          className={`badge badge-${notification.type === 'error' ? 'error' : 'success'}`}
          style={{
            position: 'fixed',
            top: '80px',
            right: '24px',
            zIndex: 9999,
            padding: '12px 24px',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)',
            border: 'none',
            textTransform: 'none',
            fontWeight: 'bold',
            backgroundColor: notification.type === 'error' ? 'var(--color-error)' : 'var(--color-success)',
            color: '#ffffff',
            animation: 'slide-up 0.2s ease-out'
          }}
        >
          {notification.text}
        </div>
      )}

      <div
        style={windowWidth <= 768 ? {
          width: '100%',
          position: 'relative'
        } : {
          width: '100%',
          maxWidth: '900px',
          margin: 'var(--space-4) auto',
          padding: '1px',
          background: 'var(--primary-gradient)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-xl)',
          position: 'relative'
        }}
      >

      <div
        key={step}
        style={windowWidth <= 768 ? {
          padding: '16px',
          backgroundColor: 'var(--bg-primary)'
        } : {
          padding: 'var(--space-8)',
          backgroundColor: 'var(--bg-primary)',
          borderRadius: '23px',
          border: '1px solid var(--border-primary)'
        }}
        className="vstack gap-6"
      >
        {/* Navigation Step Header */}
        {step > 0 && (
          <div className="vstack gap-2" style={{ width: '100%', marginBottom: 'var(--space-4)' }}>
            <div className="hstack" style={{ justifyContent: 'space-between', width: '100%', flexWrap: 'wrap', gap: '8px' }}>
              <span className="badge badge-primary" style={{ padding: '6px 12px' }}>
                <span>Step </span><span>{step}</span><span> of </span><span>{totalSteps}</span>
              </span>
              <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', flexWrap: 'wrap', textAlign: 'right' }}>
                {step === 1 && <span>Demographics Intake</span>}
                {step === 2 && <span>System Usability Scale (SUS)</span>}
                {step === 3 && <span>NASA Task Load Index</span>}
                {step === 4 && <span>Visual Comfort Scale</span>}
                {step === 5 && <span>Open-Ended Interview Logs</span>}
                {step === 6 && <span>Summary & Verification</span>}
              </span>
            </div>
            {/* Progress bar */}
            <div
              style={{
                height: '4px',
                width: '100%',
                backgroundColor: 'var(--bg-secondary)',
                borderRadius: 'var(--radius-full)',
                overflow: 'hidden'
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${progressPercent}%`,
                  backgroundColor: 'var(--primary)',
                  borderRadius: 'var(--radius-full)',
                  transition: 'width var(--transition-normal)'
                }}
              />
            </div>
          </div>
        )}

        {/* Step 0: Welcome and Consent */}
        {step === 0 && (
          <div className="vstack gap-6" style={{ alignItems: 'center', textAlign: 'center', padding: 'var(--space-4) 0' }}>
            <StudyIcon />
            <div className="vstack gap-2">
              <h2
                style={{
                  fontSize: '1.75rem',
                  fontWeight: '900',
                  background: 'var(--primary-gradient)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                Usability Survey
              </h2>
              <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto' }}>
                Thank you for testing! Your feedback helps us improve ChromaShift.
              </p>
            </div>

            <div 
              className="card-solid" 
              style={{ 
                width: '100%', 
                maxWidth: '650px', 
                textAlign: 'left', 
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-primary)',
                padding: 'var(--space-6)',
                fontSize: '0.875rem',
                color: 'var(--text-secondary)'
              }}
            >
              <h4 style={{ fontWeight: '700', color: 'var(--text-primary)', marginBottom: 'var(--space-2)' }}>Survey Info:</h4>
              <ul style={{ listStyleType: 'none', paddingLeft: '0', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                <li>• Your responses are secure, private, and visible only to administrators.</li>
                <li>• It takes about 3–5 minutes to complete.</li>
              </ul>
            </div>

            <div 
              className="card-solid" 
              style={{ 
                width: '100%', 
                maxWidth: '650px', 
                textAlign: 'left', 
                backgroundColor: 'rgba(59, 130, 246, 0.05)',
                border: '1px solid var(--primary)',
                padding: 'var(--space-5)',
                fontSize: '0.875rem',
                color: 'var(--text-secondary)'
              }}
            >
              <h4 style={{ fontWeight: '700', color: 'var(--primary)', marginBottom: 'var(--space-2)' }}>Before you start:</h4>
              <p style={{ margin: 0, marginBottom: 'var(--space-3)' }}>
                Please make sure you have tried calibrating your profile and uploaded an image or video first.
              </p>
              <label className="hstack gap-2" style={{ cursor: 'pointer', fontWeight: '700', color: 'var(--text-primary)' }}>
                <input 
                  type="checkbox"
                  checked={testedAllFeatures}
                  onChange={e => setTestedAllFeatures(e.target.checked)}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <span>I have tried the core features of the app</span>
              </label>
            </div>

            <div 
              className={windowWidth <= 480 ? "vstack gap-3" : "hstack gap-4"} 
              style={{ 
                marginTop: 'var(--space-4)',
                width: windowWidth <= 480 ? '100%' : 'auto',
                alignItems: 'stretch'
              }}
            >
              {onBackToApp && (
                <button 
                  className="btn btn-outline btn-lg" 
                  onClick={onBackToApp}
                  style={{ width: windowWidth <= 480 ? '100%' : 'auto' }}
                >
                  Return to Dashboard
                </button>
              )}
              <button
                className="btn btn-primary btn-lg"
                onClick={nextStep}
                disabled={!testedAllFeatures}
                style={{
                  background: testedAllFeatures ? 'var(--primary-gradient)' : 'var(--bg-secondary)',
                  color: testedAllFeatures ? '#ffffff' : 'var(--text-muted)',
                  boxShadow: testedAllFeatures ? 'var(--shadow-lg)' : 'none',
                  width: windowWidth <= 480 ? '100%' : 'auto',
                  cursor: testedAllFeatures ? 'pointer' : 'not-allowed'
                }}
              >
                Accept & Begin Survey
              </button>
            </div>
          </div>
        )}

        {/* Step 1: Pre-Task Demographics & self-report */}
        {step === 1 && (
          <div className="vstack gap-6" style={{ width: '100%' }}>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: '900', color: 'var(--text-primary)' }}>
                Pre-Task Demographics Intake
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Provide brief baseline parameters before starting active vision tasks.
              </p>
            </div>

            <div className="divider" style={{ margin: '0' }} />

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: windowWidth <= 480 ? '1fr' : 'repeat(auto-fit, minmax(250px, 1fr))',
                gap: 'var(--space-6)',
                width: '100%'
              }}
            >
              <div className="form-group">
                <label className="label" htmlFor="age">Age (years) <span style={{ color: 'var(--color-error)' }}>*</span></label>
                <input
                  id="age"
                  type="number"
                  required
                  placeholder="e.g. 25"
                  className="input"
                  value={age}
                  onChange={e => setAge(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="label" htmlFor="gender">Gender <span style={{ color: 'var(--color-error)' }}>*</span></label>
                <select id="gender" className="select" value={gender} onChange={e => setGender(e.target.value)}>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Non-binary">Non-binary</option>
                  <option value="Prefer not to say">Prefer not to say</option>
                </select>
              </div>

              <div className="form-group">
                <label className="label" htmlFor="occupation">Occupation / Field of Study <span style={{ color: 'var(--color-error)' }}>*</span></label>
                <input
                  id="occupation"
                  type="text"
                  required
                  placeholder="e.g. Design, Bio, Finance"
                  className="input"
                  value={occupation}
                  onChange={e => setOccupation(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="label" htmlFor="education">Education Level <span style={{ color: 'var(--color-error)' }}>*</span></label>
                <select id="education" className="select" value={education} onChange={e => setEducation(e.target.value)}>
                  <option value="High School">High School</option>
                  <option value="Bachelor's">Bachelor's</option>
                  <option value="Master's">Master's</option>
                  <option value="PhD">PhD</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="form-group">
                <label className="label" htmlFor="cvdType">Color Blindness (CVD) Type <span style={{ color: 'var(--color-error)' }}>*</span></label>
                <select id="cvdType" className="select" value={cvdType} onChange={e => setCvdType(e.target.value)}>
                  <option value="Normal">Normal / Standard Vision</option>
                  <option value="Deuteran">Green-weak (Deuteran / Deuteranomaly)</option>
                  <option value="Protan">Red-weak (Protan / Protanopia)</option>
                  <option value="Tritan">Blue-weak (Tritan / Tritanopia)</option>
                  <option value="Unsure">Unsure / Not diagnosed</option>
                </select>
              </div>

              <div className="form-group">
                <label className="label" htmlFor="diagnosed">Is this Formally Diagnosed? <span style={{ color: 'var(--color-error)' }}>*</span></label>
                <select id="diagnosed" className="select" value={diagnosed} onChange={e => setDiagnosed(e.target.value)}>
                  <option value="Yes">Yes (By eye professional)</option>
                  <option value="No">No</option>
                  <option value="Strong Suspicion">Strong Suspicion / Family history</option>
                </select>
              </div>

              <div className="form-group">
                <label className="label" htmlFor="priorTools">Prior CVD Correction Tool Usage <span style={{ color: 'var(--color-error)' }}>*</span></label>
                <select id="priorTools" className="select" value={priorTools} onChange={e => setPriorTools(e.target.value)}>
                  <option value="None">None</option>
                  <option value="EnChroma">EnChroma Glasses</option>
                  <option value="Pilestone">Pilestone Glasses</option>
                  <option value="Other">Other digital filters / apps</option>
                </select>
              </div>

              <div className="form-group">
                <label className="label" htmlFor="glassesFreq">Do you regularly wear color glasses? <span style={{ color: 'var(--color-error)' }}>*</span></label>
                <select id="glassesFreq" className="select" value={glassesFreq} onChange={e => setGlassesFreq(e.target.value)}>
                  <option value="Never">Never</option>
                  <option value="Occasionally">Occasionally</option>
                  <option value="Regularly">Regularly / Every day</option>
                </select>
              </div>

              <div className="form-group">
                <label className="label" htmlFor="appComfort">Web Application Comfort Level <span style={{ color: 'var(--color-error)' }}>*</span></label>
                <select id="appComfort" className="select" value={appComfort} onChange={e => setAppComfort(e.target.value)}>
                  <option value="Very Uncomf.">Very Uncomfortable</option>
                  <option value="Uncomf.">Uncomfortable</option>
                  <option value="Neutral">Neutral</option>
                  <option value="Comf.">Comfortable</option>
                  <option value="Very Comf.">Very Comfortable</option>
                </select>
              </div>

              <div className="form-group">
                <label className="label" htmlFor="deviceFreq">Weekly Computer / Screen Use <span style={{ color: 'var(--color-error)' }}>*</span></label>
                <select id="deviceFreq" className="select" value={deviceFreq} onChange={e => setDeviceFreq(e.target.value)}>
                  <option value="<5 hrs/week">&lt; 5 hours/week</option>
                  <option value="5-15 hrs">5–15 hours/week</option>
                  <option value="15-30 hrs">15–30 hours/week</option>
                  <option value=">30 hrs">&gt; 30 hours/week</option>
                </select>
              </div>
            </div>

            <div 
              className={windowWidth <= 480 ? "vstack gap-3" : "hstack"} 
              style={{ 
                justifyContent: 'flex-end', 
                gap: 'var(--space-4)', 
                width: '100%', 
                marginTop: 'var(--space-4)',
                alignItems: 'stretch',
                flexDirection: windowWidth <= 480 ? 'column-reverse' : 'row'
              }}
            >
              <button 
                className="btn btn-outline btn-lg" 
                onClick={prevStep}
                style={{ width: windowWidth <= 480 ? '100%' : 'auto' }}
              >
                Back
              </button>
              <button
                className="btn btn-primary btn-lg"
                onClick={nextStep}
                disabled={!age || !gender || !occupation || !education || !cvdType || !diagnosed || !priorTools || !glassesFreq || !appComfort || !deviceFreq}
                style={{ width: windowWidth <= 480 ? '100%' : 'auto' }}
              >
                Proceed to Usability Scale
              </button>
            </div>
          </div>
        )}

        {/* Step 2: System Usability Scale (SUS) */}
        {step === 2 && (
          <div className="vstack gap-6" style={{ width: '100%' }}>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: '900', color: 'var(--text-primary)' }}>
                System Usability Scale (SUS)
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Rate your agreement with each statement from 1 (Strongly Disagree) to 5 (Strongly Agree).
              </p>
            </div>

            <div className="divider" style={{ margin: '0' }} />

            <div
              className="vstack gap-5"
              style={{
                maxHeight: '450px',
                overflowY: 'auto',
                paddingRight: 'var(--space-2)'
              }}
            >
              {susQuestions.map((q, idx) => (
                <div 
                  key={q.key} 
                  className="vstack gap-3" 
                  style={{ 
                    padding: 'var(--space-4)', 
                    backgroundColor: 'var(--bg-secondary)', 
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-primary)' 
                  }}
                >
                  <span style={{ fontSize: '0.875rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                    <span>{idx + 1}. </span><span>{q.label}</span>
                  </span>

                  <div className="vstack gap-2">
                    <div className="hstack gap-3" style={{ justifyContent: 'center' }}>
                      {[1, 2, 3, 4, 5].map(val => {
                        const isSelected = sus[q.key] === val;
                        return (
                          <button
                            key={val}
                            type="button"
                            className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-outline'}`}
                            style={{
                              width: '40px',
                              height: '40px',
                              borderRadius: 'var(--radius-full)',
                              padding: '0'
                            }}
                            onClick={() => handleSusChange(q.key, val)}
                          >
                            {val}
                          </button>
                        );
                      })}
                    </div>
                    <div className="hstack" style={{ justifyContent: 'space-between', width: '100%', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      <span>Strongly Disagree</span>
                      <span>Strongly Agree</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div 
              className={windowWidth <= 480 ? "vstack gap-3" : "hstack"} 
              style={{ 
                justifyContent: 'space-between', 
                width: '100%', 
                marginTop: 'var(--space-4)',
                alignItems: 'stretch',
                flexDirection: windowWidth <= 480 ? 'column-reverse' : 'row'
              }}
            >
              <button 
                className="btn btn-outline btn-lg" 
                onClick={prevStep}
                style={{ width: windowWidth <= 480 ? '100%' : 'auto' }}
              >
                Back
              </button>
              <button 
                className="btn btn-primary btn-lg" 
                onClick={nextStep}
                style={{ width: windowWidth <= 480 ? '100%' : 'auto' }}
              >
                Proceed to Task Load Index
              </button>
            </div>
          </div>
        )}

        {/* Step 3: NASA Task Load Index */}
        {step === 3 && (
          <div className="vstack gap-6" style={{ width: '100%' }}>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: '900', color: 'var(--text-primary)' }}>
                Task Workload Assessment (NASA TLX)
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Please rate your experience while completing the tasks in this study.
              </p>
            </div>

            <div className="divider" style={{ margin: '0' }} />

            <div className="vstack gap-6" style={{ width: '100%' }}>
              {/* Mental Demand */}
              <div className="vstack gap-2" style={{ padding: 'var(--space-4)', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-primary)' }}>
                <div className="hstack" style={{ justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: '700', fontSize: '0.875rem', color: 'var(--text-primary)' }}>1. Mental Demand</span>
                  <span style={{ fontWeight: '800', color: 'var(--primary)', fontSize: '0.875rem', whiteSpace: 'nowrap', flexShrink: 0 }}><span>{nasaMental}</span> / 20</span>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0 0 var(--space-2) 0' }}>
                  How much mental effort (e.g., thinking, deciding, searching, remembering) did the tasks require?
                </p>
                <div className="slider-container">
                  <input
                    type="range"
                    className="slider"
                    min="0"
                    max="20"
                    step="1"
                    value={nasaMental}
                    onChange={e => setNasaMental(parseInt(e.target.value, 10))}
                  />
                </div>
                <div 
                  style={{ 
                    display: 'flex',
                    flexDirection: windowWidth <= 480 ? 'column' : 'row',
                    justifyContent: 'space-between', 
                    alignItems: windowWidth <= 480 ? 'flex-start' : 'center',
                    width: '100%', 
                    fontSize: '0.75rem', 
                    color: 'var(--text-muted)',
                    gap: windowWidth <= 480 ? '4px' : '8px',
                    marginTop: '4px'
                  }}
                >
                  <span style={{ textAlign: 'left' }}>
                    <strong style={{ color: 'var(--text-secondary)' }}>0:</strong> Very Easy / Effortless
                  </span>
                  <span style={{ textAlign: windowWidth <= 480 ? 'left' : 'right' }}>
                    <strong style={{ color: 'var(--text-secondary)' }}>20:</strong> Very Complex / Demanding
                  </span>
                </div>
              </div>

              {/* Physical Demand */}
              <div className="vstack gap-2" style={{ padding: 'var(--space-4)', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-primary)' }}>
                <div className="hstack" style={{ justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: '700', fontSize: '0.875rem', color: 'var(--text-primary)' }}>2. Physical Demand (Eye Strain)</span>
                  <span style={{ fontWeight: '800', color: 'var(--primary)', fontSize: '0.875rem', whiteSpace: 'nowrap', flexShrink: 0 }}><span>{nasaPhysical}</span> / 20</span>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0 0 var(--space-2) 0' }}>
                  How much physical discomfort did you experience? (e.g., squinting, eye strain, head positioning, focusing)
                </p>
                <div className="slider-container">
                  <input
                    type="range"
                    className="slider"
                    min="0"
                    max="20"
                    step="1"
                    value={nasaPhysical}
                    onChange={e => setNasaPhysical(parseInt(e.target.value, 10))}
                  />
                </div>
                <div 
                  style={{ 
                    display: 'flex',
                    flexDirection: windowWidth <= 480 ? 'column' : 'row',
                    justifyContent: 'space-between', 
                    alignItems: windowWidth <= 480 ? 'flex-start' : 'center',
                    width: '100%', 
                    fontSize: '0.75rem', 
                    color: 'var(--text-muted)',
                    gap: windowWidth <= 480 ? '4px' : '8px',
                    marginTop: '4px'
                  }}
                >
                  <span style={{ textAlign: 'left' }}>
                    <strong style={{ color: 'var(--text-secondary)' }}>0:</strong> None / Comfortable
                  </span>
                  <span style={{ textAlign: windowWidth <= 480 ? 'left' : 'right' }}>
                    <strong style={{ color: 'var(--text-secondary)' }}>20:</strong> Severe strain / Painful
                  </span>
                </div>
              </div>

              {/* Temporal Demand */}
              <div className="vstack gap-2" style={{ padding: 'var(--space-4)', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-primary)' }}>
                <div className="hstack" style={{ justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: '700', fontSize: '0.875rem', color: 'var(--text-primary)' }}>3. Temporal Demand</span>
                  <span style={{ fontWeight: '800', color: 'var(--primary)', fontSize: '0.875rem', whiteSpace: 'nowrap', flexShrink: 0 }}><span>{nasaTemporal}</span> / 20</span>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0 0 var(--space-2) 0' }}>
                  Did you feel rushed or pressured by the rate or pace at which the tasks had to be completed?
                </p>
                <div className="slider-container">
                  <input
                    type="range"
                    className="slider"
                    min="0"
                    max="20"
                    step="1"
                    value={nasaTemporal}
                    onChange={e => setNasaTemporal(parseInt(e.target.value, 10))}
                  />
                </div>
                <div 
                  style={{ 
                    display: 'flex',
                    flexDirection: windowWidth <= 480 ? 'column' : 'row',
                    justifyContent: 'space-between', 
                    alignItems: windowWidth <= 480 ? 'flex-start' : 'center',
                    width: '100%', 
                    fontSize: '0.75rem', 
                    color: 'var(--text-muted)',
                    gap: windowWidth <= 480 ? '4px' : '8px',
                    marginTop: '4px'
                  }}
                >
                  <span style={{ textAlign: 'left' }}>
                    <strong style={{ color: 'var(--text-secondary)' }}>0:</strong> Slow / Leisurely pace
                  </span>
                  <span style={{ textAlign: windowWidth <= 480 ? 'left' : 'right' }}>
                    <strong style={{ color: 'var(--text-secondary)' }}>20:</strong> Frantic / Highly rushed
                  </span>
                </div>
              </div>

              {/* Performance */}
              <div className="vstack gap-2" style={{ padding: 'var(--space-4)', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-primary)' }}>
                <div className="hstack" style={{ justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: '700', fontSize: '0.875rem', color: 'var(--text-primary)' }}>4. Performance Success</span>
                  <span style={{ fontWeight: '800', color: 'var(--primary)', fontSize: '0.875rem', whiteSpace: 'nowrap', flexShrink: 0 }}><span>{nasaPerformance}</span> / 20</span>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0 0 var(--space-2) 0' }}>
                  How successful and satisfied were you with your ability to complete the tasks?
                </p>
                <div className="slider-container">
                  <input
                    type="range"
                    className="slider"
                    min="0"
                    max="20"
                    step="1"
                    value={nasaPerformance}
                    onChange={e => setNasaPerformance(parseInt(e.target.value, 10))}
                  />
                </div>
                <div 
                  style={{ 
                    display: 'flex',
                    flexDirection: windowWidth <= 480 ? 'column' : 'row',
                    justifyContent: 'space-between', 
                    alignItems: windowWidth <= 480 ? 'flex-start' : 'center',
                    width: '100%', 
                    fontSize: '0.75rem', 
                    color: 'var(--text-muted)',
                    gap: windowWidth <= 480 ? '4px' : '8px',
                    marginTop: '4px'
                  }}
                >
                  <span style={{ textAlign: 'left' }}>
                    <strong style={{ color: 'var(--text-secondary)' }}>0:</strong> Perfect success / Satisfied
                  </span>
                  <span style={{ textAlign: windowWidth <= 480 ? 'left' : 'right' }}>
                    <strong style={{ color: 'var(--text-secondary)' }}>20:</strong> Complete failure / Unsatisfied
                  </span>
                </div>
              </div>

              {/* Effort */}
              <div className="vstack gap-2" style={{ padding: 'var(--space-4)', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-primary)' }}>
                <div className="hstack" style={{ justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: '700', fontSize: '0.875rem', color: 'var(--text-primary)' }}>5. Overall Effort</span>
                  <span style={{ fontWeight: '800', color: 'var(--primary)', fontSize: '0.875rem', whiteSpace: 'nowrap', flexShrink: 0 }}><span>{nasaEffort}</span> / 20</span>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0 0 var(--space-2) 0' }}>
                  How hard did you have to work (both mentally and physically) to achieve your level of performance?
                </p>
                <div className="slider-container">
                  <input
                    type="range"
                    className="slider"
                    min="0"
                    max="20"
                    step="1"
                    value={nasaEffort}
                    onChange={e => setNasaEffort(parseInt(e.target.value, 10))}
                  />
                </div>
                <div 
                  style={{ 
                    display: 'flex',
                    flexDirection: windowWidth <= 480 ? 'column' : 'row',
                    justifyContent: 'space-between', 
                    alignItems: windowWidth <= 480 ? 'flex-start' : 'center',
                    width: '100%', 
                    fontSize: '0.75rem', 
                    color: 'var(--text-muted)',
                    gap: windowWidth <= 480 ? '4px' : '8px',
                    marginTop: '4px'
                  }}
                >
                  <span style={{ textAlign: 'left' }}>
                    <strong style={{ color: 'var(--text-secondary)' }}>0:</strong> Minimal effort / Easy
                  </span>
                  <span style={{ textAlign: windowWidth <= 480 ? 'left' : 'right' }}>
                    <strong style={{ color: 'var(--text-secondary)' }}>20:</strong> Maximum effort / Exhausting
                  </span>
                </div>
              </div>

              {/* Frustration */}
              <div className="vstack gap-2" style={{ padding: 'var(--space-4)', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-primary)' }}>
                <div className="hstack" style={{ justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: '700', fontSize: '0.875rem', color: 'var(--text-primary)' }}>6. Frustration Level</span>
                  <span style={{ fontWeight: '800', color: 'var(--primary)', fontSize: '0.875rem', whiteSpace: 'nowrap', flexShrink: 0 }}><span>{nasaFrustration}</span> / 20</span>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0 0 var(--space-2) 0' }}>
                  How discouraged, irritated, stressed, or annoyed did you feel during the tasks?
                </p>
                <div className="slider-container">
                  <input
                    type="range"
                    className="slider"
                    min="0"
                    max="20"
                    step="1"
                    value={nasaFrustration}
                    onChange={e => setNasaFrustration(parseInt(e.target.value, 10))}
                  />
                </div>
                <div 
                  style={{ 
                    display: 'flex',
                    flexDirection: windowWidth <= 480 ? 'column' : 'row',
                    justifyContent: 'space-between', 
                    alignItems: windowWidth <= 480 ? 'flex-start' : 'center',
                    width: '100%', 
                    fontSize: '0.75rem', 
                    color: 'var(--text-muted)',
                    gap: windowWidth <= 480 ? '4px' : '8px',
                    marginTop: '4px'
                  }}
                >
                  <span style={{ textAlign: 'left' }}>
                    <strong style={{ color: 'var(--text-secondary)' }}>0:</strong> Relaxed / Content
                  </span>
                  <span style={{ textAlign: windowWidth <= 480 ? 'left' : 'right' }}>
                    <strong style={{ color: 'var(--text-secondary)' }}>20:</strong> Highly stressed / Irritated
                  </span>
                </div>
              </div>
            </div>

            <div 
              className={windowWidth <= 480 ? "vstack gap-3" : "hstack"} 
              style={{ 
                justifyContent: 'space-between', 
                width: '100%', 
                marginTop: 'var(--space-4)',
                alignItems: 'stretch',
                flexDirection: windowWidth <= 480 ? 'column-reverse' : 'row'
              }}
            >
              <button 
                className="btn btn-outline btn-lg" 
                onClick={prevStep}
                style={{ width: windowWidth <= 480 ? '100%' : 'auto' }}
              >
                Back
              </button>
              <button 
                className="btn btn-primary btn-lg" 
                onClick={nextStep}
                style={{ width: windowWidth <= 480 ? '100%' : 'auto' }}
              >
                Proceed to Comfort Scale
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Custom Visual Comfort Scale */}
        {step === 4 && (
          <div className="vstack gap-6" style={{ width: '100%' }}>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: '900', color: 'var(--text-primary)' }}>
                Visual Comfort Assessment
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Rate your agreement with each statement from 1 (Strongly Disagree) to 5 (Strongly Agree).
              </p>
            </div>

            <div className="divider" style={{ margin: '0' }} />

            <div className="vstack gap-8" style={{ width: '100%' }}>
              {/* Comfort Q1 */}
              <div className="vstack gap-3" style={{ paddingBottom: '16px', borderBottom: '1px solid var(--border-primary)' }}>
                <div className="hstack" style={{ justifyContent: 'space-between', fontSize: '0.875rem', gap: '8px' }}>
                  <span style={{ fontWeight: '700', color: 'var(--text-primary)', flex: 1 }}>My eyes felt comfortable while using the app.</span>
                  <span style={{ fontWeight: '800', color: 'var(--primary)', whiteSpace: 'nowrap', flexShrink: 0 }}><span>{comfortQ1}</span> / 5</span>
                </div>
                <div className="slider-container">
                  <input
                    type="range"
                    className="slider"
                    min="1"
                    max="5"
                    step="1"
                    value={comfortQ1}
                    onChange={e => setComfortQ1(parseInt(e.target.value, 10))}
                  />
                </div>
                <div className="hstack" style={{ justifyContent: 'space-between', width: '100%', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  <span>Strongly Disagree</span>
                  <span>Strongly Agree</span>
                </div>
              </div>

              {/* Comfort Q2 */}
              <div className="vstack gap-3" style={{ paddingBottom: '16px', borderBottom: '1px solid var(--border-primary)' }}>
                <div className="hstack" style={{ justifyContent: 'space-between', fontSize: '0.875rem', gap: '8px' }}>
                  <span style={{ fontWeight: '700', color: 'var(--text-primary)', flex: 1 }}>I experienced eye strain or tired eyes.</span>
                  <span style={{ fontWeight: '800', color: 'var(--primary)', whiteSpace: 'nowrap', flexShrink: 0 }}><span>{comfortQ2}</span> / 5</span>
                </div>
                <div className="slider-container">
                  <input
                    type="range"
                    className="slider"
                    min="1"
                    max="5"
                    step="1"
                    value={comfortQ2}
                    onChange={e => setComfortQ2(parseInt(e.target.value, 10))}
                  />
                </div>
                <div className="hstack" style={{ justifyContent: 'space-between', width: '100%', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  <span>Strongly Disagree</span>
                  <span>Strongly Agree</span>
                </div>
              </div>

              {/* Comfort Q3 */}
              <div className="vstack gap-3" style={{ paddingBottom: '16px', borderBottom: '1px solid var(--border-primary)' }}>
                <div className="hstack" style={{ justifyContent: 'space-between', fontSize: '0.875rem', gap: '8px' }}>
                  <span style={{ fontWeight: '700', color: 'var(--text-primary)', flex: 1 }}>I developed a headache during the tests.</span>
                  <span style={{ fontWeight: '800', color: 'var(--primary)', whiteSpace: 'nowrap', flexShrink: 0 }}><span>{comfortQ3}</span> / 5</span>
                </div>
                <div className="slider-container">
                  <input
                    type="range"
                    className="slider"
                    min="1"
                    max="5"
                    step="1"
                    value={comfortQ3}
                    onChange={e => setComfortQ3(parseInt(e.target.value, 10))}
                  />
                </div>
                <div className="hstack" style={{ justifyContent: 'space-between', width: '100%', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  <span>Strongly Disagree</span>
                  <span>Strongly Agree</span>
                </div>
              </div>

              {/* Comfort Q4 */}
              <div className="vstack gap-3" style={{ paddingBottom: '16px', borderBottom: '1px solid var(--border-primary)' }}>
                <div className="hstack" style={{ justifyContent: 'space-between', fontSize: '0.875rem', gap: '8px' }}>
                  <span style={{ fontWeight: '700', color: 'var(--text-primary)', flex: 1 }}>The adjusted colors (Daltonized view) were more comfortable to view than the original.</span>
                  <span style={{ fontWeight: '800', color: 'var(--primary)', whiteSpace: 'nowrap', flexShrink: 0 }}><span>{comfortQ4}</span> / 5</span>
                </div>
                <div className="slider-container">
                  <input
                    type="range"
                    className="slider"
                    min="1"
                    max="5"
                    step="1"
                    value={comfortQ4}
                    onChange={e => setComfortQ4(parseInt(e.target.value, 10))}
                  />
                </div>
                <div className="hstack" style={{ justifyContent: 'space-between', width: '100%', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  <span>Strongly Disagree</span>
                  <span>Strongly Agree</span>
                </div>
              </div>

              {/* Comfort Q5 */}
              <div className="vstack gap-3">
                <div className="hstack" style={{ justifyContent: 'space-between', fontSize: '0.875rem', gap: '8px' }}>
                  <span style={{ fontWeight: '700', color: 'var(--text-primary)', flex: 1 }}>I would use these color settings for daily screen time.</span>
                  <span style={{ fontWeight: '800', color: 'var(--primary)', whiteSpace: 'nowrap', flexShrink: 0 }}><span>{comfortQ5}</span> / 5</span>
                </div>
                <div className="slider-container">
                  <input
                    type="range"
                    className="slider"
                    min="1"
                    max="5"
                    step="1"
                    value={comfortQ5}
                    onChange={e => setComfortQ5(parseInt(e.target.value, 10))}
                  />
                </div>
                <div className="hstack" style={{ justifyContent: 'space-between', width: '100%', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  <span>Strongly Disagree</span>
                  <span>Strongly Agree</span>
                </div>
              </div>
            </div>

            <div 
              className={windowWidth <= 480 ? "vstack gap-3" : "hstack"} 
              style={{ 
                justifyContent: 'space-between', 
                width: '100%', 
                marginTop: 'var(--space-4)',
                alignItems: 'stretch',
                flexDirection: windowWidth <= 480 ? 'column-reverse' : 'row'
              }}
            >
              <button 
                className="btn btn-outline btn-lg" 
                onClick={prevStep}
                style={{ width: windowWidth <= 480 ? '100%' : 'auto' }}
              >
                Back
              </button>
              <button 
                className="btn btn-primary btn-lg" 
                onClick={nextStep}
                style={{ width: windowWidth <= 480 ? '100%' : 'auto' }}
              >
                Proceed to Interview Notes
              </button>
            </div>
          </div>
        )}

        {/* Step 5: Qualitative Interview notes */}
        {step === 5 && (
          <div className="vstack gap-6" style={{ width: '100%' }}>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: '900', color: 'var(--text-primary)' }}>
                Self-Reported Interview & Feedback Logs
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Help us capture qualitative observations on transition delays, visual artifacts, or general utility.
              </p>
            </div>

            <div className="divider" style={{ margin: '0' }} />

            <div
              className="vstack gap-5"
              style={{
                maxHeight: '450px',
                overflowY: 'auto',
                paddingRight: 'var(--space-2)'
              }}
            >
              <div className="form-group">
                <label className="label" htmlFor="visualTransitions">
                  1. Did you experience any flickering, lag, or visual latency during transitions? <span style={{ color: 'var(--color-error)' }}>*</span>
                </label>
                <textarea
                  id="visualTransitions"
                  className="textarea"
                  placeholder="Describe transition smooth/abrupt triggers"
                  value={visualTransitions}
                  onChange={e => setVisualTransitions(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="label" htmlFor="naturalness">
                  2. Was the remapped color contrast correction natural, wrong, or oversaturated? <span style={{ color: 'var(--color-error)' }}>*</span>
                </label>
                <textarea
                  id="naturalness"
                  className="textarea"
                  placeholder="e.g. natural, looks weird, shifts are realistic"
                  value={naturalness}
                  onChange={e => setNaturalness(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="label" htmlFor="onboardingWizard">
                  3. Was the interactive profile calibration easy to understand? <span style={{ color: 'var(--color-error)' }}>*</span>
                </label>
                <textarea
                  id="onboardingWizard"
                  className="textarea"
                  placeholder="Feedback on the vision profile calibration, length, and how easy it was to complete"
                  value={onboardingWizard}
                  onChange={e => setOnboardingWizard(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="label" htmlFor="frustratingAspects">
                  4. What was the most frustrating part of using the ChromaShift platform? <span style={{ color: 'var(--color-error)' }}>*</span>
                </label>
                <textarea
                  id="frustratingAspects"
                  className="textarea"
                  placeholder="Aspects that caused friction or confusion"
                  value={frustratingAspects}
                  onChange={e => setFrustratingAspects(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="label" htmlFor="helpfulAspects">
                  5. What was the most helpful or surprising feature you discovered? <span style={{ color: 'var(--color-error)' }}>*</span>
                </label>
                <textarea
                  id="helpfulAspects"
                  className="textarea"
                  placeholder="e.g. clearer chart colors, natural remapping, easy comparison view"
                  value={helpfulAspects}
                  onChange={e => setHelpfulAspects(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="label" htmlFor="dailyLifeUse">
                  6. How would you integrate ChromaShift into your daily digital routine? <span style={{ color: 'var(--color-error)' }}>*</span>
                </label>
                <textarea
                  id="dailyLifeUse"
                  className="textarea"
                  placeholder="e.g. use for reading charts, editing photos, watching media, daily browsing"
                  value={dailyLifeUse}
                  onChange={e => setDailyLifeUse(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="label" htmlFor="scenariosUse">
                  7. In what scenarios or daily activities would this application be most useful to you? <span style={{ color: 'var(--color-error)' }}>*</span>
                </label>
                <textarea
                  id="scenariosUse"
                  className="textarea"
                  placeholder="e.g. interpreting maps, analyzing data graphics, online shopping"
                  value={scenariosUse}
                  onChange={e => setScenariosUse(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="label" htmlFor="openFeedback">
                  8. Open-Ended Comments / Recommendations <span style={{ color: 'var(--color-error)' }}>*</span>
                </label>
                <textarea
                  id="openFeedback"
                  className="textarea"
                  placeholder="Suggestions for features, options, or changes"
                  value={openFeedback}
                  onChange={e => setOpenFeedback(e.target.value)}
                />
              </div>
            </div>

            <div 
              className={windowWidth <= 480 ? "vstack gap-3" : "hstack"} 
              style={{ 
                justifyContent: 'space-between', 
                width: '100%', 
                marginTop: 'var(--space-4)',
                alignItems: 'stretch',
                flexDirection: windowWidth <= 480 ? 'column-reverse' : 'row'
              }}
            >
              <button 
                className="btn btn-outline btn-lg" 
                onClick={prevStep}
                style={{ width: windowWidth <= 480 ? '100%' : 'auto' }}
              >
                Back
              </button>
              <button 
                className="btn btn-primary btn-lg" 
                onClick={nextStep}
                disabled={!visualTransitions || !naturalness || !onboardingWizard || !frustratingAspects || !helpfulAspects || !dailyLifeUse || !scenariosUse || !openFeedback}
                style={{ width: windowWidth <= 480 ? '100%' : 'auto' }}
              >
                Proceed to Verification
              </button>
            </div>
          </div>
        )}

        {/* Step 6: Summary & Verification */}
        {step === 6 && (
          <div className="vstack gap-6" style={{ alignItems: 'center', textAlign: 'center', padding: 'var(--space-4) 0' }}>
            <SuccessIcon />
            <div className="vstack gap-2">
              <h2 style={{ fontSize: '1.75rem', fontWeight: '900', color: 'var(--color-success)' }}>
                Ready to Complete Study!
              </h2>
              <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto' }}>
                All demographic fields, comparative performance stopwatch logs, and workload surveys have been successfully assembled.
              </p>
            </div>

            <div className="divider" style={{ margin: 'var(--space-2) 0' }} />

            <div 
              className="card-solid vstack gap-3"
              style={{
                width: '100%',
                maxWidth: '450px',
                textAlign: 'left',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-primary)',
                padding: 'var(--space-5)',
                fontSize: '0.875rem',
                color: 'var(--text-primary)'
              }}
            >
              <div><strong>Age</strong>: <span>{age}</span></div>
              <div><strong>CVD Type</strong>: <span>{cvdType}</span></div>
              <div><strong>Formally Diagnosed</strong>: <span>{diagnosed}</span></div>
              <div><strong>Average SUS Confidence</strong>: <span>Rating registered</span></div>
              <div><strong>NASA Workload Score</strong>: <span>Rating registered</span></div>
            </div>

            <div 
              className={windowWidth <= 480 ? "vstack gap-3" : "hstack gap-4"} 
              style={{ 
                marginTop: 'var(--space-4)',
                width: windowWidth <= 480 ? '100%' : 'auto',
                alignItems: 'stretch',
                flexDirection: windowWidth <= 480 ? 'column-reverse' : 'row'
              }}
            >
              <button 
                className="btn btn-outline btn-lg" 
                onClick={prevStep}
                style={{ width: windowWidth <= 480 ? '100%' : 'auto' }}
              >
                Verify Answers
              </button>
              <button
                className="btn btn-primary btn-lg"
                onClick={handleSubmit}
                disabled={isSubmitting}
                style={{
                  background: 'var(--primary-gradient)',
                  boxShadow: 'var(--shadow-lg)',
                  width: windowWidth <= 480 ? '100%' : 'auto',
                  whiteSpace: 'normal',
                  height: 'auto',
                  textAlign: 'center'
                }}
              >
                {isSubmitting ? 'Submitting...' : 'Submit Survey Results to Admin DB'}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
    </>
  );
};
