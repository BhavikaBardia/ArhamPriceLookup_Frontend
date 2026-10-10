import React, { useState, useEffect, useMemo, useRef } from 'react';
import { api } from '../api';
import { SearchableCustomerSelect, SearchableProductSelect } from '../components/ui/SearchableSelect';
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import {
  FileText, Download, Printer, Plus, Trash2, ArrowUp, ArrowDown,
  Sparkles, User, Tag, Calendar, Hash, Percent, DollarSign,
  CheckCircle2, AlertCircle, RefreshCw, Eye, Edit3, Image, FileSpreadsheet,
  Building2, Phone, Mail, MapPin, Copy, Layers
} from 'lucide-react';

// Common Indian UOMs (Units of Measure)
const COMMON_UOMS = [
  'Nos', 'Pcs', 'Mtr', 'Set', 'Kg', 'Box', 'Pkt', 'Roll', 'Ltr', 'Sq.Mtr', 'Drum', 'Pair', 'Bundle'
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

export function Quotation({ initialCustomerId = '' }) {
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
  
  // Quotation Metadata
  const [quotationNo, setQuotationNo] = useState(() => {
    const d = new Date();
    const yr = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const rnd = Math.floor(1000 + Math.random() * 9000);
    return `ARH-QT-${yr}${mo}-${rnd}`;
  });

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
      description: '',
      uom: 'Nos',
      qty: 1,
      rate: '',
      total: 0,
      isCustomPrice: false
    }
  ]);

  // Tax & Discount Settings
  const [taxType, setTaxType] = useState('cgst_sgst_18'); // 'cgst_sgst_18', 'igst_18', 'gst_12', 'gst_5', 'exempt'
  const [discountType, setDiscountType] = useState('percent'); // 'percent' or 'flat'
  const [discountValue, setDiscountValue] = useState(0);

  // Terms & Notes
  const [terms, setTerms] = useState(
    '1. Prices are valid for 30 days from the quotation date.\n2. Payment Terms: 100% advance or as agreed.\n3. Delivery: Ex-stock or within 7-10 working days upon confirmed P.O.\n4. GST will be charged extra as applicable.'
  );

  // View mode: 'builder' or 'preview'
  const [activeTab, setActiveTab] = useState('builder');
  const [isExporting, setIsExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState(null);

  const previewPaperRef = useRef(null);

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
      const rateNum = parseFloat(autoRate) || 0;

      next[index] = {
        ...cur,
        product_id: selectedProd.product_id,
        product_name: selectedProd.standard_name,
        make: selectedProd.make || '',
        rate: autoRate !== '' ? autoRate : (cur.rate || ''),
        total: (qty * (autoRate !== '' ? rateNum : (parseFloat(cur.rate) || 0))),
        isCustomPrice: isCatalogPrice
      };
      return next;
    });
  };

  // Update item field
  const updateItemField = (index, field, value) => {
    setItems(prevItems => {
      const next = [...prevItems];
      const item = { ...next[index], [field]: value };

      if (field === 'qty' || field === 'rate') {
        const q = parseFloat(field === 'qty' ? value : item.qty) || 0;
        const r = parseFloat(field === 'rate' ? value : item.rate) || 0;
        item.total = q * r;
      }

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
        description: '',
        uom: 'Nos',
        qty: 1,
        rate: '',
        total: 0,
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
        description: '',
        uom: 'Nos',
        qty: 1,
        rate: '',
        total: 0,
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
      description: '',
      uom: 'Nos',
      qty: 1,
      rate: Number(cp.price),
      total: Number(cp.price),
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

  const rawGrandTotal = taxableAmount + taxDetails.totalTax;
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
        ['Email: ravibardia@hotmail.com'],
        ['Commercial Product Price Quotation'],
        [''],
        ['Quotation No:', quotationNo, '', 'Date:', quotationDate],
        ['Customer Name:', custName, '', 'Valid Until:', validUntil],
        ['GSTIN:', custGstin, '', 'Currency:', 'INR (₹)'],
        [''],
        ['#', 'Item / Product Name', 'Make / Brand', 'Description / Specs', 'UOM', 'Qty', 'Unit Rate (₹)', 'Total Amount (₹)'],
        ...items.map((item, idx) => [
          idx + 1,
          item.product_name || 'Custom Product',
          item.make || '-',
          item.description || '-',
          item.uom || 'Nos',
          Number(item.qty) || 0,
          Number(item.rate) || 0,
          Number(item.total) || 0
        ]),
        [''],
        ['', '', '', '', '', '', 'Subtotal (₹):', subtotal],
        ['', '', '', '', '', '', `Discount (${discountType === 'percent' ? discountValue + '%' : 'Flat ₹'}):`, discountAmount],
        ['', '', '', '', '', '', 'Taxable Value (₹):', taxableAmount],
        ['', '', '', '', '', '', taxDetails.label + ':', taxDetails.totalTax],
        ['', '', '', '', '', '', 'Round Off (₹):', roundOff],
        ['', '', '', '', '', '', 'Grand Total (₹):', grandTotal],
        [''],
        ['Amount in Words:', amountInWords],
        [''],
        ['Terms & Conditions:'],
        [terms]
      ];

      const ws = XLSX.utils.aoa_to_sheet(data);
      ws['!cols'] = [
        { wch: 6 },
        { wch: 32 },
        { wch: 18 },
        { wch: 25 },
        { wch: 10 },
        { wch: 10 },
        { wch: 16 },
        { wch: 18 }
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

  // Export to Image (.png)
  const handleExportImage = async () => {
    try {
      setIsExporting(true);
      setExportMessage({ type: 'info', text: 'Rendering high-resolution image...' });

      // Switch to preview view if in builder
      const targetEl = document.getElementById('quotation-letterhead-paper');
      if (!targetEl) {
        throw new Error('Quotation paper view not found');
      }

      const canvas = await html2canvas(targetEl, {
        scale: 2.5,
        useCORS: true,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/png');
      const custName = selectedCustomer?.customer_name || 'Customer';
      const a = document.createElement('a');
      a.download = `Quotation_${quotationNo}_${custName.replace(/[^a-zA-Z0-9]/g, '_')}.png`;
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
      setExportMessage({ type: 'info', text: 'Generating PDF document...' });

      const targetEl = document.getElementById('quotation-letterhead-paper');
      if (!targetEl) {
        throw new Error('Quotation paper view not found');
      }

      const canvas = await html2canvas(targetEl, {
        scale: 2.5,
        useCORS: true,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      const custName = selectedCustomer?.customer_name || 'Customer';
      pdf.save(`Quotation_${quotationNo}_${custName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);

      setExportMessage({ type: 'success', text: 'Quotation PDF downloaded successfully!' });
      setTimeout(() => setExportMessage(null), 3000);
    } catch (err) {
      console.error('Failed to export PDF:', err);
      setExportMessage({ type: 'error', text: 'Failed to export PDF: ' + err.message });
    } finally {
      setIsExporting(false);
    }
  };

  // Native Print
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Top Banner Header & Mode Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <FileText className="w-6 h-6 text-indigo-600 shrink-0" />
            Customer Quotation Generator
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Build itemized quotations with UOM, automated customer pricing, GST computation, and instant export to Excel, PDF, or Image.
          </p>
        </div>

        {/* View Switcher: Builder vs Letterhead Preview */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('builder')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'builder'
                  ? 'bg-white text-indigo-700 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              1. Edit & Configure
            </button>
            <button
              onClick={() => setActiveTab('preview')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'preview'
                  ? 'bg-white text-indigo-700 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              2. Letterhead Preview
            </button>
          </div>
        </div>
      </div>

      {/* Export Feedback Alert */}
      {exportMessage && (
        <div className={`p-4 rounded-xl text-xs flex items-center gap-2 border animate-in fade-in ${
          exportMessage.type === 'success'
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
          {exportMessage.text}
        </div>
      )}

      {/* Export Actions Sticky/Action Bar */}
      <div className="bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 text-white p-4 rounded-2xl shadow-md flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs text-indigo-200 font-medium">Grand Total (Incl. GST)</div>
            <div className="text-lg font-bold font-mono tracking-tight text-white flex items-center gap-1">
              ₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <span className="text-[11px] text-slate-300 font-normal">({items.length} items)</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
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

      {/* TAB 1: BUILDER / EDITOR VIEW */}
      {activeTab === 'builder' && (
        <div className="space-y-6">
          {/* 1. Header Information Grid */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 pb-3 border-b border-slate-100">
              <User className="w-4 h-4 text-indigo-600" />
              Customer & Quotation Details
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Select Customer */}
              <div className="sm:col-span-2 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700">Select Customer *</label>
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
                </div>
                <SearchableCustomerSelect
                  customers={customers}
                  value={selectedCustomerId}
                  onValueChange={setSelectedCustomerId}
                  placeholder="Search customer by name..."
                  isLoading={isInitialLoading}
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

              {/* Quotation Number */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                  <Hash className="w-3.5 h-3.5 text-slate-400" />
                  Quotation Number
                </label>
                <input
                  type="text"
                  value={quotationNo}
                  onChange={(e) => setQuotationNo(e.target.value)}
                  className="w-full h-11 bg-slate-50 border border-slate-300 text-slate-900 font-mono font-bold rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white transition-all"
                />
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
                      value={quotationDate}
                      onChange={(e) => setQuotationDate(e.target.value)}
                      className="w-full h-11 bg-slate-50 border border-slate-300 text-slate-900 font-semibold rounded-xl px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                      Valid Till
                    </label>
                    <input
                      type="date"
                      value={validUntil}
                      onChange={(e) => setValidUntil(e.target.value)}
                      className="w-full h-11 bg-slate-50 border border-slate-300 text-slate-900 font-semibold rounded-xl px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white transition-all"
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
                  onClick={addItem}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  Add Line Item
                </button>
              </div>
            </div>

            {/* Line Items Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs border-collapse min-w-[900px]">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-600 bg-slate-50 font-bold tracking-wider">
                    <th className="py-3 px-3 w-10 text-center">#</th>
                    <th className="py-3 px-3 w-72">Product / Standard Name *</th>
                    <th className="py-3 px-3 w-40">Make / Brand</th>
                    <th className="py-3 px-3 w-32">UOM *</th>
                    <th className="py-3 px-3 w-24">Qty *</th>
                    <th className="py-3 px-3 w-36">Unit Rate (₹) *</th>
                    <th className="py-3 px-3 w-36 text-right">Total Amount (₹)</th>
                    <th className="py-3 px-3 w-20 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {items.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Row Index */}
                      <td className="py-3 px-3 text-center font-mono font-bold text-slate-400">
                        {idx + 1}
                      </td>

                      {/* Product Name & Search (All Products with Customer Prices auto-attached) */}
                      <td className="py-3 px-3">
                        <div className="space-y-1">
                          <SearchableProductSelect
                            products={allDropdownProducts}
                            value={item.product_id}
                            onValueChange={(pid) => handleProductSelect(idx, pid)}
                            placeholder="Select or search product..."
                            isLoading={isInitialLoading}
                          />
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) => updateItemField(idx, 'description', e.target.value)}
                            placeholder="Optional specifications / notes..."
                            className="w-full h-8 bg-slate-50 border border-slate-200 text-slate-800 text-[11px] rounded-lg px-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:bg-white"
                          />
                        </div>
                      </td>

                      {/* Make / Brand */}
                      <td className="py-3 px-3">
                        <input
                          type="text"
                          value={item.make}
                          onChange={(e) => updateItemField(idx, 'make', e.target.value)}
                          placeholder="e.g. Siemens"
                          className="w-full h-9 bg-slate-50 border border-slate-200 text-slate-900 font-semibold rounded-lg px-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white"
                        />
                      </td>

                      {/* UOM (Unit of Measure) */}
                      <td className="py-3 px-3">
                        <div className="relative">
                          <input
                            type="text"
                            list={`uom-options-${idx}`}
                            value={item.uom}
                            onChange={(e) => updateItemField(idx, 'uom', e.target.value)}
                            placeholder="Nos"
                            className="w-full h-9 bg-slate-50 border border-slate-300 text-slate-900 font-bold rounded-lg px-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white"
                          />
                          <datalist id={`uom-options-${idx}`}>
                            {COMMON_UOMS.map(u => (
                              <option key={u} value={u} />
                            ))}
                          </datalist>
                        </div>
                      </td>

                      {/* Quantity */}
                      <td className="py-3 px-3">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={item.qty}
                          onChange={(e) => updateItemField(idx, 'qty', e.target.value)}
                          className="w-full h-9 bg-slate-50 border border-slate-300 text-slate-900 font-mono font-bold rounded-lg px-2.5 text-xs text-center focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white"
                        />
                      </td>

                      {/* Unit Rate (₹) */}
                      <td className="py-3 px-3">
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.rate}
                            onChange={(e) => updateItemField(idx, 'rate', e.target.value)}
                            placeholder="0.00"
                            className="w-full h-9 bg-slate-50 border border-slate-300 text-slate-900 font-mono font-bold rounded-lg pl-6 pr-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white"
                          />
                          <span className="absolute left-2.5 top-2 text-slate-400 font-mono text-xs font-semibold">₹</span>
                        </div>
                        {item.isCustomPrice && (
                          <div className="text-[10px] text-emerald-600 font-semibold mt-0.5">
                            ✓ Customer Price
                          </div>
                        )}
                      </td>

                      {/* Total Amount (₹) */}
                      <td className="py-3 px-3 text-right">
                        <div className="font-mono font-bold text-slate-900 text-sm">
                          ₹{Number(item.total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </td>

                      {/* Row Actions */}
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => moveItemUp(idx)}
                            disabled={idx === 0}
                            title="Move Up"
                            className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-700 disabled:opacity-20 cursor-pointer"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveItemDown(idx)}
                            disabled={idx === items.length - 1}
                            title="Move Down"
                            className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-700 disabled:opacity-20 cursor-pointer"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeItem(idx)}
                            title="Remove Line Item"
                            className="p-1 rounded hover:bg-rose-100 text-rose-500 hover:text-rose-700 cursor-pointer"
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

            <button
              type="button"
              onClick={addItem}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-slate-300 text-slate-600 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/50 text-xs font-semibold w-full justify-center transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Add Another Line Item
            </button>
          </div>

          {/* 3. Tax, Discount & Summary Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Tax & Discount Controls & Terms */}
            <div className="lg:col-span-7 bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-5">
              <h3 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100 flex items-center gap-2">
                <Percent className="w-4 h-4 text-indigo-600" />
                Taxes, Discount & Commercial Terms
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* GST / Tax Selection */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">GST / Tax Slab</label>
                  <select
                    value={taxType}
                    onChange={(e) => setTaxType(e.target.value)}
                    className="w-full h-10 bg-slate-50 border border-slate-300 text-slate-900 font-semibold rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white"
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
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    placeholder="0"
                    className="w-full h-10 bg-slate-50 border border-slate-300 text-slate-900 font-mono font-bold rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white"
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
                  className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white"
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
                </div>

                <div className="text-[11px] text-slate-500 italic bg-white/80 p-2.5 rounded-lg border border-slate-200">
                  <span className="font-semibold text-slate-700 not-italic">In Words: </span>
                  {amountInWords}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: LETTERHEAD PREVIEW (also used as capture target for PDF & Image exports) */}
      <div className={`${activeTab === 'preview' ? 'block' : 'hidden'} space-y-4`}>
        <div className="flex items-center justify-between bg-slate-100 p-3 rounded-xl border border-slate-200 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-indigo-600" />
            <span>This is how your quotation will appear when exported or printed.</span>
          </div>
          <button
            onClick={() => setActiveTab('builder')}
            className="text-indigo-600 font-bold hover:underline"
          >
            ← Back to Edit
          </button>
        </div>

        {/* Paper Container (Styled for standard A4 document layout) */}
        <div className="overflow-x-auto p-4 sm:p-6 bg-slate-200/60 rounded-2xl flex justify-center">
          <div
            id="quotation-letterhead-paper"
            ref={previewPaperRef}
            className="w-full max-w-[850px] bg-white text-slate-900 p-8 sm:p-12 shadow-2xl rounded-sm border border-slate-200 min-h-[1050px] flex flex-col justify-between"
            style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
          >
            <div>
              {/* Header: Company Name & Brand */}
              <div className="flex flex-col sm:flex-row items-start justify-between border-b-2 border-indigo-600 pb-6 mb-6 gap-4">
                <div className="max-w-md">
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                    <span className="bg-indigo-600 text-white px-2 py-0.5 rounded-md text-xl font-black">A</span>
                    ARHAM ENGG CO.
                  </h1>
                  <p className="text-xs font-semibold text-indigo-700 uppercase tracking-widest mt-1">
                    Distributors & Suppliers of Industrial & Electrical Items
                  </p>
                  <p className="text-[11px] text-slate-600 mt-2 leading-relaxed">
                    OLD NO.113 NEW NO.231, F4, FIRST FLOOR, RAJINI'S SHANMUGA BUILDING, Thambu Chetty St, Parrys, George Town, Chennai, Tamil Nadu 600001.
                  </p>
                  <p className="text-[11px] text-slate-700 font-medium mt-1">
                    Email: <span className="font-semibold text-slate-900">ravibardia@hotmail.com</span>
                  </p>
                </div>

                <div className="text-right space-y-1 self-end sm:self-start">
                  <div className="inline-block px-3 py-1 bg-indigo-50 border border-indigo-200 text-indigo-800 font-extrabold text-sm uppercase tracking-wider rounded">
                    QUOTATION
                  </div>
                  <div className="text-xs font-mono font-bold text-slate-800">{quotationNo}</div>
                  <div className="text-[11px] text-slate-500">Date: <strong className="text-slate-800">{quotationDate}</strong></div>
                  <div className="text-[11px] text-slate-500">Valid Till: <strong className="text-slate-800">{validUntil}</strong></div>
                </div>
              </div>

              {/* Customer & Bill-To Section */}
              <div className="grid grid-cols-2 gap-6 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs mb-6">
                <div>
                  <div className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider mb-1">QUOTATION TO:</div>
                  <div className="font-bold text-sm text-slate-900">{selectedCustomer?.customer_name || 'Valued Customer'}</div>
                  {selectedCustomer?.gstin && (
                    <div className="text-slate-600 mt-0.5">GSTIN: <strong className="font-mono text-slate-800">{selectedCustomer.gstin}</strong></div>
                  )}
                  {selectedCustomer?.address && (
                    <div className="text-slate-500 text-[11px] mt-1">{selectedCustomer.address}</div>
                  )}
                </div>

                <div className="text-right">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">SUPPLIER DETAILS:</div>
                  <div className="font-bold text-xs text-slate-800">ARHAM ENGG CO.</div>
                  <div className="text-slate-600 text-[11px] mt-0.5">Chennai - 600001, Tamil Nadu</div>
                  <div className="text-slate-600 text-[11px]">Email: ravibardia@hotmail.com</div>
                </div>
              </div>

              {/* Items Table */}
              <div className="mb-6">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-y-2 border-slate-800 bg-slate-100 text-slate-800 font-bold uppercase text-[10px] tracking-wider">
                      <th className="py-2.5 px-2 w-8 text-center">#</th>
                      <th className="py-2.5 px-3">Item Description</th>
                      <th className="py-2.5 px-2 w-28">Make</th>
                      <th className="py-2.5 px-2 w-16 text-center">UOM</th>
                      <th className="py-2.5 px-2 w-16 text-center">Qty</th>
                      <th className="py-2.5 px-3 w-24 text-right">Rate (₹)</th>
                      <th className="py-2.5 px-3 w-28 text-right">Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-2 text-center text-slate-400 font-mono">{idx + 1}</td>
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-slate-900">{item.product_name || 'Item'}</div>
                          {item.description && (
                            <div className="text-[11px] text-slate-500 italic">{item.description}</div>
                          )}
                        </td>
                        <td className="py-2.5 px-2 font-medium text-slate-700">{item.make || '-'}</td>
                        <td className="py-2.5 px-2 text-center font-bold text-slate-800">{item.uom || 'Nos'}</td>
                        <td className="py-2.5 px-2 text-center font-mono font-bold text-slate-900">{item.qty}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-900">
                          ₹{Number(item.rate || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                          ₹{Number(item.total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Total Summary Breakdown */}
              <div className="flex justify-end mb-6">
                <div className="w-72 space-y-1.5 text-xs">
                  <div className="flex justify-between py-1 border-t border-slate-200">
                    <span className="text-slate-600">Subtotal:</span>
                    <span className="font-mono font-bold text-slate-900">₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>

                  {discountAmount > 0 && (
                    <div className="flex justify-between py-1 text-emerald-700">
                      <span>Discount ({discountType === 'percent' ? `${discountValue}%` : 'Flat'}):</span>
                      <span className="font-mono font-bold">-₹{discountAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}

                  <div className="flex justify-between py-1 border-t border-slate-200 text-slate-700 font-semibold">
                    <span>Taxable Value:</span>
                    <span className="font-mono text-slate-900">₹{taxableAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>

                  {taxDetails.rate > 0 && (
                    <>
                      {taxDetails.isSplit ? (
                        <>
                          <div className="flex justify-between text-slate-600 text-[11px]">
                            <span>CGST (9%):</span>
                            <span className="font-mono">₹{taxDetails.cgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                          </div>
                          <div className="flex justify-between text-slate-600 text-[11px]">
                            <span>SGST (9%):</span>
                            <span className="font-mono">₹{taxDetails.sgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                          </div>
                        </>
                      ) : (
                        <div className="flex justify-between text-slate-600 text-[11px]">
                          <span>{taxDetails.label}:</span>
                          <span className="font-mono">₹{taxDetails.totalTax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </div>
                      )}
                    </>
                  )}

                  {Math.abs(roundOff) > 0.001 && (
                    <div className="flex justify-between text-slate-500 text-[11px]">
                      <span>Round Off:</span>
                      <span className="font-mono">{roundOff > 0 ? `+₹${roundOff.toFixed(2)}` : `-₹${Math.abs(roundOff).toFixed(2)}`}</span>
                    </div>
                  )}

                  <div className="flex justify-between py-2 border-t-2 border-b-2 border-slate-900 text-sm font-extrabold text-slate-900 bg-slate-50 px-2">
                    <span>GRAND TOTAL:</span>
                    <span className="font-mono text-indigo-700">₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>

              {/* Amount In Words Box */}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs mb-6">
                <span className="font-bold text-slate-700">Amount in Words: </span>
                <span className="italic text-slate-800">{amountInWords}</span>
              </div>

              {/* Terms and Notes */}
              <div className="text-[11px] text-slate-600 space-y-1 mb-8">
                <div className="font-bold text-slate-900 uppercase tracking-wider text-[10px]">Terms & Conditions:</div>
                <div className="whitespace-pre-line leading-relaxed">{terms}</div>
              </div>
            </div>

            {/* Footer / Signatures */}
            <div className="pt-6 border-t border-slate-200 flex justify-between items-end text-xs text-slate-500">
              <div>
                <p>Thank you for your business!</p>
                <p className="text-[10px] text-slate-400">This is a computer generated quotation.</p>
              </div>

              <div className="text-right">
                <div className="font-bold text-slate-800 mb-8">For ARHAM ENGG CO.</div>
                <div className="border-t border-slate-400 pt-1 text-[11px] font-semibold text-slate-700 inline-block w-48 text-center">
                  Authorized Signatory
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
