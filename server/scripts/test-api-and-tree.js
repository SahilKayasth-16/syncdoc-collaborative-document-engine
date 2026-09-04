import http from 'http';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectDB from '../src/config/database.js';
import app from '../src/app.js';
import { createWebSocketServer } from '../src/websocket/websocket.server.js';

dotenv.config();

function assert(condition, message) {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

async function testAPIAndTree() {
  console.log('Testing REST API and AST Tree Retrieval on Real MongoDB Connection...');
  await connectDB();

  const server = http.createServer(app);
  createWebSocketServer(server);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  const migratedDocId = '6a9a6772bb3339c024a251fb';

  try {
    // 1. Fetch document list via GET /api/documents
    console.log('[1] Fetching GET /api/documents...');
    const listRes = await fetch(`http://127.0.0.1:${port}/api/documents`);
    assert(listRes.status === 200, `GET /api/documents status expected 200, got ${listRes.status}`);
    const listData = await listRes.json();
    console.log(`  Received ${listData.data ? listData.data.length : 0} documents.`);
    assert(listData.data && listData.data.length >= 1, 'Documents list contains at least 1 migrated document');
    const docFound = listData.data.find(d => d._id === migratedDocId || d.id === migratedDocId);
    assert(docFound, `Migrated document ${migratedDocId} present in documents list`);
    console.log(`  ✓ Document "${docFound.title}" (${docFound._id || docFound.id}) listed.`);

    // 2. Fetch document tree via GET /api/documents/:id/tree
    console.log(`\n[2] Fetching GET /api/documents/${migratedDocId}/tree...`);
    const treeRes = await fetch(`http://127.0.0.1:${port}/api/documents/${migratedDocId}/tree`);
    assert(treeRes.status === 200, `GET /api/documents/${migratedDocId}/tree status expected 200, got ${treeRes.status}`);
    const treeData = await treeRes.json();
    assert(treeData.data && treeData.data.root, 'Tree response contains data.root');
    const root = treeData.data.root;
    assert(root.children && root.children.length === 5, `Expected 5 AST children in root, got ${root.children ? root.children.length : 0}`);

    console.log('  ✓ Root children loaded:');
    root.children.forEach(child => {
      console.log(`    - [${child.type}] ${child.id}: ${JSON.stringify(child.data)}`);
    });

    console.log('\n✓ REST API and AST Tree Retrieval Verification Passed 100%!');
  } catch (err) {
    console.error('❌ API Test Failed:', err);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    server.close();
  }
}

testAPIAndTree();

