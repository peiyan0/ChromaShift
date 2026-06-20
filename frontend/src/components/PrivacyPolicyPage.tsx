import React from 'react';
import { FiShield, FiLock, FiTrash2, FiInfo } from 'react-icons/fi';

export const PrivacyPolicyPage: React.FC = () => {
  return (
    <div className="vstack gap-4" style={{ maxWidth: '800px', margin: '0 auto', width: '100%' }}>
      
      {/* Header section */}
      <div className="card-glass" style={{ padding: '32px', borderTop: '4px solid var(--primary)' }}>
        <div className="hstack gap-3" style={{ marginBottom: '16px', color: 'var(--primary)' }}>
          <FiShield size={32} />
          <h1 style={{ fontSize: '2.5rem', fontWeight: '900', margin: 0, color: 'var(--text-primary)' }}>
            Privacy Policy
          </h1>
        </div>
        <p style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
          Transparency and data minimization are core principles of the ChromaShift platform. 
          As an academic prototype, your privacy is strictly maintained.
        </p>
      </div>

      {/* Notice Alert */}
      <div style={{ 
        padding: '16px', 
        backgroundColor: 'rgba(79, 70, 229, 0.1)', 
        borderLeft: '4px solid var(--primary)',
        borderRadius: '0 var(--radius-md) var(--radius-md) 0',
        display: 'flex',
        gap: '12px',
        alignItems: 'flex-start'
      }}>
        <FiInfo size={20} color="var(--primary)" style={{ marginTop: '2px', flexShrink: 0 }} />
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.5' }}>
          <strong>Academic Prototype Notice:</strong> This platform is a university final year project. 
          The policies below reflect the design constraints of the prototype, not a commercially binding legal agreement.
        </p>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
        
        {/* Data Collection */}
        <div className="card-solid vstack gap-3" style={{ padding: '24px' }}>
          <div className="hstack gap-2" style={{ color: 'var(--text-primary)' }}>
            <FiLock size={20} />
            <h2 style={{ fontSize: '1.1rem', fontWeight: 'bold', margin: 0 }}>Data Processing</h2>
          </div>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
            When you upload images, PDFs, or videos, these files are temporarily transmitted to secure S3 storage solely for the purpose of color processing. Files processed via "GPU Remap (Local)" never leave your device.
          </p>
        </div>

        {/* Data Retention */}
        <div className="card-solid vstack gap-3" style={{ padding: '24px' }}>
          <div className="hstack gap-2" style={{ color: 'var(--text-primary)' }}>
            <FiTrash2 size={20} />
            <h2 style={{ fontSize: '1.1rem', fontWeight: 'bold', margin: 0 }}>Data Retention</h2>
          </div>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
            All files uploaded by Guest accounts are automatically pruned from the server within 24 hours. 
            User profiles only store vision test calibration data (CVD type and severity metrics). We do not collect personally identifiable tracking data.
          </p>
        </div>

      </div>

      <div className="card-solid vstack gap-3" style={{ padding: '24px' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 'bold', margin: 0, color: 'var(--text-primary)' }}>Usability Survey Data</h2>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
          Any data submitted through the Usability Survey or Visual Metrics tests is anonymized and used exclusively for academic research analysis. 
          Participation is entirely voluntary, and results are aggregated without connecting them to personal identities.
        </p>
      </div>

      <div style={{ textAlign: 'center', marginTop: '16px' }}>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Last Updated: June 2026
        </p>
      </div>

    </div>
  );
};
