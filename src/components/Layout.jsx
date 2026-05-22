import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';


export default function Layout({ children, title, setAuth }) {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('user');
    if (setAuth) {
        setAuth(false);
    }
    navigate('/login');
  };

  const menuItems = [
    { path: '/dashboard', label: 'Panel Özeti / İstatistikler', icon: (
      <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
      </svg>
    )},
    { path: '/invoices', label: 'Fatura İşleme Portu', icon: (
      <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    )},
    { path: '/customers', label: 'Cari / Müşteri Kartları', icon: (
      <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    )},
    { path: '/stocks', label: 'Stok / Ürün Envanteri', icon: (
      <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    )},
    { path: '/gelen-invoices', label: 'Toptancı Faturaları', icon: (
      <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
      </svg>
    )}
  ];

  return (
    <div className="flex h-screen bg-[#fcfaf5] text-gray-900 font-sans overflow-hidden select-none">
      
      {/* MOBILE OVERLAY */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden transition-opacity duration-300"
          onClick={() => setIsMobileOpen(false)}
        ></div>
      )}

      {/* MODERN DARK SIDEBAR */}
      <aside className={`fixed lg:relative top-0 left-0 h-full w-[280px] bg-gray-900 flex flex-col z-50 shadow-2xl transition-transform duration-300 ease-in-out ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="p-6 flex items-center justify-between lg:justify-start gap-4 border-b border-gray-800">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-gray-800 rounded-xl shadow-inner border border-gray-700">
              <img className="h-8 w-auto brightness-200" src="/logo.png" alt="Yoltan Gida" />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-widest text-white">YOLTAN</h1>
              <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest mt-0.5">B2B Yönetim</p>
            </div>
          </div>
          <button 
            className="lg:hidden text-gray-400 hover:text-white p-1"
            onClick={() => setIsMobileOpen(false)}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <nav className="flex-1 px-4 py-8 space-y-2 overflow-y-auto">
          {menuItems.map((item) => {
            const isActive = currentPath === item.path;
            return (
              <button
                key={item.path}
                onClick={() => {
                  navigate(item.path);
                  setIsMobileOpen(false); // Close menu on navigation for mobile
                }}
                className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-xl text-sm font-semibold text-left transition-all duration-300 cursor-pointer group relative overflow-hidden
                  ${isActive 
                    ? 'bg-gray-800 text-white shadow-lg border border-gray-700' 
                    : 'text-gray-400 hover:text-white hover:bg-gray-800 hover:shadow-md'}`}
              >
                {isActive && (
                  <span className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500 rounded-r-full shadow-[0_0_10px_rgba(245,158,11,0.5)]"></span>
                )}
                <span className={`transition-transform duration-300 ${isActive ? 'scale-110 text-amber-500' : 'group-hover:scale-110 group-hover:text-amber-400'}`}>
                  {item.icon}
                </span>
                <span className="tracking-wide">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-800">
          <div className="bg-gray-800 rounded-xl p-4 flex items-center justify-between border border-gray-700 hover:border-gray-600 transition-colors cursor-pointer group" onClick={handleLogout}>
             <div className="flex flex-col">
               <span className="text-xs font-bold text-gray-300 group-hover:text-white transition-colors">Oturumu Kapat</span>
               <span className="text-[10px] text-gray-500 group-hover:text-gray-400">Güvenli Çıkış Yap</span>
             </div>
             <svg className="w-5 h-5 text-gray-500 group-hover:text-red-400 transition-colors" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
               <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
             </svg>
          </div>
        </div>
      </aside>

      {/* İÇERİK ALANI */}
      <div className="flex-1 flex flex-col overflow-hidden relative z-10 w-full">
        
        <header className="flex justify-between items-center px-4 sm:px-8 py-4 sm:py-6 bg-[#fcfaf5]/90 backdrop-blur-md border-b border-gray-200/50 sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button 
              className="lg:hidden p-2 -ml-2 mr-1 text-gray-800 hover:bg-gray-200 rounded-xl transition-colors"
              onClick={() => setIsMobileOpen(true)}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <span className="relative h-3 w-3 hidden sm:flex">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
            </span>
            <h2 className="text-lg sm:text-2xl font-black text-gray-800 tracking-tight truncate max-w-[180px] sm:max-w-xs">{title}</h2>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="px-3 py-1.5 sm:px-4 sm:py-2 bg-white rounded-full border border-gray-200 shadow-sm text-[10px] sm:text-xs font-bold text-gray-600 flex items-center gap-1.5 sm:gap-2">
              <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-gray-100 flex items-center justify-center">👤</div>
              <span className="hidden sm:inline">Yönetici Paneli</span>
              <span className="sm:hidden">Yönetici</span>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-auto bg-transparent relative p-4 sm:p-8">
            <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] bg-amber-600/5 rounded-full blur-[120px] pointer-events-none hidden sm:block"></div>
            {children}
        </div>
      </div>
    </div>
  );
}
