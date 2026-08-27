/**
 * Day 15: PDF Reliability & Edge-Case Validation Test Suite
 *
 * Tests AST transformation and PDF rendering against 10 specific edge cases:
 * 1. Empty document
 * 2. Missing node data
 * 3. Empty paragraph
 * 4. Very long paragraph
 * 5. Very long code block
 * 6. Nested AST nodes
 * 7. Multiple lists
 * 8. Multiple quotes
 * 9. Unknown node type
 * 10. Malformed AST node
 *
 * Verifies that the server does not crash and produces valid PDF buffers or controlled responses.
 */

import http from 'http';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectDB from '../src/config/database.js';
import app from '../src/app.js';
import Document from '../src/models/Document.js';
import ASTNode from '../src/models/ASTNode.js';
import { transformAST } from '../src/transformation/ast.transformer.js';
import { countASTNodes } from '../src/transformation/transformation.utils.js';
import { renderIDRToPDF } from '../src/pdf/pdf.renderer.js';

dotenv.config();

function assert(condition, message) {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

async function runEdgeCaseTests() {
  console.log('==================================================');
  console.log('  DAY 15 — PDF RELIABILITY & EDGE-CASE TESTS');
  console.log('==================================================\n');

  let passedCount = 0;

  // Setup DB & Server
  await connectDB();
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const serverPort = server.address().port;

  try {
    // --------------------------------------------------
    // EDGE CASE 1: Empty document
    // --------------------------------------------------
    console.log('[Edge Case 1] Empty Document (0 children)...');
    const emptyAST = {
      id: 'doc-empty',
      title: 'Empty Test Document',
      root: {
        id: 'root-empty',
        type: 'document',
        children: []
      }
    };
    const emptyIDR = transformAST(emptyAST);
    assert(emptyIDR.type === 'document', 'Root must be document');
    assert(emptyIDR.children.length === 0, 'Children array must be empty');
    assert(countASTNodes(emptyIDR) === 0, 'AST node count must be 0 for empty doc');

    const emptyPDF = await renderIDRToPDF(emptyIDR);
    assert(Buffer.isBuffer(emptyPDF), 'PDF output must be a buffer');
    assert(emptyPDF.toString('utf-8', 0, 5) === '%PDF-', 'PDF signature valid');
    console.log('  ✓ Success: Empty document transformed & rendered without crash.');
    passedCount++;

    // --------------------------------------------------
    // EDGE CASE 2: Missing node data
    // --------------------------------------------------
    console.log('\n[Edge Case 2] Missing node data object...');
    const missingDataAST = {
      id: 'doc-missing-data',
      title: 'Missing Data Document',
      root: {
        id: 'root-missing-data',
        type: 'document',
        children: [
          { id: 'node-no-data', type: 'paragraph' }, // No data property
          { id: 'node-null-data', type: 'heading', data: null } // Explicit null data
        ]
      }
    };
    const missingDataIDR = transformAST(missingDataAST);
    assert(missingDataIDR.children.length === 2, 'Should transform both nodes safely');
    assert(missingDataIDR.children[0].content.text === '', 'Missing data should yield empty string content');

    const missingDataPDF = await renderIDRToPDF(missingDataIDR);
    assert(Buffer.isBuffer(missingDataPDF), 'PDF output valid');
    console.log('  ✓ Success: Nodes with missing/null data handled safely.');
    passedCount++;

    // --------------------------------------------------
    // EDGE CASE 3: Empty paragraph
    // --------------------------------------------------
    console.log('\n[Edge Case 3] Empty paragraph...');
    const emptyParaAST = {
      id: 'doc-empty-para',
      title: 'Empty Paragraph Document',
      root: {
        id: 'root-empty-para',
        type: 'document',
        children: [
          { id: 'p-empty-1', type: 'paragraph', data: { content: '' } },
          { id: 'p-empty-2', type: 'paragraph', data: {} }
        ]
      }
    };
    const emptyParaIDR = transformAST(emptyParaAST);
    assert(emptyParaIDR.children.length === 2, 'Transformed 2 empty paragraphs');
    const emptyParaPDF = await renderIDRToPDF(emptyParaIDR);
    assert(Buffer.isBuffer(emptyParaPDF), 'Empty paragraph PDF buffer valid');
    console.log('  ✓ Success: Empty paragraphs rendered safely.');
    passedCount++;

    // --------------------------------------------------
    // EDGE CASE 4: Very long paragraph
    // --------------------------------------------------
    console.log('\n[Edge Case 4] Very long paragraph (25,000 chars)...');
    const longText = 'SyncDoc collaborative real-time document engine. '.repeat(500); // ~25k chars
    const longParaAST = {
      id: 'doc-long-para',
      title: 'Very Long Paragraph Document',
      root: {
        id: 'root-long-para',
        type: 'document',
        children: [
          { id: 'p-long', type: 'paragraph', data: { content: longText } }
        ]
      }
    };
    const longParaIDR = transformAST(longParaAST);
    const longParaPDF = await renderIDRToPDF(longParaIDR);
    assert(Buffer.isBuffer(longParaPDF), 'Long paragraph PDF buffer valid');
    assert(longParaPDF.length > 2000, 'Long paragraph PDF should have significant size');
    console.log(`  ✓ Success: Very long paragraph rendered safely (${longParaPDF.length} bytes).`);
    passedCount++;

    // --------------------------------------------------
    // EDGE CASE 5: Very long code block
    // --------------------------------------------------
    console.log('\n[Edge Case 5] Very long code block (300 lines)...');
    const codeLines = [];
    for (let i = 1; i <= 300; i++) {
      codeLines.push(`function executeStep${i}() { console.log("Executing workflow step ${i} in SyncDoc PDF Engine"); return true; }`);
    }
    const longCodeText = codeLines.join('\n');
    const longCodeAST = {
      id: 'doc-long-code',
      title: 'Very Long Code Block Document',
      root: {
        id: 'root-long-code',
        type: 'document',
        children: [
          { id: 'code-long', type: 'code_block', data: { language: 'javascript', content: longCodeText } }
        ]
      }
    };
    const longCodeIDR = transformAST(longCodeAST);
    const longCodePDF = await renderIDRToPDF(longCodeIDR);
    assert(Buffer.isBuffer(longCodePDF), 'Long code block PDF buffer valid');
    console.log(`  ✓ Success: 300-line code block rendered safely (${longCodePDF.length} bytes).`);
    passedCount++;

    // --------------------------------------------------
    // EDGE CASE 6: Nested AST nodes
    // --------------------------------------------------
    console.log('\n[Edge Case 6] Nested AST nodes (Hierarchy preservation)...');
    const nestedAST = {
      id: 'doc-nested',
      title: 'Nested AST Document',
      root: {
        id: 'root-nested',
        type: 'document',
        children: [
          {
            id: 'sec-1',
            type: 'section',
            data: { title: 'Parent Section 1' },
            children: [
              { id: 'h-1', type: 'heading', data: { level: 2, content: 'Subsection Heading' } },
              { id: 'p-1', type: 'paragraph', data: { content: 'Paragraph inside Section 1' } },
              {
                id: 'sec-2',
                type: 'section',
                data: { title: 'Child Section 1.1' },
                children: [
                  { id: 'q-1', type: 'quote', data: { content: 'Deeply nested quote', author: 'Nested Author' } }
                ]
              }
            ]
          }
        ]
      }
    };
    const nestedIDR = transformAST(nestedAST);
    assert(nestedIDR.children.length === 1, 'Top level has 1 section');
    assert(nestedIDR.children[0].type === 'section', 'First child is section');
    assert(nestedIDR.children[0].children.length === 3, 'Section contains 3 children');
    assert(nestedIDR.children[0].children[2].children[0].type === 'quote', 'Preserved deeply nested quote');

    const totalNodesInput = countASTNodes(nestedAST.root);
    const totalNodesIDR = countASTNodes(nestedIDR);
    assert(totalNodesInput === totalNodesIDR, `Node count must match: input ${totalNodesInput} vs IDR ${totalNodesIDR}`);

    const nestedPDF = await renderIDRToPDF(nestedIDR);
    assert(Buffer.isBuffer(nestedPDF), 'Nested PDF valid');
    console.log(`  ✓ Success: Nested AST structure preserved & rendered (total nodes: ${totalNodesIDR}).`);
    passedCount++;

    // --------------------------------------------------
    // EDGE CASE 7: Multiple lists
    // --------------------------------------------------
    console.log('\n[Edge Case 7] Multiple lists (Ordered & Unordered)...');
    const multiListAST = {
      id: 'doc-multi-list',
      title: 'Multiple Lists Document',
      root: {
        id: 'root-multi-list',
        type: 'document',
        children: [
          { id: 'list-1', type: 'list', data: { style: 'unordered', items: ['Alpha', 'Beta', 'Gamma'] } },
          { id: 'list-2', type: 'list', data: { style: 'ordered', items: ['First step', 'Second step', 'Third step'] } },
          { id: 'list-3', type: 'list', data: { style: 'unordered', items: ['Delta', 'Epsilon'] } }
        ]
      }
    };
    const multiListIDR = transformAST(multiListAST);
    assert(multiListIDR.children.length === 3, '3 list blocks transformed');
    const multiListPDF = await renderIDRToPDF(multiListIDR);
    assert(Buffer.isBuffer(multiListPDF), 'Multiple lists PDF valid');
    console.log('  ✓ Success: Multiple lists rendered clean.');
    passedCount++;

    // --------------------------------------------------
    // EDGE CASE 8: Multiple quotes
    // --------------------------------------------------
    console.log('\n[Edge Case 8] Multiple quotes...');
    const multiQuoteAST = {
      id: 'doc-multi-quote',
      title: 'Multiple Quotes Document',
      root: {
        id: 'root-multi-quote',
        type: 'document',
        children: [
          { id: 'q-1', type: 'quote', data: { content: 'Quote without author' } },
          { id: 'q-2', type: 'quote', data: { content: 'Quote with author', author: 'Famous Developer' } },
          { id: 'q-3', type: 'quote', data: { content: 'Another quote', author: 'SyncDoc Team' } }
        ]
      }
    };
    const multiQuoteIDR = transformAST(multiQuoteAST);
    assert(multiQuoteIDR.children.length === 3, '3 quote blocks transformed');
    const multiQuotePDF = await renderIDRToPDF(multiQuoteIDR);
    assert(Buffer.isBuffer(multiQuotePDF), 'Multiple quotes PDF valid');
    console.log('  ✓ Success: Multiple quotes rendered cleanly.');
    passedCount++;

    // --------------------------------------------------
    // EDGE CASE 9: Unknown node type
    // --------------------------------------------------
    console.log('\n[Edge Case 9] Unknown node type...');
    const unknownNodeAST = {
      id: 'doc-unknown',
      title: 'Unknown Node Document',
      root: {
        id: 'root-unknown',
        type: 'document',
        children: [
          { id: 'u-1', type: 'interactive_canvas_3d', data: { scene: 'cube' } }
        ]
      }
    };
    const unknownIDR = transformAST(unknownNodeAST);
    assert(unknownIDR.children[0].type === 'unsupported', 'Unknown node type transformed to unsupported');
    assert(unknownIDR.children[0].originalType === 'interactive_canvas_3d', 'Preserved original type');

    const unknownPDF = await renderIDRToPDF(unknownIDR);
    assert(Buffer.isBuffer(unknownPDF), 'Unknown node fallback PDF valid');
    console.log('  ✓ Success: Unknown node type handled with graceful fallback indicator.');
    passedCount++;

    // --------------------------------------------------
    // EDGE CASE 10: Malformed AST node
    // --------------------------------------------------
    console.log('\n[Edge Case 10] Malformed AST nodes...');
    const malformedAST = {
      id: 'doc-malformed',
      title: 'Malformed Document',
      root: {
        id: 'root-malformed',
        type: 'document',
        children: [
          { id: 'm-1', type: 'paragraph', position: 'invalid-pos-string', data: { content: 'Valid content bad position' } },
          { id: 'm-2', type: 'list', data: { items: 'not-an-array' } }, // items should be array
          { id: 'm-3', type: null, data: { text: 'Missing type field' } }, // missing type string
          null, // null child in array
          'primitive-string-child', // primitive string child in array
          { id: 'm-4', type: 'heading', data: { level: 'invalid-level', content: 'Bad level heading' } }
        ]
      }
    };

    const malformedIDR = transformAST(malformedAST);
    // null and string child should be skipped, remaining 4 valid objects transformed
    assert(malformedIDR.children.length === 4, `Expected 4 transformed nodes, got ${malformedIDR.children.length}`);
    assert(malformedIDR.children[0].position === 0, 'Invalid position string fallback to 0');
    assert(malformedIDR.children[1].content.items.length === 0, 'Non-array items fallback to empty array');

    const malformedPDF = await renderIDRToPDF(malformedIDR);
    assert(Buffer.isBuffer(malformedPDF), 'Malformed document PDF rendered cleanly');
    console.log('  ✓ Success: Malformed AST nodes safely sanitized without server crash.');
    passedCount++;

    console.log('\n==================================================');
    console.log(`  ALL 10 EDGE-CASE PDF TESTS PASSED (${passedCount}/${passedCount})`);
    console.log('==================================================\n');

  } finally {
    server.close();
    await mongoose.disconnect();
  }
}

runEdgeCaseTests().catch(err => {
  console.error('\n❌ Day 15 Edge-Case Tests Failed:', err);
  process.exit(1);
});
