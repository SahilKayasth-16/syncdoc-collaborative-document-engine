# SyncDoc — AST Architecture Design

This document details the Abstract Syntax Tree (AST) architecture for **SyncDoc**. The design outlines how documents are represented, stored, and managed in a highly concurrent, collaborative environment.

---

## 1. Architectural Decisions

### Why Separate AST Nodes with References?
Instead of storing the entire nested AST as one deeply embedded JSON document inside a single MongoDB document, SyncDoc uses **Separate AST Nodes with References**. 

```text
Document (Metadata & Root ID)
   │
   └── rootNodeId (points to)
          │
          ▼
     ASTNode [type: "document"]
          │
          ├── child ASTNode [parentId = rootNodeId]
          ├── child ASTNode [parentId = rootNodeId]
          └── ...
```

This decision was chosen over a deeply embedded AST for the following reasons:

1. **Granular Database Updates**: Updating or moving a single paragraph or section only requires writing to that specific AST node. In a deeply embedded structure, even a small text change requires rewriting the entire document, leading to heavy write amplification.
2. **MongoDB Size Constraints**: MongoDB documents have a hard cap of 16MB. Extremely large or complex documents with thousands of paragraphs, code blocks, and headings could exceed this limit if stored as a single embedded document.
3. **CRDT & Conflict Resolution Preparedness**: Collaborative editing algorithms (such as CRDTs like Yjs) operate on granular operational changes (e.g., insert/delete/update of specific nodes). By assigning a stable, unique ID to each node, we can track insertions, deletions, and moves concurrently without locking the entire document.
4. **Indexability & Scalability**: Querying for specific node types, content text, or structures across the entire repository is highly efficient since Mongoose can index the `type`, `parentId`, `documentId`, and `position` fields.

---

## 2. AST Data Models

The logical representation divides documents into a metadata container (`Document`) and discrete blocks (`ASTNode`).

### Document Model
The `Document` represents the file itself and stores metadata and a pointer to the entry point of the AST.

```json
{
  "_id": "doc-8f4b23c9-0a1e-4f76-9c4c-3e9a4f21780a",
  "title": "SyncDoc API Specification",
  "rootNodeId": "node-root-8f4b23c9-0a1e-4f76-9c4c-3e9a4f21780a",
  "createdAt": "2026-08-09T16:00:00.000Z",
  "updatedAt": "2026-08-09T16:30:00.000Z"
}
```

### AST Node Model
The `ASTNode` represents a structural block (like a section or code block) or an inline element (like text).

```json
{
  "_id": "node-unique-stable-id",
  "documentId": "doc-8f4b23c9-0a1e-4f76-9c4c-3e9a4f21780a",
  "parentId": "node-parent-id-or-null",
  "type": "document | section | heading | paragraph | code_block | text",
  "position": 1.0,
  "data": {}
}
```

* **Node Identity**: The `_id` is a stable, unique identifier (UUID/ObjectId). Modifying the content of a node (e.g., typing in a paragraph) **must never** change its `_id`. This stable identity is required for the future CRDT engine to resolve offline edits.
* **Parent-Child Relation**: Maintained purely by reference via the `parentId` field. If `parentId` is `null`, the node is the root `document` node.
* **Ordering**: Nodes sharing the same `parentId` (siblings) are ordered dynamically using the `position` value.

---

## 3. AST Structural Diagram

Below is a conceptual visualization of how a valid document is organized structurally inside the database.

```text
                       Document (Container)
                                │
                          (rootNodeId)
                                │
                                ▼
                       Root Node [type: "document"]
                                │
            ┌───────────────────┴───────────────────┐
            ▼                                       ▼
     Section A [pos: 0]                      Section B [pos: 1]
      (parentId: root)                        (parentId: root)
            │                                       │
      ┌─────┼─────────────┐                         ├─────────────────┐
      ▼     ▼             ▼                         ▼                 ▼
   Heading  Paragraph  CodeBlock                 Heading           Paragraph
   [pos: 0]  [pos: 1]   [pos: 2]                 [pos: 0]          [pos: 1]
      │         │          │                        │                 │
      ▼         ▼          ▼                        ▼                 ▼
    Text      Text       Text                     Text              Text
```

---

## 4. Node Types & Schema Examples

Here are the concrete JSON examples of how nodes are structured based on their type.

### A. Root Node (`type: "document"`)
The top-level anchor of the document's AST.
```json
{
  "_id": "node-root-8f4b23c9-0a1e-4f76-9c4c-3e9a4f21780a",
  "documentId": "doc-8f4b23c9-0a1e-4f76-9c4c-3e9a4f21780a",
  "parentId": null,
  "type": "document",
  "position": 0,
  "data": {}
}
```

