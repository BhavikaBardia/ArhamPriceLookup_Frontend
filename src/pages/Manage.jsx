import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../api';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/Tabs';
import { SearchableCustomerSelect, SearchableProductSelect } from '../components/ui/SearchableSelect';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/Dialog';
import { PriceHistoryDrawer } from '../components/PriceHistoryDrawer';
import {
  PackagePlus, DollarSign, CheckCircle2, AlertCircle, RefreshCw,
  Tag, User, Table, Database, Sparkles, Building2, History, Calendar,
  TrendingUp, TrendingDown, Info, Pencil, Trash2, Search, Filter, Layers,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, UserPlus, Users, FileText
} from 'lucide-react';

export function Manage({ prefillCustomer, prefillProduct, mode = 'product', initialTab = 'pricing' }) {
  const [activeTab, setActiveTab] = useState(mode === 'product' ? 'product' : 'pricing');

  useEffect(() => {
    if (mode === 'product') {
      setActiveTab('product');
    } else {
      setActiveTab(initialTab === 'product' ? 'pricing' : initialTab);
    }
  }, [mode, initialTab]);

  // Data for selectors
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [isLoadingData, setIsLoadingData] = useState(false);

  // Customer specific prices for history lookup
  const [customerPrices, setCustomerPrices] = useState([]);
  const [isCustomerPricesLoading, setIsCustomerPricesLoading] = useState(false);

  // History Dialog Modal State
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // Form State: Add Product
  const [prodId, setProdId] = useState('');
  const [prodName, setProdName] = useState('');
  const [prodMake, setProdMake] = useState('');
  const [isSubmittingProd, setIsSubmittingProd] = useState(false);
  const [prodMessage, setProdMessage] = useState(null);
  const [showProdSuggestions, setShowProdSuggestions] = useState(false);

  // Product Catalog Table State: Search, Filter & Pagination (50 max per page)
  const PROD_PER_PAGE = 50;
  const [prodTableQuery, setProdTableQuery] = useState('');
  const [prodMakeFilter, setProdMakeFilter] = useState('all'); // 'all', 'with_make', 'without_make'
  const [prodCurrentPage, setProdCurrentPage] = useState(1);

  // CRUD Edit Product Modal State
  const [editingProduct, setEditingProduct] = useState(null);
  const [editName, setEditName] = useState('');
  const [editMake, setEditMake] = useState('');
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  const [editMessage, setEditMessage] = useState(null);

  // CRUD Delete Product Modal State
  const [deletingProduct, setDeletingProduct] = useState(null);
  const [isSubmittingDelete, setIsSubmittingDelete] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState(null);

  // Form State: Add Customer
  const [custId, setCustId] = useState('');
  const [custName, setCustName] = useState('');
  const [custGstin, setCustGstin] = useState('');
  const [isSubmittingCust, setIsSubmittingCust] = useState(false);
  const [custMessage, setCustMessage] = useState(null);

  // Customer Catalog Table State: Search, Filter & Pagination (50 max per page)
  const CUST_PER_PAGE = 50;
  const [custTableQuery, setCustTableQuery] = useState('');
  const [custGstinFilter, setCustGstinFilter] = useState('all'); // 'all', 'with_gstin', 'without_gstin'
  const [custCurrentPage, setCustCurrentPage] = useState(1);

  // CRUD Edit Customer Modal State
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [editCustName, setEditCustName] = useState('');
  const [editCustGstin, setEditCustGstin] = useState('');
  const [isSubmittingEditCust, setIsSubmittingEditCust] = useState(false);
  const [editCustMessage, setEditCustMessage] = useState(null);

  // CRUD Delete Customer Modal State
  const [deletingCustomer, setDeletingCustomer] = useState(null);
  const [isSubmittingDeleteCust, setIsSubmittingDeleteCust] = useState(false);
  const [deleteCustMessage, setDeleteCustMessage] = useState(null);

  // Form State: Add/Update Price
  const [priceCustomerId, setPriceCustomerId] = useState(prefillCustomer || '');
  const [priceProductId, setPriceProductId] = useState(prefillProduct || '');
  const [priceAmount, setPriceAmount] = useState('');
  const [isSubmittingPrice, setIsSubmittingPrice] = useState(false);
  const [priceMessage, setPriceMessage] = useState(null);

  // Helper: Normalize product string for typo/space-insensitive matching
  const normalizeProductName = (name) => {
    return (name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  };

  // Auto-generate next unique Product ID
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

  // Auto-generate next unique Customer ID
  const generateUniqueCustId = (customerList) => {
    if (!Array.isArray(customerList) || customerList.length === 0) {
      return 'CUST-101';
    }
    const maxNum = customerList.reduce((acc, c) => {
      const match = (c.customer_id || '').match(/\d+/);
      return match ? Math.max(acc, parseInt(match[0], 10)) : acc;
    }, 100);
    return `CUST-${maxNum + 1}`;
  };

  // Compute matching products as user types in Standard Product Name field
  const matchingSuggestions = useMemo(() => {
    if (!prodName || prodName.trim().length < 2) return [];
    const inputNorm = normalizeProductName(prodName);
    if (!inputNorm) return [];

    return products.filter(p => {
      const pNorm = normalizeProductName(p.standard_name);
      return pNorm.includes(inputNorm) || inputNorm.includes(pNorm);
    }).slice(0, 5);
  }, [prodName, products]);

  // Client-side search & filter for Catalog Products Table
  const filteredCatalogProducts = useMemo(() => {
    let list = products;

    if (prodMakeFilter === 'with_make') {
      list = list.filter(p => p.make && p.make.trim() !== '');
    } else if (prodMakeFilter === 'without_make') {
      list = list.filter(p => !p.make || p.make.trim() === '');
    }

    if (!prodTableQuery.trim()) return list;
    const q = prodTableQuery.toLowerCase().trim();

    return list.filter(p => {
      const pid = (p.product_id || '').toLowerCase();
      const name = (p.standard_name || '').toLowerCase();
      const make = (p.make || '').toLowerCase();
      return pid.includes(q) || name.includes(q) || make.includes(q);
    });
  }, [products, prodTableQuery, prodMakeFilter]);

  // Reset to page 1 whenever search query or make filter changes
  useEffect(() => {
    setProdCurrentPage(1);
  }, [prodTableQuery, prodMakeFilter]);

  // Pagination calculation (max 50 products per page)
  const totalProdPages = Math.max(1, Math.ceil(filteredCatalogProducts.length / PROD_PER_PAGE));

  const paginatedCatalogProducts = useMemo(() => {
    const startIdx = (prodCurrentPage - 1) * PROD_PER_PAGE;
    return filteredCatalogProducts.slice(startIdx, startIdx + PROD_PER_PAGE);
  }, [filteredCatalogProducts, prodCurrentPage]);

  // Client-side search & filter for Catalog Customers Table
  const filteredCatalogCustomers = useMemo(() => {
    let list = customers;

    if (custGstinFilter === 'with_gstin') {
      list = list.filter(c => c.gstin && c.gstin.trim() !== '');
    } else if (custGstinFilter === 'without_gstin') {
      list = list.filter(c => !c.gstin || c.gstin.trim() === '');
    }

    if (!custTableQuery.trim()) return list;
    const q = custTableQuery.toLowerCase().trim();

    return list.filter(c => {
      const cid = (c.customer_id || '').toLowerCase();
      const name = (c.customer_name || '').toLowerCase();
      const gstin = (c.gstin || '').toLowerCase();
      return cid.includes(q) || name.includes(q) || gstin.includes(q);
    });
  }, [customers, custTableQuery, custGstinFilter]);

  // Reset to page 1 whenever search query or gstin filter changes
  useEffect(() => {
    setCustCurrentPage(1);
  }, [custTableQuery, custGstinFilter]);

  // Pagination calculation (max 50 customers per page)
  const totalCustPages = Math.max(1, Math.ceil(filteredCatalogCustomers.length / CUST_PER_PAGE));

  const paginatedCatalogCustomers = useMemo(() => {
    const startIdx = (custCurrentPage - 1) * CUST_PER_PAGE;
    return filteredCatalogCustomers.slice(startIdx, startIdx + CUST_PER_PAGE);
  }, [filteredCatalogCustomers, custCurrentPage]);

  useEffect(() => {
    loadAllData();
  }, []);

  // Automatically reload when anything is saved to Google Sheets from anywhere in the app
  useEffect(() => {
    const handleGSheetSaved = () => {
      console.log('[Manage] Google Sheets updated. Auto-reloading data...');
      loadAllData(true);
    };
    window.addEventListener('arham_gsheet_saved', handleGSheetSaved);
    return () => window.removeEventListener('arham_gsheet_saved', handleGSheetSaved);
  }, []);

  useEffect(() => {
    if (prefillCustomer) setPriceCustomerId(prefillCustomer);
    if (prefillProduct) setPriceProductId(prefillProduct);
  }, [prefillCustomer, prefillProduct]);

  // Load prices for selected customer to show history
  useEffect(() => {
    if (priceCustomerId) {
      loadCustomerPrices(priceCustomerId);
    } else {
      setCustomerPrices([]);
    }
  }, [priceCustomerId]);

  const loadCustomerPrices = async (cid) => {
    setIsCustomerPricesLoading(true);
    try {
      const res = await api.lookupPrices(cid, '');
      setCustomerPrices(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error('Failed to load customer prices for history:', err);
      setCustomerPrices([]);
    } finally {
      setIsCustomerPricesLoading(false);
    }
  };

  const loadAllData = async (force = false) => {
    setIsLoadingData(true);
    try {
      const [cData, pData] = await Promise.all([
        api.getCustomers({ force }),
        api.getProducts({ force }),
      ]);
      const safeC = Array.isArray(cData) ? cData.map(c => {
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
      }) : [];
      const safeP = Array.isArray(pData) ? pData : [];
      setCustomers(safeC);
      setProducts(safeP);

      // Auto-assign new unique product ID and customer ID
      setProdId(generateUniqueProdId(safeP));
      setCustId(generateUniqueCustId(safeC));

      if (safeC.length > 0 && !priceCustomerId) setPriceCustomerId(safeC[0].customer_id);
      if (safeP.length > 0 && !priceProductId) setPriceProductId(safeP[0].product_id);
    } catch (err) {
      console.error('Failed to load data:', err);
      setCustomers([]);
      setProducts([]);
      setProdId('PROD-101');
    } finally {
      setIsLoadingData(false);
    }
  };

  // Find currently selected customer & product pricing record
  const selectedCustomer = (customers || []).find(c => c && c.customer_id === priceCustomerId);
  const selectedProduct = (products || []).find(p => p && p.product_id === priceProductId);
  const selectedPriceRecord = (customerPrices || []).find(p => p && p.product_id === priceProductId);

  // Parse history entries
  const parseHistoryList = (record) => {
    if (!record) return [];
    const list = [];
    if (record.price !== null && record.price !== undefined) {
      list.push({
        price: Number(record.price),
        date: record.last_updated || 'Current Active Price',
        isCurrent: true
      });
    }

    if (record.price_history && typeof record.price_history === 'string') {
      const entries = record.price_history.split(',').map(s => s.trim()).filter(Boolean);
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
    } else if (record.previous_price) {
      list.push({
        price: Number(record.previous_price),
        date: record.last_updated || 'Previous Price',
        isCurrent: false
      });
    }

    return list;
  };

  const historyEntries = parseHistoryList(selectedPriceRecord);

  // --- CRUD: CREATE PRODUCT ---
  const handleAddProduct = async (e) => {
    e.preventDefault();
    const finalId = prodId.trim() || generateUniqueProdId(products);

    if (!prodName.trim()) {
      setProdMessage({ type: 'error', text: 'Standard Product Name is required.' });
      return;
    }

    // Check if product with SAME normalized name AND SAME normalized make already exists
    const inputNormName = normalizeProductName(prodName);
    const inputNormMake = normalizeProductName(prodMake);

    const duplicateExact = products.find(p => {
      const exName = normalizeProductName(p.standard_name);
      const exMake = normalizeProductName(p.make);
      return exName === inputNormName && exMake === inputNormMake;
    });

    if (duplicateExact) {
      const makeMsg = prodMake.trim() ? ` with Make '${prodMake.trim()}'` : '';
      setProdMessage({
        type: 'error',
        text: `Product '${prodName}'${makeMsg} already exists in catalog [${duplicateExact.product_id}]. Standard Product Name + Make must be unique.`
      });
      return;
    }

    setIsSubmittingProd(true);
    setProdMessage(null);

    try {
      const res = await api.createProduct({
        product_id: finalId,
        standard_name: prodName.trim(),
        make: prodMake.trim()
      });

      if (res && res.error) {
        setProdMessage({ type: 'error', text: res.error });
        return;
      }

      setProdMessage({ type: 'success', text: `Product '${prodName}' (ID: ${finalId}) added successfully!` });
      setProdName('');
      setProdMake('');
      setShowProdSuggestions(false);

      // Reload products and update next product ID
      const updatedP = await api.getProducts();
      const safeP = Array.isArray(updatedP) ? updatedP : [];
      setProducts(safeP);
      setProdId(generateUniqueProdId(safeP));
    } catch (err) {
      const detail = err.response?.data?.detail || err.message || 'Failed to add product.';
      setProdMessage({ type: 'error', text: detail });
    } finally {
      setIsSubmittingProd(false);
    }
  };

  // --- CRUD: UPDATE PRODUCT ---
  const openEditModal = (prod) => {
    setEditingProduct(prod);
    setEditName(prod.standard_name || '');
    setEditMake(prod.make || '');
    setEditMessage(null);
  };

  const handleUpdateProduct = async (e) => {
    e.preventDefault();
    if (!editingProduct) return;

    if (!editName.trim()) {
      setEditMessage({ type: 'error', text: 'Standard Product Name is required.' });
      return;
    }

    const normName = normalizeProductName(editName);
    const normMake = normalizeProductName(editMake);

    // Check if another product already has the same normalized Name + Make
    const duplicate = products.find(p => {
      if (p.product_id === editingProduct.product_id) return false;
      const exName = normalizeProductName(p.standard_name);
      const exMake = normalizeProductName(p.make);
      return exName === normName && exMake === normMake;
    });

    if (duplicate) {
      const makeMsg = editMake.trim() ? ` with Make '${editMake.trim()}'` : '';
      setEditMessage({
        type: 'error',
        text: `Product '${editName}'${makeMsg} already exists in catalog [${duplicate.product_id}]. Standard Product Name + Make must be unique.`
      });
      return;
    }

    setIsSubmittingEdit(true);
    setEditMessage(null);

    try {
      const res = await api.updateProduct({
        product_id: editingProduct.product_id,
        standard_name: editName.trim(),
        make: editMake.trim()
      });

      if (res && res.error) {
        setEditMessage({ type: 'error', text: res.error });
        return;
      }

      setEditMessage({ type: 'success', text: 'Product updated successfully!' });
      setTimeout(() => {
        setEditingProduct(null);
        loadAllData();
      }, 800);
    } catch (err) {
      const detail = err.response?.data?.detail || err.message || 'Failed to update product.';
      setEditMessage({ type: 'error', text: detail });
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // --- CRUD: DELETE PRODUCT ---
  const openDeleteModal = (prod) => {
    setDeletingProduct(prod);
    setDeleteMessage(null);
  };

  const handleDeleteProduct = async () => {
    if (!deletingProduct) return;

    setIsSubmittingDelete(true);
    setDeleteMessage(null);

    try {
      const res = await api.deleteProduct(deletingProduct.product_id);
      if (res && res.error) {
        setDeleteMessage({ type: 'error', text: res.error });
        return;
      }

      setDeleteMessage({ type: 'success', text: `Product '${deletingProduct.standard_name}' deleted!` });
      setTimeout(() => {
        setDeletingProduct(null);
        loadAllData();
      }, 800);
    } catch (err) {
      const detail = err.response?.data?.detail || err.message || 'Failed to delete product.';
      setDeleteMessage({ type: 'error', text: detail });
    } finally {
      setIsSubmittingDelete(false);
    }
  };

  // --- CRUD: CREATE CUSTOMER ---
  const handleAddCustomer = async (e) => {
    e.preventDefault();
    const finalId = custId.trim() || generateUniqueCustId(customers);

    if (!custName.trim()) {
      setCustMessage({ type: 'error', text: 'Customer Name is required.' });
      return;
    }

    const inputNormName = normalizeProductName(custName);

    const duplicateExact = customers.find(c => {
      const exName = normalizeProductName(c.customer_name);
      return exName === inputNormName;
    });

    if (duplicateExact) {
      setCustMessage({
        type: 'error',
        text: `Customer '${custName}' already exists in database [${duplicateExact.customer_id}].`
      });
      return;
    }

    setIsSubmittingCust(true);
    setCustMessage(null);

    try {
      const res = await api.createCustomer({
        customer_id: finalId,
        customer_name: custName.trim(),
        gstin: custGstin.trim()
      });

      if (res && res.error) {
        setCustMessage({ type: 'error', text: res.error });
        return;
      }

      setCustMessage({ type: 'success', text: `Customer '${custName}' (ID: ${finalId}) added successfully!` });
      setCustName('');
      setCustGstin('');

      // Reload data and update next customer ID
      const updatedC = await api.getCustomers();
      const safeC = Array.isArray(updatedC) ? updatedC : [];
      setCustomers(safeC);
      setCustId(generateUniqueCustId(safeC));
    } catch (err) {
      const detail = err.response?.data?.detail || err.message || 'Failed to add customer.';
      setCustMessage({ type: 'error', text: detail });
    } finally {
      setIsSubmittingCust(false);
    }
  };

  // --- CRUD: UPDATE CUSTOMER ---
  const openEditCustomerModal = (cust) => {
    setEditingCustomer(cust);
    setEditCustName(cust.customer_name || '');
    setEditCustGstin(cust.gstin || '');
    setEditCustMessage(null);
  };

  const handleUpdateCustomer = async (e) => {
    e.preventDefault();
    if (!editingCustomer) return;

    if (!editCustName.trim()) {
      setEditCustMessage({ type: 'error', text: 'Customer Name is required.' });
      return;
    }

    const normName = normalizeProductName(editCustName);

    const duplicate = customers.find(c => {
      if (c.customer_id === editingCustomer.customer_id) return false;
      const exName = normalizeProductName(c.customer_name);
      return exName === normName;
    });

    if (duplicate) {
      setEditCustMessage({
        type: 'error',
        text: `Customer '${editCustName}' already exists in database [${duplicate.customer_id}].`
      });
      return;
    }

    setIsSubmittingEditCust(true);
    setEditCustMessage(null);

    try {
      const res = await api.updateCustomer({
        customer_id: editingCustomer.customer_id,
        customer_name: editCustName.trim(),
        gstin: editCustGstin.trim()
      });

      if (res && res.error) {
        setEditCustMessage({ type: 'error', text: res.error });
        return;
      }

      setEditCustMessage({ type: 'success', text: 'Customer updated successfully!' });
      setTimeout(() => {
        setEditingCustomer(null);
        loadAllData();
      }, 800);
    } catch (err) {
      const detail = err.response?.data?.detail || err.message || 'Failed to update customer.';
      setEditCustMessage({ type: 'error', text: detail });
    } finally {
      setIsSubmittingEditCust(false);
    }
  };

  // --- CRUD: DELETE CUSTOMER ---
  const openDeleteCustomerModal = (cust) => {
    setDeletingCustomer(cust);
    setDeleteCustMessage(null);
  };

  const handleDeleteCustomer = async () => {
    if (!deletingCustomer) return;

    setIsSubmittingDeleteCust(true);
    setDeleteCustMessage(null);

    try {
      const res = await api.deleteCustomer(deletingCustomer.customer_id);
      if (res && res.error) {
        setDeleteCustMessage({ type: 'error', text: res.error });
        return;
      }

      setDeleteCustMessage({ type: 'success', text: `Customer '${deletingCustomer.customer_name}' deleted!` });
      setTimeout(() => {
        setDeletingCustomer(null);
        loadAllData();
      }, 800);
    } catch (err) {
      const detail = err.response?.data?.detail || err.message || 'Failed to delete customer.';
      setDeleteCustMessage({ type: 'error', text: detail });
    } finally {
      setIsSubmittingDeleteCust(false);
    }
  };

  // --- UPSERT PRICING SUBMIT ---
  const handleUpsertPricing = async (e) => {
    e.preventDefault();
    if (!priceCustomerId || !priceProductId || priceAmount === '') {
      setPriceMessage({ type: 'error', text: 'Customer, Product, and Price are required.' });
      return;
    }

    const numericPrice = parseFloat(priceAmount);
    if (isNaN(numericPrice) || numericPrice < 0) {
      setPriceMessage({ type: 'error', text: 'Please enter a valid non-negative price amount.' });
      return;
    }

    setIsSubmittingPrice(true);
    setPriceMessage(null);

    try {
      const res = await api.upsertPricing({
        customer_id: priceCustomerId,
        product_id: priceProductId,
        price: numericPrice
      });

      if (res && res.error) {
        setPriceMessage({ type: 'error', text: res.error });
        return;
      }

      setPriceMessage({
        type: 'success',
        text: res.message || 'Customer price saved successfully!'
      });
      setPriceAmount('');
      loadAllData();
      if (priceCustomerId) loadCustomerPrices(priceCustomerId);
    } catch (err) {
      const detail = err.response?.data?.detail || err.message || 'Failed to save customer price.';
      setPriceMessage({ type: 'error', text: detail });
    } finally {
      setIsSubmittingPrice(false);
    }
  };

  const productsWithMakeCount = useMemo(() => {
    return products.filter(p => p.make && p.make.trim() !== '').length;
  }, [products]);

  const customersWithGstinCount = useMemo(() => {
    return customers.filter(c => c.gstin && c.gstin.trim() !== '').length;
  }, [customers]);

  return (
    <div className="space-y-4 sm:space-y-6 pb-12">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200/80 rounded-xl sm:rounded-2xl p-3.5 sm:p-6 shadow-xs sm:shadow-sm space-y-3 sm:space-y-4">
        <div className="flex items-start sm:items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-base sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-1.5 sm:gap-2">
              {mode === 'product' ? (
                <>
                  <PackagePlus className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-600 shrink-0" />
                  <span>Manage Products</span>
                </>
              ) : (
                <>
                  <Users className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-600 shrink-0" />
                  <span>Manage Customers & Pricing</span>
                </>
              )}
            </h1>
            <p className="text-[11px] sm:text-sm text-slate-500 mt-0.5 sm:mt-1 leading-snug">
              {mode === 'product'
                ? 'Full CRUD management for Products (Product ID, Standard Product Name, Make / Brand).'
                : 'Set customer specific pricing & manage customer records.'}
            </p>
          </div>

          <button
            onClick={() => loadAllData(true)}
            className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-lg sm:rounded-xl text-xs font-semibold bg-slate-100 text-slate-700 hover:text-slate-900 hover:bg-slate-200/80 border border-slate-200 transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingData ? 'animate-spin text-indigo-600' : ''}`} />
            <span className="hidden sm:inline">Refresh Data</span>
            <span className="sm:hidden">Refresh</span>
          </button>
        </div>

        {isLoadingData && (
          <div className="p-2.5 sm:p-3.5 rounded-lg sm:rounded-xl bg-indigo-50/70 border border-indigo-200/80 text-indigo-900 text-xs flex items-center gap-2.5 sm:gap-3 animate-pulse font-medium">
            <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin text-indigo-600 shrink-0" />
            <div className="text-[11px] sm:text-xs">
              <span className="font-bold text-indigo-950">Syncing catalog data...</span> Please wait while customer and product catalog records load.
            </div>
          </div>
        )}
      </div>

      {/* Main Container */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        {mode === 'customer' && (
          <TabsList className="w-full justify-start max-w-md h-auto p-1 bg-slate-100 rounded-xl">
            <TabsTrigger value="pricing" className="flex items-center justify-center gap-1.5 py-1.5 px-2.5 sm:py-2 sm:px-3 text-xs sm:text-sm font-semibold rounded-lg flex-1">
              <DollarSign className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>Set Customer Price</span>
            </TabsTrigger>
            <TabsTrigger value="customer" className="flex items-center justify-center gap-1.5 py-1.5 px-2.5 sm:py-2 sm:px-3 text-xs sm:text-sm font-semibold rounded-lg flex-1">
              <UserPlus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>Customers (CRUD)</span>
            </TabsTrigger>
          </TabsList>
        )}

        {/* Tab 1: Set / Update Customer Price */}
        <TabsContent value="pricing">
          <div className="bg-white border border-slate-200/80 rounded-xl sm:rounded-2xl p-3.5 sm:p-6 shadow-xs sm:shadow-sm space-y-4 sm:space-y-6">
            <div className="flex items-center gap-2 pb-3 sm:pb-4 border-b border-slate-100">
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600 shrink-0" />
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900">Add or Update Customer Price</h2>
                <p className="text-[11px] sm:text-xs text-slate-500">Updates existing prices automatically while keeping a log of previous costs.</p>
              </div>
            </div>

            {priceMessage && (
              <div className={`p-4 rounded-xl text-sm flex items-center gap-2 border ${priceMessage.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}>
                {priceMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                {priceMessage.text}
              </div>
            )}

            <form onSubmit={handleUpsertPricing} className="grid grid-cols-1 md:grid-cols-12 gap-6">
              {/* Select Customer */}
              <div className="md:col-span-6 space-y-2">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-indigo-600" />
                  Select Customer
                </label>
                <SearchableCustomerSelect
                  customers={customers}
                  value={priceCustomerId}
                  onValueChange={setPriceCustomerId}
                  placeholder="Choose or search customer..."
                  isLoading={isLoadingData}
                />
              </div>

              {/* Select Product */}
              <div className="md:col-span-6 space-y-2">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-indigo-600" />
                  Select Product
                </label>
                <SearchableProductSelect
                  products={products}
                  value={priceProductId}
                  onValueChange={setPriceProductId}
                  placeholder="Choose or search product..."
                  isLoading={isLoadingData}
                />
              </div>

              {/* Price History & Existing Pricing Card */}
              <div className="md:col-span-12">
                {isCustomerPricesLoading ? (
                  <div className="p-4 rounded-xl bg-indigo-50/40 border border-indigo-100 flex items-center gap-2 text-xs text-indigo-700">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                    Checking price history...
                  </div>
                ) : selectedPriceRecord ? (
                  <div className="p-4 rounded-xl bg-sky-50/60 border border-sky-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">Current Price for {selectedCustomer?.customer_name}:</span>
                        <span className="text-base font-bold text-emerald-700">
                          ₹{Number(selectedPriceRecord.price).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        {selectedPriceRecord.last_updated && (
                          <span className="text-[11px] text-slate-500 font-medium">({selectedPriceRecord.last_updated})</span>
                        )}
                      </div>
                      {selectedPriceRecord.previous_price && (
                        <div className="text-xs text-slate-600 flex items-center gap-2">
                          <span>Previous Price: <strong>₹{Number(selectedPriceRecord.previous_price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></span>
                        </div>
                      )}
                    </div>

                    {historyEntries.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowHistoryModal(true)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-xs shrink-0 self-start md:self-auto cursor-pointer"
                      >
                        <History className="w-3.5 h-3.5" />
                        View Full Revision History ({historyEntries.length})
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 text-xs flex items-center gap-2 font-medium">
                    <Info className="w-4 h-4 text-indigo-500 shrink-0" />
                    No price configured for this customer & product yet. Submitting below will set its initial price.
                  </div>
                )}
              </div>

              {/* Price Amount Input */}
              <div className="md:col-span-8 space-y-2">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                  New Customer Price (INR ₹)
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-3 text-slate-400 font-semibold text-sm">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={priceAmount}
                    onChange={(e) => setPriceAmount(e.target.value)}
                    placeholder="e.g. 12500.00"
                    className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400 transition-all font-semibold"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <div className="md:col-span-4 flex items-end">
                <button
                  type="submit"
                  disabled={isSubmittingPrice}
                  className="w-full h-11 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-xl px-4 flex items-center justify-center gap-2 shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isSubmittingPrice ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Save / Upsert Price
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </TabsContent>

        {/* Tab 2: Manage Products (CRUD) */}
        <TabsContent value="product" className="space-y-6">
          {/* Quick Metrics Bar for Products (Compact single row on mobile) */}
          <div className="grid grid-cols-3 gap-1.5 sm:gap-3">
            <div className="p-2 sm:p-4 rounded-xl sm:rounded-2xl bg-white border border-slate-200/80 shadow-2xs sm:shadow-xs flex flex-col sm:flex-row items-start sm:items-center gap-1.5 sm:gap-3 min-w-0">
              <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold shrink-0">
                <Layers className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] sm:text-xs text-slate-500 font-semibold truncate leading-tight">
                  <span className="sm:hidden">Total</span>
                  <span className="hidden sm:inline">Total Products</span>
                </div>
                <div className="text-sm sm:text-lg font-bold font-mono text-slate-900 mt-0.5 leading-tight truncate">
                  {products.length} <span className="text-[10px] sm:text-xs text-slate-500 font-normal hidden sm:inline">Catalog Items</span>
                </div>
              </div>
            </div>

            <div className="p-2 sm:p-4 rounded-xl sm:rounded-2xl bg-white border border-emerald-200/80 sm:border-slate-200/80 shadow-2xs sm:shadow-xs flex flex-col sm:flex-row items-start sm:items-center gap-1.5 sm:gap-3 min-w-0">
              <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shrink-0">
                <Building2 className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] sm:text-xs text-emerald-700 sm:text-slate-500 font-semibold truncate leading-tight">
                  <span className="sm:hidden">Branded</span>
                  <span className="hidden sm:inline">Products with Make / Brand</span>
                </div>
                <div className="text-sm sm:text-lg font-bold font-mono text-emerald-800 mt-0.5 leading-tight truncate">
                  {productsWithMakeCount} <span className="text-[10px] sm:text-xs text-emerald-600 font-normal hidden sm:inline">Branded Items</span>
                </div>
              </div>
            </div>

            <div className="p-2 sm:p-4 rounded-xl sm:rounded-2xl bg-white border border-slate-200/80 shadow-2xs sm:shadow-xs flex flex-col sm:flex-row items-start sm:items-center gap-1.5 sm:gap-3 min-w-0">
              <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-slate-200 text-slate-700 flex items-center justify-center font-bold shrink-0">
                <Tag className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] sm:text-xs text-slate-500 font-semibold truncate leading-tight">
                  <span className="sm:hidden">General</span>
                  <span className="hidden sm:inline">General Products (No Make)</span>
                </div>
                <div className="text-sm sm:text-lg font-bold font-mono text-slate-800 mt-0.5 leading-tight truncate">
                  {products.length - productsWithMakeCount} <span className="text-[10px] sm:text-xs text-slate-500 font-normal hidden sm:inline">General Items</span>
                </div>
              </div>
            </div>
          </div>

          {/* Add Product Form Card */}
          <div className="bg-white border border-slate-200/80 rounded-xl sm:rounded-2xl p-3.5 sm:p-6 shadow-xs sm:shadow-sm space-y-4 sm:space-y-6">
            <div className="flex items-center gap-2 pb-3 sm:pb-4 border-b border-slate-100">
              <PackagePlus className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600 shrink-0" />
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900">Add New Product to Catalog</h2>
              </div>
            </div>

            {prodMessage && (
              <div className={`p-4 rounded-xl text-sm flex items-center gap-2 border ${prodMessage.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}>
                {prodMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                {prodMessage.text}
              </div>
            )}

            <form onSubmit={handleAddProduct} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                {/* Auto-populated Product ID (Read-only) */}
                <div className="md:col-span-4 space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Product ID (Auto)</label>
                  <div className="h-11 bg-slate-100 border border-slate-200 rounded-xl px-4 flex items-center font-mono font-bold text-sm text-indigo-700 select-none">
                    {prodId || 'PROD-101'}
                  </div>
                </div>

                {/* Standard Product Name with Interactive Suggestions */}
                <div className="md:col-span-5 space-y-1.5 relative">
                  <label className="text-xs font-semibold text-slate-700">Standard Product Name *</label>
                  <input
                    type="text"
                    value={prodName}
                    onFocus={() => setShowProdSuggestions(true)}
                    onChange={(e) => {
                      setProdName(e.target.value);
                      setShowProdSuggestions(true);
                    }}
                    placeholder="e.g. Screw Driver, Heavy Duty Gearbox"
                    className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-all font-medium"
                  />

                  {/* Div Click Selection Suggestions Dropdown */}
                  {showProdSuggestions && matchingSuggestions.length > 0 && (
                    <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden divide-y divide-slate-100">
                      <div className="px-3.5 py-2 bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                        <span>Existing Standard Product Names ({matchingSuggestions.length})</span>
                        <span className="text-slate-400 font-normal">Click row to use name</span>
                      </div>
                      {matchingSuggestions.map((item) => (
                        <div
                          key={item.product_id}
                          onClick={() => {
                            setProdName(item.standard_name);
                            setShowProdSuggestions(false);
                          }}
                          className="px-3.5 py-2.5 hover:bg-indigo-50/80 cursor-pointer transition-colors flex items-center justify-between text-xs group"
                        >
                          <div className="font-bold text-slate-900 flex items-center gap-2">
                            <Tag className="w-3.5 h-3.5 text-indigo-500 group-hover:text-indigo-600" />
                            <span>{item.standard_name}</span>
                          </div>
                          {item.make && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                              Make: {item.make}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Make / Brand (Optional) */}
                <div className="md:col-span-3 space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                    Make / Brand (Optional)
                  </label>
                  <input
                    type="text"
                    value={prodMake}
                    onChange={(e) => setProdMake(e.target.value)}
                    placeholder="e.g. Siemens, ABB"
                    className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-all font-medium"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={isSubmittingProd}
                  className="w-full sm:w-auto h-11 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm rounded-xl px-6 flex items-center justify-center gap-2 shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isSubmittingProd ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <PackagePlus className="w-4 h-4" />
                      Add Product to Catalog
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Full Products Catalog Table with CRUD Actions */}
          <div className="bg-white border border-slate-200/80 rounded-xl sm:rounded-2xl p-3 sm:p-6 shadow-xs sm:shadow-sm space-y-3 sm:space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-1.5 sm:gap-2">
                  <Table className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600 shrink-0" />
                  <span>Catalog Products Table ({filteredCatalogProducts.length})</span>
                </h3>
                <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">Edit or delete any product in catalog.</p>
              </div>

              {/* Search & Make Filter Pills */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto">
                {/* Make Filter Pills */}
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold w-full sm:w-auto overflow-x-auto">
                  <button
                    onClick={() => setProdMakeFilter('all')}
                    className={`flex-1 sm:flex-none text-center px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${prodMakeFilter === 'all' ? 'bg-white text-indigo-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
                      }`}
                  >
                    All ({products.length})
                  </button>
                  <button
                    onClick={() => setProdMakeFilter('with_make')}
                    className={`flex-1 sm:flex-none text-center px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${prodMakeFilter === 'with_make' ? 'bg-white text-emerald-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
                      }`}
                  >
                    With Make ({productsWithMakeCount})
                  </button>
                  <button
                    onClick={() => setProdMakeFilter('without_make')}
                    className={`flex-1 sm:flex-none text-center px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${prodMakeFilter === 'without_make' ? 'bg-white text-slate-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
                      }`}
                  >
                    General ({products.length - productsWithMakeCount})
                  </button>
                </div>

                {/* Instant Search Bar */}
                <div className="relative w-full sm:w-64">
                  <input
                    type="text"
                    value={prodTableQuery}
                    onChange={(e) => setProdTableQuery(e.target.value)}
                    placeholder="Search ID, Name or Make..."
                    className="w-full h-9 bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-8 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 font-medium"
                  />
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  {prodTableQuery && (
                    <button
                      onClick={() => setProdTableQuery('')}
                      className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-700 text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            </div>

            {filteredCatalogProducts.length === 0 ? (
              <div className="py-12 text-center text-slate-400 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                <Table className="w-8 h-8 mx-auto mb-2 text-slate-400 opacity-60" />
                <p className="text-sm font-medium text-slate-500">No products found matching "{prodTableQuery}"</p>
              </div>
            ) : (
              <>
                {/* MOBILE CARD VIEW (sm:hidden) - Completely eliminates horizontal scrolling */}
                <div className="sm:hidden divide-y divide-slate-100 bg-white rounded-xl border border-slate-200/80 overflow-hidden shadow-2xs">
                  {paginatedCatalogProducts.map((p, idx) => (
                    <div key={p.product_id} className="p-3.5 space-y-2.5 hover:bg-slate-50/60 transition-colors">
                      {/* Top row: # index, Product ID & Action Buttons */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 font-mono text-xs">
                          <span className="text-slate-400 font-medium">
                            #{(prodCurrentPage - 1) * PROD_PER_PAGE + idx + 1}
                          </span>
                          <span className="text-slate-300">•</span>
                          <span className="font-bold text-indigo-700">
                            {p.product_id}
                          </span>
                        </div>

                        {/* Action Buttons (Edit & Delete - Icons only with color) */}
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => openEditModal(p)}
                            className="p-1.5 rounded-lg text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/80 transition-colors cursor-pointer shadow-2xs"
                            title="Edit Product Name & Make"
                            aria-label="Edit Product"
                          >
                            <Pencil className="w-3.5 h-3.5 text-indigo-600" />
                          </button>
                          <button
                            onClick={() => openDeleteModal(p)}
                            className="p-1.5 rounded-lg text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200/80 transition-colors cursor-pointer shadow-2xs"
                            title="Delete Product"
                            aria-label="Delete Product"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                          </button>
                        </div>
                      </div>

                      {/* Standard Product Name */}
                      <div className="font-bold text-slate-900 text-sm break-words leading-snug">
                        {p.standard_name}
                      </div>

                      {/* Make / Brand badge only */}
                      {p.make && (
                        <div className="pt-0.5">
                          <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/80 inline-block">
                            {p.make}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* DESKTOP TABLE VIEW (hidden sm:block) */}
                <div className="hidden sm:block overflow-x-auto rounded-xl border border-slate-200/80">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 bg-slate-50 uppercase tracking-wider font-semibold">
                        <th className="py-3.5 px-4 w-12 text-center">#</th>
                        <th className="py-3.5 px-4 w-36">Product ID</th>
                        <th className="py-3.5 px-4">Standard Product Name</th>
                        <th className="py-3.5 px-4 w-44">Make / Brand</th>
                        <th className="py-3.5 px-4 w-28 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {paginatedCatalogProducts.map((p, idx) => (
                        <tr key={p.product_id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-3 px-4 text-center font-mono text-slate-400 text-[11px]">
                            {(prodCurrentPage - 1) * PROD_PER_PAGE + idx + 1}
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-indigo-700">
                            {p.product_id}
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-900 text-xs sm:text-sm">
                            {p.standard_name}
                          </td>
                          <td className="py-3 px-4">
                            {p.make ? (
                              <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/80 inline-block">
                                {p.make}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[11px]">-</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => openEditModal(p)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                                title="Edit Product Name & Make"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => openDeleteModal(p)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                title="Delete Product"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* Pagination Bar */}
            {filteredCatalogProducts.length > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs text-slate-500 font-medium">
                <div className="text-center sm:text-left">
                  Showing <span className="font-bold text-slate-900">{Math.min((prodCurrentPage - 1) * PROD_PER_PAGE + 1, filteredCatalogProducts.length)}</span> to{' '}
                  <span className="font-bold text-slate-900">{Math.min(prodCurrentPage * PROD_PER_PAGE, filteredCatalogProducts.length)}</span> of{' '}
                  <span className="font-bold text-slate-900">{filteredCatalogProducts.length}</span> products
                </div>

                {totalProdPages > 1 && (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setProdCurrentPage(1)}
                      disabled={prodCurrentPage === 1}
                      className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 disabled:opacity-40 disabled:hover:bg-transparent transition-all cursor-pointer"
                      title="First Page"
                    >
                      <ChevronsLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setProdCurrentPage(p => Math.max(1, p - 1))}
                      disabled={prodCurrentPage === 1}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 disabled:opacity-40 disabled:hover:bg-transparent transition-all cursor-pointer flex items-center gap-1 font-semibold"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span>Prev</span>
                    </button>

                    <span className="px-3 py-1 bg-slate-100 rounded-lg font-bold text-slate-800 border border-slate-200 whitespace-nowrap">
                      Page {prodCurrentPage} of {totalProdPages}
                    </span>

                    <button
                      onClick={() => setProdCurrentPage(p => Math.min(totalProdPages, p + 1))}
                      disabled={prodCurrentPage === totalProdPages}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 disabled:opacity-40 disabled:hover:bg-transparent transition-all cursor-pointer flex items-center gap-1 font-semibold"
                    >
                      <span>Next</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setProdCurrentPage(totalProdPages)}
                      disabled={prodCurrentPage === totalProdPages}
                      className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 disabled:opacity-40 disabled:hover:bg-transparent transition-all cursor-pointer"
                      title="Last Page"
                    >
                      <ChevronsRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Tab 3: Manage Customers (CRUD) */}
        <TabsContent value="customer" className="space-y-6">
          {/* Quick Metrics Bar for Customers (Compact single row on mobile) */}
          <div className="grid grid-cols-3 gap-1.5 sm:gap-3">
            <div className="p-2 sm:p-4 rounded-xl sm:rounded-2xl bg-white border border-slate-200/80 shadow-2xs sm:shadow-xs flex flex-col sm:flex-row items-start sm:items-center gap-1.5 sm:gap-3 min-w-0">
              <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold shrink-0">
                <Users className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] sm:text-xs text-slate-500 font-semibold truncate leading-tight">
                  <span className="sm:hidden">Total</span>
                  <span className="hidden sm:inline">Total Customers</span>
                </div>
                <div className="text-sm sm:text-lg font-bold font-mono text-slate-900 mt-0.5 leading-tight truncate">
                  {customers.length} <span className="text-[10px] sm:text-xs text-slate-500 font-normal hidden sm:inline">Registered</span>
                </div>
              </div>
            </div>

            <div className="p-2 sm:p-4 rounded-xl sm:rounded-2xl bg-white border border-emerald-200/80 sm:border-slate-200/80 shadow-2xs sm:shadow-xs flex flex-col sm:flex-row items-start sm:items-center gap-1.5 sm:gap-3 min-w-0">
              <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shrink-0">
                <FileText className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] sm:text-xs text-emerald-700 sm:text-slate-500 font-semibold truncate leading-tight">
                  <span className="sm:hidden">With GSTIN</span>
                  <span className="hidden sm:inline">Customers with GSTIN</span>
                </div>
                <div className="text-sm sm:text-lg font-bold font-mono text-emerald-800 mt-0.5 leading-tight truncate">
                  {customersWithGstinCount} <span className="text-[10px] sm:text-xs text-emerald-600 font-normal hidden sm:inline">Tax Registered</span>
                </div>
              </div>
            </div>

            <div className="p-2 sm:p-4 rounded-xl sm:rounded-2xl bg-white border border-slate-200/80 shadow-2xs sm:shadow-xs flex flex-col sm:flex-row items-start sm:items-center gap-1.5 sm:gap-3 min-w-0">
              <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-slate-200 text-slate-700 flex items-center justify-center font-bold shrink-0">
                <User className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] sm:text-xs text-slate-500 font-semibold truncate leading-tight">
                  <span className="sm:hidden">No GSTIN</span>
                  <span className="hidden sm:inline">Without GSTIN</span>
                </div>
                <div className="text-sm sm:text-lg font-bold font-mono text-slate-800 mt-0.5 leading-tight truncate">
                  {customers.length - customersWithGstinCount} <span className="text-[10px] sm:text-xs text-slate-500 font-normal hidden sm:inline">General</span>
                </div>
              </div>
            </div>
          </div>

          {/* Add Customer Form Card */}
          <div className="bg-white border border-slate-200/80 rounded-xl sm:rounded-2xl p-3.5 sm:p-6 shadow-xs sm:shadow-sm space-y-4 sm:space-y-6">
            <div className="flex items-center gap-2 pb-3 sm:pb-4 border-b border-slate-100">
              <UserPlus className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600 shrink-0" />
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900">Add New Customer</h2>
              </div>
            </div>

            {custMessage && (
              <div className={`p-4 rounded-xl text-sm flex items-center gap-2 border ${custMessage.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}>
                {custMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                {custMessage.text}
              </div>
            )}

            <form onSubmit={handleAddCustomer} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                {/* Auto-populated Customer ID (Read-only) */}
                <div className="md:col-span-4 space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Customer ID (Auto)</label>
                  <div className="h-11 bg-slate-100 border border-slate-200 rounded-xl px-4 flex items-center font-mono font-bold text-sm text-indigo-700 select-none">
                    {custId || 'CUST-101'}
                  </div>
                </div>

                {/* Customer Name */}
                <div className="md:col-span-5 space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Customer Name *</label>
                  <input
                    type="text"
                    value={custName}
                    onChange={(e) => setCustName(e.target.value)}
                    placeholder="e.g. Acme Industrial Solutions"
                    className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-all font-medium"
                  />
                </div>

                {/* GSTIN (Optional) */}
                <div className="md:col-span-3 space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-indigo-600" />
                    GSTIN (Optional)
                  </label>
                  <input
                    type="text"
                    value={custGstin}
                    onChange={(e) => setCustGstin(e.target.value)}
                    placeholder="e.g. 24AAACA1234A1Z5"
                    className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-all font-medium uppercase"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={isSubmittingCust}
                  className="w-full sm:w-auto h-11 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm rounded-xl px-6 flex items-center justify-center gap-2 shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isSubmittingCust ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      Add Customer to Database
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Full Customers Catalog Table with CRUD Actions */}
          <div className="bg-white border border-slate-200/80 rounded-xl sm:rounded-2xl p-3 sm:p-6 shadow-xs sm:shadow-sm space-y-3 sm:space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-1.5 sm:gap-2">
                  <Table className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600 shrink-0" />
                  <span>Customer Directory Table ({filteredCatalogCustomers.length})</span>
                </h3>
                <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">Edit or delete any customer in database.</p>
              </div>

              {/* Search & GSTIN Filter Pills */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto">
                {/* GSTIN Filter Pills */}
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold w-full sm:w-auto overflow-x-auto">
                  <button
                    onClick={() => setCustGstinFilter('all')}
                    className={`flex-1 sm:flex-none text-center px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${custGstinFilter === 'all' ? 'bg-white text-indigo-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
                      }`}
                  >
                    All ({customers.length})
                  </button>
                  <button
                    onClick={() => setCustGstinFilter('with_gstin')}
                    className={`flex-1 sm:flex-none text-center px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${custGstinFilter === 'with_gstin' ? 'bg-white text-emerald-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
                      }`}
                  >
                    With GSTIN ({customersWithGstinCount})
                  </button>
                  <button
                    onClick={() => setCustGstinFilter('without_gstin')}
                    className={`flex-1 sm:flex-none text-center px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${custGstinFilter === 'without_gstin' ? 'bg-white text-slate-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
                      }`}
                  >
                    No GSTIN ({customers.length - customersWithGstinCount})
                  </button>
                </div>

                {/* Instant Search Bar */}
                <div className="relative w-full sm:w-64">
                  <input
                    type="text"
                    value={custTableQuery}
                    onChange={(e) => setCustTableQuery(e.target.value)}
                    placeholder="Search Customer ID, Name, GSTIN..."
                    className="w-full h-9 bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-8 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 font-medium"
                  />
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  {custTableQuery && (
                    <button
                      onClick={() => setCustTableQuery('')}
                      className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-700 text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            </div>

            {filteredCatalogCustomers.length === 0 ? (
              <div className="py-12 text-center text-slate-400 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                <Users className="w-8 h-8 mx-auto mb-2 text-slate-400 opacity-60" />
                <p className="text-sm font-medium text-slate-500">No customers found matching "{custTableQuery}"</p>
              </div>
            ) : (
              <>
                {/* MOBILE CARD VIEW (sm:hidden) - Completely eliminates horizontal scrolling */}
                <div className="sm:hidden divide-y divide-slate-100 bg-white rounded-xl border border-slate-200/80 overflow-hidden shadow-2xs">
                  {paginatedCatalogCustomers.map((c, idx) => (
                    <div key={c.customer_id} className="p-3.5 space-y-2.5 hover:bg-slate-50/60 transition-colors">
                      {/* Top row: # index, Customer ID & Actions */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 font-mono text-xs">
                          <span className="text-slate-400 font-medium">
                            #{(custCurrentPage - 1) * CUST_PER_PAGE + idx + 1}
                          </span>
                          <span className="text-slate-300">•</span>
                          <span className="font-bold text-indigo-700">
                            {c.customer_id}
                          </span>
                        </div>

                        {/* Actions (Edit & Delete - Icons only with color) */}
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => openEditCustomerModal(c)}
                            className="p-1.5 rounded-lg text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/80 transition-colors cursor-pointer shadow-2xs"
                            title="Edit Customer Details"
                            aria-label="Edit Customer"
                          >
                            <Pencil className="w-3.5 h-3.5 text-indigo-600" />
                          </button>
                          <button
                            onClick={() => openDeleteCustomerModal(c)}
                            className="p-1.5 rounded-lg text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200/80 transition-colors cursor-pointer shadow-2xs"
                            title="Delete Customer"
                            aria-label="Delete Customer"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                          </button>
                        </div>
                      </div>

                      {/* Customer Name */}
                      <div className="font-bold text-slate-900 text-sm break-words leading-snug">
                        {c.customer_name}
                      </div>

                      {/* GSTIN */}
                      <div className="flex items-center gap-1.5 pt-0.5">
                        <span className="text-[11px] font-medium text-slate-500">GSTIN:</span>
                        {c.gstin ? (
                          <span className="text-[11px] font-mono font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                            {c.gstin}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">No GSTIN registered</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* DESKTOP TABLE VIEW (hidden sm:block) */}
                <div className="hidden sm:block overflow-x-auto rounded-xl border border-slate-200/80">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 bg-slate-50 uppercase tracking-wider font-semibold">
                        <th className="py-3.5 px-4 w-12 text-center">#</th>
                        <th className="py-3.5 px-4 w-36">Customer ID</th>
                        <th className="py-3.5 px-4">Customer Name</th>
                        <th className="py-3.5 px-4 w-52">GSTIN</th>
                        <th className="py-3.5 px-4 w-28 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {paginatedCatalogCustomers.map((c, idx) => (
                        <tr key={c.customer_id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-3 px-4 text-center font-mono text-slate-400 text-[11px]">
                            {(custCurrentPage - 1) * CUST_PER_PAGE + idx + 1}
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-indigo-700">
                            {c.customer_id}
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-900 text-xs sm:text-sm">
                            {c.customer_name}
                          </td>
                          <td className="py-3 px-4">
                            {c.gstin ? (
                              <span className="text-[11px] font-mono font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 inline-block">
                                {c.gstin}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[11px]">-</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => openEditCustomerModal(c)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                                title="Edit Customer Details"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => openDeleteCustomerModal(c)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                title="Delete Customer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* Pagination Bar */}
            {filteredCatalogCustomers.length > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs text-slate-500 font-medium">
                <div className="text-center sm:text-left">
                  Showing <span className="font-bold text-slate-900">{Math.min((custCurrentPage - 1) * CUST_PER_PAGE + 1, filteredCatalogCustomers.length)}</span> to{' '}
                  <span className="font-bold text-slate-900">{Math.min(custCurrentPage * CUST_PER_PAGE, filteredCatalogCustomers.length)}</span> of{' '}
                  <span className="font-bold text-slate-900">{filteredCatalogCustomers.length}</span> customers
                </div>

                {totalCustPages > 1 && (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setCustCurrentPage(1)}
                      disabled={custCurrentPage === 1}
                      className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 disabled:opacity-40 disabled:hover:bg-transparent transition-all cursor-pointer"
                      title="First Page"
                    >
                      <ChevronsLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setCustCurrentPage(p => Math.max(1, p - 1))}
                      disabled={custCurrentPage === 1}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 disabled:opacity-40 disabled:hover:bg-transparent transition-all cursor-pointer flex items-center gap-1 font-semibold"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span>Prev</span>
                    </button>

                    <span className="px-3 py-1 bg-slate-100 rounded-lg font-bold text-slate-800 border border-slate-200 whitespace-nowrap">
                      Page {custCurrentPage} of {totalCustPages}
                    </span>

                    <button
                      onClick={() => setCustCurrentPage(p => Math.min(totalCustPages, p + 1))}
                      disabled={custCurrentPage === totalCustPages}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 disabled:opacity-40 disabled:hover:bg-transparent transition-all cursor-pointer flex items-center gap-1 font-semibold"
                    >
                      <span>Next</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setCustCurrentPage(totalCustPages)}
                      disabled={custCurrentPage === totalCustPages}
                      className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 disabled:opacity-40 disabled:hover:bg-transparent transition-all cursor-pointer"
                      title="Last Page"
                    >
                      <ChevronsRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit Product Modal Dialog */}
      <Dialog open={!!editingProduct} onOpenChange={(open) => !open && setEditingProduct(null)}>
        {editingProduct && (
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Pencil className="w-5 h-5 text-indigo-600" />
                Edit Catalog Product
              </DialogTitle>
              <DialogDescription>
                Modify Standard Product Name or Make. Product ID is read-only.
              </DialogDescription>
            </DialogHeader>

            {editMessage && (
              <div className={`p-3 rounded-xl text-xs flex items-center gap-2 border ${editMessage.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}>
                {editMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                {editMessage.text}
              </div>
            )}

            <form onSubmit={handleUpdateProduct} className="space-y-4 py-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Product ID</label>
                <div className="h-10 bg-slate-100 border border-slate-200 rounded-xl px-3 flex items-center font-mono font-bold text-xs text-indigo-700 select-none">
                  {editingProduct.product_id}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Standard Product Name *</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="e.g. Screw Driver"
                  className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                  Make / Brand (Optional)
                </label>
                <input
                  type="text"
                  value={editMake}
                  onChange={(e) => setEditMake(e.target.value)}
                  placeholder="e.g. Bosch, Siemens"
                  className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEdit}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-xs transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {isSubmittingEdit ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  Save Changes
                </button>
              </div>
            </form>
          </DialogContent>
        )}
      </Dialog>

      {/* Delete Product Confirm Dialog Modal */}
      <Dialog open={!!deletingProduct} onOpenChange={(open) => !open && setDeletingProduct(null)}>
        {deletingProduct && (
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-rose-700">
                <Trash2 className="w-5 h-5 text-rose-600" />
                Confirm Product Deletion
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Are you sure you want to delete this product? This action will also delete all customer prices mapped to this product.
              </DialogDescription>
            </DialogHeader>

            {deleteMessage && (
              <div className={`p-3 rounded-xl text-xs flex items-center gap-2 border ${deleteMessage.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}>
                {deleteMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                {deleteMessage.text}
              </div>
            )}

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
              <div>
                <span className="text-slate-500 font-medium">Product ID:</span>{' '}
                <strong className="font-mono text-indigo-700">{deletingProduct.product_id}</strong>
              </div>
              <div>
                <span className="text-slate-500 font-medium">Standard Name:</span>{' '}
                <strong className="text-slate-900">{deletingProduct.standard_name}</strong>
              </div>
              {deletingProduct.make && (
                <div>
                  <span className="text-slate-500 font-medium">Make / Brand:</span>{' '}
                  <span className="font-semibold text-indigo-700">{deletingProduct.make}</span>
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletingProduct(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteProduct}
                disabled={isSubmittingDelete}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow-xs transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
              >
                {isSubmittingDelete ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                Delete Product
              </button>
            </div>
          </DialogContent>
        )}
      </Dialog>

      {/* Price Revision History Right-Side Sliding Drawer */}
      <PriceHistoryDrawer
        open={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        product={{ ...selectedProduct, ...selectedPriceRecord }}
        customerName={selectedCustomer?.customer_name}
      />

      {/* Edit Customer Modal Dialog */}
      <Dialog open={!!editingCustomer} onOpenChange={(open) => !open && setEditingCustomer(null)}>
        {editingCustomer && (
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Pencil className="w-5 h-5 text-indigo-600" />
                Edit Customer Details
              </DialogTitle>
              <DialogDescription>
                Modify Customer Name or GSTIN. Customer ID is read-only.
              </DialogDescription>
            </DialogHeader>

            {editCustMessage && (
              <div className={`p-3 rounded-xl text-xs flex items-center gap-2 border ${editCustMessage.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}>
                {editCustMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                {editCustMessage.text}
              </div>
            )}

            <form onSubmit={handleUpdateCustomer} className="space-y-4 py-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Customer ID</label>
                <div className="h-10 bg-slate-100 border border-slate-200 rounded-xl px-3 flex items-center font-mono font-bold text-xs text-indigo-700 select-none">
                  {editingCustomer.customer_id}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Customer Name *</label>
                <input
                  type="text"
                  value={editCustName}
                  onChange={(e) => setEditCustName(e.target.value)}
                  placeholder="e.g. Acme Industrial Solutions"
                  className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5 text-indigo-600" />
                  GSTIN (Optional)
                </label>
                <input
                  type="text"
                  value={editCustGstin}
                  onChange={(e) => setEditCustGstin(e.target.value)}
                  placeholder="e.g. 24AAACA1234A1Z5"
                  className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-300 uppercase"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingCustomer(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEditCust}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-xs transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {isSubmittingEditCust ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  Save Customer Changes
                </button>
              </div>
            </form>
          </DialogContent>
        )}
      </Dialog>

      {/* Delete Customer Confirm Dialog Modal */}
      <Dialog open={!!deletingCustomer} onOpenChange={(open) => !open && setDeletingCustomer(null)}>
        {deletingCustomer && (
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-rose-700">
                <Trash2 className="w-5 h-5 text-rose-600" />
                Confirm Customer Deletion
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Are you sure you want to delete this customer? This action will also delete all product prices mapped to this customer.
              </DialogDescription>
            </DialogHeader>

            {deleteCustMessage && (
              <div className={`p-3 rounded-xl text-xs flex items-center gap-2 border ${deleteCustMessage.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}>
                {deleteCustMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                {deleteCustMessage.text}
              </div>
            )}

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
              <div>
                <span className="text-slate-500 font-medium">Customer ID:</span>{' '}
                <strong className="font-mono text-indigo-700">{deletingCustomer.customer_id}</strong>
              </div>
              <div>
                <span className="text-slate-500 font-medium">Customer Name:</span>{' '}
                <strong className="text-slate-900">{deletingCustomer.customer_name}</strong>
              </div>
              {deletingCustomer.gstin && (
                <div>
                  <span className="text-slate-500 font-medium">GSTIN:</span>{' '}
                  <span className="font-mono font-semibold text-slate-700">{deletingCustomer.gstin}</span>
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletingCustomer(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteCustomer}
                disabled={isSubmittingDeleteCust}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow-xs transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
              >
                {isSubmittingDeleteCust ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                Delete Customer
              </button>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}


