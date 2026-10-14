import axios from 'axios';

// Live Google Apps Script Web App URL
const DEFAULT_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxpR4V1mzRxGovg1QXN99lUae12bFCqsGS03z-5bkEdl2K0GBujahleIKOwO3lTkDyB/exec';

const APPS_SCRIPT_URL_KEY = 'arham_apps_script_url';
const USER_STORAGE_KEY = 'arham_authenticated_user';
const TOKEN_STORAGE_KEY = 'arham_auth_token';

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
  if (custom && custom.trim()) {
    return custom.trim();
  }
  return DEFAULT_APPS_SCRIPT_URL;
};

export const setAppsScriptUrl = (url) => {
  if (url && url.trim()) {
    localStorage.setItem(APPS_SCRIPT_URL_KEY, url.trim());
  } else {
    localStorage.removeItem(APPS_SCRIPT_URL_KEY);
  }
};

export const api = {
  // Check health status from Google Apps Script
  getHealth: async () => {
    const scriptUrl = getAppsScriptUrl();
    const res = await axios.get(scriptUrl, { params: { action: 'getHealth' } });
    return {
      ...res.data,
      is_cloud_connected: true
    };
  },

  // Authentication: User Login stored in Google Sheets 'Users' sheet
  login: async (username, password) => {
    const cleanUser = (username || '').trim();
    const cleanPass = (password || '').trim();

    if (!cleanUser || !cleanPass) {
      throw new Error('Please enter both username/email and password.');
    }

    const scriptUrl = getAppsScriptUrl();
    try {
      const res = await axios.get(scriptUrl, {
        params: {
          action: 'login',
          username: cleanUser,
          password: cleanPass
        }
      });

      if (res.data) {
        if (res.data.success && res.data.user) {
          setStoredUser(res.data.user);
          setAuthToken(res.data.token || `token-${res.data.user.user_id}`);
          return res.data;
        }

        if (res.data.error) {
          if (res.data.error.indexOf('Unknown action: login') !== -1) {
            throw new Error('Apps Script Web App has not been updated with the login action yet. Please follow the Apps Script update instructions.');
          }
          throw new Error(res.data.error);
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
    const scriptUrl = getAppsScriptUrl();
    const res = await axios.get(scriptUrl, {
      params: {
        action: 'changePassword',
        username,
        old_password: oldPassword,
        new_password: newPassword
      }
    });
    if (res.data && res.data.error && res.data.error !== 'Unknown action: changePassword') {
      throw new Error(res.data.error);
    }
    return res.data || { success: true, message: 'Password updated successfully!' };
  },

  // Fetch all customers from Google Sheets
  getCustomers: async () => {
    const scriptUrl = getAppsScriptUrl();
    const res = await axios.get(scriptUrl, { params: { action: 'getCustomers' } });
    return res.data;
  },

  // Fetch all products from Google Sheets
  getProducts: async () => {
    const scriptUrl = getAppsScriptUrl();
    const res = await axios.get(scriptUrl, { params: { action: 'getProducts' } });
    return res.data;
  },

  // Price Lookup from Google Sheets
  lookupPrices: async (customerId, query = '') => {
    const scriptUrl = getAppsScriptUrl();
    const res = await axios.get(scriptUrl, {
      params: { action: 'lookupPrices', customer_id: customerId, query }
    });
    return res.data;
  },

  // Create Product in Google Sheet (Admin Only)
  createProduct: async (productData) => {
    const scriptUrl = getAppsScriptUrl();
    const res = await axios.get(scriptUrl, {
      params: {
        action: 'createProduct',
        product_id: productData.product_id,
        standard_name: productData.standard_name,
        make: productData.make || '',
        admin_key: 'Admin#Arham2026!'
      }
    });
    if (res.data && res.data.error) {
      throw new Error(res.data.error);
    }
    return res.data;
  },

  // Update Product in Google Sheet (Admin Only)
  updateProduct: async (productData) => {
    const scriptUrl = getAppsScriptUrl();
    const res = await axios.get(scriptUrl, {
      params: {
        action: 'updateProduct',
        product_id: productData.product_id,
        standard_name: productData.standard_name,
        make: productData.make || '',
        admin_key: 'Admin#Arham2026!'
      }
    });
    if (res.data && res.data.error) {
      throw new Error(res.data.error);
    }
    return res.data;
  },

  // Delete Product in Google Sheet (Admin Only)
  deleteProduct: async (productId) => {
    const scriptUrl = getAppsScriptUrl();
    const res = await axios.get(scriptUrl, {
      params: {
        action: 'deleteProduct',
        product_id: productId,
        admin_key: 'Admin#Arham2026!'
      }
    });
    if (res.data && res.data.error) {
      throw new Error(res.data.error);
    }
    return res.data;
  },

  // Create Customer in Google Sheet (Admin Only)
  createCustomer: async (customerData) => {
    const scriptUrl = getAppsScriptUrl();
    const res = await axios.get(scriptUrl, {
      params: {
        action: 'createCustomer',
        customer_id: customerData.customer_id,
        customer_name: customerData.customer_name,
        gstin: customerData.gstin || '',
        admin_key: 'Admin#Arham2026!'
      }
    });
    if (res.data && res.data.error) {
      throw new Error(res.data.error);
    }
    return res.data;
  },

  // Update Customer in Google Sheet (Admin Only)
  updateCustomer: async (customerData) => {
    const scriptUrl = getAppsScriptUrl();
    const res = await axios.get(scriptUrl, {
      params: {
        action: 'updateCustomer',
        customer_id: customerData.customer_id,
        customer_name: customerData.customer_name,
        gstin: customerData.gstin || '',
        admin_key: 'Admin#Arham2026!'
      }
    });
    if (res.data && res.data.error) {
      throw new Error(res.data.error);
    }
    return res.data;
  },

  // Delete Customer in Google Sheet (Admin Only)
  deleteCustomer: async (customerId) => {
    const scriptUrl = getAppsScriptUrl();
    const res = await axios.get(scriptUrl, {
      params: {
        action: 'deleteCustomer',
        customer_id: customerId,
        admin_key: 'Admin#Arham2026!'
      }
    });
    if (res.data && res.data.error) {
      throw new Error(res.data.error);
    }
    return res.data;
  },

  // Upsert Customer Price in Google Sheet (Admin Only)
  upsertPricing: async (pricingData) => {
    const scriptUrl = getAppsScriptUrl();
    const res = await axios.get(scriptUrl, {
      params: {
        action: 'upsertPricing',
        customer_id: pricingData.customer_id,
        product_id: pricingData.product_id,
        price: pricingData.price,
        admin_key: 'Admin#Arham2026!'
      }
    });
    if (res.data && res.data.error) {
      throw new Error(res.data.error);
    }
    return res.data;
  },

  // Bulk data loading: Fetch customers, products, and pricing from Google Sheets
  getAllData: async () => {
    const scriptUrl = getAppsScriptUrl();
    const res = await axios.get(scriptUrl, { params: { action: 'getAllData' } });
    return res.data;
  },

  // Fetch all pricing rows from Google Sheets
  getAllPricing: async () => {
    const scriptUrl = getAppsScriptUrl();
    const res = await axios.get(scriptUrl, { params: { action: 'getAllPricing' } });
    return res.data;
  },

  // Save Quotation to Google Sheets ('Quotations' sheet)
  saveQuotation: async (quotationData) => {
    const scriptUrl = getAppsScriptUrl();
    try {
      const res = await axios.post(
        scriptUrl,
        JSON.stringify({
          action: 'saveQuotation',
          payload: quotationData
        }),
        {
          headers: { 'Content-Type': 'text/plain;charset=utf-8' }
        }
      );
      if (res.data && res.data.error) {
        throw new Error(res.data.error);
      }
      return res.data;
    } catch (postErr) {
      console.warn('POST saveQuotation failed, trying GET fallback:', postErr);
      const res = await axios.get(scriptUrl, {
        params: {
          action: 'saveQuotation',
          data: JSON.stringify(quotationData)
        }
      });
      if (res.data && res.data.error) {
        throw new Error(res.data.error);
      }
      return res.data;
    }
  },

  // Retrieve Saved Quotations from Google Sheets
  getQuotations: async () => {
    const scriptUrl = getAppsScriptUrl();
    const res = await axios.get(scriptUrl, { params: { action: 'getQuotations' } });
    return res.data;
  },

  // Confirm Order in Google Sheets
  confirmOrder: async (orderData) => {
    const scriptUrl = getAppsScriptUrl();
    try {
      const res = await axios.post(
        scriptUrl,
        JSON.stringify({
          action: 'confirmOrder',
          payload: orderData
        }),
        {
          headers: { 'Content-Type': 'text/plain;charset=utf-8' }
        }
      );
      if (res.data && res.data.error) {
        throw new Error(res.data.error);
      }
      return res.data;
    } catch (postErr) {
      console.warn('POST confirmOrder failed, trying GET fallback:', postErr);
      const res = await axios.get(scriptUrl, {
        params: {
          action: 'confirmOrder',
          data: JSON.stringify(orderData)
        }
      });
      if (res.data && res.data.error) {
        throw new Error(res.data.error);
      }
      return res.data;
    }
  },

  // Update or connect custom Google Apps Script Web App URL
  connectAppsScript: async (url) => {
    const targetUrl = (url && url.trim()) ? url.trim() : DEFAULT_APPS_SCRIPT_URL;
    if (!targetUrl || !targetUrl.startsWith('http')) {
      throw new Error('Please enter a valid Google Apps Script Web App URL starting with https://script.google.com/...');
    }
    const cleanUrl = targetUrl.trim();
    const res = await axios.get(cleanUrl, { params: { action: 'getHealth' } });
    if (res.data && (res.data.mode === 'google_apps_script' || res.data.status === 'online')) {
      setAppsScriptUrl(cleanUrl);
      return res.data;
    } else {
      throw new Error('Failed to verify connection to Google Apps Script Web App.');
    }
  },

  // Reset Apps Script URL to default
  resetAppsScriptUrl: () => {
    localStorage.removeItem(APPS_SCRIPT_URL_KEY);
  }
};
