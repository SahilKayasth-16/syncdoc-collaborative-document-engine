import mongoose from 'mongoose';

async function inspectLocalDB() {
  const localURI = 'mongodb://localhost:27017/syncdoc';
  console.log(`Connecting to local MongoDB at: ${localURI}...`);

  try {
    const conn = await mongoose.connect(localURI);
    console.log('Connected to local MongoDB successfully!');

    const db = conn.connection.db;
    const collections = await db.listCollections().toArray();
    console.log('\n--- COLLECTIONS IN LOCAL MONGODB ---');
    console.log(collections.map(c => c.name));

    const docsCollection = db.collection('documents');
    const astCollection = db.collection('astnodes');

    const docCount = await docsCollection.countDocuments();
    const astCount = await astCollection.countDocuments();

    console.log(`\n--- DOCUMENT COUNTS ---`);
    console.log(`documents count: ${docCount}`);
    console.log(`astnodes count: ${astCount}`);

    const docs = await docsCollection.find({}).toArray();
    console.log(`\n--- DOCUMENTS LIST (${docs.length}) ---`);
    docs.forEach(doc => {
      console.log(`ID: ${doc._id}, Title: "${doc.title}", RootNodeId: ${doc.rootNodeId}, CreatedAt: ${doc.createdAt}`);
    });

    const sampleNodes = await astCollection.find({}).limit(5).toArray();
    console.log(`\n--- SAMPLE AST NODES (First 5) ---`);
    sampleNodes.forEach(node => {
      console.log(`Node ID: ${node._id}, docId: ${node.documentId}, type: ${node.type}, pos: ${node.position}, parentId: ${node.parentId}`);
      console.log(`  Data:`, JSON.stringify(node.data));
    });

    // Check relationship integrity
    console.log(`\n--- RELATIONSHIP INTEGRITY CHECK ---`);
    let missingRootCount = 0;
    for (const doc of docs) {
      if (doc.rootNodeId) {
        const rootNode = await astCollection.findOne({ _id: doc.rootNodeId });
        if (!rootNode) {
          console.error(`❌ Root node ${doc.rootNodeId} missing for document ${doc._id}`);
          missingRootCount++;
        } else {
          console.log(`✓ Document ${doc._id} ("${doc.title}") rootNode ${doc.rootNodeId} exists.`);
        }
      }
    }

    let orphanCount = 0;
    const allDocIds = new Set(docs.map(d => d._id.toString()));
    const astNodes = await astCollection.find({}).toArray();
    astNodes.forEach(node => {
      if (node.documentId && !allDocIds.has(node.documentId.toString())) {
        console.warn(`⚠️ Orphan AST Node ${node._id} references unknown documentId ${node.documentId}`);
        orphanCount++;
      }
    });

    console.log(`\nRelationship Check Summary: missingRoots=${missingRootCount}, orphanASTNodes=${orphanCount}`);

    await mongoose.connection.close();
    console.log('\nInspection complete.');
  } catch (err) {
    console.error('Error connecting to or inspecting local MongoDB:', err.message);
    process.exit(1);
  }
}

inspectLocalDB();

