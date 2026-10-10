import React from 'react';

export function Badge({ children, variant = 'default', className = '', ...props }) {
  const base = "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none";
  
  const variants = {
    default: "bg-sky-50 text-sky-700 border border-sky-200/80",
    success: "bg-emerald-50 text-emerald-700 border border-emerald-200/80",
    warning: "bg-amber-50 text-amber-800 border border-amber-200/80",
    danger: "bg-rose-50 text-rose-700 border border-rose-200/80",
    outline: "border border-slate-200 text-slate-700 bg-slate-50",
  };

  return (
    <span className={`${base} ${variants[variant] || variants.default} ${className}`} {...props}>
      {children}
    </span>
  );
}
