import axios from 'axios';

// Live Google Apps Script Web App URL
export const DEFAULT_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxpR4V1mzRxGovg1QXN99lUae12bFCqsGS03z-5bkEdl2K0GBujahleIKOwO3lTkDyB/exec';

const APPS_SCRIPT_URL_KEY = 'arham_apps_script_url';
const USER_STORAGE_KEY = 'arham_authenticated_user';
const TOKEN_STORAGE_KEY = 'arham_auth_token';

// In-Memory API Cache to eliminate redundant network reloads when switching tabs/views
const apiCache = {
  allData: null,
  quotations: null,
  customers: null,
  products: null,
  pricing: null
};

export const clearApiCache = () => {
  apiCache.allData = null;
  apiCache.quotations = null;
  apiCache.customers = null;
  apiCache.products = null;
  apiCache.pricing = null;
};

// Dispatch global event when anything is saved to Google Sheets
export const notifyGSheetSaved = (action, detail = {}) => {
  clearApiCache();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('arham_gsheet_saved', {
      detail: { action, ...detail, timestamp: Date.now() }
    }));
  }
};

export const getStoredUser = () => {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
};

export const setStoredUser = (user) => {
  if (user) {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(USER_STORAGE_KEY);
  }
};

export const getAuthToken = () => {
  return localStorage.getItem(TOKEN_STORAGE_KEY) || '';
};

export const setAuthToken = (token) => {
  if (token) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
};

export const getAppsScriptUrl = () => {
  const custom = localStorage.getItem(APPS_SCRIPT_URL_KEY);
  if (custom && custom.trim() && custom.trim().startsWith('https://script.google.com/macros/s/')) {
    return custom.trim();
  }
  if (custom && (!custom.trim().startsWith('https://script.google.com/macros/s/'))) {
    console.warn('[API] Purging invalid custom Apps Script URL from localStorage:', custom);
    localStorage.removeItem(APPS_SCRIPT_URL_KEY);
  }
  return DEFAULT_APPS_SCRIPT_URL;
};

export const setAppsScriptUrl = (url) => {
  if (url && url.trim() && url.trim().startsWith('https://script.google.com/macros/s/')) {
    localStorage.setItem(APPS_SCRIPT_URL_KEY, url.trim());
    clearApiCache();
  } else {
    localStorage.removeItem(APPS_SCRIPT_URL_KEY);
    clearApiCache();
  }
};

export const resetAppsScriptUrl = () => {
  localStorage.removeItem(APPS_SCRIPT_URL_KEY);
  clearApiCache();
};

// Internal robust runner: executes GET against Google Apps Script,
// with automatic fallback to DEFAULT_APPS_SCRIPT_URL if custom URL fails.
async function callAppsScript(params, timeoutMs = 30000) {
  let url = getAppsScriptUrl();
  try {
    const res = await axios.get(url, {
      params,
      timeout: timeoutMs
    });
    return res.data;
  } catch (err) {
    // If we were using a custom URL and it failed (e.g. 404, network error), retry with verified default URL
    if (url !== DEFAULT_APPS_SCRIPT_URL) {
      console.warn(`[API] Custom Apps Script URL failed (${err.message}). Auto-reverting to DEFAULT_APPS_SCRIPT_URL.`);
      localStorage.removeItem(APPS_SCRIPT_URL_KEY);
      clearApiCache();
      url = DEFAULT_APPS_SCRIPT_URL;
      const fallbackRes = await axios.get(url, {
        params,
        timeout: timeoutMs
      });
      return fallbackRes.data;
    }
    throw err;
  }
}

// Internal robust POST runner
async function postAppsScript(action, payload, timeoutMs = 35000) {
  let url = getAppsScriptUrl();
  const body = JSON.stringify({ action, payload });
  const headers = { 'Content-Type': 'text/plain;charset=utf-8' };

  try {
    const res = await axios.post(url, body, { headers, timeout: timeoutMs });
    return res.data;
  } catch (postErr) {
    if (url !== DEFAULT_APPS_SCRIPT_URL) {
      console.warn(`[API] Custom URL POST failed (${postErr.message}). Retrying with DEFAULT_APPS_SCRIPT_URL.`);
      localStorage.removeItem(APPS_SCRIPT_URL_KEY);
      clearApiCache();
      url = DEFAULT_APPS_SCRIPT_URL;
      const fallbackRes = await axios.post(url, body, { headers, timeout: timeoutMs });
      return fallbackRes.data;
    }
    throw postErr;
  }
}

