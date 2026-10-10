import axios from 'axios';

// Store configured Google Apps Script Web App URL in localStorage
const APPS_SCRIPT_URL_KEY = 'arham_apps_script_url';

export const getAppsScriptUrl = () => {
  return localStorage.getItem(APPS_SCRIPT_URL_KEY) || '';
};

export const setAppsScriptUrl = (url) => {
  if (url && url.trim()) {
    localStorage.setItem(APPS_SCRIPT_URL_KEY, url.trim());
  } else {
    localStorage.removeItem(APPS_SCRIPT_URL_KEY);
  }
};

const API_BASE = '/api';

export const api = {
  // Check health status (Google Apps Script or local engine)
  getHealth: async () => {
    const scriptUrl = getAppsScriptUrl();
    if (scriptUrl) {
      try {
        const res = await axios.get(scriptUrl, { params: { action: 'getHealth' } });
        return {
          ...res.data,
          script_url: scriptUrl
        };
      } catch (err) {
        console.warn('Apps Script health check failed, falling back to local engine:', err);
      }
    }
    const res = await axios.get(`${API_BASE}/health`);
    return res.data;
  },

  // Fetch all customers from Sheet 1 or Local Mock
  getCustomers: async () => {
    const scriptUrl = getAppsScriptUrl();
    if (scriptUrl) {
      const res = await axios.get(scriptUrl, { params: { action: 'getCustomers' } });
      return res.data;
    }
    const res = await axios.get(`${API_BASE}/customers`);
    return res.data;
  },

  // Fetch all products from Sheet 2 or Local Mock
  getProducts: async () => {
    const scriptUrl = getAppsScriptUrl();
    if (scriptUrl) {
      const res = await axios.get(scriptUrl, { params: { action: 'getProducts' } });
      return res.data;
    }
    const res = await axios.get(`${API_BASE}/products`);
    return res.data;
  },

  // Page 1: Price Lookup (Customer ID + query string)
  lookupPrices: async (customerId, query = '') => {
    const scriptUrl = getAppsScriptUrl();
    if (scriptUrl) {
      const res = await axios.get(scriptUrl, {
        params: { action: 'lookupPrices', customer_id: customerId, query }
      });
      return res.data;
    }
    const res = await axios.get(`${API_BASE}/prices/lookup`, {
      params: { customer_id: customerId, query }
    });
    return res.data;
  },

  // Page 2: Add Product
  createProduct: async (productData) => {
    const scriptUrl = getAppsScriptUrl();
    if (scriptUrl) {
      const res = await axios.get(scriptUrl, {
        params: {
          action: 'createProduct',
          product_id: productData.product_id,
          standard_name: productData.standard_name,
          make: productData.make || ''
        }
      });
      if (res.data && res.data.error) {
        throw new Error(res.data.error);
      }
      return res.data;
    }
    const res = await axios.post(`${API_BASE}/products`, productData);
    return res.data;
  },

  // Update Product
  updateProduct: async (productData) => {
    const scriptUrl = getAppsScriptUrl();
    if (scriptUrl) {
      const res = await axios.get(scriptUrl, {
        params: {
          action: 'updateProduct',
          product_id: productData.product_id,
          standard_name: productData.standard_name,
          make: productData.make || ''
        }
      });
      if (res.data && res.data.error) {
        throw new Error(res.data.error);
      }
      return res.data;
    }
    const res = await axios.put(`${API_BASE}/products/${productData.product_id}`, productData);
    return res.data;
  },

  // Delete Product
  deleteProduct: async (productId) => {
    const scriptUrl = getAppsScriptUrl();
    if (scriptUrl) {
      const res = await axios.get(scriptUrl, {
        params: {
          action: 'deleteProduct',
          product_id: productId
        }
      });
      if (res.data && res.data.error) {
        throw new Error(res.data.error);
      }
      return res.data;
    }
    const res = await axios.delete(`${API_BASE}/products/${productId}`);
    return res.data;
  },

  // Create Customer
  createCustomer: async (customerData) => {
    const scriptUrl = getAppsScriptUrl();
    if (scriptUrl) {
      const res = await axios.get(scriptUrl, {
        params: {
          action: 'createCustomer',
          customer_id: customerData.customer_id,
          customer_name: customerData.customer_name,
          gstin: customerData.gstin || ''
        }
      });
      if (res.data && res.data.error) {
        throw new Error(res.data.error);
      }
      return res.data;
    }
    const res = await axios.post(`${API_BASE}/customers`, customerData);
    return res.data;
  },

  // Update Customer
  updateCustomer: async (customerData) => {
    const scriptUrl = getAppsScriptUrl();
    if (scriptUrl) {
      const res = await axios.get(scriptUrl, {
        params: {
          action: 'updateCustomer',
          customer_id: customerData.customer_id,
          customer_name: customerData.customer_name,
          gstin: customerData.gstin || ''
        }
      });
      if (res.data && res.data.error) {
        throw new Error(res.data.error);
      }
      return res.data;
    }
    const res = await axios.put(`${API_BASE}/customers/${customerData.customer_id}`, customerData);
    return res.data;
  },

  // Delete Customer
  deleteCustomer: async (customerId) => {
    const scriptUrl = getAppsScriptUrl();
    if (scriptUrl) {
      const res = await axios.get(scriptUrl, {
        params: {
          action: 'deleteCustomer',
          customer_id: customerId
        }
      });
      if (res.data && res.data.error) {
        throw new Error(res.data.error);
      }
      return res.data;
    }
    const res = await axios.delete(`${API_BASE}/customers/${customerId}`);
    return res.data;
  },


  // Page 2: Upsert Customer Price
  upsertPricing: async (pricingData) => {
    const scriptUrl = getAppsScriptUrl();
    if (scriptUrl) {
      const res = await axios.get(scriptUrl, {
        params: {
          action: 'upsertPricing',
          customer_id: pricingData.customer_id,
          product_id: pricingData.product_id,
          price: pricingData.price
        }
      });
      if (res.data && res.data.error) {
        throw new Error(res.data.error);
      }
      return res.data;
    }
    const res = await axios.post(`${API_BASE}/pricing`, pricingData);
    return res.data;
  },

  // Bulk data loading: Fetch customers, products, and pricing in 1 request
  getAllData: async () => {
    const scriptUrl = getAppsScriptUrl();
    if (scriptUrl) {
      const res = await axios.get(scriptUrl, { params: { action: 'getAllData' } });
      return res.data;
    }
    const res = await axios.get(`${API_BASE}/data/all`);
    return res.data;
  },

  // Fetch all pricing rows
  getAllPricing: async () => {
    const scriptUrl = getAppsScriptUrl();
    if (scriptUrl) {
      const res = await axios.get(scriptUrl, { params: { action: 'getAllPricing' } });
      return res.data;
    }
    const res = await axios.get(`${API_BASE}/pricing/all`);
    return res.data;
  },

  // Connect Google Apps Script Web App dynamically

  connectAppsScript: async (url) => {
    if (!url || !url.startsWith('http')) {
      throw new Error('Please enter a valid Google Apps Script Web App URL starting with https://script.google.com/...');
    }
    const cleanUrl = url.trim();
    const res = await axios.get(cleanUrl, { params: { action: 'getHealth' } });
    if (res.data && (res.data.mode === 'google_apps_script' || res.data.status === 'online')) {
      setAppsScriptUrl(cleanUrl);
      return res.data;
    } else {
      throw new Error('Failed to verify connection to Google Apps Script Web App.');
    }
  },

  // Disconnect Apps Script
  disconnectAppsScript: () => {
    setAppsScriptUrl('');
  }
};
