import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function verifyRealDB() {
  const realURI = process.env.MONGO_URI;
  console.log('Connecting to Real MongoDB for verification...');

  try {
    const conn = await mongoose.connect(realURI);
    const db = conn.connection.db;

    const collections = await db.listCollections().toArray();
    console.log('\n--- REAL MONGODB COLLECTIONS ---');
    console.log(collections.map(c => c.name));

    const docsCollection = db.collection('documents');
    const astCollection = db.collection('astnodes');

    const docCount = await docsCollection.countDocuments();
    const astCount = await astCollection.countDocuments();

    console.log(`\n--- REAL MONGODB DOCUMENT COUNTS ---`);
    console.log(`documents count: ${docCount}`);
    console.log(`astnodes count: ${astCount}`);

    const docs = await docsCollection.find({}).toArray();
    console.log(`\n--- MIGRATED DOCUMENTS (${docs.length}) ---`);
    docs.forEach(doc => {
      console.log(`ID: ${doc._id}, Title: "${doc.title}", RootNodeId: ${doc.rootNodeId}, CreatedAt: ${doc.createdAt}`);
    });

    const astNodes = await astCollection.find({}).toArray();
    console.log(`\n--- MIGRATED AST NODES (${astNodes.length}) ---`);
    astNodes.forEach(node => {
      console.log(`Node ID: ${node._id}, docId: ${node.documentId}, type: ${node.type}, pos: ${node.position}, parentId: ${node.parentId}`);
      if (node.data) console.log(`  Data:`, JSON.stringify(node.data));
    });

    // Relationship verification
    console.log(`\n--- RELATIONSHIP INTEGRITY CHECK ---`);
    let missingRoots = 0;
    for (const doc of docs) {
      const rootNode = await astCollection.findOne({ _id: doc.rootNodeId });
      if (!rootNode) {
        console.error(`❌ Missing root node ${doc.rootNodeId} for doc ${doc._id}`);
        missingRoots++;
      } else {
        console.log(`✓ Document ${doc._id} ("${doc.title}") rootNode ${doc.rootNodeId} verified.`);
      }
    }

    let orphanASTNodes = 0;
    const docIdsSet = new Set(docs.map(d => d._id.toString()));
    for (const node of astNodes) {
      if (node.documentId && !docIdsSet.has(node.documentId.toString())) {
        console.error(`❌ Orphan AST Node ${node._id} references missing docId ${node.documentId}`);
        orphanASTNodes++;
      }
    }

    console.log(`\nVerification Summary: missingRoots=${missingRoots}, orphanASTNodes=${orphanASTNodes}`);

    await mongoose.connection.close();
    if (missingRoots === 0 && orphanASTNodes === 0 && docCount === 1 && astCount === 6) {
      console.log('\n✓ REAL DATABASE VERIFICATION PASSED 100%!');
    } else {
      console.error('\n❌ REAL DATABASE VERIFICATION FAILED!');
      process.exit(1);
    }
  } catch (err) {
    console.error('❌ Verification error:', err);
    process.exit(1);
  }
}

verifyRealDB();

