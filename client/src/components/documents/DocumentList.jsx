import React from 'react';
import DocumentCard from './DocumentCard';

const DocumentList = ({ documents }) => {
  if (!documents || documents.length === 0) {
    return (
      <div className="empty-state" id="documents-empty-state">
        <div className="empty-icon-wrapper">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="9" y1="15" x2="15" y2="15"></line>
            <line x1="9" y1="11" x2="15" y2="11"></line>
          </svg>
        </div>
        <h3>No documents found</h3>
        <p>Your library is empty. Click the button below to create your very first SyncDoc document.</p>
        <button className="btn btn-primary" style={{ marginTop: '1.25rem' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          <span>Create Document</span>
        </button>
      </div>
    );
  }

  return (
    <div className="document-grid" id="documents-grid-layout">
      {documents.map((doc) => (
        <DocumentCard key={doc.id} document={doc} />
      ))}
    </div>
  );
};

export default DocumentList;
