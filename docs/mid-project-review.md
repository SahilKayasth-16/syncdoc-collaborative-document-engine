# SyncDoc — Mid-Project Review Documentation

This document prepares **SyncDoc** for the Mid-Project Review, detailing the structural transformation pipeline, architecture mappings, race condition resolution, and empirical 10-client concurrent stress testing results.

---

## 1. Document Structure Transformation Pipeline

SyncDoc represents documents across four distinct architectural layers:

```text
[1. Markdown Document]
         ↓  (AST Parser / Initializer)
[2. AST Node Tree]
         ↓  (Room Load & Serialization)
[3. Collaborative Yjs CRDT State (Y.Doc / Y.Array)]
         ↓  (MongoDB Storage Adapter)
[4. MongoDB Persistence Collection (Document + ASTNode)]
```

---

### Layer 1: Raw Markdown Source
```markdown
# Introduction

This is SyncDoc.

```js
console.log("Hello");
```
```

---

### Layer 2: Abstract Syntax Tree (AST Node Tree)
The document is parsed into a tree rooted at a document container node:

```text
Root Document (id: doc-root-001)
├── Heading (id: node-h1-001, level: 1, pos: 10000)
│   └── content: "Introduction"
├── Paragraph (id: node-p1-001, pos: 20000)
│   └── content: "This is SyncDoc."
└── CodeBlock (id: node-c1-001, lang: "javascript", pos: 30000)
    └── content: "console.log(\"Hello\");"
```

---

### Layer 3: Collaborative JSON / Yjs Shared Structure (CRDT)
When a room initializes, the AST is loaded into a flat collaborative `Y.Array` stored inside `Y.Map("document")`:

```json
{
  "document": {
    "title": "SyncDoc Review Demo",
    "blocks": [
      {
        "id": "node-h1-001",
        "type": "heading",
        "position": 10000,
        "data": {
          "level": 1,
          "content": "Introduction"
        },
        "children": []
      },
      {
        "id": "node-p1-001",
        "type": "paragraph",
        "position": 20000,
        "data": {
          "content": "This is SyncDoc."
        },
        "children": []
      },
      {
        "id": "node-c1-001",
        "type": "code_block",
        "position": 30000,
        "data": {
          "language": "javascript",
          "content": "console.log(\"Hello\");"
        },
        "children": []
      }
    ]
  }
}
```

---

### Layer 4: MongoDB Persistence Models (Database Representation)

#### A. Document Collection (`Document`)
```json
{
  "_id": "6a89ce2bc080a599aafb9097",
  "title": "SyncDoc Review Demo",
  "rootNodeId": "6a89ce2bc080a599aafb9098",
  "createdAt": "2026-08-22T21:56:44.100Z",
  "updatedAt": "2026-08-22T21:56:44.100Z"
}
```

#### B. ASTNode Collection (`ASTNode` documents)

**1. Root Document Node:**
```json
{
  "_id": "6a89ce2bc080a599aafb9098",
  "documentId": "6a89ce2bc080a599aafb9097",
  "parentId": null,
  "type": "document",
  "position": 0,
  "data": {}
}
```

**2. Heading Block:**
```json
{
  "_id": "6a89ce2bc080a599aafb90a4",
  "documentId": "6a89ce2bc080a599aafb9097",
  "parentId": "6a89ce2bc080a599aafb9098",
  "type": "heading",
  "position": 10000,
  "data": {
    "level": 1,
    "content": "Introduction"
  }
}
```

**3. Paragraph Block:**
```json
{
  "_id": "6a89ce2bc080a599aafb90a9",
  "documentId": "6a89ce2bc080a599aafb9097",
  "parentId": "6a89ce2bc080a599aafb9098",
  "type": "paragraph",
  "position": 20000,
  "data": {
    "content": "This is SyncDoc."
  }
}
```

**4. Code Block:**
```json
{
  "_id": "6a89ce2bc080a599aafb90ae",
  "documentId": "6a89ce2bc080a599aafb9097",
  "parentId": "6a89ce2bc080a599aafb9098",
  "type": "code_block",
  "position": 30000,
  "data": {
    "language": "javascript",
    "content": "console.log(\"Hello\");"
  }
}
```

---

## 2. Race Condition Verification (Rapid Connect / Disconnect)

- **Identified Risk**: Asynchronous room creation awaiting MongoDB AST loading could cause `removeClientFromRoom()` to execute before the room promise resolved and entered the `rooms` map. When room loading finished, `addClientToRoom()` added the closed WebSocket, causing a permanent memory leak.
- **Verification & Resolution**:
  - `addClientToRoom()` checks `client.readyState === 1` (`WebSocket.OPEN`). Closed sockets are discarded immediately, and empty rooms are cleaned up via `removeRoom()`.
  - `websocket.server.js` checks `if (ws.readyState !== 1) return;` post-initialization.
  - Stress Test 8 programmatically verified that 5 rapid connect/disconnect cycles leave 0 leaked rooms.

---

## 3. 10 Concurrent Clients Conflict Resolution Stress Test

- **Execution Script**: `server/scripts/test-10-clients-stress.js`
- **Result Summary**:
  - 10 WebSocket clients connected simultaneously to the same collaboration room.
  - Presence list verified 10 active concurrent users (`user-1` to `user-10`).
  - Concurrent edits were triggered across all 10 clients simultaneously.
  - **CRDT Convergence**: All 10 clients converged to 100% identical Y.Doc state strings.
  - **Graceful Cleanup**: Disconnecting clients in two batches of 5 resulted in accurate presence updates and 100% room cleanup when the last client disconnected (`rooms.size === 0`).
