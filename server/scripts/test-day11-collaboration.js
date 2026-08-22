import http from "http";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { WebSocket } from "ws";
import * as Y from "yjs";

import connectDB from "../src/config/database.js";
import app from "../src/app.js";
import { createWebSocketServer } from "../src/websocket/websocket.server.js";
import Document from "../src/models/Document.js";
import { getDocumentTree } from "../src/services/document.service.js";
import {
    getOrCreateRoom,
    addUserPresence,
    removeUserPresence,
    getPresenceList,
    acquireBlockLock,
    releaseBlockLock,
    releaseLocksForUser,
    getLocksList,
    cleanupStaleLocks,
    removeRoom
} from "../src/websocket/collaboration.room.js";

const TEST_PORT = 5055;

const runTests = async () => {
    let server = null;
    try {
        console.log("\n==================================================");
        console.log("STARTING DAY 11 — PRESENCE + BLOCK LOCKING TESTS");
        console.log("==================================================\n");

        await connectDB();

        let doc = await Document.findOne();
        if (!doc) {
            const { createDocument } = await import("../src/services/document.service.js");
            doc = await createDocument("Day 11 Reg Test Doc");
        }
        const DOCUMENT_ID = doc._id.toString();
        const WS_URL = `ws://localhost:${TEST_PORT}/ws/documents/${DOCUMENT_ID}`;

        // Start temporary test server
        server = http.createServer(app);
        createWebSocketServer(server);

        await new Promise((resolve) => server.listen(TEST_PORT, resolve));
        console.log(`Test WebSocket Server running on port ${TEST_PORT}\n`);

        // --------------------------------------------------
        // TEST 1 — Presence
        // --------------------------------------------------
        console.log("--- TEST 1: Presence ---");
        const wsA = new WebSocket(WS_URL);
        await new Promise((res) => wsA.on("open", res));

        wsA.send(JSON.stringify({
            type: "presence:identify",
            user: { userId: "user-1", name: "User A" }
        }));

        await new Promise((res) => setTimeout(res, 200));

        let presence = getPresenceList(DOCUMENT_ID);
        console.log("Presence after User A connects:", presence);
        if (presence.length !== 1 || presence[0].userId !== "user-1") {
            throw new Error("TEST 1 FAILED: Expected 1 user (user-1) in presence.");
        }

        const wsB = new WebSocket(WS_URL);
        await new Promise((res) => wsB.on("open", res));

        wsB.send(JSON.stringify({
            type: "presence:identify",
            user: { userId: "user-2", name: "User B" }
        }));

        await new Promise((res) => setTimeout(res, 200));

        presence = getPresenceList(DOCUMENT_ID);
        console.log("Presence after User B connects:", presence);
        if (presence.length !== 2) {
            throw new Error("TEST 1 FAILED: Expected 2 users in presence.");
        }

        wsB.close();
        await new Promise((res) => setTimeout(res, 200));

        presence = getPresenceList(DOCUMENT_ID);
        console.log("Presence after User B disconnects:", presence);
        if (presence.length !== 1 || presence[0].userId !== "user-1") {
            throw new Error("TEST 1 FAILED: Expected 1 user (user-1) after B disconnects.");
        }
        console.log("✓ TEST 1 PASSED: Presence tracking verified.\n");

        // Reconnect User B for subsequent tests
        const wsB2 = new WebSocket(WS_URL);
        await new Promise((res) => wsB2.on("open", res));
        wsB2.send(JSON.stringify({
            type: "presence:identify",
            user: { userId: "user-2", name: "User B" }
        }));
        await new Promise((res) => setTimeout(res, 200));

        // --------------------------------------------------
        // TEST 2 — Acquire lock
        // --------------------------------------------------
        console.log("--- TEST 2: Acquire Lock ---");
        const lockMsgPromise = new Promise((resolve) => {
            const handler = (data) => {
                const msg = JSON.parse(data.toString());
                if (msg.type === "lock:acquired" && msg.blockId === "block-2") {
                    wsA.off("message", handler);
                    resolve(msg);
                }
            };
            wsA.on("message", handler);
        });

        wsA.send(JSON.stringify({
            type: "lock:acquire",
            blockId: "block-2"
        }));

        const acquiredResult = await lockMsgPromise;
        console.log("Lock acquired response:", acquiredResult);

        let locks = getLocksList(DOCUMENT_ID);
        if (locks.length !== 1 || locks[0].blockId !== "block-2" || locks[0].userId !== "user-1") {
            throw new Error("TEST 2 FAILED: Block 2 was not locked by user-1.");
        }
        console.log("✓ TEST 2 PASSED: Lock acquisition verified.\n");

        // --------------------------------------------------
        // TEST 3 — Lock conflict
        // --------------------------------------------------
        console.log("--- TEST 3: Lock Conflict ---");
        const rejectMsgPromise = new Promise((resolve) => {
            const handler = (data) => {
                const msg = JSON.parse(data.toString());
                if (msg.type === "lock:rejected" && msg.blockId === "block-2") {
                    wsB2.off("message", handler);
                    resolve(msg);
                }
            };
            wsB2.on("message", handler);
        });

        wsB2.send(JSON.stringify({
            type: "lock:acquire",
            blockId: "block-2"
        }));

        const rejectResult = await rejectMsgPromise;
        console.log("Lock conflict rejection response:", rejectResult);
        if (rejectResult.reason !== "BLOCK_LOCKED" || rejectResult.lockedBy.userId !== "user-1") {
            throw new Error("TEST 3 FAILED: Lock conflict was not properly rejected.");
        }
        console.log("✓ TEST 3 PASSED: Lock conflict handling verified.\n");

        // --------------------------------------------------
        // TEST 4 — Localized locking
        // --------------------------------------------------
        console.log("--- TEST 4: Localized Locking ---");
        const lockB1Promise = new Promise((resolve) => {
            const handler = (data) => {
                const msg = JSON.parse(data.toString());
                if (msg.type === "lock:acquired" && msg.blockId === "block-1") {
                    wsB2.off("message", handler);
                    resolve(msg);
                }
            };
            wsB2.on("message", handler);
        });

        wsB2.send(JSON.stringify({
            type: "lock:acquire",
            blockId: "block-1"
        }));

        await lockB1Promise;
        locks = getLocksList(DOCUMENT_ID);
        console.log("Active locks after B locks block-1:", locks);
        if (locks.length !== 2) {
            throw new Error("TEST 4 FAILED: Expected 2 active locks (block-1 by B, block-2 by A).");
        }
        console.log("✓ TEST 4 PASSED: Localized block locking verified.\n");

        // --------------------------------------------------
        // TEST 5 — Release lock
        // --------------------------------------------------
        console.log("--- TEST 5: Release Lock ---");
        const releasePromise = new Promise((resolve) => {
            const handler = (data) => {
                const msg = JSON.parse(data.toString());
                if (msg.type === "lock:released" && msg.blockId === "block-2") {
                    wsA.off("message", handler);
                    resolve(msg);
                }
            };
            wsA.on("message", handler);
        });

        wsA.send(JSON.stringify({
            type: "lock:release",
            blockId: "block-2"
        }));

        await releasePromise;
        locks = getLocksList(DOCUMENT_ID);
        console.log("Active locks after A releases block-2:", locks);
        if (locks.some(l => l.blockId === "block-2")) {
            throw new Error("TEST 5 FAILED: Block 2 was not released.");
        }
        console.log("✓ TEST 5 PASSED: Lock release verified.\n");

        // --------------------------------------------------
        // TEST 6 — Unauthorized release
        // --------------------------------------------------
        console.log("--- TEST 6: Unauthorized Release ---");
        const unauthReleasePromise = new Promise((resolve) => {
            const handler = (data) => {
                const msg = JSON.parse(data.toString());
                if (msg.type === "lock:rejected" && msg.blockId === "block-1") {
                    wsA.off("message", handler);
                    resolve(msg);
                }
            };
            wsA.on("message", handler);
        });

        // User A attempts to release block-1 owned by User B
        wsA.send(JSON.stringify({
            type: "lock:release",
            blockId: "block-1"
        }));

        const unauthResult = await unauthReleasePromise;
        console.log("Unauthorized release rejection response:", unauthResult);
        if (unauthResult.reason !== "NOT_LOCK_OWNER") {
            throw new Error("TEST 6 FAILED: Unauthorized release was not rejected.");
        }
        console.log("✓ TEST 6 PASSED: Unauthorized release protection verified.\n");

        // --------------------------------------------------
        // TEST 7 — Disconnect cleanup
        // --------------------------------------------------
        console.log("--- TEST 7: Disconnect Cleanup ---");
        // User B owns block-1, let user B acquire block-5 as well
        wsB2.send(JSON.stringify({
            type: "lock:acquire",
            blockId: "block-5"
        }));
        await new Promise((res) => setTimeout(res, 200));

        locks = getLocksList(DOCUMENT_ID);
        console.log("Locks before User B disconnects:", locks);
        if (locks.length !== 2) {
            throw new Error("TEST 7 PRE-CHECK FAILED: User B should own 2 locks.");
        }

        // Disconnect User B
        wsB2.close();
        await new Promise((res) => setTimeout(res, 300));

        locks = getLocksList(DOCUMENT_ID);
        console.log("Locks after User B disconnects:", locks);
        if (locks.length !== 0) {
            throw new Error("TEST 7 FAILED: All locks owned by disconnected user B should be released.");
        }
        console.log("✓ TEST 7 PASSED: Disconnect lock cleanup verified.\n");

        // --------------------------------------------------
        // TEST 8 — Stale lock cleanup
        // --------------------------------------------------
        console.log("--- TEST 8: Stale Lock Cleanup ---");
        // Manually insert an old lock (older than 30s)
        const room = await getOrCreateRoom(DOCUMENT_ID);
        room.locks.set("block-stale", {
            blockId: "block-stale",
            userId: "user-1",
            name: "User A",
            timestamp: Date.now() - 35000 // 35 seconds ago
        });

        console.log("Locks before stale cleanup:", getLocksList(DOCUMENT_ID));
        cleanupStaleLocks(DOCUMENT_ID, 30000);
        locks = getLocksList(DOCUMENT_ID);
        console.log("Locks after stale cleanup:", locks);
        if (locks.some(l => l.blockId === "block-stale")) {
            throw new Error("TEST 8 FAILED: Stale lock was not cleaned up.");
        }
        console.log("✓ TEST 8 PASSED: Stale lock cleanup verified.\n");

        // --------------------------------------------------
        // TEST 9 — Yjs Regression Test
        // --------------------------------------------------
        console.log("--- TEST 9: Yjs Regression Test ---");
        const docTree = await getDocumentTree(DOCUMENT_ID);
        const ydoc = room.ydoc;
        const blocksArray = ydoc.getMap("document").get("blocks");
        console.log("MongoDB AST root children count:", docTree.root.children.length);
        console.log("Collaborative Y.Array blocks count:", blocksArray.length);

        if (blocksArray.length !== 5) {
            throw new Error(`TEST 9 FAILED: Expected 5 collaborative blocks, found ${blocksArray.length}`);
        }
        console.log("✓ TEST 9 PASSED: 5-block Yjs document state preserved.\n");

        // Cleanup WebSockets
        wsA.close();

        console.log("==================================================");
        console.log("ALL DAY 11 COLLABORATION TESTS PASSED SUCCESSFULLY");
        console.log("==================================================\n");

    } catch (error) {
        console.error("\n--- DAY 11 TEST SUITE FAILED ---");
        console.error(error);
        process.exitCode = 1;
    } finally {
        if (server) {
            server.close();
        }
        await mongoose.disconnect();
        console.log("Mongoose disconnected.");
    }
};

runTests();
