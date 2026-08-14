import React, { useState, useEffect } from 'react';
import DocumentList from '../components/documents/DocumentList';
import { getDocuments } from '../services/documentService';

const DocumentsPage = () => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [apiStatus, setApiStatus] = useState('checking'); // 'checking' | 'connected' | 'disconnected'

  const fetchDocumentList = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getDocuments();
      setDocuments(data);
      setApiStatus('connected');
    } catch (err) {
      setError(err.message || 'Failed to load documents.');
      setApiStatus('disconnected');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocumentList();

    // Check backend health periodically
    const checkBackendHealth = async () => {
      try {
        const res = await fetch('http://localhost:5050/api/health');
        if (res.ok) {
          const data = await res.json();
          if (data.mongodb === 'connected') {
            setApiStatus('connected');
          } else {
            setApiStatus('disconnected');
          }
        } else {
          setApiStatus('disconnected');
        }
      } catch {
        setApiStatus('disconnected');
      }
    };

    const interval = setInterval(checkBackendHealth, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="dashboard-container" id="syncdoc-dashboard-container">
      {/* Sidebar Navigation */}
      <aside className="sidebar" id="dashboard-sidebar">
        <div className="sidebar-brand">
          <div className="brand-logo">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
              <path d="M2 17l10 5 10-5"></path>
              <path d="M2 12l10 5 10-5"></path>
            </svg>
          </div>
          <span className="brand-name">SyncDoc</span>
        </div>

        <nav className="sidebar-nav">
          <a href="/documents" className="nav-item active" onClick={(e) => e.preventDefault()}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
            <span>Documents</span>
          </a>
        </nav>
      </aside>

      {/* Main Panel */}
      <main className="main-content" id="dashboard-main-content">
        <header className="main-header" id="dashboard-main-header">
          <div className="header-title-area">
            <h1>Documents</h1>
            <p className="header-subtitle">Manage and edit your collaborative markdown documents</p>
          </div>
          
          <div className="header-actions">
            {/* API Connection Indicator */}
            <div className={`api-badge ${apiStatus}`} id="api-connectivity-badge">
              <span className="dot"></span>
              <span className="badge-text">
                {apiStatus === 'checking' && 'Checking API...'}
                {apiStatus === 'connected' && 'API Connected'}
                {apiStatus === 'disconnected' && 'API Disconnected'}
              </span>
            </div>
          </div>
        </header>

        <section className="content-area">
          {loading ? (
            <div className="dashboard-loading" id="documents-loading-state">
              <div className="spinner"></div>
              <p>Loading documents...</p>
            </div>
          ) : error ? (
            <div className="dashboard-error" id="documents-error-state">
              <div className="error-icon-wrapper">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
              </div>
              <h3>Failed to load documents</h3>
              <p>{error}</p>
              <button className="btn btn-primary" onClick={fetchDocumentList} style={{ marginTop: '1rem' }}>
                Retry
              </button>
            </div>
          ) : (
            <DocumentList documents={documents} />
          )}
        </section>
      </main>
    </div>
  );
};

export default DocumentsPage;

