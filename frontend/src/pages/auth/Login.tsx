import React, { useState, useEffect } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { LogoIcon } from '../../components/LogoIcon';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const navigate = useNavigate();
  const { login, isAuthenticated, isGuest } = useAuth();

  useEffect(() => {
    if (isAuthenticated && !isGuest) navigate('/');
  }, [isAuthenticated, isGuest, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);
    try {
      const formData = new URLSearchParams();
      formData.append('username', username);
      formData.append('password', password);
      const response = await api.post('/auth/login', formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      login(response.data.access_token);
      setMessage({ type: 'success', text: 'Logged in successfully.' });
      setTimeout(() => {
        navigate('/');
      }, 1000);
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.response?.data?.detail || 'Invalid credentials.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setIsLoading(true);
    setMessage(null);
    try {
      const response = await api.post('/auth/guest');
      login(response.data.access_token, true);
      setMessage({ type: 'success', text: 'Logged in as guest.' });
      setTimeout(() => {
        navigate('/');
      }, 1000);
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: 'Failed to continue as guest.'
      });
    } finally {
      setIsLoading(false);
    }
  };

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
          padding: '0'
        }}
      >
        {/* Card top accent */}
        <div style={{ height: '4px', background: 'var(--primary-gradient)' }} />

        <div style={{ padding: 'var(--space-8)' }} className="vstack gap-6">
          <RouterLink
            to="/"
            className="btn btn-sm btn-ghost"
            style={{ alignSelf: 'flex-start' }}
          >
            <span style={{ fontSize: '16px' }}>←</span> Back to Home
          </RouterLink>

          {/* Logo */}
          <div className="vstack gap-2" style={{ alignItems: 'center', textAlign: 'center' }}>
            <div className="hstack gap-2" style={{ justifyContent: 'center' }}>
              <LogoIcon size={36} />
              <span
                style={{
                  fontSize: '1.25rem',
                  fontWeight: '800',
                  letterSpacing: '-0.5px',
                  background: 'var(--primary-gradient)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                ChromaShift
              </span>
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--text-primary)', marginTop: 'var(--space-2)' }}>Welcome back</h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Sign in to your accessibility workspace</p>
          </div>

          {/* Notification banner */}
          {message && (
            <div
              className={`badge badge-${message.type}`}
              style={{
                width: '100%',
                padding: 'var(--space-3)',
                borderRadius: 'var(--radius-md)',
                textTransform: 'none',
                justifyContent: 'center',
                fontWeight: '600',
                fontSize: '0.85rem'
              }}
            >
              {message.text}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} className="vstack gap-4" style={{ width: '100%' }}>
            <div className="form-group">
              <label className="label" htmlFor="username">Username</label>
              <input
                id="username"
                type="text"
                required
                className="input"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Enter your username"
              />
            </div>

            <div className="form-group">
              <label className="label" htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                required
                className="input"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={isLoading}
              style={{ width: '100%', marginTop: 'var(--space-2)' }}
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </button>

            <button
              type="button"
              onClick={handleGuestLogin}
              className="btn btn-ghost"
              disabled={isLoading}
              style={{ width: '100%', marginTop: 'var(--space-1)' }}
            >
              Continue as Guest
            </button>

            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', textAlign: 'center', marginTop: 'var(--space-2)' }}>
              Don't have an account?{' '}
              <RouterLink to="/auth/register" style={{ color: 'var(--primary)', fontWeight: '600', textDecoration: 'none' }}>
                Create one
              </RouterLink>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
