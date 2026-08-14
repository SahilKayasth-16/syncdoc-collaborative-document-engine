# SyncDoc

Collaborative document engine with AST-based document modeling, recursive tree validation, and React block rendering.

## Overview

SyncDoc is a structured document system built on an Abstract Syntax Tree (AST) architecture. Instead of treating documents as plain flat strings or unvalidated HTML blobs, SyncDoc models every document as a hierarchical tree of typed AST nodes (such as headings, paragraphs, code blocks, lists, and quotes). This structure enables strict validation, granular document manipulation, and foundational architecture for future real-time collaborative editing.

## Features

- **AST-Based Document Modeling**: Documents represented as hierarchical tree structures with parent-child relationships and sibling positioning.
- **Deep Recursive Validation**: Server-side tree validation enforcing schema constraints, allowed parent-child types, duplicate position prevention, cycle detection, and orphan node detection.
- **Full RESTful Document API**: Express-based REST API providing endpoints to create, list, retrieve, update, delete, and fetch complete AST trees of documents.
- **Dynamic Block Rendering in React**: AST nodes map cleanly to dedicated React block components via a centralized `BlockRenderer`.
- **Supported Block Types**: Headings (`h1`–`h6`), Paragraphs, Code Blocks (with syntax styling), Lists (ordered and unordered), and Blockquotes (with author citations).
- **Graceful States & Error Handling**: Loading indicators, empty document library states, missing document notices, empty AST block handling, and unsupported block fallbacks.
- **Live Health Monitoring**: Real-time status reporting for API connectivity and MongoDB database connection.

## Tech Stack

### Client
- React (v19)
- React Router (v7)
- Vite

### Server
- Node.js (ES Modules)
- Express.js
- MongoDB
- Mongoose (v8)

## Project Structure

```text
SyncDoc/
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── blocks/
│   │   │   │   ├── CodeBlock.jsx
│   │   │   │   ├── HeadingBlock.jsx
│   │   │   │   ├── ListBlock.jsx
│   │   │   │   ├── ParagraphBlock.jsx
│   │   │   │   └── QuoteBlock.jsx
│   │   │   ├── documents/
│   │   │   │   ├── DocumentCard.jsx
│   │   │   │   └── DocumentList.jsx
│   │   │   └── editor/
│   │   │       ├── Block.jsx
│   │   │       ├── BlockList.jsx
│   │   │       ├── BlockRenderer.jsx
│   │   │       ├── Editor.jsx
│   │   │       ├── EditorHeader.jsx
│   │   │       └── EditorStatus.jsx
│   │   ├── pages/
│   │   │   ├── DocumentsPage.jsx
│   │   │   └── EditorPage.jsx
│   │   ├── services/
│   │   │   └── documentService.js
│   │   ├── App.jsx
│   │   ├── index.css
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
├── server/
│   ├── scripts/
│   │   ├── seed-editor.js
│   │   ├── test-ast.js
│   │   ├── test-document-service.js
│   │   └── test-validation.js
│   ├── src/
│   │   ├── config/
│   │   │   └── database.js
│   │   ├── controllers/
│   │   │   └── document.controller.js
│   │   ├── models/
│   │   │   ├── ASTNode.js
│   │   │   └── Document.js
│   │   ├── routes/
│   │   │   ├── document.routes.js
│   │   │   └── health.routes.js
│   │   ├── services/
│   │   │   └── document.service.js
│   │   ├── validators/
│   │   │   └── ast.validator.js
│   │   ├── app.js
│   │   └── server.js
│   ├── .env.example
│   └── package.json
├── .gitignore
└── README.md
```

## Architecture

```text
MongoDB
   ↓
Mongoose
   ↓
Express
   ↓
Controllers
   ↓
Services
   ↓
REST API
   ↓
React API Service
   ↓
Editor
   ↓
AST
   ↓
BlockRenderer
   ↓
Block Components
```

## AST Architecture

```text
Document
   ↓
rootNodeId
   ↓
ASTNode (type: "document", parentId: null)
   ↓
parentId
   ↓
children (type: "heading" | "paragraph" | "code_block" | "list" | "quote" | "section" | "text")
```

The document tree is anchored by a root `ASTNode` of type `document` with `parentId: null`. Child nodes reference their parent via `parentId` and define their relative order using numeric `position` values.

Currently supported AST node types in the schema:
- `document` (Root container node)
- `section` (Structural group node)
- `heading` (Header text with level 1–6)
- `paragraph` (Text paragraph content)
- `code_block` (Code snippet with language identifier)
- `list` (List container with style and items)
- `quote` (Blockquote text with optional author)
- `text` (Inline text node)

## Setup

### 1. Clone repository
```bash
git clone <repository-url>
cd SyncDoc
```

### 2. Install server dependencies
```bash
cd server
npm install
```

### 3. Configure server environment variables
Copy the template configuration from `server/.env.example` to `server/.env`:
```bash
cp .env.example .env
```
Ensure `MONGO_URI` points to your active MongoDB instance (e.g. `mongodb://localhost:27017/syncdoc`) and `PORT` is set (default `5050`).

### 4. Install client dependencies
```bash
cd ../client
npm install
```

### 5. Start MongoDB
Ensure MongoDB daemon is running locally or via your remote connection.

### 6. (Optional) Seed demo document AST
```bash
cd ../server
node scripts/seed-editor.js
```

### 7. Start server
```bash
cd ../server
npm run dev
# or: npm start
```

### 8. Start client
```bash
cd ../client
npm run dev
```

Open `http://localhost:5173` in your browser.

## API Endpoints

### Health Check
- `GET /api/health` — Check server and MongoDB connectivity status.

### Documents
- `POST /api/documents` — Create a new document with an initialized root AST node.
- `GET /api/documents` — Retrieve a list of all documents with metadata.
- `GET /api/documents/:id` — Retrieve metadata for a single document by ID.
- `GET /api/documents/:id/tree` — Fetch the complete recursive AST tree of a document.
- `PUT /api/documents/:id` — Update document title/metadata.
- `DELETE /api/documents/:id` — Delete a document and cascade-delete all associated AST nodes.