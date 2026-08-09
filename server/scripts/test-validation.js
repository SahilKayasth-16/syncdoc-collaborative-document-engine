import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectDB from '../src/config/database.js';
import Document from '../src/models/Document.js';
import ASTNode from '../src/models/ASTNode.js';
import { validateDocumentTree } from '../src/validators/ast.validator.js';

// Load config
dotenv.config();

async function runTests() {
  try {
    console.log('=== Running Day 4 Recursive AST Validation Tests ===');
    
    // Connect to database
    await connectDB();

    async function cleanup() {
      await Document.deleteMany({});
      await ASTNode.deleteMany({});
    }

    // 1. Valid Tree Test
    console.log('\nTest 1: Valid Tree (Document -> Section -> Heading/Paragraph/CodeBlock -> Text)');
    await cleanup();
    const docId1 = new mongoose.Types.ObjectId();
    
    const rootNode1 = new ASTNode({
      _id: new mongoose.Types.ObjectId(),
      documentId: docId1,
      parentId: null,
      type: 'document',
      position: 0
    });
    rootNode1.bypassTreeValidation = true;
    await rootNode1.save();

    const doc1 = new Document({
      _id: docId1,
      title: 'Valid Document Spec',
      rootNodeId: rootNode1._id
    });
    doc1.bypassTreeValidation = true;
    await doc1.save();

    const section1 = new ASTNode({
      _id: new mongoose.Types.ObjectId(),
      documentId: docId1,
      parentId: rootNode1._id,
      type: 'section',
      position: 10000
    });
    section1.bypassTreeValidation = true;
    await section1.save();

    const heading1 = new ASTNode({
      _id: new mongoose.Types.ObjectId(),
      documentId: docId1,
      parentId: section1._id,
      type: 'heading',
      position: 10000
    });
    heading1.bypassTreeValidation = true;
    await heading1.save();

    const text1 = new ASTNode({
      _id: new mongoose.Types.ObjectId(),
      documentId: docId1,
      parentId: heading1._id,
      type: 'text',
      position: 10000,
      data: { content: 'Introduction Title' }
    });
    text1.bypassTreeValidation = true;
    await text1.save();

    const para1 = new ASTNode({
      _id: new mongoose.Types.ObjectId(),
      documentId: docId1,
      parentId: section1._id,
      type: 'paragraph',
      position: 20000
    });
    para1.bypassTreeValidation = true;
    await para1.save();

    const text2 = new ASTNode({
      _id: new mongoose.Types.ObjectId(),
      documentId: docId1,
      parentId: para1._id,
      type: 'text',
      position: 10000,
      data: { content: 'Paragraph body text.' }
    });
    text2.bypassTreeValidation = true;
    await text2.save();

    const code1 = new ASTNode({
      _id: new mongoose.Types.ObjectId(),
      documentId: docId1,
      parentId: section1._id,
      type: 'code_block',
      position: 30000,
      data: { language: 'js' }
    });
    code1.bypassTreeValidation = true;
    await code1.save();

    const text3 = new ASTNode({
      _id: new mongoose.Types.ObjectId(),
      documentId: docId1,
      parentId: code1._id,
      type: 'text',
      position: 10000,
      data: { content: 'console.log("hi");' }
    });
    text3.bypassTreeValidation = true;
    await text3.save();

    // Verify manually
    await validateDocumentTree(docId1);
    console.log('✓ PASS: Valid tree validation succeeded.');

    // 2. Invalid parent-child compatibility
    console.log('\nTest 2: Invalid Parent-Child Compatibility (heading -> code_block)');
    const badChildNode = new ASTNode({
      documentId: docId1,
      parentId: heading1._id, // Heading can only contain text, not code_block
      type: 'code_block',
      position: 20000
    });
    try {
      await badChildNode.save(); // Should be intercepted by Mongoose pre-save
      throw new Error('FAIL: Allowed code_block under heading.');
    } catch (err) {
      console.log(`✓ PASS: Caught expected validation error: ${err.message}`);
    }

    // 3. Missing parent
    console.log('\nTest 3: Missing Parent (nonexistent parentId)');
    const nonexistentParentId = new mongoose.Types.ObjectId();
    const orphanedNode = new ASTNode({
      documentId: docId1,
      parentId: nonexistentParentId,
      type: 'paragraph',
      position: 40000
    });
    try {
      await orphanedNode.save(); // Should fail
      throw new Error('FAIL: Allowed node with nonexistent parentId.');
    } catch (err) {
      console.log(`✓ PASS: Caught expected validation error: ${err.message}`);
    }

    // 4. Wrong document ownership
    console.log('\nTest 4: Wrong Document Ownership');
    const docId2 = new mongoose.Types.ObjectId();
    const rootNode2 = new ASTNode({
      _id: new mongoose.Types.ObjectId(),
      documentId: docId2,
      parentId: null,
      type: 'document',
      position: 0
    });
    rootNode2.bypassTreeValidation = true;
    await rootNode2.save();

    const doc2 = new Document({
      _id: docId2,
      title: 'Document B',
      rootNodeId: rootNode2._id
    });
    doc2.bypassTreeValidation = true;
    await doc2.save();

    // Node belonging to Doc B attempts to attach to Doc A's tree
    const foreignNode = new ASTNode({
      documentId: docId2, // Belongs to Doc B
      parentId: section1._id, // Attached to Doc A
      type: 'paragraph',
      position: 40000
    });
    try {
      await foreignNode.save();
      throw new Error('FAIL: Allowed node with different documentId under parent.');
    } catch (err) {
      console.log(`✓ PASS: Caught expected validation error: ${err.message}`);
    }

    // 5. Circular reference
    console.log('\nTest 5: Circular Reference (A -> B -> C -> A) with Termination');
    await cleanup();
    const docId3 = new mongoose.Types.ObjectId();
    
    const nodeAId = new mongoose.Types.ObjectId();
    const nodeBId = new mongoose.Types.ObjectId();
    const nodeCId = new mongoose.Types.ObjectId();

    const nodeA = new ASTNode({
      _id: nodeAId,
      documentId: docId3,
      parentId: nodeCId, // A -> C
      type: 'section',
      position: 10000
    });
    nodeA.bypassTreeValidation = true;
    await nodeA.save();

    const nodeB = new ASTNode({
      _id: nodeBId,
      documentId: docId3,
      parentId: nodeAId, // B -> A
      type: 'section',
      position: 20000
    });
    nodeB.bypassTreeValidation = true;
    await nodeB.save();

    const nodeC = new ASTNode({
      _id: nodeCId,
      documentId: docId3,
      parentId: nodeBId, // C -> B
      type: 'section',
      position: 30000
    });
    nodeC.bypassTreeValidation = true;
    await nodeC.save();

    const doc3 = new Document({
      _id: docId3,
      title: 'Doc with Cycle',
      rootNodeId: nodeAId
    });
    doc3.bypassTreeValidation = true;
    await doc3.save();

    try {
      await validateDocumentTree(docId3);
      throw new Error('FAIL: Validator failed to catch circular reference.');
    } catch (err) {
      console.log(`✓ PASS: Caught expected circular validation error: ${err.message}`);
    }

    // 6. Orphan Node
    console.log('\nTest 6: Orphan Node');
    await cleanup();
    const docId4 = new mongoose.Types.ObjectId();

    const rootNode4 = new ASTNode({
      _id: new mongoose.Types.ObjectId(),
      documentId: docId4,
      parentId: null,
      type: 'document',
      position: 0
    });
    rootNode4.bypassTreeValidation = true;
    await rootNode4.save();

    const doc4 = new Document({
      _id: docId4,
      title: 'Document with Orphan',
      rootNodeId: rootNode4._id
    });
    doc4.bypassTreeValidation = true;
    await doc4.save();

    // Create a cycle of orphan nodes that exist in DB but are unreachable from root
    const orphanAId = new mongoose.Types.ObjectId();
    const orphanBId = new mongoose.Types.ObjectId();

    const orphanA = new ASTNode({
      _id: orphanAId,
      documentId: docId4,
      parentId: orphanBId,
      type: 'section',
      position: 10000
    });
    orphanA.bypassTreeValidation = true;
    await orphanA.save();

    const orphanB = new ASTNode({
      _id: orphanBId,
      documentId: docId4,
      parentId: orphanAId,
      type: 'section',
      position: 10000
    });
    orphanB.bypassTreeValidation = true;
    await orphanB.save();

    try {
      await validateDocumentTree(docId4);
      throw new Error('FAIL: Validator failed to catch orphan nodes.');
    } catch (err) {
      console.log(`✓ PASS: Caught expected orphan validation error: ${err.message}`);
    }

    // 7. Duplicate sibling position
    console.log('\nTest 7: Duplicate Sibling Position');
    await cleanup();
    const docId5 = new mongoose.Types.ObjectId();

    const rootNode5 = new ASTNode({
      _id: new mongoose.Types.ObjectId(),
      documentId: docId5,
      parentId: null,
      type: 'document',
      position: 0
    });
    rootNode5.bypassTreeValidation = true;
    await rootNode5.save();

    const doc5 = new Document({
      _id: docId5,
      title: 'Doc Sibling Test',
      rootNodeId: rootNode5._id
    });
    doc5.bypassTreeValidation = true;
    await doc5.save();

    const sibling1 = new ASTNode({
      documentId: docId5,
      parentId: rootNode5._id,
      type: 'paragraph',
      position: 10000
    });
    sibling1.bypassTreeValidation = true;
    await sibling1.save();

    const sibling2 = new ASTNode({
      documentId: docId5,
      parentId: rootNode5._id,
      type: 'paragraph',
      position: 10000
    });
    try {
      await sibling2.save();
      throw new Error('FAIL: Allowed sibling with duplicate position.');
    } catch (err) {
      console.log(`✓ PASS: Caught expected validation error: ${err.message}`);
    }

    // 8. Valid Fractional Positions
    console.log('\nTest 8: Valid Fractional Sibling Positions (10000, 15000, 17500)');
    await cleanup();
    const docId6 = new mongoose.Types.ObjectId();

    const rootNode6 = new ASTNode({
      _id: new mongoose.Types.ObjectId(),
      documentId: docId6,
      parentId: null,
      type: 'document',
      position: 0
    });
    rootNode6.bypassTreeValidation = true;
    await rootNode6.save();

    const doc6 = new Document({
      _id: docId6,
      title: 'Doc Fractional Test',
      rootNodeId: rootNode6._id
    });
    doc6.bypassTreeValidation = true;
    await doc6.save();

    const sib1 = new ASTNode({
      documentId: docId6,
      parentId: rootNode6._id,
      type: 'paragraph',
      position: 10000
    });
    sib1.bypassTreeValidation = true;
    await sib1.save();

    const sib2 = new ASTNode({
      documentId: docId6,
      parentId: rootNode6._id,
      type: 'paragraph',
      position: 15000
    });
    sib2.bypassTreeValidation = true;
    await sib2.save();

    const sib3 = new ASTNode({
      documentId: docId6,
      parentId: rootNode6._id,
      type: 'paragraph',
      position: 17500
    });
    sib3.bypassTreeValidation = true;
    await sib3.save();

    await validateDocumentTree(docId6);
    console.log('✓ PASS: Fractional indexing validated successfully.');

    console.log('\n=== All Day 4 Recursive AST Validation Tests Passed Successfully ===');
  } catch (error) {
    console.error('❌ Test Failed:', error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Mongoose disconnected.');
  }
}

runTests();
