import * as Y from "yjs";

/**
 * Create a new Yjs document for a collaboration room.
 *
 * @returns {Y.Doc}
 */
export const createYDocument = () => {
    return new Y.Doc();
};

/**
 * Get the collaborative document map.
 *
 * Structure:
 *
 * Y.Doc
 *   └── Y.Map("document")
 *        ├── title
 *        └── blocks
 *
 * @param {Y.Doc} ydoc
 * @returns {Y.Map}
 */
export const getDocumentMap = (ydoc) => {
    if (!ydoc) {
        throw new Error("Y.Doc is required.");
    }

    const documentMap = ydoc.getMap("document");

    // Initialize the blocks array once.
    if (!documentMap.has("blocks")) {
        documentMap.set("blocks", new Y.Array());
    }

    return documentMap;
};

/**
 * Get the collaborative blocks array.
 *
 * @param {Y.Doc} ydoc
 * @returns {Y.Array}
 */
export const getDocumentBlocks = (ydoc) => {
    const documentMap = getDocumentMap(ydoc);

    return documentMap.get("blocks");
};

/**
 * Set the document title.
 *
 * @param {Y.Doc} ydoc
 * @param {string} title
 */
export const setDocumentTitle = (ydoc, title) => {
    const documentMap = getDocumentMap(ydoc);

    documentMap.set("title", title);
};

/**
 * Get the document title.
 *
 * @param {Y.Doc} ydoc
 * @returns {string|null}
 */
export const getDocumentTitle = (ydoc) => {
    const documentMap = getDocumentMap(ydoc);

    return documentMap.get("title") ?? null;
};

/**
 * Encode the complete current Yjs document state.
 *
 * This state can be sent to a newly connected client.
 *
 * @param {Y.Doc} ydoc
 * @returns {Uint8Array}
 */
export const encodeDocumentState = (ydoc) => {
    if (!ydoc) {
        throw new Error("Y.Doc is required.");
    }

    return Y.encodeStateAsUpdate(ydoc);
};

/**
 * Apply an incoming Yjs update to the document.
 *
 * @param {Y.Doc} ydoc
 * @param {Uint8Array} update
 */
export const applyDocumentUpdate = (ydoc, update) => {
    if (!ydoc) {
        throw new Error("Y.Doc is required.");
    }

    if (!(update instanceof Uint8Array)) {
        throw new Error("Yjs update must be a Uint8Array.");
    }

    Y.applyUpdate(ydoc, update);
};

/**
 * Listen for Yjs document updates.
 *
 * @param {Y.Doc} ydoc
 * @param {(update: Uint8Array, origin: any) => void} callback
 * @returns {() => void} unsubscribe function
 */
export const onDocumentUpdate = (ydoc, callback) => {
    if (!ydoc) {
        throw new Error("Y.Doc is required.");
    }

    if (typeof callback !== "function") {
        throw new Error("Update callback must be a function.");
    }

    ydoc.on("update", callback);

    return () => {
        ydoc.off("update", callback);
    };
};

/**
 * Destroy a Yjs document and release its resources.
 *
 * @param {Y.Doc} ydoc
 */
export const destroyYDocument = (ydoc) => {
    if (!ydoc) {
        return;
    }

    ydoc.destroy();
};