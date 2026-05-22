// src/pages/Login.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';


export default function Login({ setAuth }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
      });
      
      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('isAuthenticated', 'true');
        localStorage.setItem('user', JSON.stringify(data.user));
        setAuth(true);
        navigate('/dashboard');
      } else {
        const errData = await response.json();
        setError(errData.detail || 'Giriş başarısız.');
      }
    } catch (err) {
      setError('Sunucu bağlantı hatası.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fcfaf5] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-gray-200 p-8 rounded-3xl shadow-xl border border-gray-300">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gray-400 rounded-2xl mx-auto flex items-center justify-center mb-4">
            <img src="/logo.png" alt="Logo" className="h-10 w-auto" />
          </div>
          <h2 className="text-2xl font-black text-gray-900">YOLTAN GIDA</h2>
          <p className="text-xs text-gray-600 font-bold uppercase tracking-widest mt-1">Stok Takip Otomasyonu</p>
        </div>
        
        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-xl text-sm font-semibold text-center">{error}</div>}
        
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Kullanıcı Adı</label>
            <input 
              type="text" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 bg-gray-300 border border-gray-300 rounded-xl text-sm text-gray-900 focus:outline-none focus:border-gray-1000 transition-all duration-300"
              placeholder="admin"
              required 
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Şifre</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-gray-300 border border-gray-300 rounded-xl text-sm text-gray-900 focus:outline-none focus:border-gray-1000 transition-all duration-300"
              placeholder="••••••"
              required 
            />
          </div>
          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-3 bg-stone-800 hover:bg-stone-900 text-white font-bold rounded-xl shadow-lg transition-all active:scale-[0.98] disabled:opacity-70 mt-4"
          >
            {loading ? 'Giriş Yapılıyor...' : 'Sisteme Giriş Yap'}
          </button>
        </form>
      </div>
    </div>
  );
}
