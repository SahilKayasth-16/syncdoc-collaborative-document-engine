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
        <p>Your document library is empty. Seed or create documents to begin editing.</p>
      </div>
    );
  }

  return (
    <div className="document-grid" id="documents-grid-layout">
      {documents.map((doc) => (
        <DocumentCard key={doc._id || doc.id} document={doc} />
      ))}
    </div>
  );
};

export default DocumentList;

