import * as Y from "yjs";

/**
 * Convert an AST Node into collaborative yjs block.
 * 
 * MongoDB AST: {
 *  _id,
 *  type,
 *  data
 * }
 * 
 * Yjs Block: {
 *  Y.map {
 *      id,
 *      type,
 *      data
 *  }
 * }
 * 
 * @param {object} node
 * @returns {Y.map}
 */

export const astnodeToYblock = (node) => {
    if (!node || !node.id) {
        throw new Error("Invalid AST Node.");
    }

    const block = new Y.Map();

    block.set("id", node.id.toString());
    block.set("type", node.type);
    block.set("data", node.data || {});

    return block;
};

/**
 * Load the MongoDB AST tree into a Y.Doc.
 * 
 * Structure: Y.Doc
 *              |__document
 *                      |__title
 *                      |__blocks
 * 
 * @param {object} documentTree
 * @param {Y.Doc} ydoc
 */

export const loadASTIntoYDocument = (documentTree, ydoc) => {
    if (!documentTree) {
        throw new Error("Document tree is required.");
    }

    if (!ydoc) {
        throw new Error("Y.Doc is required.");
    }

    const documentMap = ydoc.getMap("document");
    const blocks = ydoc.getArray("blocks");

    if (blocks.length > 0) {
        return;
    }

    documentMap.set("title", documentTree.title || "");

    const nodes = documentTree.root?.children || [];

    const yBlocks = nodes.map((node) => {
        return astnodeToYblock(node);
    });

    blocks.push(yBlocks);
};

/**
 * convert yjs block into plain javascript object.
 * 
 * This makes Yjs state compatible with the existing React BlockRenderer Architecture
 * 
 * @param {Y.Map} yBlock
 * @returns {object}
 */

export const yBlockToJSON = (yBlock) => {
    if (!yBlock) {
        return null;
    }

    return {
        id: yBlock.get("id"),
        type: yBlock.get("type"),
        data: yBlock.get("data")
    };
};

/**
 * Get all collaborative blocks from Y.Doc
 * 
 * @param {Y.Doc} ydoc
 * @returns {Array<object>}
 */

export const getYDocumentBlocks = (ydoc) => {
    if (!ydoc) {
        throw new Error("Y.Doc is required.");
    }

    const blocks = ydoc.getArray("blocks");

    return blocks.toArray().map((block) => {
        return yBlockToJSON(block);
    });
};