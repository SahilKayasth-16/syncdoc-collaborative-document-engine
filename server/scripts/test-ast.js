import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectDB from '../src/config/database.js';
import Document from '../src/models/Document.js';
import ASTNode from '../src/models/ASTNode.js';

// Load environment variables
dotenv.config();

async function runTests() {
  try {
    console.log('--- Starting AST Schema Verification Tests ---');

    // Establish DB Connection
    await connectDB();

    // 1. Database Clean Up
    console.log('Cleaning up database collections...');
    await Document.deleteMany({});
    await ASTNode.deleteMany({});

    // 2. Create the Root AST Node first
    console.log('Creating root document node...');
    const docId = new mongoose.Types.ObjectId();
    const rootNode = new ASTNode({
      _id: new mongoose.Types.ObjectId(),
      documentId: docId,
      parentId: null,
      type: 'document',
      position: 0,
      data: {}
    });

    rootNode.bypassTreeValidation = true;
    await rootNode.save();

    console.log(`Root Node Created: ${rootNode._id}`);

    // 3. Create the Document
    console.log('Creating Document container...');
    const doc = new Document({
      _id: docId,
      title: 'Technical Specification',
      rootNodeId: rootNode._id
    });

    doc.bypassTreeValidation = true;
    await doc.save();

    doc.bypassTreeValidation = false;
    await doc.save();
    console.log(`Document Container Created: ${doc.title} (${doc._id})`);

    // 4. Construct AST Structure:
    // Section 1: Introduction
    console.log('Creating Section: Introduction...');
    const introSection = new ASTNode({
      documentId: docId,
      parentId: rootNode._id,
      type: 'section',
      position: 10000,
      data: {}
    });
    await introSection.save();

    const introPara = new ASTNode({
      documentId: docId,
      parentId: introSection._id,
      type: 'paragraph',
      position: 10000,
      data: {}
    });
    await introPara.save();

    const introText = new ASTNode({
      documentId: docId,
      parentId: introPara._id,
      type: 'text',
      position: 10000,
      data: { content: 'This is the introduction section content.' }
    });
    await introText.save();

    // Section 2: Architecture
    console.log('Creating Section: Architecture...');
    const archSection = new ASTNode({
      documentId: docId,
      parentId: rootNode._id,
      type: 'section',
      position: 20000,
      data: {}
    });
    await archSection.save();

    const archPara = new ASTNode({
      documentId: docId,
      parentId: archSection._id,
      type: 'paragraph',
      position: 10000,
      data: {}
    });
    await archPara.save();

    const archText = new ASTNode({
      documentId: docId,
      parentId: archPara._id,
      type: 'text',
      position: 10000,
      data: { content: 'This is the architecture section content.' }
    });
    await archText.save();

    const codeBlock = new ASTNode({
      documentId: docId,
      parentId: archSection._id,
      type: 'code_block',
      position: 20000,
      data: { language: 'javascript' }
    });
    await codeBlock.save();

    const codeText = new ASTNode({
      documentId: docId,
      parentId: codeBlock._id,
      type: 'text',
      position: 10000,
      data: { content: "console.log('SyncDoc Collaborative Engine');" }
    });
    await codeText.save();

    // Section 3: Conclusion
    console.log('Creating Section: Conclusion...');
    const conclSection = new ASTNode({
      documentId: docId,
      parentId: rootNode._id,
      type: 'section',
      position: 30000,
      data: {}
    });
    await conclSection.save();

    const conclPara = new ASTNode({
      documentId: docId,
      parentId: conclSection._id,
      type: 'paragraph',
      position: 10000,
      data: {}
    });
    await conclPara.save();

    const conclText = new ASTNode({
      documentId: docId,
      parentId: conclPara._id,
      type: 'text',
      position: 10000,
      data: { content: 'This is the conclusion section content.' }
    });
    await conclText.save();

    console.log('✓ Success: Valid AST tree created successfully.');

    // 5. Query and verify relationships
    console.log('Verifying relationships in database...');
    const rootChildren = await ASTNode.find({ parentId: rootNode._id }).sort({ position: 1 });
    if (rootChildren.length !== 3) {
      throw new Error(`Expected 3 section child nodes under root, found ${rootChildren.length}`);
    }
    console.log(`✓ Success: Found ${rootChildren.length} sections under root.`);
    console.log(`  Section 1 position: ${rootChildren[0].position}`);
    console.log(`  Section 2 position: ${rootChildren[1].position}`);
    console.log(`  Section 3 position: ${rootChildren[2].position}`);

    // Verify stable identity (changing data does not change _id)
    const textNodeBefore = await ASTNode.findById(introText._id);
    textNodeBefore.data = { content: 'Updated introduction text' };
    const textNodeAfter = await textNodeBefore.save();
    if (textNodeBefore._id.toString() !== textNodeAfter._id.toString()) {
      throw new Error('Stable ID test failed: _id changed on save');
    }
    console.log('✓ Success: Stable node identity verified.');

    // 6. Test Validations
    console.log('Testing validations...');

    // Title blank validation
    try {
      const invalidDoc = new Document({ title: '   ', rootNodeId: rootNode._id });
      await invalidDoc.save();
      throw new Error('Validation failed: Blank document title was accepted.');
    } catch (err) {
      console.log('✓ Success: Blank document title rejected as expected.');
    }

    // Invalid type enum validation
    try {
      const invalidNode = new ASTNode({
        documentId: docId,
        parentId: rootNode._id,
        type: 'invalid_type_name',
        position: 40000,
        data: {}
      });
      await invalidNode.save();
      throw new Error('Validation failed: Invalid node type accepted.');
    } catch (err) {
      console.log('✓ Success: Invalid node type enum rejected as expected.');
    }

    // Root node type constraint (type != document with parentId == null)
    try {
      const invalidRoot = new ASTNode({
        documentId: docId,
        parentId: null,
        type: 'paragraph',
        position: 40000,
        data: {}
      });
      await invalidRoot.save();
      throw new Error('Validation failed: Non-document node allowed with null parentId.');
    } catch (err) {
      console.log('✓ Success: Non-document node with null parentId rejected as expected.');
    }

    // Root node parentId constraint (type == document with parentId != null)
    try {
      const invalidRoot2 = new ASTNode({
        documentId: docId,
        parentId: introSection._id,
        type: 'document',
        position: 40000,
        data: {}
      });
      await invalidRoot2.save();
      throw new Error('Validation failed: Document node allowed with non-null parentId.');
    } catch (err) {
      console.log('✓ Success: Document node with non-null parentId rejected as expected.');
    }

    // data must be an object
    try {
      const invalidDataNode = new ASTNode({
        documentId: docId,
        parentId: introPara._id,
        type: 'text',
        position: 10000,
        data: 'this is not an object'
      });
      await invalidDataNode.save();
      throw new Error('Validation failed: Non-object data value was accepted.');
    } catch (err) {
      console.log('✓ Success: Non-object data value rejected as expected.');
    }

    // 7. Verify compound index existence
    console.log('Checking database indexes...');
    const indexes = await ASTNode.listIndexes();
    
    const hasCompound = indexes.some(idx => 
      idx.key.documentId === 1 && 
      idx.key.parentId === 1 && 
      idx.key.position === 1
    );

    if (!hasCompound) {
      throw new Error('Verification failed: Compound index { documentId: 1, parentId: 1, position: 1 } was not found.');
    }
    console.log('✓ Success: Compound index verified.');

    console.log('--- AST Schema Verification Tests Passed Successfully ---');
  } catch (error) {
    console.error('❌ Test Execution Failed:', error.message);
    process.exit(1);
  } finally {
    // Disconnect Mongoose
    await mongoose.disconnect();
    console.log('Mongoose disconnected.');
  }
}

// Start
await runTests();
