import React from 'react';
import { Link } from 'react-router-dom';

const DocumentCard = ({ document }) => {
  const { title, updatedAt, createdAt } = document;
  const docId = document._id || document.id;

  const formatDate = (dateString) => {
    if (!dateString) return 'Recently';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return String(dateString);
      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return String(dateString);
    }
  };

  // Choose an appropriate icon based on the title keywords
  const getIcon = () => {
    const lowerTitle = (title || '').toLowerCase();
    if (lowerTitle.includes('api') || lowerTitle.includes('spec') || lowerTitle.includes('architecture')) {
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="16 18 22 12 16 6"></polyline>
          <polyline points="8 6 2 12 8 18"></polyline>
        </svg>
      );
    }
    if (lowerTitle.includes('database') || lowerTitle.includes('design') || lowerTitle.includes('schema')) {
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
          <path d="M3 5V19A9 3 0 0 0 21 19V5"></path>
          <path d="M3 12A9 3 0 0 0 21 12"></path>
        </svg>
      );
    }
    if (lowerTitle.includes('roadmap') || lowerTitle.includes('plan') || lowerTitle.includes('milestones')) {
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="16" y1="2" x2="16" y2="6"></line>
          <line x1="8" y1="2" x2="8" y2="6"></line>
          <line x1="3" y1="10" x2="21" y2="10"></line>
        </svg>
      );
    }
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
      </svg>
    );
  };

  const formattedDate = formatDate(updatedAt || createdAt);

  return (
    <Link 
      to={`/documents/${docId}/edit`} 
      className="document-card-link"
      style={{ textDecoration: 'none', color: 'inherit' }}
    >
      <div className="document-card" id={`document-card-${(title || 'doc').toLowerCase().replace(/[^a-z0-9]/g, '-')}`}>
        <div className="card-header">
          <div className="icon-wrapper">
            {getIcon()}
          </div>
          <div className="card-badge">Document</div>
        </div>
        <div className="card-body">
          <h3 className="document-title">{title}</h3>
        </div>
        <div className="card-footer">
          <span className="last-updated">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            Updated {formattedDate}
          </span>
        </div>
      </div>
    </Link>
  );
};

export default DocumentCard;

