import http from "http";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { WebSocket } from "ws";
import * as Y from "yjs";

import connectDB from "../src/config/database.js";
import app from "../src/app.js";
import { createWebSocketServer } from "../src/websocket/websocket.server.js";
import Document from "../src/models/Document.js";
import ASTNode from "../src/models/ASTNode.js";
import { createDocument } from "../src/services/document.service.js";
import {
    getRoomCount,
    getLocksList,
    getPresenceList,
    getRoom
} from "../src/websocket/collaboration.room.js";

dotenv.config();

const TEST_PORT = 5057;
const WS_BASE_URL = `ws://localhost:${TEST_PORT}/ws/documents`;

function createTestClient(documentId) {
    const ws = new WebSocket(`${WS_BASE_URL}/${documentId}`);
    const ydoc = new Y.Doc();

    ws.on("error", () => {});

    ws.on("message", (data, isBinary) => {
        if (isBinary) {
            const update = new Uint8Array(data);
            Y.applyUpdate(ydoc, update, "remote");
        }
    });

    ydoc.on("update", (update, origin) => {
        if (origin !== "remote" && ws.readyState === WebSocket.OPEN) {
            ws.send(update);
        }
    });

    return { ws, ydoc };
}

function waitForJsonMessage(ws, filterFn, timeoutMs = 3000) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            ws.off("message", handler);
            reject(new Error(`Timeout waiting for JSON message (${timeoutMs}ms)`));
        }, timeoutMs);

        const handler = (data, isBinary) => {
            if (!isBinary) {
                const text = data.toString("utf8");
                try {
                    const msg = JSON.parse(text);
                    if (filterFn(msg)) {
                        clearTimeout(timer);
                        ws.off("message", handler);
                        resolve(msg);
                    }
                } catch (e) {
                    // ignore non-json
                }
            }
        };
        ws.on("message", handler);
    });
}

function sleep(ms) {
    return new Promise((res) => setTimeout(res, ms));
}

async function seedTestDocument(title) {
    const doc = await createDocument(title);
    const documentId = doc._id.toString();
    const rootNodeId = doc.rootNodeId;

    const blockTypes = ["heading", "paragraph", "code_block", "list", "quote"];
    for (let i = 0; i < 5; i++) {
        const node = new ASTNode({
            documentId,
            parentId: rootNodeId,
            type: blockTypes[i],
            position: (i + 1) * 10000,
            data: { content: `Block ${i + 1} content` }
        });
        await node.save();
    }
    return documentId;
}

