import React, { useState, useEffect } from 'react';
import { api } from './api';
import { CustomerCatalog } from './pages/CustomerCatalog';
import { Manage } from './pages/Manage';
import { Quotation } from './pages/Quotation';
import { Badge } from './components/ui/Badge';
import { 
  Sparkles, Server, Table, Menu, X, PackagePlus, Users, FileText
} from 'lucide-react';

export default function App() {
  const [currentPage, setCurrentPage] = useState('catalog'); // 'catalog', 'quotation', 'products', 'customers'
  const [status, setStatus] = useState(null);
  
  // Navigation prefill parameters
  const [prefillCustomer, setPrefillCustomer] = useState('');
  const [prefillProduct, setPrefillProduct] = useState('');

  // Mobile navigation drawer toggle
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      const data = await api.getHealth();
      setStatus(data);
    } catch (err) {
      console.error('Failed to get status:', err);
    }
  };

  const handleNavigateToManage = (customerId, productId) => {
    setPrefillCustomer(customerId);
    setPrefillProduct(productId);
    setCurrentPage('pricing');
  };

  const isAppsScriptConnected = status?.mode === 'google_apps_script' || !!status?.is_cloud_connected || !!status?.script_url;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      {/* Top Header Navigation Bar */}
      <header className="sticky top-0 z-40 bg-white/90 border-b border-slate-200/80 backdrop-blur-xl shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 min-h-[64px] py-2 flex items-center justify-between gap-2">
          
          {/* Logo & Brand */}
          <div className="flex items-center gap-2.5 cursor-pointer shrink-0" onClick={() => setCurrentPage('catalog')}>
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-sky-400 flex items-center justify-center shadow-md shadow-indigo-200">
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div>
              <span className="font-bold text-base sm:text-lg text-slate-900 tracking-tight">Arham</span>
              <span className="text-[10px] sm:text-xs text-indigo-700 font-semibold ml-1.5 hidden xs:inline-block px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-200/80">
                Price Portal
              </span>
            </div>
          </div>

          {/* Desktop Navigation Page Tabs */}
          <nav className="hidden lg:flex items-center gap-1 bg-slate-100/90 p-1 rounded-xl border border-slate-200/80">
            <button
              onClick={() => setCurrentPage('catalog')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                currentPage === 'catalog'
                  ? 'bg-white text-indigo-700 shadow-sm border border-slate-200/60 font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <Table className="w-3.5 h-3.5" />
              1. Customer Price Catalog
            </button>

            <button
              onClick={() => setCurrentPage('quotation')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                currentPage === 'quotation'
                  ? 'bg-white text-indigo-700 shadow-sm border border-slate-200/60 font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-indigo-600" />
              2. Create Quotation
            </button>

            <button
              onClick={() => setCurrentPage('products')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                currentPage === 'products'
                  ? 'bg-white text-indigo-700 shadow-sm border border-slate-200/60 font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <PackagePlus className="w-3.5 h-3.5" />
              3. Manage Products
            </button>

            <button
              onClick={() => setCurrentPage('customers')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                currentPage === 'customers'
                  ? 'bg-white text-indigo-700 shadow-sm border border-slate-200/60 font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              4. Manage Customers
            </button>
          </nav>

          {/* Live Status Indicator */}
          <div className="flex items-center gap-2 shrink-0">
            {isAppsScriptConnected ? (
              <Badge variant="success" className="shadow-xs text-[10px] sm:text-xs py-1 px-2.5 select-none">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse mr-1.5" />
                Live Cloud Sync
              </Badge>
            ) : (
              <Badge variant="default" className="shadow-xs text-[10px] sm:text-xs py-1 px-2.5 select-none">
                <Server className="w-3 h-3 mr-1" />
                Local Engine
              </Badge>
            )}

            {/* Mobile Hamburger Toggle Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 rounded-xl bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900 lg:hidden cursor-pointer"
            >
              {isMobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer Dropdown */}
        {isMobileMenuOpen && (
          <div className="lg:hidden border-t border-slate-200 bg-white p-3 space-y-1 animate-in fade-in slide-in-from-top-2">
            <button
              onClick={() => { setCurrentPage('catalog'); setIsMobileMenuOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold ${
                currentPage === 'catalog' ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Table className="w-4 h-4" />
              1. Customer Price Catalog
            </button>

            <button
              onClick={() => { setCurrentPage('quotation'); setIsMobileMenuOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold ${
                currentPage === 'quotation' ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <FileText className="w-4 h-4 text-indigo-600" />
              2. Create Quotation
            </button>

            <button
              onClick={() => { setCurrentPage('products'); setIsMobileMenuOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold ${
                currentPage === 'products' ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <PackagePlus className="w-4 h-4" />
              3. Manage Products
            </button>

            <button
              onClick={() => { setCurrentPage('customers'); setIsMobileMenuOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold ${
                currentPage === 'customers' ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Users className="w-4 h-4" />
              4. Manage Customers
            </button>
          </div>
        )}
      </header>

      {/* Main Page Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8">
        {currentPage === 'catalog' ? (
          <CustomerCatalog 
            onNavigateToQuotation={(cid) => { setPrefillCustomer(cid); setCurrentPage('quotation'); }} 
          />
        ) : currentPage === 'quotation' ? (
          <Quotation 
            initialCustomerId={prefillCustomer} 
            onNavigateToCatalog={(cid) => { setPrefillCustomer(cid); setCurrentPage('catalog'); }}
          />
        ) : currentPage === 'products' ? (
          <Manage mode="product" />
        ) : (
          <Manage mode="customer" prefillCustomer={prefillCustomer} prefillProduct={prefillProduct} />
        )}
      </main>
    </div>
  );
}
