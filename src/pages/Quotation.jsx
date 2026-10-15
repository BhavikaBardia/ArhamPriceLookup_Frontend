import React, { useState, useEffect, useMemo, useRef } from 'react';
import { api } from '../api';
import { SearchableCustomerSelect, SearchableProductSelect, UomSelect } from '../components/ui/SearchableSelect';
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import aecLogo from '../assets/logo.png';
import {
  FileText, Download, Printer, Plus, Trash2, ArrowUp, ArrowDown,
  Sparkles, User, Tag, Calendar, Hash, Percent, DollarSign,
  CheckCircle2, AlertCircle, RefreshCw, Eye, Edit3, Image, FileSpreadsheet,
  Building2, Phone, Mail, MapPin, Copy, Layers, Save,
  ShoppingBag, Check, Search, History, Clock, ArrowRight, CheckCircle, ChevronDown,
  Truck, Globe, PackagePlus, PlusCircle, X
} from 'lucide-react';

// Common Indian UOMs (Units of Measure)
const COMMON_UOMS = [
  'Kg', 'Mtr', 'Inc', 'Nos', 'Pcs', 'Set', 'Box', 'Pkt', 'Roll', 'Ltr', 'Sq.Mtr', 'Drum', 'Pair', 'Bundle'
];

// Helper: Convert numbers to Indian Rupees in words
function numberToIndianWords(num) {
  if (isNaN(num) || num <= 0) return 'Zero Rupees Only';
  const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const inWords = (n) => {
    if ((n = n.toString()).length > 9) return 'overflow';
    const nArr = ('000000000' + n).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
    if (!nArr) return '';
    let str = '';
    str += (nArr[1] != 0) ? (a[Number(nArr[1])] || b[nArr[1][0]] + ' ' + a[nArr[1][1]]) + 'Crore ' : '';
    str += (nArr[2] != 0) ? (a[Number(nArr[2])] || b[nArr[2][0]] + ' ' + a[nArr[2][1]]) + 'Lakh ' : '';
    str += (nArr[3] != 0) ? (a[Number(nArr[3])] || b[nArr[3][0]] + ' ' + a[nArr[3][1]]) + 'Thousand ' : '';
    str += (nArr[4] != 0) ? (a[Number(nArr[4])] || b[nArr[4][0]] + ' ' + a[nArr[4][1]]) + 'Hundred ' : '';
    str += (nArr[5] != 0) ? ((str != '') ? 'and ' : '') + (a[Number(nArr[5])] || b[nArr[5][0]] + ' ' + a[nArr[5][1]]) : '';
    return str.trim();
  };

  const whole = Math.floor(num);
  const fraction = Math.round((num - whole) * 100);
  let res = inWords(whole) + ' Rupees';
  if (fraction > 0) {
    res += ' and ' + inWords(fraction) + ' Paise';
  }
  return res + ' Only';
}

// Helper: Format Date as YYYY-MM-DD (removes GMT/timezone text)
function formatDateOnly(val) {
  if (!val) return '';
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return '';
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const day = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  const s = String(val).trim();
  if (!s || s === 'N/A' || s === 'null' || s === 'undefined') return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (s.includes('GMT') || s.includes('Standard Time') || s.includes('UTC') || s.includes('T') || s.length > 10) {
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }
  }
  if (s.includes('T')) {
    return s.split('T')[0];
  }
  return s;
}

const DEFAULT_TERMS = '1. Prices are valid for days as given in the quotation.\n2. Payment Terms: 100% advance or as agreed.\n3. Delivery: Ex-stock or within 7-10 working days upon confirmed P.O.\n4. GST will be charged extra as applicable.';

// Helper: Compute effective unit rate after item discount & quotation discount
function computeItemDiscountedRate(item, quotationContext = null) {
  if (!item) return 0;
  const rawRate = Number(item.rate !== undefined && item.rate !== '' ? item.rate : (item.price !== undefined ? item.price : 0)) || 0;
  if (rawRate <= 0) return 0;

  let effectiveRate = rawRate;

  // 1. Item-level discount (percentage or flat)
  const dVal = parseFloat(item.discount_val !== undefined && item.discount_val !== '' ? item.discount_val : (item.discount !== undefined ? item.discount : 0)) || 0;
  if (dVal > 0) {
    if (item.discount_type === 'fixed') {
      effectiveRate = Math.max(0, rawRate - dVal);
    } else {
      effectiveRate = Math.max(0, rawRate - (rawRate * dVal) / 100);
    }
  }

  // 2. Quotation-level discount context (if quotation has an overall discount)
  if (quotationContext) {
    const subtotal = Number(quotationContext.subtotal) || 0;
    const discountAmount = Number(
      quotationContext.discount_amount !== undefined 
        ? quotationContext.discount_amount 
        : (quotationContext.discountAmount !== undefined ? quotationContext.discountAmount : quotationContext.discountValue)
    ) || 0;

    if (discountAmount > 0 && subtotal > 0) {
      const qDiscFraction = Math.min(1, Math.max(0, discountAmount / subtotal));
      const hasItemDiscount = dVal > 0;
      if (!hasItemDiscount) {
        effectiveRate = Math.max(0, effectiveRate * (1 - qDiscFraction));
      }
    }
  }

  return Math.round(effectiveRate * 100) / 100;
}

// Helper: Generate guaranteed unique quotation number
function generateUniqueQuotationNo(existingList = []) {
  const now = new Date();
  const yr = now.getFullYear();
  const mo = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  const ms = String(now.getMilliseconds()).padStart(3, '0');
  const rnd = Math.floor(100 + Math.random() * 900); // 3 random digits
  let code = `ARH-QT-${yr}${mo}${day}-${hh}${mm}${ss}${ms}-${rnd}`;
  if (Array.isArray(existingList) && existingList.length > 0) {
    const existingSet = new Set(existingList.map(q => String(q.quotation_no || '').trim().toUpperCase()));
    let extra = 1;
    while (existingSet.has(code.toUpperCase())) {
      code = `ARH-QT-${yr}${mo}${day}-${hh}${mm}${ss}${ms}-${rnd}-${extra}`;
      extra++;
    }
  }
  return code;
}

