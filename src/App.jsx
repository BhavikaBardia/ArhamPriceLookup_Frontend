import React, { useState, useEffect } from 'react';
import { api } from './api';
import { PriceLookup } from './pages/PriceLookup';
import { CustomerCatalog } from './pages/CustomerCatalog';
import { Manage } from './pages/Manage';
import { Quotation } from './pages/Quotation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './components/ui/Dialog';
import { Badge } from './components/ui/Badge';
import { 
  Search, Database, Layers, CheckCircle2, AlertCircle, Settings, 
  Sparkles, Server, Sheet, Table, Menu, X, PackagePlus, Users, DollarSign, FileText
} from 'lucide-react';

export default function App() {
  const [currentPage, setCurrentPage] = useState('lookup'); // 'lookup', 'catalog', 'pricing', 'products', 'customers'
  const [status, setStatus] = useState(null);
  
  // Navigation prefill parameters
  const [prefillCustomer, setPrefillCustomer] = useState('');
  const [prefillProduct, setPrefillProduct] = useState('');

  // Mobile navigation drawer toggle
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Settings modal
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [scriptUrlInput, setScriptUrlInput] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectMessage, setConnectMessage] = useState(null);

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      const data = await api.getHealth();
      setStatus(data);
      if (data.script_url) {
        setScriptUrlInput(data.script_url);
      }
    } catch (err) {
      console.error('Failed to get status:', err);
    }
  };

  const handleNavigateToManage = (customerId, productId) => {
    setPrefillCustomer(customerId);
    setPrefillProduct(productId);
    setCurrentPage('pricing');
  };

  const handleConnectAppsScript = async (e) => {
    e.preventDefault();
    if (!scriptUrlInput.trim()) {
      setConnectMessage({ type: 'error', text: 'Please enter a valid Google Apps Script Web App URL.' });
      return;
    }

    setIsConnecting(true);
    setConnectMessage(null);

    try {
      const res = await api.connectAppsScript(scriptUrlInput.trim());
      setConnectMessage({ type: 'success', text: 'Successfully connected to Google Apps Script Web App!' });
      setStatus(res);
      setTimeout(() => setIsSettingsOpen(false), 1500);
    } catch (err) {
      const msg = err.message || 'Failed to connect to Google Apps Script Web App';
      setConnectMessage({ type: 'error', text: msg });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnectAppsScript = () => {
    api.disconnectAppsScript();
    setScriptUrlInput('');
    setConnectMessage({ type: 'success', text: 'Disconnected Apps Script. Switched to Local Engine.' });
    checkStatus();
  };

  const isAppsScriptConnected = status?.mode === 'google_apps_script' || !!status?.script_url;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      {/* Top Header Navigation Bar */}
      <header className="sticky top-0 z-40 bg-white/90 border-b border-slate-200/80 backdrop-blur-xl shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 min-h-[64px] py-2 flex items-center justify-between gap-2">
          
          {/* Logo & Brand */}
          <div className="flex items-center gap-2.5 cursor-pointer shrink-0" onClick={() => setCurrentPage('lookup')}>
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
              onClick={() => setCurrentPage('lookup')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                currentPage === 'lookup'
                  ? 'bg-white text-indigo-700 shadow-sm border border-slate-200/60 font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              1. Price Lookup
            </button>

            <button
              onClick={() => setCurrentPage('catalog')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                currentPage === 'catalog'
                  ? 'bg-white text-indigo-700 shadow-sm border border-slate-200/60 font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <Table className="w-3.5 h-3.5" />
              2. Customer Price Catalog
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
              3. Create Quotation
            </button>

            <button
              onClick={() => setCurrentPage('products')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                currentPage === 'products'
                  ? 'bg-white text-indigo-700 shadow-sm border border-slate-200/60 font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <PackagePlus className="w-3.5 h-3.5" />
              4. Manage Products
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
              5. Manage Customers
            </button>
          </nav>

          {/* Database Mode Status Pill & Settings */}
          <div className="flex items-center gap-2 shrink-0">
            {isAppsScriptConnected ? (
              <Badge variant="success" className="cursor-pointer shadow-xs text-[10px] sm:text-xs py-1 px-2.5" onClick={() => setIsSettingsOpen(true)}>
                <Sheet className="w-3 h-3 mr-1" />
                Apps Script Live
              </Badge>
            ) : (
              <Badge variant="default" className="cursor-pointer shadow-xs text-[10px] sm:text-xs py-1 px-2.5" onClick={() => setIsSettingsOpen(true)}>
                <Server className="w-3 h-3 mr-1" />
                Local Engine
              </Badge>
            )}

            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 rounded-xl bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 transition-all cursor-pointer"
              title="Google Apps Script Web App Settings"
            >
              <Settings className="w-4 h-4" />
            </button>

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
              onClick={() => { setCurrentPage('lookup'); setIsMobileMenuOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold ${
                currentPage === 'lookup' ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Search className="w-4 h-4" />
              1. Price Lookup
            </button>

            <button
              onClick={() => { setCurrentPage('catalog'); setIsMobileMenuOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold ${
                currentPage === 'catalog' ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Table className="w-4 h-4" />
              2. Customer Price Catalog
            </button>

            <button
              onClick={() => { setCurrentPage('quotation'); setIsMobileMenuOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold ${
                currentPage === 'quotation' ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <FileText className="w-4 h-4 text-indigo-600" />
              3. Create Quotation
            </button>

            <button
              onClick={() => { setCurrentPage('products'); setIsMobileMenuOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold ${
                currentPage === 'products' ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <PackagePlus className="w-4 h-4" />
              4. Manage Products
            </button>

            <button
              onClick={() => { setCurrentPage('customers'); setIsMobileMenuOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold ${
                currentPage === 'customers' ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Users className="w-4 h-4" />
              5. Manage Customers
            </button>
          </div>
        )}
      </header>

      {/* Main Page Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8">
        {currentPage === 'lookup' ? (
          <PriceLookup 
            onNavigateToManage={handleNavigateToManage} 
            onNavigateToQuotation={(cid) => { setPrefillCustomer(cid); setCurrentPage('quotation'); }} 
          />
        ) : currentPage === 'catalog' ? (
          <CustomerCatalog 
            onNavigateToQuotation={(cid) => { setPrefillCustomer(cid); setCurrentPage('quotation'); }} 
          />
        ) : currentPage === 'quotation' ? (
          <Quotation initialCustomerId={prefillCustomer} />
        ) : currentPage === 'products' ? (
          <Manage mode="product" />
        ) : (
          <Manage mode="customer" prefillCustomer={prefillCustomer} prefillProduct={prefillProduct} />
        )}
      </main>

      {/* Settings Modal Dialog */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sheet className="w-5 h-5 text-emerald-600" />
              Google Apps Script Web App Connection
            </DialogTitle>
            <DialogDescription>
              Connect your Google Apps Script Web App URL to sync directly with your Google Sheet.
            </DialogDescription>
          </DialogHeader>

          {connectMessage && (
            <div className={`p-3 rounded-xl text-xs flex items-center gap-2 border ${
              connectMessage.type === 'success' 
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}>
              {connectMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              {connectMessage.text}
            </div>
          )}

          <form onSubmit={handleConnectAppsScript} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Google Apps Script Web App URL</label>
              <input
                type="text"
                value={scriptUrlInput}
                onChange={(e) => setScriptUrlInput(e.target.value)}
                placeholder="https://script.google.com/macros/s/.../exec"
                className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
              <p className="text-[11px] text-slate-400">
                Created in Google Sheets via <strong>Extensions &gt; Apps Script &gt; Deploy &gt; New deployment &gt; Web app</strong>.
              </p>
            </div>

            <div className="pt-2 flex justify-between gap-2">
              {isAppsScriptConnected && (
                <button
                  type="button"
                  onClick={handleDisconnectAppsScript}
                  className="px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200"
                >
                  Disconnect Apps Script
                </button>
              )}

              <div className="flex gap-2 ml-auto">
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={isConnecting}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
                >
                  {isConnecting ? 'Connecting...' : 'Connect Apps Script'}
                </button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
