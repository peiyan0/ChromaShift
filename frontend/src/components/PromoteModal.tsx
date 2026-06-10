import React, { useState } from 'react';
import { FiTrendingUp, FiLock, FiMail, FiX } from 'react-icons/fi';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

interface PromoteModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PromoteModal: React.FC<PromoteModalProps> = ({ isOpen, onClose }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const { promote } = useAuth();

  if (!isOpen) return null;

  const handlePromote = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);
    try {
      // Call backend promote endpoint
      await api.post('/auth/promote', {
        email,
        password,
      });

      // Update auth context state to permanent
      promote();

      setMessage({
        type: 'success',
        text: 'Account secured! Your guest session has been successfully migrated to a permanent account.',
      });
      
      setTimeout(() => {
        onClose();
        setMessage(null);
      }, 3000);
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.response?.data?.detail || 'An error occurred during account migration.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'var(--overlay-bg)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 'var(--z-modal)',
      padding: '16px',
      animation: 'fade-in 0.2s ease-out'
    }}>
      <div 
        className="card-solid animate-scale-in"
        style={{
          width: '100%',
          maxWidth: '460px',
          padding: 0,
          overflow: 'hidden',
          backgroundColor: 'var(--bg-primary)',
          boxShadow: 'var(--shadow-xl)',
          position: 'relative',
        }}
      >
        {/* Modal Header banner */}
        <div style={{
          background: 'var(--primary-gradient)',
          padding: '24px',
          color: 'white',
          position: 'relative'
        }}>
          <button 
            onClick={onClose}
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              color: 'white',
              opacity: 0.8,
              background: 'none',
              border: 'none',
              padding: '4px'
            }}
            aria-label="Close dialog"
          >
            <FiX size={20} />
          </button>
          
          <div className="vstack gap-2" style={{ alignItems: 'flex-start' }}>
            <div className="hstack gap-2" style={{
              backgroundColor: 'rgba(255, 255, 255, 0.15)',
              padding: '4px 12px',
              borderRadius: 'var(--radius-full)',
            }}>
              <FiTrendingUp size={12} style={{ color: '#fbbf24' }} />
              <span style={{ fontSize: '0.65rem', fontWeight: 'var(--fw-bold)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                Keep Your Progress
              </span>
            </div>
            <h3 style={{ margin: '8px 0 0 0', color: 'white', fontFamily: 'var(--font-heading)', fontWeight: 'var(--fw-bold)' }}>
              Promote Guest Session
            </h3>
            <p style={{ margin: 0, color: 'rgba(255, 255, 255, 0.85)', fontSize: '0.85rem', lineHeight: '1.4' }}>
              Secure your customized vision calibration profiles, processed video logs, and accessibility audits.
            </p>
          </div>
        </div>

        {/* Modal Content */}
        <form onSubmit={handlePromote} style={{ padding: '24px' }}>
          {message && (
            <div className={`badge badge-${message.type}`} style={{ 
              width: '100%', 
              padding: '12px', 
              borderRadius: 'var(--radius-sm)',
              marginBottom: '16px',
              textTransform: 'none',
              fontWeight: 'var(--fw-medium)',
              lineHeight: '1.4',
              display: 'block'
            }}>
              {message.text}
            </div>
          )}

          <div className="vstack gap-4">
            <div className="form-group">
              <label className="label" htmlFor="email-input">Email Address</label>
              <div className="hstack gap-2" style={{
                border: '1px solid var(--border-primary)',
                borderRadius: 'var(--radius-sm)',
                padding: '0 12px',
                backgroundColor: 'var(--bg-secondary)',
                width: '100%'
              }}>
                <FiMail size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                <input
                  id="email-input"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="input"
                  style={{ border: 'none', backgroundColor: 'transparent', padding: '10px 0' }}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="label" htmlFor="password-input">Password</label>
              <div className="hstack gap-2" style={{
                border: '1px solid var(--border-primary)',
                borderRadius: 'var(--radius-sm)',
                padding: '0 12px',
                backgroundColor: 'var(--bg-secondary)',
                width: '100%'
              }}>
                <FiLock size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                <input
                  id="password-input"
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  className="input"
                  style={{ border: 'none', backgroundColor: 'transparent', padding: '10px 0' }}
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '24px', padding: '12px' }}
          >
            {isLoading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <div style={{
          backgroundColor: 'var(--bg-secondary)',
          padding: '16px 24px',
          borderTop: '1px solid var(--border-primary)',
          fontSize: '0.75rem',
          color: 'var(--text-muted)',
          textAlign: 'center'
        }}>
          By promoting, all current guest files and profiles are immediately bound to this email.
        </div>
      </div>
    </div>
  );
};
