import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { SearchableCustomerSelect } from '../components/ui/SearchableSelect';
import { Badge } from '../components/ui/Badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/Dialog';
import { PriceHistoryDrawer } from '../components/PriceHistoryDrawer';
import { 
  Search, User, RefreshCw, AlertCircle, Filter, X, Trash2, Check,
  ListChecks, Copy, History, Calendar, TrendingUp, TrendingDown, FileText
} from 'lucide-react';

export function PriceLookup({ onNavigateToManage, onNavigateToQuotation }) {
  const [customers, setCustomers] = useState([]);
  const [isCustomersLoading, setIsCustomersLoading] = useState(true);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [productsList, setProductsList] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Selected Products List State
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [copiedToast, setCopiedToast] = useState(false);

  // History Modal State
  const [historyProduct, setHistoryProduct] = useState(null);

  // Load customers on mount
  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    setIsCustomersLoading(true);
    try {
      const data = await api.getCustomers();
      setCustomers(data);
      if (data.length > 0 && !selectedCustomerId) {
        setSelectedCustomerId(data[0].customer_id);
      }
    } catch (err) {
      console.error('Failed to load customers:', err);
      setError('Failed to fetch customer list from backend');
    } finally {
      setIsCustomersLoading(false);
    }
  };

  // Perform live search query whenever customer or searchQuery changes
  useEffect(() => {
    if (selectedCustomerId) {
      fetchPrices();
    }
  }, [selectedCustomerId, searchQuery]);

  const fetchPrices = async () => {
    if (!selectedCustomerId) {
      setProductsList([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      const results = await api.lookupPrices(selectedCustomerId, searchQuery.trim());
      // Strictly show products that belong to the customer (configured and active price)
      const customerProducts = (results || []).filter(p => p.is_configured && p.price !== null && p.price !== undefined);
      setProductsList(customerProducts);
    } catch (err) {
      console.error('Lookup failed:', err);
      setError('Error fetching prices. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const selectedCustomer = customers.find(c => c.customer_id === selectedCustomerId);

  const handleCustomerChange = (newId) => {
    setSelectedCustomerId(newId);
    setSelectedProducts([]);
  };

  // Toggle selecting a product into the selection list below
  const toggleSelectProduct = (product) => {
    setSelectedProducts(prev => {
      const exists = prev.some(p => p.product_id === product.product_id);
      if (exists) {
        return prev.filter(p => p.product_id !== product.product_id);
      } else {
        return [...prev, product];
      }
    });
  };

  const removeSelectedProduct = (productId) => {
    setSelectedProducts(prev => prev.filter(p => p.product_id !== productId));
  };

  const clearSelectedProducts = () => {
    setSelectedProducts([]);
  };

  // Copy selected products list to clipboard as text
  const copySelectedList = () => {
    if (selectedProducts.length === 0) return;

    let text = `Customer: ${selectedCustomer ? selectedCustomer.customer_name : ''}\n`;
    text += `Selected Products & Prices:\n`;
    text += `-----------------------------------------------\n`;

    selectedProducts.forEach(p => {
      const priceStr = `₹${Number(p.price).toFixed(2)}`;
      const makeStr = p.make ? ` [Make: ${p.make}]` : '';
      text += `${p.standard_name}${makeStr} - ${priceStr}\n`;
    });

    const totalVal = selectedProducts.reduce((acc, p) => acc + Number(p.price || 0), 0);
    text += `-----------------------------------------------\n`;
    text += `Total Value: ₹${totalVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n`;

    navigator.clipboard.writeText(text);
    setCopiedToast(true);
    setTimeout(() => setCopiedToast(false), 2000);
  };

  // Parse price history string into structured array for history modal
  const parseHistoryList = (product) => {
    if (!product) return [];
    const list = [];
    if (product.price !== null && product.price !== undefined) {
      list.push({
        price: Number(product.price),
        date: product.last_updated || 'Current Active Price',
        isCurrent: true
      });
    }

    if (product.price_history && typeof product.price_history === 'string') {
      const entries = product.price_history.split(',').map(s => s.trim()).filter(Boolean);
      entries.forEach(entry => {
        const match = entry.match(/(?:₹)?([\d,\.]+)\s*(?:\(([^)]+)\))?/);
        if (match) {
          const val = parseFloat(match[1].replace(/,/g, ''));
          const dt = match[2] || 'Previous';
          if (!isNaN(val) && !list.some(item => item.price === val && item.date === dt)) {
            list.push({ price: val, date: dt, isCurrent: false });
          }
        }
      });
    } else if (product.previous_price) {
      list.push({
        price: Number(product.previous_price),
        date: product.last_updated || 'Previous Price',
        isCurrent: false
      });
    }

    return list;
  };

  const totalSelectedSum = selectedProducts.reduce((acc, p) => acc + Number(p.price || 0), 0);

  return (
    <div className="space-y-8 pb-16">
      {/* Top Controls: Customer Selector & Instant Search Bar */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Search className="w-6 h-6 text-indigo-500" />
              Product Price Lookup
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Select customer and search product name to view configured customer prices. Click product name to view history, or click row to add to selection.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {onNavigateToQuotation && selectedCustomerId && (
              <button
                onClick={() => onNavigateToQuotation(selectedCustomerId)}
                title="Create Quotation for this Customer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
                Create Quotation
              </button>
            )}

            <button
              onClick={loadCustomers}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-600 hover:text-slate-900 hover:bg-slate-100 text-xs transition-all font-semibold cursor-pointer"
              title="Refresh Customers"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isCustomersLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Customer Select & Instant Filter Input */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* Customer Selection Dropdown */}
          <div className="md:col-span-5 space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-indigo-500" />
              Select Customer
            </label>
            <SearchableCustomerSelect
              customers={customers}
              value={selectedCustomerId}
              onValueChange={handleCustomerChange}
              placeholder="Search customer..."
              isLoading={isCustomersLoading}
            />
          </div>

          {/* Instant Search Bar */}
          <div className="md:col-span-7 space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-emerald-600" />
                Live Search Customer Products or Make / Brand
              </span>
              {isLoading && (
                <span className="text-[11px] text-indigo-600 flex items-center gap-1 font-semibold animate-pulse">
                  <RefreshCw className="w-3 h-3 animate-spin text-indigo-600" />
                  Loading products...
                </span>
              )}
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Type product name or make... (e.g. mcb, siemens, motor)"
                className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-10 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-all font-medium"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              {isLoading ? (
                <div className="absolute right-3.5 top-3.5">
                  <RefreshCw className="w-4 h-4 text-indigo-600 animate-spin" />
                </div>
              ) : searchQuery ? (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-700 bg-slate-200 p-0.5 rounded-full"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Main Product Name & Price Results Table */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-2">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            Customer Products ({productsList.length})
            <span className="text-xs font-normal text-slate-500 ml-2">(Click product name for history, or row to select/add)</span>
          </h2>
          {searchQuery && (
            <span className="text-xs text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-200 font-semibold flex items-center gap-1.5">
              {isLoading && <RefreshCw className="w-3 h-3 animate-spin" />}
              Filtering for: "{searchQuery}"
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="py-12 text-center border border-indigo-100 rounded-xl bg-indigo-50/40 space-y-3">
            <RefreshCw className="w-8 h-8 mx-auto animate-spin text-indigo-600" />
            <p className="text-sm font-bold text-indigo-900">Loading products for customer...</p>
            <p className="text-xs text-indigo-600/80 font-medium">Fetching customer pricing records...</p>
          </div>
        ) : productsList.length === 0 ? (
          <div className="py-12 text-center text-slate-400 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
            <Search className="w-8 h-8 mx-auto mb-2 text-slate-400 opacity-60" />
            {!searchQuery.trim() ? (
              <p className="text-sm font-medium text-slate-500">No products configured for {selectedCustomer?.customer_name || 'this customer'}</p>
            ) : (
              <p className="text-sm font-medium text-slate-500">No products found for this customer matching "{searchQuery}"</p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200/80">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                  <th className="py-3.5 px-5">Product Name & Make</th>
                  <th className="py-3.5 px-5 w-64 text-right">Customer Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {productsList.map((product) => {
                  const isSelected = selectedProducts.some(p => p.product_id === product.product_id);

                  return (
                    <tr 
                      key={product.product_id}
                      onClick={() => toggleSelectProduct(product)}
                      className={`cursor-pointer transition-all border-l-4 ${
                        isSelected 
                          ? 'bg-sky-50/80 border-l-sky-500 hover:bg-sky-100/70' 
                          : 'border-l-transparent hover:bg-indigo-50/40'
                      }`}
                      title="Click row to add/select product for summary list"
                    >
                      {/* Product Name & Make */}
                      <td className="py-3.5 px-5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span 
                            onClick={(e) => {
                              e.stopPropagation();
                              setHistoryProduct(product);
                            }}
                            className="font-bold text-slate-900 text-sm hover:text-indigo-600 hover:underline cursor-pointer flex items-center gap-1.5 group"
                            title="Click product name to view full price revision history with dates"
                          >
                            {product.standard_name}
                            <History className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 transition-colors" />
                          </span>

                          {product.make && (
                            <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/80">
                              Make: {product.make}
                            </span>
                          )}

                          {isSelected && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-xs">
                              <Check className="w-3 h-3" />
                              Added
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Customer Price */}
                      <td className="py-3.5 px-5 text-right font-bold text-base text-emerald-700 tracking-tight">
                        ₹{Number(product.price).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bottom Pinned Selected Products & Pricing Summary Table */}
      <div className="bg-white border-2 border-indigo-200/80 rounded-2xl p-6 shadow-md space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <ListChecks className="w-5 h-5 text-indigo-600" />
              Selected Products ({selectedProducts.length})
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Click anywhere on a product row above to add or remove it from your selection.
            </p>
          </div>

          {selectedProducts.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={copySelectedList}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold transition-all shadow-xs"
              >
                <Copy className="w-3.5 h-3.5" />
                {copiedToast ? 'Copied!' : 'Copy Summary'}
              </button>

              <button
                onClick={clearSelectedProducts}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-700 border border-slate-200 text-xs font-semibold transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear
              </button>
            </div>
          )}
        </div>

        {selectedProducts.length === 0 ? (
          <div className="py-8 text-center text-slate-400 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
            <ListChecks className="w-7 h-7 mx-auto mb-2 text-slate-400 opacity-60" />
            <p className="text-xs text-slate-500">Click any product row above to collect items here.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="overflow-x-auto rounded-xl border border-slate-200/80">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                    <th className="py-3 px-4">Product Name & Make</th>
                    <th className="py-3 px-4 w-52 text-right">Price</th>
                    <th className="py-3 px-4 w-16 text-center">Remove</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {selectedProducts.map((p) => (
                    <tr key={`selected-${p.product_id}`} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <span 
                            onClick={() => setHistoryProduct(p)}
                            className="font-bold text-slate-900 text-sm hover:text-indigo-600 hover:underline cursor-pointer flex items-center gap-1.5 group"
                          >
                            {p.standard_name}
                            <History className="w-3 h-3 text-slate-400 group-hover:text-indigo-600" />
                          </span>
                          {p.make && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/80">
                              Make: {p.make}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="text-sm font-bold text-emerald-700">
                          ₹{Number(p.price).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => removeSelectedProduct(p.product_id)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                          title="Remove from selected list"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Total Price Summary Box */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-row items-center justify-between gap-4">
              <div className="text-xs text-slate-600">
                Customer: <strong className="text-slate-900">{selectedCustomer ? selectedCustomer.customer_name : ''}</strong> ({selectedProducts.length} items)
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Total Value:</span>
                <span className="text-xl font-bold text-emerald-700 tracking-tight">
                  ₹{totalSelectedSum.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Price Revision History Right-Side Sliding Drawer */}
      <PriceHistoryDrawer
        open={!!historyProduct}
        onClose={() => setHistoryProduct(null)}
        product={historyProduct}
        customerName={selectedCustomer?.customer_name}
      />
    </div>
  );
}


