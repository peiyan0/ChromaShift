import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiEye, FiZap, FiShield, FiArrowRight, FiVideo, FiFileText, FiSliders } from 'react-icons/fi';
import { CausticsCanvas } from './backgrounds/CausticsCanvas';

// ─── Animated number counter ──────────────────────────────
const CountUp = ({ end, suffix = '' }: { end: number; suffix?: string }) => {
  const [val, setVal] = useState(0);
  const [isIntersecting, setIsIntersecting] = useState(false);
  const ref = React.useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsIntersecting(true);
        observer.disconnect();
      }
    }, { threshold: 0.2 });

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isIntersecting) return;
    const duration = 1400;
    const start = performance.now();
    
    const step = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3); // cubic ease-out
      setVal(Math.round(ease * end));
      if (t < 1) requestAnimationFrame(step);
    };
    
    requestAnimationFrame(step);
  }, [isIntersecting, end]);

  return <span ref={ref}>{val.toLocaleString()}{suffix}</span>;
};

// ─── Feature card ─────────────────────────────────────────
interface FeatureCardProps {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  body: string;
}
const FeatureCard = ({ icon: Icon, title, body }: FeatureCardProps) => (
  <div className="card card-interactive animate-slide-up" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
    <div style={{
      width: '40px',
      height: '40px',
      borderRadius: 'var(--radius-sm)',
      backgroundColor: 'var(--primary-light)',
      color: 'var(--primary)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: '16px'
    }}>
      <Icon size={20} />
    </div>
    <h4 style={{ marginBottom: '8px', fontFamily: 'var(--font-heading)', fontWeight: 'var(--fw-bold)', color: 'var(--text-primary)' }}>
      {title}
    </h4>
    <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
      {body}
    </p>
  </div>
);

