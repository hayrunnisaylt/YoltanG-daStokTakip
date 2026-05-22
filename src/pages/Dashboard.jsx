import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';

export default function Dashboard({ setAuth }) {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user')) || { name: 'Yoltan Yönetici' };
  
  const [stats, setStats] = useState({
    total_products: 0,
    total_customers: 0,
    total_invoices: 0,
    total_amount: 0,
    recent_invoices: []
  });
  
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedFaturaNo, setSelectedFaturaNo] = useState('');

  const fetchStats = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/dashboard-stats`);
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (err) {
      console.error("Veriler yüklenemedi:", err);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const triggerDeleteModal = (faturaNo) => {
    setSelectedFaturaNo(faturaNo);
    setIsModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedFaturaNo) return;
    
    setDeleteLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/delete-invoice/${selectedFaturaNo}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        setIsModalOpen(false);
        setSelectedFaturaNo('');
        fetchStats(); 
      } else {
        const errData = await response.json();
        alert(`Hata: ${errData.detail || "Fatura silinemedi."}`);
      }
    } catch (err) {
      alert("Sunucuyla bağlantı kurulamadı.");
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <Layout title="Panel Kontrolü" setAuth={setAuth}>
      <main className="flex-1 overflow-auto bg-transparent p-4 sm:p-8 space-y-6">
        
        {/* ÖZET KARTLARI */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-[slideUp_0.4s_ease-out]">
          <div className="p-5 bg-gray-200 border border-gray-300 rounded-2xl shadow-sm">
            <p className="text-[11px] text-gray-600 font-bold uppercase">Kayıtlı Tekil Ürün</p>
            <p className="text-2xl font-black text-gray-900 mt-1">{stats.total_products} <span className="text-xs text-gray-1000">Kalem</span></p>
          </div>
          <div className="p-5 bg-gray-200 border border-gray-300 rounded-2xl shadow-sm">
            <p className="text-[11px] text-gray-600 font-bold uppercase">Aktif Cari</p>
            <p className="text-2xl font-black text-gray-900 mt-1">{stats.total_customers} <span className="text-xs text-gray-1000">Firma</span></p>
          </div>
          <div className="p-5 bg-gray-200 border border-gray-300 rounded-2xl shadow-sm">
            <p className="text-[11px] text-gray-600 font-bold uppercase">İşlenen Fatura</p>
            <p className="text-2xl font-black text-gray-900 mt-1">{stats.total_invoices} <span className="text-xs text-gray-1000">Evrak</span></p>
          </div>
          <div className="p-5 bg-gray-200 border border-gray-300 rounded-2xl shadow-sm">
            <p className="text-[11px] text-gray-600 font-bold uppercase">Toplam Alım Maliyeti</p>
            <p className="text-2xl font-black text-green-600 mt-1">₺{stats.total_amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</p>
          </div>
        </div>

        {/* SON FATURALAR LİSTESİ */}
        <div className="bg-gray-200 border border-gray-300 p-6 rounded-2xl shadow-sm animate-[slideUp_0.5s_ease-out]">
          <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
            <span className="w-1 h-4 bg-gray-1000 rounded-full"></span> Son İşlenen Evrak Sicili
          </h3>
          <div className="border border-gray-300 rounded-xl overflow-x-auto bg-gray-300">
            <table className="w-full min-w-[600px] text-left border-collapse">
              <thead>
                <tr className="bg-gray-400 text-gray-600 text-[10px] uppercase font-bold border-b border-gray-300">
                  <th className="p-4">Toptancı / Müşteri Firma</th>
                  <th className="p-4">Tip</th>
                  <th className="p-4">Fatura No</th>
                  <th className="p-4">Tarih</th>
                  <th className="p-4 text-right">Toplam Tutar</th>
                  <th className="p-4 text-center">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-300 text-gray-700 text-xs">
                {stats.recent_invoices.map((inv, idx) => (
                  <tr key={idx} className="hover:bg-gray-400 hover:shadow-md transition-all duration-300">
                    <td className="p-4 font-semibold text-gray-900 max-w-xs truncate">{inv.musteri_unvani}</td>
                    <td className="p-4">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${inv.invoice_type === 'gelen' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
                        {inv.invoice_type === 'gelen' ? 'Alım' : 'Satış'}
                      </span>
                    </td>
                    <td className="p-4 text-gray-600 font-mono text-[11px]">{inv.fatura_no}</td>
                    <td className="p-4 text-gray-1000">{inv.fatura_tarihi}</td>
                    <td className="p-4 text-right font-bold text-gray-800">₺{inv.toplam_tutar.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
                    <td className="p-4 text-center">
                      <button
                        onClick={() => triggerDeleteModal(inv.fatura_no)}
                        className="px-2.5 py-1 text-[10px] font-bold bg-red-50 text-red-500 border border-red-100 rounded-lg hover:bg-red-500 hover:text-white transition-all cursor-pointer"
                      >
                        Faturayı Sil
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* İSTEDİĞİN MODERN UI ONAY KARTI (MODAL) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-gray-200 border border-gray-300 max-w-md w-full p-6 rounded-2xl shadow-xl relative overflow-hidden animate-[scaleUp_0.25s_ease-out]">
            <div className="w-12 h-12 rounded-full bg-red-50 border border-red-100 flex items-center justify-center text-red-500 text-xl mb-4">
              ⚠️
            </div>

            <h3 className="text-base font-bold text-gray-900">Faturayı Kaldırmak İstiyor Musunuz?</h3>
            <p className="text-xs text-gray-600 mt-2 leading-relaxed">
              <span className="text-red-500 font-semibold font-mono">{selectedFaturaNo}</span> numaralı evrak kalıcı olarak silinecektir. 
              Bu faturayla girmiş veya çıkmış olan tüm ürünlerin **stok miktarları otomatik olarak eski haline döndürülecektir.**
            </p>

            <div className="mt-6 flex justify-end gap-3 border-t border-gray-200 pt-4">
              <button
                onClick={() => { setIsModalOpen(false); setSelectedFaturaNo(''); }}
                disabled={deleteLoading}
                className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:text-gray-800 bg-gray-400 hover:bg-gray-1000 transition-all duration-300 cursor-pointer disabled:opacity-50"
              >
                İptal Et
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleteLoading}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-red-500 hover:bg-red-600 shadow-md active:scale-[0.98] transition-all cursor-pointer flex items-center gap-2 disabled:opacity-60"
              >
                {deleteLoading ? (
                  <>
                    <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Geri Alınıyor...</span>
                  </>
                ) : (
                  <span>Evet, Sistemi Eskiye Döndür ve Sil</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scaleUp { from { transform: scale(0.96); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </Layout>
  );
}
