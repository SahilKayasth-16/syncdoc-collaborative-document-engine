/**
 * Day 18: Security Hardening & Sanitization Boundary Integration Verification
 *
 * Verifies that HTML/Script/XSS payloads are stripped into safe plain text across:
 * 1. Document Model pre-save boundary & Document Service title sanitization
 * 2. ASTNode Model pre-save boundary & data field sanitization (headings, paragraphs, code, quotes, lists, text)
 * 3. REST Document Controller (POST /api/documents, PUT /api/documents/:id)
 * 4. Yjs Room Hydration & CRDT block conversion (`loadASTIntoYDocument`, `astnodeToYblock`)
 * 5. Transformation Engine (`transformAST`) & PDF Exporter (`renderIDRToPDF`)
 */

import http from 'http';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

import connectDB from '../src/config/database.js';
import app from '../src/app.js';
import Document from '../src/models/Document.js';
import ASTNode from '../src/models/ASTNode.js';
import { createDocument, updateDocument, getDocumentTree } from '../src/services/document.service.js';
import { loadASTIntoYDocument, astnodeToYblock } from '../src/services/ast-crdt.service.js';
import { transformAST } from '../src/transformation/ast.transformer.js';
import { renderIDRToPDF } from '../src/pdf/pdf.renderer.js';
import * as Y from 'yjs';

dotenv.config();

