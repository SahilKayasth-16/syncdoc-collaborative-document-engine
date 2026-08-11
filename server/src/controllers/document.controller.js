import mongoose from "mongoose";
import { createDocument, getAllDocuments, getDocumentById, 
         getDocumentTree, updateDocument, deleteDocument } from '../services/document.service.js';

//CREATING NEW DOCUMENT WITH ITS ROOT BAST NODE
export const createDocumentController = async(req, res, next) => {
    try {
        const { title } = req.body;

        if (typeof title !== 'string' || !title.trim()) {
            return res.status(400).json({
                status: 'Error',
                message: 'Document title is required.'
            });
        }

        const document = await createDocument(title.trim());

        return res.status(201).json({
            status: 'OK',
            data: document
        });
    } catch (error) {
        next(error);
    }
};

//GETTING ALL DOCUMENTS
export const getAllDocumentsController = async (req, res, next) => {
    try {
        const documents = await getAllDocuments();

        return res.status(200).json ({
            status: 'OK',
            count: documents.length,
            data: documents
        });
    } catch(error) {
        next(error);
    }
};

//GET DOCUMENT BY ID
/**
 * GET /api/documents/:id
 * Get a single document by ID.
 */
export const getDocumentByIdController = async (req, res, next) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                status: 'Error',
                message: 'Invalid document ID'
            });
        }

        const document = await getDocumentById(id);

        if (!document) {
            return res.status(404).json({
                status: 'Error',
                message: 'Document not found'
            });
        }

        return res.status(200).json({
            status: 'OK',
            data: document
        });
    } catch (error) {
        next(error);
    }
};

// GET DOCUMENT TREE
export const getDocumentTreeController = async (req, res, next) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                status: 'Error',
                message: 'Invalid document ID'
            });
        }

        const documentTree = await getDocumentTree(id);

        if (!documentTree) {
            return res.status(404).json({
                status: 'Error',
                message: 'Document not found'
            });
        }

        return res.status(200).json({
            status: 'OK',
            data: documentTree
        });
    } catch (error) {
        next(error);
    }
};

//UPDATE DOCUMENT
export const updateDocumentController = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { title } = req.body;

        // Validate MongoDB ObjectId
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                status: 'Error',
                message: 'Invalid document ID'
            });
        }

        // Validate title
        if (typeof title !== 'string' || !title.trim()) {
            return res.status(400).json({
                status: 'Error',
                message: 'Document title is required'
            });
        }

        const document = await updateDocument(
            id,
            title.trim()
        );

        if (!document) {
            return res.status(404).json({
                status: 'Error',
                message: 'Document not found'
            });
        }

        return res.status(200).json({
            status: 'OK',
            data: document
        });
    } catch (error) {
        next(error);
    }
};

//DELETE DOCUMENT
export const deleteDocumentController = async (req, res, next) => {
    try {
        const { id } = req.params;

        // Validate MongoDB ObjectId
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                status: 'Error',
                message: 'Invalid document ID'
            });
        }

        const document = await deleteDocument(id);

        if (!document) {
            return res.status(404).json({
                status: 'Error',
                message: 'Document not found'
            });
        }

        return res.status(200).json({
            status: 'OK',
            message: 'Document deleted successfully'
        });
    } catch (error) {
        next(error);
    }
};