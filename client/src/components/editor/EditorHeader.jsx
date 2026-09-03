import { Link } from "react-router-dom";

const EditorHeader = ({ documentId = null, title = "Untitled document", activeUsers = [], currentUser = null }) => {
    return (
        <header className="editor-header" id="editor-header">
            <div className="editor-header-left">
                <Link to="/documents" className="editor-back-btn" title="Back to Documents">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="19" y1="12" x2="5" y2="12"></line>
                        <polyline points="12 19 5 12 12 5"></polyline>
                    </svg>
                    <span>Documents</span>
                </Link>
                <div className="editor-header-divider"></div>
                <h1 className="editor-title">{title}</h1>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                {documentId && (
                    <a
                        href={`http://localhost:5050/api/documents/${documentId}/export/pdf`}
                        download
                        className="editor-export-pdf-btn"
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.4rem",
                            padding: "0.4rem 0.85rem",
                            fontSize: "0.825rem",
                            fontWeight: "600",
                            color: "#ffffff",
                            backgroundColor: "#4f46e5",
                            borderRadius: "6px",
                            textDecoration: "none",
                            boxShadow: "0 1px 2px rgba(0, 0, 0, 0.2)"
                        }}
                        title="Export document to PDF"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="7 10 12 15 17 10"></polyline>
                            <line x1="12" y1="15" x2="12" y2="3"></line>
                        </svg>
                        <span>Export PDF</span>
                    </a>
                )}
                {activeUsers.length > 0 && (
                    <div className="editor-active-users">
                        <span className="active-users-label">Collaborators:</span>
                        <div className="user-badges-container">
                            {activeUsers.map((u) => {
                                const isSelf = currentUser && u.userId === currentUser.userId;
                                return (
                                    <span
                                        key={u.userId}
                                        className={`user-badge ${isSelf ? "user-badge-self" : ""}`}
                                        title={isSelf ? `${u.name} (You)` : u.name}
                                    >
                                        <span className="user-online-dot"></span>
                                        {u.name} {isSelf ? "(You)" : ""}
                                    </span>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </header>
    );
};

export default EditorHeader;