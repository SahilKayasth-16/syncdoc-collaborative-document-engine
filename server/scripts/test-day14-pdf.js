/**
 * Day 14: AST -> PDF Transformation Verification Tests
 *
 * Runs comprehensive automated verification for PDF rendering:
 * 1. Direct PDF Renderer Verification (Demo Document with Heading, Paragraph, Code Block, List, Quote)
 * 2. Express REST API Endpoint Verification (GET /api/documents/:id/export/pdf)
 * 3. Multi-page document overflow rendering
 * 4. Unsupported node fallback rendering
 * 5. Error handling (404 missing document, 400 invalid ID)
 */

import http from 'http';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectDB from '../src/config/database.js';
import app from '../src/app.js';
import Document from '../src/models/Document.js';
import ASTNode from '../src/models/ASTNode.js';
import { createDocument } from '../src/services/document.service.js';
import { transformAST } from '../src/transformation/ast.transformer.js';
import { renderIDRToPDF } from '../src/pdf/pdf.renderer.js';

dotenv.config();

function assert(condition, message) {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

// Helper to make HTTP request to express server
function makeHTTPRequest(serverPort, path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: '127.0.0.1',
      port: serverPort,
      path: path,
      method: 'GET'
    };

    const req = http.request(options, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const bodyBuffer = Buffer.concat(chunks);
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: bodyBuffer
        });
      });
    });

    req.on('error', err => reject(err));
    req.end();
  });
}

