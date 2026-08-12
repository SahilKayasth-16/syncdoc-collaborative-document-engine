import mongoose from "mongoose";
import Document from "../models/Document.js";
import ASTNode from "../models/ASTNode.js";

/**
 * Creating a new document with is new AST Node
 * 
 * The document and root AST Node references each other,
 * so creation requires a controlled bootstrap sequence
 */

export const createDocument = async (title) => {
    const documentId = new mongoose.Types.ObjectId();
    const rootNodeId = new mongoose.Types.ObjectId();

    try {
        /**
         * 1. Create the Document container.
         * Deep validation is temporarily bypassed because
         * the root AST node does not exist yet.
         */
        const document = new Document({
            _id: documentId,
            title,
            rootNodeId
        });

        document.bypassTreeValidation = true;
        await document.save();

        //2. Create root AST Node
        const rootNode = new ASTNode({
            _id: rootNodeId,
            documentId: documentId,
            parentId: null,
            type: 'document',
            position: 0,
            data: {}
        });

        rootNode.bypassTreeValidation = true;
        await rootNode.save();

        /**
         * 3. Both Document and root node now exist.
         * Run the normal recursive validation.
         */
        document.bypassTreeValidation = false;
        await document.save();

        return document;
    } catch (error) {
        await ASTNode.deleteOne({ _id: rootNodeId });
        await Document.deleteOne({ _id: documentId });

        throw error;
    }
};

/**
 * Get all documents.
 */
export const getAllDocuments = async () => {
    return await Document.find({})
        .select('_id title rootNodeId createdAt updatedAt')
        .sort({ updatedAt: -1 });
};

/**
 * Get a document by ID.
 */
export const getDocumentById = async (documentId) => {
    return await Document.findById(documentId)
        .select('_id title rootNodeId createdAt updatedAt');
};

/**
 * Get a document with its complete AST tree.
 */
export const getDocumentTree = async (documentId) => {
    const document = await Document.findById(documentId)
        .select('_id title rootNodeId createdAt updatedAt')
        .lean();

    if (!document) {
        return null;
    }

    const nodes = await ASTNode.find({ documentId })
        .select('_id documentId parentId type position data createdAt updatedAt')
        .lean();

    const nodeMap = new Map();

    // Create a tree node for every AST node.
    for (const node of nodes) {
        nodeMap.set(node._id.toString(), {
            id: node._id,
            type: node.type,
            position: node.position,
            data: node.data,
            children: []
        });
    }

    // Attach each node to its parent.
    for (const node of nodes) {
        if (node.parentId) {
            const parent = nodeMap.get(node.parentId.toString());

            if (parent) {
                const child = nodeMap.get(node._id.toString());

                if (child) {
                    parent.children.push(child);
                }
            }
        }
    }

    // Position determines ordering only among siblings.
    for (const treeNode of nodeMap.values()) {
        treeNode.children.sort(
            (a, b) => a.position - b.position
        );
    }

    const root = nodeMap.get(document.rootNodeId.toString());

    if (!root) {
        throw new Error('Document root node not found');
    }

    return {
        id: document._id,
        title: document.title,
        root,
        createdAt: document.createdAt,
        updatedAt: document.updatedAt
    };
};

/**
 * Update document metadata.
 *
 * Currently only the document title can be updated.
 * AST structure is intentionally excluded from this operation.
 */
export const updateDocument = async (documentId, title) => {
    return await Document.findByIdAndUpdate(
        documentId,
        {
            $set: {
                title
            }
        },
        {
            new: true,
            runValidators: true
        }
    ).select('_id title rootNodeId createdAt updatedAt');
};

/**
 * Delete a document and all of its AST nodes.
 */
export const deleteDocument = async (documentId) => {
    const document = await Document.findById(documentId);

    if (!document) {
        return null;
    }

    // Delete all AST nodes belonging to this document.
    await ASTNode.deleteMany({
        documentId
    });

    // Delete the document container.
    await Document.deleteOne({
        _id: documentId
    });

    return document;
};