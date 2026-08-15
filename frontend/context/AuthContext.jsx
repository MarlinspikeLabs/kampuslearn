'use client';
import { createContext, useContext, useState, useEffect } from 'react';
import api from '@/lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [profile, setProfile] = useState(null);
  const [sub, setSub]         = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('kl_token');
    if (token) {
      api.get('/auth/me')
        .then(res => {
          setUser(res.data.data.user);
          setProfile(res.data.data.profile);
          setSub(res.data.data.subscription);
        })
        .catch(() => {
          localStorage.removeItem('kl_token');
          localStorage.removeItem('kl_user');
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    const { token, user, profile, subscription } = res.data.data;
    localStorage.setItem('kl_token', token);
    localStorage.setItem('kl_user', JSON.stringify(user));
    setUser(user);
    setProfile(profile);
    setSub(subscription);
    return { user, profile };
  };

  const logout = () => {
    localStorage.removeItem('kl_token');
    localStorage.removeItem('kl_user');
    setUser(null);
    setProfile(null);
    setSub(null);
    window.location.href = '/login';
  };

  const register = async (data) => {
    const res = await api.post('/auth/register', data);
    const { token, user } = res.data.data;
    localStorage.setItem('kl_token', token);
    setUser(user);
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
