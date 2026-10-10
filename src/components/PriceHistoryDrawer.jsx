import React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { History, Calendar, TrendingUp, TrendingDown, X, Tag, User } from 'lucide-react';

export function PriceHistoryDrawer({ open, onClose, product, customerName }) {
  if (!product) return null;

  const parseHistoryList = (prod) => {
    if (!prod) return [];
    const list = [];
    const activePrice = prod.customer_price !== undefined && prod.customer_price !== null 
      ? prod.customer_price 
      : (prod.price !== undefined && prod.price !== null ? prod.price : prod['Customer Price']);

    const defaultDate = new Date().toISOString().split('T')[0];

    const cleanDateOnly = (dStr) => {
      if (!dStr) return '';
      let str = String(dStr).trim();
      if (str.toLowerCase() === 'current active price' || str.toLowerCase() === 'previous' || str.toLowerCase() === 'previous price') {
        return '';
      }
      if (str.includes('GMT') || str.includes('Standard Time') || (str.length > 15 && isNaN(str))) {
        try {
          const d = new Date(str);
          if (!isNaN(d.getTime())) {
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            return `${yyyy}-${mm}-${dd}`;
          }
        } catch (e) {}
      }
      if (str.includes('T')) str = str.split('T')[0];
      if (str.includes(' ') && str.length > 10) str = str.split(' ')[0];
      return str;
    };

    const activeDate = cleanDateOnly(prod.last_updated) || defaultDate;

    if (activePrice !== null && activePrice !== undefined) {
      list.push({
        price: Number(activePrice),
        date: activeDate,
        isCurrent: true
      });
    }

    if (prod.price_history && typeof prod.price_history === 'string') {
      const regex = /(?:₹\s*)?([\d,]+\.?\d*)\s*(?:\(([^)]+)\))?/g;
      let match;
      while ((match = regex.exec(prod.price_history)) !== null) {
        const rawNum = match[1].replace(/,/g, '').trim();
        const val = parseFloat(rawNum);
        if (!isNaN(val) && val > 0) {
          let dt = match[2] ? cleanDateOnly(match[2]) : '';
          if (!dt) dt = activeDate;
          if (!list.some(item => Math.abs(item.price - val) < 0.001 && item.date === dt)) {
            list.push({ price: val, date: dt, isCurrent: false });
          }
        }
      }
    } else if (prod.previous_price && Number(prod.previous_price) !== Number(activePrice)) {
      list.push({
        price: Number(prod.previous_price),
        date: activeDate,
        isCurrent: false
      });
    }

    return list;
  };

  const historyEntries = parseHistoryList(product);
  const custName = customerName || product.customer_name || product.customer_id || 'Selected Customer';

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(isOpen) => !isOpen && onClose()} modal={false}>
      <DialogPrimitive.Portal>
        {/* Slide-over Drawer Panel from Right Side */}
        <DialogPrimitive.Content
          className="fixed top-0 right-0 bottom-0 z-50 h-full w-full sm:w-[450px] max-w-[90vw] bg-white shadow-2xl border-l border-slate-200 flex flex-col justify-between overflow-hidden duration-300 ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right"
        >
          {/* Header */}
          <div className="p-5 border-b border-slate-200 bg-slate-50/80 flex items-start justify-between shrink-0">
            <div className="space-y-1 pr-6">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                  <History className="w-4 h-4" />
                </div>
                <div>
                  <DialogPrimitive.Title className="text-base font-bold text-slate-900 leading-tight">
                    Price Revision History
                  </DialogPrimitive.Title>
                  <DialogPrimitive.Description className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                    <User className="w-3 h-3 text-slate-400" />
                    <span className="font-semibold text-slate-700">{custName}</span>
                  </DialogPrimitive.Description>
                </div>
              </div>
            </div>

            <DialogPrimitive.Close
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors focus:outline-none"
            >
              <X className="w-5 h-5" />
            </DialogPrimitive.Close>
          </div>

          {/* Drawer Body / Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* Product Card Info */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-indigo-50/60 to-slate-50 border border-indigo-100/80 space-y-2 shadow-2xs">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="text-[10px] font-bold tracking-wider text-indigo-600 uppercase flex items-center gap-1">
                    <Tag className="w-3 h-3" />
                    Product Details
                  </div>
                  <h4 className="font-bold text-slate-900 text-base leading-snug">{product.standard_name}</h4>
                </div>
              </div>

              {product.make && (
                <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-white border border-indigo-200 text-xs font-semibold text-indigo-700 shadow-2xs">
                  Make: {product.make}
                </div>
              )}
            </div>

            {/* Timeline Header */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                  Revision History Log ({historyEntries.length})
                </h5>
                <span className="text-[11px] text-slate-400 font-medium">Newest first</span>
              </div>

              {/* Entries list */}
              {historyEntries.length === 0 ? (
                <div className="p-6 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-center text-xs text-slate-400 space-y-1">
                  <p className="font-medium text-slate-500">No previous price revisions recorded</p>
                  <p className="text-[11px] text-slate-400">Only current active price is configured for this product.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {historyEntries.map((entry, idx) => (
                    <div
                      key={idx}
                      className={`p-3.5 rounded-xl border flex items-center justify-between text-xs transition-all ${
                        entry.isCurrent
                          ? 'bg-sky-50/90 border-sky-300 shadow-xs ring-1 ring-sky-200'
                          : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                            entry.isCurrent ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          #{idx + 1}
                        </div>
                        <div className="space-y-0.5">
                          <div className="font-bold text-slate-900 flex items-center gap-2">
                            <span className="text-sm">
                              ₹{Number(entry.price).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                            {entry.isCurrent && (
                              <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold border border-emerald-300">
                                Current Active
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            <span>Recorded: {entry.date}</span>
                          </div>
                        </div>
                      </div>

                      {idx > 0 && (
                        <div className="text-right">
                          {(() => {
                            const curr = entry.price;
                            const prev = historyEntries[idx - 1]?.price;
                            if (prev && curr !== prev) {
                              const diff = curr - prev;
                              const pct = ((diff / prev) * 100).toFixed(1);
                              return (
                                <span
                                  className={`text-[11px] font-semibold flex items-center gap-0.5 justify-end ${
                                    diff > 0 ? 'text-rose-600' : 'text-emerald-700'
                                  }`}
                                >
                                  {diff > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                  {diff > 0 ? `+₹${diff.toFixed(2)}` : `-₹${Math.abs(diff).toFixed(2)}`} ({pct}%)
                                </span>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Drawer Footer */}
          <div className="p-4 border-t border-slate-200 bg-slate-50/80 flex items-center justify-between shrink-0">
            <span className="text-[11px] text-slate-400 font-medium">
              Interactive side panel
            </span>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors shadow-2xs"
            >
              Close Panel
            </button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
