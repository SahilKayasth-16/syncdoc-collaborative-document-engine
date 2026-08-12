import dotenv from "dotenv";
import mongoose from "mongoose";

import connectDB from "../src/config/database.js";
import Document from "../src/models/Document.js";
import ASTNode from "../src/models/ASTNode.js";
import { createDocument } from "../src/services/document.service.js";

dotenv.config();

async function seedEditor() {
    try {
        console.log("\n --- STARTING EDITOR SEED. ---");

        await connectDB();

        console.log("Cleaning existing editor data...");
        await ASTNode.deleteMany({});
        await Document.deleteMany({});

        console.log("Creating Document...");

        const document = await createDocument("SyncDoc Editor Demo");

        const documentId = document._id;
        const rootNodeId = document.rootNodeId;

        console.log(`Document Created: ${documentId}`);
        console.log(`RootNode: ${rootNodeId}`);

        //HEADING
        const heading = new ASTNode({
            documentId,
            parentId: rootNodeId,
            type: "heading",
            position: 10000,
            data: {
                level: 1,
                content: "SyncDoc Collaborative Editor"
            }
        });

        await heading.save();

        //PARAGRAPH
        const paragraph = new ASTNode({
            documentId,
            parentId: rootNodeId,
            type: "paragraph",
            position: 20000,
            data: {
                content: "This document is rendered from AST nodes and React block components."
            }
        });

        await paragraph.save();

        //CODE BLOCK
        const codeBlock = new ASTNode({
            documentId,
            parentId: rootNodeId,
            type: "code_block",
            position: 30000,
            data: {
                language: "javascript",
                content: "console.log('Hello from SyncDoc!');"
            }
        });

        await codeBlock.save();

        //LIST
         const listBlock = new ASTNode({
            documentId,
            parentId: rootNodeId,
            type: "list",
            position: 40000,
            data: {
                style: "unordered",
                items: [
                    "AST-based document structure",
                    "React block rendering",
                    "Collaborative editing",
                    "Future real-time synchronization"
                ]
            }
        });

        await listBlock.save();

        //QUOTE
        const quoteBlock = new ASTNode({
            documentId,
            parentId: rootNodeId,
            type: "quote",
            position: 50000,
            data: {
                content:
                    "A document is a structured tree, not just a string.",
                author: "SyncDoc"
            }
        });

        await quoteBlock.save();

        //VERIFICATION
        const nodes = await ASTNode.find({ documentId }).sort({ position: 1});

        console.log("\n Created AST Nodes:");

        for (const node of nodes) {
            console.log(`${node.type} | position: ${node.position}`);
        }

        console.log(`\n Total AST Nodes: ${nodes.length}`);

        console.log("--- Editor AST Seed Completed Successfully. ---");
    } catch(error) {
        console.error("\n Seed Failed: ", error.message);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        console.log("Mongoose Disconnected.");
    }
}

await seedEditor();