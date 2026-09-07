'use client';
import { createContext, useContext, useState, useEffect, useRef } from 'react';
import api from '@/lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [profile, setProfile] = useState(null);
  const [sub, setSub]         = useState(null);
  const [loading, setLoading] = useState(true);
  const sessionVersion = useRef(0);

  useEffect(() => {
    let active = true;
    const version = sessionVersion.current;
    const token = localStorage.getItem('kl_token');
    if (token) {
      api.get('/auth/me')
        .then(res => {
          if (!active || version !== sessionVersion.current) return;
          setUser(res.data.data.user);
          setProfile(res.data.data.profile);
          setSub(res.data.data.subscription);
        })
        .catch(err => {
          if (!active || version !== sessionVersion.current) return;
          if (err.response?.status === 401) {
            localStorage.removeItem('kl_token');
            localStorage.removeItem('kl_user');
          }
        })
        .finally(() => { if (active) setLoading(false); });
    } else {
      setLoading(false);
    }
    return () => { active = false; };
  }, []);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    const { token, user, profile, subscription } = res.data.data;
    sessionVersion.current += 1;
    localStorage.setItem('kl_token', token);
    localStorage.setItem('kl_user', JSON.stringify(user));
    setUser(user);
    setProfile(profile);
    setSub(subscription);
    setLoading(false);
    return { user, profile };
  };

  const logout = () => {
    sessionVersion.current += 1;
    localStorage.removeItem('kl_token');
    localStorage.removeItem('kl_user');
    setUser(null);
    setProfile(null);
    setSub(null);
    window.location.href = '/login';
  };

  const register = async (data) => {
    const res = await api.post('/auth/register', data);
    const { token, user, profile, subscription } = res.data.data;
    sessionVersion.current += 1;
    localStorage.setItem('kl_token', token);
    localStorage.setItem('kl_user', JSON.stringify(user));
    setUser(user);
    setProfile(profile || null);
    setSub(subscription || null);
    setLoading(false);
    return user;
  };

  return (
    <AuthContext.Provider value={{
      user, profile, sub, loading,
      login, logout, register,
      setUser, setProfile
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