const run10ClientsStressTest = async () => {
    let server = null;
    let documentId = null;
    const clients = [];

    try {
        console.log("\n==================================================");
        console.log("RUNNING 10 CONCURRENT CLIENTS STRESS TEST");
        console.log("==================================================\n");

        await connectDB();
        documentId = await seedTestDocument("10 Clients Concurrent Test");
        console.log(`Seeded Test Document: ${documentId}`);

        server = http.createServer(app);
        createWebSocketServer(server);
        await new Promise((res) => server.listen(TEST_PORT, res));
        console.log(`Test WebSocket Server running on port ${TEST_PORT}\n`);

        const NUM_CLIENTS = 10;
        console.log(`Connecting ${NUM_CLIENTS} concurrent clients...`);

        // Spawn 10 clients concurrently
        for (let i = 0; i < NUM_CLIENTS; i++) {
            const client = createTestClient(documentId);
            client.userId = `user-${i + 1}`;
            client.name = `User ${i + 1}`;
            clients.push(client);
        }

        // Wait for all 10 clients to connect to room
        await Promise.all(clients.map((c) => waitForJsonMessage(c.ws, (m) => m.type === "connected")));
        console.log(`✓ All ${NUM_CLIENTS} clients connected to collaboration room.`);

        // Identify all 10 clients
        for (let i = 0; i < NUM_CLIENTS; i++) {
            clients[i].ws.send(JSON.stringify({
                type: "presence:identify",
                user: { userId: clients[i].userId, name: clients[i].name }
            }));
        }

        await sleep(500);

        // Verify presence on server
        const presenceList = getPresenceList(documentId);
        console.log(`Presence list count on server: ${presenceList.length}`);
        if (presenceList.length !== NUM_CLIENTS) {
            throw new Error(`Expected ${NUM_CLIENTS} presence users, found ${presenceList.length}`);
        }

        // Verify initial Yjs block count on all 10 clients
        for (let i = 0; i < NUM_CLIENTS; i++) {
            const blocks = clients[i].ydoc.getMap("document").get("blocks");
            if (!blocks || blocks.length !== 5) {
                throw new Error(`Client ${i + 1} does not have 5 blocks (found ${blocks?.length})`);
            }
        }
        console.log("✓ All 10 clients initialized with 5 AST blocks.");

        // Concurrent simultaneous editing:
        // Each of the 10 clients edits a block concurrently in their Y.Doc
        console.log("\nTriggering simultaneous concurrent edits across 10 clients...");
        
        await Promise.all(clients.map(async (client, index) => {
            const blockIndex = index % 5;
            client.ydoc.transact(() => {
                const blocks = client.ydoc.getMap("document").get("blocks");
                const currentBlock = blocks.get(blockIndex);
                const updatedItem = {
                    ...currentBlock,
                    data: {
                        ...currentBlock.data,
                        content: `${currentBlock.data.content} | Edit by Client ${index + 1}`
                    }
                };
                blocks.delete(blockIndex, 1);
                blocks.insert(blockIndex, [updatedItem]);
            });
        }));

        await sleep(1000);

        // Verify convergence: Check that all 10 clients have identical state length and data
        console.log("\nVerifying Yjs state convergence across all 10 clients...");
        const serverRoom = getRoom(documentId);
        const serverBlocks = serverRoom.ydoc.getMap("document").get("blocks");
        console.log(`Server Y.Array blocks count: ${serverBlocks.length}`);

        const firstClientBlocksJSON = JSON.stringify(clients[0].ydoc.getMap("document").get("blocks").toArray());

        for (let i = 1; i < NUM_CLIENTS; i++) {
            const clientBlocksJSON = JSON.stringify(clients[i].ydoc.getMap("document").get("blocks").toArray());
            if (clientBlocksJSON !== firstClientBlocksJSON) {
                throw new Error(`State mismatch between Client 1 and Client ${i + 1}!`);
            }
        }

        console.log("✓ State Convergence Verified: All 10 clients hold EXACTLY identical Y.Doc states!");
        console.log(`✓ Final block count across all clients: ${serverBlocks.length}`);

        // Disconnect clients in 2 batches of 5 to verify gradual disconnect cleanup
        console.log("\nDisconnecting first batch (5 clients)...");
        for (let i = 0; i < 5; i++) {
            clients[i].ws.close();
        }
        await sleep(500);

        const presenceAfterBatch1 = getPresenceList(documentId);
        console.log(`Presence count after first batch disconnect: ${presenceAfterBatch1.length}`);
        if (presenceAfterBatch1.length !== 5) {
            throw new Error(`Expected 5 active presence users, found ${presenceAfterBatch1.length}`);
        }

        console.log("Disconnecting second batch (remaining 5 clients)...");
        for (let i = 5; i < 10; i++) {
            clients[i].ws.close();
        }
        await sleep(500);

        if (getRoomCount() !== 0) {
            throw new Error(`Expected 0 active rooms after all 10 clients disconnect, found ${getRoomCount()}`);
        }

        console.log("✓ Room Cleanup Verified: Room destroyed cleanly when all 10 clients disconnected.");

        console.log("\n==================================================");
        console.log("10 CONCURRENT CLIENTS STRESS TEST PASSED SUCCESSFULLY");
        console.log("==================================================\n");

    } catch (err) {
        console.error("❌ 10 CLIENTS STRESS TEST FAILED:", err);
        process.exitCode = 1;
    } finally {
        if (server) server.close();
        if (documentId) {
            await ASTNode.deleteMany({ documentId });
            await Document.deleteOne({ _id: documentId });
        }
        await mongoose.disconnect();
        console.log("Mongoose disconnected.");
    }
};

run10ClientsStressTest();
