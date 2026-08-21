import dotenv from "dotenv";
import mongoose from "mongoose";

import connectDB from "../src/config/database.js";
import { getDocumentTree } from "../src/services/document.service.js";
import {
    loadASTIntoYDocument,
    getYDocumentBlocks
} from "../src/services/ast-crdt.service.js";

import * as Y from "yjs";

dotenv.config();

const DOCUMENT_ID = "6a873f40721f8def908c6ee5";
const runTest = async () => {
    try {
        console.log("\n--- STARTING AST ↔ CRDT TEST ---\n");

        await connectDB();

        console.log("Loading document AST...");

        const documentTree = await getDocumentTree(DOCUMENT_ID);

        if (!documentTree) {
            throw new Error(
                `Document ${DOCUMENT_ID} not found. Run seed-editor.js first.`
            );
        }

        console.log(`Document: ${documentTree.title}`);

        const astNodes = documentTree.root?.children || [];

        console.log(`AST child nodes: ${astNodes.length}`);

        if (astNodes.length !== 5) {
            throw new Error(
                `Expected 5 AST blocks, found ${astNodes.length}.`
            );
        }

        // Create a fresh collaborative Y.Doc
        const ydoc = new Y.Doc();

        console.log("Created Y.Doc.");

        // Load AST into Yjs
        loadASTIntoYDocument(documentTree, ydoc);

        console.log("AST loaded into Y.Doc.");

        // Read collaborative blocks
        const blocks = getYDocumentBlocks(ydoc);

        console.log(`Yjs blocks: ${blocks.length}`);

        // Verify block count
        if (blocks.length !== astNodes.length) {
            throw new Error(
                `Block count mismatch. AST: ${astNodes.length}, Yjs: ${blocks.length}`
            );
        }

        console.log("✓ AST → Yjs block count verified.");

        // Verify stable IDs
        for (let i = 0; i < astNodes.length; i++) {
            const astId = astNodes[i].id.toString();
            const yjsId = blocks[i].id;

            if (astId !== yjsId) {
                throw new Error(
                    `Stable ID mismatch at block ${i + 1}. AST: ${astId}, Yjs: ${yjsId}`
                );
            }
        }

        console.log("✓ Stable AST node IDs preserved.");

        // Verify block types
        const expectedTypes = [
            "heading",
            "paragraph",
            "code_block",
            "list",
            "quote"
        ];

        for (let i = 0; i < expectedTypes.length; i++) {
            if (blocks[i].type !== expectedTypes[i]) {
                throw new Error(
                    `Type mismatch at block ${i + 1}. Expected "${expectedTypes[i]}", found "${blocks[i].type}".`
                );
            }
        }

        console.log("✓ Block types preserved.");

        // Verify important data
        if (blocks[0].data?.content !== astNodes[0].data?.content) {
            throw new Error("Heading data was not preserved.");
        }

        if (blocks[1].data?.content !== astNodes[1].data?.content) {
            throw new Error("Paragraph data was not preserved.");
        }

        if (blocks[2].data?.content !== astNodes[2].data?.content) {
            throw new Error("Code block data was not preserved.");
        }

        if (
            JSON.stringify(blocks[3].data) !==
            JSON.stringify(astNodes[3].data)
        ) {
            throw new Error("List data was not preserved.");
        }

        if (blocks[4].data?.content !== astNodes[4].data?.content) {
            throw new Error("Quote data was not preserved.");
        }

        console.log("✓ Block data preserved.");

        // Verify title
        const documentMap = ydoc.getMap("document");
        const title = documentMap.get("title");

        if (title !== documentTree.title) {
            throw new Error(
                `Document title mismatch. Expected "${documentTree.title}", found "${title}".`
            );
        }

        console.log("✓ Document title preserved.");

        console.log("\nCreated collaborative blocks:");

        blocks.forEach((block, index) => {
            console.log(
                `${index + 1}. ${block.type} | id: ${block.id}`
            );
        });

        console.log("\n--- AST ↔ CRDT TEST PASSED SUCCESSFULLY ---");

        ydoc.destroy();

    } catch (error) {
        console.error("\n--- AST ↔ CRDT TEST FAILED ---");
        console.error(error.message);

        process.exitCode = 1;
    } finally {
        await mongoose.disconnect();
        console.log("Mongoose disconnected.");
    }
};

await runTest();