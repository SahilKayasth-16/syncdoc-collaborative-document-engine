import * as Y from "yjs";
import { sanitizeAST, sanitizeASTNode } from "../security/sanitizer.js";

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
    if (!node || (!node.id && !node._id)) {
        throw new Error("Invalid AST Node.");
    }

    const sanitized = sanitizeASTNode(node) || node;
    const nodeId = sanitized.id || sanitized._id;

    const block = new Y.Map();

    block.set("id", nodeId.toString());
    block.set("type", sanitized.type);
    block.set("data", sanitized.data || {});

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
 * @param {object} rawDocumentTree
 * @param {Y.Doc} ydoc
 */

export const loadASTIntoYDocument = (rawDocumentTree, ydoc) => {
    if (!rawDocumentTree) {
        throw new Error("Document tree is required.");
    }

    if (!ydoc) {
        throw new Error("Y.Doc is required.");
    }

    const documentTree = sanitizeAST(rawDocumentTree) || rawDocumentTree;

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

    const documentMap = ydoc.getMap("document");
    const blocks = documentMap.get("blocks") || ydoc.getArray("blocks");
    if (!blocks) return [];

    const arr = typeof blocks.toArray === "function" ? blocks.toArray() : Array.from(blocks);

    return arr.map((block) => {
        if (typeof block?.get === "function") {
            return {
                id: block.get("id"),
                type: block.get("type"),
                position: block.get("position"),
                data: block.get("data")
            };
        }
        return {
            id: block?.id || block?._id,
            type: block?.type,
            position: block?.position,
            data: block?.data
        };
    });
};