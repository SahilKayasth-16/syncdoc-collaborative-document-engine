import mongoose from "mongoose";
import Document from "../models/Document.js";
import ASTNode from "../models/ASTNode.js";
import { sanitizePlainText } from "../security/sanitizer.js";
import { getRoom } from "../websocket/collaboration.room.js";
import { getYDocumentBlocks } from "./ast-crdt.service.js";

/**
 * Creating a new document with is new AST Node
 * 
 * The document and root AST Node references each other,
 * so creation requires a controlled bootstrap sequence
 */

export const createDocument = async (title, bootstrapChildren = true) => {
    const sanitizedTitle = sanitizePlainText(title);
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
            title: sanitizedTitle,
            rootNodeId
        });

        document.bypassTreeValidation = true;
        await document.save();

        // 2. Create root AST Node
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

        // 3. Bootstrap default editable child AST nodes under root if requested
        if (bootstrapChildren) {
            const defaultHeading = new ASTNode({
                documentId: documentId,
                parentId: rootNodeId,
                type: 'heading',
                position: 10000,
                data: { level: 1, content: sanitizedTitle || "Untitled Document" }
            });
            defaultHeading.bypassTreeValidation = true;
            await defaultHeading.save();

            const defaultParagraph = new ASTNode({
                documentId: documentId,
                parentId: rootNodeId,
                type: 'paragraph',
                position: 20000,
                data: { content: "Start typing your collaborative content here..." }
            });
            defaultParagraph.bypassTreeValidation = true;
            await defaultParagraph.save();
        }

        /**
         * 4. Both Document and root node now exist with valid children.
         * Run the normal recursive validation.
         */
        document.bypassTreeValidation = false;
        await document.save();

        return document;
    } catch (error) {
        await ASTNode.deleteMany({ documentId });
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

    // Check if an active live Yjs collaboration room exists for this document
    const activeRoom = getRoom(documentId.toString());
    if (activeRoom && activeRoom.ydoc) {
        try {
            const documentMap = activeRoom.ydoc.getMap("document");
            const liveTitle = documentMap.get("title");
            if (liveTitle) {
                document.title = liveTitle;
            }

            const liveBlocks = getYDocumentBlocks(activeRoom.ydoc);
            liveBlocks.forEach((liveBlock) => {
                const bId = liveBlock.id?.toString();
                if (bId && nodeMap.has(bId)) {
                    const node = nodeMap.get(bId);
                    if (liveBlock.data && typeof liveBlock.data === "object") {
                        node.data = { ...node.data, ...liveBlock.data };
                        // Persist live updated data to MongoDB asynchronously
                        ASTNode.updateOne({ _id: node.id }, { $set: { data: node.data } }).catch(() => {});
                    }
                }
            });
        } catch (err) {
            console.warn(`[DocumentService] Could not overlay live Yjs blocks for doc ${documentId}:`, err.message);
        }
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
    const sanitizedTitle = sanitizePlainText(title);
    return await Document.findByIdAndUpdate(
        documentId,
        {
            $set: {
                title: sanitizedTitle
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