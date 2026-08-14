const API_BASE_URL = "http://localhost:5050/api";

/**
 * Fetch all documents from the backend API.
 */
export const getDocuments = async () => {
    const response = await fetch(`${API_BASE_URL}/documents`);
    const result = await response.json();

    if (!response.ok) {
        throw new Error(result.message || "Failed to fetch documents.");
    }

    return result.data || [];
};

/**
 * Fetch a document by its ID.
 */
export const getDocumentById = async (documentId) => {
    const response = await fetch(`${API_BASE_URL}/documents/${documentId}`);
    const result = await response.json();

    if (!response.ok) {
        throw new Error(result.message || "Failed to fetch document.");
    }

    return result.data;
};

/**
 * Fetch a document with its complete AST tree structure.
 */
export const getDocumentTree = async (documentId) => {
    const response = await fetch(`${API_BASE_URL}/documents/${documentId}/tree`);
    const result = await response.json();

    if (!response.ok) {
        throw new Error(result.message || "Failed to fetch document tree.");
    }

    return result.data;
};

/**
 * Create a new document.
 */
export const createDocument = async (title) => {
    const response = await fetch(`${API_BASE_URL}/documents`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ title })
    });
    const result = await response.json();

    if (!response.ok) {
        throw new Error(result.message || "Failed to create document.");
    }

    return result.data;
};

/**
 * Update document metadata.
 */
export const updateDocument = async (documentId, title) => {
    const response = await fetch(`${API_BASE_URL}/documents/${documentId}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ title })
    });
    const result = await response.json();

    if (!response.ok) {
        throw new Error(result.message || "Failed to update document.");
    }

    return result.data;
};

/**
 * Delete a document.
 */
export const deleteDocument = async (documentId) => {
    const response = await fetch(`${API_BASE_URL}/documents/${documentId}`, {
        method: "DELETE"
    });
    const result = await response.json();

    if (!response.ok) {
        throw new Error(result.message || "Failed to delete document.");
    }

    return result;
};