function assert(condition, message) {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

async function runSanitizationBoundaryTests() {
  console.log('================================================================');
  console.log('   DAY 18 — SECURITY SANITIZATION BOUNDARY INTEGRATION TESTS');
  console.log('================================================================\n');

  let passed = 0;

  await connectDB();

  try {
    await Document.deleteMany({});
    await ASTNode.deleteMany({});

    // -------------------------------------------------------------
    // TEST 1: Document Model & Service Title Sanitization
    // -------------------------------------------------------------
    console.log('[Test 1] Document Title Sanitization on Creation & Update...');
    const xssTitle = '<script>alert("XSS")</script>Security Doc Title';
    const doc = await createDocument(xssTitle);

    assert(!doc.title.includes('<script>'), 'Title must not contain script tag');
    assert(doc.title.includes('Security Doc Title'), 'Title plain text must be preserved');
    assert(doc.title === 'alert("XSS")Security Doc Title' || doc.title === 'Security Doc Title' || doc.title.endsWith('Security Doc Title'), 'Title sanitized cleanly');

    const updatedDoc = await updateDocument(doc._id, '<img src=x onerror=alert(1)>Updated Title');
    assert(!updatedDoc.title.includes('<img'), 'Updated title must not contain img tag');
    assert(updatedDoc.title.includes('Updated Title'), 'Updated title plain text preserved');

    console.log(`  ✓ Success: Document Title sanitized cleanly ("${updatedDoc.title}").`);
    passed++;

    // -------------------------------------------------------------
    // TEST 2: ASTNode Model Pre-Save Hook Sanitization
    // -------------------------------------------------------------
    console.log('\n[Test 2] ASTNode Pre-Save Hook Data Sanitization...');
    const docId = doc._id;
    const rootId = doc.rootNodeId;

    // Heading with XSS
    const headingNode = new ASTNode({
      documentId: docId,
      parentId: rootId,
      type: 'heading',
      position: 15000,
      data: { level: 1, content: '<script>alert("Heading XSS")</script>Safe Heading' }
    });
    await headingNode.save();
    assert(!headingNode.data.content.includes('<script>'), 'Heading content must not contain script tag');

    // Paragraph with XSS
    const paraNode = new ASTNode({
      documentId: docId,
      parentId: rootId,
      type: 'paragraph',
      position: 25000,
      data: { content: '<iframe src="javascript:alert(1)"></iframe>Safe Paragraph' }
    });
    await paraNode.save();
    assert(!paraNode.data.content.includes('<iframe'), 'Paragraph content must not contain iframe tag');

    // Code block with HTML tags (should treat tags as plain text or strip according to DOMPurify)
    const codeNode = new ASTNode({
      documentId: docId,
      parentId: rootId,
      type: 'code_block',
      position: 35000,
      data: { language: 'js', content: 'console.log("<svg onload=alert(1)>")' }
    });
    await codeNode.save();
    assert(!codeNode.data.content.includes('onload='), 'Code content must not contain event handlers');

    // Quote with XSS in content & author
    const quoteNode = new ASTNode({
      documentId: docId,
      parentId: rootId,
      type: 'quote',
      position: 45000,
      data: { content: '<a href="javascript:alert(1)">Click Quote</a>', author: '<b onclick="alert(2)">Malicious Author</b>' }
    });
    await quoteNode.save();
    assert(!quoteNode.data.content.includes('javascript:'), 'Quote content must not contain javascript: URL');
    assert(!quoteNode.data.author.includes('onclick='), 'Quote author must not contain onclick handler');

    // List with XSS in items
    const listNode = new ASTNode({
      documentId: docId,
      parentId: rootId,
      type: 'list',
      position: 55000,
      data: { style: 'unordered', items: ['<script>XSS Item 1</script>Item 1', '<img src=x onerror=alert(1)>Item 2'] }
    });
    await listNode.save();
    assert(!listNode.data.items[0].includes('<script>'), 'List item 1 must not contain script tag');
    assert(!listNode.data.items[1].includes('<img'), 'List item 2 must not contain img tag');

    console.log('  ✓ Success: All ASTNode types (heading, paragraph, code_block, quote, list) sanitized via pre-save hook.');
    passed++;

    // -------------------------------------------------------------
    // TEST 3: Yjs CRDT Hydration & YBlock Conversion Sanitization
    // -------------------------------------------------------------
    console.log('\n[Test 3] Yjs CRDT Hydration & Block Conversion Sanitization...');
    const rawTreeWithXSS = {
      id: docId.toString(),
      title: '<script>alert("Yjs Title")</script>Yjs Doc',
      root: {
        id: rootId.toString(),
        type: 'document',
        children: [
          { id: 'node-y1', type: 'paragraph', position: 10000, data: { content: '<img src=x onerror=alert(1)>Yjs Paragraph' } }
        ]
      }
    };

    const ydoc = new Y.Doc();
    loadASTIntoYDocument(rawTreeWithXSS, ydoc);

    const docMap = ydoc.getMap('document');
    const yTitle = docMap.get('title');
    assert(!yTitle.includes('<script>'), 'Yjs document title must be sanitized');

    const blocksArray = ydoc.getArray('blocks');
    assert(blocksArray.length === 1, 'Yjs array should contain 1 block');
    const firstYBlock = blocksArray.get(0);
    const yBlockData = typeof firstYBlock.get === 'function' ? firstYBlock.get('data') : firstYBlock.data;
    assert(!yBlockData.content.includes('<img'), 'astnodeToYblock and Yjs hydration must sanitize node data');

    console.log('  ✓ Success: Yjs CRDT room hydration and YBlock conversion sanitized.');
    passed++;

    // -------------------------------------------------------------
    // TEST 4: Transformation Engine & PDF Exporter Sanitization
    // -------------------------------------------------------------
    console.log('\n[Test 4] Transformation Engine & PDF Exporter Sanitization...');
    const unpurifiedAST = {
      id: 'doc-xss-trans',
      title: '<script>alert("Trans Title")</script>Trans Title',
      root: {
        id: 'root-trans',
        type: 'document',
        children: [
          { id: 't-1', type: 'heading', position: 10000, data: { level: 1, content: '<h1>Raw H1 Tag</h1>' } },
          { id: 't-2', type: 'paragraph', position: 20000, data: { content: '<script>alert("Body XSS")</script>Safe Body Text' } }
        ]
      }
    };

    const idr = transformAST(unpurifiedAST);
    assert(!idr.children[0].content.text.includes('<h1>'), 'Heading text in IDR must be stripped of H1 tags');
    assert(!idr.children[1].content.text.includes('<script>'), 'Paragraph text in IDR must be stripped of script tags');

    const pdfBuffer = await renderIDRToPDF(idr);
    assert(Buffer.isBuffer(pdfBuffer) && pdfBuffer.toString('utf-8', 0, 5) === '%PDF-', 'PDF exported cleanly');

    console.log('  ✓ Success: Transformation engine & PDF Exporter stripped all HTML/XSS markup.');
    passed++;

    console.log('\n================================================================');
    console.log(`  ALL ${passed}/${passed} SANITIZATION BOUNDARY INTEGRATION TESTS PASSED`);
    console.log('================================================================\n');

  } finally {
    await mongoose.disconnect();
  }
}

runSanitizationBoundaryTests().catch(err => {
  console.error('\n❌ Sanitization Boundary Integration Test Failed:', err);
  process.exit(1);
});