async function runPDFTests() {
  console.log('--- STARTING DAY 14 PDF EXPORT TESTS ---');
  let passedCount = 0;

  // 1. Establish Database Connection & Setup HTTP Server
  await connectDB();
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const serverPort = server.address().port;
  console.log(`Test Express Server listening on http://127.0.0.1:${serverPort}`);

  try {
    // ==========================================
    // TEST 1: Direct Renderer Test with Demo Document (5 Content Types)
    // ==========================================
    console.log('\n[Test 1] Testing PDF generation for standard 5-block Demo Document...');

    // Clean DB and seed demo document
    await Document.deleteMany({});
    await ASTNode.deleteMany({});

    const doc = await createDocument('SyncDoc Editor Demo');
    const docId = doc._id;
    const rootNodeId = doc.rootNodeId;

    const headingNode = new ASTNode({
      documentId: docId,
      parentId: rootNodeId,
      type: 'heading',
      position: 10000,
      data: { level: 1, content: 'SyncDoc Collaborative Editor' }
    });
    await headingNode.save();

    const paraNode = new ASTNode({
      documentId: docId,
      parentId: rootNodeId,
      type: 'paragraph',
      position: 20000,
      data: { content: 'This document is rendered from AST nodes and React block components.' }
    });
    await paraNode.save();

    const codeNode = new ASTNode({
      documentId: docId,
      parentId: rootNodeId,
      type: 'code_block',
      position: 30000,
      data: { language: 'javascript', content: "console.log('Hello from SyncDoc!');" }
    });
    await codeNode.save();

    const listNode = new ASTNode({
      documentId: docId,
      parentId: rootNodeId,
      type: 'list',
      position: 40000,
      data: {
        style: 'unordered',
        items: [
          'AST-based document structure',
          'React block rendering',
          'Collaborative editing',
          'Future real-time synchronization'
        ]
      }
    });
    await listNode.save();

    const quoteNode = new ASTNode({
      documentId: docId,
      parentId: rootNodeId,
      type: 'quote',
      position: 50000,
      data: {
        content: 'A document is a structured tree, not just a string.',
        author: 'SyncDoc'
      }
    });
    await quoteNode.save();

    // Fetch AST & Transform to IDR
    const rawAST = {
      id: docId.toString(),
      title: doc.title,
      root: {
        id: rootNodeId.toString(),
        type: 'document',
        position: 0,
        children: [
          { id: headingNode._id.toString(), type: 'heading', position: 10000, data: headingNode.data },
          { id: paraNode._id.toString(), type: 'paragraph', position: 20000, data: paraNode.data },
          { id: codeNode._id.toString(), type: 'code_block', position: 30000, data: codeNode.data },
          { id: listNode._id.toString(), type: 'list', position: 40000, data: listNode.data },
          { id: quoteNode._id.toString(), type: 'quote', position: 50000, data: quoteNode.data }
        ]
      }
    };

    const idrTree = transformAST(rawAST);
    assert(idrTree.children.length === 5, 'IDR must contain exactly 5 blocks');

    // Render IDR to PDF
    const pdfBuffer = await renderIDRToPDF(idrTree);
    assert(Buffer.isBuffer(pdfBuffer), 'Output must be a Buffer');
    assert(pdfBuffer.length > 500, `PDF size must be substantial, found ${pdfBuffer.length} bytes`);

    const pdfHeader = pdfBuffer.toString('utf-8', 0, 5);
    assert(pdfHeader === '%PDF-', `PDF signature missing or invalid: "${pdfHeader}"`);

    console.log('✓ Success: Demo document transformed & rendered to PDF Buffer cleanly.');
    console.log(`  PDF Buffer Size: ${pdfBuffer.length} bytes`);
    console.log(`  PDF Signature Header: ${pdfHeader}`);
    passedCount++;

    // ==========================================
    // TEST 2: HTTP Endpoint Verification (GET /api/documents/:id/export/pdf)
    // ==========================================
    console.log('\n[Test 2] Testing HTTP REST API Endpoint GET /api/documents/:id/export/pdf...');

    const resEndpoint = await makeHTTPRequest(serverPort, `/api/documents/${docId}/export/pdf`);

    assert(resEndpoint.statusCode === 200, `Expected 200 OK, got ${resEndpoint.statusCode}`);
    assert(
      resEndpoint.headers['content-type'] === 'application/pdf',
      `Expected Content-Type application/pdf, got ${resEndpoint.headers['content-type']}`
    );
    assert(
      resEndpoint.headers['content-disposition']?.includes(`filename="SyncDoc-${docId}.pdf"`),
      'Content-Disposition filename mismatch'
    );
    assert(resEndpoint.body.length > 500, 'HTTP response body length invalid');
    assert(
      resEndpoint.body.toString('utf-8', 0, 5) === '%PDF-',
      'HTTP response body lacks valid PDF signature'
    );

    console.log('✓ Success: HTTP GET /api/documents/:id/export/pdf endpoint verified.');
    passedCount++;

    // ==========================================
    // TEST 3: Multi-Page Overflow Document Test
    // ==========================================
    console.log('\n[Test 3] Testing multi-page overflow document rendering...');

    const largeChildren = [];
    for (let i = 1; i <= 80; i++) {
      largeChildren.push({
        id: `large-p-${i}`,
        type: 'paragraph',
        position: i * 1000,
        data: {
          content: `Section Block ${i}: SyncDoc document rendering engine stress test paragraph text overflow across multiple pages. Detailed content item #${i} to ensure natural page break flow across PDF pages without clipping or overlapping.`
        }
      });
    }

    const largeAST = {
      id: 'doc-large',
      title: 'Multi-Page Stress Document',
      root: {
        id: 'root-large',
        type: 'document',
        position: 0,
        children: largeChildren
      }
    };

    const largeIDR = transformAST(largeAST);
    const largePDFBuffer = await renderIDRToPDF(largeIDR);

    assert(Buffer.isBuffer(largePDFBuffer), 'Large PDF must be a buffer');
    assert(
      largePDFBuffer.length > pdfBuffer.length,
      `Multi-page PDF buffer should be larger than single-page PDF (large: ${largePDFBuffer.length}, single: ${pdfBuffer.length})`
    );
    assert(largePDFBuffer.toString('utf-8', 0, 5) === '%PDF-', 'Multi-page PDF header signature valid');

    console.log('✓ Success: Multi-page document overflow rendered safely without errors.');
    console.log(`  Multi-page PDF Buffer Size: ${largePDFBuffer.length} bytes`);
    passedCount++;

    // ==========================================
    // TEST 4: Unsupported Node Type Fallback
    // ==========================================
    console.log('\n[Test 4] Testing unsupported node fallback rendering...');

    const unsupportedAST = {
      id: 'doc-unsupported-pdf',
      title: 'Unsupported PDF Node Document',
      root: {
        id: 'root-unsupported-pdf',
        type: 'document',
        position: 0,
        children: [
          {
            id: 'unsupported-1',
            type: '3d_model_viewer',
            position: 10000,
            data: { modelUrl: 'https://syncdoc.io/model.glb' }
          }
        ]
      }
    };

    const unsupportedIDR = transformAST(unsupportedAST);
    const unsupportedPDFBuffer = await renderIDRToPDF(unsupportedIDR);

    assert(Buffer.isBuffer(unsupportedPDFBuffer), 'Unsupported PDF output must be a buffer');
    assert(unsupportedPDFBuffer.toString('utf-8', 0, 5) === '%PDF-', 'Unsupported PDF signature valid');

    console.log('✓ Success: Unsupported node fallback rendered safely.');
    passedCount++;

    // ==========================================
    // TEST 5: API Error Cases (404 and 400)
    // ==========================================
    console.log('\n[Test 5] Testing REST API error handling (404 and 400)...');

    const nonExistentDocId = new mongoose.Types.ObjectId().toString();
    const res404 = await makeHTTPRequest(serverPort, `/api/documents/${nonExistentDocId}/export/pdf`);
    assert(res404.statusCode === 404, `Expected 404 for missing document, got ${res404.statusCode}`);
    console.log('  ✓ Missing document returned 404 as expected');

    const res400 = await makeHTTPRequest(serverPort, '/api/documents/invalid-mongodb-id/export/pdf');
    assert(res400.statusCode === 400, `Expected 400 for invalid ObjectId, got ${res400.statusCode}`);
    console.log('  ✓ Invalid document ID returned 400 as expected');

    console.log('✓ Success: API error handling verified.');
    passedCount++;

    console.log('\n==========================================');
    console.log(`ALL DAY 14 PDF TESTS PASSED (${passedCount}/${passedCount})`);
    console.log('==========================================\n');
  } finally {
    server.close();
    await mongoose.disconnect();
  }
}

runPDFTests().catch(err => {
  console.error('\n❌ PDF Test Execution Failed:', err);
  process.exit(1);
});
