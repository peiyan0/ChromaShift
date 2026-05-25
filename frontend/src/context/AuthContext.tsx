import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import axios from 'axios';

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

const rawBaseURL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1/';
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
    } catch (e) {
      console.error("Could not fetch user profile details", e);
      setIsAdmin(false);
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('token');
      const guestFlag = localStorage.getItem('isGuest');
      if (token) {
        setIsAuthenticated(true);
        setIsGuest(guestFlag === 'true');
        await fetchUserDetails(token);
        setIsInitializing(false);
      } else {
        // Automatically login as guest in background
        try {
          const response = await axios.post(`${baseURL}auth/guest`);
          const guestToken = response.data.access_token;
          localStorage.setItem('token', guestToken);
          localStorage.setItem('isGuest', 'true');
          setIsAuthenticated(true);
          setIsGuest(true);
          await fetchUserDetails(guestToken);
        } catch (e) {
          console.error("Could not automatically authenticate guest", e);
        } finally {
          setIsInitializing(false);
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
    await fetchUserDetails(token);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('isGuest');
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
      await fetchUserDetails(activeToken);
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