export function Quotation({ initialCustomerId = '', onNavigateToCatalog = null }) {
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [customerPrices, setCustomerPrices] = useState([]);
  const [allPricingCache, setAllPricingCache] = useState([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isPricesLoading, setIsPricesLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  // Active Customer
  const [selectedCustomerId, setSelectedCustomerId] = useState(initialCustomerId || '');

  // Keep selectedCustomerId in sync if initialCustomerId prop updates
  useEffect(() => {
    if (initialCustomerId) {
      setSelectedCustomerId(initialCustomerId);
    }
  }, [initialCustomerId]);

  // Quotation Metadata (Always Guaranteed Unique)
  const [quotationNo, setQuotationNo] = useState(() => generateUniqueQuotationNo());

  const [quotationDate, setQuotationDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [validUntil, setValidUntil] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });

  // Line Items
  const [items, setItems] = useState([
    {
      id: 1,
      product_id: '',
      product_name: '',
      make: '',
      uom: 'Nos',
      qty: 1,
      rate: '',
      discount_val: '',
      discount_type: 'percent',
      total: 0,
      remark: '',
      isCustomPrice: false
    }
  ]);

  // Tax, Discount & Freight Settings
  const [taxType, setTaxType] = useState('cgst_sgst_18'); // 'cgst_sgst_18', 'igst_18', 'gst_12', 'gst_5', 'exempt'
  const [discountType, setDiscountType] = useState('percent'); // 'percent' or 'flat'
  const [discountValue, setDiscountValue] = useState(0);
  const [freightCharges, setFreightCharges] = useState(0);

  // Terms & Notes
  const [terms, setTerms] = useState(DEFAULT_TERMS);

  // View mode: 'builder', 'preview', or 'saved'
  const [activeTab, setActiveTab] = useState('builder');
  const [isExporting, setIsExporting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState(null);
  const [exportMessage, setExportMessage] = useState(null);

  // Saved Quotations & Order Confirmation States
  const [savedQuotations, setSavedQuotations] = useState([]);
  const [isLoadingSavedQuotations, setIsLoadingSavedQuotations] = useState(false);
  const [savedSearchQuery, setSavedSearchQuery] = useState('');
  const [savedStatusFilter, setSavedStatusFilter] = useState('all'); // 'all', 'CONFIRMED', 'PENDING'
  const [confirmOrderModal, setConfirmOrderModal] = useState(null);
  const [isConfirmingOrder, setIsConfirmingOrder] = useState(false);
  const [currentOrderStatus, setCurrentOrderStatus] = useState(null);
  const [currentConfirmedAt, setCurrentConfirmedAt] = useState(null);
  const isOrderConfirmed = currentOrderStatus === 'CONFIRMED';
  
  // Flag indicating if current builder is editing an existing saved quotation
  const isEditingExisting = useMemo(() => {
    if (!quotationNo) return false;
    return (savedQuotations || []).some(sq => String(sq.quotation_no || '').trim().toUpperCase() === String(quotationNo || '').trim().toUpperCase());
  }, [savedQuotations, quotationNo]);

  // Quick Add New Product Modal States
  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);
  const [newProdName, setNewProdName] = useState('');
  const [newProdMake, setNewProdMake] = useState('');
  const [newProdId, setNewProdId] = useState('');
  const [newProdRate, setNewProdRate] = useState('');
  const [newProdUom, setNewProdUom] = useState('Nos');
  const [targetRowIndexForNewProd, setTargetRowIndexForNewProd] = useState(null);
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const [addProductError, setAddProductError] = useState('');

  const generateUniqueProdId = (productList) => {
    if (!Array.isArray(productList) || productList.length === 0) return 'PROD-101';
    const maxNum = productList.reduce((acc, p) => {
      const match = String(p.product_id || '').match(/\d+/);
      return match ? Math.max(acc, parseInt(match[0], 10)) : acc;
    }, 100);
    return `PROD-${maxNum + 1}`;
  };

  const handleOpenAddProductModal = (query = '', rowIndex = null) => {
    setNewProdName(query || '');
    setNewProdMake('');
    setNewProdId(generateUniqueProdId(products));
    setNewProdRate('');
    setNewProdUom('Nos');
    setTargetRowIndexForNewProd(rowIndex);
    setAddProductError('');
    setIsAddProductModalOpen(true);
  };

  const handleCreateProductSubmit = async (e) => {
    if (e) e.preventDefault();
    const cleanName = newProdName.trim();
    if (!cleanName) {
      setAddProductError('Standard product name is required.');
      return;
    }
    const finalId = newProdId.trim() || generateUniqueProdId(products);
    const finalMake = newProdMake.trim();
    const finalRate = parseFloat(newProdRate);
    const finalUom = newProdUom.trim() || 'Nos';

    setIsSavingProduct(true);
    setAddProductError('');

    try {
      // 1. Create product in Google Sheets 'Products' sheet
      const res = await api.createProduct({
        product_id: finalId,
        standard_name: cleanName,
        make: finalMake
      });

      if (res && res.error) {
        throw new Error(res.error);
      }

      // 2. Add to local products state
      const createdProd = {
        product_id: finalId,
        standard_name: cleanName,
        make: finalMake,
        price: !isNaN(finalRate) && finalRate > 0 ? finalRate : null
      };
      setProducts(prev => [...prev, createdProd]);

      // 3. Update active line item or add new line item
      if (targetRowIndexForNewProd !== null && targetRowIndexForNewProd >= 0 && targetRowIndexForNewProd < items.length) {
        setItems(prevItems => {
          const next = [...prevItems];
          const cur = next[targetRowIndexForNewProd];
          const qty = parseFloat(cur.qty) || 1;
          const rate = (!isNaN(finalRate) && finalRate > 0) ? finalRate : (parseFloat(cur.rate) || 0);
          const total = qty * rate;
          next[targetRowIndexForNewProd] = {
            ...cur,
            product_id: finalId,
            product_name: cleanName,
            make: finalMake || cur.make,
            uom: finalUom,
            rate: rate > 0 ? rate : cur.rate,
            total: total,
            isCustomPrice: true
          };
          return next;
        });
      } else {
        // Add new item to items table
        const qty = 1;
        const rate = (!isNaN(finalRate) && finalRate > 0) ? finalRate : '';
        const total = typeof rate === 'number' ? qty * rate : 0;
        setItems(prevItems => [
          ...prevItems,
          {
            id: Date.now(),
            product_id: finalId,
            product_name: cleanName,
            make: finalMake,
            uom: finalUom,
            qty: 1,
            rate: rate,
            discount_val: '',
            discount_type: 'percent',
            total: total,
            remark: '',
            isCustomPrice: true
          }
        ]);
      }

      setExportMessage({
        type: 'success',
        text: `Product '${cleanName}' [${finalId}] added to Google Sheets and selected in quotation!`
      });
      setTimeout(() => setExportMessage(null), 4000);
      setIsAddProductModalOpen(false);
    } catch (err) {
      console.error('Failed to create new product:', err);
      setAddProductError(err.message || 'Failed to create product in Google Sheets.');
    } finally {
      setIsSavingProduct(false);
    }
  };
 
  // Mobile Export Dropdown States
  const [mobileExportOpen, setMobileExportOpen] = useState(false);
  const [bottomExportOpen, setBottomExportOpen] = useState(false);
  const exportDropdownRef = useRef(null);
  const bottomExportDropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(event.target)) {
        setMobileExportOpen(false);
      }
      if (bottomExportDropdownRef.current && !bottomExportDropdownRef.current.contains(event.target)) {
        setBottomExportOpen(false);
      }
    }
    if (mobileExportOpen || bottomExportOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [mobileExportOpen, bottomExportOpen]);

  // Start a fresh, unique quotation (clears builder & generates new unique Quotation No)
  const handleNewQuotation = () => {
    const newNo = generateUniqueQuotationNo(savedQuotations);
    setQuotationNo(newNo);
    setSelectedCustomerId('');
    setQuotationDate(new Date().toISOString().split('T')[0]);
    const d = new Date();
    d.setDate(d.getDate() + 30);
    setValidUntil(d.toISOString().split('T')[0]);
    setItems([
      {
        id: Date.now(),
        product_id: '',
        product_name: '',
        make: '',
        uom: 'Nos',
        qty: 1,
        rate: '',
        discount_val: '',
        discount_type: 'percent',
        total: 0,
        remark: '',
        isCustomPrice: false
      }
    ]);
    setDiscountType('percent');
    setDiscountValue(0);
    setFreightCharges(0);
    setTaxType('cgst_sgst_18');
    setTerms(DEFAULT_TERMS);
    setCurrentOrderStatus(null);
    setCurrentConfirmedAt(null);
    setLastSavedTime(null);
    setActiveTab('builder');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setExportMessage({
      type: 'info',
      text: `✓ Refreshed page with new quotation #${newNo}`
    });
    setTimeout(() => setExportMessage(null), 4000);
  };

  const previewPaperRef = useRef(null);
  const previewContainerRef = useRef(null);
  const [previewZoomMode, setPreviewZoomMode] = useState('fit'); // 'fit' or '100'
  const [previewScale, setPreviewScale] = useState(1);
  const [paperHeight, setPaperHeight] = useState(1120);

  // Responsive auto-scaling for mobile preview with fallback and resize listener
  useEffect(() => {
    const computeScale = () => {
      let containerW = previewContainerRef.current?.clientWidth || 0;
      if (containerW <= 50 && typeof window !== 'undefined') {
        containerW = window.innerWidth;
      }
      if (containerW > 0 && containerW < 830) {
        // Fit 794px letterhead comfortably within viewport width with padding
        const padding = containerW < 500 ? 20 : 36;
        const availableWidth = Math.max(260, containerW - padding);
        const scale = Math.min(1, Math.max(0.28, availableWidth / 794));
        setPreviewScale(scale);
      } else if (containerW >= 830) {
        setPreviewScale(1);
      }
    };

    computeScale();
    const timer = setTimeout(computeScale, 60);

    window.addEventListener('resize', computeScale);
    window.addEventListener('orientationchange', computeScale);

    let resizeObserver = null;
    if (typeof ResizeObserver !== 'undefined' && previewContainerRef.current) {
      resizeObserver = new ResizeObserver(() => {
        computeScale();
      });
      resizeObserver.observe(previewContainerRef.current);
    }

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', computeScale);
      window.removeEventListener('orientationchange', computeScale);
      if (resizeObserver) resizeObserver.disconnect();
    };
  }, [activeTab, previewZoomMode]);

  // Track dynamic letterhead paper height to accurately adjust scaled container height
  useEffect(() => {
    const updatePaperHeight = () => {
      if (previewPaperRef.current) {
        const h = previewPaperRef.current.scrollHeight || previewPaperRef.current.offsetHeight || 1120;
        if (h > 150) {
          setPaperHeight(h);
        }
      }
    };

    updatePaperHeight();
    const timer = setTimeout(updatePaperHeight, 100);

    let ro = null;
    if (typeof ResizeObserver !== 'undefined' && previewPaperRef.current) {
      ro = new ResizeObserver(() => {
        updatePaperHeight();
      });
      ro.observe(previewPaperRef.current);
    }

    return () => {
      clearTimeout(timer);
      if (ro) ro.disconnect();
    };
  }, [activeTab, items, discountValue, discountType, freightCharges, terms, previewZoomMode]);

  const normalizeCustomer = (c) => {
    if (!c || typeof c !== 'object') {
      return { customer_id: '', customer_name: '', contact_person: '', phone: '', email: '', address: '', gstin: '' };
    }
    let gstin = String(c.gstin || c.GSTIN || c['GSTIN'] || c.Gstin || c.GstIn || '').trim();
    if (!gstin) {
      const contactVal = String(c.contact_person || c.contact || c['Contact Person'] || '').trim();
      if (contactVal && !contactVal.includes('@') && !contactVal.startsWith('+')) {
        gstin = contactVal;
      }
    }
    return {
      customer_id: String(c.customer_id || c['Customer ID'] || c.id || '').trim(),
      customer_name: String(c.customer_name || c['Customer Name'] || c.name || '').trim(),
      contact_person: String(c.contact_person || c['Contact Person'] || '').trim(),
      phone: String(c.phone || c['Phone'] || '').trim(),
      email: String(c.email || c['Email'] || '').trim(),
      address: String(c.address || c['Address'] || '').trim(),
      gstin: gstin
    };
  };

  const normalizeProduct = (p) => {
    if (!p || typeof p !== 'object') {
      return { product_id: '', standard_name: '', make: '' };
    }
    return {
      product_id: String(p.product_id || p['Product ID'] || p.id || '').trim(),
      standard_name: String(p.standard_name || p['Standard Product Name'] || p.name || '').trim(),
      make: String(p.make || p['Make'] || '').trim()
    };
  };

  // Initial load: customers, products, and pricing
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsInitialLoading(true);
    setLoadError('');
    try {
      let bulkData = null;
      try {
        bulkData = await api.getAllData();
      } catch (bulkErr) {
        console.warn('getAllData failed in Quotation, falling back to individual calls:', bulkErr);
      }

      let cData = bulkData?.customers;
      let pData = bulkData?.products;
      let prData = bulkData?.pricing;

      // If bulkData didn't return valid customer or product arrays, fetch individually
      if (!Array.isArray(cData) || cData.length === 0 || !Array.isArray(pData) || pData.length === 0) {
        const [cRes, pRes] = await Promise.all([
          (Array.isArray(cData) && cData.length > 0) ? Promise.resolve(cData) : api.getCustomers().catch(err => {
            console.error('api.getCustomers failed:', err);
            return [];
          }),
          (Array.isArray(pData) && pData.length > 0) ? Promise.resolve(pData) : api.getProducts().catch(err => {
            console.error('api.getProducts failed:', err);
            return [];
          })
        ]);
        if (!Array.isArray(cData) || cData.length === 0) cData = cRes;
        if (!Array.isArray(pData) || pData.length === 0) pData = pRes;
      }

      // Handle wrapper object if present
      if (cData && !Array.isArray(cData) && Array.isArray(cData.customers)) {
        cData = cData.customers;
      }
      if (pData && !Array.isArray(pData) && Array.isArray(pData.products)) {
        pData = pData.products;
      }

      const safeC = (Array.isArray(cData) ? cData : [])
        .map(normalizeCustomer)
        .filter(c => c && (c.customer_id || c.customer_name));

      const safeP = (Array.isArray(pData) ? pData : [])
        .map(normalizeProduct)
        .filter(p => p && (p.product_id || p.standard_name));

      setCustomers(safeC);
      setProducts(safeP);

      if (Array.isArray(prData) && prData.length > 0) {
        setAllPricingCache(prData);
      }

      // Default selection to initialCustomerId or first customer in list
      if (initialCustomerId) {
        setSelectedCustomerId(initialCustomerId);
      } else if (safeC.length > 0) {
        setSelectedCustomerId(prev => prev || safeC[0].customer_id);
      }
    } catch (err) {
      console.error('Failed to load customers/products in Quotation:', err);
      setLoadError('Failed to load customer list. Please click Refresh to try again.');
    } finally {
      setIsInitialLoading(false);
    }
  };

  // Whenever customer changes, fetch or resolve their specific prices
  useEffect(() => {
    if (!selectedCustomerId) {
      setCustomerPrices([]);
      return;
    }

    // First check in-memory cache if available
    if (allPricingCache.length > 0) {
      const cidUpper = String(selectedCustomerId).trim().toUpperCase();
      const matchedPricing = allPricingCache.filter(pr => {
        const rowCid = String(pr.customer_id || pr['Customer ID'] || '').trim().toUpperCase();
        return rowCid === cidUpper;
      }).map(pr => {
        const rawPrice = pr.customer_price !== undefined && pr.customer_price !== null
          ? pr.customer_price
          : (pr.price !== undefined && pr.price !== null ? pr.price : pr['Customer Price']);
        return {
          product_id: String(pr.product_id || pr['Product ID'] || '').trim(),
          standard_name: String(pr.standard_name || pr['Standard Product Name'] || '').trim(),
          make: String(pr.make || pr['Make'] || '').trim(),
          price: rawPrice
        };
      });

      if (matchedPricing.length > 0) {
        setCustomerPrices(matchedPricing);
        return;
      }
    }

    loadCustomerPrices(selectedCustomerId);
  }, [selectedCustomerId, allPricingCache]);

  const loadCustomerPrices = async (cid) => {
    setIsPricesLoading(true);
    try {
      const res = await api.lookupPrices(cid, '');
      setCustomerPrices(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error('Failed to load prices for customer:', err);
      setCustomerPrices([]);
    } finally {
      setIsPricesLoading(false);
    }
  };

  const selectedCustomer = useMemo(() => {
    if (!selectedCustomerId) return null;
    const cidStr = String(selectedCustomerId).trim().toUpperCase();
    return customers.find(c => String(c.customer_id || '').trim().toUpperCase() === cidStr)
      || customers.find(c => String(c.customer_name || '').trim().toUpperCase() === cidStr)
      || null;
  }, [customers, selectedCustomerId]);

  // Only products priced / configured for the selected customer
  const customerPricedProducts = useMemo(() => {
    if (!selectedCustomerId) return [];

    // Filter customerPrices for active prices
    const activeFromLookup = (customerPrices || []).filter(p => {
      const raw = p.price !== undefined && p.price !== null ? p.price : p.customer_price;
      const cleanStr = raw !== null && raw !== undefined && raw !== '' ? String(raw).replace(/[^0-9\.]/g, '') : '';
      const num = cleanStr ? parseFloat(cleanStr) : NaN;
      return !isNaN(num) && num > 0 && p.is_configured !== false;
    });

    if (activeFromLookup.length > 0) {
      return activeFromLookup.map(item => {
        const matchedProd = products.find(p =>
          String(p.product_id).trim().toUpperCase() === String(item.product_id).trim().toUpperCase()
        );
        const raw = item.price !== undefined && item.price !== null ? item.price : item.customer_price;
        const cleanStr = String(raw).replace(/[^0-9\.]/g, '');
        return {
          product_id: item.product_id,
          standard_name: item.standard_name || matchedProd?.standard_name || item.product_id,
          make: item.make || matchedProd?.make || '',
          price: parseFloat(cleanStr) || 0
        };
      });
    }

    // Fallback: Check in allPricingCache
    if (allPricingCache.length > 0) {
      const cidUpper = String(selectedCustomerId).trim().toUpperCase();
      const matchedFromCache = allPricingCache.filter(pr => {
        const rowCid = String(pr.customer_id || pr['Customer ID'] || '').trim().toUpperCase();
        return rowCid === cidUpper;
      }).map(pr => {
        const pid = String(pr.product_id || pr['Product ID'] || '').trim();
        const matchedProd = products.find(p => String(p.product_id).trim().toUpperCase() === pid.toUpperCase());
        const raw = pr.customer_price !== undefined && pr.customer_price !== null
          ? pr.customer_price
          : (pr.price !== undefined && pr.price !== null ? pr.price : pr['Customer Price']);
        const cleanStr = raw !== null && raw !== undefined && raw !== '' ? String(raw).replace(/[^0-9\.]/g, '') : '';
        const num = cleanStr ? parseFloat(cleanStr) : NaN;
        return {
          product_id: pid,
          standard_name: String(pr.standard_name || pr['Standard Product Name'] || matchedProd?.standard_name || pid).trim(),
          make: String(pr.make || pr['Make'] || matchedProd?.make || '').trim(),
          price: !isNaN(num) && num > 0 ? num : null
        };
      }).filter(p => p.price !== null);

      if (matchedFromCache.length > 0) {
        return matchedFromCache;
      }
    }

    return [];
  }, [selectedCustomerId, customerPrices, allPricingCache, products]);

  // ALL products with customer-specific price attached if configured
  const allDropdownProducts = useMemo(() => {
    // Map pricing for current customer
    const priceMap = {};
    if (selectedCustomerId) {
      (customerPrices || []).forEach(cp => {
        const raw = cp.price !== undefined && cp.price !== null ? cp.price : cp.customer_price;
        const cleanStr = raw !== null && raw !== undefined && raw !== '' ? String(raw).replace(/[^0-9\.]/g, '') : '';
        const num = cleanStr ? parseFloat(cleanStr) : NaN;
        if (!isNaN(num) && num > 0 && cp.is_configured !== false) {
          priceMap[String(cp.product_id).trim().toUpperCase()] = num;
        }
      });

      if (Object.keys(priceMap).length === 0 && allPricingCache.length > 0) {
        const cidUpper = String(selectedCustomerId).trim().toUpperCase();
        allPricingCache.forEach(pr => {
          const rowCid = String(pr.customer_id || pr['Customer ID'] || '').trim().toUpperCase();
          if (rowCid === cidUpper) {
            const raw = pr.customer_price !== undefined && pr.customer_price !== null
              ? pr.customer_price
              : (pr.price !== undefined && pr.price !== null ? pr.price : pr['Customer Price']);
            const cleanStr = raw !== null && raw !== undefined && raw !== '' ? String(raw).replace(/[^0-9\.]/g, '') : '';
            const num = cleanStr ? parseFloat(cleanStr) : NaN;
            if (!isNaN(num) && num > 0) {
              priceMap[String(pr.product_id || pr['Product ID'] || '').trim().toUpperCase()] = num;
            }
          }
        });
      }
    }

    return (products || []).map(p => {
      const pidUpper = String(p.product_id).trim().toUpperCase();
      const custPrice = priceMap[pidUpper];
      return {
        product_id: p.product_id,
        standard_name: p.standard_name,
        make: p.make || '',
        price: custPrice !== undefined ? custPrice : null
      };
    });
  }, [products, selectedCustomerId, customerPrices, allPricingCache]);

  // Handle product selection in a row
  const handleProductSelect = (index, prodId) => {
    const selectedProd = allDropdownProducts.find(p =>
      String(p.product_id).trim().toUpperCase() === String(prodId).trim().toUpperCase()
    ) || products.find(p =>
      String(p.product_id).trim().toUpperCase() === String(prodId).trim().toUpperCase()
    );
    if (!selectedProd) return;

    let autoRate = '';
    let isCatalogPrice = false;

    if (selectedProd.price !== null && selectedProd.price !== undefined && !isNaN(selectedProd.price)) {
      autoRate = Number(selectedProd.price);
      isCatalogPrice = true;
    }

    setItems(prevItems => {
      const next = [...prevItems];
      const cur = next[index];
      const qty = parseFloat(cur.qty) || 1;
      const updatedItem = {
        ...cur,
        product_id: selectedProd.product_id,
        product_name: selectedProd.standard_name,
        make: selectedProd.make || '',
        rate: autoRate !== '' ? autoRate : (cur.rate || ''),
        isCustomPrice: isCatalogPrice
      };
      delete updatedItem.discounted_rate;
      const effectiveRate = computeItemDiscountedRate(updatedItem);
      updatedItem.total = Math.round(qty * effectiveRate * 100) / 100;
      next[index] = updatedItem;
      return next;
    });
  };

  // Update item field
  const updateItemField = (index, field, value) => {
    setItems(prevItems => {
      const next = [...prevItems];
      const item = { ...next[index], [field]: value };

      if (field === 'rate' || field === 'discount_val' || field === 'discount_type') {
        delete item.discounted_rate;
        if (field === 'rate') {
          item.isCustomPrice = false;
        }
      }

      const q = parseFloat(field === 'qty' ? value : item.qty) || 0;
      const effectiveRate = computeItemDiscountedRate(item);
      item.total = Math.round(q * effectiveRate * 100) / 100;

      next[index] = item;
      return next;
    });
  };

  // Add line item
  const addItem = () => {
    setItems(prev => [
      ...prev,
      {
        id: Date.now(),
        product_id: '',
        product_name: '',
        make: '',
        uom: 'Nos',
        qty: 1,
        rate: '',
        discount_val: '',
        discount_type: 'percent',
        total: 0,
        remark: '',
        isCustomPrice: false
      }
    ]);
  };

  // Remove line item
  const removeItem = (index) => {
    if (items.length === 1) {
      // Keep at least one row, just reset
      setItems([{
        id: Date.now(),
        product_id: '',
        product_name: '',
        make: '',
        uom: 'Nos',
        qty: 1,
        rate: '',
        discount_val: '',
        discount_type: 'percent',
        total: 0,
        remark: '',
        isCustomPrice: false
      }]);
      return;
    }
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  // Move item up
  const moveItemUp = (index) => {
    if (index === 0) return;
    setItems(prev => {
      const next = [...prev];
      const temp = next[index - 1];
      next[index - 1] = next[index];
      next[index] = temp;
      return next;
    });
  };

  // Move item down
  const moveItemDown = (index) => {
    if (index === items.length - 1) return;
    setItems(prev => {
      const next = [...prev];
      const temp = next[index + 1];
      next[index + 1] = next[index];
      next[index] = temp;
      return next;
    });
  };

  // Quick action: Add all priced items for this customer
  const addAllPricedItems = () => {
    if (customerPricedProducts.length === 0) {
      alert('No configured prices found for this customer.');
      return;
    }

    const newRows = customerPricedProducts.map((cp, idx) => ({
      id: Date.now() + idx,
      product_id: cp.product_id,
      product_name: cp.standard_name,
      make: cp.make || '',
      uom: 'Nos',
      qty: 1,
      rate: Number(cp.price),
      discount_val: '',
      discount_type: 'percent',
      total: Number(cp.price),
      remark: '',
      isCustomPrice: true
    }));

    setItems(newRows);
  };

  // Financial Computations
  const subtotal = useMemo(() => {
    return items.reduce((acc, item) => acc + (parseFloat(item.total) || 0), 0);
  }, [items]);

  const discountAmount = useMemo(() => {
    const dVal = parseFloat(discountValue) || 0;
    if (dVal <= 0) return 0;
    if (discountType === 'percent') {
      return (subtotal * dVal) / 100;
    }
    return Math.min(dVal, subtotal);
  }, [subtotal, discountType, discountValue]);

  const taxableAmount = Math.max(0, subtotal - discountAmount);

  const taxDetails = useMemo(() => {
    let rate = 0;
    let label = 'Tax Exempted (0%)';
    let isSplit = false;

    if (taxType === 'cgst_sgst_18') {
      rate = 18;
      label = 'GST 18% (CGST 9% + SGST 9%)';
      isSplit = true;
    } else if (taxType === 'igst_18') {
      rate = 18;
      label = 'IGST 18%';
    } else if (taxType === 'gst_12') {
      rate = 12;
      label = 'GST 12%';
    } else if (taxType === 'gst_5') {
      rate = 5;
      label = 'GST 5%';
    }

    const totalTax = (taxableAmount * rate) / 100;
    const cgst = isSplit ? totalTax / 2 : 0;
    const sgst = isSplit ? totalTax / 2 : 0;
    const igst = !isSplit && rate > 0 ? totalTax : 0;

    return { rate, label, isSplit, totalTax, cgst, sgst, igst };
  }, [taxType, taxableAmount]);

  const rawGrandTotal = taxableAmount + taxDetails.totalTax + (parseFloat(freightCharges) || 0);
  const roundOff = Math.round(rawGrandTotal) - rawGrandTotal;
  const grandTotal = Math.round(rawGrandTotal);
  const amountInWords = useMemo(() => numberToIndianWords(grandTotal), [grandTotal]);

  // Export to Excel (.xlsx)
  const handleExportExcel = () => {
    try {
      setIsExporting(true);
      setExportMessage({ type: 'info', text: 'Generating Excel quotation...' });

      const custName = selectedCustomer?.customer_name || 'Customer';
      const custGstin = selectedCustomer?.gstin || '-';

      const data = [
        ['ARHAM ENGG CO.'],
        ['Distributors & Suppliers of Industrial & Electrical Items'],
        ['OLD NO.113 NEW NO.231, F4, FIRST FLOOR, RAJINI\'S SHANMUGA BUILDING, Thambu Chetty St, Parrys, George Town, Chennai, Tamil Nadu 600001.'],
        ['GSTIN: 33ADPPB7680M1Z3 | Email: ravibardia@hotmail.com | Website: https://arhamenggco.in/'],
        ['Commercial Product Price Quotation'],
        [''],
        ['Quotation No:', quotationNo, '', 'Date:', quotationDate],
        ['Customer Name:', custName, '', 'Valid Until:', validUntil],
        ['GSTIN:', custGstin, '', 'Currency:', 'INR (₹)'],
        [''],
        ['#', 'Item / Product Name', 'Make / Brand', 'UOM', 'Qty', 'Unit Rate (₹)', 'Disc', 'Net Rate (₹)', 'Total Amount (₹)', 'Remark'],
        ...items.map((item, idx) => {
          const discRate = computeItemDiscountedRate(item);
          const discText = item.discount_val ? `${item.discount_val}${item.discount_type === 'fixed' ? '₹' : '%'}` : '0%';
          return [
            idx + 1,
            item.product_name || 'Custom Product',
            item.make || '-',
            item.uom || 'Nos',
            Number(item.qty) || 0,
            Number(item.rate) || 0,
            discText,
            discRate,
            Number(item.total) || 0,
            item.remark || '-'
          ];
        }),
        [''],
        ['', '', '', '', '', 'Subtotal (₹):', subtotal],
        ...(discountAmount > 0 ? [['', '', '', '', '', `Discount (${discountType === 'percent' ? discountValue + '%' : 'Flat ₹'}):`, discountAmount]] : []),
        ...(discountAmount > 0 ? [['', '', '', '', '', 'Taxable Value (₹):', taxableAmount]] : []),
        ...(taxDetails.rate > 0 ? [['', '', '', '', '', taxDetails.label + ':', taxDetails.totalTax]] : []),
        ...(parseFloat(freightCharges) > 0 ? [['', '', '', '', '', 'Freight Charges (₹):', parseFloat(freightCharges) || 0]] : []),
        ['', '', '', '', '', 'Round Off (₹):', roundOff],
        ['', '', '', '', '', 'Grand Total (₹):', grandTotal],
        [''],
        ['Amount in Words:', amountInWords],
        [''],
        ['Terms & Conditions:'],
        [terms]
      ];

      const ws = XLSX.utils.aoa_to_sheet(data);
      ws['!cols'] = [
        { wch: 6 },
        { wch: 35 },
        { wch: 18 },
        { wch: 10 },
        { wch: 10 },
        { wch: 16 },
        { wch: 18 },
        { wch: 25 }
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Quotation');
      XLSX.writeFile(wb, `Quotation_${quotationNo}_${custName.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`);

      setExportMessage({ type: 'success', text: 'Excel spreadsheet downloaded successfully!' });
      setTimeout(() => setExportMessage(null), 3000);
    } catch (err) {
      console.error('Failed to export Excel:', err);
      setExportMessage({ type: 'error', text: 'Failed to generate Excel file: ' + err.message });
    } finally {
      setIsExporting(false);
    }
  };

  // Staging capture helper for guaranteed pristine standard A4 PDF and Image exports
  // Ensures unscaled, full-width desktop layout regardless of mobile screen or preview zoom
  const captureStagedCanvas = async (scale = 2) => {
    let targetEl = document.getElementById('quotation-letterhead-paper');
    if (!targetEl || activeTab === 'builder') {
      setActiveTab('preview');
      await new Promise(resolve => setTimeout(resolve, 350));
      targetEl = document.getElementById('quotation-letterhead-paper');
    }

    if (!targetEl) {
      throw new Error('Quotation preview document could not be rendered');
    }

    if (document.fonts) {
      await document.fonts.ready;
    }

    // Fixed desktop A4 staging container
    // Placed at z-index 99998 behind the export progress modal (z-index 99999)
    const stagingContainer = document.createElement('div');
    stagingContainer.id = 'quotation-staging-export-container';
    stagingContainer.style.position = 'fixed';
    stagingContainer.style.top = '0';
    stagingContainer.style.left = '0';
    stagingContainer.style.width = '794px';
    stagingContainer.style.minWidth = '794px';
    stagingContainer.style.maxWidth = '794px';
    stagingContainer.style.zIndex = '99998';
    stagingContainer.style.backgroundColor = '#ffffff';
    stagingContainer.style.pointerEvents = 'none';

    // Deep clone target element
    const clone = targetEl.cloneNode(true);
    clone.id = 'quotation-letterhead-paper-export-clone';
    clone.style.width = '794px';
    clone.style.minWidth = '794px';
    clone.style.maxWidth = '794px';
    clone.style.transform = 'none';
    clone.style.boxShadow = 'none';
    clone.style.border = 'none';
    clone.style.margin = '0';
    clone.style.padding = '32px 20px 36px 20px';
    clone.style.backgroundColor = '#ffffff';

    stagingContainer.appendChild(clone);
    document.body.appendChild(stagingContainer);

    try {
      const canvas = await html2canvas(clone, {
        scale: scale,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        windowWidth: 1200, // Forces standard desktop media queries
        scrollX: 0,
        scrollY: 0,
        logging: false
      });
      return canvas;
    } finally {
      if (document.body.contains(stagingContainer)) {
        document.body.removeChild(stagingContainer);
      }
    }
  };

  // Export to Image (.png)
  const handleExportImage = async () => {
    try {
      setIsExporting(true);
      setExportMessage({ type: 'info', text: 'Rendering high-resolution A4 image...' });

      const canvas = await captureStagedCanvas(2.5);
      const imgData = canvas.toDataURL('image/png');
      const custName = selectedCustomer?.customer_name || 'Customer';
      const a = document.createElement('a');
      a.download = `Quotation_${quotationNo || 'Q'}_${custName.replace(/[^a-zA-Z0-9]/g, '_')}.png`;
      a.href = imgData;
      a.click();

      setExportMessage({ type: 'success', text: 'Quotation image (PNG) downloaded successfully!' });
      setTimeout(() => setExportMessage(null), 3000);
    } catch (err) {
      console.error('Failed to export image:', err);
      setExportMessage({ type: 'error', text: 'Failed to export image: ' + err.message });
    } finally {
      setIsExporting(false);
    }
  };

  // Export to PDF (.pdf)
  const handleExportPdf = async () => {
    try {
      setIsExporting(true);
      setExportMessage({ type: 'info', text: 'Generating standard A4 PDF document...' });

      const canvas = await captureStagedCanvas(2);
      const imgData = canvas.toDataURL('image/png');
      const PDFConstructor = typeof jsPDF === 'function' ? jsPDF : (jsPDF?.jsPDF || window.jspdf?.jsPDF);
      if (!PDFConstructor) {
        throw new Error('PDF generator library not available');
      }

      const pdf = new PDFConstructor('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth(); // 210 mm
      const pdfHeight = pdf.internal.pageSize.getHeight(); // 297 mm
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;

      if (imgHeight <= pdfHeight + 3) {
        // Fits cleanly on 1 standard A4 page without accidental blank page
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, Math.min(imgHeight, pdfHeight), undefined, 'FAST');
      } else {
        // Multi-page PDF handling
        let heightLeft = imgHeight;
        let position = 0;

        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight, undefined, 'FAST');
        heightLeft -= pdfHeight;

        while (heightLeft > 3) {
          position = position - pdfHeight;
          pdf.addPage();
          pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight, undefined, 'FAST');
          heightLeft -= pdfHeight;
        }
      }

      // Add clickable hyperlink annotation for website URL: https://arhamenggco.in/
      try {
        const paperEl = document.getElementById('quotation-letterhead-paper');
        const linkEl = document.getElementById('letterhead-website-link');
        if (paperEl && linkEl && typeof pdf.link === 'function') {
          const paperRect = paperEl.getBoundingClientRect();
          const linkRect = linkEl.getBoundingClientRect();
          if (paperRect.width > 0 && paperRect.height > 0) {
            const scaleX = pdfWidth / paperRect.width;
            const scaleY = ((canvas.height * pdfWidth) / canvas.width) / paperRect.height;
            const linkX = (linkRect.left - paperRect.left) * scaleX;
            const linkY = (linkRect.top - paperRect.top) * scaleY;
            const linkW = linkRect.width * scaleX;
            const linkH = linkRect.height * scaleY;
            // Set current page to 1 for header link
            pdf.setPage(1);
            pdf.link(linkX, linkY, linkW, linkH, { url: 'https://arhamenggco.in/' });
          }
        }
      } catch (linkErr) {
        console.warn('Could not add clickable PDF link:', linkErr);
      }

      const custName = selectedCustomer?.customer_name || 'Customer';
      pdf.save(`Quotation_${quotationNo || 'Q'}_${custName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);

      setExportMessage({ type: 'success', text: 'Quotation PDF downloaded successfully!' });
      setTimeout(() => setExportMessage(null), 3000);
    } catch (err) {
      console.error('Failed to export PDF:', err);
      setExportMessage({ type: 'error', text: 'Failed to export PDF: ' + err.message });
    } finally {
      setIsExporting(false);
    }
  };

  // Save Quotation to Google Sheets ('Quotations' sheet)
  const handleSaveToSheets = async () => {
    if (isOrderConfirmed) {
      setExportMessage({ type: 'error', text: 'This quotation has already been confirmed as an order and cannot be modified.' });
      return;
    }

    if (!selectedCustomerId) {
      setExportMessage({ type: 'error', text: 'Please select a customer before saving the quotation.' });
      return;
    }

    const validItems = items.filter(it => it.product_name || it.product_id || (parseFloat(it.rate) > 0));
    if (validItems.length === 0) {
      setExportMessage({ type: 'error', text: 'Please add at least one valid line item to the quotation.' });
      return;
    }

    try {
      setIsSaving(true);
      setExportMessage({ type: 'info', text: 'Saving quotation...' });

      const payload = {
        quotation_no: quotationNo,
        quotation_date: quotationDate,
        valid_until: validUntil,
        customer_id: selectedCustomer?.customer_id || selectedCustomerId || '',
        customer_name: selectedCustomer?.customer_name || 'Valued Customer',
        customer_gstin: selectedCustomer?.gstin || '',
        subtotal: subtotal,
        discount_amount: discountAmount,
        taxable_amount: taxableAmount,
        tax_rate: taxDetails.rate,
        tax_amount: taxDetails.totalTax,
        freight_charges: parseFloat(freightCharges) || 0,
        round_off: roundOff,
        grand_total: grandTotal,
        terms: terms,
        order_status: currentOrderStatus || 'PENDING',
        confirmed_at: currentConfirmedAt || '',
        items: items.map(it => {
          const discountedRate = computeItemDiscountedRate(it);
          return {
            product_id: it.product_id || '',
            product_name: it.product_name || 'Custom Product',
            make: it.make || '',
            uom: it.uom || 'Nos',
            qty: Number(it.qty) || 0,
            rate: Number(it.rate) || 0,
            discount_val: it.discount_val !== undefined && it.discount_val !== '' ? Number(it.discount_val) : 0,
            discount_type: it.discount_type || 'percent',
            discounted_rate: discountedRate,
            total: Number(it.total) || 0,
            remark: it.remark || ''
          };
        })
      };

      const res = await api.saveQuotation(payload);
      const timeStr = new Date().toLocaleTimeString();
      setLastSavedTime(timeStr);
      await loadSavedQuotations();
      setExportMessage({
        type: 'success',
        text: `✓ Quotation ${quotationNo} ${isEditingExisting ? 'updated' : 'saved'} successfully at ${timeStr}!`
      });
      setTimeout(() => setExportMessage(null), 5000);
    } catch (err) {
      console.error('Failed to save quotation:', err);
      setExportMessage({
        type: 'error',
        text: 'Failed to save quotation: ' + (err.message || 'Connection error')
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Load all saved quotations from Google Sheets / API
  const loadSavedQuotations = async () => {
    setIsLoadingSavedQuotations(true);
    try {
      const data = await api.getQuotations();
      if (Array.isArray(data)) {
        const sorted = [...data].sort((a, b) => {
          const tA = new Date(a.saved_at || a.quotation_date || 0).getTime();
          const tB = new Date(b.saved_at || b.quotation_date || 0).getTime();
          return tB - tA;
        });
        setSavedQuotations(sorted);
      }
    } catch (err) {
      console.error('Failed to load saved quotations:', err);
    } finally {
      setIsLoadingSavedQuotations(false);
    }
  };

  // Load a saved quotation into builder state to edit
  const handleLoadQuotation = (q) => {
    if (!q) return;

    if (q.quotation_no) setQuotationNo(q.quotation_no);
    if (q.quotation_date) setQuotationDate(formatDateOnly(q.quotation_date));
    if (q.valid_until) setValidUntil(formatDateOnly(q.valid_until));
    if (q.customer_id) setSelectedCustomerId(q.customer_id);
    if (q.terms) setTerms(q.terms);

    if (q.discount_amount !== undefined && Number(q.discount_amount) > 0) {
      setDiscountType('flat');
      setDiscountValue(Number(q.discount_amount));
    } else {
      setDiscountValue(0);
    }

    setFreightCharges(Number(q.freight_charges || q.freight || 0));

    if (q.tax_rate !== undefined) {
      const tr = Number(q.tax_rate);
      if (tr === 18) setTaxType('cgst_sgst_18');
      else if (tr === 12) setTaxType('gst_12');
      else if (tr === 5) setTaxType('gst_5');
      else if (tr === 0) setTaxType('exempt');
      else setTaxType('cgst_sgst_18');
    }

    if (Array.isArray(q.items) && q.items.length > 0) {
      const loadedItems = q.items.map((it, idx) => {
        const r = it.rate !== undefined && it.rate !== '' ? Number(it.rate) : '';
        let dVal = it.discount_val !== undefined && it.discount_val !== '' ? Number(it.discount_val) : (it.discount !== undefined ? Number(it.discount) : '');
        let dType = it.discount_type || 'percent';
        if ((!dVal || Number(dVal) <= 0) && it.discounted_rate && Number(it.discounted_rate) > 0 && Number(it.discounted_rate) < r) {
          dVal = Math.round((r - Number(it.discounted_rate)) * 100) / 100;
          dType = 'fixed';
        }
        const loadedItem = {
          id: Date.now() + idx,
          product_id: it.product_id || '',
          product_name: it.product_name || '',
          make: it.make || '',
          uom: it.uom || 'Nos',
          qty: Number(it.qty) || 1,
          rate: r,
          discount_val: dVal,
          discount_type: dType,
          total: Number(it.total) || 0,
          remark: it.remark || '',
          isCustomPrice: false
        };
        const eff = computeItemDiscountedRate(loadedItem);
        if (!loadedItem.total && r && it.qty) {
          loadedItem.total = Math.round(Number(it.qty) * eff * 100) / 100;
        }
        return loadedItem;
      });
      setItems(loadedItems);
    }

    const isConf = String(q.order_status || '').toUpperCase() === 'CONFIRMED';
    setCurrentOrderStatus(isConf ? 'CONFIRMED' : 'PENDING');
    setCurrentConfirmedAt(q.confirmed_at ? formatDateOnly(q.confirmed_at) : null);
    setLastSavedTime(q.saved_at ? formatDateOnly(q.saved_at) : null);

    setActiveTab('builder');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    setExportMessage({
      type: isConf ? 'info' : 'success',
      text: isConf
        ? `✓ Viewing Confirmed Order ${q.quotation_no}. Prices and items are permanently locked.`
        : `✓ Quotation ${q.quotation_no} loaded successfully! You can make edits, re-save, or confirm the order.`
    });
    setTimeout(() => setExportMessage(null), 5000);
  };

  // Apply Quotation Discount to all individual line items
  const handleApplyQuotationDiscountToAll = () => {
    const dVal = parseFloat(discountValue) || 0;
    if (dVal <= 0) return;
    setItems(prev => prev.map(it => {
      const r = parseFloat(it.rate) || 0;
      const q = parseFloat(it.qty) || 1;
      let effectiveRate = r;
      if (discountType === 'fixed') {
        effectiveRate = Math.max(0, r - dVal);
      } else {
        effectiveRate = Math.max(0, r - (r * dVal) / 100);
      }
      return {
        ...it,
        discount_val: dVal,
        discount_type: discountType,
        total: Math.round(q * effectiveRate * 100) / 100
      };
    }));
    setDiscountValue(0);
    setExportMessage({
      type: 'success',
      text: `✓ Applied ${dVal}${discountType === 'percent' ? '%' : '₹'} discount across all line items. Line prices and totals updated.`
    });
    setTimeout(() => setExportMessage(null), 4000);
  };

  // Initiate Order Confirmation (opens modal)
  const handleInitiateConfirmOrder = (targetQuotation = null) => {
    if (isOrderConfirmed || (targetQuotation && String(targetQuotation.order_status || '').toUpperCase() === 'CONFIRMED')) {
      setExportMessage({ type: 'error', text: 'This quotation order has already been confirmed and cannot be re-confirmed.' });
      return;
    }

    if (targetQuotation) {
      // Ensure target quotation items have pre-calculated discounted rates
      const preparedQuote = {
        ...targetQuotation,
        items: (targetQuotation.items || []).map(it => {
          const effRate = computeItemDiscountedRate(it, targetQuotation);
          return {
            ...it,
            discounted_rate: effRate
          };
        })
      };
      setConfirmOrderModal(preparedQuote);
      return;
    }

    if (!selectedCustomerId) {
      setExportMessage({ type: 'error', text: 'Please select a customer before confirming the order.' });
      return;
    }

    const validItems = items.filter(it => (it.product_name || it.product_id) && (parseFloat(it.rate) > 0));
    if (validItems.length === 0) {
      setExportMessage({ type: 'error', text: 'Please add items with valid rates to confirm the order.' });
      return;
    }

    const quoteContext = {
      subtotal,
      discount_amount: discountAmount,
      discountValue,
      discountType
    };

    setConfirmOrderModal({
      quotation_no: quotationNo,
      customer_id: selectedCustomer?.customer_id || selectedCustomerId,
      customer_name: selectedCustomer?.customer_name || 'Customer',
      grand_total: grandTotal,
      freight_charges: parseFloat(freightCharges) || 0,
      subtotal: subtotal,
      discount_amount: discountAmount,
      items: validItems.map(it => ({
        ...it,
        discounted_rate: computeItemDiscountedRate(it, quoteContext)
      }))
    });
  };

  // Execute Order Confirmation: updates customer pricing and price history in Google Sheets
  const handleExecuteConfirmOrder = async () => {
    if (!confirmOrderModal) return;

    const cid = confirmOrderModal.customer_id || selectedCustomerId;
    if (!cid) {
      setExportMessage({ type: 'error', text: 'Customer ID is required to confirm the order.' });
      return;
    }

    const rawItems = confirmOrderModal.items || [];
    const validItems = rawItems.filter(it => (it.product_name || it.product_id) && (parseFloat(it.rate !== undefined ? it.rate : it.price) > 0));

    if (validItems.length === 0) {
      setExportMessage({ type: 'error', text: 'No items with valid rates found to update pricing.' });
      return;
    }

    try {
      setIsConfirmingOrder(true);
      const payload = {
        quotation_no: confirmOrderModal.quotation_no,
        customer_id: cid,
        customer_name: confirmOrderModal.customer_name || selectedCustomer?.customer_name || '',
        items: validItems.map(it => {
          // Compute net discounted rate for each item to update customer catalog!
          const discountedRate = computeItemDiscountedRate(it, confirmOrderModal);
          const originalRate = Number(it.rate !== undefined ? it.rate : it.price) || 0;

          let pid = it.product_id;
          if (!pid && it.product_name) {
            const matched = (products || []).find(p =>
              String(p.standard_name || '').trim().toUpperCase() === String(it.product_name).trim().toUpperCase()
            );
            if (matched) pid = matched.product_id;
          }

          return {
            product_id: pid || '',
            product_name: it.product_name || '',
            rate: discountedRate, // Rate updated in customer catalog is the discounted price!
            discounted_rate: discountedRate,
            original_rate: originalRate,
            discount_val: Number(it.discount_val) || 0,
            discount_type: it.discount_type || 'percent'
          };
        })
      };

      const res = await api.confirmOrder(payload);

      if (confirmOrderModal.quotation_no === quotationNo) {
        setCurrentOrderStatus('CONFIRMED');
        setCurrentConfirmedAt(new Date().toLocaleTimeString());
      }

      // Reload fresh pricing data from backend/sheets & quotations
      try {
        const freshData = await api.getAllData();
        if (freshData?.pricing) {
          setAllPricingCache(freshData.pricing);
        }
      } catch (err) {
        console.warn('Could not refresh all pricing data cache:', err);
      }

      await Promise.all([
        loadCustomerPrices(cid),
        loadSavedQuotations()
      ]);

      const updatedCount = res.updated_count !== undefined ? res.updated_count : validItems.length;

      setConfirmOrderModal(null);
      setExportMessage({
        type: 'success',
        text: `✓ Order confirmed for Quotation ${payload.quotation_no}! Updated customer catalog with discounted prices for ${updatedCount} item(s) and logged price history.`,
        actionLabel: onNavigateToCatalog ? 'View in Customer Catalog →' : null,
        onAction: onNavigateToCatalog ? () => onNavigateToCatalog(cid) : null
      });
      setTimeout(() => setExportMessage(null), 10000);
    } catch (err) {
      console.error('Failed to confirm order:', err);
      setExportMessage({
        type: 'error',
        text: 'Failed to confirm order: ' + (err.message || 'Connection error')
      });
    } finally {
      setIsConfirmingOrder(false);
    }
  };

  // Filtered saved quotations
  const filteredSavedQuotations = useMemo(() => {
    return savedQuotations.filter(q => {
      if (savedStatusFilter === 'CONFIRMED' && String(q.order_status || '').toUpperCase() !== 'CONFIRMED') {
        return false;
      }
      if (savedStatusFilter === 'PENDING' && String(q.order_status || '').toUpperCase() === 'CONFIRMED') {
        return false;
      }
      if (savedSearchQuery.trim()) {
        const query = savedSearchQuery.trim().toLowerCase();
        const qNo = String(q.quotation_no || '').toLowerCase();
        const cName = String(q.customer_name || '').toLowerCase();
        const cId = String(q.customer_id || '').toLowerCase();
        const hasItem = Array.isArray(q.items) && q.items.some(it =>
          String(it.product_name || '').toLowerCase().includes(query) ||
          String(it.product_id || '').toLowerCase().includes(query)
        );
        return qNo.includes(query) || cName.includes(query) || cId.includes(query) || hasItem;
      }
      return true;
    });
  }, [savedQuotations, savedSearchQuery, savedStatusFilter]);

  // Statistics for saved quotations (Only Confirmed & Pending)
  const savedStats = useMemo(() => {
    const total = savedQuotations.length;
    const confirmed = savedQuotations.filter(q => String(q.order_status || '').toUpperCase() === 'CONFIRMED').length;
    const pending = total - confirmed;
    return { total, confirmed, pending };
  }, [savedQuotations]);

  // Native Print
  const handlePrint = async () => {
    if (activeTab !== 'preview') {
      setActiveTab('preview');
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    window.print();
  };

  // Render letterhead paper with fixed desktop A4 dimensions & crisp typography
  const renderLetterheadPaper = () => (
    <div
      id="quotation-letterhead-paper"
      ref={previewPaperRef}
      className="w-[794px] min-w-[794px] max-w-[794px] bg-white text-slate-900 px-5 py-8 shadow-2xl rounded-sm border border-slate-300 min-h-[1100px] flex flex-col justify-between"
      style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
    >
      <div>
        {/* Header: Company Name, Logo & Brand */}
        <div className="flex flex-row items-start justify-between border-b-2 border-indigo-600 pb-5 mb-5 gap-4">
          <div className="flex items-start gap-4 max-w-lg">
            <img
              src={aecLogo}
              alt="ARHAM ENGG CO."
              className="h-16 w-auto object-contain shrink-0"
            />
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                ARHAM ENGG CO.
              </h1>
              <p className="text-xs font-semibold text-indigo-700 uppercase tracking-widest mt-0.5">
                Distributors & Suppliers of Industrial & Electrical Items
              </p>
              <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                OLD NO.113 NEW NO.231, F4, FIRST FLOOR, RAJINI'S SHANMUGA BUILDING, Thambu Chetty St, Parrys, George Town, Chennai, Tamil Nadu 600001.
              </p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 text-[11px] text-slate-700 font-medium mt-1">
                <span>GSTIN: <strong className="font-mono text-slate-900 font-bold">33ADPPB7680M1Z3</strong></span>
                <span>Email: <strong className="font-semibold text-slate-900">ravibardia@hotmail.com</strong></span>
                <span>Website: <a id="letterhead-website-link" href="https://arhamenggco.in/" target="_blank" rel="noopener noreferrer" className="font-semibold text-indigo-700 hover:underline">https://arhamenggco.in/</a></span>
              </div>
            </div>
          </div>

          <div className="text-right space-y-1 self-start shrink-0">
            <div className="inline-block px-3 py-1 bg-indigo-50 border border-indigo-200 text-indigo-800 font-extrabold text-sm uppercase tracking-wider rounded">
              QUOTATION
            </div>
            <div className="text-xs font-mono font-bold text-slate-800">{quotationNo}</div>
            <div className="text-[11px] text-slate-500">Date: <strong className="text-slate-800">{formatDateOnly(quotationDate)}</strong></div>
            <div className="text-[11px] text-slate-500">Valid Till: <strong className="text-slate-800">{formatDateOnly(validUntil)}</strong></div>
          </div>
        </div>

        {/* Customer / Quotation-To Section */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs mb-5">
          <div className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider mb-1">QUOTATION TO:</div>
          <div className="font-bold text-sm text-slate-900">{selectedCustomer?.customer_name || 'Valued Customer'}</div>
          {selectedCustomer?.gstin && (
            <div className="text-slate-600 mt-0.5">GSTIN: <strong className="font-mono text-slate-800">{selectedCustomer.gstin}</strong></div>
          )}
          {selectedCustomer?.address && (
            <div className="text-slate-500 text-[11px] mt-1 leading-relaxed max-w-xl">{selectedCustomer.address}</div>
          )}
        </div>

        {/* Items Table - Strict fixed layout with maximized 102px Remark and 280px Item Description */}
        <div className="mb-6">
          <table className="w-full text-left text-xs border-collapse table-fixed" style={{ tableLayout: 'fixed', width: '100%' }}>
            <colgroup>
              <col style={{ width: '26px' }} />
              <col style={{ width: '280px' }} />
              <col style={{ width: '50px' }} />
              <col style={{ width: '35px' }} />
              <col style={{ width: '35px' }} />
              <col style={{ width: '92px' }} />
              <col style={{ width: '40px' }} />
              <col style={{ width: '94px' }} />
              <col style={{ width: '102px' }} />
            </colgroup>
            <thead>
              <tr className="border-y-2 border-slate-800 bg-slate-100 text-slate-800 font-bold uppercase text-[10px] tracking-wider">
                <th className="py-2 px-1 text-center whitespace-nowrap">#</th>
                <th className="py-2 px-2 text-left whitespace-nowrap">Item Description</th>
                <th className="py-2 px-1 text-center whitespace-nowrap">Make</th>
                <th className="py-2 px-1 text-center whitespace-nowrap">UOM</th>
                <th className="py-2 px-1 text-center whitespace-nowrap">Qty</th>
                <th className="py-2 px-1.5 text-right whitespace-nowrap">Rate</th>
                <th className="py-2 px-1 text-center whitespace-nowrap">Disc</th>
                <th className="py-2 px-1.5 text-right whitespace-nowrap">Amount</th>
                <th className="py-2 px-2 text-left whitespace-nowrap">Remark</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {items.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50">
                  <td className="py-2.5 px-1 text-center text-slate-400 font-mono text-[11px] align-top">{idx + 1}</td>
                  <td className="py-2.5 px-2 font-bold text-slate-900 text-[11px] leading-snug break-words align-top">
                    {item.product_name || 'Item'}
                  </td>
                  <td className="py-2.5 px-1 text-center font-medium text-slate-700 text-[11px] leading-tight break-words align-top">{item.make || '-'}</td>
                  <td className="py-2.5 px-1 text-center font-bold text-slate-800 text-[11px] align-top">{item.uom || 'Nos'}</td>
                  <td className="py-2.5 px-1 text-center font-mono font-bold text-slate-900 text-[11px] align-top">{item.qty}</td>
                  <td className="py-2.5 px-1.5 text-right font-mono text-slate-900 text-[11px] whitespace-nowrap align-top">
                    ₹{Number(item.rate || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-2.5 px-1 text-center font-mono text-slate-600 text-[10px] whitespace-nowrap align-top">
                    {parseFloat(item.discount_val) > 0 ? `${item.discount_val}${item.discount_type === 'fixed' ? '₹' : '%'}` : '-'}
                  </td>
                  <td className="py-2.5 px-1.5 text-right font-mono font-bold text-slate-900 text-[11px] whitespace-nowrap align-top">
                    ₹{Number(item.total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="py-2.5 px-2 text-left text-slate-600 text-[10px] italic leading-tight break-words align-top">
                    {item.remark || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-slate-800 text-xs">
              {/* Subtotal Row - exactly below Amount column */}
              <tr className="font-bold bg-slate-50/70 border-b border-slate-200">
                <td colSpan={7} className="py-2 px-2 text-right text-slate-700 font-bold uppercase text-[11px] tracking-wide">
                  Subtotal:
                </td>
                <td className="py-2 px-1.5 text-right font-mono font-bold text-slate-900 text-xs whitespace-nowrap">
                  ₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="py-2 px-1"></td>
              </tr>

              {/* Quotation Discount if applied */}
              {discountAmount > 0 && (
                <tr className="text-emerald-700 border-b border-slate-200">
                  <td colSpan={7} className="py-1.5 px-2 text-right font-semibold text-[11px]">
                    Discount ({discountType === 'percent' ? `${discountValue}%` : 'Flat'}):
                  </td>
                  <td className="py-1.5 px-1.5 text-right font-mono font-bold text-emerald-700 text-xs whitespace-nowrap">
                    -₹{discountAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="py-1.5 px-1"></td>
                </tr>
              )}

              {/* Taxable Amount if discount was present */}
              {discountAmount > 0 && (
                <tr className="text-slate-700 border-b border-slate-200 font-semibold">
                  <td colSpan={7} className="py-1.5 px-2 text-right text-[11px]">
                    Taxable Value:
                  </td>
                  <td className="py-1.5 px-1.5 text-right font-mono text-slate-900 text-xs whitespace-nowrap">
                    ₹{taxableAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="py-1.5 px-1"></td>
                </tr>
              )}

              {/* Tax Details */}
              {taxDetails.rate > 0 && (
                <>
                  {taxDetails.isSplit ? (
                    <>
                      <tr className="text-slate-600 text-[11px] border-b border-slate-100">
                        <td colSpan={7} className="py-1.5 px-2 text-right">
                          CGST (9%):
                        </td>
                        <td className="py-1.5 px-1.5 text-right font-mono text-xs whitespace-nowrap">
                          ₹{taxDetails.cgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-1.5 px-1"></td>
                      </tr>
                      <tr className="text-slate-600 text-[11px] border-b border-slate-100">
                        <td colSpan={7} className="py-1.5 px-2 text-right">
                          SGST (9%):
                        </td>
                        <td className="py-1.5 px-1.5 text-right font-mono text-xs whitespace-nowrap">
                          ₹{taxDetails.sgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-1.5 px-1"></td>
                      </tr>
                    </>
                  ) : (
                    <tr className="text-slate-600 text-[11px] border-b border-slate-100">
                      <td colSpan={7} className="py-1.5 px-2 text-right">
                        {taxDetails.label}:
                      </td>
                      <td className="py-1.5 px-1.5 text-right font-mono text-xs whitespace-nowrap">
                        ₹{taxDetails.totalTax.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-1.5 px-1"></td>
                    </tr>
                  )}
                </>
              )}

              {/* Freight Charges */}
              {parseFloat(freightCharges) > 0 && (
                <tr className="text-slate-700 text-[11px] border-b border-slate-100 font-semibold">
                  <td colSpan={7} className="py-1.5 px-2 text-right">
                    Freight Charges:
                  </td>
                  <td className="py-1.5 px-1.5 text-right font-mono text-slate-900 font-bold text-xs whitespace-nowrap">
                    +₹{(parseFloat(freightCharges) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="py-1.5 px-1"></td>
                </tr>
              )}

              {/* Round off */}
              {Math.abs(roundOff) > 0.001 && (
                <tr className="text-slate-500 text-[11px] border-b border-slate-100">
                  <td colSpan={7} className="py-1.5 px-2 text-right">
                    Round Off:
                  </td>
                  <td className="py-1.5 px-1.5 text-right font-mono text-xs whitespace-nowrap">
                    {roundOff > 0 ? `+₹${roundOff.toFixed(2)}` : `-₹${Math.abs(roundOff).toFixed(2)}`}
                  </td>
                  <td className="py-1.5 px-1"></td>
                </tr>
              )}

              {/* Grand Total */}
              <tr className="border-t-2 border-b-2 border-slate-900 bg-slate-100/90 text-slate-900 font-black">
                <td colSpan={7} className="py-3 px-2 text-right font-bold text-xs uppercase tracking-wider text-slate-900">
                  GRAND TOTAL (INR):
                </td>
                <td className="py-3 px-1.5 text-right font-mono text-indigo-700 font-extrabold text-sm whitespace-nowrap">
                  ₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="py-3 px-1"></td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Amount In Words Box */}
        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs mb-5">
          <span className="font-bold text-slate-700">Amount in Words: </span>
          <span className="italic text-slate-800">{amountInWords}</span>
        </div>

        {/* Terms and Notes */}
        <div className="text-[11px] text-slate-600 space-y-1 mb-6">
          <div className="font-bold text-slate-900 uppercase tracking-wider text-[10px]">Terms & Conditions:</div>
          <div className="whitespace-pre-line leading-relaxed">{terms}</div>
        </div>
      </div>

      {/* Footer / Signatures */}
      <div className="pt-4 border-t border-slate-200 flex justify-between items-end text-xs text-slate-500">
        <div>
          <p className="text-[10px] text-slate-400">This is a computer generated quotation.</p>
          <p className="text-[10px] text-slate-500 mt-0.5">
            Website: <a href="https://arhamenggco.in/" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline font-medium">https://arhamenggco.in/</a>
          </p>
        </div>

        <div className="text-right">
          <div className="font-bold text-slate-800 mb-7">For ARHAM ENGG CO.</div>
          <div className="border-t border-slate-400 pt-1 text-[11px] font-semibold text-slate-700 inline-block w-48 text-center">
            Authorized Signatory
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 pb-20">
      {/* Top Banner Header & Mode Navigation */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <FileText className="w-6 h-6 text-indigo-600 shrink-0" />
            Customer Quotation Generator
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Build itemized quotations with UOM, automated customer pricing, GST computation, and instant export to Excel, PDF, or Image.
          </p>
        </div>

        {/* View Switcher: Builder vs Letterhead Preview vs Saved & New Quotation */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 w-full lg:w-auto">
          <button
            type="button"
            onClick={handleNewQuotation}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer whitespace-nowrap"
            title="Create a fresh quotation and refresh form"
          >
            <Plus className="w-4 h-4 text-indigo-600 shrink-0" />
            <span>New Quotation</span>
          </button>

          <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 bg-slate-100 p-1.5 rounded-xl border border-slate-200 text-xs font-semibold w-full sm:w-auto">
            <button
              onClick={() => setActiveTab('builder')}
              className={`w-full sm:w-auto flex items-center justify-center gap-2 px-3.5 py-2.5 sm:py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'builder'
                  ? 'bg-white text-indigo-700 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Edit3 className="w-4 h-4 sm:w-3.5 sm:h-3.5 shrink-0" />
              <span>1. Edit & Configure</span>
            </button>
            <button
              onClick={() => setActiveTab('preview')}
              className={`w-full sm:w-auto flex items-center justify-center gap-2 px-3.5 py-2.5 sm:py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'preview'
                  ? 'bg-white text-indigo-700 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Eye className="w-4 h-4 sm:w-3.5 sm:h-3.5 shrink-0" />
              <span>2. Letterhead Preview</span>
            </button>
            <button
              onClick={() => {
                setActiveTab('saved');
                loadSavedQuotations();
              }}
              className={`w-full sm:w-auto flex items-center justify-center gap-2 px-3.5 py-2.5 sm:py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'saved'
                  ? 'bg-white text-indigo-700 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-4 h-4 sm:w-3.5 sm:h-3.5 shrink-0" />
              <span>3. Saved Quotations</span>
              {savedQuotations.length > 0 && (
                <span className="ml-1.5 px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded-full shrink-0">
                  {savedQuotations.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Export Feedback Alert */}
      {exportMessage && (
        <div className={`p-4 rounded-xl text-xs flex items-center gap-2 border animate-in fade-in ${exportMessage.type === 'success'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800 font-semibold'
            : exportMessage.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-indigo-50 border-indigo-200 text-indigo-800'
          }`}>
          {exportMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : exportMessage.type === 'error' ? (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          ) : (
            <RefreshCw className="w-4 h-4 text-indigo-600 animate-spin shrink-0" />
          )}
          <div className="flex-1">{exportMessage.text}</div>
          {exportMessage.actionLabel && exportMessage.onAction && (
            <button
              type="button"
              onClick={exportMessage.onAction}
              className="ml-auto px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 shadow-2xs"
            >
              {exportMessage.actionLabel}
            </button>
          )}
        </div>
      )}

      {/* Export Actions Sticky/Action Bar */}
      <div className="bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 text-white p-3.5 sm:p-4 rounded-2xl shadow-md">
        {/* Mobile Layout (sm:hidden) */}
        <div className="sm:hidden w-full flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] text-indigo-200 font-medium flex items-center gap-1.5 flex-wrap leading-tight">
                  <span>Grand Total (Incl. GST)</span>
                  {lastSavedTime && (
                    <span className="text-[9px] text-emerald-300 font-semibold bg-emerald-950/80 px-1.5 py-0.2 rounded-full border border-emerald-500/40">
                      ✓ Saved
                    </span>
                  )}
                  {currentOrderStatus === 'CONFIRMED' && (
                    <span className="text-[9px] text-emerald-300 font-bold bg-emerald-900/90 px-1.5 py-0.2 rounded-full border border-emerald-400/50 flex items-center gap-0.5">
                      <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                      Confirmed
                    </span>
                  )}
                </div>
                <div className="text-base font-bold font-mono tracking-tight text-white flex items-center gap-1">
                  ₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  <span className="text-[10px] text-slate-300 font-normal">({items.length} items)</span>
                </div>
              </div>
            </div>

            {/* Mobile Export Dropdown Trigger Button */}
            <div className="relative shrink-0" ref={exportDropdownRef}>
              <button
                type="button"
                onClick={() => setMobileExportOpen(!mobileExportOpen)}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-white rounded-xl text-xs font-bold border border-slate-700 shadow-sm cursor-pointer transition-all"
                title="Export or download quotation in Excel, PDF, Image or Print"
              >
                <Download className="w-3.5 h-3.5 text-indigo-400" />
                <span>Export</span>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-300 transition-transform duration-200 ${mobileExportOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Mobile Export Menu Popup */}
              {mobileExportOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-white text-slate-800 rounded-2xl shadow-2xl border border-slate-200/90 p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between border-b border-slate-100 mb-1">
                    <span>Export Quotation</span>
                    <span className="text-[9px] text-slate-400 font-normal">Select Format</span>
                  </div>

                  {/* Excel (.xlsx) */}
                  <button
                    type="button"
                    onClick={() => {
                      setMobileExportOpen(false);
                      handleExportExcel();
                    }}
                    disabled={isExporting}
                    className="w-full flex items-center gap-3 px-3 py-2 text-left rounded-xl hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 transition-colors cursor-pointer group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600 group-hover:bg-emerald-200 shrink-0">
                      <FileSpreadsheet className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold leading-tight flex items-center justify-between">
                        <span>Excel Spreadsheet</span>
                        <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-100/60 px-1.5 py-0.2 rounded">.xlsx</span>
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">Formatted table with GST</div>
                    </div>
                  </button>

                  {/* PDF Document (.pdf) */}
                  <button
                    type="button"
                    onClick={() => {
                      setMobileExportOpen(false);
                      handleExportPdf();
                    }}
                    disabled={isExporting}
                    className="w-full flex items-center gap-3 px-3 py-2 text-left rounded-xl hover:bg-rose-50 text-slate-700 hover:text-rose-800 transition-colors cursor-pointer group mt-0.5"
                  >
                    <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center text-rose-600 group-hover:bg-rose-200 shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold leading-tight flex items-center justify-between">
                        <span>PDF Document</span>
                        <span className="text-[10px] text-rose-600 font-semibold bg-rose-100/60 px-1.5 py-0.2 rounded">.pdf</span>
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">A4 Letterhead print format</div>
                    </div>
                  </button>

                  {/* Image (.png) */}
                  <button
                    type="button"
                    onClick={() => {
                      setMobileExportOpen(false);
                      handleExportImage();
                    }}
                    disabled={isExporting}
                    className="w-full flex items-center gap-3 px-3 py-2 text-left rounded-xl hover:bg-sky-50 text-slate-700 hover:text-sky-800 transition-colors cursor-pointer group mt-0.5"
                  >
                    <div className="w-8 h-8 rounded-lg bg-sky-100 flex items-center justify-center text-sky-600 group-hover:bg-sky-200 shrink-0">
                      <Image className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold leading-tight flex items-center justify-between">
                        <span>Image Export</span>
                        <span className="text-[10px] text-sky-600 font-semibold bg-sky-100/60 px-1.5 py-0.2 rounded">.png</span>
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">High-res for WhatsApp / share</div>
                    </div>
                  </button>

                  {/* Print Document */}
                  <button
                    type="button"
                    onClick={() => {
                      setMobileExportOpen(false);
                      handlePrint();
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 text-left rounded-xl hover:bg-slate-100 text-slate-700 hover:text-slate-900 transition-colors cursor-pointer group mt-0.5"
                  >
                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700 group-hover:bg-slate-200 shrink-0">
                      <Printer className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold leading-tight">Print Document</div>
                      <div className="text-[10px] text-slate-400 truncate">Standard system print dialog</div>
                    </div>
                  </button>

                </div>
              )}
            </div>
          </div>

          {/* Mobile Bottom Action Row */}
          <div className="flex items-center gap-2 pt-2 border-t border-indigo-800/40">
            {isOrderConfirmed ? (
              <span className="w-full flex items-center justify-center gap-1.5 py-2 px-2.5 bg-emerald-950/80 text-emerald-300 border border-emerald-400/50 rounded-xl text-xs font-bold truncate">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="truncate">Order Confirmed (Prices Locked)</span>
              </span>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleSaveToSheets}
                  disabled={isSaving || isExporting}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-900/30 transition-all disabled:opacity-50 cursor-pointer"
                  title="Save quotation"
                >
                  {isSaving ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  <span>{isSaving ? 'Saving...' : 'Save'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleInitiateConfirmOrder()}
                  disabled={isConfirmingOrder || isSaving || items.length === 0 || !selectedCustomerId}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-950/40 transition-all disabled:opacity-50 cursor-pointer"
                  title="Confirm order"
                >
                  {isConfirmingOrder ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
                  ) : (
                    <ShoppingBag className="w-3.5 h-3.5" />
                  )}
                  <span>{isConfirmingOrder ? 'Confirming...' : 'Confirm'}</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Desktop Layout (hidden sm:flex) */}
        <div className="hidden sm:flex flex-wrap items-center justify-between gap-4 w-full">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs text-indigo-200 font-medium flex items-center gap-2">
                <span>Grand Total (Incl. GST)</span>
                {lastSavedTime && (
                  <span className="text-[10px] text-emerald-300 font-semibold bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-500/40">
                    ✓ Saved ({lastSavedTime})
                  </span>
                )}
                {currentOrderStatus === 'CONFIRMED' && (
                  <span className="text-[10px] text-emerald-300 font-bold bg-emerald-900/90 px-2 py-0.5 rounded-full border border-emerald-400/50 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    Order Confirmed
                  </span>
                )}
              </div>
              <div className="text-lg font-bold font-mono tracking-tight text-white flex items-center gap-1">
                ₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                <span className="text-[11px] text-slate-300 font-normal">({items.length} items)</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isOrderConfirmed ? (
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1.5 px-3 py-2 bg-emerald-950/80 text-emerald-300 border border-emerald-400/50 rounded-xl text-xs font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  Order Confirmed (Prices Locked)
                </span>
              </div>
            ) : (
              <>
                {/* Save Quotation Button */}
                <button
                  onClick={handleSaveToSheets}
                  disabled={isSaving || isExporting}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-900/30 transition-all disabled:opacity-50 cursor-pointer"
                  title="Save this quotation and line items"
                >
                  {isSaving ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  {isSaving ? 'Saving...' : (isEditingExisting ? 'Update Quotation' : 'Save Quotation')}
                </button>

                {/* Confirm Order Button */}
                <button
                  onClick={() => handleInitiateConfirmOrder()}
                  disabled={isConfirmingOrder || isSaving || items.length === 0 || !selectedCustomerId}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-950/40 transition-all disabled:opacity-50 cursor-pointer"
                  title="Confirm order: permanently updates customer pricing and preserves price history"
                >
                  {isConfirmingOrder ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
                  ) : (
                    <ShoppingBag className="w-3.5 h-3.5" />
                  )}
                  {isConfirmingOrder ? 'Updating Prices...' : 'Confirm Order'}
                </button>
              </>
            )}

            {/* Excel Export Button */}
            <button
              onClick={handleExportExcel}
              disabled={isExporting}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-xs transition-all disabled:opacity-50 cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Excel (.xlsx)
            </button>

            {/* PDF Export Button */}
            <button
              onClick={handleExportPdf}
              disabled={isExporting}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold shadow-xs transition-all disabled:opacity-50 cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" />
              PDF Document
            </button>

            {/* Image Export Button */}
            <button
              onClick={handleExportImage}
              disabled={isExporting}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-semibold shadow-xs transition-all disabled:opacity-50 cursor-pointer"
            >
              <Image className="w-3.5 h-3.5" />
              Image (.png)
            </button>

            {/* Print Button */}
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold border border-slate-700 shadow-xs transition-all cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              Print
            </button>
          </div>
        </div>
      </div>

      {/* Export Progress Modal Overlay */}
      {isExporting && (
        <div className="fixed inset-0 z-[99999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 shadow-2xl border border-slate-200 max-w-sm w-full text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 mx-auto flex items-center justify-center">
              <RefreshCw className="w-6 h-6 animate-spin" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">Preparing Quotation Export</h3>
            <p className="text-xs text-slate-500 font-medium">
              {exportMessage?.text || 'Generating standard A4 document...'}
            </p>
          </div>
        </div>
      )}

      {/* TAB 1: BUILDER / EDITOR VIEW */}
      {activeTab === 'builder' && (
        <div className="space-y-6">
          {/* Confirmed Order Locked Banner */}
          {isOrderConfirmed && (
            <div className="bg-emerald-50 border-2 border-emerald-300 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-700 shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-bold text-emerald-950 flex items-center gap-2">
                    Confirmed Order #{quotationNo}
                    <span className="text-[11px] font-semibold bg-emerald-200/80 text-emerald-800 px-2.5 py-0.5 rounded-full">
                      Prices Locked & Synchronized
                    </span>
                  </div>
                  <p className="text-xs text-emerald-700 mt-0.5">
                    This order has been confirmed{currentConfirmedAt ? ` (${currentConfirmedAt})` : ''}. All customer catalog prices were updated and cannot be edited, re-priced, or re-confirmed.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 1. Header Information Grid */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 pb-3 border-b border-slate-100">
              <User className="w-4 h-4 text-indigo-600" />
              Customer & Quotation Details
              {isOrderConfirmed && (
                <span className="ml-auto text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-md">
                  Read Only
                </span>
              )}
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Select Customer */}
              <div className="sm:col-span-2 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700">Select Customer *</label>
                  {!isOrderConfirmed && (
                    <button
                      type="button"
                      onClick={loadData}
                      disabled={isInitialLoading}
                      className="text-[11px] font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-colors disabled:opacity-50"
                      title="Reload customers and products"
                    >
                      <RefreshCw className={`w-3 h-3 ${isInitialLoading ? 'animate-spin' : ''}`} />
                      Refresh
                    </button>
                  )}
                </div>
                <SearchableCustomerSelect
                  customers={customers}
                  value={selectedCustomerId}
                  onValueChange={setSelectedCustomerId}
                  placeholder="Search customer by name..."
                  isLoading={isInitialLoading}
                  disabled={isOrderConfirmed}
                />
                {loadError && (
                  <p className="text-[11px] text-rose-600 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    {loadError}
                  </p>
                )}
                {selectedCustomer && (
                  <div className="text-[11px] text-slate-500 flex items-center gap-3 pt-1">
                    <span>GSTIN: <strong className="font-mono text-slate-700">{selectedCustomer.gstin || 'N/A'}</strong></span>
                    {isPricesLoading && <span className="text-indigo-600 flex items-center gap-1"><RefreshCw className="w-3 h-3 animate-spin" /> Loading customer catalog...</span>}
                    {!isPricesLoading && (
                      <span className="text-slate-600 font-medium">
                        {allDropdownProducts.length} products available {customerPricedProducts.length > 0 && <span className="text-emerald-600">({customerPricedProducts.length} priced for customer)</span>}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Quotation Number (Auto-generated Unique ID) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                    <Hash className="w-3.5 h-3.5 text-slate-400" />
                    Quotation Number
                  </label>
                  <span className="text-[10px] text-slate-400 font-medium">
                    {isEditingExisting ? (
                      <span className="text-amber-700 bg-amber-50 border border-amber-300 px-2 py-0.5 rounded-md font-bold">
                        Editing Existing Quotation
                      </span>
                    ) : (
                      'Auto-generated'
                    )}
                  </span>
                </div>
                <div>
                  <input
                    type="text"
                    value={quotationNo}
                    readOnly
                    className="w-full h-11 bg-slate-100 border border-slate-200 text-slate-900 font-mono font-bold rounded-xl px-3 py-2 text-xs select-all cursor-default focus:outline-none"
                    title="Automatically generated unique quotation number"
                  />
                </div>
              </div>

              {/* Dates Grid (Quotation Date & Valid Until) */}
              <div className="space-y-1.5">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 flex items-center gap-1 mb-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      Date
                    </label>
                    <input
                      type="date"
                      value={formatDateOnly(quotationDate)}
                      onChange={(e) => setQuotationDate(e.target.value)}
                      disabled={isOrderConfirmed}
                      className="w-full h-11 bg-slate-50 border border-slate-300 text-slate-900 font-semibold rounded-xl px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                      Valid Till
                    </label>
                    <input
                      type="date"
                      value={formatDateOnly(validUntil)}
                      onChange={(e) => setValidUntil(e.target.value)}
                      disabled={isOrderConfirmed}
                      className="w-full h-11 bg-slate-50 border border-slate-300 text-slate-900 font-semibold rounded-xl px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 2. Interactive Line Items Table */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Tag className="w-4 h-4 text-indigo-600" />
                  Line Items & UOM Breakdown
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Select customer priced products or enter custom rates and UOM.
                </p>
              </div>

              {!isOrderConfirmed && (
                <div className="flex items-center gap-2">
                  {selectedCustomerId && (
                    <button
                      type="button"
                      onClick={addAllPricedItems}
                      disabled={customerPricedProducts.length === 0 || isPricesLoading}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-semibold transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Load all products configured with a price for this customer"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      Load All Priced Items ({customerPricedProducts.length})
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleOpenAddProductModal('', null)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-indigo-200 bg-white hover:bg-indigo-50/60 text-indigo-700 text-xs font-bold transition-all shadow-2xs cursor-pointer"
                    title="Add a brand new product to catalog and quotation"
                  >
                    <PackagePlus className="w-3.5 h-3.5 text-indigo-600" />
                    <span>New Product</span>
                  </button>
                  <button
                    type="button"
                    onClick={addItem}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    Add Line Item
                  </button>
                </div>
              )}
            </div>

            {/* Line Items Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs border-collapse min-w-[1140px]">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-700 bg-slate-50 font-bold tracking-wider">
                    <th className="py-2.5 px-2.5 w-10 text-center">#</th>
                    <th className="py-2.5 px-2.5 w-64">Product / Standard Name *</th>
                    <th className="py-2.5 px-2.5 w-32">Make / Brand</th>
                    <th className="py-2.5 px-2.5 w-24 text-center">UOM *</th>
                    <th className="py-2.5 px-2.5 w-20">Qty *</th>
                    <th className="py-2.5 px-2.5 w-32">Unit Rate (₹) *</th>
                    <th className="py-2.5 px-2.5 w-28 text-center">Disc</th>
                    <th className="py-2.5 px-2.5 w-32 text-right">Total Amount (₹)</th>
                    <th className="py-2.5 px-2.5 min-w-[160px]">Remark</th>
                    <th className="py-2.5 px-2.5 w-20 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {items.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Row Index */}
                      <td className="py-2 px-2.5 text-center font-mono font-bold text-slate-400">
                        {idx + 1}
                      </td>

                      {/* Product Name & Search (Strict single-line, fixed width) */}
                      <td className="py-2 px-2.5 w-64 max-w-[256px]">
                        <div className="w-full min-w-0">
                          <SearchableProductSelect
                            products={allDropdownProducts}
                            value={item.product_id}
                            onValueChange={(pid) => handleProductSelect(idx, pid)}
                            placeholder="Select product..."
                            isLoading={isInitialLoading}
                            compact={true}
                            disabled={isOrderConfirmed}
                            onAddNewProduct={(query) => handleOpenAddProductModal(query, idx)}
                          />
                        </div>
                      </td>

                      {/* Make / Brand */}
                      <td className="py-2 px-2.5 w-32">
                        <input
                          type="text"
                          value={item.make}
                          onChange={(e) => updateItemField(idx, 'make', e.target.value)}
                          disabled={isOrderConfirmed}
                          placeholder="Make / Brand"
                          className="w-full h-9 bg-slate-50 border border-slate-200 text-slate-900 font-medium rounded-lg px-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                        />
                      </td>

                      {/* UOM */}
                      <td className="py-2 px-2.5 w-24">
                        <UomSelect
                          value={item.uom}
                          onValueChange={(val) => updateItemField(idx, 'uom', val)}
                          options={COMMON_UOMS}
                          disabled={isOrderConfirmed}
                        />
                      </td>

                      {/* Quantity */}
                      <td className="py-2 px-2.5 w-20">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={item.qty}
                          onChange={(e) => updateItemField(idx, 'qty', e.target.value)}
                          disabled={isOrderConfirmed}
                          className="w-full h-9 bg-slate-50 border border-slate-200 text-slate-900 font-mono font-bold rounded-lg px-2 text-xs text-center focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                        />
                      </td>

                      {/* Unit Rate (₹) */}
                      <td className="py-2 px-2.5 w-32">
                        <div className="relative">
                          <span className="absolute left-2.5 top-2.5 text-slate-400 font-mono text-xs font-semibold">₹</span>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={item.rate !== undefined && item.rate !== null ? item.rate : ''}
                            onChange={(e) => updateItemField(idx, 'rate', e.target.value)}
                            disabled={isOrderConfirmed}
                            placeholder="0.00"
                            className={`w-full h-9 bg-slate-50 border text-slate-900 font-mono font-bold rounded-lg pl-6 pr-6 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white transition-all disabled:opacity-70 disabled:cursor-not-allowed ${item.isCustomPrice ? 'border-emerald-300 bg-emerald-50/20' : 'border-slate-200'
                              }`}
                          />
                          {item.isCustomPrice && (
                            <span
                              title="Configured customer catalog price applied"
                              className="absolute right-2 top-3 w-2 h-2 rounded-full bg-emerald-500 shadow-xs"
                            />
                          )}
                        </div>
                      </td>

                      {/* Line Item Discount */}
                      <td className="py-2 px-2.5 w-28">
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={item.discount_val !== undefined && item.discount_val !== null ? item.discount_val : ''}
                            onChange={(e) => updateItemField(idx, 'discount_val', e.target.value)}
                            disabled={isOrderConfirmed}
                            placeholder="0"
                            className="w-full h-9 bg-slate-50 border border-slate-200 text-slate-900 font-mono font-bold rounded-lg px-2 text-xs text-center focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                            title="Item discount value"
                          />
                          <button
                            type="button"
                            disabled={isOrderConfirmed}
                            onClick={() => updateItemField(idx, 'discount_type', item.discount_type === 'fixed' ? 'percent' : 'fixed')}
                            className="h-9 px-1.5 text-[11px] font-bold rounded-lg border border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all shrink-0 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
                            title="Click to toggle between percentage (%) and flat amount (₹)"
                          >
                            {item.discount_type === 'fixed' ? '₹' : '%'}
                          </button>
                        </div>
                      </td>

                      {/* Total Amount (₹) */}
                      <td className="py-2 px-2.5 w-32 text-right">
                        <div className="h-9 flex flex-col justify-center items-end">
                          <div className="font-mono font-bold text-slate-900 text-xs">
                            ₹{Number(item.total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                          {parseFloat(item.discount_val) > 0 && (
                            <div className="text-[10px] text-emerald-600 font-mono font-medium" title="Discounted net price per unit">
                              Net: ₹{computeItemDiscountedRate(item).toFixed(2)}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Remark */}
                      <td className="py-2 px-2.5 min-w-[160px]">
                        <input
                          type="text"
                          value={item.remark || ''}
                          onChange={(e) => updateItemField(idx, 'remark', e.target.value)}
                          disabled={isOrderConfirmed}
                          placeholder="Remark / specifications..."
                          className="w-full h-9 bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-lg px-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                        />
                      </td>

                      {/* Row Actions */}
                      <td className="py-2 px-2.5 w-20 text-center">
                        {isOrderConfirmed ? (
                          <span className="text-slate-300 text-xs font-mono">-</span>
                        ) : (
                          <div className="h-9 flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => moveItemUp(idx)}
                              disabled={idx === 0}
                              title="Move Up"
                              className="p-1.5 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-700 disabled:opacity-20 cursor-pointer"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveItemDown(idx)}
                              disabled={idx === items.length - 1}
                              title="Move Down"
                              className="p-1.5 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-700 disabled:opacity-20 cursor-pointer"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeItem(idx)}
                              disabled={items.length === 1}
                              title="Remove Line Item"
                              className="p-1.5 rounded hover:bg-rose-100 text-slate-400 hover:text-rose-600 disabled:opacity-20 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {!isOrderConfirmed && (
              <button
                type="button"
                onClick={addItem}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-slate-300 text-slate-600 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/50 text-xs font-semibold w-full justify-center transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Add Another Line Item
              </button>
            )}
          </div>

          {/* 3. Tax, Discount & Summary Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Tax & Discount Controls & Terms */}
            <div className="lg:col-span-7 bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-5">
              <h3 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100 flex items-center gap-2">
                <Percent className="w-4 h-4 text-indigo-600" />
                Taxes, Discount & Commercial Terms
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* GST / Tax Selection */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">GST / Tax Slab</label>
                  <select
                    value={taxType}
                    onChange={(e) => setTaxType(e.target.value)}
                    disabled={isOrderConfirmed}
                    className="w-full h-10 bg-slate-50 border border-slate-300 text-slate-900 font-semibold rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <option value="cgst_sgst_18">GST 18% (CGST 9% + SGST 9%) - Intra-state</option>
                    <option value="igst_18">IGST 18% - Inter-state</option>
                    <option value="gst_12">GST 12%</option>
                    <option value="gst_5">GST 5%</option>
                    <option value="exempt">Tax Exempted / Nil (0%)</option>
                  </select>
                </div>

                {/* Discount */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                    <label>Discount</label>
                    {!isOrderConfirmed && (
                      <div className="flex items-center gap-2 text-[10px]">
                        <button
                          type="button"
                          onClick={() => setDiscountType('percent')}
                          className={`font-bold ${discountType === 'percent' ? 'text-indigo-600' : 'text-slate-400'}`}
                        >
                          % Percent
                        </button>
                        <span>|</span>
                        <button
                          type="button"
                          onClick={() => setDiscountType('flat')}
                          className={`font-bold ${discountType === 'flat' ? 'text-indigo-600' : 'text-slate-400'}`}
                        >
                          ₹ Flat
                        </button>
                      </div>
                    )}
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    disabled={isOrderConfirmed}
                    placeholder="0"
                    className="w-full h-10 bg-slate-50 border border-slate-300 text-slate-900 font-mono font-bold rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                  {!isOrderConfirmed && parseFloat(discountValue) > 0 && (
                    <button
                      type="button"
                      onClick={handleApplyQuotationDiscountToAll}
                      className="mt-1.5 w-full flex items-center justify-center gap-1.5 py-1.5 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-[11px] font-semibold transition-all cursor-pointer shadow-2xs"
                      title="Distribute this quotation discount across all line items"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                      Apply Quotation Discount to All Items
                    </button>
                  )}
                </div>

                {/* Freight Charges */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                    <label className="flex items-center gap-1.5">
                      <Truck className="w-3.5 h-3.5 text-indigo-600" />
                      Freight Charges (₹)
                    </label>
                    {parseFloat(freightCharges) > 0 && (
                      <span className="text-[10px] text-emerald-600 font-bold">Added to Total</span>
                    )}
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={freightCharges}
                    onChange={(e) => setFreightCharges(e.target.value)}
                    disabled={isOrderConfirmed}
                    placeholder="0.00"
                    className="w-full h-10 bg-slate-50 border border-slate-300 text-slate-900 font-mono font-bold rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Commercial Terms */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Terms & Conditions</label>
                <textarea
                  rows={4}
                  value={terms}
                  onChange={(e) => setTerms(e.target.value)}
                  disabled={isOrderConfirmed}
                  className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            {/* Right: Calculated Summary */}
            <div className="lg:col-span-5 bg-gradient-to-br from-slate-50 to-indigo-50/40 border border-indigo-100 rounded-2xl p-6 shadow-xs flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-200">
                  Quotation Valuation
                </h3>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Subtotal:</span>
                    <span className="font-mono font-bold text-slate-900">
                      ₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>

                  {discountAmount > 0 && (
                    <div className="flex items-center justify-between text-emerald-700">
                      <span>Discount ({discountType === 'percent' ? `${discountValue}%` : 'Flat'}):</span>
                      <span className="font-mono font-bold">
                        -₹{discountAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-slate-700 pt-1 border-t border-slate-200/60 font-semibold">
                    <span>Taxable Amount:</span>
                    <span className="font-mono text-slate-900">
                      ₹{taxableAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>

                  {taxDetails.rate > 0 && (
                    <>
                      {taxDetails.isSplit ? (
                        <>
                          <div className="flex items-center justify-between text-slate-500 pl-2">
                            <span>CGST (9%):</span>
                            <span className="font-mono font-medium text-slate-800">
                              ₹{taxDetails.cgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-slate-500 pl-2">
                            <span>SGST (9%):</span>
                            <span className="font-mono font-medium text-slate-800">
                              ₹{taxDetails.sgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="flex items-center justify-between text-slate-600">
                          <span>{taxDetails.label}:</span>
                          <span className="font-mono font-medium text-slate-800">
                            ₹{taxDetails.totalTax.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      )}
                    </>
                  )}

                  {parseFloat(freightCharges) > 0 && (
                    <div className="flex items-center justify-between text-slate-700">
                      <span className="flex items-center gap-1 font-medium">
                        <Truck className="w-3.5 h-3.5 text-indigo-500" />
                        Freight Charges:
                      </span>
                      <span className="font-mono font-bold text-slate-900">
                        +₹{(parseFloat(freightCharges) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}

                  {Math.abs(roundOff) > 0.001 && (
                    <div className="flex items-center justify-between text-slate-400 text-[11px]">
                      <span>Round Off:</span>
                      <span className="font-mono">
                        {roundOff > 0 ? `+₹${roundOff.toFixed(2)}` : `-₹${Math.abs(roundOff).toFixed(2)}`}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Grand Total Box */}
              <div className="pt-3 border-t border-indigo-200/80 space-y-2">
                <div className="bg-indigo-600 text-white p-4 rounded-xl flex items-center justify-between shadow-xs">
                  <div>
                    <div className="text-[11px] text-indigo-100 font-semibold uppercase tracking-wider">Grand Total (INR)</div>
                    <div className="text-xl sm:text-2xl font-bold font-mono">
                      ₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>

                  {/* Export Options Dropdown */}
                  <div className="relative" ref={bottomExportDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setBottomExportOpen(!bottomExportOpen)}
                      className="flex items-center gap-1.5 px-3 py-2 bg-indigo-700 hover:bg-indigo-800 text-white rounded-xl text-xs font-bold border border-indigo-400/40 shadow-xs cursor-pointer transition-all"
                      title="Export quotation options"
                    >
                      <Download className="w-3.5 h-3.5 text-indigo-200" />
                      <span>Export</span>
                      <ChevronDown className={`w-3.5 h-3.5 text-indigo-200 transition-transform duration-200 ${bottomExportOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {bottomExportOpen && (
                      <div className="absolute right-0 bottom-full mb-2 w-64 bg-white text-slate-800 rounded-2xl shadow-2xl border border-slate-200/90 p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                        <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between border-b border-slate-100 mb-1">
                          <span>Export Quotation</span>
                          <span className="text-[9px] text-slate-400 font-normal">Select Format</span>
                        </div>

                        {/* Excel (.xlsx) */}
                        <button
                          type="button"
                          onClick={() => {
                            setBottomExportOpen(false);
                            handleExportExcel();
                          }}
                          disabled={isExporting}
                          className="w-full flex items-center gap-3 px-3 py-2 text-left rounded-xl hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 transition-colors cursor-pointer group"
                        >
                          <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600 group-hover:bg-emerald-200 shrink-0">
                            <FileSpreadsheet className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-bold leading-tight flex items-center justify-between">
                              <span>Excel Spreadsheet</span>
                              <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-100/60 px-1.5 py-0.2 rounded">.xlsx</span>
                            </div>
                            <div className="text-[10px] text-slate-400 truncate">Formatted table with GST</div>
                          </div>
                        </button>

                        {/* PDF Document (.pdf) */}
                        <button
                          type="button"
                          onClick={() => {
                            setBottomExportOpen(false);
                            handleExportPdf();
                          }}
                          disabled={isExporting}
                          className="w-full flex items-center gap-3 px-3 py-2 text-left rounded-xl hover:bg-rose-50 text-slate-700 hover:text-rose-800 transition-colors cursor-pointer group mt-0.5"
                        >
                          <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center text-rose-600 group-hover:bg-rose-200 shrink-0">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-bold leading-tight flex items-center justify-between">
                              <span>PDF Document</span>
                              <span className="text-[10px] text-rose-600 font-semibold bg-rose-100/60 px-1.5 py-0.2 rounded">.pdf</span>
                            </div>
                            <div className="text-[10px] text-slate-400 truncate">A4 Letterhead print format</div>
                          </div>
                        </button>

                        {/* Image (.png) */}
                        <button
                          type="button"
                          onClick={() => {
                            setBottomExportOpen(false);
                            handleExportImage();
                          }}
                          disabled={isExporting}
                          className="w-full flex items-center gap-3 px-3 py-2 text-left rounded-xl hover:bg-sky-50 text-slate-700 hover:text-sky-800 transition-colors cursor-pointer group mt-0.5"
                        >
                          <div className="w-8 h-8 rounded-lg bg-sky-100 flex items-center justify-center text-sky-600 group-hover:bg-sky-200 shrink-0">
                            <Image className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-bold leading-tight flex items-center justify-between">
                              <span>Image Export</span>
                              <span className="text-[10px] text-sky-600 font-semibold bg-sky-100/60 px-1.5 py-0.2 rounded">.png</span>
                            </div>
                            <div className="text-[10px] text-slate-400 truncate">High-res for WhatsApp / share</div>
                          </div>
                        </button>

                        {/* Print Document */}
                        <button
                          type="button"
                          onClick={() => {
                            setBottomExportOpen(false);
                            handlePrint();
                          }}
                          className="w-full flex items-center gap-3 px-3 py-2 text-left rounded-xl hover:bg-slate-100 text-slate-700 hover:text-slate-900 transition-colors cursor-pointer group mt-0.5"
                        >
                          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700 group-hover:bg-slate-200 shrink-0">
                            <Printer className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-bold leading-tight">Print Document</div>
                            <div className="text-[10px] text-slate-400 truncate">Standard system print dialog</div>
                          </div>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="text-[11px] text-slate-500 italic bg-white/80 p-2.5 rounded-lg border border-slate-200">
                  <span className="font-semibold text-slate-700 not-italic">In Words: </span>
                  {amountInWords}
                </div>

                {isOrderConfirmed ? (
                  <div className="pt-2">
                    <div className="p-3 bg-emerald-100/80 border border-emerald-300 rounded-xl text-center text-xs font-bold text-emerald-800 flex items-center justify-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Order Confirmed - Prices Permanently Locked
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                    <button
                      type="button"
                      onClick={handleSaveToSheets}
                      disabled={isSaving || isExporting}
                      className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50 cursor-pointer text-center"
                      title="Save this quotation to database"
                    >
                      {isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-white shrink-0" /> : <Save className="w-3.5 h-3.5 shrink-0" />}
                      <span className="truncate">{isSaving ? 'Saving...' : 'Save Quotation'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleInitiateConfirmOrder()}
                      disabled={isConfirmingOrder || isSaving || items.length === 0 || !selectedCustomerId}
                      className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm shadow-emerald-950/20 transition-all disabled:opacity-50 cursor-pointer text-center"
                      title="Confirm order & update customer catalog with discounted prices"
                    >
                      {isConfirmingOrder ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-white shrink-0" /> : <ShoppingBag className="w-3.5 h-3.5 shrink-0" />}
                      <span className="truncate">{isConfirmingOrder ? 'Confirming...' : 'Confirm Order'}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: LETTERHEAD PREVIEW (Interactive Responsive View & PDF Target) */}
      <div className={`${activeTab === 'preview' ? 'block' : 'hidden'} space-y-4`}>
        {/* Paper Container (Styled for standard A4 document layout with dynamic responsive scaling) */}
        <div 
          ref={previewContainerRef}
          className="w-full bg-slate-200/60 rounded-2xl p-2 sm:p-6 flex flex-col items-center"
        >
          {previewScale < 1 && previewZoomMode === 'fit' ? (
            <div className="w-full flex justify-center py-2 overflow-hidden">
              {/* Sized container that matches the exact scaled dimensions */}
              <div
                className="relative shadow-2xl rounded-sm bg-white shrink-0 overflow-hidden"
                style={{
                  width: `${Math.round(794 * previewScale)}px`,
                  height: `${Math.round((paperHeight || 1120) * previewScale)}px`
                }}
              >
                {/* Scaled letterhead element using top-left origin */}
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '794px',
                    minWidth: '794px',
                    maxWidth: '794px',
                    transform: `scale(${previewScale})`,
                    transformOrigin: 'top left'
                  }}
                >
                  {renderLetterheadPaper()}
                </div>
              </div>
            </div>
          ) : (
            <div className="w-full overflow-x-auto flex justify-start sm:justify-center p-1 sm:p-4">
              {renderLetterheadPaper()}
            </div>
          )}

          {/* Swipe indicator when user selects 100% zoom on a mobile screen */}
          {previewScale < 1 && previewZoomMode === '100' && (
            <div className="mt-3 text-[11px] text-slate-600 flex items-center gap-1.5 bg-white/95 px-3.5 py-1.5 rounded-full border border-slate-300 shadow-2xs">
              <span>↔ Swipe left or right to inspect the full document</span>
            </div>
          )}
        </div>
      </div>

      {/* TAB 3: SAVED QUOTATIONS VIEW */}
      {activeTab === 'saved' && (
        <div className="space-y-6">
          {/* Top summary header with statistics */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Layers className="w-5 h-5 text-indigo-600" />
                  Saved Quotations Catalog
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  View and manage all saved quotations. Load any quotation to modify and re-save, or confirm the order to update customer pricing with automatic price history.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto">
                <button
                  onClick={loadSavedQuotations}
                  disabled={isLoadingSavedQuotations}
                  className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 sm:py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold border border-slate-200 transition-all cursor-pointer disabled:opacity-50 whitespace-nowrap"
                  title="Reload quotations list"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingSavedQuotations ? 'animate-spin text-indigo-600' : ''}`} />
                  {isLoadingSavedQuotations ? 'Syncing...' : 'Refresh List'}
                </button>
              </div>
            </div>

            {/* Quick Metrics (Confirmed Orders & Pending Confirmation Only) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
              <div className="p-4 bg-emerald-50/70 rounded-xl border border-emerald-200/60 flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-emerald-700 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Confirmed Orders
                  </div>
                  <div className="text-2xl font-bold text-emerald-900 mt-1">{savedStats.confirmed}</div>
                </div>
                <div className="text-[11px] text-emerald-700/80 font-medium bg-emerald-100/60 px-2.5 py-1 rounded-lg">
                  Prices locked & updated
                </div>
              </div>
              <div className="p-4 bg-amber-50/70 rounded-xl border border-amber-200/60 flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-amber-700 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-amber-600" />
                    Pending Confirmation
                  </div>
                  <div className="text-2xl font-bold text-amber-900 mt-1">{savedStats.pending}</div>
                </div>
                <div className="text-[11px] text-amber-700/80 font-medium bg-amber-100/60 px-2.5 py-1 rounded-lg">
                  Awaiting confirmation
                </div>
              </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by Quotation #, Customer Name, or Product..."
                  value={savedSearchQuery}
                  onChange={(e) => setSavedSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold w-full sm:w-auto overflow-x-auto">
                <button
                  onClick={() => setSavedStatusFilter('all')}
                  className={`flex-1 sm:flex-none text-center px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${savedStatusFilter === 'all'
                      ? 'bg-white text-slate-900 shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                  All ({savedStats.total})
                </button>
                <button
                  onClick={() => setSavedStatusFilter('CONFIRMED')}
                  className={`flex-1 sm:flex-none text-center px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${savedStatusFilter === 'CONFIRMED'
                      ? 'bg-white text-emerald-700 shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                  Confirmed ({savedStats.confirmed})
                </button>
                <button
                  onClick={() => setSavedStatusFilter('PENDING')}
                  className={`flex-1 sm:flex-none text-center px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${savedStatusFilter === 'PENDING'
                      ? 'bg-white text-amber-700 shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                  Pending ({savedStats.pending})
                </button>
              </div>
            </div>
          </div>

          {/* Quotations List */}
          {isLoadingSavedQuotations ? (
            <div className="bg-white border border-slate-200/80 rounded-2xl p-12 text-center shadow-xs">
              <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-3" />
              <div className="text-sm font-bold text-slate-800">Loading saved quotations...</div>
              <p className="text-xs text-slate-500 mt-1">Fetching your quotation records and line items</p>
            </div>
          ) : filteredSavedQuotations.length === 0 ? (
            <div className="bg-white border border-slate-200/80 rounded-2xl p-12 text-center shadow-xs">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
                <FileText className="w-7 h-7" />
              </div>
              <div className="text-sm font-bold text-slate-800">
                {savedQuotations.length === 0 ? 'No Saved Quotations Found' : 'No matching quotations found'}
              </div>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                {savedQuotations.length === 0
                  ? 'Build a quotation in the Edit & Configure tab and click "Save Quotation" to store it permanently.'
                  : 'Try clearing your search query or switching the status filter.'}
              </p>
              {savedQuotations.length === 0 && (
                <button
                  onClick={() => setActiveTab('builder')}
                  className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-500 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Create Your First Quotation
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredSavedQuotations.map((q) => {
                const isConfirmed = String(q.order_status || '').toUpperCase() === 'CONFIRMED';
                const itemsCount = Array.isArray(q.items) ? q.items.length : 0;

                return (
                  <div
                    key={q.quotation_no}
                    className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs hover:border-indigo-200 transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-5"
                  >
                    <div className="space-y-3 flex-1 min-w-0">
                      {/* Top status & Quotation No line */}
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="font-mono text-sm font-extrabold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200/80">
                          {q.quotation_no}
                        </span>

                        {isConfirmed ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-100/90 border border-emerald-300 px-2.5 py-0.5 rounded-full">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            ORDER CONFIRMED
                            {q.confirmed_at && (
                              <span className="font-normal text-[10px] text-emerald-700">({formatDateOnly(q.confirmed_at)})</span>
                            )}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-300 px-2.5 py-0.5 rounded-full">
                            <Clock className="w-3.5 h-3.5 text-amber-600" />
                            PENDING ORDER CONFIRMATION
                          </span>
                        )}

                        <span className="text-[11px] text-slate-400">
                          Date: <span className="font-medium text-slate-700">{formatDateOnly(q.quotation_date) || 'N/A'}</span>
                        </span>
                        {q.valid_until && (
                          <span className="text-[11px] text-slate-400">
                            Valid Till: <span className="font-medium text-slate-700">{formatDateOnly(q.valid_until)}</span>
                          </span>
                        )}
                      </div>

                      {/* Customer Name & Info (Customer ID removed as requested) */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          {q.customer_name || 'Customer'}
                        </div>
                        {q.customer_gstin && (
                          <div className="text-[11px] text-slate-500">
                            GSTIN: <span className="font-mono">{q.customer_gstin}</span>
                          </div>
                        )}
                      </div>

                      {/* Items Preview Chips */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="text-[11px] font-semibold text-slate-500 mr-1">
                          {itemsCount} item{itemsCount === 1 ? '' : 's'}:
                        </span>
                        {(q.items || []).slice(0, 4).map((it, idx) => (
                          <span
                            key={idx}
                            className="text-[11px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md border border-slate-200/80 max-w-[200px] truncate"
                            title={`${it.product_name} - ₹${it.rate} x ${it.qty} ${it.uom}`}
                          >
                            {it.product_name || `Item ${idx + 1}`} ({it.qty} {it.uom})
                          </span>
                        ))}
                        {itemsCount > 4 && (
                          <span className="text-[10px] text-slate-400 font-medium">
                            +{itemsCount - 4} more
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right side: Amount & Action Buttons */}
                    <div className="flex flex-col sm:flex-row lg:flex-col items-start sm:items-center lg:items-end justify-between gap-3 shrink-0 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100 w-full lg:w-auto">
                      <div className="text-left lg:text-right w-full sm:w-auto">
                        <div className="text-[11px] text-slate-400 font-medium">Grand Total (Incl. GST)</div>
                        <div className="text-xl font-bold font-mono text-indigo-700">
                          ₹{Number(q.grand_total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </div>

                      {/* Action Buttons: Stacked one after the other on mobile, row on desktop */}
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                        {isConfirmed ? (
                          <>
                            <span className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-emerald-50 text-emerald-800 text-xs font-bold rounded-xl border border-emerald-200 whitespace-nowrap">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                              <span>Order Confirmed (Locked)</span>
                            </span>

                            {/* View Letterhead Preview Button */}
                            <button
                              onClick={() => {
                                handleLoadQuotation(q);
                                setActiveTab('preview');
                              }}
                              className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold border border-indigo-200 transition-all cursor-pointer shadow-2xs whitespace-nowrap"
                              title="View quotation letterhead & export"
                            >
                              <Eye className="w-4 h-4 text-indigo-600 shrink-0" />
                              <span>View Quotation</span>
                            </button>
                          </>
                        ) : (
                          <>
                            {/* Load & Edit Button */}
                            <button
                              onClick={() => handleLoadQuotation(q)}
                              className="w-full sm:w-auto flex items-center justify-center gap-2 px-3.5 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold border border-indigo-200/80 transition-all cursor-pointer shadow-2xs whitespace-nowrap"
                              title="Load this quotation into the builder to edit, change items, or re-calculate"
                            >
                              <Edit3 className="w-4 h-4 text-indigo-600 shrink-0" />
                              <span>Load & Edit</span>
                            </button>

                            {/* Confirm Order Button */}
                            <button
                              onClick={() => handleInitiateConfirmOrder(q)}
                              disabled={isConfirmingOrder}
                              className="w-full sm:w-auto flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/20 disabled:opacity-50 whitespace-nowrap"
                              title="Confirm order: permanently updates customer catalog pricing and adds old prices to Price History"
                            >
                              <ShoppingBag className="w-4 h-4 shrink-0" />
                              <span>Confirm Order</span>
                            </button>

                            {/* Letterhead Preview Button */}
                            <button
                              onClick={() => {
                                handleLoadQuotation(q);
                                setActiveTab('preview');
                              }}
                              className="w-full sm:w-auto flex items-center justify-center gap-2 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold border border-slate-200 transition-all cursor-pointer whitespace-nowrap"
                              title="View on company letterhead"
                            >
                              <Eye className="w-4 h-4 text-slate-500 shrink-0" />
                              <span>Preview</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* CONFIRM ORDER MODAL */}
      {confirmOrderModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full p-6 space-y-5 my-8">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 tracking-tight">
                    Confirm Quotation Order
                  </h3>
                  <p className="text-xs text-slate-500">
                    Quotation #{confirmOrderModal.quotation_no} • {confirmOrderModal.customer_name}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setConfirmOrderModal(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-all cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Price History & Catalog Info Banner */}
            <div className="p-3.5 bg-emerald-50/80 rounded-xl border border-emerald-200 text-xs text-emerald-900 space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-emerald-800">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                Automated Customer Price Update (Discounted Price)
              </div>
              <p className="leading-relaxed text-emerald-950/80">
                Confirming this order will permanently update customer pricing in the customer catalog with each item's <strong>discounted price</strong>. Previous prices are safely moved to <strong>Previous Price</strong> and archived with date in <strong>Price History</strong>.
              </p>
            </div>

            {/* Items List Preview */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-700 flex items-center justify-between">
                <span>Line Items to Update ({confirmOrderModal.items?.length || 0}):</span>
                {confirmOrderModal.grand_total && (
                  <span className="font-mono text-indigo-700">
                    Grand Total: ₹{Number(confirmOrderModal.grand_total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                )}
              </div>

              <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 text-xs">
                {(confirmOrderModal.items || []).map((it, idx) => {
                  const effectivePriceToSet = computeItemDiscountedRate(it, confirmOrderModal);
                  const originalRate = Number(it.rate !== undefined && it.rate !== '' ? it.rate : (it.price !== undefined ? it.price : 0)) || 0;
                  const hasDiscount = effectivePriceToSet < originalRate || (parseFloat(it.discount_val) > 0);
                  const discountDiff = Math.max(0, originalRate - effectivePriceToSet);
                  const discountPct = originalRate > 0 ? ((discountDiff / originalRate) * 100).toFixed(1) : 0;

                  const existingRec = (customerPrices || []).find(cp =>
                    (cp.product_id && it.product_id && String(cp.product_id).toUpperCase() === String(it.product_id).toUpperCase()) ||
                    (cp.standard_name && it.product_name && String(cp.standard_name).toUpperCase() === String(it.product_name).toUpperCase())
                  );
                  const currentPrice = existingRec ? parseFloat(existingRec.price) : null;
                  const isChanged = currentPrice !== null && !isNaN(currentPrice) && currentPrice !== effectivePriceToSet;

                  return (
                    <div key={idx} className="p-3 flex items-center justify-between gap-3 hover:bg-slate-50/80">
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-slate-800 truncate">
                          {it.product_name || `Item ${idx + 1}`}
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                          {it.product_id && <span className="font-mono">ID: {it.product_id}</span>}
                          <span>Qty: {it.qty || 1} {it.uom || 'Nos'}</span>
                          {hasDiscount && (
                            <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 font-semibold text-[10px]">
                              {it.discount_val ? `Disc: ${it.discount_val}${it.discount_type === 'fixed' ? '₹' : '%'}` : `Disc: -${discountPct}% (₹${discountDiff.toFixed(2)})`}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="font-mono font-bold text-emerald-700 flex items-center justify-end gap-1.5">
                          <span>₹{effectivePriceToSet.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          {hasDiscount && (
                            <span className="text-[10px] text-slate-400 line-through font-normal">
                              ₹{originalRate.toFixed(2)}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] mt-0.5">
                          {existingRec && !isNaN(currentPrice) ? (
                            isChanged ? (
                              <span className="text-amber-600 font-medium">
                                Current ₹{currentPrice.toFixed(2)} → Moves to Price History
                              </span>
                            ) : (
                              <span className="text-slate-400">Matches current catalog price</span>
                            )
                          ) : (
                            <span className="text-indigo-600 font-medium">New catalog price</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setConfirmOrderModal(null)}
                disabled={isConfirmingOrder}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleExecuteConfirmOrder}
                disabled={isConfirmingOrder}
                className="flex items-center gap-1.5 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-950/20 transition-all cursor-pointer disabled:opacity-50"
              >
                {isConfirmingOrder ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                )}
                {isConfirmingOrder ? 'Updating Pricing...' : 'Yes, Confirm Order & Update Pricing'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Add Product Modal */}
      {isAddProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in-0 duration-200">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4 animate-in zoom-in-95 duration-200 text-slate-800">
            {/* Header */}
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200/80 flex items-center justify-center text-indigo-600 shrink-0">
                  <PackagePlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Add New Product</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Save directly to Google Sheets and use in this quotation
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddProductModalOpen(false)}
                disabled={isSavingProduct}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateProductSubmit} className="space-y-3.5">
              {addProductError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{addProductError}</span>
                </div>
              )}

              {/* Standard Product Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Product / Standard Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newProdName}
                  onChange={(e) => setNewProdName(e.target.value)}
                  placeholder="e.g. Polycab 4 Core 2.5 Sqmm Copper Armoured Cable"
                  autoFocus
                  className="w-full h-10 px-3.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white transition-all shadow-inner"
                />
              </div>

              {/* Make / Brand */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Make / Brand <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={newProdMake}
                  onChange={(e) => setNewProdMake(e.target.value)}
                  placeholder="e.g. Polycab, Finolex, Siemens, L&T, Precision..."
                  className="w-full h-10 px-3.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white transition-all shadow-inner"
                />
              </div>

              {/* 2-column: Product ID & UOM */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Product ID <span className="text-slate-400 font-normal">(Auto-generated)</span>
                  </label>
                  <input
                    type="text"
                    value={newProdId}
                    onChange={(e) => setNewProdId(e.target.value)}
                    placeholder="PROD-101"
                    className="w-full h-10 px-3.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white transition-all shadow-inner"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    UOM <span className="text-slate-400 font-normal">(Unit of Measure)</span>
                  </label>
                  <select
                    value={newProdUom}
                    onChange={(e) => setNewProdUom(e.target.value)}
                    className="w-full h-10 px-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white transition-all shadow-inner cursor-pointer"
                  >
                    {COMMON_UOMS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Quotation Unit Rate */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Quotation Unit Rate (₹) <span className="text-slate-400 font-normal">(Optional for this quotation)</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-xs font-bold text-slate-400">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newProdRate}
                    onChange={(e) => setNewProdRate(e.target.value)}
                    placeholder="0.00"
                    className="w-full h-10 pl-8 pr-3.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white transition-all shadow-inner"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  If entered, this rate will be auto-filled for this product in your quotation.
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddProductModalOpen(false)}
                  disabled={isSavingProduct}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingProduct || !newProdName.trim()}
                  className="flex items-center gap-1.5 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-950/20 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSavingProduct ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
                  ) : (
                    <PackagePlus className="w-3.5 h-3.5" />
                  )}
                  <span>{isSavingProduct ? 'Saving to Google Sheets...' : 'Save Product & Add to Quotation'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
