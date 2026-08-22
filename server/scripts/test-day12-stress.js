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
    cleanupStaleLocks,
    getRoom
} from "../src/websocket/collaboration.room.js";

dotenv.config();

const TEST_PORT = 5056;
const WS_BASE_URL = `ws://localhost:${TEST_PORT}/ws/documents`;

const testResults = {
    test1: "PENDING",
    test2: "PENDING",
    test3: "PENDING",
    test4: "PENDING",
    test5: "PENDING",
    test6: "PENDING",
    test7: "PENDING",
    test8: "PENDING",
    test9: "PENDING",
    test10: "PENDING",
    test11: "PENDING",
    test12: "PENDING",
    test13: "PENDING",
    test14: "PENDING",
    test15: "PENDING"
};

const bugsFound = [];

// Helper to create a client with automatic Yjs synchronization
function createTestClient(documentId) {
    const ws = new WebSocket(`${WS_BASE_URL}/${documentId}`);
    const ydoc = new Y.Doc();

    ws.on("error", () => {}); // swallow connection errors for cleanup

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

function waitForOpen(ws) {
    return new Promise((resolve, reject) => {
        if (ws.readyState === WebSocket.OPEN) return resolve();
        ws.on("open", resolve);
        ws.on("error", reject);
    });
}

function waitForJsonMessage(ws, filterFn, timeoutMs = 2000) {
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

// Helper to seed a document with 5 AST blocks
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

const runStressTests = async () => {
    let server = null;
    let docIdA = null;
    let docIdB = null;

    try {
        console.log("\n==================================================");
        console.log("STARTING DAY 12 — INTEGRATION + STRESS TESTING");
        console.log("==================================================\n");

        await connectDB();

        // Seed fresh documents for testing
        docIdA = await seedTestDocument("Stress Doc A");
        docIdB = await seedTestDocument("Stress Doc B");

        console.log(`Seeded Test Document A: ${docIdA}`);
        console.log(`Seeded Test Document B: ${docIdB}\n`);

        server = http.createServer(app);
        createWebSocketServer(server);
        await new Promise((res) => server.listen(TEST_PORT, res));
        console.log(`Stress Test Server running on port ${TEST_PORT}\n`);

        // --------------------------------------------------
        // TEST 1 — TWO CLIENTS, SAME DOCUMENT
        // --------------------------------------------------
        console.log("--- TEST 1: Two Clients, Same Document ---");
        let clientA1 = null, clientB1 = null;
        try {
            clientA1 = createTestClient(docIdA);
            clientB1 = createTestClient(docIdA);
            await Promise.all([
                waitForJsonMessage(clientA1.ws, (m) => m.type === "connected"),
                waitForJsonMessage(clientB1.ws, (m) => m.type === "connected")
            ]);

            // Identify both users
            clientA1.ws.send(JSON.stringify({ type: "presence:identify", user: { userId: "user-A", name: "User A" } }));
            clientB1.ws.send(JSON.stringify({ type: "presence:identify", user: { userId: "user-B", name: "User B" } }));

            await sleep(300);

            // Verify presence
            const presence = getPresenceList(docIdA);
            if (presence.length !== 2) {
                throw new Error(`Expected 2 users in presence, found ${presence.length}`);
            }

            // Verify Yjs block count on both clients
            const blocksA = clientA1.ydoc.getMap("document").get("blocks");
            const blocksB = clientB1.ydoc.getMap("document").get("blocks");

            if (!blocksA || blocksA.length !== 5 || !blocksB || blocksB.length !== 5) {
                throw new Error(`Expected 5 blocks on both clients, found A:${blocksA?.length}, B:${blocksB?.length}`);
            }

            // Modify block 0 data from Client A using Yjs array mutation
            clientA1.ydoc.transact(() => {
                const item = { ...blocksA.get(0), data: { content: "Updated by Client A" } };
                blocksA.delete(0, 1);
                blocksA.insert(0, [item]);
            });

            await sleep(200);

            if (blocksB.get(0).data.content !== "Updated by Client A") {
                throw new Error("Client B did not receive Client A's update");
            }

            // Modify block 1 data from Client B using Yjs array mutation
            clientB1.ydoc.transact(() => {
                const item = { ...blocksB.get(1), data: { content: "Updated by Client B" } };
                blocksB.delete(1, 1);
                blocksB.insert(1, [item]);
            });

            await sleep(200);

            if (blocksA.get(1).data.content !== "Updated by Client B") {
                throw new Error("Client A did not receive Client B's update");
            }

            testResults.test1 = "PASS";
            console.log("✓ TEST 1 PASSED: Two clients same document sync verified.\n");
        } catch (err) {
            testResults.test1 = "FAIL";
            bugsFound.push(`Test 1 Failed: ${err.message}`);
            console.error("❌ TEST 1 FAILED:", err.message, "\n");
        } finally {
            if (clientA1) clientA1.ws.close();
            if (clientB1) clientB1.ws.close();
            await sleep(200);
        }

        // --------------------------------------------------
        // TEST 2 — DIFFERENT DOCUMENTS MUST BE ISOLATED
        // --------------------------------------------------
        console.log("--- TEST 2: Different Documents Isolation ---");
        let clientA2 = null, clientB2 = null;
        try {
            clientA2 = createTestClient(docIdA);
            clientB2 = createTestClient(docIdB);
            await Promise.all([
                waitForJsonMessage(clientA2.ws, (m) => m.type === "connected"),
                waitForJsonMessage(clientB2.ws, (m) => m.type === "connected")
            ]);

            let wsBReceivedUpdate = false;
            let wsAReceivedUpdate = false;

            clientA2.ydoc.on("update", (update, origin) => {
                if (origin === "remote") wsAReceivedUpdate = true;
            });
            clientB2.ydoc.on("update", (update, origin) => {
                if (origin === "remote") wsBReceivedUpdate = true;
            });

            clientA2.ws.send(JSON.stringify({ type: "presence:identify", user: { userId: "user-A", name: "User A" } }));
            clientB2.ws.send(JSON.stringify({ type: "presence:identify", user: { userId: "user-B", name: "User B" } }));
            await sleep(300);

            if (getRoomCount() !== 2) {
                throw new Error(`Expected 2 active rooms, found ${getRoomCount()}`);
            }

            // Send local update on docIdA
            wsBReceivedUpdate = false;
            clientA2.ydoc.transact(() => {
                const blocks = clientA2.ydoc.getMap("document").get("blocks");
                const item = { ...blocks.get(0), data: { content: "Doc A isolation edit" } };
                blocks.delete(0, 1);
                blocks.insert(0, [item]);
            });

            await sleep(200);

            if (wsBReceivedUpdate) {
                throw new Error("Document B incorrectly received an update from Document A");
            }

            // Send local update on docIdB
            wsAReceivedUpdate = false;
            clientB2.ydoc.transact(() => {
                const blocks = clientB2.ydoc.getMap("document").get("blocks");
                const item = { ...blocks.get(0), data: { content: "Doc B isolation edit" } };
                blocks.delete(0, 1);
                blocks.insert(0, [item]);
            });

            await sleep(200);

            if (wsAReceivedUpdate) {
                throw new Error("Document A incorrectly received an update from Document B");
            }

            testResults.test2 = "PASS";
            console.log("✓ TEST 2 PASSED: Room and document isolation verified.\n");
        } catch (err) {
            testResults.test2 = "FAIL";
            bugsFound.push(`Test 2 Failed: ${err.message}`);
            console.error("❌ TEST 2 FAILED:", err.message, "\n");
        } finally {
            if (clientA2) clientA2.ws.close();
            if (clientB2) clientB2.ws.close();
            await sleep(200);
        }

        // --------------------------------------------------
        // TEST 3 — SIMULTANEOUS EDITING OF DIFFERENT BLOCKS
        // --------------------------------------------------
        console.log("--- TEST 3: Simultaneous Editing of Different Blocks ---");
        let clientA3 = null, clientB3 = null;
        try {
            clientA3 = createTestClient(docIdA);
            clientB3 = createTestClient(docIdA);
            await Promise.all([
                waitForJsonMessage(clientA3.ws, (m) => m.type === "connected"),
                waitForJsonMessage(clientB3.ws, (m) => m.type === "connected")
            ]);

            clientA3.ws.send(JSON.stringify({ type: "presence:identify", user: { userId: "user-A", name: "User A" } }));
            clientB3.ws.send(JSON.stringify({ type: "presence:identify", user: { userId: "user-B", name: "User B" } }));
            await sleep(200);

            // User A locks block-1, User B locks block-2 simultaneously
            clientA3.ws.send(JSON.stringify({ type: "lock:acquire", blockId: "block-1" }));
            clientB3.ws.send(JSON.stringify({ type: "lock:acquire", blockId: "block-2" }));
            await sleep(200);

            const locks = getLocksList(docIdA);
            const lock1 = locks.find((l) => l.blockId === "block-1");
            const lock2 = locks.find((l) => l.blockId === "block-2");

            if (!lock1 || lock1.userId !== "user-A" || !lock2 || lock2.userId !== "user-B") {
                throw new Error(`Expected simultaneous locks for block-1 (user-A) and block-2 (user-B), found: ${JSON.stringify(locks)}`);
            }

            testResults.test3 = "PASS";
            console.log("✓ TEST 3 PASSED: Simultaneous editing of different blocks verified.\n");
        } catch (err) {
            testResults.test3 = "FAIL";
            bugsFound.push(`Test 3 Failed: ${err.message}`);
            console.error("❌ TEST 3 FAILED:", err.message, "\n");
        } finally {
            if (clientA3) clientA3.ws.close();
            if (clientB3) clientB3.ws.close();
            await sleep(200);
        }

        // --------------------------------------------------
        // TEST 4 — SAME BLOCK LOCK CONFLICT
        // --------------------------------------------------
        console.log("--- TEST 4: Same Block Lock Conflict ---");
        let clientA4 = null, clientB4 = null;
        try {
            clientA4 = createTestClient(docIdA);
            clientB4 = createTestClient(docIdA);
            await Promise.all([
                waitForJsonMessage(clientA4.ws, (m) => m.type === "connected"),
                waitForJsonMessage(clientB4.ws, (m) => m.type === "connected")
            ]);

            clientA4.ws.send(JSON.stringify({ type: "presence:identify", user: { userId: "user-A", name: "User A" } }));
            clientB4.ws.send(JSON.stringify({ type: "presence:identify", user: { userId: "user-B", name: "User B" } }));
            await sleep(200);

            // User A acquires block-1 lock
            clientA4.ws.send(JSON.stringify({ type: "lock:acquire", blockId: "block-1" }));
            await sleep(200);

            // User B attempts to acquire block-1
            const rejectPromise = waitForJsonMessage(clientB4.ws, (m) => m.type === "lock:rejected" && m.blockId === "block-1");
            clientB4.ws.send(JSON.stringify({ type: "lock:acquire", blockId: "block-1" }));

            const rejectMsg = await rejectPromise;
            if (rejectMsg.reason !== "BLOCK_LOCKED" || rejectMsg.lockedBy.userId !== "user-A") {
                throw new Error(`Invalid rejection response for lock conflict: ${JSON.stringify(rejectMsg)}`);
            }

            testResults.test4 = "PASS";
            console.log("✓ TEST 4 PASSED: Same block lock conflict enforcement verified.\n");
        } catch (err) {
            testResults.test4 = "FAIL";
            bugsFound.push(`Test 4 Failed: ${err.message}`);
            console.error("❌ TEST 4 FAILED:", err.message, "\n");
        } finally {
            if (clientA4) clientA4.ws.close();
            if (clientB4) clientB4.ws.close();
            await sleep(200);
        }

        // --------------------------------------------------
        // TEST 5 — DISCONNECT LOCK RECOVERY
        // --------------------------------------------------
        console.log("--- TEST 5: Disconnect Lock Recovery (Single & Multiple Locks) ---");
        let clientA5 = null, clientB5 = null;
        try {
            clientA5 = createTestClient(docIdA);
            clientB5 = createTestClient(docIdA);
            await Promise.all([
                waitForJsonMessage(clientA5.ws, (m) => m.type === "connected"),
                waitForJsonMessage(clientB5.ws, (m) => m.type === "connected")
            ]);

            clientA5.ws.send(JSON.stringify({ type: "presence:identify", user: { userId: "user-A", name: "User A" } }));
            clientB5.ws.send(JSON.stringify({ type: "presence:identify", user: { userId: "user-B", name: "User B" } }));
            await sleep(200);

            // User A acquires 3 locks: block-1, block-3, block-5
            clientA5.ws.send(JSON.stringify({ type: "lock:acquire", blockId: "block-1" }));
            clientA5.ws.send(JSON.stringify({ type: "lock:acquire", blockId: "block-3" }));
            clientA5.ws.send(JSON.stringify({ type: "lock:acquire", blockId: "block-5" }));
            await sleep(200);

            if (getLocksList(docIdA).length !== 3) {
                throw new Error("Pre-check failed: User A should own 3 locks");
            }

            // Unexpected disconnect of User A
            clientA5.ws.close();
            await sleep(300);

            const locksAfterDisconnect = getLocksList(docIdA);
            if (locksAfterDisconnect.length !== 0) {
                throw new Error(`Expected 0 locks after disconnect, found: ${JSON.stringify(locksAfterDisconnect)}`);
            }

            // User B acquires block-1 now
            const lockAcquiredPromise = waitForJsonMessage(clientB5.ws, (m) => m.type === "lock:acquired" && m.blockId === "block-1");
            clientB5.ws.send(JSON.stringify({ type: "lock:acquire", blockId: "block-1" }));

            await lockAcquiredPromise;

            testResults.test5 = "PASS";
            console.log("✓ TEST 5 PASSED: Disconnect lock recovery verified.\n");
        } catch (err) {
            testResults.test5 = "FAIL";
            bugsFound.push(`Test 5 Failed: ${err.message}`);
            console.error("❌ TEST 5 FAILED:", err.message, "\n");
        } finally {
            if (clientA5) clientA5.ws.close();
            if (clientB5) clientB5.ws.close();
            await sleep(200);
        }

        // --------------------------------------------------
        // TEST 6 — REFRESH / RELOAD
        // --------------------------------------------------
        console.log("--- TEST 6: Refresh / Reload Behavior ---");
        let clientA6_1 = null, clientA6_2 = null;
        try {
            clientA6_1 = createTestClient(docIdA);
            await waitForJsonMessage(clientA6_1.ws, (m) => m.type === "connected");

            await sleep(200);
            const initialBlocksCount = clientA6_1.ydoc.getMap("document").get("blocks").length;
            if (initialBlocksCount !== 5) {
                throw new Error(`Expected 5 blocks before refresh, found ${initialBlocksCount}`);
            }

            // Simulated browser refresh: disconnect clientA6_1, connect clientA6_2 to same active room
            clientA6_1.ws.close();
            await sleep(100);

            clientA6_2 = createTestClient(docIdA);
            await waitForJsonMessage(clientA6_2.ws, (m) => m.type === "connected");

            await sleep(200);
            const refreshedBlocksCount = clientA6_2.ydoc.getMap("document").get("blocks").length;
            if (refreshedBlocksCount !== 5) {
                throw new Error(`Expected 5 blocks after refresh, found ${refreshedBlocksCount}`);
            }

            testResults.test6 = "PASS";
            console.log("✓ TEST 6 PASSED: Refresh and state restoration verified.\n");
        } catch (err) {
            testResults.test6 = "FAIL";
            bugsFound.push(`Test 6 Failed: ${err.message}`);
            console.error("❌ TEST 6 FAILED:", err.message, "\n");
        } finally {
            if (clientA6_1) clientA6_1.ws.close();
            if (clientA6_2) clientA6_2.ws.close();
            await sleep(200);
        }

        // --------------------------------------------------
        // TEST 7 — ROOM LIFECYCLE
        // --------------------------------------------------
        console.log("--- TEST 7: Room Lifecycle & Cleanup ---");
        let clientA7 = null, clientB7 = null;
        try {
            const initialRooms = getRoomCount();

            clientA7 = createTestClient(docIdA);
            await waitForJsonMessage(clientA7.ws, (m) => m.type === "connected");

            if (getRoomCount() !== initialRooms + 1) {
                throw new Error(`Room count should increase by 1, got ${getRoomCount()}`);
            }

            clientB7 = createTestClient(docIdA);
            await waitForJsonMessage(clientB7.ws, (m) => m.type === "connected");

            if (getRoomCount() !== initialRooms + 1) {
                throw new Error(`Room count should remain same when 2nd client connects, got ${getRoomCount()}`);
            }

            clientA7.ws.close();
            await sleep(200);

            if (getRoomCount() !== initialRooms + 1) {
                throw new Error(`Room should remain active while Client B is connected, got ${getRoomCount()}`);
            }

            clientB7.ws.close();
            await sleep(200);

            if (getRoomCount() !== initialRooms) {
                throw new Error(`Room should be destroyed when last client leaves, got ${getRoomCount()}`);
            }

            testResults.test7 = "PASS";
            console.log("✓ TEST 7 PASSED: Room lifecycle and cleanup verified.\n");
        } catch (err) {
            testResults.test7 = "FAIL";
            bugsFound.push(`Test 7 Failed: ${err.message}`);
            console.error("❌ TEST 7 FAILED:", err.message, "\n");
        } finally {
            if (clientA7) clientA7.ws.close();
            if (clientB7) clientB7.ws.close();
            await sleep(200);
        }

        // --------------------------------------------------
        // TEST 8 — RAPID CONNECT / DISCONNECT
        // --------------------------------------------------
        console.log("--- TEST 8: Rapid Connect / Disconnect Stress ---");
        try {
            for (let i = 0; i < 5; i++) {
                const c = createTestClient(docIdA);
                c.ws.close();
            }
            await sleep(500);

            if (getRoomCount() !== 0) {
                throw new Error(`Expected 0 active rooms after rapid connect/disconnect, found ${getRoomCount()}`);
            }

            testResults.test8 = "PASS";
            console.log("✓ TEST 8 PASSED: Rapid connect/disconnect stress verified.\n");
        } catch (err) {
            testResults.test8 = "FAIL";
            bugsFound.push(`Test 8 Failed: ${err.message}`);
            console.error("❌ TEST 8 FAILED:", err.message, "\n");
        }

        // --------------------------------------------------
        // TEST 9 — MULTIPLE USERS (3 clients)
        // --------------------------------------------------
        console.log("--- TEST 9: Multiple Users (3 Clients) ---");
        let clientA9 = null, clientB9 = null, clientC9 = null;
        try {
            clientA9 = createTestClient(docIdA);
            clientB9 = createTestClient(docIdA);
            clientC9 = createTestClient(docIdA);
            await Promise.all([
                waitForJsonMessage(clientA9.ws, (m) => m.type === "connected"),
                waitForJsonMessage(clientB9.ws, (m) => m.type === "connected"),
                waitForJsonMessage(clientC9.ws, (m) => m.type === "connected")
            ]);

            clientA9.ws.send(JSON.stringify({ type: "presence:identify", user: { userId: "user-A", name: "User A" } }));
            clientB9.ws.send(JSON.stringify({ type: "presence:identify", user: { userId: "user-B", name: "User B" } }));
            clientC9.ws.send(JSON.stringify({ type: "presence:identify", user: { userId: "user-C", name: "User C" } }));
            await sleep(300);

            const presence = getPresenceList(docIdA);
            if (presence.length !== 3) {
                throw new Error(`Expected 3 users in presence, found ${presence.length}`);
            }

            // User A -> block-1, User B -> block-2, User C -> block-3
            clientA9.ws.send(JSON.stringify({ type: "lock:acquire", blockId: "block-1" }));
            clientB9.ws.send(JSON.stringify({ type: "lock:acquire", blockId: "block-2" }));
            clientC9.ws.send(JSON.stringify({ type: "lock:acquire", blockId: "block-3" }));
            await sleep(200);

            if (getLocksList(docIdA).length !== 3) {
                throw new Error("Expected 3 coexisting locks");
            }

            // Disconnect User B
            clientB9.ws.close();
            await sleep(300);

            const presenceAfterB = getPresenceList(docIdA);
            if (presenceAfterB.length !== 2 || presenceAfterB.some((u) => u.userId === "user-B")) {
                throw new Error("User B was not properly removed from presence");
            }

            const locksAfterB = getLocksList(docIdA);
            if (locksAfterB.length !== 2 || locksAfterB.some((l) => l.userId === "user-B")) {
                throw new Error("Only User B's lock should be released");
            }

            testResults.test9 = "PASS";
            console.log("✓ TEST 9 PASSED: Multiple users interaction verified.\n");
        } catch (err) {
            testResults.test9 = "FAIL";
            bugsFound.push(`Test 9 Failed: ${err.message}`);
            console.error("❌ TEST 9 FAILED:", err.message, "\n");
        } finally {
            if (clientA9) clientA9.ws.close();
            if (clientB9) clientB9.ws.close();
            if (clientC9) clientC9.ws.close();
            await sleep(200);
        }

        // --------------------------------------------------
        // TEST 10 — STALE LOCK STRESS
        // --------------------------------------------------
        console.log("--- TEST 10: Stale Lock Stress ---");
        let clientA10 = null, clientB10 = null;
        try {
            clientA10 = createTestClient(docIdA);
            clientB10 = createTestClient(docIdA);
            await Promise.all([
                waitForJsonMessage(clientA10.ws, (m) => m.type === "connected"),
                waitForJsonMessage(clientB10.ws, (m) => m.type === "connected")
            ]);

            clientA10.ws.send(JSON.stringify({ type: "presence:identify", user: { userId: "user-A", name: "User A" } }));
            clientB10.ws.send(JSON.stringify({ type: "presence:identify", user: { userId: "user-B", name: "User B" } }));
            await sleep(200);

            clientA10.ws.send(JSON.stringify({ type: "lock:acquire", blockId: "block-1" }));
            clientB10.ws.send(JSON.stringify({ type: "lock:acquire", blockId: "block-2" }));
            await sleep(200);

            // Make block-1 stale by setting timestamp to 35 seconds ago
            const room = getRoom(docIdA);
            const lock1 = room.locks.get("block-1");
            lock1.timestamp = Date.now() - 35000;

            cleanupStaleLocks(docIdA, 30000);
            await sleep(200);

            const locks = getLocksList(docIdA);
            if (locks.some((l) => l.blockId === "block-1")) {
                throw new Error("Stale lock block-1 was not released");
            }
            if (!locks.some((l) => l.blockId === "block-2")) {
                throw new Error("Active lock block-2 was incorrectly released");
            }

            testResults.test10 = "PASS";
            console.log("✓ TEST 10 PASSED: Targeted stale lock cleanup verified.\n");
        } catch (err) {
            testResults.test10 = "FAIL";
            bugsFound.push(`Test 10 Failed: ${err.message}`);
            console.error("❌ TEST 10 FAILED:", err.message, "\n");
        } finally {
            if (clientA10) clientA10.ws.close();
            if (clientB10) clientB10.ws.close();
            await sleep(200);
        }

        // --------------------------------------------------
        // TEST 11 — MALFORMED COLLABORATION MESSAGES
        // --------------------------------------------------
        console.log("--- TEST 11: Malformed Messages Handling ---");
        let clientA11 = null;
        try {
            clientA11 = createTestClient(docIdA);
            await waitForJsonMessage(clientA11.ws, (m) => m.type === "connected");

            // Send invalid json and malformed object formats
            clientA11.ws.send("{}");
            clientA11.ws.send(JSON.stringify({ type: "lock:acquire" }));
            clientA11.ws.send(JSON.stringify({ type: "lock:acquire", blockId: "" }));
            clientA11.ws.send(JSON.stringify({ type: "unknown" }));
            clientA11.ws.send("{bad-json");
            clientA11.ws.send(JSON.stringify({ type: "presence:identify", user: null }));
            await sleep(200);

            if (clientA11.ws.readyState !== WebSocket.OPEN) {
                throw new Error("WebSocket closed after receiving malformed messages");
            }

            // Send a valid message afterwards to ensure connection is healthy
            clientA11.ws.send(JSON.stringify({ type: "presence:identify", user: { userId: "user-A", name: "User A" } }));
            await sleep(200);

            const presence = getPresenceList(docIdA);
            if (presence.length !== 1 || presence[0].userId !== "user-A") {
                throw new Error("Server failed to process valid message after malformed messages");
            }

            testResults.test11 = "PASS";
            console.log("✓ TEST 11 PASSED: Server resilience to malformed messages verified.\n");
        } catch (err) {
            testResults.test11 = "FAIL";
            bugsFound.push(`Test 11 Failed: ${err.message}`);
            console.error("❌ TEST 11 FAILED:", err.message, "\n");
        } finally {
            if (clientA11) clientA11.ws.close();
            await sleep(200);
        }

        // --------------------------------------------------
        // TEST 12 — BINARY YJS REGRESSION
        // --------------------------------------------------
        console.log("--- TEST 12: Binary Yjs Regression ---");
        let clientA12 = null, clientB12 = null;
        try {
            clientA12 = createTestClient(docIdA);
            clientB12 = createTestClient(docIdA);
            await Promise.all([
                waitForJsonMessage(clientA12.ws, (m) => m.type === "connected"),
                waitForJsonMessage(clientB12.ws, (m) => m.type === "connected")
            ]);

            await sleep(200);

            const blocksA = clientA12.ydoc.getMap("document").get("blocks");
            const blocksB = clientB12.ydoc.getMap("document").get("blocks");

            if (blocksA.length !== 5 || blocksB.length !== 5) {
                throw new Error(`Binary Yjs regression check failed: A:${blocksA.length}, B:${blocksB.length}`);
            }

            testResults.test12 = "PASS";
            console.log("✓ TEST 12 PASSED: Binary Yjs state and protocol separation verified.\n");
        } catch (err) {
            testResults.test12 = "FAIL";
            bugsFound.push(`Test 12 Failed: ${err.message}`);
            console.error("❌ TEST 12 FAILED:", err.message, "\n");
        } finally {
            if (clientA12) clientA12.ws.close();
            if (clientB12) clientB12.ws.close();
            await sleep(200);
        }

        // --------------------------------------------------
        // TEST 13 — PRESENCE + LOCK CONSISTENCY
        // --------------------------------------------------
        console.log("--- TEST 13: Presence + Lock Consistency ---");
        let clientA13 = null;
        try {
            clientA13 = createTestClient(docIdA);
            await waitForJsonMessage(clientA13.ws, (m) => m.type === "connected");

            clientA13.ws.send(JSON.stringify({ type: "presence:identify", user: { userId: "user-A", name: "User A" } }));
            await sleep(200);

            clientA13.ws.send(JSON.stringify({ type: "lock:acquire", blockId: "block-2" }));
            await sleep(200);

            let presence = getPresenceList(docIdA);
            let locks = getLocksList(docIdA);

            if (presence.length !== 1 || locks.length !== 1 || locks[0].userId !== "user-A") {
                throw new Error("Presence or lock state inconsistent while user is connected");
            }

            clientA13.ws.close();
            await sleep(300);

            presence = getPresenceList(docIdA);
            locks = getLocksList(docIdA);

            if (presence.length !== 0 || locks.length !== 0) {
                throw new Error("Inconsistent state: locks or presence survived disconnect");
            }

            testResults.test13 = "PASS";
            console.log("✓ TEST 13 PASSED: Presence and lock consistency verified.\n");
        } catch (err) {
            testResults.test13 = "FAIL";
            bugsFound.push(`Test 13 Failed: ${err.message}`);
            console.error("❌ TEST 13 FAILED:", err.message, "\n");
        } finally {
            if (clientA13 && clientA13.ws.readyState === WebSocket.OPEN) clientA13.ws.close();
            await sleep(200);
        }

        // --------------------------------------------------
        // TEST 14 — LOCK OWNERSHIP SECURITY
        // --------------------------------------------------
        console.log("--- TEST 14: Lock Ownership Security ---");
        let clientA14 = null, clientB14 = null;
        try {
            clientA14 = createTestClient(docIdA);
            clientB14 = createTestClient(docIdA);
            await Promise.all([
                waitForJsonMessage(clientA14.ws, (m) => m.type === "connected"),
                waitForJsonMessage(clientB14.ws, (m) => m.type === "connected")
            ]);

            clientA14.ws.send(JSON.stringify({ type: "presence:identify", user: { userId: "user-A", name: "User A" } }));
            clientB14.ws.send(JSON.stringify({ type: "presence:identify", user: { userId: "user-B", name: "User B" } }));
            await sleep(200);

            // User A locks block-1
            clientA14.ws.send(JSON.stringify({ type: "lock:acquire", blockId: "block-1" }));
            await sleep(200);

            // User B attempts lock:release
            const releaseRejectPromise = waitForJsonMessage(clientB14.ws, (m) => m.type === "lock:rejected" && m.reason === "NOT_LOCK_OWNER");
            clientB14.ws.send(JSON.stringify({ type: "lock:release", blockId: "block-1" }));
            await releaseRejectPromise;

            // User B attempts lock:refresh
            const refreshRejectPromise = waitForJsonMessage(clientB14.ws, (m) => m.type === "lock:rejected" && m.reason === "NOT_LOCK_OWNER");
            clientB14.ws.send(JSON.stringify({ type: "lock:refresh", blockId: "block-1" }));
            await refreshRejectPromise;

            // User B attempts lock:acquire
            const acquireRejectPromise = waitForJsonMessage(clientB14.ws, (m) => m.type === "lock:rejected" && m.reason === "BLOCK_LOCKED");
            clientB14.ws.send(JSON.stringify({ type: "lock:acquire", blockId: "block-1" }));
            await acquireRejectPromise;

            // User A is still owner
            const locks = getLocksList(docIdA);
            if (locks.length !== 1 || locks[0].userId !== "user-A") {
                throw new Error("Lock ownership was compromised");
            }

            testResults.test14 = "PASS";
            console.log("✓ TEST 14 PASSED: Lock ownership security verified.\n");
        } catch (err) {
            testResults.test14 = "FAIL";
            bugsFound.push(`Test 14 Failed: ${err.message}`);
            console.error("❌ TEST 14 FAILED:", err.message, "\n");
        } finally {
            if (clientA14) clientA14.ws.close();
            if (clientB14) clientB14.ws.close();
            await sleep(200);
        }

        // --------------------------------------------------
        // TEST 15 — DOCUMENT ISOLATION + LOCK ISOLATION
        // --------------------------------------------------
        console.log("--- TEST 15: Document + Lock Isolation ---");
        let clientA15 = null, clientB15 = null;
        try {
            clientA15 = createTestClient(docIdA);
            clientB15 = createTestClient(docIdB);
            await Promise.all([
                waitForJsonMessage(clientA15.ws, (m) => m.type === "connected"),
                waitForJsonMessage(clientB15.ws, (m) => m.type === "connected")
            ]);

            clientA15.ws.send(JSON.stringify({ type: "presence:identify", user: { userId: "user-A", name: "User A" } }));
            clientB15.ws.send(JSON.stringify({ type: "presence:identify", user: { userId: "user-B", name: "User B" } }));
            await sleep(200);

            // User A locks block-1 on Document A
            clientA15.ws.send(JSON.stringify({ type: "lock:acquire", blockId: "block-1" }));
            await sleep(200);

            // User B locks block-1 on Document B
            const lockB1Promise = waitForJsonMessage(clientB15.ws, (m) => m.type === "lock:acquired" && m.blockId === "block-1");
            clientB15.ws.send(JSON.stringify({ type: "lock:acquire", blockId: "block-1" }));
            await lockB1Promise;

            const locksA = getLocksList(docIdA);
            const locksB = getLocksList(docIdB);

            if (locksA.length !== 1 || locksA[0].userId !== "user-A" || locksB.length !== 1 || locksB[0].userId !== "user-B") {
                throw new Error("Document locks crossed isolation boundaries");
            }

            testResults.test15 = "PASS";
            console.log("✓ TEST 15 PASSED: Document and lock isolation verified.\n");
        } catch (err) {
            testResults.test15 = "FAIL";
            bugsFound.push(`Test 15 Failed: ${err.message}`);
            console.error("❌ TEST 15 FAILED:", err.message, "\n");
        } finally {
            if (clientA15) clientA15.ws.close();
            if (clientB15) clientB15.ws.close();
            await sleep(200);
        }

        console.log("==================================================");
        console.log("DAY 12 STRESS TEST SUITE COMPLETE");
        console.log("==================================================\n");

    } catch (error) {
        console.error("FATAL ERROR IN STRESS TEST RUNNER:", error);
    } finally {
        if (server) server.close();
        // Clean up test documents
        if (docIdA) {
            await ASTNode.deleteMany({ documentId: docIdA });
            await Document.deleteOne({ _id: docIdA });
        }
        if (docIdB) {
            await ASTNode.deleteMany({ documentId: docIdB });
            await Document.deleteOne({ _id: docIdB });
        }
        await mongoose.disconnect();
        console.log("Mongoose disconnected.");

        console.log("\nFINAL TEST RESULTS SUMMARY:");
        console.log(JSON.stringify(testResults, null, 2));

        if (bugsFound.length > 0) {
            console.log("\nBUGS FOUND:");
            bugsFound.forEach((b) => console.log("- " + b));
        }

        if (Object.values(testResults).includes("FAIL")) {
            process.exitCode = 1;
        }
    }
};

runStressTests();
