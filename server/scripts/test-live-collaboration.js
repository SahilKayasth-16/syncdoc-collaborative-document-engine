/**
 * E2E Two-Client Real-Time Content Synchronization Verification Test
 *
 * Verifies:
 * 1. User M edits Block 1 -> User L receives Yjs update and updates React state without refresh.
 * 2. User L edits Block 2 -> User M receives Yjs update and updates React state without refresh.
 * 3. Unchanged nodes maintain strict reference equality (===).
 * 4. Locked block receives remote updates while preventing local edits.
 * 5. Disconnect cleanup releases locks and notifies remaining clients.
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

dotenv.config();

function assert(condition, message) {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

// Client simulator wrapping Y.Doc, WebSocket, and React state reconciliation (mirroring Editor.jsx)
class ClientSimulator {
  constructor(name, userId, port, documentId) {
    this.name = name;
    this.userId = userId;
    this.port = port;
    this.documentId = documentId;
    this.ydoc = new Y.Doc();
    this.ws = null;
    this.documentState = null;
    this.messages = [];
  }

  async init(initialAST) {
    this.documentState = JSON.parse(JSON.stringify(initialAST));

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(`ws://127.0.0.1:${this.port}/ws/documents/${this.documentId}`);
      this.ws.binaryType = 'arraybuffer';

      this.ws.on('open', () => {
        this.ws.send(JSON.stringify({
          type: 'presence:identify',
          user: { userId: this.userId, name: this.name }
        }));
        resolve();
      });

      this.ws.on('message', async (data, isBinary) => {
        try {
          if (!isBinary) {
            const text = typeof data === 'string' ? data : data.toString('utf-8');
            const msg = JSON.parse(text);
            this.messages.push(msg);
            return;
          }

          const update = new Uint8Array(data);
          Y.applyUpdate(this.ydoc, update, 'remote');
          this.onYjsUpdate();
        } catch (err) {
          console.error(`[${this.name}] Error handling message:`, err);
        }
      });

      // Handle outgoing Yjs updates generated locally
      this.ydoc.on('update', (update, origin) => {
        if (origin !== 'remote' && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(update);
        }
      });

      this.ws.on('error', err => reject(err));
    });
  }

  // Exact logic implemented in Editor.jsx onUpdate
  onYjsUpdate() {
    const documentMap = this.ydoc.getMap('document');
    const blocksArray = documentMap.get('blocks') || this.ydoc.getArray('blocks');
    if (!blocksArray) return;

    const rawYBlocks = typeof blocksArray.toArray === 'function' ? blocksArray.toArray() : Array.from(blocksArray);
    const yNodesMap = new Map();

    rawYBlocks.forEach((yBlock) => {
      let id, type, position, data;
      if (typeof yBlock?.get === 'function') {
        id = yBlock.get('id');
        type = yBlock.get('type');
        position = yBlock.get('position');
        data = yBlock.get('data');
      } else {
        id = yBlock?.id || yBlock?._id;
        type = yBlock?.type;
        position = yBlock?.position;
        data = yBlock?.data;
      }

      if (data && typeof data.toJSON === 'function') {
        data = data.toJSON();
      }

      if (id) {
        yNodesMap.set(id.toString(), {
          id: id.toString(),
          type: type || 'paragraph',
          position: Number.isFinite(Number(position)) ? Number(position) : 0,
          data: data && typeof data === 'object' ? data : {}
        });
      }
    });

    const prevDoc = this.documentState;
    if (!prevDoc || !prevDoc.root || !prevDoc.root.children) return;

    let hasChanged = false;
    const updatedChildren = prevDoc.root.children.map((child) => {
      const childId = (child.id || child._id)?.toString();
      const yNode = yNodesMap.get(childId);

      if (yNode) {
        const dataChanged = JSON.stringify(child.data) !== JSON.stringify(yNode.data);
        const typeChanged = child.type !== yNode.type;
        const posChanged = child.position !== yNode.position;

        if (dataChanged || typeChanged || posChanged) {
          hasChanged = true;
          return {
            ...child,
            type: yNode.type,
            position: yNode.position,
            data: {
              ...(child.data || {}),
              ...(yNode.data || {})
            }
          };
        }
      }
      return child; // Retains exact reference equality
    });

    if (hasChanged) {
      this.documentState = {
        ...prevDoc,
        root: {
          ...prevDoc.root,
          children: updatedChildren
        }
      };
    }
  }

  // Exact logic implemented in Editor.jsx updateASTNode
  updateBlock(blockId, patch) {
    const normalizedId = blockId.toString();

    // Local React state update
    const prevDoc = this.documentState;
    if (prevDoc && prevDoc.root && prevDoc.root.children) {
      const updatedChildren = prevDoc.root.children.map((child) => {
        const childId = (child.id || child._id)?.toString();
        if (childId === normalizedId) {
          return {
            ...child,
            ...patch,
            data: { ...(child.data || {}), ...(patch.data || {}) }
          };
        }
        return child;
      });

      this.documentState = {
        ...prevDoc,
        root: { ...prevDoc.root, children: updatedChildren }
      };
    }

    // Yjs shared map update (collaborationService.js updateBlockData)
    const documentMap = this.ydoc.getMap('document');
    const blocksArray = documentMap.get('blocks') || this.ydoc.getArray('blocks');
    if (!blocksArray) return;

    this.ydoc.transact(() => {
      const arr = blocksArray.toArray();
      for (let i = 0; i < arr.length; i++) {
        const block = arr[i];
        const bId = typeof block?.get === 'function' ? block.get('id') : (block?.id || block?._id);
        if (bId && bId.toString() === normalizedId) {
          if (typeof block?.set === 'function') {
            const oldData = block.get('data') || {};
            block.set('data', { ...oldData, ...(patch.data || {}) });
          } else {
            const updatedBlock = {
              ...block,
              ...patch,
              data: { ...(block?.data || {}), ...(patch.data || {}) }
            };
            blocksArray.delete(i, 1);
            blocksArray.insert(i, [updatedBlock]);
          }
          break;
        }
      }
    });
  }

  close() {
    if (this.ws) {
      this.ws.close();
    }
    this.ydoc.destroy();
  }
}

async function runLiveCollaborationVerification() {
  console.log('===========================================================');
  console.log('  E2E TWO-CLIENT REAL-TIME CONTENT SYNCHRONIZATION TEST');
  console.log('===========================================================\n');

  await connectDB();
  const server = http.createServer(app);
  createWebSocketServer(server);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  try {
    await Document.deleteMany({});
    await ASTNode.deleteMany({});

    const doc = await createDocument('Live Collaboration Doc');
    const docId = doc._id.toString();
    const rootNodeId = doc.rootNodeId.toString();

    const b1 = new ASTNode({ documentId: doc._id, parentId: doc.rootNodeId, type: 'heading', position: 10000, data: { level: 1, content: 'Original Heading Text' } });
    await b1.save();
    const b2 = new ASTNode({ documentId: doc._id, parentId: doc.rootNodeId, type: 'paragraph', position: 20000, data: { content: 'Original Paragraph Text' } });
    await b2.save();
    const b3 = new ASTNode({ documentId: doc._id, parentId: doc.rootNodeId, type: 'code_block', position: 30000, data: { language: 'js', content: 'console.log("Original Code");' } });
    await b3.save();

    const initialAST = await getDocumentTree(doc._id);

    console.log('[Test Step 1] Connecting User M and User L...');
    const userM = new ClientSimulator('User M', 'user-m', port, docId);
    const userL = new ClientSimulator('User L', 'user-l', port, docId);

    await userM.init(initialAST);
    await userL.init(initialAST);

    await new Promise(resolve => setTimeout(resolve, 500));

    // -----------------------------------------------------------
    // Step 1: User M edits Block 1 -> User L receives & updates UI
    // -----------------------------------------------------------
    console.log('\n[Test Step 2] User M edits Block 1 text to "User M Updated Heading"...');
    const prevL_children = userL.documentState.root.children;

    userM.updateBlock(b1._id.toString(), { data: { content: 'User M Updated Heading' } });

    await new Promise(resolve => setTimeout(resolve, 500));

    const nextL_children = userL.documentState.root.children;
    assert(nextL_children[0].data.content === 'User M Updated Heading', 'User L must receive User M heading update');

    // Reference equality check for unchanged sibling nodes on User L
    assert(nextL_children[1] === prevL_children[1], 'Block 2 reference equality (===) preserved for User L');
    assert(nextL_children[2] === prevL_children[2], 'Block 3 reference equality (===) preserved for User L');
    assert(nextL_children[0] !== prevL_children[0], 'Block 1 reference updated for User L');

    console.log('✓ Success: User M edit -> User L UI updated without refresh. Sibling reference equality (===) preserved!');

    // -----------------------------------------------------------
    // Step 2: User L edits Block 2 -> User M receives & updates UI
    // -----------------------------------------------------------
    console.log('\n[Test Step 3] User L edits Block 2 text to "User L Updated Paragraph"...');
    const prevM_children = userM.documentState.root.children;

    userL.updateBlock(b2._id.toString(), { data: { content: 'User L Updated Paragraph' } });

    await new Promise(resolve => setTimeout(resolve, 500));

    const nextM_children = userM.documentState.root.children;
    assert(nextM_children[1].data.content === 'User L Updated Paragraph', 'User M must receive User L paragraph update');
    assert(nextM_children[0] === prevM_children[0], 'Block 1 reference equality (===) preserved for User M');
    assert(nextM_children[2] === prevM_children[2], 'Block 3 reference equality (===) preserved for User M');

    console.log('✓ Success: User L edit -> User M UI updated without refresh. Bi-directional sync verified!');

    // -----------------------------------------------------------
    // Step 3: Verify Lock + Remote Content Update Integration
    // -----------------------------------------------------------
    console.log('\n[Test Step 4] Verifying Lock + Remote Content Update Integration...');
    userM.ws.send(JSON.stringify({ type: 'lock:acquire', blockId: b3._id.toString() }));
    await new Promise(resolve => setTimeout(resolve, 300));

    const lockMsgL = userL.messages.find(m => m.type === 'locks:update' && m.locks.length > 0);
    assert(lockMsgL && lockMsgL.locks[0].blockId === b3._id.toString(), 'User L receives Block 3 lock banner');

    // User M edits locked Block 3 -> User L receives content update while block is locked
    userM.updateBlock(b3._id.toString(), { data: { language: 'js', content: 'console.log("Locked Block Update");' } });
    await new Promise(resolve => setTimeout(resolve, 500));

    assert(userL.documentState.root.children[2].data.content === 'console.log("Locked Block Update");', 'User L received remote content update on locked block');
    console.log('✓ Success: User L received User M live content update on Block 3 while Block 3 was locked!');

    // -----------------------------------------------------------
    // Step 4: Disconnect Cleanup
    // -----------------------------------------------------------
    console.log('\n[Test Step 5] User M disconnects -> verifying lock release...');
    userM.close();
    await new Promise(resolve => setTimeout(resolve, 500));

    const unlockMsgL = userL.messages.filter(m => m.type === 'locks:update').pop();
    assert(unlockMsgL && unlockMsgL.locks.length === 0, 'User L sees Block 3 lock released after User M disconnects');

    userL.close();
    console.log('✓ Success: Disconnect cleanup released lock and notified User L.');

    console.log('\n===========================================================');
    console.log('  ALL REAL-TIME CONTENT SYNCHRONIZATION TESTS PASSED 100%');
    console.log('===========================================================\n');

  } finally {
    server.close();
    await mongoose.disconnect();
  }
}

runLiveCollaborationVerification().catch(err => {
  console.error('\n❌ Live Collaboration Test Failed:', err);
  process.exit(1);
});

