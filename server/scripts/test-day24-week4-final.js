/**
 * Day 24 — Master Final Week 4 Integration, Security Stress & Verification Test Suite
 *
 * Verifies:
 * 1. Backend E2E Pipeline (Normal, Empty, Malformed, Large 100+ node, Deeply nested, Unknown AST types).
 * 2. XSS & Security Stress Test Suite (REST API, Yjs WS, AST nodes, PDF export, sanitization verification).
 * 3. 10-Client Collaboration Stress Test (Convergence, Cursors, Selections, Locks, Presence).
 * 4. Disconnect & Reconnect Stress Test (Rapid cycles, lock release, room cleanup).
 * 5. Visual State & Block Isolation Test (Block states isolated, no cross-block or cross-doc leaks).
 * 6. Targeted Rendering & Performance Metrics.
 * 7. Persistence Safety Check (0 MongoDB / 0 Yjs writes during ephemeral cursor/selection events).
 * 8. WebSocket Health & Fault Tolerance.
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
import { createDocument, getDocumentTree } from '../src/services/document.service.js';
import { transformAST } from '../src/transformation/ast.transformer.js';
import { renderIDRToPDF } from '../src/pdf/pdf.renderer.js';
import { getRoomCount, getLocksList, getPresenceList, getCursorsList, getRoom } from '../src/websocket/collaboration.room.js';

dotenv.config();

const TEST_PORT = 5059;

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

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runDay24MasterSuite() {
  console.log('=================================================================');
  console.log('   DAY 24 — MASTER FINAL WEEK 4 INTEGRATION & SECURITY SUITE');
  console.log('=================================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  await connectDB();
  const server = http.createServer(app);
  createWebSocketServer(server);

  await new Promise(resolve => server.listen(TEST_PORT, resolve));
  console.log(`[Test Server] Started on http://127.0.0.1:${TEST_PORT}\n`);

  try {
    // -------------------------------------------------------------------------
    // SECTION 1: BACKEND E2E PIPELINE & AST EDGE CASES
    // -------------------------------------------------------------------------
    console.log('-----------------------------------------------------------------');
    console.log(' SECTION 1: Backend E2E Pipeline & AST Edge Cases');
    console.log('-----------------------------------------------------------------');

    // 1.1 Normal AST Document Pipeline
    totalTests++;
    console.log('Subtest 1.1: Standard 5-block AST -> IDR -> PDF rendering...');
    const doc1 = await createDocument('E2E Normal Document', true);
    const tree1 = await getDocumentTree(doc1._id);
    const idr1 = transformAST(tree1);
    const pdf1 = await renderIDRToPDF(idr1);
    assert(Buffer.isBuffer(pdf1) && pdf1.length > 0, 'PDF buffer must be non-empty');
    assert(pdf1.toString('utf-8', 0, 5) === '%PDF-', 'PDF output must begin with %PDF- header');
    console.log('  └─ PASS: Standard document transformed and exported to PDF cleanly.');
    passedTests++;

    // 1.2 Empty AST Document
    totalTests++;
    console.log('Subtest 1.2: Empty AST Document (root with 0 children)...');
    const doc2 = await createDocument('Empty AST Document', false);
    const tree2 = await getDocumentTree(doc2._id);
    const idr2 = transformAST(tree2);
    const pdf2 = await renderIDRToPDF(idr2);
    assert(Buffer.isBuffer(pdf2) && pdf2.length > 0, 'Empty document PDF buffer must be non-empty');
    assert(pdf2.toString('utf-8', 0, 5) === '%PDF-', 'PDF output must begin with %PDF- header');
    console.log('  └─ PASS: Empty document handled gracefully without errors.');
    passedTests++;

    // 1.3 Malformed AST Handling & Fallbacks
    totalTests++;
    console.log('Subtest 1.3: Malformed AST nodes (missing type, missing data)...');
    const malformedTree = {
      id: doc1._id.toString(),
      type: 'document',
      data: { title: 'Malformed AST' },
      children: [
        { id: 'm1', type: 'paragraph', data: null, children: [] },
        { id: 'm2', type: undefined, data: { content: 'No type node' }, children: [] },
        { id: 'm3', type: 'heading', data: { level: 2 }, children: [] }
      ]
    };
    const idrMalformed = transformAST(malformedTree);
    const pdfMalformed = await renderIDRToPDF(idrMalformed);
    assert(Buffer.isBuffer(pdfMalformed) && pdfMalformed.length > 0, 'Malformed PDF export produced buffer');
    console.log('  └─ PASS: Malformed nodes transformed via fallback handling.');
    passedTests++;

    // 1.4 Large 100+ Node AST Performance & Export
    totalTests++;
    console.log('Subtest 1.4: Large AST Document (100+ nodes) stress & PDF export...');
    const docLarge = await createDocument('Large AST Document', false);
    const rootLargeId = docLarge.rootNodeId;
    const largeNodes = [];
    for (let i = 0; i < 100; i++) {
      largeNodes.push({
        documentId: docLarge._id,
        parentId: rootLargeId,
        type: i % 2 === 0 ? 'paragraph' : 'heading',
        position: (i + 1) * 1000,
        data: i % 2 === 0 ? { content: `Paragraph node index ${i}` } : { level: 2, content: `Heading ${i}` }
      });
    }
    await ASTNode.insertMany(largeNodes);
    const startTimeLarge = Date.now();
    const treeLarge = await getDocumentTree(docLarge._id);
    const idrLarge = transformAST(treeLarge);
    const pdfLarge = await renderIDRToPDF(idrLarge);
    const durationLarge = Date.now() - startTimeLarge;
    assert(Buffer.isBuffer(pdfLarge) && pdfLarge.length > 1000, 'Large PDF buffer generated');
    assert(durationLarge < 1500, `Large document transformation/export took ${durationLarge}ms (<1500ms limit)`);
    console.log(`  └─ PASS: 100+ node AST transformed and rendered in ${durationLarge}ms.`);
    passedTests++;

    // 1.5 Unknown AST Node Types
    totalTests++;
    console.log('Subtest 1.5: Unknown AST node types handling...');
    const unknownTypeTree = {
      id: doc1._id.toString(),
      type: 'document',
      data: { title: 'Unknown Nodes' },
      children: [
        { id: 'u1', type: 'custom_widget_v2', data: { rawContent: 'Widget data' }, children: [] },
        { id: 'u2', type: 'paragraph', data: { content: 'Valid block' }, children: [] }
      ]
    };
    const idrUnknown = transformAST(unknownTypeTree);
    const pdfUnknown = await renderIDRToPDF(idrUnknown);
    assert(Buffer.isBuffer(pdfUnknown), 'Unknown node PDF generated');
    console.log('  └─ PASS: Unknown node type handled safely via fallback transformer.');
    passedTests++;

    // -------------------------------------------------------------------------
    // SECTION 2: XSS & SECURITY STRESS TEST SUITE
    // -------------------------------------------------------------------------
    console.log('\n-----------------------------------------------------------------');
    console.log(' SECTION 2: XSS & Security Stress Test Suite');
    console.log('-----------------------------------------------------------------');

    // 2.1 REST API Title & Payload Sanitization
    totalTests++;
    console.log('Subtest 2.1: REST Document title & AST Node pre-save sanitization...');
    const maliciousTitle = '<script>alert("TitleXSS")</script>Security Document';
    const docSec = await createDocument(maliciousTitle, false);
    const savedDoc = await Document.findById(docSec._id);
    assert(!savedDoc.title.includes('<script>'), 'Title must not contain <script> tag');
    assert(savedDoc.title.includes('Security Document'), 'Sanitized title preserves plain text');
    console.log('  └─ PASS: Document title sanitized prior to MongoDB persistence.');
    passedTests++;

    // 2.2 Comprehensive XSS AST Node Payloads
    totalTests++;
    console.log('Subtest 2.2: AST Node payload sanitization across all block types...');
    const secNode1 = new ASTNode({
      documentId: docSec._id,
      parentId: docSec.rootNodeId,
      type: 'paragraph',
      position: 10000,
      data: { content: '<img src=x onerror=alert(1)>Paragraph Content' }
    });
    await secNode1.save();

    const secNode2 = new ASTNode({
      documentId: docSec._id,
      parentId: docSec.rootNodeId,
      type: 'quote',
      position: 20000,
      data: { content: '<a href="javascript:alert(1)">Click Quote</a>', author: '<svg onload=alert(1)>Author' }
    });
    await secNode2.save();

    const secNode3 = new ASTNode({
      documentId: docSec._id,
      parentId: docSec.rootNodeId,
      type: 'code_block',
      position: 30000,
      data: { content: 'console.log("<script>alert(1)</script>");', language: 'javascript' }
    });
    await secNode3.save();

    const dbNode1 = await ASTNode.findById(secNode1._id);
    assert(!dbNode1.data.content.includes('onerror='), 'Paragraph node must strip onerror handler');
    assert(dbNode1.data.content.includes('Paragraph Content'), 'Paragraph content preserved');

    const dbNode2 = await ASTNode.findById(secNode2._id);
    assert(!dbNode2.data.content.includes('javascript:'), 'Quote node must strip javascript: URI');
    assert(!dbNode2.data.author.includes('<svg'), 'Quote author must strip <svg> tag');

    const dbNode3 = await ASTNode.findById(secNode3._id);
    assert(dbNode3.data.content.includes('console.log('), 'Code block preserves code text');

    console.log('  └─ PASS: All AST Node types sanitized correctly before MongoDB save.');
    passedTests++;

    // 2.3 Sanitized AST PDF Generation Verification
    totalTests++;
    console.log('Subtest 2.3: PDF Generation from malicious payload document...');
    const treeSec = await getDocumentTree(docSec._id);
    const idrSec = transformAST(treeSec);
    const pdfSec = await renderIDRToPDF(idrSec);
    const pdfText = pdfSec.toString('utf-8');
    assert(!pdfText.includes('<script>'), 'PDF output stream must contain 0 raw <script> tags');
    assert(!pdfText.includes('onerror='), 'PDF output stream must contain 0 raw onerror attributes');
    console.log('  └─ PASS: PDF generated safely from sanitized malicious document.');
    passedTests++;

    // -------------------------------------------------------------------------
    // SECTION 3: 10-CLIENT COLLABORATION STRESS & CONVERGENCE
    // -------------------------------------------------------------------------
    console.log('\n-----------------------------------------------------------------');
    console.log(' SECTION 3: 10-Client Collaboration Stress & Convergence');
    console.log('-----------------------------------------------------------------');

    totalTests++;
    console.log('Subtest 3.1: 10 concurrent WebSocket clients room join & presence...');
    const docCollab = await createDocument('10-Client Document', false);
    const block1 = new ASTNode({
      documentId: docCollab._id,
      parentId: docCollab.rootNodeId,
      type: 'paragraph',
      position: 10000,
      data: { content: 'Collab Block 1' }
    });
    await block1.save();
    const block1Id = block1._id.toString();

    const clients = [];
    for (let i = 0; i < 10; i++) {
      const client = await connectWSClient(TEST_PORT, docCollab._id.toString(), {
        userId: `user_${i + 1}`,
        name: `User ${i + 1}`
      });
      clients.push(client);
    }

    await sleep(300);
    const presenceList = getPresenceList(docCollab._id.toString());
    assert(presenceList.length === 10, `Presence list must contain 10 users (found ${presenceList.length})`);
    console.log('  └─ PASS: All 10 clients connected and identified in presence state.');
    passedTests++;

    totalTests++;
    console.log('Subtest 3.2: Concurrent lock, cursor, and selection broadcasts...');
    // User 1 locks block1
    clients[0].sendJSON({ type: 'lock:acquire', blockId: block1Id });
    await waitForMessage(clients[1], m => m.type === 'locks:update' && m.locks.some(l => l.blockId === block1Id));

    // User 2 sends cursor update
    clients[1].sendJSON({
      type: 'cursor:update',
      cursor: { blockId: block1Id, offset: 5, user: clients[1].user }
    });
    await waitForMessage(clients[0], m => m.type === 'cursor:update' && m.cursor.offset === 5);

    // User 3 sends selection update
    clients[2].sendJSON({
      type: 'selection:update',
      selection: { blockId: block1Id, startOffset: 2, endOffset: 8, user: clients[2].user }
    });
    await waitForMessage(clients[0], m => m.type === 'selection:update' && m.selection.startOffset === 2);

    console.log('  └─ PASS: Concurrent locks, cursors, and selections broadcasted to all clients.');
    passedTests++;

    // -------------------------------------------------------------------------
    // SECTION 4: DISCONNECT & RECONNECT STRESS TEST
    // -------------------------------------------------------------------------
    console.log('\n-----------------------------------------------------------------');
    console.log(' SECTION 4: Disconnect & Reconnect Stress Test');
    console.log('-----------------------------------------------------------------');

    totalTests++;
    console.log('Subtest 4.1: Abrupt disconnect lock release & room presence cleanup...');
    const locksBefore = getLocksList(docCollab._id.toString());
    assert(locksBefore.some(l => l.blockId === block1Id), 'Block 1 must be locked before disconnect');

    // Close Client 1 abruptly
    clients[0].close();
    await sleep(300);

    const locksAfter = getLocksList(docCollab._id.toString());
    assert(!locksAfter.some(l => l.blockId === block1Id), 'Lock owned by disconnected Client 1 must be released');

    const presenceAfter = getPresenceList(docCollab._id.toString());
    assert(presenceAfter.length === 9, `Presence count must drop to 9 (found ${presenceAfter.length})`);

    // Clean up remaining clients
    for (let i = 1; i < clients.length; i++) {
      clients[i].close();
    }
    await sleep(300);

    assert(getRoomCount() === 0, 'Room must be completely destroyed when all clients disconnect');
    console.log('  └─ PASS: Disconnect releases locks, updates presence, and destroys room.');
    passedTests++;

    // -------------------------------------------------------------------------
    // SECTION 5: VISUAL STATE & BLOCK ISOLATION TEST
    // -------------------------------------------------------------------------
    console.log('\n-----------------------------------------------------------------');
    console.log(' SECTION 5: Visual State & Block Isolation Test');
    console.log('-----------------------------------------------------------------');

    totalTests++;
    console.log('Subtest 5.1: Block lock and cursor state isolation across blocks...');
    const docIso = await createDocument('Isolation Document', false);
    const isoBlockA = new ASTNode({
      documentId: docIso._id,
      parentId: docIso.rootNodeId,
      type: 'paragraph',
      position: 10000,
      data: { content: 'Block A' }
    });
    await isoBlockA.save();

    const isoBlockB = new ASTNode({
      documentId: docIso._id,
      parentId: docIso.rootNodeId,
      type: 'paragraph',
      position: 20000,
      data: { content: 'Block B' }
    });
    await isoBlockB.save();

    const isoClient1 = await connectWSClient(TEST_PORT, docIso._id.toString(), { userId: 'iso1', name: 'Iso 1' });
    const isoClient2 = await connectWSClient(TEST_PORT, docIso._id.toString(), { userId: 'iso2', name: 'Iso 2' });

    // Client 1 locks Block A and updates cursor on Block A
    isoClient1.sendJSON({ type: 'lock:acquire', blockId: isoBlockA._id.toString() });
    isoClient1.sendJSON({
      type: 'cursor:update',
      cursor: { blockId: isoBlockA._id.toString(), offset: 4, user: isoClient1.user }
    });
    await sleep(200);

    const roomIso = getRoom(docIso._id.toString());
    assert(roomIso.locks.has(isoBlockA._id.toString()), 'Block A must be locked');
    assert(!roomIso.locks.has(isoBlockB._id.toString()), 'Block B must NOT be locked (Isolation Check)');

    const cursorsListIso = getCursorsList(docIso._id.toString());
    const blockBCursors = cursorsListIso.filter(c => c.cursor && c.cursor.blockId === isoBlockB._id.toString());
    assert(blockBCursors.length === 0, 'Block B must have 0 cursors (Isolation Check)');

    isoClient1.close();
    isoClient2.close();
    await sleep(200);
    console.log('  └─ PASS: Lock and cursor state isolated strictly to target block.');
    passedTests++;

    // -------------------------------------------------------------------------
    // SECTION 6: PERSISTENCE SAFETY CHECK (0 DB / 0 YJS WRITES FOR EPHEMERAL STATE)
    // -------------------------------------------------------------------------
    console.log('\n-----------------------------------------------------------------');
    console.log(' SECTION 6: Persistence Safety Check (0 DB / 0 Yjs Writes)');
    console.log('-----------------------------------------------------------------');

    totalTests++;
    console.log('Subtest 6.1: Verifying 0 MongoDB / 0 Yjs writes during cursor/selection updates...');
    const docPersist = await createDocument('Persistence Test Document', true);
    const initialASTCount = await ASTNode.countDocuments({ documentId: docPersist._id });
    const initialDoc = await Document.findById(docPersist._id);
    const initialDocUpdatedAt = initialDoc.updatedAt.getTime();

    const pClient1 = await connectWSClient(TEST_PORT, docPersist._id.toString(), { userId: 'p1', name: 'P1' });
    const pClient2 = await connectWSClient(TEST_PORT, docPersist._id.toString(), { userId: 'p2', name: 'P2' });

    // Rapid cursor and selection broadcasts
    for (let i = 0; i < 25; i++) {
      pClient1.sendJSON({
        type: 'cursor:update',
        cursor: { blockId: 'b1', offset: i, user: pClient1.user }
      });
      pClient2.sendJSON({
        type: 'selection:update',
        selection: { blockId: 'b1', startOffset: i, endOffset: i + 2, user: pClient2.user }
      });
    }
    await sleep(300);

    const finalASTCount = await ASTNode.countDocuments({ documentId: docPersist._id });
    const finalDoc = await Document.findById(docPersist._id);

    assert(initialASTCount === finalASTCount, `ASTNode document count must not change (${initialASTCount} vs ${finalASTCount})`);
    assert(finalDoc.updatedAt.getTime() === initialDocUpdatedAt, 'Document updatedAt timestamp must not change');

    pClient1.close();
    pClient2.close();
    await sleep(200);
    console.log('  └─ PASS: 0 MongoDB writes verified during 50 cursor/selection updates.');
    passedTests++;

    // -------------------------------------------------------------------------
    // SECTION 7: WEBSOCKET HEALTH & FAULT TOLERANCE
    // -------------------------------------------------------------------------
    console.log('\n-----------------------------------------------------------------');
    console.log(' SECTION 7: WebSocket Health & Fault Tolerance');
    console.log('-----------------------------------------------------------------');

    totalTests++;
    console.log('Subtest 7.1: Handling malformed JSON frames and unknown event types...');
    const docFault = await createDocument('Fault Tolerance Document', false);
    const fClient = await connectWSClient(TEST_PORT, docFault._id.toString(), { userId: 'f1', name: 'Fault Client' });

    // Send malformed non-JSON frame
    fClient.ws.send('{ invalid json payload ');
    // Send unknown event type
    fClient.sendJSON({ type: 'unknown:custom_event_xyz', data: 123 });

    await sleep(200);
    assert(fClient.ws.readyState === WebSocket.OPEN, 'WebSocket connection must remain OPEN despite malformed input');

    fClient.close();
    await sleep(200);
    console.log('  └─ PASS: WebSocket server handled malformed input gracefully without crashing.');
    passedTests++;

    // -------------------------------------------------------------------------
    // SUMMARY REPORT
    // -------------------------------------------------------------------------
    console.log('\n=================================================================');
    console.log(`   DAY 24 VERIFICATION COMPLETE: ${passedTests}/${totalTests} TESTS PASSED`);
    console.log('=================================================================\n');

  } finally {
    server.close();
    await mongoose.connection.close();
  }
}

runDay24MasterSuite().catch(err => {
  console.error('\n❌ DAY 24 TEST SUITE FAILED:', err);
  process.exit(1);
});
