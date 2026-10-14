import React, { createContext, useContext, useState, useEffect } from 'react';
import { api, getStoredUser, setStoredUser, setAuthToken } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // Stored user object from Google Sheets authentication: { user_id, username, full_name, role, status }
  const [user, setUser] = useState(() => getStoredUser());
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);

  useEffect(() => {
    setStoredUser(user);
  }, [user]);

  const login = async (username, password) => {
    try {
      const res = await api.login(username, password);
      if (res && res.success && res.user) {
        setUser(res.user);
        return { success: true, user: res.user };
      }
      return { success: false, message: res?.error || 'Invalid credentials.' };
    } catch (err) {
      return {
        success: false,
        message: err.message || 'Authentication failed. Please verify your credentials.'
      };
    }
  };

  const logout = () => {
    setUser(null);
    setStoredUser(null);
    setAuthToken('');
  };

  const changePassword = async (oldPassword, newPassword) => {
    if (!user) {
      return { success: false, message: 'You must be logged in to change password.' };
    }
    try {
      const res = await api.changePassword(user.username, oldPassword, newPassword);
      if (res && res.success) {
        return { success: true, message: res.message || 'Password changed successfully!' };
      }
      return { success: false, message: res?.error || 'Failed to update password.' };
    } catch (err) {
      return {
        success: false,
        message: err.response?.data?.detail || err.message || 'Failed to change password.'
      };
    }
  };

  const openSecurityModal = () => setIsSecurityModalOpen(true);
  const closeSecurityModal = () => setIsSecurityModalOpen(false);

  const isAuthenticated = !!user;
  const role = user?.role ? user.role.toLowerCase() : 'sales';
  const isAdmin = role === 'admin';
  const isSales = role === 'sales';

  const value = {
    user,
    isAuthenticated,
    role,
    isAdmin,
    isSales,
    login,
    logout,
    changePassword,
    isSecurityModalOpen,
    openSecurityModal,
    closeSecurityModal
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
