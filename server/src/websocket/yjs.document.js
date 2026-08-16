import * as Y from "yjs";

/**
 * Each collaboration room should have exactly same Y.Doc
 * associated with its document ID
 * 
 * @returns {Y.Doc}
 */

export const createYDocument = () => {
    return new Y.Doc();
};

/**
 * Destroy a Yjs document and release its resources
 * 
 * @param {Y.Doc} ydoc
 */

export const destroyYDocument = (ydoc) => {
    if (!ydoc) {
        return;
    }
    ydoc.destroy();
};