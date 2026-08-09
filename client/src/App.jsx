import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import DocumentsPage from './pages/DocumentsPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/documents" replace />} />
        <Route path="/documents" element={<DocumentsPage />} />
        {/* Fallback for undefined routes: redirect to documents */}
        <Route path="*" element={<Navigate to="/documents" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
