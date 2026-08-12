import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import DocumentsPage from './pages/DocumentsPage';
import EditorPage from './pages/EditorPage';

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<Navigate to="/documents" replace />} />

                <Route path="/documents" element={<DocumentsPage />} />

                <Route path="/documents/:id/edit" element={<EditorPage />} />

                <Route path="*" element={<Navigate to="/documents" replace />} />
            </Routes>
        </BrowserRouter>
    );
}

export default App;