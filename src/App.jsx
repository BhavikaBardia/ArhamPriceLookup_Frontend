import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Login } from './pages/Login';
import { CustomerCatalog } from './pages/CustomerCatalog';
import { Manage } from './pages/Manage';
import { Quotation } from './pages/Quotation';
import { AdminSecurityModal } from './components/AdminSecurityModal';
import { AdminLockScreen } from './components/AdminLockScreen';
import { ScrollToTop } from './components/ScrollToTop';
import { 
  Sparkles, Table, Menu, X, PackagePlus, Users, FileText,
  ShieldCheck, Lock, Settings, LogOut, User as UserIcon
} from 'lucide-react';

function AppContent() {
  const { user, isAuthenticated, role, isAdmin, isSales, openSecurityModal, logout } = useAuth();
  const [currentPage, setCurrentPage] = useState('catalog'); // 'catalog', 'quotation', 'products', 'customers'

  // Navigation prefill parameters
  const [prefillCustomer, setPrefillCustomer] = useState('');
  const [prefillProduct, setPrefillProduct] = useState('');

  // Mobile navigation drawer toggle
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // If user is not authenticated, show the Login page
  if (!isAuthenticated) {
    return <Login />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      {/* Top Header Navigation Bar */}
      <header className="sticky top-0 z-40 bg-white/95 border-b border-slate-200/80 backdrop-blur-xl shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 min-h-[64px] py-2 flex items-center justify-between gap-3">
          
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
              {!isAdmin && <Lock className="w-3 h-3 text-slate-400 ml-0.5" />}
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
              {!isAdmin && <Lock className="w-3 h-3 text-slate-400 ml-0.5" />}
            </button>
          </nav>

          {/* Right Header: User Profile Pill & Logout */}
          <div className="flex items-center gap-2 shrink-0">
            {/* User Profile Pill & Settings */}
            <div className="flex items-center gap-1.5 bg-slate-100/90 border border-slate-200/90 rounded-xl p-1 shadow-xs">
              <button
                type="button"
                onClick={openSecurityModal}
                className="flex items-center gap-2 px-2.5 py-1 rounded-lg text-xs text-slate-800 bg-white shadow-xs hover:bg-slate-50 transition-colors cursor-pointer"
                title="Account & Security Settings"
              >
                <div className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-[10px]">
                  {user?.full_name ? user.full_name[0].toUpperCase() : 'U'}
                </div>
                <div className="text-left hidden sm:block">
                  <div className="font-bold text-slate-800 text-[11px] leading-tight truncate max-w-[110px]">
                    {user?.full_name || user?.username}
                  </div>
                  <div className="text-[9px] font-semibold text-indigo-600 uppercase tracking-wider">
                    {role}
                  </div>
                </div>
                <Settings className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600 ml-0.5" />
              </button>

              <button
                type="button"
                onClick={logout}
                className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                title="Sign Out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>

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
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold ${
                currentPage === 'catalog' ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2">
                <Table className="w-4 h-4" />
                1. Customer Price Catalog
              </div>
            </button>

            <button
              onClick={() => { setCurrentPage('quotation'); setIsMobileMenuOpen(false); }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold ${
                currentPage === 'quotation' ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-600" />
                2. Create Quotation
              </div>
            </button>

            <button
              onClick={() => { setCurrentPage('products'); setIsMobileMenuOpen(false); }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold ${
                currentPage === 'products' ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2">
                <PackagePlus className="w-4 h-4" />
                3. Manage Products
              </div>
              {!isAdmin && <Lock className="w-3.5 h-3.5 text-slate-400" />}
            </button>

            <button
              onClick={() => { setCurrentPage('customers'); setIsMobileMenuOpen(false); }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold ${
                currentPage === 'customers' ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                4. Manage Customers
              </div>
              {!isAdmin && <Lock className="w-3.5 h-3.5 text-slate-400" />}
            </button>
          </div>
        )}
      </header>

      {/* Main Page Container - Kept mounted in DOM for instant 0ms tab switching */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 pt-3.5 sm:pt-8">
        <div className={currentPage === 'catalog' ? 'block' : 'hidden'}>
          <CustomerCatalog 
            onNavigateToQuotation={(cid) => { setPrefillCustomer(cid); setCurrentPage('quotation'); }} 
          />
        </div>

        <div className={currentPage === 'quotation' ? 'block' : 'hidden'}>
          <Quotation 
            initialCustomerId={prefillCustomer} 
            onNavigateToCatalog={(cid) => { setPrefillCustomer(cid); setCurrentPage('catalog'); }}
          />
        </div>

        {isAdmin ? (
          <>
            <div className={currentPage === 'products' ? 'block' : 'hidden'}>
              <Manage mode="product" />
            </div>

            <div className={currentPage === 'customers' ? 'block' : 'hidden'}>
              <Manage mode="customer" prefillCustomer={prefillCustomer} prefillProduct={prefillProduct} />
            </div>
          </>
        ) : (
          (currentPage === 'products' || currentPage === 'customers') && (
            <AdminLockScreen 
              title={currentPage === 'products' ? "Product Management" : "Customer Management"} 
              onNavigateToCatalog={() => setCurrentPage('catalog')} 
            />
          )
        )}
      </main>

      {/* Floating Scroll To Top Button */}
      <ScrollToTop />

      {/* Security & Account Settings Modal */}
      <AdminSecurityModal />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
