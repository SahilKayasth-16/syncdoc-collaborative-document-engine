const API_BASE_URL = "http://localhost:5050/api";

export const getDocumentTree = async (documentId) => {
    const response = await fetch(`${API_BASE_URL}/documents/${documentId}/tree`);

    const result = await response.json();

    if (!response.ok) {
        throw new Error(result.message || "Failed to fetch document tree.");
    }

    return result.data;
};