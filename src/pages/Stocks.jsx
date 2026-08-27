import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';

export default function Stocks({ setAuth }) {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState(null);
  const [editingProductId, setEditingProductId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editingStockProductId, setEditingStockProductId] = useState(null);
  const [editStockVal, setEditStockVal] = useState('');


  // Yeni Ürün Ekleme State'leri
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newProdName, setNewProdName] = useState('');
  const [newProdPrice, setNewProdPrice] = useState(0);
  const [newProdStock, setNewProdStock] = useState(0);
  const [newProdCritical, setNewProdCritical] = useState(10);
  const [addLoading, setAddLoading] = useState(false);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/products-list`);
      if (response.ok) {
        const data = await response.json();
        setProducts(data);
      }
    } catch (err) {
      console.error("Stok verileri yüklenirken hata:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const triggerDeleteModal = (product) => {
    setProductToDelete(product);
    setIsModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!productToDelete) return;
    
    setDeleteLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/delete-product/${productToDelete.id}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        setIsModalOpen(false);
        setProductToDelete(null);
        fetchProducts(); 
      } else {
        const errData = await response.json();
        alert(`Hata: ${errData.detail || "Ürün silinemedi."}`);
      }
    } catch (err) {
      alert("Sunucuyla bağlantı kurulamadı.");
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleNameEditStart = (product) => {
    setEditingProductId(product.id);
    setEditName(product.urun_adi);
  };

  const handleNameEditCancel = () => {
    setEditingProductId(null);
    setEditName('');
  };

  const handleNameEditSave = async (productId) => {
    if (!editName.trim()) return;
    
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/update-product-name/${productId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_name: editName })
      });
      if (response.ok) {
        const data = await response.json();
        setProducts(products.map(p => p.id === productId ? { ...p, urun_adi: data.new_name } : p));
        setEditingProductId(null);
      } else {
        alert("Ürün adı güncellenemedi.");
      }
    } catch (err) {
      console.error("İsim güncellenemedi:", err);
      alert("Sunucuyla bağlantı kurulamadı.");
    }
  };

  const handleStockUpdate = async (productId, amount) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/update-stock/${productId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount })
      });
      if (response.ok) {
        setProducts(products.map(p => {
          if (p.id === productId) {
             const newStock = p.stok_miktari + amount;
             return { ...p, stok_miktari: newStock < 0 ? 0 : newStock };
          }
          return p;
        }));
      }
    } catch (err) {
      console.error("Stok güncellenemedi:", err);
    }
  };

  const handleStockSetSave = async (productId) => {
    const val = Number(editStockVal);
    if (isNaN(val) || val < 0) {
      alert("Lütfen geçerli ve pozitif bir stok miktarı giriniz.");
      return;
    }
    
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/set-stock/${productId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_stock: val })
      });
      if (response.ok) {
        const data = await response.json();
        setProducts(products.map(p => p.id === productId ? { ...p, stok_miktari: data.new_stock } : p));
        setEditingStockProductId(null);
      } else {
        alert("Stok miktarı güncellenemedi.");
      }
    } catch (err) {
      console.error("Stok güncellenemedi:", err);
      alert("Sunucuyla bağlantı kurulamadı.");
    }
  };


  const handleAddProductSubmit = async (e) => {
    e.preventDefault();
    if (!newProdName.trim()) {
      alert("Ürün adı boş olamaz.");
      return;
    }

    setAddLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/add-product`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          urun_adi: newProdName,
          stok_miktari: Number(newProdStock),
          birim_fiyat: Number(newProdPrice),
          kritik_esik: Number(newProdCritical)
        })
      });

      if (response.ok) {
        setIsAddModalOpen(false);
        // Reset form
        setNewProdName('');
        setNewProdPrice(0);
        setNewProdStock(0);
        setNewProdCritical(10);
        fetchProducts();
      } else {
        const errData = await response.json();
        alert(`Hata: ${errData.detail || "Ürün eklenemedi."}`);
      }
    } catch (err) {
      alert("Sunucuyla bağlantı kurulamadı.");
    } finally {
      setAddLoading(false);
    }
  };

  const filteredProducts = products.filter(prod =>
    prod.urun_adi.toLowerCase().includes(searchTerm.toLowerCase())
  ).sort((a, b) => a.urun_adi.localeCompare(b.urun_adi, 'tr'));

  return (
    <Layout title="Stok Depo Envanteri" setAuth={setAuth}>
      <main className="flex-1 overflow-hidden bg-transparent p-4 sm:p-8 flex flex-col space-y-4">
        
        {/* FİLTRE VE ARAMA ÇUBUĞU */}
        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 bg-gray-200 border border-gray-300 p-4 rounded-2xl shadow-sm">
          <div className="relative flex-1 max-w-md">
            <svg className="w-4 h-4 text-gray-1000 absolute left-3.5 top-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Ürün adı veya markaya göre canlı ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-300 border border-gray-300 rounded-xl text-xs text-gray-900 outline-none focus:border-gray-1000 focus:ring-1 focus:ring-gray-300 transition-all"
            />
          </div>
          <div className="flex items-center justify-between sm:justify-end gap-4">
            <div className="text-xs font-bold text-gray-600 px-2">
              <span>Toplam Çeşit: <span className="text-gray-900">{products.length}</span> Kalem</span>
            </div>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-xs font-black shadow-md transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Yeni Ürün Ekle
            </button>
          </div>
        </div>

        {/* STOK TABLOSU */}
        <div className="flex-1 border border-gray-300 bg-gray-200 rounded-2xl overflow-hidden flex flex-col shadow-sm">
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-1000"></div>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-1000 p-6 text-center gap-2">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              <p className="text-xs">Aradığınız kriterlere uygun bir ürün envanterde bulunamadı.</p>
            </div>
          ) : (
            <div className="flex-1 overflow-auto scrollbar-thin">
              {/* MASAÜSTÜ TABLO GÖRÜNÜMÜ */}
              <div className="hidden md:block">
                <table className="w-full min-w-[800px] text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-300 text-gray-600 text-[10px] uppercase font-black tracking-wider border-b border-gray-300 sticky top-0 z-10">
                      <th className="p-4 pl-6">Mal Hizmet / Ürün Tanımı</th>
                      <th className="p-4 text-right">Son Alım Fiyatı</th>
                      <th className="p-4 text-center">Kritik Limit</th>
                      <th className="p-4 text-center w-36">Mevcut Stok</th>
                      <th className="p-4 text-center">Durum</th>
                      <th className="p-4 text-center pr-6">İşlem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 text-gray-700 text-xs">
                    {filteredProducts.map((prod) => {
                      const isCritical = prod.stok_miktari <= prod.kritik_esik;
                      return (
                        <tr key={prod.id} className="hover:bg-gray-300 transition-all duration-300 group">
                          <td className="p-4 pl-6 transition-all duration-300 max-w-md">
                            {editingProductId === prod.id ? (
                              <div className="flex items-center gap-2">
                                <input 
                                  type="text"
                                  value={editName}
                                  onChange={(e) => setEditName(e.target.value)}
                                  className="w-full px-2 py-1 text-xs border border-gray-400 rounded outline-none focus:border-gray-900 bg-white"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleNameEditSave(prod.id);
                                    if (e.key === 'Escape') handleNameEditCancel();
                                  }}
                                />
                                <button onClick={() => handleNameEditSave(prod.id)} className="text-emerald-600 hover:text-emerald-800" title="Kaydet">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                </button>
                                <button onClick={handleNameEditCancel} className="text-red-500 hover:text-red-700" title="İptal">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between group/name">
                                <span className="font-bold text-gray-900 truncate" title={prod.urun_adi}>{prod.urun_adi}</span>
                                <button onClick={() => handleNameEditStart(prod)} className="opacity-0 group-hover/name:opacity-100 text-gray-400 hover:text-blue-600 transition-opacity ml-2 shrink-0" title="İsmi Düzenle">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                </button>
                              </div>
                            )}
                          </td>
                          <td className="p-4 text-right font-mono font-medium text-gray-600">
                            {prod.birim_fiyat.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL
                          </td>
                          <td className="p-4 text-center font-semibold text-gray-1000">
                            {prod.kritik_esik}
                          </td>
                          <td className="p-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {editingStockProductId === prod.id ? (
                                <input
                                  type="number"
                                  step="0.01"
                                  value={editStockVal}
                                  onChange={(e) => setEditStockVal(e.target.value)}
                                  className="w-16 px-1.5 py-0.5 text-xs text-center border border-gray-400 rounded outline-none focus:border-gray-900 bg-white font-mono font-black"
                                  autoFocus
                                  onBlur={() => handleStockSetSave(prod.id)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleStockSetSave(prod.id);
                                    if (e.key === 'Escape') setEditingStockProductId(null);
                                  }}
                                />
                              ) : (
                                <>
                                  <button 
                                    onClick={() => handleStockUpdate(prod.id, -1)}
                                    className="w-6 h-6 flex items-center justify-center bg-gray-100 hover:bg-red-100 text-gray-600 hover:text-red-600 rounded-md border border-gray-300 transition-colors shadow-sm cursor-pointer"
                                    title="1 Adet Düşür"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" /></svg>
                                  </button>
                                  <span 
                                    onDoubleClick={() => {
                                      setEditingStockProductId(prod.id);
                                      setEditStockVal(String(prod.stok_miktari));
                                    }}
                                    className={`inline-block min-w-[2.5rem] px-2 py-1 rounded-lg font-black font-mono text-[13px] cursor-pointer select-none ${isCritical ? 'text-amber-600 bg-amber-50 border border-amber-200' : 'text-gray-900 bg-gray-300 border border-gray-400'}`}
                                    title="Çift tıklayarak düzenleyin"
                                  >
                                    {prod.stok_miktari}
                                  </span>
                                  <button 
                                    onClick={() => handleStockUpdate(prod.id, 1)}
                                    className="w-6 h-6 flex items-center justify-center bg-gray-100 hover:bg-emerald-100 text-gray-600 hover:text-emerald-600 rounded-md border border-gray-300 transition-colors shadow-sm cursor-pointer"
                                    title="1 Adet Artır"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                                  </button>
                                </>
                              )}
                            </div>
                          </td>

                          <td className="p-4 text-center">
                            {isCritical ? (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-amber-600 bg-amber-50 rounded border border-amber-200 animate-pulse">
                                <span className="w-1 h-1 bg-amber-500 rounded-full"></span> Kritik Seviye
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-gray-700 bg-gray-400 rounded border border-gray-300">
                                <span className="w-1 h-1 bg-stone-400 rounded-full"></span> Stok Yeterli
                              </span>
                            )}
                          </td>
                          <td className="p-4 text-center pr-6">
                            <button
                              onClick={() => triggerDeleteModal(prod)}
                              className="px-2.5 py-1 text-[10px] font-bold bg-red-50 text-red-500 border border-red-100 rounded-lg hover:bg-red-500 hover:text-white transition-all cursor-pointer"
                            >
                              Ürünü Sil
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* MOBİL KART GÖRÜNÜMÜ */}
              <div className="md:hidden flex flex-col divide-y divide-gray-300">
                {filteredProducts.map((prod) => {
                  const isCritical = prod.stok_miktari <= prod.kritik_esik;
                  return (
                    <div key={prod.id} className="p-4 flex flex-col gap-4 bg-gray-200 hover:bg-gray-300 transition-colors">
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex-1">
                          {editingProductId === prod.id ? (
                            <div className="flex items-center gap-2">
                              <input 
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="w-full px-2 py-1 text-xs border border-gray-400 rounded outline-none focus:border-gray-900 bg-white"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleNameEditSave(prod.id);
                                  if (e.key === 'Escape') handleNameEditCancel();
                                }}
                              />
                              <button onClick={() => handleNameEditSave(prod.id)} className="text-emerald-600 p-1" title="Kaydet">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                              </button>
                              <button onClick={handleNameEditCancel} className="text-red-500 p-1" title="İptal">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-black text-gray-900">{prod.urun_adi}</h4>
                              <button onClick={() => handleNameEditStart(prod)} className="text-gray-500 hover:text-blue-600 p-1 shrink-0" title="İsmi Düzenle">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                              </button>
                            </div>
                          )}
                        </div>
                        {isCritical ? (
                          <span className="shrink-0 inline-flex items-center gap-1.5 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-amber-600 bg-amber-50 rounded border border-amber-200 animate-pulse">
                            Kritik
                          </span>
                        ) : (
                          <span className="shrink-0 inline-flex items-center gap-1.5 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-gray-700 bg-gray-400 rounded border border-gray-300">
                            Yeterli
                          </span>
                        )}
                      </div>
                      
                      <div className="flex justify-between items-center bg-gray-300 rounded-lg p-3 border border-gray-400">
                        <div className="flex flex-col">
                          <span className="text-[10px] text-gray-600 uppercase font-bold">Birim Fiyat</span>
                          <span className="text-sm font-mono font-black text-gray-800">{prod.birim_fiyat.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL</span>
                        </div>
                        
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-[10px] text-gray-600 uppercase font-bold">Stok Ayarı</span>
                          <div className="flex items-center justify-center gap-2">
                            {editingStockProductId === prod.id ? (
                              <input
                                type="number"
                                step="0.01"
                                value={editStockVal}
                                onChange={(e) => setEditStockVal(e.target.value)}
                                className="w-20 px-2 py-1 text-sm text-center border border-gray-400 rounded-lg outline-none focus:border-gray-900 bg-white font-mono font-black"
                                autoFocus
                                onBlur={() => handleStockSetSave(prod.id)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleStockSetSave(prod.id);
                                  if (e.key === 'Escape') setEditingStockProductId(null);
                                }}
                              />
                            ) : (
                              <>
                                <button 
                                  onClick={() => handleStockUpdate(prod.id, -1)}
                                  className="w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-red-100 text-gray-600 hover:text-red-600 rounded-lg border border-gray-400 transition-colors shadow-sm cursor-pointer"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" /></svg>
                                </button>
                                <span 
                                  onDoubleClick={() => {
                                    setEditingStockProductId(prod.id);
                                    setEditStockVal(String(prod.stok_miktari));
                                  }}
                                  className={`inline-block min-w-[3rem] text-center px-2 py-1 rounded-lg font-black font-mono text-base cursor-pointer select-none ${isCritical ? 'text-amber-600 bg-amber-50 border border-amber-300' : 'text-gray-900 bg-gray-100 border border-gray-400'}`}
                                  title="Çift tıklayarak düzenleyin"
                                >
                                  {prod.stok_miktari}
                                </span>
                                <button 
                                  onClick={() => handleStockUpdate(prod.id, 1)}
                                  className="w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-emerald-100 text-gray-600 hover:text-emerald-600 rounded-lg border border-gray-400 transition-colors shadow-sm cursor-pointer"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                      </div>

                      <div className="flex justify-end mt-1">
                        <button
                          onClick={() => triggerDeleteModal(prod)}
                          className="px-4 py-1.5 text-xs font-bold bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-500 hover:text-white transition-all cursor-pointer shadow-sm"
                        >
                          Ürünü Sil
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ÜRÜNE ÖZGÜ MODERN UI ONAY KARTI (MODAL) */}
      {isModalOpen && productToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-gray-200 border border-gray-300 max-w-md w-full p-6 rounded-2xl shadow-xl relative overflow-hidden animate-[scaleUp_0.25s_ease-out]">
            
            <div className="w-12 h-12 rounded-full bg-red-50 border border-red-100 flex items-center justify-center text-red-500 text-xl mb-4">
              ⚠️
            </div>

            <h3 className="text-base font-bold text-gray-900">Ürünü Envanterden Kaldır?</h3>
            <p className="text-xs text-gray-600 mt-2 leading-relaxed">
              <span className="text-red-500 font-semibold">{productToDelete.urun_adi}</span> isimli kalemi depo envanterinden silmek üzeresiniz. 
              Bu işlem dükkanın **geçmiş ciro verilerini etkilemeyecektir.** Eski fatura kayıtlarındaki bu ürüne ait satırlar "Silinmiş Ürün" adıyla güvenle arşivlenecektir.
            </p>

            <div className="mt-6 flex justify-end gap-3 border-t border-gray-200 pt-4">
              <button
                onClick={() => { setIsModalOpen(false); setProductToDelete(null); }}
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
                    <span>Envanter Güncelleniyor...</span>
                  </>
                ) : (
                  <span>Evet, Envanterden Sil</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* YENİ ÜRÜN EKLEME MODALI */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-gray-200 border border-gray-300 max-w-md w-full p-6 rounded-2xl shadow-xl relative overflow-hidden animate-[scaleUp_0.25s_ease-out]">
            
            <div className="w-12 h-12 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-500 text-xl mb-4">
              📦
            </div>

            <h3 className="text-base font-bold text-gray-900">Envantere Yeni Ürün Ekle</h3>
            <p className="text-[11px] text-gray-600 mt-1 leading-relaxed">
              Depoya kaydedilecek yeni ürünün bilgilerini giriniz. Ürün adı benzersiz olmalıdır.
            </p>

            <form onSubmit={handleAddProductSubmit} className="mt-4 space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Ürün Adı / Tanımı *</label>
                <input
                  type="text"
                  required
                  value={newProdName}
                  onChange={(e) => setNewProdName(e.target.value)}
                  placeholder="ÖRN: COCA COLA 1L"
                  className="w-full px-3 py-2 bg-gray-300 border border-gray-300 rounded-xl text-xs text-gray-900 outline-none focus:border-gray-1000 focus:ring-1 focus:ring-gray-300 transition-all uppercase"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Birim Fiyat (TL)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newProdPrice}
                    onChange={(e) => setNewProdPrice(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-300 border border-gray-300 rounded-xl text-xs text-gray-900 outline-none focus:border-gray-1000 focus:ring-1 focus:ring-gray-300 transition-all font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Başlangıç Stok</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newProdStock}
                    onChange={(e) => setNewProdStock(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-300 border border-gray-300 rounded-xl text-xs text-gray-900 outline-none focus:border-gray-1000 focus:ring-1 focus:ring-gray-300 transition-all font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Kritik Eşik</label>
                  <input
                    type="number"
                    min="0"
                    value={newProdCritical}
                    onChange={(e) => setNewProdCritical(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-300 border border-gray-300 rounded-xl text-xs text-gray-900 outline-none focus:border-gray-1000 focus:ring-1 focus:ring-gray-300 transition-all font-mono"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3 border-t border-gray-200 pt-4">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  disabled={addLoading}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:text-gray-800 bg-gray-300 hover:bg-gray-400/50 transition-all duration-300 cursor-pointer"
                >
                  İptal Et
                </button>
                <button
                  type="submit"
                  disabled={addLoading}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-gray-900 hover:bg-gray-800 shadow-md transition-all cursor-pointer flex items-center gap-2"
                >
                  {addLoading ? (
                    <>
                      <div className="animate-spin h-3.5 w-3.5 border-b-2 border-white rounded-full"></div>
                      <span>Ekleniyor...</span>
                    </>
                  ) : (
                    <span>Ürünü Ekle</span>
                  )}
                </button>
              </div>
            </form>
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
