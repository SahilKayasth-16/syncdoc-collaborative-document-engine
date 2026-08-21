import { Link } from "react-router-dom";

const EditorHeader = ({ title = "Untitled document", activeUsers = [], currentUser = null }) => {
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
        </header>
    );
};

export default EditorHeader;