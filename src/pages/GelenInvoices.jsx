import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';

const normalizeText = (text) => {
  if (!text) return '';
  return text
    .toString()
    .replace(/İ/g, 'i')
    .replace(/I/g, 'ı')
    .toLowerCase()
    .replace(/ç/g, 'c')
    .replace(/ğ/g, 'g')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ş/g, 's')
    .replace(/ü/g, 'u')
    .trim();
};

const isItemMatching = (item, term) => {
  if (!term || !term.trim()) return false;
  const normalizedTerm = normalizeText(term);
  const name1 = normalizeText(item.urun_adi);
  const name2 = normalizeText(item.db_urun_adi);
  return name1.includes(normalizedTerm) || name2.includes(normalizedTerm);
};

export default function GelenInvoices({ setAuth }) {
  const navigate = useNavigate();
  
  const [toptancilar, setToptancilar] = useState([]);
  const [selectedToptanci, setSelectedToptanci] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [globalLoading, setGlobalLoading] = useState(true);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [faturaNoToDelete, setFaturaNoToDelete] = useState('');

  // Arama Durumları
  const [searchTerm, setSearchTerm] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [searchScope, setSearchScope] = useState('all'); // 'all' veya 'selected'
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [toptanciFilter, setToptanciFilter] = useState('');

  const fetchToptancilar = async () => {
    try {
      setGlobalLoading(true);
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/toptancilar-list`);
      if (response.ok) {
        const data = await response.json();
        setToptancilar(data);
      }
    } catch (err) {
      console.error("Toptancı listesi çekilemedi:", err);
    } finally {
      setGlobalLoading(false);
    }
  };

  useEffect(() => {
    fetchToptancilar();
  }, []);

  const handleToptanciClick = async (name) => {
    setSelectedToptanci(name);
    setLoadingInvoices(true);
    // Seçili tedarikçiye tıklandığında eğer 'selected' modunda arama yapılıyorsa aramayı güncelleyebilir
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/toptanci-invoices/${encodeURIComponent(name)}`);
      if (response.ok) {
        const data = await response.json();
        setInvoices(data);
      }
    } catch (err) {
      console.error("Fatura geçmişi yüklenemedi:", err);
    } finally {
      setLoadingInvoices(false);
    }
  };

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    const query = searchTerm.trim();
    if (!query) {
      handleClearSearch();
      return;
    }

    setSearchLoading(true);
    setIsSearching(true);
    setActiveSearch(query);

    try {
      const scopeToptanci = searchScope === 'selected' && selectedToptanci ? selectedToptanci : '';
      const params = new URLSearchParams({ q: query });
      if (scopeToptanci) {
        params.append('toptanci', scopeToptanci);
      }

      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/search-gelen-invoices?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data);
      } else {
        console.error("Arama servisi yanıt vermedi");
        setSearchResults([]);
      }
    } catch (err) {
      console.error("Arama sırasında hata oluştu:", err);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleClearSearch = () => {
    setSearchTerm('');
    setActiveSearch('');
    setIsSearching(false);
    setSearchResults([]);
  };

  const triggerDeleteModal = (e, faturaNo) => {
    e.stopPropagation();
    setFaturaNoToDelete(faturaNo);
    setIsModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!faturaNoToDelete) return;
    setDeleteLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/delete-invoice/${faturaNoToDelete}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        setIsModalOpen(false);
        const deletedFatura = faturaNoToDelete;
        setFaturaNoToDelete('');
        
        // Arama sonuçlarından da düşelim
        if (isSearching) {
          setSearchResults(prev => prev.filter(inv => inv.fatura_no !== deletedFatura));
        }
        
        if (selectedToptanci) {
          handleToptanciClick(selectedToptanci);
        }
        fetchToptancilar(); 
        alert("Fatura başarıyla iptal edildi ve giren tüm stoklar depodan geri düşüldü!");
      } else {
        const errData = await response.json();
        alert(`Hata: ${errData.detail || "Fatura iptal edilemedi."}`);
      }
    } catch (err) {
      alert("Sunucu bağlantı hatası.");
    } finally {
      setDeleteLoading(false);
    }
  };

  const filteredToptancilar = toptancilar.filter(top =>
    normalizeText(top.toptanci_unvani).includes(normalizeText(toptanciFilter))
  );

  return (
    <Layout title="Gelen Alım Faturaları Arşivi" setAuth={setAuth}>
      <main className="flex-1 overflow-y-auto bg-transparent p-4 sm:p-8 flex flex-col space-y-4">
        
        {/* ARAMA VE FİLTRELEME ÇUBUĞU */}
        <div className="bg-gray-200 border border-gray-300 p-4 rounded-2xl shadow-sm">
          <form onSubmit={handleSearch} className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
            
            {/* Arama Inputu */}
            <div className="relative flex-1">
              <svg className="w-4 h-4 text-gray-500 absolute left-3.5 top-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Ürün adı, barkod veya evrak no ile ara... (Örn: Lipton, Soda, 0BA2026...)"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-9 py-2.5 bg-gray-300 border border-gray-300 rounded-xl text-xs text-gray-900 outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-400 transition-all placeholder:text-gray-500"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-3 text-gray-400 hover:text-gray-700 transition-colors cursor-pointer"
                  title="Temizle"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Arama Kapsamı (Tüm Tedarikçiler / Seçili Tedarikçi) */}
            {selectedToptanci && (
              <div className="flex items-center gap-1 bg-gray-300 p-1 rounded-xl text-[11px] shrink-0 border border-gray-300">
                <button
                  type="button"
                  onClick={() => setSearchScope('all')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    searchScope === 'all' 
                      ? 'bg-white text-gray-900 shadow-xs' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Tüm Tedarikçiler
                </button>
                <button
                  type="button"
                  onClick={() => setSearchScope('selected')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all truncate max-w-[150px] cursor-pointer ${
                    searchScope === 'selected' 
                      ? 'bg-white text-gray-900 shadow-xs' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                  title={selectedToptanci}
                >
                  Sadece Seçili Firma
                </button>
              </div>
            )}

            {/* Arama ve Temizleme Butonları */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="submit"
                disabled={searchLoading}
                className="px-5 py-2.5 bg-gray-900 hover:bg-gray-800 active:scale-95 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer flex items-center justify-center gap-2 flex-1 md:flex-initial"
              >
                {searchLoading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                ) : (
                  <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                )}
                <span>Fatura & Ürün Ara</span>
              </button>

              {isSearching && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="px-3.5 py-2.5 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
                  title="Aramayı Temizle"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span>Sıfırla</span>
                </button>
              )}
            </div>

          </form>

          {/* Aktif Arama Bilgi Şeridi */}
          {isSearching && (
            <div className="mt-3 pt-3 border-t border-gray-300 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 text-gray-700">
                <span className="font-semibold">Arama:</span>
                <span className="bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded border border-amber-300">
                  "{activeSearch}"
                </span>
                <span className="text-gray-500">
                  ({searchScope === 'selected' && selectedToptanci ? `${selectedToptanci} içinde` : 'Tüm tedarikçi faturalarında'})
                </span>
              </div>
              <span className="font-bold text-gray-800 bg-gray-300 px-2.5 py-1 rounded-md border border-gray-300">
                {searchResults.length} Fatura Bulundu
              </span>
            </div>
          )}
        </div>

        {/* ANA İÇERİK GRID'İ */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 flex-1 min-h-[550px]">
          
          {/* SOL SÜTUN: TEDARİKÇİ FİRMALAR */}
          <div className="xl:col-span-1 flex flex-col h-[50vh] xl:h-[74vh] overflow-hidden">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-xs font-bold text-gray-600 uppercase tracking-widest">
                Tedarikçi Firmalar ({toptancilar.length})
              </h3>
            </div>

            {/* Tedarikçi içi filtre */}
            {toptancilar.length > 5 && (
              <div className="mb-3">
                <input
                  type="text"
                  placeholder="Tedarikçi filtrele..."
                  value={toptanciFilter}
                  onChange={(e) => setToptanciFilter(e.target.value)}
                  className="w-full px-3 py-1.5 bg-gray-200 border border-gray-300 rounded-lg text-[11px] text-gray-800 outline-none placeholder:text-gray-500"
                />
              </div>
            )}

            {globalLoading ? (
              <div className="flex-1 flex items-center justify-center bg-gray-200 border border-gray-300 rounded-2xl">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-900"></div>
              </div>
            ) : toptancilar.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-gray-400 rounded-2xl p-6 text-gray-600 text-center">
                <p className="text-xs">Henüz işlenmiş alım faturası bulunmuyor.</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin">
                {filteredToptancilar.map((top) => (
                  <div 
                    key={top.id}
                    onClick={() => {
                      handleToptanciClick(top.toptanci_unvani);
                      if (isSearching && searchScope === 'selected') {
                        // Seçili toptancı değişince aramayı bu toptancıya göre yenile
                        setTimeout(() => handleSearch(), 50);
                      }
                    }}
                    className={`p-4 rounded-xl border transition-all cursor-pointer ${
                      selectedToptanci === top.toptanci_unvani 
                        ? 'bg-gray-400 border-gray-400 shadow-sm ring-1 ring-gray-500' 
                        : 'bg-gray-200 border-gray-300 hover:border-gray-400 hover:bg-gray-300'
                    }`}
                  >
                    <h4 className="text-xs font-bold text-gray-900 line-clamp-2 min-h-[32px]">{top.toptanci_unvani}</h4>
                    <div className="flex justify-between items-center mt-3 pt-2 border-t border-gray-200 text-[11px]">
                      <span className="text-gray-600">📄 {top.invoice_count} Adet Fatura</span>
                      <span className="font-black text-gray-800">₺{top.total_bought.toLocaleString('tr-TR')}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SAĞ SÜTUN: FATURA GEÇMİŞİ / ARAMA SONUÇLARI ALANI */}
          <div className="xl:col-span-2 bg-gray-200 border border-gray-300 rounded-2xl p-4 sm:p-6 flex flex-col overflow-hidden min-h-[500px] xl:h-[74vh] shadow-sm">
            
            {/* DURUM 1: ARAMA AKTİFSE ARAMA SONUÇLARINI GÖSTER */}
            {isSearching ? (
              <div className="flex flex-col h-full space-y-4 overflow-hidden animate-[fadeIn_0.2s_ease-out]">
                
                {/* Arama Başlığı */}
                <div className="border-b border-gray-300 pb-3 flex flex-wrap justify-between items-center gap-2">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 bg-amber-500 text-white rounded-lg">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </span>
                    <div>
                      <h3 className="text-sm font-bold text-gray-900">
                        "{activeSearch}" İçeren Faturalar
                      </h3>
                      <p className="text-[11px] text-gray-500">
                        {searchScope === 'selected' && selectedToptanci ? `${selectedToptanci} tedarikçisinde arandı` : 'Tüm gelen alım faturalarında arandı'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-700 bg-gray-300 px-3 py-1 border border-gray-300 rounded-md">
                      {searchResults.length} Fatura
                    </span>
                    <button
                      onClick={handleClearSearch}
                      className="text-xs font-semibold text-gray-600 hover:text-gray-900 bg-gray-300 hover:bg-gray-400 px-2.5 py-1 rounded-md transition-colors cursor-pointer"
                    >
                      Aramayı Kapat
                    </button>
                  </div>
                </div>

                {/* Arama Yükleniyor */}
                {searchLoading ? (
                  <div className="flex-1 flex flex-col items-center justify-center gap-2">
                    <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-gray-900"></div>
                    <span className="text-xs text-gray-600 font-medium">Faturalar taranıyor...</span>
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-gray-600 gap-3">
                    <div className="w-12 h-12 rounded-full bg-gray-300 flex items-center justify-center text-gray-500">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    <h4 className="text-sm font-bold text-gray-800">Eşleşen Fatura veya Ürün Bulunamadı</h4>
                    <p className="text-xs text-gray-500 max-w-sm">
                      "<span className="font-semibold text-gray-700">{activeSearch}</span>" kriterine uygun alım faturası bulunamadı. Ürün adının bir kısmını (örn: "Lipton" veya "Soda") yazarak tekrar arayabilirsiniz.
                    </p>
                    <button
                      onClick={handleClearSearch}
                      className="mt-2 px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-xl text-xs font-bold transition-all cursor-pointer"
                    >
                      Tüm Faturalara Geri Dön
                    </button>
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin">
                    {searchResults.map((inv, idx) => {
                      const matchingItemsCount = (inv.kalemler || []).filter(item => isItemMatching(item, activeSearch)).length;

                      return (
                        <div key={inv._id || idx} className="border border-gray-300 bg-gray-300 rounded-xl p-4 space-y-3 relative group">
                          
                          <button
                            onClick={(e) => triggerDeleteModal(e, inv.fatura_no)}
                            className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity bg-red-50 border border-red-100 hover:bg-red-500 text-red-500 hover:text-white rounded-md text-[10px] px-2 py-1 font-bold cursor-pointer z-10"
                          >
                            Faturayı İptal Et (Stoktan Düş)
                          </button>

                          {/* Fatura Başlığı & Tedarikçi Bilgisi */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-gray-200 p-2.5 rounded-lg border border-gray-300 w-full sm:w-5/6">
                            <div className="text-[11px] flex flex-wrap items-center gap-x-2 gap-y-1">
                              {inv.musteri_unvani && (
                                <span className="bg-amber-100 border border-amber-300 text-amber-900 font-bold px-2 py-0.5 rounded text-[10px] flex items-center gap-1">
                                  🏢 {inv.musteri_unvani}
                                </span>
                              )}
                              <span className="text-gray-700 font-mono font-bold">Evrak No: {inv.fatura_no}</span>
                              <span className="text-gray-400">|</span>
                              <span className="text-gray-600">Tarih: {inv.fatura_tarihi}</span>
                              {matchingItemsCount > 0 && (
                                <span className="bg-green-100 border border-green-300 text-green-800 font-bold px-1.5 py-0.5 rounded text-[10px]">
                                  ✓ {matchingItemsCount} Eşleşen Ürün
                                </span>
                              )}
                            </div>
                            <span className="text-xs font-black text-gray-800 bg-gray-400 border border-gray-300 px-2.5 py-0.5 rounded self-start sm:self-auto">
                              ₺{inv.toplam_tutar?.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>

                          {/* Kalemler Tablosu (Masaüstü) */}
                          <div className="mt-3">
                            <div className="hidden md:block overflow-x-auto">
                              <table className="w-full min-w-[400px] text-left border-collapse text-[11px]">
                                <thead>
                                  <tr className="text-gray-600 border-b border-gray-300 uppercase font-bold text-[10px]">
                                    <th className="pb-2">İşlenen Stok Kartı</th>
                                    <th className="pb-2 text-center">Giren Miktar</th>
                                    <th className="pb-2 text-right">Birim Fiyat</th>
                                    <th className="pb-2 text-right">Toplam</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-300 text-gray-700">
                                  {inv.kalemler?.map((item, itemIdx) => {
                                    const isMatch = isItemMatching(item, activeSearch);
                                    const displayName = item.db_urun_adi || item.urun_adi;
                                    
                                    return (
                                      <tr 
                                        key={itemIdx} 
                                        className={`transition-colors ${
                                          isMatch 
                                            ? 'bg-amber-100 font-bold text-amber-950 border-l-4 border-amber-500' 
                                            : 'hover:bg-gray-200'
                                        }`}
                                      >
                                        <td className="py-2 px-2 font-medium text-gray-900">
                                          <div className="flex items-center gap-2">
                                            <span>{displayName}</span>
                                            {isMatch && (
                                              <span className="bg-amber-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider">
                                                Aranan Ürün
                                              </span>
                                            )}
                                          </div>
                                        </td>
                                        <td className="py-2 text-center text-gray-700 font-black">+{item.miktar}</td>
                                        <td className="py-2 text-right text-gray-600">₺{item.birim_fiyat?.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
                                        <td className="py-2 pr-2 text-right font-bold text-gray-900">₺{item.toplam?.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>

                            {/* Mobil Kart Görünümü */}
                            <div className="md:hidden flex flex-col space-y-2">
                              {inv.kalemler?.map((item, itemIdx) => {
                                const isMatch = isItemMatching(item, activeSearch);
                                const displayName = item.db_urun_adi || item.urun_adi;
                                
                                return (
                                  <div 
                                    key={itemIdx} 
                                    className={`border p-3 rounded-lg flex flex-col gap-2 transition-all ${
                                      isMatch 
                                        ? 'bg-amber-50 border-amber-400 ring-1 ring-amber-400' 
                                        : 'bg-gray-200 border-gray-300'
                                    }`}
                                  >
                                    <div className="flex justify-between items-start gap-2">
                                      <span className="font-bold text-gray-900 text-xs">{displayName}</span>
                                      {isMatch && (
                                        <span className="bg-amber-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded shrink-0">
                                          Aranan Ürün
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex justify-between items-end">
                                      <div className="flex flex-col">
                                        <span className="text-[10px] text-gray-500 uppercase font-bold">Miktar</span>
                                        <span className="text-xs font-black text-blue-600">+{item.miktar}</span>
                                      </div>
                                      <div className="flex flex-col items-center">
                                        <span className="text-[10px] text-gray-500 uppercase font-bold">Birim Fiyat</span>
                                        <span className="text-xs font-medium text-gray-700">₺{item.birim_fiyat?.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
                                      </div>
                                      <div className="flex flex-col items-end">
                                        <span className="text-[10px] text-gray-500 uppercase font-bold">Toplam</span>
                                        <span className="text-xs font-black text-gray-900">₺{item.toplam?.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                        </div>
                      );
                    })}
                  </div>
                )}

              </div>
            ) : selectedToptanci ? (
              /* DURUM 2: SEÇİLİ TEDARİKÇİ FATURALARINI GÖSTER (NORMAL MOD) */
              <div className="flex flex-col h-full space-y-4 overflow-hidden animate-[slideUp_0.2s_ease-out]">
                <div className="border-b border-gray-200 pb-3.5 flex justify-between items-end">
                  <h3 className="text-sm font-bold text-gray-900 max-w-xl truncate">{selectedToptanci}</h3>
                  <span className="text-xs font-semibold text-gray-600 bg-gray-300 px-2.5 py-1 border border-gray-300 rounded-md">
                    {invoices.length} Fatura Geçmişi
                  </span>
                </div>

                {loadingInvoices ? (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
                  </div>
                ) : invoices.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-gray-600 gap-2">
                    <p className="text-xs font-medium">Bu tedarikçiye ait kayıtlı fatura bulunamadı.</p>
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin">
                    {invoices.map((inv, idx) => (
                      <div key={inv._id || idx} className="border border-gray-300 bg-gray-300 rounded-xl p-4 space-y-3 relative group">
                        
                        <button
                          onClick={(e) => triggerDeleteModal(e, inv.fatura_no)}
                          className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity bg-red-50 border border-red-100 hover:bg-red-500 text-red-500 hover:text-white rounded-md text-[10px] px-2 py-1 font-bold cursor-pointer z-10"
                        >
                          Faturayı İptal Et (Stoktan Düş)
                        </button>

                        <div className="flex justify-between items-center bg-gray-200 p-2.5 rounded-lg border border-gray-300 w-5/6">
                          <div className="text-[11px]">
                            <span className="text-gray-700 font-mono font-bold">Evrak No: {inv.fatura_no}</span>
                            <span className="text-gray-400 mx-2">|</span>
                            <span className="text-gray-600">Tarih: {inv.fatura_tarihi}</span>
                          </div>
                          <span className="text-xs font-black text-gray-800 bg-gray-400 border border-gray-300 px-2.5 py-0.5 rounded">
                            ₺{inv.toplam_tutar?.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>

                        <div className="mt-3">
                          {/* Masaüstü Tablo Görünümü */}
                          <div className="hidden md:block overflow-x-auto">
                            <table className="w-full min-w-[400px] text-left border-collapse text-[11px]">
                              <thead>
                                <tr className="text-gray-600 border-b border-gray-300 uppercase font-bold text-[10px]">
                                  <th className="pb-2">İşlenen Stok Kartı</th>
                                  <th className="pb-2 text-center">Giren Miktar</th>
                                  <th className="pb-2 text-right">Birim Fiyat</th>
                                  <th className="pb-2 text-right">Toplam</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-300 text-gray-700">
                                {inv.kalemler?.map((item, itemIdx) => (
                                  <tr key={itemIdx} className="hover:bg-gray-200">
                                    <td className="py-2 font-medium text-gray-900">
                                      {item.db_urun_adi || item.urun_adi}
                                    </td>
                                    <td className="py-2 text-center text-gray-700 font-black">+{item.miktar}</td>
                                    <td className="py-2 text-right text-gray-600">₺{item.birim_fiyat?.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
                                    <td className="py-2 text-right font-bold text-gray-900">₺{item.toplam?.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          {/* Mobil Kart Görünümü */}
                          <div className="md:hidden flex flex-col space-y-2">
                            {inv.kalemler?.map((item, itemIdx) => (
                              <div key={itemIdx} className="bg-gray-200 border border-gray-300 p-3 rounded-lg flex flex-col gap-2">
                                <span className="font-bold text-gray-900 text-xs">{item.db_urun_adi || item.urun_adi}</span>
                                <div className="flex justify-between items-end">
                                  <div className="flex flex-col">
                                    <span className="text-[10px] text-gray-500 uppercase font-bold">Miktar</span>
                                    <span className="text-xs font-black text-blue-600">+{item.miktar}</span>
                                  </div>
                                  <div className="flex flex-col items-center">
                                    <span className="text-[10px] text-gray-500 uppercase font-bold">Birim Fiyat</span>
                                    <span className="text-xs font-medium text-gray-700">₺{item.birim_fiyat?.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
                                  </div>
                                  <div className="flex flex-col items-end">
                                    <span className="text-[10px] text-gray-500 uppercase font-bold">Toplam</span>
                                    <span className="text-xs font-black text-gray-900">₺{item.toplam?.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* DURUM 3: HENÜZ TEDARİKÇİ SEÇİLMEMİŞ VE ARAMA YAPILMAMIŞSA */
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-gray-600 gap-3">
                <div className="w-14 h-14 rounded-2xl bg-gray-300 flex items-center justify-center text-gray-600 shadow-inner">
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <div className="max-w-md">
                  <h4 className="text-sm font-bold text-gray-900 mb-1">Fatura Arşivine Hoş Geldiniz</h4>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    Belirli bir ürünü hangi faturada aldığınızı bulmak için yukarıdaki <span className="font-bold text-gray-900">arama çubuğunu</span> kullanabilir veya soldaki listeden bir tedarikçi seçebilirsiniz.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* MODERN UI FATURA İPTAL ONAY KARTI (MODAL) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-gray-200 border border-gray-300 max-w-md w-full p-6 rounded-2xl shadow-xl relative overflow-hidden animate-[scaleUp_0.25s_ease-out]">
            <h3 className="text-base font-bold text-gray-900">Fatura İptal Edilsin mi?</h3>
            <p className="text-xs text-gray-600 mt-2 leading-relaxed">
              <span className="text-red-500 font-semibold">{faturaNoToDelete}</span> numaralı faturayı iptal etmek üzeresiniz. 
              Bu işlem faturayla dükkana giren tüm ürün adetlerini **stok envanterinden otomatik olarak düşecektir.**
            </p>
            <div className="mt-6 flex justify-end gap-3 border-t border-gray-200 pt-4">
              <button
                onClick={() => { setIsModalOpen(false); setFaturaNoToDelete(''); }}
                disabled={deleteLoading}
                className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 bg-gray-400 hover:bg-gray-1000 cursor-pointer"
              >
                İptal Et
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleteLoading}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-red-500 hover:bg-red-600 cursor-pointer"
              >
                {deleteLoading ? "Geri Alınıyor..." : "Evet, Faturayı İptal Et"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        .scrollbar-thin::-webkit-scrollbar { width: 4px; }
        .scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
        .scrollbar-thin::-webkit-scrollbar-thumb { background: #d6d3d1; border-radius: 2px; }
      `}</style>
    </Layout>
  );
}
