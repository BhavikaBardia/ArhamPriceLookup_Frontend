import React from 'react';
import { useAuth } from '../context/AuthContext';
import { ShieldAlert, Lock, Table, LogOut } from 'lucide-react';

export function AdminLockScreen({ title = "Catalog Management", onNavigateToCatalog }) {
  const { user, logout } = useAuth();

  return (
    <div className="max-w-xl mx-auto my-12 p-8 bg-white rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/50 text-center animate-in fade-in zoom-in-95 duration-200">
      
      {/* Icon Badge */}
      <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-gradient-to-tr from-amber-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-100 ring-8 ring-indigo-50">
        <Lock className="w-8 h-8" />
      </div>

      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200/80 text-amber-800 text-[11px] font-semibold mb-3">
        <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
        Administrator Access Required
      </div>

      <h2 className="text-xl font-bold text-slate-900 tracking-tight">
        {title} is Restricted
      </h2>

      <p className="text-xs text-slate-500 mt-2.5 max-w-md mx-auto leading-relaxed">
        You are currently logged in as <strong className="text-slate-700">{user?.full_name || user?.username}</strong> (<span className="capitalize font-semibold text-indigo-600">{user?.role || 'Sales Staff'}</span>). Sales staff can look up prices and generate quotations, but creating, editing, and deleting products or customers requires an <strong>Administrator</strong> account.
      </p>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-8 max-w-sm mx-auto">
        {onNavigateToCatalog && (
          <button
            type="button"
            onClick={onNavigateToCatalog}
            className="w-full sm:w-auto flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-all cursor-pointer"
          >
            <Table className="w-3.5 h-3.5 text-slate-500" />
            Return to Catalog
          </button>
        )}

        <button
          type="button"
          onClick={logout}
          className="w-full sm:w-auto flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-md shadow-indigo-100 transition-all cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          Switch to Admin
        </button>
      </div>
    </div>
  );
}
