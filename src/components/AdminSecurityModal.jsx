import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/Dialog';
import { ShieldCheck, Key, Lock, CheckCircle2, AlertCircle, LogOut, Check, User } from 'lucide-react';

export function AdminSecurityModal() {
  const { user, isSecurityModalOpen, closeSecurityModal, changePassword, logout } = useAuth();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState(null);

  // Strong password check
  const hasMinLength = newPassword.length >= 8;
  const hasUpper = /[A-Z]/.test(newPassword);
  const hasLower = /[a-z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(newPassword);
  const isStrong = hasMinLength && hasUpper && hasLower && hasNumber && hasSpecial;

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!newPassword) {
      setMessage({ type: 'error', text: 'Please enter your new password.' });
      return;
    }
    if (!isStrong) {
      setMessage({ 
        type: 'error', 
        text: 'New password must be strong: 8+ chars, uppercase, lowercase, number, and special character.' 
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'New passwords do not match.' });
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    const res = await changePassword(oldPassword, newPassword);
    setIsSubmitting(false);

    if (res.success) {
      setMessage({ type: 'success', text: res.message || 'Password updated successfully!' });
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } else {
      setMessage({ type: 'error', text: res.message || 'Failed to update password.' });
    }
  };

  const handleLogout = () => {
    logout();
    closeSecurityModal();
  };

  return (
    <Dialog open={isSecurityModalOpen} onOpenChange={(open) => !open && closeSecurityModal()}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden border border-slate-200 shadow-2xl rounded-2xl bg-white">
        
        {/* Header */}
        <div className="bg-slate-900 text-white p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-white">
                Account & Security Settings
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400 mt-0.5">
                Manage your account credentials
              </DialogDescription>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* User Profile Card */}
          <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 text-sm">{user?.full_name || 'Active User'}</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-indigo-100 text-indigo-800 border border-indigo-200">
                {user?.role || 'sales'}
              </span>
            </div>
            <div className="text-slate-500 font-mono text-[11px]">
              Username: <strong className="text-slate-700">{user?.username}</strong>
            </div>
            <div className="text-slate-400 text-[10px]">
              Status: <span className="text-emerald-600 font-semibold">{user?.status || 'Active'}</span>
            </div>
          </div>

          {/* Change Password Form */}
          <form onSubmit={handleChangePassword} className="space-y-3.5">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-indigo-600" />
              Update Password
            </h4>

            {message && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center gap-2 border ${
                  message.type === 'success'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-red-50 text-red-700 border-red-200'
                }`}
              >
                {message.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                )}
                <span>{message.text}</span>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-600">Current Password</label>
              <input
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                placeholder="Enter current password..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-600">New Strong Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 8 characters with upper, lower, number, symbol..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono"
              />
            </div>

            {/* Checklist */}
            {newPassword && (
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-[10px] space-y-1">
                <div className="grid grid-cols-2 gap-1 text-slate-500">
                  <span className={`flex items-center gap-1 ${hasMinLength ? 'text-emerald-600 font-semibold' : ''}`}>
                    <Check className="w-3 h-3" /> 8+ Characters
                  </span>
                  <span className={`flex items-center gap-1 ${hasUpper ? 'text-emerald-600 font-semibold' : ''}`}>
                    <Check className="w-3 h-3" /> Uppercase
                  </span>
                  <span className={`flex items-center gap-1 ${hasLower ? 'text-emerald-600 font-semibold' : ''}`}>
                    <Check className="w-3 h-3" /> Lowercase
                  </span>
                  <span className={`flex items-center gap-1 ${hasNumber && hasSpecial ? 'text-emerald-600 font-semibold' : ''}`}>
                    <Check className="w-3 h-3" /> Number & Symbol
                  </span>
                </div>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-600">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
            >
              {isSubmitting ? 'Saving Password...' : 'Save Password'}
            </button>
          </form>

          {/* Log Out */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-800 block">Sign Out</span>
              <span className="text-[11px] text-slate-500">End your current session</span>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-xs font-semibold transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
