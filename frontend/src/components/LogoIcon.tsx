import React from 'react';

export const LogoIcon: React.FC<{ size?: number }> = ({ size = 24 }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 192 192" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    style={{ flexShrink: 0 }}
  >
    <g transform="translate(96, 96)">
      {/* Outer guide ring */}
      <circle 
        r="70" 
        fill="none" 
        stroke="var(--primary)" 
        strokeWidth="1.5" 
        opacity="0.25" 
      />

      {/* Left semi-circle: Teal */}
      <circle 
        cx="0" 
        cy="0" 
        r="55" 
        fill="var(--color-success, #0d9488)" 
      />

      {/* Right semi-circle: Orange */}
      <path 
        d="M 0 -55 L 0 55 A 55 55 0 0 1 0 -55" 
        fill="var(--color-warning, #ea580c)" 
      />

      {/* Inner ring */}
      <circle 
        cx="0" 
        cy="0" 
        r="48" 
        fill="none" 
        stroke="var(--color-success, #0d9488)" 
        strokeWidth="1.5" 
        opacity="0.3" 
      />

      {/* Dividing line */}
      <line 
        x1="0" 
        y1="-55" 
        x2="0" 
        y2="55" 
        stroke="var(--text-primary, currentColor)" 
        strokeWidth="2" 
        opacity="0.35" 
      />

      {/* Center point */}
      <circle 
        cx="0" 
        cy="0" 
        r="4.5" 
        fill="var(--text-primary, currentColor)" 
        opacity="0.5" 
      />

      {/* Light catches */}
      <ellipse 
        cx="-12" 
        cy="-18" 
        rx="14" 
        ry="10" 
        fill="white" 
        opacity="0.12" 
      />
      <ellipse 
        cx="12" 
        cy="-18" 
        rx="14" 
        ry="10" 
        fill="white" 
        opacity="0.08" 
      />
    </g>
  </svg>
);
