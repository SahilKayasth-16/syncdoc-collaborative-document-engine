/**
 * Day 13: Backend Transformation Engine Verification Tests
 *
 * Runs comprehensive automated verification for AST -> IDR transformation:
 * 1. Standard Document (5 AST blocks: heading, paragraph, code_block, list, quote)
 * 2. Nested AST Document Structure (recursive traversal)
 * 3. Malformed AST and Edge Case Handling (null root, missing data, unsupported node, duplicate refs, immutability)
 */

import { transformAST } from '../src/transformation/ast.transformer.js';
import { validateASTInput } from '../src/transformation/transformation.utils.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

async function runTransformationTests() {
  console.log('--- STARTING DAY 13 TRANSFORMATION ENGINE TESTS ---');

  let passedCount = 0;

  // ==========================================
  // TEST 1: Standard Document with 5 AST Blocks
  // ==========================================
  console.log('\n[Test 1] Testing standard document with 5 AST blocks...');

  const originalAST5Blocks = {
    id: 'doc-1001',
    title: 'SyncDoc Architecture Overview',
    root: {
      id: 'node-root-1',
      type: 'document',
      position: 0,
      data: { author: 'SyncDoc' },
      children: [
        {
          id: 'node-head-1',
          type: 'heading',
          position: 10000,
          data: {
            level: 1,
            content: 'Introduction to SyncDoc Engine',
            customAttr: 'header-style-bold'
          },
          children: []
        },
        {
          id: 'node-para-1',
          type: 'paragraph',
          position: 20000,
          data: {
            content: 'SyncDoc is a real-time collaborative document engine.'
          },
          children: []
        },
        {
          id: 'node-code-1',
          type: 'code_block',
          position: 30000,
          data: {
            language: 'javascript',
            content: "console.log('Hello SyncDoc Backend Transformer!');"
          },
          children: []
        },
        {
          id: 'node-list-1',
          type: 'list',
          position: 40000,
          data: {
            style: 'unordered',
            items: ['AST Architecture', 'CRDT Collaboration', 'PDF Transformation']
          },
          children: []
        },
        {
          id: 'node-quote-1',
          type: 'quote',
          position: 50000,
          data: {
            content: 'A document is a structured tree, not just a string.',
            author: 'SyncDoc Architecture'
          },
          children: []
        }
      ]
    }
  };

  // Deep clone to test immutability later
  const astBackup = JSON.parse(JSON.stringify(originalAST5Blocks));

  const idrResult = transformAST(originalAST5Blocks);

  // Assertions for Test 1
  assert(idrResult.type === 'document', 'Root type must be "document"');
  assert(idrResult.title === 'SyncDoc Architecture Overview', 'Document title must be preserved');
  assert(idrResult.id === 'doc-1001', 'Document ID must be preserved');
  assert(Array.isArray(idrResult.children), 'Root children must be an array');
  assert(
    idrResult.children.length === 5,
    `Expected exactly 5 transformed child blocks, found ${idrResult.children.length}`
  );

  // Verify node ordering and individual block properties
  const [b1, b2, b3, b4, b5] = idrResult.children;

  // Heading Block
  assert(b1.id === 'node-head-1', 'Block 1 ID mismatch');
  assert(b1.type === 'heading', 'Block 1 type mismatch');
  assert(b1.position === 10000, 'Block 1 position mismatch');
  assert(b1.content.text === 'Introduction to SyncDoc Engine', 'Block 1 text mismatch');
  assert(b1.content.level === 1, 'Block 1 level mismatch');
  assert(b1.metadata.customAttr === 'header-style-bold', 'Block 1 metadata mismatch');

  // Paragraph Block
  assert(b2.id === 'node-para-1', 'Block 2 ID mismatch');
  assert(b2.type === 'paragraph', 'Block 2 type mismatch');
  assert(b2.position === 20000, 'Block 2 position mismatch');
  assert(b2.content.text === 'SyncDoc is a real-time collaborative document engine.', 'Block 2 text mismatch');

  // Code Block
  assert(b3.id === 'node-code-1', 'Block 3 ID mismatch');
  assert(b3.type === 'code_block', 'Block 3 type mismatch');
  assert(b3.position === 30000, 'Block 3 position mismatch');
  assert(b3.content.language === 'javascript', 'Block 3 language mismatch');
  assert(b3.content.text === "console.log('Hello SyncDoc Backend Transformer!');", 'Block 3 code content mismatch');

  // List Block
  assert(b4.id === 'node-list-1', 'Block 4 ID mismatch');
  assert(b4.type === 'list', 'Block 4 type mismatch');
  assert(b4.position === 40000, 'Block 4 position mismatch');
  assert(b4.content.style === 'unordered', 'Block 4 style mismatch');
  assert(b4.content.items.length === 3, 'Block 4 items length mismatch');
  assert(b4.content.items[0] === 'AST Architecture', 'Block 4 item content mismatch');

  // Quote Block
  assert(b5.id === 'node-quote-1', 'Block 5 ID mismatch');
  assert(b5.type === 'quote', 'Block 5 type mismatch');
  assert(b5.position === 50000, 'Block 5 position mismatch');
  assert(b5.content.text === 'A document is a structured tree, not just a string.', 'Block 5 text mismatch');
  assert(b5.content.author === 'SyncDoc Architecture', 'Block 5 author mismatch');

  // Immutability Verification
  assert(
    JSON.stringify(originalAST5Blocks) === JSON.stringify(astBackup),
    'Original AST tree was mutated during transformation!'
  );

  console.log('✓ Success: 5 AST blocks -> exactly 5 IDR blocks verified cleanly.');
  passedCount++;

  // ==========================================
  // TEST 2: Nested AST Structure Transformation
  // ==========================================
  console.log('\n[Test 2] Testing nested AST document structure...');

  const nestedAST = {
    id: 'doc-2002',
    title: 'Nested Document Specification',
    root: {
      id: 'root-nested',
      type: 'document',
      position: 0,
      children: [
        {
          id: 'head-top',
          type: 'heading',
          position: 10000,
          data: { level: 1, content: 'Main Title' },
          children: []
        },
        {
          id: 'sec-1',
          type: 'section',
          position: 20000,
          data: { title: 'Deep Core Section' },
          children: [
            {
              id: 'para-nested',
              type: 'paragraph',
              position: 10000,
              data: { content: 'Paragraph inside Section 1' },
              children: []
            },
            {
              id: 'quote-nested',
              type: 'quote',
              position: 20000,
              data: { content: 'Quote inside Section 1', author: 'Nested Author' },
              children: []
            }
          ]
        }
      ]
    }
  };

  const nestedIDR = transformAST(nestedAST);

  assert(nestedIDR.children.length === 2, 'Root nested IDR should have 2 children');
  assert(nestedIDR.children[0].type === 'heading', 'First child must be heading');
  assert(nestedIDR.children[1].type === 'section', 'Second child must be section');
  assert(nestedIDR.children[1].content.title === 'Deep Core Section', 'Section title mismatch');

  const sectionChildren = nestedIDR.children[1].children;
  assert(sectionChildren.length === 2, 'Section should contain 2 nested children');
  assert(sectionChildren[0].type === 'paragraph', 'Nested child 1 must be paragraph');
  assert(sectionChildren[0].content.text === 'Paragraph inside Section 1', 'Nested paragraph text mismatch');
  assert(sectionChildren[1].type === 'quote', 'Nested child 2 must be quote');
  assert(sectionChildren[1].content.author === 'Nested Author', 'Nested quote author mismatch');

  console.log('✓ Success: Nested AST tree recursively transformed with full hierarchy integrity.');
  passedCount++;

  // ==========================================
  // TEST 3: Edge Cases and Defensive Validation
  // ==========================================
  console.log('\n[Test 3] Testing malformed AST inputs and edge cases...');

  // 3a. Null / Undefined Root Input
  try {
    transformAST(null);
    assert(false, 'Should have thrown error on null root');
  } catch (err) {
    assert(err.message.includes('non-null object'), 'Expected non-null object error message');
    console.log('  ✓ Null root input rejected safely');
  }

  // 3b. Missing Node Data
  const missingDataAST = {
    id: 'doc-3001',
    title: 'Missing Data Test',
    root: {
      id: 'root-no-data',
      type: 'document',
      position: 0,
      children: [
        {
          id: 'para-no-data',
          type: 'paragraph',
          position: 10000
          // data field is missing completely
        }
      ]
    }
  };
  const missingDataIDR = transformAST(missingDataAST);
  assert(missingDataIDR.children[0].content.text === '', 'Missing data should default content text to empty string');
  console.log('  ✓ Missing node data handled safely');

  // 3c. Malformed Children Array
  const malformedChildrenAST = {
    id: 'doc-3002',
    title: 'Malformed Children Test',
    root: {
      id: 'root-bad-children',
      type: 'document',
      position: 0,
      children: [
        null,
        {
          id: 'valid-para',
          type: 'paragraph',
          position: 20000,
          data: { content: 'Valid block' }
        },
        undefined,
        'invalid_string_child'
      ]
    }
  };
  const malformedChildrenIDR = transformAST(malformedChildrenAST);
  assert(malformedChildrenIDR.children.length === 1, 'Malformed child elements should be safely skipped');
  assert(malformedChildrenIDR.children[0].id === 'valid-para', 'Valid block preserved');
  console.log('  ✓ Malformed child nodes skipped safely');

  // 3d. Unsupported Node Type
  const unsupportedTypeAST = {
    id: 'doc-3003',
    title: 'Unsupported Type Test',
    root: {
      id: 'root-unsupported',
      type: 'document',
      position: 0,
      children: [
        {
          id: 'future-node-1',
          type: 'interactive_chart',
          position: 10000,
          data: { chartType: 'bar', datasetId: 'ds-99' }
        }
      ]
    }
  };
  const unsupportedIDR = transformAST(unsupportedTypeAST);
  assert(unsupportedIDR.children.length === 1, 'Unsupported node should be included');
  assert(unsupportedIDR.children[0].type === 'unsupported', 'Type should be converted to "unsupported"');
  assert(unsupportedIDR.children[0].originalType === 'interactive_chart', 'Original type preserved');
  assert(unsupportedIDR.children[0].content.rawData.chartType === 'bar', 'Raw data preserved');
  console.log('  ✓ Unsupported node type handled safely without throwing');

  // 3e. Duplicate Input Node References
  const duplicateNodeRef = {
    id: 'dup-node-1',
    type: 'paragraph',
    position: 10000,
    data: { content: 'Original Paragraph' }
  };
  const duplicateAST = {
    id: 'doc-3004',
    title: 'Duplicate References Test',
    root: {
      id: 'root-dup',
      type: 'document',
      position: 0,
      children: [duplicateNodeRef, duplicateNodeRef] // Exact same node reference twice
    }
  };
  const duplicateIDR = transformAST(duplicateAST);
  assert(
    duplicateIDR.children.length === 1,
    `Duplicate node references should produce 1 output node, found ${duplicateIDR.children.length}`
  );
  console.log('  ✓ Duplicate input references prevented from creating duplicate output nodes');

  // 3f. Empty Document
  const emptyAST = {
    id: 'doc-3005',
    title: 'Empty Document Test',
    root: {
      id: 'root-empty',
      type: 'document',
      position: 0,
      children: []
    }
  };
  const emptyIDR = transformAST(emptyAST);
  assert(emptyIDR.children.length === 0, 'Empty document should produce empty children array');
  console.log('  ✓ Empty document transformed cleanly');

  // 3g. Non-array children field (e.g. children = null)
  const nullChildrenFieldAST = {
    id: 'doc-3006',
    title: 'Null Children Field Test',
    root: {
      id: 'root-null-children-field',
      type: 'document',
      position: 0,
      children: null
    }
  };
  const nullChildrenFieldIDR = transformAST(nullChildrenFieldAST);
  assert(Array.isArray(nullChildrenFieldIDR.children), 'children must be normalized to an array');
  assert(nullChildrenFieldIDR.children.length === 0, 'Null children field should result in empty array');
  console.log('  ✓ Null children field normalized to empty array');

  console.log('✓ Success: Malformed AST edge case tests passed.');
  passedCount++;

  console.log(`\n==========================================`);
  console.log(`ALL TRANSFORMATION TESTS PASSED (${passedCount}/${passedCount})`);
  console.log(`==========================================\n`);
}

runTransformationTests().catch(err => {
  console.error('\n❌ Transformation Test Failed:', err);
  process.exit(1);
});

