import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';

const EmailVerification = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState<string>('');

  useEffect(() => {
    const verifyToken = async () => {
      const token = searchParams.get('token');
      if (!token) {
        setStatus('error');
        setMessage('Verification token is missing.');
        return;
      }

      try {
        await api.post(`/auth/verify-email?token=${token}`);
        setStatus('success');
        setMessage('Your account has been successfully verified.');
      } catch (error: any) {
        setStatus('error');
        setMessage(error.response?.data?.detail || 'The verification token might be invalid or expired.');
      }
    };

    verifyToken();
  }, [searchParams]);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-4)',
        backgroundColor: 'var(--bg-primary)'
      }}
    >
      <div
        className="card-solid"
        style={{
          width: '100%',
          maxWidth: '400px',
          boxShadow: 'var(--shadow-xl)',
          border: '1px solid var(--border-primary)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          padding: '0',
          textAlign: 'center'
        }}
      >
        {/* Card top accent */}
        <div style={{ height: '4px', background: 'var(--primary-gradient)' }} />

        <div style={{ padding: 'var(--space-8)' }} className="vstack gap-6">
          <h2 style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--text-primary)' }}>Email Verification</h2>

          {status === 'loading' && (
            <div className="vstack gap-3" style={{ alignItems: 'center' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  border: '3px solid var(--border-primary)',
                  borderTopColor: 'var(--primary)',
                  borderRadius: 'var(--radius-full)',
                  animation: 'spin-loading 1s linear infinite'
                }}
              />
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>Verifying your email...</p>
            </div>
          )}

          {status === 'success' && (
            <div className="vstack gap-4" style={{ alignItems: 'center' }}>
              <div
                className="badge badge-success"
                style={{
                  padding: 'var(--space-3)',
                  borderRadius: 'var(--radius-md)',
                  textTransform: 'none',
                  fontWeight: '600',
                  fontSize: '0.85rem',
                  width: '100%',
                  justifyContent: 'center'
                }}
              >
                {message || 'Thank you! Your email is verified.'}
              </div>
              <button
                className="btn btn-primary"
                onClick={() => navigate('/auth/login')}
                style={{ width: '100%' }}
              >
                Go to Login
              </button>
            </div>
          )}

          {status === 'error' && (
            <div className="vstack gap-4" style={{ alignItems: 'center' }}>
              <div
                className="badge badge-error"
                style={{
                  padding: 'var(--space-3)',
                  borderRadius: 'var(--radius-md)',
                  textTransform: 'none',
                  fontWeight: '600',
                  fontSize: '0.85rem',
                  width: '100%',
                  justifyContent: 'center'
                }}
              >
                {message || 'We could not verify your email.'}
              </div>
              <button
                className="btn btn-outline"
                onClick={() => navigate('/auth/register')}
                style={{ width: '100%' }}
              >
                Back to Register
              </button>
            </div>
          )}
        </div>
      </div>
      
      {/* Inline styles for spinner if not present in components.css */}
      <style>{`
        @keyframes spin-loading {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default EmailVerification;
