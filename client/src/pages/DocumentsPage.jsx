import React, { useState, useEffect } from 'react';
import DocumentList from '../components/documents/DocumentList';

const MOCK_DOCUMENTS = [
  { id: 1, title: 'API Architecture Spec', updatedAt: 'Updated 2 minutes ago' },
  { id: 2, title: 'Database Design', updatedAt: 'Updated 1 hour ago' },
  { id: 3, title: 'Project Roadmap', updatedAt: 'Updated 3 days ago' },
  { id: 4, title: 'Product Requirements Document', updatedAt: 'Updated Yesterday' }
];

const DocumentsPage = () => {
  const [isEmpty, setIsEmpty] = useState(false);
  const [apiStatus, setApiStatus] = useState('checking'); // 'checking' | 'connected' | 'disconnected'

  useEffect(() => {
    const checkBackendHealth = async () => {
      try {
        // Query our Express server (port 5050 for local environment conflict resolution)
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
      } catch (err) {
        setApiStatus('disconnected');
      }
    };

    checkBackendHealth();
    const interval = setInterval(checkBackendHealth, 5000); // Check every 5s
    return () => clearInterval(interval);
  }, []);

  const documents = isEmpty ? [] : MOCK_DOCUMENTS;

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

        <div className="sidebar-footer">
          <div className="state-control">
            <label className="toggle-label" id="empty-state-toggle-label">
              <input 
                type="checkbox" 
                id="empty-state-checkbox"
                checked={isEmpty} 
                onChange={(e) => setIsEmpty(e.target.checked)} 
              />
              <span>Simulate Empty State</span>
            </label>
          </div>
        </div>
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

            <button className="btn btn-primary" id="create-document-btn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              <span>Create Document</span>
            </button>
          </div>
        </header>

        <section className="content-area">
          <DocumentList documents={documents} />
        </section>
      </main>
    </div>
  );
};

export default DocumentsPage;
