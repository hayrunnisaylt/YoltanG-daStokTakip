import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Invoices from './pages/Invoices';
import Customers from './pages/Customers';
import Stocks from './pages/Stocks';
import GelenInvoices from './pages/GelenInvoices';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const authStatus = localStorage.getItem('isAuthenticated');
    if (authStatus === 'true') {
      setIsAuthenticated(true);
    }
    setLoading(false);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fcfaf5] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-gray-500"></div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route 
          path="/login" 
          element={!isAuthenticated ? <Login setAuth={setIsAuthenticated} /> : <Navigate to="/dashboard" replace />} 
        />
        
        <Route 
          path="/dashboard" 
          element={isAuthenticated ? <Dashboard setAuth={setIsAuthenticated} /> : <Navigate to="/login" replace />} 
        />
        
        <Route 
          path="/invoices" 
          element={isAuthenticated ? <Invoices setAuth={setIsAuthenticated} /> : <Navigate to="/login" replace />} 
        />
        
        <Route 
          path="*" 
          element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />} 
        />
        
        <Route 
          path="/customers" 
          element={isAuthenticated ? <Customers setAuth={setIsAuthenticated} /> : <Navigate to="/login" replace />} 
        />
        
        <Route 
          path="/stocks" 
          element={isAuthenticated ? <Stocks setAuth={setIsAuthenticated} /> : <Navigate to="/login" replace />} 
        />
        
        <Route 
          path="/gelen-invoices" 
          element={isAuthenticated ? <GelenInvoices setAuth={setIsAuthenticated} /> : <Navigate to="/login" replace />} 
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
