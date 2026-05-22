import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';

export default function Customers({ setAuth }) {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user')) || { name: 'Yoltan Yönetici' };
  
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerInvoices, setCustomerInvoices] = useState([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [globalLoading, setGlobalLoading] = useState(true);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState('');

  const fetchCustomers = async () => {
    try {
      setGlobalLoading(true);
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/customers-list`);
      if (response.ok) {
        const data = await response.json();
        setCustomers(data);
      }
    } catch (err) {
      console.error("Müşteri verileri çekilirken hata oluştu:", err);
    } finally {
      setGlobalLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const handleCustomerClick = async (customerName) => {
    setSelectedCustomer(customerName);
    setLoadingInvoices(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/customer-invoices/${encodeURIComponent(customerName)}`);
      if (response.ok) {
        const data = await response.json();
        setCustomerInvoices(data);
      }
    } catch (err) {
      console.error("Müşteri fatura geçmişi yüklenemedi:", err);
    } finally {
      setLoadingInvoices(false);
    }
  };

  const triggerDeleteModal = (e, customerName) => {
    e.stopPropagation();
    setCustomerToDelete(customerName);
    setIsModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!customerToDelete) return;
    
    setDeleteLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/delete-customer/${encodeURIComponent(customerToDelete)}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        setIsModalOpen(false);
        if (selectedCustomer === customerToDelete) {
          setSelectedCustomer(null);
          setCustomerInvoices([]);
        }
        setCustomerToDelete('');
        fetchCustomers();
      } else {
        const errData = await response.json();
        alert(`Hata: ${errData.detail || "Müşteri silinemedi."}`);
      }
    } catch (err) {
      alert("Sunucuyla bağlantı kurulamadı.");
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <Layout title="Müşteri & Cari Portföyü" setAuth={setAuth}>
      <main className="flex-1 overflow-auto xl:overflow-hidden bg-transparent p-4 sm:p-8 grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* MÜŞTERİ LİSTESİ */}
        <div className="xl:col-span-1 flex flex-col h-[50vh] xl:h-full overflow-hidden">
          <h3 className="text-xs font-bold text-gray-600 uppercase tracking-widest flex items-center gap-2 mb-4">
            🔹 Portföye Bağlı Müşteriler ({customers.length})
          </h3>
          
          {globalLoading ? (
            <div className="flex-1 flex items-center justify-center bg-gray-200 border border-gray-300 rounded-2xl">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-600"></div>
            </div>
          ) : customers.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-gray-400 rounded-2xl p-6 text-gray-600 text-center">
              <span className="text-2xl mb-2">📦</span>
              <p className="text-xs">Henüz giden (satış) faturası işlenmediği için kayıtlı müşteri bulunamadı.</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin">
              {customers.map((cust) => (
                <div 
                  key={cust.id}
                  onClick={() => handleCustomerClick(cust.musteri_unvani)}
                  className={`p-4 rounded-xl border transition-all duration-200 cursor-pointer text-left relative group ${selectedCustomer === cust.musteri_unvani ? 'bg-gray-400 border-gray-400 shadow-sm' : 'bg-gray-200 border-gray-300 hover:border-gray-400 hover:bg-gray-300'}`}
                >
                  <button
                    onClick={(e) => triggerDeleteModal(e, cust.musteri_unvani)}
                    className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity bg-red-50 border border-red-100 hover:bg-red-500 text-red-500 hover:text-white rounded-md text-[10px] px-2 py-0.5 font-bold cursor-pointer"
                  >
                    Sil
                  </button>

                  <h4 className="text-xs font-bold text-gray-900 line-clamp-2 min-h-[32px] pr-8">{cust.musteri_unvani}</h4>
                  <div className="flex justify-between items-center mt-3 pt-2 border-t border-gray-200 text-[11px]">
                    <span className="text-gray-600">🛍️ {cust.invoice_count} Alım Yaptı</span>
                    <div className="text-right">
                      <span className="text-[9px] text-gray-1000 block uppercase font-bold tracking-wider">Toplam Kazanç</span>
                      <span className="font-black text-gray-800">₺{cust.total_spent.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* MÜŞTERİ ÖZEL FATURA GEÇMİŞİ */}
        <div className="xl:col-span-2 bg-gray-200 border border-gray-300 rounded-2xl p-4 sm:p-6 flex flex-col overflow-hidden min-h-[500px] xl:h-[78vh] shadow-sm">
          {selectedCustomer ? (
            <div className="flex flex-col h-full space-y-4 overflow-hidden animate-[fadeIn_0.2s_ease-out]">
              <div className="border-b border-gray-200 pb-3.5 flex justify-between items-end">
                <div>
                  <span className="text-[10px] text-gray-600 uppercase font-black tracking-widest block">Müşteri Alım Detayları</span>
                  <h3 className="text-sm font-bold text-gray-900 mt-1 max-w-xl truncate">{selectedCustomer}</h3>
                </div>
                <span className="text-xs font-semibold text-gray-600 bg-gray-300 px-2.5 py-1 border border-gray-300 rounded-md">
                  {customerInvoices.length} Adet Satış Faturası
                </span>
              </div>

              {loadingInvoices ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-600"></div>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin">
                  {customerInvoices.map((inv, idx) => (
                    <div key={inv._id || idx} className="border border-gray-300 bg-gray-300 rounded-xl p-4 space-y-3">
                      <div className="flex justify-between items-center bg-gray-200 p-2.5 rounded-lg border border-gray-300">
                        <div className="text-[11px]">
                          <span className="text-gray-700 font-mono font-bold">Fatura No: {inv.fatura_no}</span>
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
                              <th className="pb-2">Satılan Ürün / Mal Hizmet</th>
                              <th className="pb-2 text-center">Miktar</th>
                              <th className="pb-2 text-right">Birim Fiyat</th>
                              <th className="pb-2 text-right">Toplam</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-300 text-gray-700">
                            {inv.kalemler?.map((item, itemIdx) => (
                              <tr key={itemIdx} className="hover:bg-gray-200">
                                <td className="py-2 font-medium text-gray-900">{item.urun_adi}</td>
                                <td className="py-2 text-center text-gray-800 font-black">-{item.miktar}</td>
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
            <div className="flex-1 flex flex-col items-center justify-center text-gray-1000">
              <span className="text-3xl mb-2">👥</span>
              <p className="text-xs font-medium">Müşterinin geçmişte aldığı ürünleri ve kazandırdığı ciroyu görmek için listeden seçim yapın.</p>
            </div>
          )}
        </div>
      </main>

      {/* MÜŞTERİYE ÖZGÜ MODERN UI ONAY KARTI (MODAL) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-gray-200 border border-gray-300 max-w-md w-full p-6 rounded-2xl shadow-xl relative overflow-hidden animate-[scaleUp_0.25s_ease-out]">
            
            <div className="w-12 h-12 rounded-full bg-red-50 border border-red-100 flex items-center justify-center text-red-500 text-xl mb-4">
              👥
            </div>

            <h3 className="text-base font-bold text-gray-900">Cari Kaydı Gizlensin Mi?</h3>
            <p className="text-xs text-gray-600 mt-2 leading-relaxed">
              <span className="text-red-500 font-semibold">{customerToDelete}</span> isimli müşteri aktif listeden kaldırılacaktır. 
              Bu işlem dükkanın **stok miktarlarını değiştirmeyecek ve ciro geçmişini silmeyecektir.** Geçmiş satış kayıtları "Silinmiş Müşteri" adıyla sistemde güvenle korunacaktır.
            </p>

            <div className="mt-6 flex justify-end gap-3 border-t border-gray-200 pt-4">
              <button
                onClick={() => { setIsModalOpen(false); setCustomerToDelete(''); }}
                disabled={deleteLoading}
                className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:text-gray-800 bg-gray-400 hover:bg-gray-1000 transition-all duration-300 cursor-pointer"
              >
                İptal Et
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleteLoading}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-red-500 hover:bg-red-600 shadow-md transition-all cursor-pointer flex items-center gap-2"
              >
                {deleteLoading ? (
                  <>
                    <div className="animate-spin h-3.5 w-3.5 border-b-2 border-white rounded-full"></div>
                    <span>Gizleniyor...</span>
                  </>
                ) : (
                  <span>Evet, Listeden Kaldır</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scaleUp { from { transform: scale(0.96); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .scrollbar-thin::-webkit-scrollbar { width: 4px; }
        .scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
        .scrollbar-thin::-webkit-scrollbar-thumb { background: #d6d3d1; border-radius: 2px; }
      `}</style>
    </Layout>
  );
}
