import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import axios from 'axios';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';

const isSupabaseEnabled = 
  import.meta.env.VITE_SUPABASE_URL && 
  !import.meta.env.VITE_SUPABASE_URL.includes('your-project-ref') &&
  !import.meta.env.VITE_SUPABASE_URL.includes('placeholder');

interface AuthContextType {
  isAuthenticated: boolean;
  isGuest: boolean;
  isAdmin: boolean;
  isInitializing: boolean;
  login: (token: string, isGuestUser?: boolean) => void;
  logout: () => void;
  promote: (token?: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const rawBaseURL = import.meta.env.VITE_API_URL;
const baseURL = rawBaseURL.endsWith('/') ? rawBaseURL : `${rawBaseURL}/`;

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isGuest, setIsGuest] = useState<boolean>(false);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);

  const fetchUserDetails = async (token: string) => {
    try {
      const response = await axios.get(`${baseURL}auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setIsAdmin(response.data.is_superuser === true);
    } catch (e: any) {
      if (e.response?.status === 404) {
        console.info("User database record does not exist yet (expected for new Supabase sign-ins).");
      } else {
        console.error("Could not fetch user profile details", e);
      }
      setIsAdmin(false);
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      // 1. If Supabase is enabled, use Supabase session listener
      if (isSupabaseEnabled) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const token = session.access_token;
          const userIsAnonymous = session.user?.is_anonymous ?? false;
          localStorage.setItem('token', token);
          localStorage.setItem('isGuest', userIsAnonymous ? 'true' : 'false');
          setIsAuthenticated(true);
          setIsGuest(userIsAnonymous);
          fetchUserDetails(token);
        } else {
          // Auto sign-in anonymously
          try {
            const { data, error } = await supabase.auth.signInAnonymously();
            if (error) throw error;
            if (data?.session) {
              const token = data.session.access_token;
              localStorage.setItem('token', token);
              localStorage.setItem('isGuest', 'true');
              setIsAuthenticated(true);
              setIsGuest(true);
              fetchUserDetails(token);
            }
          } catch (e) {
            console.error("Supabase anonymous sign-in failed", e);
          }
        }
        setIsInitializing(false);

        // Listen for authentication state shifts
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event: string, session: Session | null) => {
          const isCurrentlyCustomLoggedIn = localStorage.getItem('token') && localStorage.getItem('isGuest') === 'false';

          if (session) {
            const token = session.access_token;
            const userIsAnonymous = session.user?.is_anonymous ?? false;
            
            // Prevent Supabase anonymous session from overwriting a custom backend logged-in session
            if (isCurrentlyCustomLoggedIn && userIsAnonymous) {
              return;
            }

            localStorage.setItem('token', token);
            localStorage.setItem('isGuest', userIsAnonymous ? 'true' : 'false');
            setIsAuthenticated(true);
            setIsGuest(userIsAnonymous);
            fetchUserDetails(token);
          } else {
            // Prevent Supabase null session from logging out a user/guest during initialization
            // unless it's a deliberate sign out event.
            if (_event === 'INITIAL_SESSION') {
              return;
            }
            if (isCurrentlyCustomLoggedIn && _event !== 'SIGNED_OUT') {
              return;
            }

            setIsAuthenticated(false);
            setIsGuest(false);
            setIsAdmin(false);
          }
        });

        return () => {
          subscription.unsubscribe();
        };
      } else {
        // 2. Local Fallback flow
        const token = localStorage.getItem('token');
        const guestFlag = localStorage.getItem('isGuest');
        if (token) {
          setIsAuthenticated(true);
          setIsGuest(guestFlag === 'true');
          fetchUserDetails(token);
          setIsInitializing(false);
        } else {
          try {
            const response = await axios.post(`${baseURL}auth/guest`);
            const guestToken = response.data.access_token;
            localStorage.setItem('token', guestToken);
            localStorage.setItem('isGuest', 'true');
            setIsAuthenticated(true);
            setIsGuest(true);
            fetchUserDetails(guestToken);
          } catch (e) {
            console.error("Could not automatically authenticate guest", e);
          } finally {
            setIsInitializing(false);
          }
        }
      }
    };
    initAuth();
  }, []);

  const login = async (token: string, isGuestUser: boolean = false) => {
    localStorage.setItem('token', token);
    localStorage.setItem('isGuest', isGuestUser ? 'true' : 'false');
    setIsAuthenticated(true);
    setIsGuest(isGuestUser);
    fetchUserDetails(token);
  };

  const logout = async () => {
    if (isSupabaseEnabled) {
      await supabase.auth.signOut();
    }
    localStorage.removeItem('token');
    localStorage.removeItem('isGuest');
    localStorage.removeItem('chromashift_cvd_profile');
    setIsAuthenticated(false);
    setIsGuest(false);
    setIsAdmin(false);
  };

  const promote = async (token?: string) => {
    if (token) {
      localStorage.setItem('token', token);
    }
    localStorage.setItem('isGuest', 'false');
    setIsGuest(false);
    setIsAuthenticated(true);
    const activeToken = token || localStorage.getItem('token');
    if (activeToken) {
      fetchUserDetails(activeToken);
    }
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, isGuest, isAdmin, isInitializing, login, logout, promote }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
