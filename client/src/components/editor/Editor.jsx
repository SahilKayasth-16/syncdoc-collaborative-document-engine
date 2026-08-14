import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import EditorHeader from "./EditorHeader";
import BlockList from "./BlockList";
import EditorStatus from "./EditorStatus";

import { getDocumentTree } from "../../services/documentService";

const Editor = ({ documentId }) => {
    const [document, setDocument] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const loadDocument = async () => {
            try {
                setLoading(true);
                setError("");

                const data = await getDocumentTree(documentId);
                setDocument(data);
            } catch (err) {
                setError(err.message || "Failed to load document.");
            } finally {
                setLoading(false);
            }
        };

        if (documentId) {
            loadDocument();
        }
    }, [documentId]);

    if (loading) {
        return (
            <div className="editor-container" id="editor-container">
                <div className="editor-loading" id="editor-loading-state">
                    <div className="spinner"></div>
                    <p>Loading document AST...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="editor-container" id="editor-container">
                <div className="editor-error" id="editor-error-state">
                    <div className="error-icon-wrapper">
                        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="8" x2="12" y2="12"></line>
                            <line x1="12" y1="16" x2="12.01" y2="16"></line>
                        </svg>
                    </div>
                    <h2>Unable to load document</h2>
                    <p>{error}</p>
                    <Link to="/documents" className="btn btn-primary" style={{ marginTop: '1.25rem' }}>
                        Return to Documents
                    </Link>
                </div>
            </div>
        );
    }

    if (!document) {
        return (
            <div className="editor-container" id="editor-container">
                <div className="editor-error" id="editor-not-found-state">
                    <h2>Document not found</h2>
                    <p>The requested document could not be retrieved from the server.</p>
                    <Link to="/documents" className="btn btn-primary" style={{ marginTop: '1.25rem' }}>
                        Return to Documents
                    </Link>
                </div>
            </div>
        );
    }

    const nodes = document.root?.children || [];

    return (
        <div className="editor-container" id="editor-container">
            <div className="editor">
                <EditorHeader title={document.title} />
                <main className="editor-canvas">
                    <BlockList nodes={nodes} />
                </main>
                <EditorStatus />
            </div>
        </div>
    );
};

export default Editor;