import React, { useState, useEffect, useMemo } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { api } from '../api';
import { SearchableCustomerSelect, SearchableProductSelect } from '../components/ui/SearchableSelect';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/Dialog';
import { PriceHistoryDrawer } from '../components/PriceHistoryDrawer';
import { 
  Table, User, Search, RefreshCw, AlertCircle, History, Calendar, 
  TrendingUp, TrendingDown, Check, ListFilter, Layers, Plus, CheckCircle2, PackagePlus, Pencil, X, FileText
} from 'lucide-react';

export function CustomerCatalog({ onNavigateToQuotation }) {
  const [customers, setCustomers] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  
  // In-memory cache for customer catalogs: { [cid]: customerProducts }
  const [catalogCache, setCatalogCache] = useState({});
  const [customerProducts, setCustomerProducts] = useState([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(false);
  const [error, setError] = useState('');

  // Table local client-side filter (default to 'priced')
  const [tableSearchQuery, setTableSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('priced'); // 'priced', 'unpriced'

  // Price History Modal state
  const [historyProduct, setHistoryProduct] = useState(null);

  // Inline Price Editing State
  const [editingProductId, setEditingProductId] = useState(null);
  const [inlinePriceInput, setInlinePriceInput] = useState('');
  const [isSavingInline, setIsSavingInline] = useState(false);

  // Add Product Price Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addMode, setAddMode] = useState('existing'); // 'existing' or 'new'
  const [addSelectedProdId, setAddSelectedProdId] = useState('');
  const [addNewProdName, setAddNewProdName] = useState('');
  const [addNewProdMake, setAddNewProdMake] = useState('');
  const [addPrice, setAddPrice] = useState('');
  const [isSubmittingAdd, setIsSubmittingAdd] = useState(false);
  const [addMessage, setAddMessage] = useState(null);
  const [showProdSuggestions, setShowProdSuggestions] = useState(false);

  const startInlineEdit = (product) => {
    setEditingProductId(product.product_id);
    const currentPrice = isProductPriced(product) ? String(product.price) : '';
    setInlinePriceInput(currentPrice);
  };

  const cancelInlineEdit = () => {
    setEditingProductId(null);
    setInlinePriceInput('');
  };

  const saveInlineEdit = async (product) => {
    const numericPrice = parseFloat(inlinePriceInput);
    if (isNaN(numericPrice) || numericPrice <= 0) {
      return;
    }

    setIsSavingInline(true);
    try {
      await api.upsertPricing({
        customer_id: selectedCustomerId,
        product_id: product.product_id,
        price: numericPrice
      });

      const todayStr = new Date().toISOString().split('T')[0];
      const oldPrice = isProductPriced(product) ? Number(product.price) : null;
      const oldDate = product.last_updated ? product.last_updated.split('T')[0].split(' ')[0] : todayStr;
      const oldHistory = product.price_history || '';

      let newHistory = oldHistory;
      if (oldPrice !== null && oldPrice !== numericPrice) {
        const formattedOldPrice = `₹${oldPrice.toFixed(2)}`;
        const newEntry = `${formattedOldPrice} (${oldDate})`;
        newHistory = oldHistory ? `${newEntry}, ${oldHistory}` : newEntry;
      }

      setCatalogCache(prevCache => {
        const currentCustCatalog = prevCache[selectedCustomerId] || [];
        const newCatalog = currentCustCatalog.map(item => {
          if (item.product_id.toUpperCase() === product.product_id.toUpperCase()) {
            return {
              ...item,
              price: numericPrice,
              customer_price: numericPrice,
              previous_price: oldPrice,
              last_updated: todayStr,
              price_history: newHistory,
              is_configured: true
            };
          }
          return item;
        });

        setCustomerProducts(newCatalog);
        return { ...prevCache, [selectedCustomerId]: newCatalog };
      });

      setEditingProductId(null);
      setInlinePriceInput('');
    } catch (err) {
      console.error('Failed to update inline price:', err);
    } finally {
      setIsSavingInline(false);
    }
  };

  const generateUniqueProdId = (productList) => {
    if (!Array.isArray(productList) || productList.length === 0) {
      return 'PROD-101';
    }
    const maxNum = productList.reduce((acc, p) => {
      const match = (p.product_id || '').match(/\d+/);
      return match ? Math.max(acc, parseInt(match[0], 10)) : acc;
    }, 100);
    return `PROD-${maxNum + 1}`;
  };

  const normalizeProductName = (name) => {
    return (name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  };

  const matchingSuggestions = useMemo(() => {
    if (!addNewProdName || addNewProdName.trim().length < 2) return [];
    const inputNorm = normalizeProductName(addNewProdName);
    if (!inputNorm) return [];

    return allProducts.filter(p => {
      const pNorm = normalizeProductName(p.standard_name);
      return pNorm.includes(inputNorm) || inputNorm.includes(pNorm);
    }).slice(0, 5);
  }, [addNewProdName, allProducts]);

  const handleSelectExistingProd = (prodId) => {
    setAddSelectedProdId(prodId);
    const existing = customerProducts.find(p => p.product_id === prodId);
    if (existing && isProductPriced(existing)) {
      setAddPrice(String(existing.price));
    } else {
      setAddPrice('');
    }
  };

  const handleAddProductSubmit = async (e) => {
    e.preventDefault();
    setAddMessage(null);
    setShowProdSuggestions(false);

    if (!selectedCustomerId) {
      setAddMessage({ type: 'error', text: 'Please select a customer first' });
      return;
    }

    let targetProdId = '';
    let targetProdName = '';
    let targetMake = '';

    if (addMode === 'existing') {
      if (!addSelectedProdId) {
        setAddMessage({ type: 'error', text: 'Please select a product from the list' });
        return;
      }
      targetProdId = addSelectedProdId;
      const found = allProducts.find(p => p.product_id === targetProdId);
      targetProdName = found?.standard_name || targetProdId;
      targetMake = found?.make || '';
    } else {
      const name = addNewProdName.trim();
      if (!name) {
        setAddMessage({ type: 'error', text: 'Standard Product Name is required' });
        return;
      }
      targetProdName = name;
      targetMake = addNewProdMake.trim();
    }

    const numericPrice = parseFloat(addPrice);
    if (isNaN(numericPrice) || numericPrice <= 0) {
      setAddMessage({ type: 'error', text: 'Please enter a valid numeric customer price (greater than 0)' });
      return;
    }

    setIsSubmittingAdd(true);
    try {
      if (addMode === 'new') {
        const normName = normalizeProductName(targetProdName);
        const normMake = normalizeProductName(targetMake);

        // Check if exact product with same name and make already exists in catalog
        const existingExact = allProducts.find(p => 
          normalizeProductName(p.standard_name) === normName &&
          normalizeProductName(p.make) === normMake
        );

        if (existingExact) {
          targetProdId = existingExact.product_id;
        } else {
          const newPid = generateUniqueProdId(allProducts);
          await api.createProduct({
            product_id: newPid,
            standard_name: targetProdName,
            make: targetMake
          });
          targetProdId = newPid;
          const newProdObj = { product_id: newPid, standard_name: targetProdName, make: targetMake };
          setAllProducts(prev => [newProdObj, ...prev]);
        }
      }

      await api.upsertPricing({
        customer_id: selectedCustomerId,
        product_id: targetProdId,
        price: numericPrice
      });

      const todayStr = new Date().toISOString().split('T')[0];

      setCatalogCache(prevCache => {
        const currentCustCatalog = prevCache[selectedCustomerId] || [];
        let updated = false;

        const newCatalog = currentCustCatalog.map(item => {
          if (item.product_id.toUpperCase() === targetProdId.toUpperCase()) {
            updated = true;
            return {
              ...item,
              price: numericPrice,
              is_configured: true,
              last_updated: todayStr
            };
          }
          return item;
        });

        if (!updated) {
          newCatalog.unshift({
            product_id: targetProdId,
            standard_name: targetProdName,
            make: targetMake,
            customer_id: selectedCustomerId,
            customer_name: selectedCustomer?.customer_name || selectedCustomerId,
            price: numericPrice,
            previous_price: null,
            last_updated: todayStr,
            price_history: '',
            is_configured: true
          });
        }

        setCustomerProducts(newCatalog);
        return { ...prevCache, [selectedCustomerId]: newCatalog };
      });

      setShowProdSuggestions(false);
      setAddMessage({ type: 'success', text: `Price for "${targetProdName}" saved successfully!` });
      
      setTimeout(() => {
        setIsAddModalOpen(false);
        setAddNewProdName('');
        setAddNewProdMake('');
        setAddPrice('');
        setAddMessage(null);
        setShowProdSuggestions(false);
      }, 1000);

    } catch (err) {
      console.error('Failed to add product price:', err);
      setAddMessage({ type: 'error', text: err.message || 'Failed to save product price' });
    } finally {
      setIsSubmittingAdd(false);
    }
  };

  const normalizeCustomer = (c) => {
    let gstin = String(c.gstin || c.GSTIN || c['GSTIN'] || c.Gstin || c.GstIn || '').trim();
    if (!gstin) {
      const contactVal = String(c.contact_person || c.contact || c['Contact Person'] || '').trim();
      if (contactVal && !contactVal.includes('@') && !contactVal.startsWith('+')) {
        gstin = contactVal;
      }
    }
    return {
      customer_id: String(c.customer_id || c['Customer ID'] || '').trim(),
      customer_name: String(c.customer_name || c['Customer Name'] || '').trim(),
      gstin: gstin
    };
  };

  const normalizeProduct = (p) => ({
    product_id: String(p.product_id || p['Product ID'] || ''),
    standard_name: String(p.standard_name || p['Standard Product Name'] || ''),
    make: String(p.make || p['Make'] || '')
  });

  const normalizePricing = (pr) => {
    const rawPrice = pr.customer_price !== undefined && pr.customer_price !== null 
      ? pr.customer_price 
      : (pr.price !== undefined && pr.price !== null ? pr.price : pr['Customer Price']);

    const rawPrev = pr.previous_price !== undefined && pr.previous_price !== null 
      ? pr.previous_price 
      : pr['Previous Price'];

    return {
      customer_id: String(pr.customer_id || pr['Customer ID'] || '').trim(),
      product_id: String(pr.product_id || pr['Product ID'] || '').trim(),
      customer_price: rawPrice,
      price: rawPrice,
      previous_price: rawPrev,
      last_updated: String(pr.last_updated || pr['Last Updated'] || '').trim(),
      price_history: String(pr.price_history || pr['Price History'] || '').trim()
    };
  };

  // Load all initial data (customers + products + pricing) at once on mount
  useEffect(() => {
    loadAllInitialData();
  }, []);

  const loadAllInitialData = async () => {
    setIsInitialLoading(true);
    setError('');
    try {
      let bulkData;
      try {
        bulkData = await api.getAllData();
      } catch (err) {
        console.warn('getAllData failed or not available, falling back to individual calls:', err);
      }

      let custData = bulkData?.customers;
      let prodData = bulkData?.products;
      let pricingData = bulkData?.pricing;

      if (!custData || !prodData || !pricingData) {
        const [cRes, pRes, prRes] = await Promise.all([
          custData ? Promise.resolve(custData) : api.getCustomers(),
          prodData ? Promise.resolve(prodData) : api.getProducts(),
          pricingData ? Promise.resolve(pricingData) : api.getAllPricing().catch(() => [])
        ]);
        custData = cRes;
        prodData = pRes;
        pricingData = prRes;
      }

      const safeCust = Array.isArray(custData) ? custData.map(normalizeCustomer) : [];
      const safeProd = Array.isArray(prodData) ? prodData.map(normalizeProduct) : [];
      const safePricing = Array.isArray(pricingData) ? pricingData.map(normalizePricing) : [];

      setCustomers(safeCust);
      setAllProducts(safeProd);

      // Map pricing entries: { [customer_id_upper]: { [product_id_upper]: pricingRecord } }
      const pricingMap = {};
      safePricing.forEach(pr => {
        if (!pr.customer_id) return;
        const cidKey = String(pr.customer_id).trim().toUpperCase();
        const pidKey = String(pr.product_id).trim().toUpperCase();
        if (!pricingMap[cidKey]) {
          pricingMap[cidKey] = {};
        }
        pricingMap[cidKey][pidKey] = pr;
      });

      // Pre-compute full product catalog for ALL customers in browser memory
      const newCache = {};
      safeCust.forEach(cust => {
        const cid = cust.customer_id;
        const cidKey = String(cid).trim().toUpperCase();
        const custName = cust.customer_name || cid;
        const custPricingMap = pricingMap[cidKey] || {};

        newCache[cid] = safeProd.map(prod => {
          const pidKey = String(prod.product_id).trim().toUpperCase();
          const pr = custPricingMap[pidKey];
          
          const rawPrice = pr ? (pr.customer_price !== undefined ? pr.customer_price : pr.price) : null;
          const cleanStr = rawPrice !== null && rawPrice !== undefined && rawPrice !== '' ? String(rawPrice).replace(/[^0-9\.]/g, '') : '';
          const numericPrice = cleanStr ? parseFloat(cleanStr) : NaN;
          const isPriced = !isNaN(numericPrice) && numericPrice > 0;

          return {
            product_id: prod.product_id,
            standard_name: prod.standard_name,
            make: prod.make,
            customer_id: cid,
            customer_name: custName,
            price: isPriced ? numericPrice : null,
            previous_price: pr ? pr.previous_price : null,
            last_updated: pr ? pr.last_updated : '',
            price_history: pr ? pr.price_history : '',
            is_configured: isPriced
          };
        });
      });

      setCatalogCache(newCache);

      let targetCid = selectedCustomerId;
      if (!targetCid || !safeCust.some(c => c.customer_id === targetCid)) {
        if (safeCust.length > 0) {
          targetCid = safeCust[0].customer_id;
          setSelectedCustomerId(targetCid);
        }
      }

      if (targetCid && newCache[targetCid]) {
        setCustomerProducts(newCache[targetCid]);
      }
    } catch (err) {
      console.error('Failed to load initial catalog data:', err);
      setError('Failed to fetch data from backend');
    } finally {
      setIsInitialLoading(false);
    }
  };

  // Switch catalog instantly when selected customer changes (0ms delay)
  useEffect(() => {
    if (selectedCustomerId && !isInitialLoading) {
      if (catalogCache[selectedCustomerId]) {
        setCustomerProducts(catalogCache[selectedCustomerId]);
      } else {
        fetchCatalogForCustomer(selectedCustomerId, customers, allProducts, catalogCache);
      }
    }
  }, [selectedCustomerId, catalogCache]);

  const fetchCatalogForCustomer = async (cid, custArr, prodArr, cacheObj) => {
    setIsLoadingCatalog(true);
    setError('');
    const targetCust = (custArr || customers).find(c => c && c.customer_id === cid);
    const custName = targetCust?.customer_name || cid;

    try {
      let res = await api.lookupPrices(cid, '');
      let safeRes = Array.isArray(res) ? res : [];

      if (safeRes.length === 0 && (prodArr || allProducts).length > 0) {
        safeRes = (prodArr || allProducts).map(prod => ({
          product_id: prod.product_id,
          standard_name: prod.standard_name,
          make: prod.make,
          customer_id: cid,
          customer_name: custName,
          price: null,
          previous_price: null,
          last_updated: '',
          price_history: '',
          is_configured: false
        }));
      }

      setCustomerProducts(safeRes);
      setCatalogCache(prev => ({ ...prev, ...cacheObj, [cid]: safeRes }));
    } catch (err) {
      console.error('Failed to load customer catalog:', err);
      const fallbackList = (prodArr || allProducts).map(prod => ({
        product_id: prod.product_id,
        standard_name: prod.standard_name,
        make: prod.make,
        customer_id: cid,
        customer_name: custName,
        price: null,
        previous_price: null,
        last_updated: '',
        price_history: '',
        is_configured: false
      }));
      setCustomerProducts(fallbackList);
      setCatalogCache(prev => ({ ...prev, ...cacheObj, [cid]: fallbackList }));
    } finally {
      setIsLoadingCatalog(false);
    }
  };

  const selectedCustomer = (customers || []).find(c => c && c.customer_id === selectedCustomerId);

  const isProductPriced = (p) => {
    if (!p) return false;
    if (p.is_configured === true) return true;
    if (p.price === null || p.price === undefined || p.price === '' || p.price === 'null') return false;
    const cleanStr = String(p.price).replace(/[^0-9\.]/g, '');
    if (!cleanStr) return false;
    const val = parseFloat(cleanStr);
    return !isNaN(val) && val > 0;
  };

  // Instant client-side search filtering on the preloaded table data
  const filteredProducts = useMemo(() => {
    let list = customerProducts;

    // Apply Status Filter ('priced' or 'unpriced')
    if (statusFilter === 'priced') {
      list = list.filter(p => isProductPriced(p));
    } else if (statusFilter === 'unpriced') {
      list = list.filter(p => !isProductPriced(p));
    }

    if (!tableSearchQuery.trim()) return list;
    const q = tableSearchQuery.toLowerCase().trim();

    return list.filter(p => {
      const name = (p.standard_name || '').toLowerCase();
      const make = (p.make || '').toLowerCase();
      const pid = (p.product_id || '').toLowerCase();
      const priceStr = isProductPriced(p) ? String(p.price) : 'price not set';
      return name.includes(q) || make.includes(q) || pid.includes(q) || priceStr.includes(q);
    });
  }, [customerProducts, tableSearchQuery, statusFilter]);

  // Parse price history entries
  const parseHistoryList = (product) => {
    if (!product) return [];
    const list = [];
    if (isProductPriced(product)) {
      list.push({
        price: Number(String(product.price).replace(/[^0-9\.]/g, '')),
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
        price: Number(String(product.previous_price).replace(/[^0-9\.]/g, '')),
        date: product.last_updated || 'Previous Price',
        isCurrent: false
      });
    }

    return list;
  };

  const configuredCount = useMemo(() => {
    return customerProducts.filter(p => isProductPriced(p)).length;
  }, [customerProducts]);

  const totalCatalogValue = useMemo(() => {
    return customerProducts.reduce((acc, p) => {
      if (!isProductPriced(p)) return acc;
      const val = parseFloat(String(p.price).replace(/[^0-9\.]/g, ''));
      return acc + (isNaN(val) ? 0 : val);
    }, 0);
  }, [customerProducts]);

  return (
    <div className="space-y-6 pb-16">
      {/* Top Banner Card */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-6 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Table className="w-6 h-6 text-indigo-600 shrink-0" />
              Customer Price Catalog
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Select a customer to view their product price list. Filter by Priced or Unpriced items, or click any product name to view price history.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
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
              onClick={() => {
                setAddSelectedProdId('');
                setAddNewProdName('');
                setAddNewProdMake('');
                setAddPrice('');
                setAddMessage(null);
                setIsAddModalOpen(true);
              }}
              disabled={!selectedCustomerId}
              title="Add / Set Product Price"
              className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-xs disabled:opacity-50 cursor-pointer flex items-center justify-center"
            >
              <Plus className="w-4 h-4" />
            </button>

            <button
              onClick={loadAllInitialData}
              disabled={isInitialLoading || isLoadingCatalog}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-600 hover:text-slate-900 hover:bg-slate-100 text-xs transition-all font-semibold disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isInitialLoading || isLoadingCatalog ? 'animate-spin text-indigo-600' : ''}`} />
              Refresh All Data
            </button>
          </div>
        </div>

        {/* Customer Select Dropdown & Instant In-Memory Search */}
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
              onValueChange={setSelectedCustomerId}
              placeholder="Search & select customer..."
              isLoading={isInitialLoading}
            />
          </div>

          {/* Instant Table Search Input */}
          <div className="md:col-span-7 space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <ListFilter className="w-3.5 h-3.5 text-emerald-600" />
                Instant Search (Product Name, Make, Price)
              </span>
              {tableSearchQuery && (
                <span className="text-[11px] text-indigo-600 font-semibold">
                  Showing {filteredProducts.length} items
                </span>
              )}
            </label>
            <div className="relative">
              <input
                type="text"
                value={tableSearchQuery}
                onChange={(e) => setTableSearchQuery(e.target.value)}
                placeholder="Search product name, make or price in memory..."
                className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-10 py-2 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-all font-medium"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              {tableSearchQuery && (
                <button
                  onClick={() => setTableSearchQuery('')}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-700 bg-slate-200 p-0.5 rounded-full"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Main Catalog Products Table */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
              Catalog Products ({filteredProducts.length})
            </h2>
            <p className="text-xs text-slate-500">Click any product name to view price revision history</p>
          </div>

          {/* Priced vs Unpriced Filter Pills */}
          <div className="flex items-center gap-1.5 self-start sm:self-auto bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
            <button
              onClick={() => setStatusFilter('priced')}
              className={`px-3.5 py-1 rounded-lg transition-all cursor-pointer ${
                statusFilter === 'priced' ? 'bg-white text-emerald-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Priced ({configuredCount})
            </button>
            <button
              onClick={() => setStatusFilter('unpriced')}
              className={`px-3.5 py-1 rounded-lg transition-all cursor-pointer ${
                statusFilter === 'unpriced' ? 'bg-white text-amber-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Unpriced ({customerProducts.length - configuredCount})
            </button>
          </div>
        </div>

        {isLoadingCatalog || isInitialLoading ? (
          <div className="py-12 text-center border border-indigo-100 rounded-xl bg-indigo-50/40 space-y-3">
            <RefreshCw className="w-8 h-8 mx-auto animate-spin text-indigo-600" />
            <p className="text-sm font-bold text-indigo-900">Loading price catalog...</p>
            <p className="text-xs text-indigo-600/80 font-medium">Fetching complete product price dataset for instant lookup</p>
          </div>
        ) : customerProducts.length === 0 ? (
          <div className="py-12 text-center text-slate-400 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
            <Table className="w-8 h-8 mx-auto mb-2 text-slate-400 opacity-60" />
            <p className="text-sm font-medium text-slate-500">No products found in system for {selectedCustomer?.customer_name || 'this customer'}</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="py-8 text-center text-slate-400 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
            <Search className="w-6 h-6 mx-auto mb-2 text-slate-400 opacity-60" />
            <p className="text-xs text-slate-500">No {statusFilter} products match search query "{tableSearchQuery}"</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200/80">
            <table className="w-full text-left text-xs border-collapse min-w-[500px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                  <th className="py-3.5 px-5">Standard Product Name</th>
                  <th className="py-3.5 px-5 w-48 text-right">Customer Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredProducts.map((product) => (
                  <tr key={product.product_id} className="hover:bg-indigo-50/40 transition-colors">
                    {/* Standard Product Name & Make */}
                    <td className="py-3.5 px-5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span 
                          onClick={() => setHistoryProduct(product)}
                          className="font-bold text-slate-900 text-xs sm:text-sm hover:text-indigo-600 hover:underline cursor-pointer flex items-center gap-1.5 group"
                          title="Click product name to view full price revision history"
                        >
                          {product.standard_name}
                          <History className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 transition-colors shrink-0" />
                        </span>
                        {product.make && (
                          <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/80">
                            Make: {product.make}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Customer Price Column with Inline Editing */}
                    <td className="py-3.5 px-5 text-right font-bold text-sm sm:text-base text-emerald-700 tracking-tight font-mono">
                      {editingProductId === product.product_id ? (
                        <div className="flex items-center justify-end gap-1.5 font-sans" onClick={(e) => e.stopPropagation()}>
                          <div className="relative w-28">
                            <span className="absolute left-2.5 top-2 text-xs text-slate-400 font-mono">₹</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              autoFocus
                              disabled={isSavingInline}
                              value={inlinePriceInput}
                              onChange={(e) => setInlinePriceInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  saveInlineEdit(product);
                                } else if (e.key === 'Escape') {
                                  cancelInlineEdit();
                                }
                              }}
                              placeholder="0.00"
                              className="w-full h-8 bg-white border border-indigo-400 rounded-lg pl-6 pr-2 py-1 text-xs font-bold font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs"
                            />
                          </div>

                          <button
                            type="button"
                            disabled={isSavingInline || !inlinePriceInput || parseFloat(inlinePriceInput) <= 0}
                            onClick={() => saveInlineEdit(product)}
                            title="Save price inline (Enter)"
                            className="w-8 h-8 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center transition-colors disabled:opacity-40 shadow-2xs cursor-pointer shrink-0"
                          >
                            {isSavingInline ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Check className="w-4 h-4" />
                            )}
                          </button>

                          <button
                            type="button"
                            disabled={isSavingInline}
                            onClick={cancelInlineEdit}
                            title="Cancel inline editing (Esc)"
                            className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors shadow-2xs cursor-pointer shrink-0"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="group flex items-center justify-end gap-2 font-mono">
                          {isProductPriced(product) ? (
                            <span 
                              onClick={() => startInlineEdit(product)}
                              className="cursor-pointer hover:text-indigo-600 transition-colors flex items-center gap-1.5"
                              title="Click to edit price inline"
                            >
                              ₹{Number(String(product.price).replace(/[^0-9\.]/g, '')).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              <Pencil className="w-3.5 h-3.5 text-slate-300 opacity-0 group-hover:opacity-100 group-hover:text-indigo-600 transition-all shrink-0" />
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => startInlineEdit(product)}
                              className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 inline-flex items-center gap-1 font-sans transition-all cursor-pointer shadow-2xs"
                              title="Click to set price inline for this product"
                            >
                              <Plus className="w-3 h-3" />
                              Set Price
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detailed Price Revision History Right-Side Sliding Drawer */}
      <PriceHistoryDrawer
        open={!!historyProduct}
        onClose={() => setHistoryProduct(null)}
        product={historyProduct}
        customerName={selectedCustomer?.customer_name}
      />

      {/* Add / Set Product Price Right-Side Sliding Drawer */}
      <DialogPrimitive.Root open={isAddModalOpen} onOpenChange={setIsAddModalOpen} modal={false}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Content
            className="fixed top-0 right-0 bottom-0 z-50 h-full w-full sm:w-[480px] max-w-[90vw] bg-white shadow-2xl border-l border-slate-200 flex flex-col justify-between overflow-hidden duration-300 ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right"
          >
            {/* Header */}
            <div className="p-5 border-b border-slate-200 bg-slate-50/80 flex items-start justify-between shrink-0">
              <div className="space-y-1 pr-6">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                    <PackagePlus className="w-4 h-4" />
                  </div>
                  <div>
                    <DialogPrimitive.Title className="text-base font-bold text-slate-900 leading-tight">
                      Add / Set Product Price
                    </DialogPrimitive.Title>
                    <DialogPrimitive.Description className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                      <User className="w-3 h-3 text-slate-400" />
                      <span className="font-semibold text-slate-700">{selectedCustomer?.customer_name}</span>
                      {selectedCustomerId && <span className="text-[10px] text-slate-400 font-mono">({selectedCustomerId})</span>}
                    </DialogPrimitive.Description>
                  </div>
                </div>
              </div>
              <DialogPrimitive.Close className="rounded-lg p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-all focus:outline-none cursor-pointer">
                <X className="w-5 h-5" />
              </DialogPrimitive.Close>
            </div>

            {/* Scrollable Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {addMessage && (
                <div className={`p-3 rounded-xl text-xs flex items-center gap-2 border ${
                  addMessage.type === 'success' 
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800 font-semibold' 
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}>
                  {addMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                  {addMessage.text}
                </div>
              )}

              <form id="add-product-catalog-form" onSubmit={handleAddProductSubmit} className="space-y-4">
                {/* Mode Switcher: Existing vs New Product */}
                <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => { setAddMode('existing'); setAddMessage(null); }}
                    className={`flex-1 py-2 rounded-lg transition-all ${
                      addMode === 'existing' ? 'bg-white text-indigo-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Select Existing Product
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAddMode('new'); setAddMessage(null); }}
                    className={`flex-1 py-2 rounded-lg transition-all ${
                      addMode === 'new' ? 'bg-white text-indigo-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    + Create New Product
                  </button>
                </div>

                {addMode === 'existing' ? (
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Select Product</label>
                    <SearchableProductSelect
                      products={allProducts}
                      value={addSelectedProdId}
                      onValueChange={handleSelectExistingProd}
                      placeholder="Search existing product by name or make..."
                    />
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="space-y-1.5 relative">
                      <label className="text-xs font-semibold text-slate-800">Standard Product Name *</label>
                      <input
                        type="text"
                        value={addNewProdName}
                        onChange={(e) => {
                          setAddNewProdName(e.target.value);
                          setShowProdSuggestions(true);
                        }}
                        onFocus={() => setShowProdSuggestions(true)}
                        placeholder="e.g. Cable Gland, Screwdriver"
                        className="w-full h-10 bg-slate-50 border border-slate-300 text-slate-900 placeholder:text-slate-400 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white transition-all"
                      />

                      {/* Standard Product Name Auto-Suggestions Dropdown */}
                      {showProdSuggestions && !isSubmittingAdd && !addMessage && matchingSuggestions.length > 0 && (
                        <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg p-2 space-y-1">
                          <div className="text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-1 rounded">
                            Existing matching products found:
                          </div>
                          {matchingSuggestions.map(p => (
                            <div
                              key={p.product_id}
                              onClick={() => {
                                setAddMode('existing');
                                handleSelectExistingProd(p.product_id);
                                setShowProdSuggestions(false);
                              }}
                              className="px-3 py-1.5 rounded-lg text-xs hover:bg-indigo-50 cursor-pointer flex justify-between items-center"
                            >
                              <span className="font-semibold text-slate-900">{p.standard_name}</span>
                              {p.make && <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{p.make}</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-800">Make / Brand (Optional)</label>
                      <input
                        type="text"
                        value={addNewProdMake}
                        onChange={(e) => setAddNewProdMake(e.target.value)}
                        placeholder="e.g. Dowells, Siemens"
                        className="w-full h-10 bg-slate-50 border border-slate-300 text-slate-900 placeholder:text-slate-400 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white transition-all"
                      />
                    </div>
                  </div>
                )}

                {/* Price Input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-800">Customer Price (₹) *</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={addPrice}
                      onChange={(e) => setAddPrice(e.target.value)}
                      placeholder="e.g. 42.50"
                      className="w-full h-11 bg-slate-50 border border-slate-300 text-slate-900 placeholder:text-slate-400 rounded-xl pl-8 pr-3 py-2 text-sm font-bold font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white transition-all"
                    />
                    <span className="absolute left-3 top-3 text-slate-500 font-mono text-sm font-bold">₹</span>
                  </div>
                </div>
              </form>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50/80 flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="add-product-catalog-form"
                disabled={isSubmittingAdd}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
              >
                {isSubmittingAdd ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save & Update Catalog'
                )}
              </button>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </div>
  );
}