// ─── Landing page ─────────────────────────────────────────
export const LandingPage: React.FC = () => {
  const navigate = useNavigate();

  const [cvdType, setCvdType] = useState('protanopia');
  const [severity, setSeverity] = useState(1.0);
  const [intensity, setIntensity] = useState(1.0);
  const [contrast, setContrast] = useState(1.0);
  const [saturation, setSaturation] = useState(1.0);
  const [sliderPosition, setSliderPosition] = useState(50);
  const [activeDemoImage, setActiveDemoImage] = useState('/financial_pie_chart.png');
  const [matrixValues, setMatrixValues] = useState('1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0');
  const [isCalibrated, setIsCalibrated] = useState(false);

  useEffect(() => {
    const cached = localStorage.getItem('chromashift_cvd_profile');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed.cvd_type) {
          setIsCalibrated(true);
        }
      } catch (_) {}
    }
  }, []);

  useEffect(() => {
    const rgb2lms = [
      [0.3904725,  0.54990437, 0.00890159],
      [0.07092586, 0.96310739, 0.00135809],
      [0.02314268, 0.12801221, 0.93605194]
    ];
    const lms2rgb = [
      [ 2.85831110, -1.62870796, -0.02481870],
      [-0.21043478,  1.15841493,  0.00032046],
      [-0.04188950, -0.11815433,  1.06888657]
    ];
    
    let cvd: number[][];
    let err2mod: number[][];
    
    if (cvdType === 'protanopia') {
      cvd = [
        [0.0, 0.90822864, 0.00819200],
        [0.0, 1.0,        0.0],
        [0.0, 0.0,        1.0]
      ];
      err2mod = [
        [0.0, 0.0, 0.0],
        [0.7, 1.0, 0.0],
        [0.7, 0.0, 1.0]
      ];
    } else if (cvdType === 'tritanopia') {
      cvd = [
        [1.0,         0.0,        0.0],
        [0.0,         1.0,        0.0],
        [-0.15773032, 1.19465634, 0.0]
      ];
      err2mod = [
        [1.0, 0.0, 0.7],
        [0.0, 1.0, 0.7],
        [0.0, 0.0, 0.0]
      ];
    } else {
      // Deuteranopia
      cvd = [
        [1.0,        0.0, 0.0],
        [1.10104433, 0.0, -0.00901975],
        [0.0,        0.0, 1.0]
      ];
      err2mod = [
        [1.0, 0.7, 0.0],
        [0.0, 0.0, 0.0],
        [0.0, 0.7, 1.0]
      ];
    }

    const matMul3x3 = (A: number[][], B: number[][]) => {
      const C = Array(3).fill(0).map(() => Array(3).fill(0));
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          let sum = 0;
          for (let k = 0; k < 3; k++) {
            sum += A[i][k] * B[k][j];
          }
          C[i][j] = sum;
        }
      }
      return C;
    };
    
    const matSub3x3 = (A: number[][], B: number[][]) => {
      const C = Array(3).fill(0).map(() => Array(3).fill(0));
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          C[i][j] = A[i][j] - B[i][j];
        }
      }
      return C;
    };
    
    const identity3x3 = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1]
    ];

    const S_mat = matMul3x3(matMul3x3(lms2rgb, cvd), rgb2lms);
    const I_minus_S = matSub3x3(identity3x3, S_mat);
    const M_err_remap = matMul3x3(err2mod, I_minus_S);
    
    const M_daltonize = Array(3).fill(0).map(() => Array(3).fill(0));
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        M_daltonize[i][j] = identity3x3[i][j] + severity * M_err_remap[i][j];
      }
    }

    setMatrixValues(
      `${M_daltonize[0][0]} ${M_daltonize[0][1]} ${M_daltonize[0][2]} 0 0  ${M_daltonize[1][0]} ${M_daltonize[1][1]} ${M_daltonize[1][2]} 0 0  ${M_daltonize[2][0]} ${M_daltonize[2][1]} ${M_daltonize[2][2]} 0 0  0 0 0 1 0`
    );
  }, [cvdType, severity]);

  // Keyboard control for split slider
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft')  setSliderPosition(p => Math.max(0, p - 2));
      if (e.key === 'ArrowRight') setSliderPosition(p => Math.min(100, p + 2));
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const demoImages = [
    { key: '/financial_pie_chart.png',             label: 'Pie Chart' },
    { key: '/financial_multi_line.webp', label: 'Line Graph' },
    { key: '/temperature_heatmap.png',              label: 'Heatmap' },
  ];

  const technicalCredibility = [
    {
      icon: FiZap,
      title: 'Real-Time Color Correction',
      body: 'Runs instantly on your computer using local browser processing for fast, private remapping.',
    },
    {
      icon: FiVideo,
      title: 'Flicker-Free Viewing',
      body: 'Enjoy smooth, color-corrected videos without the flashing and jittering caused by basic tools.',
    },
    {
      icon: FiFileText,
      title: 'Preserves Selectable Text',
      body: 'Color-corrects documents without rasterizing them, so your screen readers and links still work.',
    },
    {
      icon: FiEye,
      title: 'Protects Skin Tones',
      body: 'While other filters turn faces green or grey, our smart engine only corrects what needs correcting.',
    },
    {
      icon: FiShield,
      title: 'Smart Charts & Graphs',
      body: 'Adds physical patterns to data charts so you don\'t rely only on color to read them.',
    },
    {
      icon: FiSliders,
      title: 'Personalized Vision Tuning',
      body: 'A quick interactive wizard tunes the screen to your specific eyes, rather than generic presets.',
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '80px', width: '100%' }}>
      
      {/* ── Hero Section ── */}
      <section style={{
        position: 'relative',
        borderRadius: 'var(--radius-xl)',
        overflow: 'hidden',
        padding: '96px 24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        minHeight: '85vh',
        justifyContent: 'center',
        border: '1px solid var(--border-primary)',
        boxShadow: 'var(--shadow-sm)'
      }}>
        {/* Caustics background */}
        <CausticsCanvas intensity={0.45} interactive={true} />

        <div style={{ position: 'relative', zIndex: 1, maxWidth: '800px' }}>
          <div style={{ display: 'inline-flex', marginBottom: '24px' }}>
            <div className="hstack gap-2 animate-fade-in" style={{
              backgroundColor: 'var(--primary-light)',
              border: '1px solid rgba(79, 70, 229, 0.2)',
              borderRadius: 'var(--radius-full)',
              padding: '6px 16px',
            }}>
              <span className="animate-pulse-border" style={{
                display: 'inline-block',
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: 'var(--primary)'
              }} />
              <span style={{ fontSize: '0.7rem', fontWeight: 'var(--fw-bold)', color: 'var(--primary)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                Bridging the Chromatic Digital Divide
              </span>
            </div>
          </div>

          <h1 className="animate-slide-up" style={{ marginBottom: '24px' }}>
            See What Everyone <br />
            Else <span className="text-gradient">Sees.</span>
          </h1>

          <p className="animate-slide-up" style={{
            fontSize: 'clamp(1rem, 1.25vw, 1.25rem)',
            color: 'var(--text-secondary)',
            marginBottom: '40px',
            lineHeight: '1.7',
            maxWidth: '640px',
            margin: '0 auto 40px auto'
          }}>
            Most tools just slap a color filter over your screen. ChromaShift understands what you're looking at—protecting skin tones, preserving text, and tuning exactly to your eyes.
          </p>

          <div className="hstack gap-4 animate-slide-up" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => navigate('/upload')}
              className="btn btn-lg btn-primary"
              style={{
                background: 'var(--primary-gradient)',
                border: 'none',
                boxShadow: '0 8px 20px rgba(79, 70, 229, 0.3)',
                transform: 'translateY(0)',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 12px 24px rgba(79, 70, 229, 0.45)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 8px 20px rgba(79, 70, 229, 0.3)';
              }}
            >
              <span>Start Free</span>
              <FiArrowRight />
            </button>
            <button
              onClick={() => navigate('/settings')}
              className="btn btn-lg btn-outline"
              style={{
                backdropFilter: 'blur(8px)',
                background: 'rgba(255, 255, 255, 0.05)',
                borderColor: 'var(--border-secondary)',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--primary)';
                e.currentTarget.style.background = 'rgba(79, 70, 229, 0.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-secondary)';
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
              }}
            >
              Test Vision
            </button>
          </div>
        </div>

        {/* Scroll indicator */}
        <div style={{
          position: 'absolute',
          bottom: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: '0.75rem',
          color: 'var(--text-muted)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '4px'
        }}>
          <span>Learn how it works</span>
          <span style={{ animation: 'slide-up 1.5s infinite ease-in-out', fontSize: '1.1rem' }}>↓</span>
        </div>
      </section>

      {/* ── Quick-Start Roadmap ── */}
      <section className="container" style={{ maxWidth: '960px', marginTop: '-40px', padding: '0 24px', zIndex: 2, position: 'relative' }}>
        <div className="card-solid animate-slide-up" style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-primary)',
          borderRadius: 'var(--radius-xl)',
          padding: '32px',
          boxShadow: 'var(--shadow-lg)'
        }}>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontWeight: 'var(--fw-bold)', marginBottom: '24px', textAlign: 'center' }}>
            Your 3-Step Setup Guide
          </h3>
          <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
            {/* Step 1 */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '20px', opacity: isCalibrated ? 0.8 : 1 }}>
              <div className="hstack gap-2">
                <span className="badge badge-primary" style={{ borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>1</span>
                <strong>Color Profile Calibration</strong>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                {isCalibrated ? 'Calibration completed successfully!' : 'Not set up yet. Take a short 2-minute visual test.'}
              </p>
              {!isCalibrated ? (
                <button onClick={() => navigate('/settings')} className="btn btn-sm btn-primary" style={{ alignSelf: 'flex-start' }}>
                  Calibrate Now
                </button>
              ) : (
                <span style={{ fontSize: '0.8rem', color: 'var(--color-success)', fontWeight: 'bold' }}>✓ Active filter remapping loaded</span>
              )}
            </div>

            {/* Step 2 */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '20px' }}>
              <div className="hstack gap-2">
                <span className="badge badge-primary" style={{ borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>2</span>
                <strong>Upload & Recolour</strong>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Upload any chart, graph, map, or video to process.
              </p>
              <button onClick={() => navigate('/upload')} className="btn btn-sm btn-outline" style={{ alignSelf: 'flex-start' }}>
                Upload Media
              </button>
            </div>

            {/* Step 3 */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '20px' }}>
              <div className="hstack gap-2">
                <span className="badge badge-primary" style={{ borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>3</span>
                <strong>View & Compare</strong>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Open files in the Media Hub workspace to compare original and corrected colors side-by-side.
              </p>
              <button onClick={() => navigate('/hub')} className="btn btn-sm btn-outline" style={{ alignSelf: 'flex-start' }}>
                Open Media Hub
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Problem Statement / Key Metrics Section ── */}
      <section className="container" style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '48px',
        maxWidth: '960px',
        padding: '24px 0'
      }}>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: 'var(--fw-bold)', marginBottom: '16px' }}>
            Uncompromising Accuracy.
          </h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto' }}>
            ChromaShift is designed from the ground up to achieve high perceptual fidelity and speed without sending your private visual data to third-party servers.
          </p>
        </div>

        <div className="grid gap-6" style={{
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          width: '100%'
        }}>
          {[
            { value: 300, suffix: 'M+', label: 'CVD individuals globally' },
            { value: 80,  suffix: '%',  label: 'SSIM perceptual accuracy' },
            { value: 3,   suffix: 's',  label: 'Client preview speed' },
          ].map(stat => (
            <div key={stat.label} className="card-solid" style={{ textAlign: 'center', padding: '32px' }}>
              <div className="text-gradient" style={{
                fontSize: '3rem',
                fontWeight: 'var(--fw-black)',
                lineHeight: '1',
                marginBottom: '8px',
                fontFamily: 'var(--font-heading)'
              }}>
                <CountUp end={stat.value} suffix={stat.suffix} />
              </div>
              <div className="text-mono" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Interactive Demo Section ── */}
      <section style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-primary)',
        borderRadius: 'var(--radius-xl)',
        padding: '64px 24px',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* SVG filter matrix definition */}
        <svg width="0" height="0" style={{ position: 'absolute', pointerEvents: 'none' }}>
          <defs>
            <filter id="demo-daltonize-filter" colorInterpolationFilters="linearRGB">
              <feColorMatrix type="matrix" values={matrixValues} />
            </filter>
          </defs>
        </svg>

        <div className="container vstack gap-6" style={{ maxWidth: '800px' }}>
          <div style={{ textAlign: 'center' }}>
            <span className="badge badge-primary" style={{ marginBottom: '16px', padding: '6px 12px' }}>Interactive Sandbox</span>
            <h2 style={{ marginBottom: '12px' }}>Experience the Shift</h2>
            <p style={{ color: 'var(--text-secondary)' }}>
              Select a data chart below, choose your vision deficiency type, and drag the slider to verify how ChromaShift restores legibility.
            </p>
          </div>

          {/* Controls Dashboard */}
          <div className="card-solid vstack gap-4" style={{ width: '100%', border: '1px solid var(--border-secondary)' }}>
            <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
              <div className="form-group">
                <label className="label" htmlFor="cvd-selector">Deficiency Type</label>
                <select
                  id="cvd-selector"
                  value={cvdType}
                  onChange={e => setCvdType(e.target.value)}
                  className="select"
                >
                  <option value="protanopia">Protanopia (Red-Blind)</option>
                  <option value="deuteranopia">Deuteranopia (Green-Blind)</option>
                  <option value="tritanopia">Tritanopia (Blue-Blind)</option>
                </select>
              </div>

              {[
                { label: 'Severity',   val: severity,   setVal: setSeverity,   min: 0.1, max: 1.5 },
                { label: 'Brightness', val: intensity,  setVal: setIntensity,  min: 0.5, max: 1.5 },
                { label: 'Contrast',   val: contrast,   setVal: setContrast,   min: 0.5, max: 1.5 },
                { label: 'Saturation', val: saturation, setVal: setSaturation, min: 0.5, max: 1.5 },
              ].map(({ label, val, setVal, min, max }) => (
                <div key={label} className="form-group">
                  <div className="hstack" style={{ justifyContent: 'space-between' }}>
                    <label className="label">{label}</label>
                    <span className="text-mono" style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 'var(--fw-bold)' }}>
                      {val.toFixed(2)}
                    </span>
                  </div>
                  <div className="slider-container">
                    <input
                      type="range"
                      min={min}
                      max={max}
                      step={0.05}
                      value={val}
                      onChange={e => setVal(parseFloat(e.target.value))}
                      className="slider"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
              <button
                onClick={() => { setCvdType('protanopia'); setSeverity(1.0); setIntensity(1.0); setContrast(1.0); setSaturation(1.0); }}
                className="btn btn-sm btn-ghost"
              >
                Reset Demo
              </button>
            </div>
          </div>

          {/* Active Image Selector */}
          <div className="hstack gap-2" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
            {demoImages.map(img => (
              <button
                key={img.key}
                onClick={() => setActiveDemoImage(img.key)}
                className={`btn btn-sm ${activeDemoImage === img.key ? 'btn-primary' : 'btn-outline'}`}
              >
                {img.label}
              </button>
            ))}
          </div>

          {/* Split Slider Preview Box */}
          <div
            className="card-solid"
            style={{
              position: 'relative',
              width: '100%',
              height: '380px',
              padding: 0,
              overflow: 'hidden',
              backgroundColor: '#0f0a2e',
              border: '1px solid var(--border-secondary)',
              boxShadow: 'var(--shadow-xl)',
            }}
          >
            {/* Original Image */}
            <img 
              src={activeDemoImage} 
              alt="Original chart prior to color calibration" 
              style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none', userSelect: 'none' }} 
            />

            {/* Corrected Overlay */}
            <img
              src={activeDemoImage}
              alt="Calibrated chart using Daltonization filter"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                pointerEvents: 'none',
                userSelect: 'none',
                filter: `url(#demo-daltonize-filter) brightness(${intensity}) contrast(${contrast}) saturate(${saturation})`,
                clipPath: `polygon(${sliderPosition}% 0, 100% 0, 100% 100%, ${sliderPosition}% 100%)`,
              }}
            />

            {/* Split Line */}
            <div style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: `${sliderPosition}%`,
              width: '2px',
              backgroundColor: 'white',
              boxShadow: '0 0 8px rgba(0,0,0,0.5)',
              transform: 'translateX(-50%)',
              pointerEvents: 'none',
              zIndex: 2
            }} />

            {/* Slider Handle */}
            <div style={{
              position: 'absolute',
              top: '50%',
              left: `${sliderPosition}%`,
              transform: 'translate(-50%, -50%)',
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              backgroundColor: 'white',
              border: '3px solid var(--primary)',
              boxShadow: 'var(--shadow-lg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
              zIndex: 3,
              fontSize: '0.6rem',
              fontWeight: 'bold',
              color: 'var(--primary)'
            }}>
              ◀ ▶
            </div>

            {/* HUD badges */}
            <div className="badge badge-success" style={{ position: 'absolute', left: '16px', top: '16px', zIndex: 4, textTransform: 'uppercase', backgroundColor: 'rgba(0, 0, 0, 0.65)', border: 'none', color: 'white', padding: '6px 12px' }}>
              Original
            </div>
            <div className="badge badge-primary" style={{ position: 'absolute', right: '16px', top: '16px', zIndex: 4, textTransform: 'uppercase', backgroundColor: 'var(--primary)', border: 'none', color: 'white', padding: '6px 12px' }}>
              Calibrated
            </div>

            {/* Native range input to handle dragging */}
            <input
              type="range"
              min="0"
              max="100"
              value={sliderPosition}
              onChange={e => setSliderPosition(parseInt(e.target.value))}
              aria-label="Before after comparison slider"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                opacity: 0,
                cursor: 'ew-resize',
                zIndex: 5
              }}
            />
          </div>

          {/* Live Video Demo */}
          <div style={{ width: '100%', marginTop: '32px' }}>
            <div className="vstack gap-2" style={{ alignItems: 'center', marginBottom: '16px' }}>
              <span className="text-mono" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Flicker-Free Temporal Video Remapping
              </span>
            </div>
            <div style={{
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
              border: '1px solid var(--border-secondary)',
              position: 'relative',
              backgroundColor: 'black'
            }}>
              <span className="badge badge-primary" style={{ position: 'absolute', top: '12px', right: '12px', zIndex: 6, fontSize: '0.65rem', padding: '6px 12px' }}>
                WebGL Engine
              </span>
              <video
                src="/infographic_motion.mp4"
                controls
                autoPlay
                loop
                muted
                playsInline
                style={{
                  width: '100%',
                  height: 'auto',
                  display: 'block',
                  filter: `url(#demo-daltonize-filter) brightness(${intensity}) contrast(${contrast}) saturate(${saturation})`
                }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── Technical Credibility Grid Section ── */}
      <section className="container vstack gap-12" style={{ padding: '48px 0' }}>
        <div style={{ textAlign: 'center' }}>
          <span className="badge badge-primary" style={{ marginBottom: '16px', padding: '6px 12px' }}>Under the Hood</span>
          <h2>Built on Real Science</h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '540px', margin: '8px auto 0 auto' }}>
            We leverage state-of-the-art vision models and mathematical remapping to ensure color is never your barrier.
          </p>
        </div>

        <div className="grid gap-6" style={{
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          width: '100%'
        }}>
          {technicalCredibility.map(item => (
            <FeatureCard key={item.title} icon={item.icon} title={item.title} body={item.body} />
          ))}
        </div>
      </section>

      {/* ── Privacy section ── */}
      <section style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-primary)',
        borderRadius: 'var(--radius-xl)',
        padding: '80px 24px'
      }}>
        <div className="container vstack gap-12">
          <div style={{ textAlign: 'center' }}>
            <span className="badge badge-success" style={{ marginBottom: '16px', padding: '6px 12px' }}>Security & Privacy</span>
            <h2>Privacy by Design</h2>
            <p style={{ color: 'var(--text-secondary)', maxWidth: '500px', margin: '8px auto 0 auto' }}>
              We protect your data. Your files are processed locally and stored anonymously.
            </p>
          </div>

          <div className="grid gap-6" style={{
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))'
          }}>
            {[
              {
                icon: FiShield,
                title: '7-Day Auto-Delete',
                body: 'All uploaded media files are automatically and permanently deleted after 7 days.'
              },
              {
                icon: FiZap,
                title: 'Local Processing',
                body: 'Color correction runs directly inside your browser so your files never leave your device.'
              },
              {
                icon: FiEye,
                title: 'Anonymous Profiles',
                body: 'We save only color calibration values, never names or personal info.'
              }
            ].map((item, index) => (
              <div key={index} className="card-solid" style={{
                backgroundColor: 'var(--bg-primary)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                padding: '24px'
              }}>
                <div style={{ color: 'var(--color-success)', marginBottom: '12px' }}>
                  <item.icon size={20} />
                </div>
                <h4 style={{ marginBottom: '8px', fontFamily: 'var(--font-heading)' }}>{item.title}</h4>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

    </div>
  );
};