export const api = {
  // Clear frontend in-memory cache
  clearCache: clearApiCache,

  // Check health status from Google Apps Script
  getHealth: async () => {
    const data = await callAppsScript({ action: 'getHealth' });
    return {
      ...data,
      is_cloud_connected: true,
      current_url: getAppsScriptUrl()
    };
  },

  // Authentication: User Login stored in Google Sheets 'Users' sheet
  login: async (username, password) => {
    const cleanUser = (username || '').trim();
    const cleanPass = (password || '').trim();

    if (!cleanUser || !cleanPass) {
      throw new Error('Please enter both username/email and password.');
    }

    try {
      const data = await callAppsScript({
        action: 'login',
        username: cleanUser,
        password: cleanPass
      });

      if (data) {
        if (data.success && data.user) {
          setStoredUser(data.user);
          setAuthToken(data.token || `token-${data.user.user_id}`);
          return data;
        }

        if (data.error) {
          if (data.error.indexOf('Unknown action: login') !== -1) {
            throw new Error('Apps Script Web App has not been updated with the login action yet. Please follow the Apps Script update instructions.');
          }
          throw new Error(data.error);
        }
      }
    } catch (err) {
      if (err.response && err.response.data && err.response.data.error) {
        throw new Error(err.response.data.error);
      }
      if (err.message) {
        throw err;
      }
      throw new Error('Unable to connect to Google Sheets Web App. Please verify your internet connection.');
    }

    throw new Error('Invalid username or password. Please verify your credentials.');
  },

  // Change Password in Google Sheet
  changePassword: async (username, oldPassword, newPassword) => {
    const data = await callAppsScript({
      action: 'changePassword',
      username,
      old_password: oldPassword,
      new_password: newPassword
    });
    if (data && data.error && data.error !== 'Unknown action: changePassword') {
      throw new Error(data.error);
    }
    return data || { success: true, message: 'Password updated successfully!' };
  },

  // Fetch all customers from Google Sheets (cached in memory)
  getCustomers: async (options = {}) => {
    if (!options.force && apiCache.customers) {
      return apiCache.customers;
    }
    const data = await callAppsScript({ action: 'getCustomers' });
    if (Array.isArray(data)) {
      apiCache.customers = data;
    }
    return data;
  },

  // Fetch all products from Google Sheets (cached in memory)
  getProducts: async (options = {}) => {
    if (!options.force && apiCache.products) {
      return apiCache.products;
    }
    const data = await callAppsScript({ action: 'getProducts' });
    if (Array.isArray(data)) {
      apiCache.products = data;
    }
    return data;
  },

  // Price Lookup from Google Sheets
  lookupPrices: async (customerId, query = '') => {
    return await callAppsScript({
      action: 'lookupPrices',
      customer_id: customerId,
      query
    }, 45000);
  },

  // Create Product in Google Sheet (Admin Only)
  createProduct: async (productData) => {
    const data = await callAppsScript({
      action: 'createProduct',
      product_id: productData.product_id,
      standard_name: productData.standard_name,
      make: productData.make || '',
      admin_key: 'Admin#Arham2026!'
    });
    if (data && data.error) {
      throw new Error(data.error);
    }
    notifyGSheetSaved('createProduct', productData);
    return data;
  },

  // Update Product in Google Sheet (Admin Only)
  updateProduct: async (productData) => {
    const data = await callAppsScript({
      action: 'updateProduct',
      product_id: productData.product_id,
      standard_name: productData.standard_name,
      make: productData.make || '',
      admin_key: 'Admin#Arham2026!'
    });
    if (data && data.error) {
      throw new Error(data.error);
    }
    notifyGSheetSaved('updateProduct', productData);
    return data;
  },

  // Delete Product in Google Sheet (Admin Only)
  deleteProduct: async (productId) => {
    const data = await callAppsScript({
      action: 'deleteProduct',
      product_id: productId,
      admin_key: 'Admin#Arham2026!'
    });
    if (data && data.error) {
      throw new Error(data.error);
    }
    notifyGSheetSaved('deleteProduct', { product_id: productId });
    return data;
  },

  // Create Customer in Google Sheet (Admin Only)
  createCustomer: async (customerData) => {
    const data = await callAppsScript({
      action: 'createCustomer',
      customer_id: customerData.customer_id,
      customer_name: customerData.customer_name,
      gstin: customerData.gstin || '',
      admin_key: 'Admin#Arham2026!'
    });
    if (data && data.error) {
      throw new Error(data.error);
    }
    notifyGSheetSaved('createCustomer', customerData);
    return data;
  },

  // Update Customer in Google Sheet (Admin Only)
  updateCustomer: async (customerData) => {
    const data = await callAppsScript({
      action: 'updateCustomer',
      customer_id: customerData.customer_id,
      customer_name: customerData.customer_name,
      gstin: customerData.gstin || '',
      admin_key: 'Admin#Arham2026!'
    });
    if (data && data.error) {
      throw new Error(data.error);
    }
    notifyGSheetSaved('updateCustomer', customerData);
    return data;
  },

  // Delete Customer in Google Sheet (Admin Only)
  deleteCustomer: async (customerId) => {
    const data = await callAppsScript({
      action: 'deleteCustomer',
      customer_id: customerId,
      admin_key: 'Admin#Arham2026!'
    });
    if (data && data.error) {
      throw new Error(data.error);
    }
    notifyGSheetSaved('deleteCustomer', { customer_id: customerId });
    return data;
  },

  // Upsert Customer Price in Google Sheet (Admin Only)
  upsertPricing: async (pricingData) => {
    const data = await callAppsScript({
      action: 'upsertPricing',
      customer_id: pricingData.customer_id,
      product_id: pricingData.product_id,
      price: pricingData.price,
      admin_key: 'Admin#Arham2026!'
    });
    if (data && data.error) {
      throw new Error(data.error);
    }
    notifyGSheetSaved('upsertPricing', pricingData);
    return data;
  },

  // Bulk data loading: Fetch customers, products, and pricing from Google Sheets in ONE call (cached in memory)
  getAllData: async (options = {}) => {
    if (!options.force && apiCache.allData) {
      return apiCache.allData;
    }
    const data = await callAppsScript({ action: 'getAllData' }, 35000);
    if (data && (Array.isArray(data.customers) || Array.isArray(data.products))) {
      apiCache.allData = data;
      if (Array.isArray(data.customers)) apiCache.customers = data.customers;
      if (Array.isArray(data.products)) apiCache.products = data.products;
      if (Array.isArray(data.pricing)) apiCache.pricing = data.pricing;
    }
    return data;
  },

  // Fetch all pricing rows from Google Sheets (cached in memory)
  getAllPricing: async (options = {}) => {
    if (!options.force && apiCache.pricing) {
      return apiCache.pricing;
    }
    const data = await callAppsScript({ action: 'getAllPricing' }, 35000);
    if (Array.isArray(data)) {
      apiCache.pricing = data;
    }
    return data;
  },

  // Save Quotation to Google Sheets ('Quotations' sheet)
  saveQuotation: async (quotationData) => {
    let data;
    try {
      data = await postAppsScript('saveQuotation', quotationData);
      if (data && data.error) {
        throw new Error(data.error);
      }
    } catch (postErr) {
      console.warn('POST saveQuotation failed, trying GET fallback:', postErr);
      data = await callAppsScript({
        action: 'saveQuotation',
        data: JSON.stringify(quotationData)
      }, 40000);
      if (data && data.error) {
        throw new Error(data.error);
      }
    }
    notifyGSheetSaved('saveQuotation', quotationData);
    return data;
  },

  // Retrieve Saved Quotations from Google Sheets (cached in memory)
  getQuotations: async (options = {}) => {
    if (!options.force && apiCache.quotations) {
      return apiCache.quotations;
    }
    const data = await callAppsScript({ action: 'getQuotations' }, 35000);
    if (Array.isArray(data)) {
      apiCache.quotations = data;
    }
    return data;
  },

  // Confirm Order in Google Sheets
  confirmOrder: async (orderData) => {
    let data;
    try {
      data = await postAppsScript('confirmOrder', orderData);
      if (data && data.error) {
        throw new Error(data.error);
      }
    } catch (postErr) {
      console.warn('POST confirmOrder failed, trying GET fallback:', postErr);
      data = await callAppsScript({
        action: 'confirmOrder',
        data: JSON.stringify(orderData)
      }, 40000);
      if (data && data.error) {
        throw new Error(data.error);
      }
    }
    notifyGSheetSaved('confirmOrder', orderData);
    return data;
  },

  // Update or connect custom Google Apps Script Web App URL
  connectAppsScript: async (url) => {
    const targetUrl = (url && url.trim()) ? url.trim() : DEFAULT_APPS_SCRIPT_URL;
    if (!targetUrl || !targetUrl.startsWith('https://script.google.com/macros/s/')) {
      throw new Error('Please enter a valid Google Apps Script Web App URL starting with https://script.google.com/macros/s/...');
    }
    const cleanUrl = targetUrl.trim();
    const res = await axios.get(cleanUrl, { params: { action: 'getHealth' }, timeout: 15000 });
    if (res.data && (res.data.mode === 'google_apps_script' || res.data.status === 'online')) {
      setAppsScriptUrl(cleanUrl);
      clearApiCache();
      return res.data;
    } else {
      throw new Error('Failed to verify connection to Google Apps Script Web App.');
    }
  },

  // Reset Apps Script URL to default
  resetAppsScriptUrl: () => {
    resetAppsScriptUrl();
  }
};
