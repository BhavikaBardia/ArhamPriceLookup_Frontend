import React, { useState, useRef, useEffect } from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { ChevronDown, Search, Check, X, RefreshCw } from 'lucide-react';

// Fuzzy similarity score calculator
function getFuzzyScore(query, target) {
  const q = query.toLowerCase().trim();
  const t = target.toLowerCase().trim();
  if (!q || !t) return 0;

  // Substring match gets max score
  if (t.includes(q)) return 1.0;

  // Check word-level substring matches
  const targetWords = t.split(/\s+/);
  const qWords = q.split(/\s+/);

  let wordScoreSum = 0;
  for (const qw of qWords) {
    let bestWordScore = 0;
    for (const tw of targetWords) {
      if (tw.includes(qw) || qw.includes(tw)) {
        bestWordScore = 1.0;
      } else {
        // Levenshtein distance
        const m = qw.length, n = tw.length;
        const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
        for (let i = 0; i <= m; i++) dp[i][0] = i;
        for (let j = 0; j <= n; j++) dp[0][j] = j;

        for (let i = 1; i <= m; i++) {
          for (let j = 1; j <= n; j++) {
            if (qw[i - 1] === tw[j - 1]) {
              dp[i][j] = dp[i - 1][j - 1];
            } else {
              dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
            }
          }
        }
        const score = 1 - (dp[m][n] / Math.max(m, n));
        if (score > bestWordScore) bestWordScore = score;
      }
    }
    wordScoreSum += bestWordScore;
  }
  return wordScoreSum / qWords.length;
}

