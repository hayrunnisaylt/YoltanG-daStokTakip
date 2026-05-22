import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';

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
        setFaturaNoToDelete('');
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

  return (
    <Layout title="Gelen Alım Faturaları Arşivi" setAuth={setAuth}>
      <main className="flex-1 overflow-auto xl:overflow-hidden bg-transparent p-4 sm:p-8 grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* TOPTANCI LİSTESİ */}
        <div className="xl:col-span-1 flex flex-col h-[50vh] xl:h-full overflow-hidden">
          <h3 className="text-xs font-bold text-gray-600 uppercase tracking-widest mb-4">Tedarikçi Firmalar ({toptancilar.length})</h3>
          {globalLoading ? (
            <div className="flex-1 flex items-center justify-center bg-gray-200 border border-gray-300 rounded-2xl">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-1000"></div>
            </div>
          ) : toptancilar.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-gray-400 rounded-2xl p-6 text-gray-600 text-center">
              <p className="text-xs">Henüz işlenmiş alım faturası bulunmuyor.</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin">
              {toptancilar.map((top) => (
                <div 
                  key={top.id}
                  onClick={() => handleToptanciClick(top.toptanci_unvani)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer ${selectedToptanci === top.toptanci_unvani ? 'bg-gray-400 border-gray-400 shadow-sm' : 'bg-gray-200 border-gray-300 hover:border-gray-400 hover:bg-gray-300'}`}
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

        {/* SİLME VE GEÇMİŞ KALEM GÖRÜNTÜLEME ALANI */}
        <div className="xl:col-span-2 bg-gray-200 border border-gray-300 rounded-2xl p-4 sm:p-6 flex flex-col overflow-hidden min-h-[500px] xl:h-[78vh] shadow-sm">
          {selectedToptanci ? (
            <div className="flex flex-col h-full space-y-4 overflow-hidden animate-[slideUp_0.2s_ease-out]">
              <div className="border-b border-gray-200 pb-3.5 flex justify-between items-end">
                <h3 className="text-sm font-bold text-gray-900 max-w-xl truncate">{selectedToptanci}</h3>
                <span className="text-xs font-semibold text-gray-600 bg-gray-300 px-2.5 py-1 border border-gray-300 rounded-md">
                  {invoices.length} Fatura Geçmişi
                </span>
              </div>

              {loadingInvoices ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-1000"></div>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin">
                  {invoices.map((inv, idx) => (
                    <div key={inv._id || idx} className="border border-gray-300 bg-gray-300 rounded-xl p-4 space-y-3 relative group">
                      
                      <button
                        onClick={(e) => triggerDeleteModal(e, inv.fatura_no)}
                        className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity bg-red-50 border border-red-100 hover:bg-red-500 text-red-500 hover:text-white rounded-md text-[10px] px-2 py-1 font-bold cursor-pointer"
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
                          ₺{inv.toplam_tutar.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>

                      <div className="overflow-x-auto mt-3">
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
                                <td className="py-2 text-right text-gray-600">₺{item.birim_fiyat.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
                                <td className="py-2 text-right font-bold text-gray-900">₺{item.toplam.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-1000 gap-2">
              <p className="text-xs font-medium">Hatalı yüklenen bir alım faturasını silmek veya geçmiş kalemleri görmek için sol listeden toptancı seçin.</p>
            </div>
          )}
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
