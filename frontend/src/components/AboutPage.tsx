import React from 'react';
import { FiCode, FiHeart, FiBookOpen, FiCpu, FiGithub } from 'react-icons/fi';

export const AboutPage: React.FC = () => {
  return (
    <div className="vstack gap-4" style={{ maxWidth: '800px', margin: '0 auto', width: '100%' }}>
      
      {/* Header section */}
      <div className="card-glass" style={{ padding: '32px', textAlign: 'center', borderTop: '4px solid var(--primary)' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: '900', marginBottom: '16px', color: 'var(--text-primary)' }}>
          About ChromaShift
        </h1>
        <p style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto', lineHeight: '1.6' }}>
          An academic research prototype developed as a Final Year Project to bridge the digital chromatic divide for over 300 million individuals with Color Vision Deficiency (CVD).
        </p>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
        
        {/* Project Overview */}
        <div className="card-solid vstack gap-3" style={{ padding: '24px' }}>
          <div className="hstack gap-2" style={{ color: 'var(--primary)' }}>
            <FiBookOpen size={24} />
            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: 0, color: 'var(--text-primary)' }}>Project Overview</h2>
          </div>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
            ChromaShift is a smart recoloring engine for images, PDFs, and video streams. It uses advanced Daltonization to ensure visual media is clear for users with color vision deficiencies.
          </p>
        </div>

        {/* Technical Stack */}
        <div className="card-solid vstack gap-3" style={{ padding: '24px' }}>
          <div className="hstack gap-2" style={{ color: 'var(--primary)' }}>
            <FiCpu size={24} />
            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: 0, color: 'var(--text-primary)' }}>Technology Stack</h2>
          </div>
          <ul style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.5', paddingLeft: '20px', margin: 0 }}>
            <li><strong>Frontend:</strong> React, TypeScript, Vite, TensorFlow.js</li>
            <li><strong>Backend:</strong> FastAPI, Python</li>
            <li><strong>Document Processing:</strong> PyMuPDF</li>
            <li><strong>Machine Learning:</strong> YOLO Models</li>
          </ul>
        </div>
      </div>

      {/* Motivation */}
      <div className="card-solid vstack gap-3" style={{ padding: '24px' }}>
        <div className="hstack gap-2" style={{ color: 'var(--primary)' }}>
          <FiHeart size={24} />
          <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: 0, color: 'var(--text-primary)' }}>Inspiration & Motivation</h2>
        </div>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
          Generic filters treat everyone the same, but human vision isn't one-size-fits-all. Built on WCAG principles, ChromaShift provides a personalized, content-aware rendering engine to make digital media accessible without losing its original meaning.
        </p>
      </div>

      {/* Developer Section */}
      <div className="card-solid vstack gap-3" style={{ padding: '24px', alignItems: 'center', textAlign: 'center' }}>
        <div className="hstack gap-2" style={{ color: 'var(--primary)', justifyContent: 'center' }}>
          <FiCode size={24} />
          <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: 0, color: 'var(--text-primary)' }}>About the Developer</h2>
        </div>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.5', maxWidth: '500px' }}>
          This system was architected and developed by a final year software engineering student as a capstone project exploring the intersection of web technologies, machine learning, and accessibility.
        </p>
        <div style={{ marginTop: '8px' }}>
          <a href="https://github.com/peiyan0/ChromaShift" target="_blank" className="btn btn-sm btn-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <FiGithub size={16} />
            View Source Code
          </a>
        </div>
      </div>

    </div>
  );
};
