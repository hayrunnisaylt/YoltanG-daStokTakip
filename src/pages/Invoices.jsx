import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';

export default function Invoices({ setAuth }) {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user')) || { name: 'Yoltan Yönetici' };
  
  const [loading, setLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false); 
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [activePortal, setActivePortal] = useState(''); 
  const [dbProducts, setDbProducts] = useState([]); 

  const gelenInputRef = useRef(null);
  const gidenInputRef = useRef(null);

  const fetchDbProducts = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/products-list`);
      if (response.ok) {
        const data = await response.json();
        const sortedData = data.sort((a, b) => 
          a.urun_adi.localeCompare(b.urun_adi, 'tr', { sensitivity: 'base' })
        );
        setDbProducts(sortedData);
      }
    } catch (err) {
      console.error("Mevcut ürün listesi yüklenemedi:", err);
    }
  };

  useEffect(() => {
    fetchDbProducts();
  }, []);

  const processInvoice = async (selectedFile, type) => {
    if (!selectedFile) return;
    setLoading(true);
    setError('');
    setResult(null);
    setActivePortal(type);
    
    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/upload-invoice?invoice_type=${type}`, {
        method: 'POST',
        body: formData,
      });
      
      const data = await response.json();
      
      if (response.ok) {
        const kalemlerWithSelect = data.data.kalemler.map(item => ({
          ...item,
          db_urun_adi: item.urun_adi 
        }));
        setResult({ ...data.data, kalemler: kalemlerWithSelect, portal_type: type });
      } else {
        setError(data.detail || 'Fatura formatı tanınamadı veya kural dışı.');
      }
    } catch (err) {
      setError('Sunucu bağlantısı koptu. Arka plan servislerini kontrol edin.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectProductChange = (idx, value) => {
    const updatedKalemler = [...result.kalemler];
    updatedKalemler[idx].db_urun_adi = value;
    setResult({ ...result, kalemler: updatedKalemler });
  };

  const handleFinalSave = async () => {
    setSaveLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/save-final-invoice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fatura_no: result.fatura_no,
          fatura_tarihi: result.fatura_tarihi,
          musteri_unvani: result.musteri_unvani,
          toplam_tutar: result.toplam_tutar,
          invoice_type: result.portal_type,
          kalemler: result.kalemler
        })
      });

      if (response.ok) {
        alert("Fatura ve stoklar seçtiğiniz ürün eşleşmelerine göre pürüzsüzce işlendi!");
        setResult(null); 
        navigate('/stocks'); 
      } else {
        const errData = await response.json();
        alert(`Kayıt Hatası: ${errData.detail || "İşlem tamamlanamadı."}`);
      }
    } catch (err) {
      alert("Sunucuyla bağlantı kurulamadı.");
    } finally {
      setSaveLoading(false);
    }
  };

  return (
    <Layout title="Çift Yönlü Fatura Giriş Otomasyonu" setAuth={setAuth}>
      <main className="flex-1 overflow-auto bg-transparent p-8 space-y-6">
        
        {/* İKİYE BÖLÜNMÜŞ YÜKLEME ALANI */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-[slideUp_0.4s_ease-out]">
          
          {/* AMBAR ALIM PORTALI */}
          <div className="bg-gray-200 border border-gray-300 p-6 rounded-2xl flex flex-col justify-between shadow-sm">
            <div>
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2 mb-2">
                <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
                1. Şirketimize Kesilen Faturalar (Mal Alım)
              </h3>
              <p className="text-xs text-gray-600 mb-4 leading-relaxed">Toptancıların dükkanımıza kestiği faturalardır. Buraya yüklenen belgeler otomatik olarak **stok miktarlarını artırır** ancak müşteriler sayfasına veri aktarmaz.</p>
            </div>
            <div 
              onClick={() => !loading && gelenInputRef.current.click()}
              className="border border-dashed border-gray-400 hover:border-blue-400 bg-gray-300 p-6 rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all min-h-[140px]"
            >
              <input ref={gelenInputRef} type="file" accept=".pdf,.html" onChange={(e) => processInvoice(e.target.files[0], 'gelen')} className="hidden" disabled={loading} />
              <span className="text-xl mb-2">
                <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
                </svg>
              </span>
              <span className="text-xs font-bold text-gray-700">Gelen Alım Faturası Ekle</span>
            </div>
          </div>

          {/* MÜŞTERI SATIŞ PORTALI */}
          <div className="bg-gray-200 border border-gray-300 p-6 rounded-2xl flex flex-col justify-between shadow-sm">
            <div>
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2 mb-2">
                <span className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></span>
                2. Müşterilere Kestiğimiz Faturalar (Mal Satış)
              </h3>
              <p className="text-xs text-gray-600 mb-4 leading-relaxed">Bizim marketlere veya bayilere kestiğimiz faturalardır. Buraya yüklenen belgeler otomatik olarak **stokları düşürür** ve **Müşteriler sayfasındaki cari kayıtlara** işlenir.</p>
            </div>
            <div 
              onClick={() => !loading && gidenInputRef.current.click()}
              className="border border-dashed border-gray-400 hover:border-purple-400 bg-gray-300 p-6 rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all min-h-[140px]"
            >
              <input ref={gidenInputRef} type="file" accept=".pdf,.html" onChange={(e) => processInvoice(e.target.files[0], 'giden')} className="hidden" disabled={loading} />
              <span className="text-xl mb-2">
                <svg className="w-8 h-8 text-purple-500" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
                </svg>
              </span>
              <span className="text-xs font-bold text-gray-700">Giden Satış Faturası Ekle</span>
            </div>
          </div>

        </div>

        {/* YÜKLENİYOR SİMGE PANELİ */}
        {loading && (
          <div className="p-8 bg-gray-200 border border-gray-300 rounded-2xl text-center flex flex-col items-center justify-center gap-3 animate-[fadeIn_0.2s_ease-out]">
            <div className={`animate-spin rounded-full h-7 w-7 border-b-2 ${activePortal === 'gelen' ? 'border-blue-500' : 'border-purple-500'}`}></div>
            <p className="text-xs font-semibold text-gray-600">{activePortal === 'gelen' ? 'Toptancı Faturası Ayrıştırılıyor...' : 'Müşteri Satış Kaydı Yapılıyor...'}</p>
          </div>
        )}

        {error && <div className="p-4 bg-red-50 border border-red-200 text-red-500 rounded-xl text-xs font-semibold">{error}</div>}

        {/* ANLIK SÜZÜLEN FATURA VE AKILLI SEÇİM ALANI */}
        {result && (
          <div className="p-6 rounded-2xl border bg-gray-200 shadow-sm space-y-5 animate-[slideUp_0.4s_ease-out] border-gray-300">
            <div className="flex justify-between items-center border-b border-gray-200 pb-4">
              <div>
                <span className={`text-[9px] uppercase font-black px-2 py-0.5 rounded-md ${result.portal_type === 'gelen' ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'bg-purple-50 text-purple-600 border border-purple-100'}`}>
                  {result.portal_type === 'gelen' ? 'Gelen Mal Girişi' : 'Giden Müşteri Satışı'}
                </span>
                <h3 className="text-base font-bold text-gray-900 mt-2">{result.musteri_unvani}</h3>
                <p className="text-xs text-gray-600 mt-0.5">Evrak No: {result.fatura_no} | Tarih: {result.fatura_tarihi}</p>
              </div>
              <div className="text-right flex flex-col items-end gap-1">
                <span className="text-[10px] text-amber-600 font-bold bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-lg animate-pulse">
                  ⚠️ Kaydetmeden önce depo kartlarını eşleştirin
                </span>
                <p className="text-xl font-black text-gray-900 mt-1">{result.toplam_tutar.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL</p>
              </div>
            </div>

            <div className="border border-gray-300 rounded-xl overflow-hidden bg-gray-300">
              <table className="w-full text-left border-collapse table-auto text-xs">
                <thead>
                  <tr className="bg-gray-400 text-gray-600 text-[10px] uppercase font-bold border-b border-gray-300">
                    <th className="p-4 w-1/3">Faturada Okunan Ad</th>
                    <th className="p-4 w-1/3 text-gray-800">Depoda İşlenecek Kart (A-Z Sıralı)</th>
                    <th className="p-4 text-center">Miktar</th>
                    <th className="p-4 text-right">Birim Fiyat</th>
                    <th className="p-4 text-right">Toplam</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-300 text-gray-700">
                  {result.kalemler.map((item, idx) => (
                    <tr key={idx} className="hover:bg-gray-400 hover:shadow-md transition-all duration-300">
                      <td className="p-4 font-semibold text-gray-700 max-w-xs truncate">{item.urun_adi}</td>
                      
                      <td className="p-4">
                        <select
                          value={item.db_urun_adi || item.urun_adi}
                          onChange={(e) => handleSelectProductChange(idx, e.target.value)}
                          className="w-full bg-gray-200 border border-gray-400 rounded-xl p-2 text-xs text-gray-900 font-bold outline-none focus:border-gray-1000 transition-all duration-300 cursor-pointer"
                        >
                          <option value={item.urun_adi}>{item.urun_adi} (Yeni Kart Aç)</option>
                          {dbProducts.map(prod => (
                            <option key={prod.id} value={prod.urun_adi}>
                              {prod.urun_adi}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className="p-4 text-center">
                        <span className={`px-2.5 py-0.5 rounded-md font-bold text-[11px] ${result.portal_type === 'gelen' ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'bg-red-50 text-red-500 border border-red-100'}`}>
                          {result.portal_type === 'gelen' ? '+' : '-'}{item.miktar}
                        </span>
                      </td>
                      <td className="p-4 text-right text-gray-600">{item.birim_fiyat.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL</td>
                      <td className="p-4 text-right font-bold text-gray-900">{item.toplam.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={handleFinalSave}
                disabled={saveLoading}
                className="px-6 py-3 bg-stone-800 hover:bg-stone-900 text-white font-black text-xs rounded-xl shadow-md transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50"
              >
                {saveLoading ? "Veritabanına Yazılıyor..." : "Eşleşmeleri Onayla ve Faturayı Sisteme Kilitle"}
              </button>
            </div>

          </div>
        )}

      </main>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </Layout>
  );
}