### B. Section Node (`type: "section"`)
Groups related headings, paragraphs, code blocks, or nested subsections.
```json
{
  "_id": "node-sec-1111-2222-3333",
  "documentId": "doc-8f4b23c9-0a1e-4f76-9c4c-3e9a4f21780a",
  "parentId": "node-root-8f4b23c9-0a1e-4f76-9c4c-3e9a4f21780a",
  "type": "section",
  "position": 1.0,
  "data": {}
}
```

### C. Heading Node (`type: "heading"`)
Represents title text. Metadata such as the heading level (e.g. h1, h2, h3) is stored inside `data`.
```json
{
  "_id": "node-head-4444-5555-6666",
  "documentId": "doc-8f4b23c9-0a1e-4f76-9c4c-3e9a4f21780a",
  "parentId": "node-sec-1111-2222-3333",
  "type": "heading",
  "position": 1.0,
  "data": {
    "level": 1
  }
}
```

### D. Paragraph Node (`type: "paragraph"`)
Serves as the structural block for standard text paragraphs.
```json
{
  "_id": "node-para-7777-8888-9999",
  "documentId": "doc-8f4b23c9-0a1e-4f76-9c4c-3e9a4f21780a",
  "parentId": "node-sec-1111-2222-3333",
  "type": "paragraph",
  "position": 2.0,
  "data": {}
}
```

### E. Code Block Node (`type: "code_block"`)
Renders formatted code blocks. Language metadata (syntax highlighting) is declared inside `data`.
```json
{
  "_id": "node-code-aaaa-bbbb-cccc",
  "documentId": "doc-8f4b23c9-0a1e-4f76-9c4c-3e9a4f21780a",
  "parentId": "node-sec-1111-2222-3333",
  "type": "code_block",
  "position": 3.0,
  "data": {
    "language": "javascript"
  }
}
```

### F. Text Node (`type: "text"`)
The raw content leaf nodes. Modifying the text content only updates this node's `data.content` field, leaving the node identity (`_id`) intact.
```json
{
  "_id": "node-text-dddd-eeee-ffff",
  "documentId": "doc-8f4b23c9-0a1e-4f76-9c4c-3e9a4f21780a",
  "parentId": "node-para-7777-8888-9999",
  "type": "text",
  "position": 1.0,
  "data": {
    "content": "SyncDoc is a real-time collaborative document engine."
  }
}
```

---

## 5. Nesting & Validation Rules

To prevent corrupted tree structures, nesting boundaries are strictly regulated.

### Allowed Nested Children Matrix

| Parent Type | Allowed Children | Description |
| :--- | :--- | :--- |
| **`document`** | `section`, `heading`, `paragraph`, `code_block` | Top level content blocks. |
| **`section`** | `section`, `heading`, `paragraph`, `code_block` | Supports nested sub-sections and text layout. |
| **`heading`** | `text` | Can only contain flat inline text. |
| **`paragraph`** | `text` | Can only contain flat inline text. |
| **`code_block`** | `text` | Can only contain raw code content text. |
| **`text`** | *None* | Leaf node. Cannot have children. |

### Invalid Nesting Examples (Prohibited)

* **Paragraph containing other block types**:
  ```text
  paragraph
  └── code_block (INVALID - paragraphs can only nest inline text)
  ```
* **Text nodes containing children**:
  ```text
  text
  └── paragraph (INVALID - text is a leaf element and cannot have children)
  ```
* **Heading nesting layout blocks**:
  ```text
  heading
  └── section (INVALID - headings can only contain raw text content)
  ```

---

## 6. Ordering Strategy

Sibling nodes (nodes sharing the same `parentId`) are ordered dynamically using the `position` floating-point value.
* The initial position of siblings starts at incremental intervals (e.g., `10000`, `20000`, `30000`).
* When inserting a new node between sibling $A$ (position $P_A$) and sibling $B$ (position $P_B$), the new node's position is calculated as:
  $$P_{new} = \frac{P_A + P_B}{2}$$

  This is the initial persistence ordering strategy. Collaborative ordering will ultimately be resolved by the synchronization layer rather than relying solely on floating-point positions.
* This fractional indexing system guarantees deterministic ordering and facilitates fast re-ordering queries (`sort({ position: 1 })`) without rewriting positions of neighboring elements.

---

## 7. Preparation for Collaborative Synchronization (Yjs)

By referencing nodes via independent, independent MongoDB documents rather than one monolithic nested JSON file, this architecture aligns directly with CRDT synchronization models (e.g., Yjs or Automerge):
1. **XML Tree Mapping**: The document structure maps 1-to-1 to a Yjs shared tree structure (`Y.XmlFragment` / `Y.XmlElement` / `Y.XmlText`).
2. **Deterministic Integration**: When a client performs an operation (e.g., moving a section), the Yjs algorithm resolves the relative re-ordering. Once computed, the backend is notified to update the node's `parentId` and `position` fields directly.
3. **No Overlapping Merges**: Two users typing in different paragraphs operate on separate text nodes, significantly reducing the conflict surface. When users concurrently edit the same text node, Yjs handles the character-level concurrent operations.
