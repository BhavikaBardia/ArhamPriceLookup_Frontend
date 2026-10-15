import React, { useState, useRef, useEffect } from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { ChevronDown, Search, Check, X, RefreshCw, Plus } from 'lucide-react';

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

export function SearchableCustomerSelect({ customers = [], value, onValueChange, placeholder = "Search & select customer...", isLoading = false, disabled = false }) {
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
          disabled={isLoading || disabled}
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

export function SearchableProductSelect({ 
  products = [], 
  value, 
  onValueChange, 
  placeholder = "Search & select product...", 
  isLoading = false,
  compact = false,
  className = "",
  disabled = false,
  onAddNewProduct = null
}) {
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

  // Multi-token and fuzzy filter & sort products
  const filteredProducts = (() => {
    if (!filterQuery.trim()) return safeProducts;
    const q = filterQuery.toLowerCase().trim();
    const tokens = q.split(/\s+/).filter(Boolean);

    return safeProducts
      .map(p => {
        const fullText = `${p.standard_name || ''} ${p.product_id || ''} ${p.make || ''}`.toLowerCase();
        // Check if all search tokens appear anywhere in the product text
        const allTokensMatch = tokens.every(tok => fullText.includes(tok));
        const fuzzy = getFuzzyScore(q, fullText);
        const score = allTokensMatch ? 1.0 + (fuzzy * 0.5) : fuzzy;
        return { product: p, score };
      })
      .filter(item => item.score >= 0.4) // Threshold for fuzzy match
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
          disabled={isLoading || disabled}
          className={compact 
            ? `flex h-9 w-full items-center justify-between rounded-lg border border-slate-200 bg-slate-50 hover:bg-white px-2.5 py-1 text-xs text-slate-800 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-all text-left shadow-xs disabled:cursor-not-allowed disabled:bg-slate-50 min-w-0 ${className}`
            : `flex h-11 w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-800 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-all text-left shadow-sm disabled:cursor-not-allowed disabled:bg-slate-50 min-w-0 ${className}`
          }
        >
          {isLoading ? (
            <div className="flex items-center gap-1.5 min-w-0 truncate">
              <RefreshCw className={`${compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} text-indigo-600 animate-spin shrink-0`} />
              <span className="text-slate-400 font-medium truncate">{compact ? 'Loading...' : 'Loading products...'}</span>
            </div>
          ) : selectedProduct ? (
            <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden" title={selectedProduct.standard_name}>
              <span className="font-semibold text-slate-900 truncate block text-xs" title={selectedProduct.standard_name}>
                {selectedProduct.standard_name}
              </span>
              {selectedProduct.make && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200/80 shrink-0">
                  {selectedProduct.make}
                </span>
              )}
            </div>
          ) : (
            <span className="text-slate-400 text-xs truncate">{placeholder}</span>
          )}
          <ChevronDown className={`${compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} opacity-50 ml-1.5 shrink-0 transition-transform duration-200`} />
        </button>
      </PopoverPrimitive.Trigger>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={6}
          className="z-50 w-[var(--radix-popover-trigger-width)] min-w-[540px] sm:min-w-[620px] max-w-[760px] max-h-[500px] overflow-hidden rounded-2xl border border-slate-200/90 bg-white/95 backdrop-blur-xl p-3 text-slate-800 shadow-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
        >
          {/* Search Input Field */}
          <div className="relative mb-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              ref={inputRef}
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Search product name, size, make, or ID (e.g. 1 inch, polycab, bend)..."
              className="w-full h-10 bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-8 py-1.5 text-xs text-slate-900 font-semibold placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white transition-all shadow-inner"
            />
            {filterQuery && (
              <button
                type="button"
                onClick={() => setFilterQuery('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-700 p-0.5 rounded-full hover:bg-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Results Summary Bar */}
          <div className="flex items-center justify-between px-1 pb-1.5 text-[11px] text-slate-400 font-medium border-b border-slate-100 mb-1.5">
            <span>
              {filteredProducts.length} {filteredProducts.length === 1 ? 'product' : 'products'} available
            </span>
            {onAddNewProduct ? (
              <button
                type="button"
                onClick={() => {
                  const q = filterQuery;
                  setOpen(false);
                  onAddNewProduct(q);
                }}
                className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded-lg border border-indigo-200/60 transition-all"
                title="Create a new product not in this list"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Add New Product</span>
              </button>
            ) : (
              <span className="text-[10px] text-slate-400">Click to select item</span>
            )}
          </div>

          {/* Filtered Product List with Full Names */}
          <div className="max-h-[340px] overflow-y-auto space-y-1.5 pr-1">
            {filteredProducts.length === 0 ? (
              <div className="py-8 text-center space-y-3 px-4">
                <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                  <Search className="w-5 h-5 text-slate-400" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-700">No matching products found</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    "{filterQuery}" is not in your product catalog.
                  </p>
                </div>
                {onAddNewProduct && (
                  <button
                    type="button"
                    onClick={() => {
                      const q = filterQuery;
                      setOpen(false);
                      onAddNewProduct(q);
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add "{filterQuery || 'New Product'}" to Catalog</span>
                  </button>
                )}
              </div>
            ) : (
              <>
                {filteredProducts.map((p) => {
                  const isSelected = p.product_id === value;
                  return (
                    <button
                      key={p.product_id}
                      type="button"
                      onClick={() => handleSelect(p.product_id)}
                      className={`w-full text-left flex items-start justify-between p-3 rounded-xl text-xs transition-all cursor-pointer border ${
                        isSelected
                          ? 'bg-indigo-50/90 text-indigo-950 border-indigo-300 shadow-xs'
                          : 'hover:bg-slate-50 text-slate-800 border-slate-100 hover:border-slate-200'
                      }`}
                    >
                      <div className="flex-1 min-w-0 pr-3">
                        {/* Full standard name - wraps completely, never truncated */}
                        <div className="font-bold text-slate-900 text-xs leading-relaxed whitespace-normal break-words">
                          {p.standard_name}
                        </div>

                        {/* Detail badges */}
                        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                          {p.product_id && (
                            <span className="font-mono text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                              {p.product_id}
                            </span>
                          )}
                          {p.make && (
                            <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200/80">
                              Make: {p.make}
                            </span>
                          )}
                          {p.price !== undefined && p.price !== null && !isNaN(p.price) && (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-mono">
                              Catalog Rate: ₹{Number(p.price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </span>
                          )}
                        </div>
                      </div>

                      {isSelected && (
                        <div className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                          <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                        </div>
                      )}
                    </button>
                  );
                })}

                {/* Bottom shortcut when searching */}
                {onAddNewProduct && filterQuery.trim().length > 0 && (
                  <div className="pt-2 mt-1 border-t border-slate-100 text-center">
                    <button
                      type="button"
                      onClick={() => {
                        const q = filterQuery;
                        setOpen(false);
                        onAddNewProduct(q);
                      }}
                      className="w-full py-2 px-3 rounded-xl bg-slate-50 hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 text-xs font-semibold flex items-center justify-center gap-1.5 border border-dashed border-slate-200 hover:border-indigo-200 transition-all cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Not in list? Add <strong>"{filterQuery}"</strong> as a new product</span>
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

export function UomSelect({ 
  value, 
  onValueChange, 
  options = ['Kg', 'Mtr', 'Inc', 'Nos', 'Pcs', 'Set', 'Box', 'Pkt', 'Roll', 'Ltr', 'Sq.Mtr', 'Drum', 'Pair', 'Bundle'], 
  disabled = false 
}) {
  const [open, setOpen] = useState(false);
  const [customMode, setCustomMode] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const customInputRef = useRef(null);

  const handleSelect = (u) => {
    onValueChange(u);
    setOpen(false);
    setCustomMode(false);
  };

  const handleSaveCustom = (e) => {
    e.preventDefault();
    if (customInput.trim()) {
      onValueChange(customInput.trim());
      setOpen(false);
      setCustomMode(false);
      setCustomInput('');
    }
  };

  useEffect(() => {
    if (customMode && customInputRef.current) {
      customInputRef.current.focus();
    }
  }, [customMode]);

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={(o) => { setOpen(o); if (!o) setCustomMode(false); }}>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          disabled={disabled}
          className="flex h-9 w-full items-center justify-between rounded-lg border border-slate-200 bg-slate-50 hover:bg-white px-2 py-1 text-xs font-bold text-slate-800 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-all shadow-xs disabled:cursor-not-allowed disabled:bg-slate-50 cursor-pointer"
        >
          <span className="truncate flex-1 text-center font-bold text-slate-900">{value || 'Nos'}</span>
          <ChevronDown className="h-3 w-3 opacity-50 shrink-0 ml-0.5" />
        </button>
      </PopoverPrimitive.Trigger>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="center"
          side="bottom"
          sideOffset={4}
          className="z-50 w-28 max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 text-slate-800 shadow-xl backdrop-blur-xl"
        >
          {customMode ? (
            <form onSubmit={handleSaveCustom} className="p-1 space-y-1.5">
              <input
                ref={customInputRef}
                type="text"
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                placeholder="Unit (e.g. Coil)"
                className="w-full h-8 px-2 text-xs font-bold bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white"
              />
              <div className="flex items-center gap-1">
                <button
                  type="submit"
                  className="flex-1 h-7 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[11px] font-bold cursor-pointer"
                >
                  Set
                </button>
                <button
                  type="button"
                  onClick={() => setCustomMode(false)}
                  className="h-7 px-1.5 text-slate-500 hover:bg-slate-100 rounded text-[11px] cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-0.5">
              {/* If current value is custom and not in default options */}
              {value && !options.includes(value) && (
                <button
                  type="button"
                  onClick={() => handleSelect(value)}
                  className="w-full text-left flex items-center justify-between px-2 py-1.5 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-700 cursor-pointer"
                >
                  <span>{value}</span>
                  <Check className="w-3.5 h-3.5 text-indigo-600" />
                </button>
              )}
              {options.map((u) => {
                const isSelected = u === value || (!value && u === 'Nos');
                return (
                  <button
                    key={u}
                    type="button"
                    onClick={() => handleSelect(u)}
                    className={`w-full text-left flex items-center justify-between px-2 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-50 text-indigo-700 font-bold'
                        : 'hover:bg-slate-100 text-slate-800'
                    }`}
                  >
                    <span>{u}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                  </button>
                );
              })}
              <div className="pt-1 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => { setCustomMode(true); setCustomInput(value || ''); }}
                  className="w-full text-left px-2 py-1 rounded-lg text-[11px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
                >
                  + Other...
                </button>
              </div>
            </div>
          )}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
