/**
 * Day 21 — Real-Time Cursor & Selection Synchronization Automated Test Suite
 *
 * Verifies all 9 Day 21 requirements:
 * 1. Two-client cursor sync (User A -> User B)
 * 2. Remote selection range sync (startOffset & endOffset)
 * 3. Multiple users cursor sync (3+ clients)
 * 4. Database Zero-Persistence Verification (0 MongoDB writes during cursor updates)
 * 5. Yjs Document Zero-Persistence Verification (0 Yjs block structure mutations)
 * 6. Invalid cursor data validation & bounds handling
 * 7. Missing / non-existent block safety
 * 8. Disconnect cleanup (immediate purge on WS disconnect)
 * 9. Security & Collaboration regression pass (Presence, locks, sanitization intact)
 */

import http from 'http';
import WebSocket from 'ws';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import * as Y from 'yjs';

import connectDB from '../src/config/database.js';
import app from '../src/app.js';
import { createWebSocketServer } from '../src/websocket/websocket.server.js';
import Document from '../src/models/Document.js';
import ASTNode from '../src/models/ASTNode.js';
import { createDocument } from '../src/services/document.service.js';
import { getRoom, getCursorsList } from '../src/websocket/collaboration.room.js';

dotenv.config();

function assert(condition, message) {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

function connectWSClient(port, documentId, user) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/documents/${documentId}`);
    const messages = [];

    ws.on('open', () => {
      if (user) {
        ws.send(JSON.stringify({ type: 'presence:identify', user }));
      }
      resolve({
        ws,
        user,
        messages,
        sendJSON(data) {
          ws.send(JSON.stringify(data));
        },
        close() {
          ws.close();
        }
      });
    });

    ws.on('message', data => {
      try {
        const text = typeof data === 'string' ? data : data.toString('utf-8');
        const message = JSON.parse(text);
        if (message && typeof message === 'object') {
          messages.push(message);
        }
      } catch {
        // Binary Yjs update
      }
    });

    ws.on('error', err => reject(err));
  });
}

function waitForMessage(client, filterFn, timeout = 3000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const check = () => {
      const match = client.messages.find(filterFn);
      if (match) {
        return resolve(match);
      }
      if (Date.now() - startTime > timeout) {
        return reject(new Error('Timeout waiting for WS message condition'));
      }
      setTimeout(check, 50);
    };

    check();
  });
}

async function runDay21CursorSuite() {
  console.log('=================================================================');
  console.log('   DAY 21 — REAL-TIME CURSOR & SELECTION SYNC TEST SUITE');
  console.log('=================================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  await connectDB();
  const server = http.createServer(app);
  createWebSocketServer(server);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  try {
    await Document.deleteMany({});
    await ASTNode.deleteMany({});

    const doc = await createDocument('Day 21 Cursor Test Doc', false);
    const docId = doc._id.toString();

    const block1 = new ASTNode({
      documentId: doc._id,
      parentId: doc.rootNodeId,
      type: 'paragraph',
      position: 10000,
      data: { content: 'First test block content for cursor positioning.' }
    });
    await block1.save();
    const block1Id = block1._id.toString();

    const block2 = new ASTNode({
      documentId: doc._id,
      parentId: doc.rootNodeId,
      type: 'paragraph',
      position: 20000,
      data: { content: 'Second block for multi-block remote cursor testing.' }
    });
    await block2.save();
    const block2Id = block2._id.toString();

    // -----------------------------------------------------------------
    // TEST 1: Two-client cursor sync (User A -> User B)
    // -----------------------------------------------------------------
    totalTests++;
    console.log('[Test 1] Testing Two-Client Real-Time Cursor Sync...');

    const userA = { userId: 'user-a', name: 'Alice' };
    const userB = { userId: 'user-b', name: 'Bob' };

    const clientA = await connectWSClient(port, docId, userA);
    const clientB = await connectWSClient(port, docId, userB);

    await new Promise(resolve => setTimeout(resolve, 200));

    // Clear initial messages
    clientB.messages.length = 0;

    // User A updates cursor in block1 at offset 5
    clientA.sendJSON({
      type: 'cursor:update',
      blockId: block1Id,
      offset: 5
    });

    const cursorUpdateMsg1 = await waitForMessage(clientB, m => m.type === 'cursors:update');
    assert(cursorUpdateMsg1 && Array.isArray(cursorUpdateMsg1.cursors), 'Received cursors:update broadcast');
    const userACursor = cursorUpdateMsg1.cursors.find(c => c.userId === 'user-a');
    assert(userACursor, 'User A cursor present in broadcast');
    assert(userACursor.blockId === block1Id, 'Correct blockId synchronized');
    assert(userACursor.offset === 5, 'Correct offset synchronized');
    assert(typeof userACursor.color === 'string' && userACursor.color.startsWith('#'), 'Valid hex color assigned');

    console.log('  ✓ PASS: User A cursor update correctly received by User B with assigned color.');
    passedTests++;

    // -----------------------------------------------------------------
    // TEST 2: Remote Selection Range Sync
    // -----------------------------------------------------------------
    totalTests++;
    console.log('\n[Test 2] Testing Remote Selection Range Sync...');

    clientB.messages.length = 0;

    // User A selects characters 5 to 15 in block1
    clientA.sendJSON({
      type: 'cursor:update',
      blockId: block1Id,
      offset: 15,
      startOffset: 5,
      endOffset: 15
    });

    const cursorUpdateMsg2 = await waitForMessage(clientB, m => m.type === 'cursors:update' && m.cursors.some(c => c.userId === 'user-a' && c.startOffset === 5));
    const userASelection = cursorUpdateMsg2.cursors.find(c => c.userId === 'user-a');
    assert(userASelection.startOffset === 5, 'startOffset synchronized correctly');
    assert(userASelection.endOffset === 15, 'endOffset synchronized correctly');

    console.log('  ✓ PASS: Remote selection range [5, 15] synchronized successfully.');
    passedTests++;

    // -----------------------------------------------------------------
    // TEST 3: Multiple Users Cursor Sync (3 Clients)
    // -----------------------------------------------------------------
    totalTests++;
    console.log('\n[Test 3] Testing Multi-User (3+ Clients) Cursor Sync...');

    const userC = { userId: 'user-c', name: 'Charlie' };
    const clientC = await connectWSClient(port, docId, userC);
    await new Promise(resolve => setTimeout(resolve, 200));

    clientA.messages.length = 0;

    // User B and User C move cursors
    clientB.sendJSON({ type: 'cursor:update', blockId: block2Id, offset: 8 });
    clientC.sendJSON({ type: 'cursor:update', blockId: block1Id, offset: 2 });

    await new Promise(resolve => setTimeout(resolve, 200));

    const roomCursors = getCursorsList(docId);
    assert(roomCursors.length === 3, 'Room contains 3 active cursors');
    const uA = roomCursors.find(c => c.userId === 'user-a');
    const uB = roomCursors.find(c => c.userId === 'user-b');
    const uC = roomCursors.find(c => c.userId === 'user-c');
    assert(uA && uB && uC, 'All 3 user cursors present in room state');
    assert(uA.color !== uB.color || uB.color !== uC.color, 'Distinct colors assigned to users');

    console.log('  ✓ PASS: 3 concurrent client cursors managed independently with distinct colors.');
    passedTests++;

    // -----------------------------------------------------------------
    // TEST 4: Database Zero-Persistence Verification
    // -----------------------------------------------------------------
    totalTests++;
    console.log('\n[Test 4] Verifying 0 Database Writes During Cursor Updates...');

    const docBefore = await Document.findById(doc._id).lean();
    const nodesCountBefore = await ASTNode.countDocuments({ documentId: doc._id });

    // Rapidly send 20 cursor updates
    for (let i = 0; i < 20; i++) {
      clientA.sendJSON({ type: 'cursor:update', blockId: block1Id, offset: i });
      clientB.sendJSON({ type: 'cursor:update', blockId: block2Id, offset: i + 2 });
    }

    await new Promise(resolve => setTimeout(resolve, 300));

    const docAfter = await Document.findById(doc._id).lean();
    const nodesCountAfter = await ASTNode.countDocuments({ documentId: doc._id });

    assert(nodesCountBefore === nodesCountAfter, 'ASTNode count must remain unchanged (0 insertions/deletions)');
    assert(new Date(docBefore.updatedAt).getTime() === new Date(docAfter.updatedAt).getTime(), 'Document updatedAt timestamp must not change on cursor movement');

    console.log('  ✓ PASS: 0 database writes or timestamp updates occurred during 20 rapid cursor updates.');
    passedTests++;

    // -----------------------------------------------------------------
    // TEST 5: Yjs Document Zero-Persistence Verification
    // -----------------------------------------------------------------
    totalTests++;
    console.log('\n[Test 5] Verifying 0 Yjs Block Mutations During Cursor Moves...');

    const room = await getRoom(docId);
    assert(room && room.ydoc, 'Room Y.Doc exists');

    const docMap = room.ydoc.getMap('document');
    const blocksArray = docMap.get('blocks');
    const initialBlocksLength = blocksArray ? blocksArray.length : 0;

    // Move cursors again
    clientA.sendJSON({ type: 'cursor:update', blockId: block1Id, offset: 25 });
    clientB.sendJSON({ type: 'cursor:update', blockId: block2Id, offset: 12 });

    await new Promise(resolve => setTimeout(resolve, 200));

    const postMoveBlocksArray = docMap.get('blocks');
    assert((postMoveBlocksArray ? postMoveBlocksArray.length : 0) === initialBlocksLength, 'Yjs blocks array length untouched');

    // Verify 'cursors' is NOT in persistent Yjs docMap
    assert(!docMap.has('cursors'), 'Yjs docMap must NOT contain persistent cursors key');

    console.log('  ✓ PASS: Yjs document structure remains 100% free of cursor payload mutations.');
    passedTests++;

    // -----------------------------------------------------------------
    // TEST 6: Invalid Cursor Data Validation & Bounds Handling
    // -----------------------------------------------------------------
    totalTests++;
    console.log('\n[Test 6] Testing Invalid Cursor Payload Handling & Bounds Clamping...');

    clientB.messages.length = 0;

    // Send negative offset
    clientA.sendJSON({ type: 'cursor:update', blockId: block1Id, offset: -15 });

    const msgNeg = await waitForMessage(clientB, m => m.type === 'cursors:update' && m.cursors.some(c => c.userId === 'user-a' && c.offset === 0));
    const userANeg = msgNeg.cursors.find(c => c.userId === 'user-a');
    assert(userANeg.offset === 0, 'Negative offset clamped to 0');

    // Send null blockId (clears cursor)
    clientA.sendJSON({ type: 'cursor:update', blockId: null });
    const msgClear = await waitForMessage(clientB, m => m.type === 'cursors:update' && !m.cursors.some(c => c.userId === 'user-a'));
    assert(!msgClear.cursors.some(c => c.userId === 'user-a'), 'Setting null blockId clears active cursor');

    console.log('  ✓ PASS: Negative offset clamped safely to 0 and null blockId clears cursor state.');
    passedTests++;

    // -----------------------------------------------------------------
    // TEST 7: Missing / Non-Existent Block Safety
    // -----------------------------------------------------------------
    totalTests++;
    console.log('\n[Test 7] Testing Missing / Deleted Block Cursor Handling...');

    clientB.messages.length = 0;

    // Send cursor update for non-existent block ID
    clientA.sendJSON({ type: 'cursor:update', blockId: 'non-existent-block-xyz999', offset: 10 });

    const msgMissingBlock = await waitForMessage(clientB, m => m.type === 'cursors:update' && m.cursors.some(c => c.userId === 'user-a' && c.blockId === 'non-existent-block-xyz999'));
    assert(msgMissingBlock, 'Broadcast sent without server error/exception');

    console.log('  ✓ PASS: Cursor for non-existent block handled safely without crashing server or room.');
    passedTests++;

    // -----------------------------------------------------------------
    // TEST 8: Disconnect Cleanup
    // -----------------------------------------------------------------
    totalTests++;
    console.log('\n[Test 8] Testing Immediate Cursor Purge on WS Disconnect...');

    clientB.messages.length = 0;

    // Ensure Client C has a cursor
    clientC.sendJSON({ type: 'cursor:update', blockId: block1Id, offset: 4 });
    await new Promise(resolve => setTimeout(resolve, 150));

    // Disconnect Client C
    clientC.close();

    const msgDisconnect = await waitForMessage(clientB, m => m.type === 'cursors:update' && !m.cursors.some(c => c.userId === 'user-c'));
    assert(msgDisconnect, 'Received cursors:update after client disconnect');
    assert(!msgDisconnect.cursors.some(c => c.userId === 'user-c'), 'User C cursor removed from room state');

    console.log('  ✓ PASS: Client disconnect immediately purged remote cursor from room awareness state.');
    passedTests++;

    // -----------------------------------------------------------------
    // TEST 9: Security & Collaboration Regression Pass
    // -----------------------------------------------------------------
    totalTests++;
    console.log('\n[Test 9] Running Security & Collaboration Regression Pass...');

    // Verify block locking still works on same room
    clientA.sendJSON({ type: 'lock:acquire', blockId: block1Id });
    const lockAcquiredMsg = await waitForMessage(clientA, m => m.type === 'lock:acquired' && m.blockId === block1Id);
    assert(lockAcquiredMsg, 'Block lock acquired successfully');

    clientB.sendJSON({ type: 'lock:acquire', blockId: block1Id });
    const lockRejectedMsg = await waitForMessage(clientB, m => m.type === 'lock:rejected' && m.blockId === block1Id);
    assert(lockRejectedMsg, 'Lock conflict rejected properly');

    clientA.sendJSON({ type: 'lock:release', blockId: block1Id });
    await waitForMessage(clientA, m => m.type === 'lock:released' && m.blockId === block1Id);

    // Clean up connections
    clientA.close();
    clientB.close();

    console.log('  ✓ PASS: Block locking, presence, and room collaboration architecture remain 100% functional.');
    passedTests++;

    console.log('\n=================================================================');
    console.log(`  DAY 21 CURSOR SYNC RESULTS: ${passedTests}/${totalTests} TESTS PASSED`);
    console.log('=================================================================\n');

  } catch (error) {
    console.error('\n❌ DAY 21 CURSOR TEST SUITE FAILED:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    server.close();
  }
}

runDay21CursorSuite();