export function SearchableCustomerSelect({ customers = [], value, onValueChange, placeholder = "Search & select customer...", isLoading = false }) {
  const [open, setOpen] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');
  const inputRef = useRef(null);

  const safeCustomers = Array.isArray(customers) ? customers : [];
  const selectedCustomer = safeCustomers.find(c => 
    c && (c.customer_id === value || String(c.customer_id || '').trim().toUpperCase() === String(value || '').trim().toUpperCase())
  );

  // Focus input when popover opens
  useEffect(() => {
    if (open) {
      setTimeout(() => {
        if (inputRef.current) inputRef.current.focus();
      }, 50);
    } else {
      setFilterQuery('');
    }
  }, [open]);

  // Fuzzy filter and sort customers
  const filteredCustomers = (() => {
    if (!filterQuery.trim()) return safeCustomers;
    const q = filterQuery.toLowerCase().trim();

    return safeCustomers
      .map(c => {
        const fullText = `${c.customer_name || ''} ${c.contact_person || ''} ${c.customer_id || ''} ${c.phone || ''}`;
        const score = getFuzzyScore(q, fullText);
        return { customer: c, score };
      })
      .filter(item => item.score >= 0.5) // Threshold for fuzzy match
      .sort((a, b) => b.score - a.score)
      .map(item => item.customer);
  })();

  const handleSelect = (customerId) => {
    onValueChange(customerId);
    setOpen(false);
    setFilterQuery('');
  };

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          disabled={isLoading}
          className="flex h-11 w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-800 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-all text-left shadow-sm disabled:cursor-not-allowed disabled:bg-slate-50"
        >
          {isLoading ? (
            <div className="flex items-center gap-2 truncate">
              <RefreshCw className="w-4 h-4 text-indigo-600 animate-spin shrink-0" />
              <span className="text-slate-400 font-medium">Loading customers...</span>
            </div>
          ) : selectedCustomer ? (
            <span className="font-semibold text-slate-900 truncate">{selectedCustomer.customer_name}</span>
          ) : (
            <span className="text-slate-400">{placeholder}</span>
          )}
          <ChevronDown className="h-4 w-4 opacity-50 ml-2 shrink-0 transition-transform duration-200" />
        </button>
      </PopoverPrimitive.Trigger>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={6}
          className="z-50 w-[var(--radix-popover-trigger-width)] min-w-[320px] max-h-80 overflow-hidden rounded-xl border border-slate-200 bg-white p-2 text-slate-800 shadow-xl backdrop-blur-xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
        >
          {/* Search Input Field */}
          <div className="relative mb-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              ref={inputRef}
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Type customer name (e.g. Acme, Apex)..."
              className="w-full h-10 bg-slate-50 border border-slate-300 rounded-lg pl-9 pr-8 py-1.5 text-xs text-slate-900 font-semibold placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white transition-all"
            />
            {filterQuery && (
              <button
                type="button"
                onClick={() => setFilterQuery('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-700"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filtered Customer List */}
          <div className="max-h-60 overflow-y-auto space-y-1 pr-1">
            {filteredCustomers.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">
                No customer found matching "{filterQuery}"
              </div>
            ) : (
              filteredCustomers.map((c) => {
                const isSelected = c.customer_id === value;
                return (
                  <button
                    key={c.customer_id}
                    type="button"
                    onClick={() => handleSelect(c.customer_id)}
                    className={`w-full text-left flex items-center justify-between p-2.5 rounded-lg text-xs transition-colors ${
                      isSelected
                        ? 'bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="truncate pr-2">
                      <div className="font-semibold text-slate-900 truncate">{c.customer_name}</div>
                      {c.contact_person && (
                        <div className="text-[11px] text-slate-500 font-normal">Contact: {c.contact_person}</div>
                      )}
                    </div>

                    {isSelected && <Check className="w-4 h-4 text-indigo-600 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

export function SearchableProductSelect({ products = [], value, onValueChange, placeholder = "Search & select product...", isLoading = false }) {
  const [open, setOpen] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');
  const inputRef = useRef(null);

  const safeProducts = Array.isArray(products) ? products : [];
  const selectedProduct = safeProducts.find(p => 
    p && (p.product_id === value || String(p.product_id || '').trim().toUpperCase() === String(value || '').trim().toUpperCase())
  );

  // Focus input when popover opens
  useEffect(() => {
    if (open) {
      setTimeout(() => {
        if (inputRef.current) inputRef.current.focus();
      }, 50);
    } else {
      setFilterQuery('');
    }
  }, [open]);

  // Fuzzy filter and sort products
  const filteredProducts = (() => {
    if (!filterQuery.trim()) return safeProducts;
    const q = filterQuery.toLowerCase().trim();

    return safeProducts
      .map(p => {
        const fullText = `${p.standard_name || ''} ${p.product_id || ''} ${p.make || ''}`;
        const score = getFuzzyScore(q, fullText);
        return { product: p, score };
      })
      .filter(item => item.score >= 0.5) // Threshold for fuzzy match
      .sort((a, b) => b.score - a.score)
      .map(item => item.product);
  })();

  const handleSelect = (productId) => {
    onValueChange(productId);
    setOpen(false);
    setFilterQuery('');
  };

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          disabled={isLoading}
          className="flex h-11 w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-800 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-all text-left shadow-sm disabled:cursor-not-allowed disabled:bg-slate-50"
        >
          {isLoading ? (
            <div className="flex items-center gap-2 truncate">
              <RefreshCw className="w-4 h-4 text-indigo-600 animate-spin shrink-0" />
              <span className="text-slate-400 font-medium">Loading products...</span>
            </div>
          ) : selectedProduct ? (
            <div className="flex items-center gap-2 truncate">
              <span className="font-semibold text-slate-900 truncate">{selectedProduct.standard_name}</span>
              {selectedProduct.make && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/80 shrink-0">
                  Make: {selectedProduct.make}
                </span>
              )}
            </div>
          ) : (
            <span className="text-slate-400">{placeholder}</span>
          )}
          <ChevronDown className="h-4 w-4 opacity-50 ml-2 shrink-0 transition-transform duration-200" />
        </button>
      </PopoverPrimitive.Trigger>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={6}
          className="z-50 w-[var(--radix-popover-trigger-width)] min-w-[340px] max-h-80 overflow-hidden rounded-xl border border-slate-200 bg-white p-2 text-slate-800 shadow-xl backdrop-blur-xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
        >
          {/* Search Input Field */}
          <div className="relative mb-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              ref={inputRef}
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Type product name or make (e.g. motor, siemens)..."
              className="w-full h-10 bg-slate-50 border border-slate-300 rounded-lg pl-9 pr-8 py-1.5 text-xs text-slate-900 font-semibold placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white transition-all"
            />
            {filterQuery && (
              <button
                type="button"
                onClick={() => setFilterQuery('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-700"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filtered Product List */}
          <div className="max-h-60 overflow-y-auto space-y-1 pr-1">
            {filteredProducts.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">
                No product found matching "{filterQuery}"
              </div>
            ) : (
              filteredProducts.map((p) => {
                const isSelected = p.product_id === value;
                return (
                  <button
                    key={p.product_id}
                    type="button"
                    onClick={() => handleSelect(p.product_id)}
                    className={`w-full text-left flex items-center justify-between p-2.5 rounded-lg text-xs transition-colors ${
                      isSelected
                        ? 'bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full pr-2 gap-2">
                      <div className="truncate text-left">
                        <span className="font-semibold text-slate-900 block truncate">{p.standard_name}</span>
                        {p.price !== undefined && p.price !== null && !isNaN(p.price) && (
                          <span className="text-[11px] text-emerald-600 font-mono font-semibold">
                            ₹{Number(p.price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                        )}
                      </div>
                      {p.make && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/80 shrink-0">
                          Make: {p.make}
                        </span>
                      )}
                    </div>

                    {isSelected && <Check className="w-4 h-4 text-indigo-600 shrink-0 ml-1" />}
                  </button>
                );
              })
            )}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
