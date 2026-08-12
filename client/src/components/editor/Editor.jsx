import { useEffect, useState } from "react";

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
            } catch (error) {
                console.error("Failed to load document:", error);
                setError(error.message);
            } finally {
                setLoading(false);
            }
        };

        if (documentId) {
            loadDocument();
        }
    }, [documentId]);

    if (loading) {
        return <div>Loading document...</div>;
    }

    if (error) {
        return <div>Error: {error}</div>;
    }

    if (!document) {
        return <div>Document not found.</div>;
    }

    const nodes = document.root?.children || [];

    // console.log("Document ID:", documentId);
    // console.log("Document API response:", document);
    // console.log("Editor nodes:", document?.root?.children);

    return (
        <div className="editor">
            <EditorHeader title={document.title} />

            <BlockList nodes={nodes} />

            <EditorStatus />
        </div>
    );
};

export default Editor;