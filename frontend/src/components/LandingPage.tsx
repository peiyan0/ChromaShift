import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiEye, FiZap, FiShield, FiArrowRight, FiVideo, FiFileText, FiSliders } from 'react-icons/fi';
import { CausticsCanvas } from './backgrounds/CausticsCanvas';
import { BeforeAfterSlider } from './BeforeAfterSlider';

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

  const [isCalibrated, setIsCalibrated] = useState(false);
  const [tigerViewMode, setTigerViewMode] = useState<'normal' | 'simulated'>('normal');
  const [chartViewMode, setChartViewMode] = useState<'normal' | 'simulated'>('normal');

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



  const technicalCredibility = [
    {
      icon: FiZap,
      title: 'Smart AI Image Detection',
      body: 'Our advanced AI engine distinguishes people from backgrounds, ensuring skin tones stay natural while correcting everything else.',
    },
    {
      icon: FiVideo,
      title: 'Smooth Video Processing',
      body: 'Enjoy seamless, color-corrected videos without the distracting flashing and flickering caused by basic tools.',
    },
    {
      icon: FiFileText,
      title: 'Preserves Selectable Text',
      body: 'Color-corrects documents without turning them into flat images, so your screen readers and links still work perfectly.',
    },
    {
      icon: FiEye,
      title: 'Interactive Personal Calibration',
      body: 'A quick, intuitive wizard learns exactly how your eyes work to tune the screen to your specific needs, not generic presets.',
    },
    {
      icon: FiShield,
      title: 'Automatic Chart Textures',
      body: 'Automatically adds subtle patterns to data charts, ensuring you don\'t have to rely purely on color to read them.',
    },
    {
      icon: FiSliders,
      title: 'Real-Time & Private',
      body: 'All adjustments happen instantly on your device. Your data stays private and never leaves your computer.',
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
              <span>Start Now</span>
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

      {/* ── Basic Filters vs. Smart Rendering ── */}
      <section style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-primary)',
        borderRadius: 'var(--radius-xl)',
        padding: '64px clamp(12px, 4vw, 24px)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* SVG filter matrix definition for simulation */}
        <svg width="0" height="0" style={{ position: 'absolute', pointerEvents: 'none' }}>
          <defs>
            <filter id="sim-deuteranopia" colorInterpolationFilters="linearRGB">
              <feColorMatrix type="matrix" values="0.41563 0.58437 0 0 0  0.41563 0.58437 0 0 0  -0.04239 0.04239 1 0 0  0 0 0 1 0" />
            </filter>
          </defs>
        </svg>

        <div className="container vstack gap-12" style={{ maxWidth: '1000px' }}>
          <div style={{ textAlign: 'center' }}>
            <span className="badge badge-primary" style={{ marginBottom: '16px', padding: '6px 12px' }}>Smart Rendering Engine</span>
            <h2 style={{ marginBottom: '12px' }}>Basic Filters vs. ChromaShift</h2>
            <p style={{ color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto' }}>
              Standard tools use rigid color overlays that ruin photos and break documents. Our content-aware engine treats every pixel intelligently.
            </p>
          </div>

          <div className="grid gap-8" style={{ gridTemplateColumns: '1fr' }}>
            {/* Protects Natural Tones */}
            <div className="card-solid animate-slide-up" style={{ display: 'flex', flexDirection: 'column', gap: '24px', padding: 'clamp(16px, 5vw, 32px)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="hstack gap-3" style={{ alignItems: 'center' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'rgba(79, 70, 229, 0.1)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <FiEye size={20} />
                  </div>
                  <h3 style={{ margin: 0, fontSize: 'clamp(1.1rem, 3vw, 1.25rem)' }}>Protects Natural Skin Tones</h3>
                </div>
                <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6', margin: 0, fontSize: 'clamp(0.85rem, 2vw, 1rem)' }}>While standard filters turn faces grey or green, our Smart AI Image Detection identifies people and animals. It aggressively corrects the background while leaving skin tones perfectly natural.</p>
              </div>

              {/* Toggle Buttons */}
              <div className="hstack gap-2" style={{ justifyContent: 'center', flexWrap: 'nowrap' }}>
                <button 
                  onClick={() => setTigerViewMode('normal')} 
                  className={`btn btn-sm ${tigerViewMode === 'normal' ? 'btn-primary' : 'btn-outline'}`}
                  style={{ padding: '6px 10px', fontSize: 'clamp(0.7rem, 2.5vw, 0.85rem)', whiteSpace: 'nowrap' }}
                >
                  Normal Vision
                </button>
                <button 
                  onClick={() => setTigerViewMode('simulated')} 
                  className={`btn btn-sm ${tigerViewMode === 'simulated' ? 'btn-primary' : 'btn-outline'}`}
                  style={{ padding: '6px 10px', fontSize: 'clamp(0.7rem, 2.5vw, 0.85rem)', whiteSpace: 'nowrap' }}
                >
                  Colorblind Simulation
                </button>
              </div>

              <div style={{ 
                borderRadius: 'var(--radius-md)', 
                overflow: 'hidden', 
                border: '1px solid var(--border-secondary)',
                filter: tigerViewMode === 'simulated' ? 'url(#sim-deuteranopia)' : 'none',
                transition: 'filter 0.3s ease'
              }}>
                <BeforeAfterSlider beforeSrc="/demo/tiger_original.jpg" afterSrc="/demo/tiger_processed.jpg" alt="tiger skin tones" />
              </div>
            </div>

            {/* Smart Charts & Graphs */}
            <div className="card-solid animate-slide-up" style={{ display: 'flex', flexDirection: 'column', gap: '24px', padding: 'clamp(16px, 5vw, 32px)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="hstack gap-3" style={{ alignItems: 'center' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'rgba(79, 70, 229, 0.1)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <FiSliders size={20} />
                  </div>
                  <h3 style={{ margin: 0, fontSize: 'clamp(1.1rem, 3vw, 1.25rem)' }}>Automatic Chart Textures</h3>
                </div>
                <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6', margin: 0, fontSize: 'clamp(0.85rem, 2vw, 1rem)' }}>Color isn't enough. ChromaShift detects charts and injects physical textures (like stripes and dots) into the data, guaranteeing WCAG 1.4.1 compliance.</p>
              </div>

              {/* Toggle Buttons */}
              <div className="hstack gap-2" style={{ justifyContent: 'center', flexWrap: 'nowrap' }}>
                <button 
                  onClick={() => setChartViewMode('normal')} 
                  className={`btn btn-sm ${chartViewMode === 'normal' ? 'btn-primary' : 'btn-outline'}`}
                  style={{ padding: '6px 10px', fontSize: 'clamp(0.7rem, 2.5vw, 0.85rem)', whiteSpace: 'nowrap' }}
                >
                  Normal Vision
                </button>
                <button 
                  onClick={() => setChartViewMode('simulated')} 
                  className={`btn btn-sm ${chartViewMode === 'simulated' ? 'btn-primary' : 'btn-outline'}`}
                  style={{ padding: '6px 10px', fontSize: 'clamp(0.7rem, 2.5vw, 0.85rem)', whiteSpace: 'nowrap' }}
                >
                  Colorblind Simulation
                </button>
              </div>

              <div style={{ 
                borderRadius: 'var(--radius-md)', 
                overflow: 'hidden', 
                border: '1px solid var(--border-secondary)',
                filter: chartViewMode === 'simulated' ? 'url(#sim-deuteranopia)' : 'none',
                transition: 'filter 0.3s ease'
              }}>
                <BeforeAfterSlider beforeSrc="/stacked_bar_chart.png" afterSrc="/demo/chart_processed.png" alt="chart textures" />
              </div>
            </div>

            {/* Non-Destructive PDF Vectors */}
            <div className="card-solid animate-slide-up" style={{ display: 'flex', flexDirection: 'column', gap: '24px', padding: 'clamp(16px, 5vw, 32px)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="hstack gap-3" style={{ alignItems: 'center' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'rgba(79, 70, 229, 0.1)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <FiFileText size={20} />
                  </div>
                  <h3 style={{ margin: 0, fontSize: 'clamp(1.1rem, 3vw, 1.25rem)' }}>Non-Destructive PDFs</h3>
                </div>
                <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6', margin: 0, fontSize: 'clamp(0.85rem, 2vw, 1rem)' }}>Unlike tools that turn PDFs into giant, unreadable images, ChromaShift redraws the vector paths. Text remains selectable, screen readers work, and hyperlinks stay active.</p>
              </div>
              <div style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border-secondary)' }}>
                <img src="/demo/Non-Destructive PDF Vectors.png" alt="PDF comparison" style={{ width: '100%', height: 'auto', display: 'block' }} />
              </div>
            </div>

            {/* Flicker-Free Temporal Video Remapping */}
            <div className="card-solid animate-slide-up" style={{ display: 'flex', flexDirection: 'column', gap: '24px', padding: 'clamp(16px, 5vw, 32px)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="hstack gap-3" style={{ alignItems: 'center' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'rgba(79, 70, 229, 0.1)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <FiVideo size={20} />
                  </div>
                  <h3 style={{ margin: 0, fontSize: 'clamp(1.1rem, 3vw, 1.25rem)' }}>Smooth Video Processing</h3>
                </div>
                <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6', margin: 0, fontSize: 'clamp(0.85rem, 2vw, 1rem)' }}>Enjoy perfectly smooth, color-corrected videos without the flashing, jittering, or fatigue caused by standard accessibility tools.</p>
              </div>
              <div style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border-secondary)' }}>
                <img src="/demo/Flicker-Free Video.gif" alt="Smooth Video Processing" style={{ width: '100%', height: 'auto', display: 'block' }} />
              </div>
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
