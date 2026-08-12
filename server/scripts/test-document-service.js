import dotenv from "dotenv";
import mongoose from "mongoose";
import connectDB from "../src/config/database.js";
import Document from "../src/models/Document.js";
import ASTNode from "../src/models/ASTNode.js";

import { createDocument } from "../src/services/document.service.js";

dotenv.config();

async function runTest() {
    try {
        console.log(`STARTING DOCUMENT SERVICE TESTS...`);

        await connectDB();

        await Document.deleteMany({});
        await ASTNode.deleteMany({});

        console.log(`CREATING DOCUMENT THROUGH SERVICE...`);

        const document = await createDocument(`Service Test Document`);

        console.log(`Document Created: ${document._id}`);
        console.log(`Title: ${document.title}`);
        console.log(`Root Node ID: ${document.rootNodeId}`);

        //VERIFY DOCUMENT
        const savedDocument = await Document.findById(document._id);

        if (!savedDocument) throw new Error('Document not found in database.');

        console.log('Document persisted successfully.');

        //VERIFY ROOT AST NODE
        const rootNode = await ASTNode.findById(document.rootNodeId);

        if (!rootNode) throw new Error('Root AST Node not found in database.');

        console.log("Root AST Node persisted successfully.");

        //VERIFY RELATIONSHIP
        if(rootNode.documentId.toString() !== document._id.toString()) {
            throw new Error('Root Node ID does not matches with Document ID.');
        }

        if (rootNode.parentId !== null) {
            throw new Error('Root Node parent ID must be null.');
        }

        if (rootNode.type !== "document") {
            throw new Error('Root Node type must be "document".');
        }

        console.log("Document - RootNode relationship verified.");

        console.log(`DOCUMENT SERVICE TEST PASSED SUCCESSFULLY...`);
    } catch(error) {
        console.error(`Test execution failed: ${error.message}`);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        console.log('Mongoose Disconnected.');
    }
}

await runTest();