import React, { useState } from 'react';

interface BeforeAfterSliderProps {
  beforeSrc: string;
  afterSrc: string;
  alt: string;
}

export const BeforeAfterSlider: React.FC<BeforeAfterSliderProps> = ({ beforeSrc, afterSrc, alt }) => {
  const [sliderPosition, setSliderPosition] = useState(50);

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '16/9',
        padding: 0,
        overflow: 'hidden',
        backgroundColor: '#0f0a2e',
      }}
    >
      <img 
        src={beforeSrc} 
        alt={`Original ${alt}`} 
        style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none', userSelect: 'none' }} 
      />

      <img
        src={afterSrc}
        alt={`Calibrated ${alt}`}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          pointerEvents: 'none',
          userSelect: 'none',
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

      <div className="badge badge-success" style={{ position: 'absolute', left: '12px', top: '12px', zIndex: 4, textTransform: 'uppercase', backgroundColor: 'rgba(0, 0, 0, 0.65)', border: 'none', color: 'white', padding: '4px 8px', fontSize: '0.7rem', letterSpacing: '0.05em' }}>
        Original
      </div>
      <div className="badge badge-primary" style={{ position: 'absolute', right: '12px', top: '12px', zIndex: 4, textTransform: 'uppercase', backgroundColor: 'var(--primary)', border: 'none', color: 'white', padding: '4px 8px', fontSize: '0.7rem', letterSpacing: '0.05em' }}>
        Calibrated
      </div>

      <input
        type="range"
        min="0"
        max="100"
        value={sliderPosition}
        onChange={e => setSliderPosition(parseInt(e.target.value))}
        aria-label={`Before after comparison slider for ${alt}`}
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
  );
};
