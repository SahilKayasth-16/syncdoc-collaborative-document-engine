import mongoose from 'mongoose';

/**
 * Validates the entire AST tree for a given document.
 * Includes validations for parent-child compatibility, duplicate positions,
 * missing parents, document ownership, cycles, and orphan nodes.
 *
 * @param {string|mongoose.Types.ObjectId} documentId - The document ID to validate.
 * @param {mongoose.Document} [nodeBeingSaved] - The node instance currently in the pre-save hook.
 * @returns {Promise<void>} Resolves if valid, throws an Error otherwise.
 */
export async function validateDocumentTree(documentId, nodeBeingSaved = null) {
  const Document = mongoose.model('Document');
  const ASTNode = mongoose.model('ASTNode');

  const docIdStr = documentId.toString();

  // 1. Fetch the Document
  const doc = await Document.findById(docIdStr).lean();
  if (!doc) {
    throw new Error(`Document with ID ${docIdStr} not found.`);
  }

  if (!doc.rootNodeId) {
    throw new Error(`Document ${docIdStr} is missing a rootNodeId.`);
  }

  // 2. Fetch all nodes belonging to this document from the database
  const allNodes = await ASTNode.find({ documentId }).lean();

  // If a node is currently being saved, speculative validation requires merging it
  if (nodeBeingSaved) {
    const nodeObj = typeof nodeBeingSaved.toObject === 'function'
      ? nodeBeingSaved.toObject()
      : nodeBeingSaved;

    const nodeIdStr = nodeObj._id.toString();
    const index = allNodes.findIndex(n => n._id.toString() === nodeIdStr);

    if (index !== -1) {
      allNodes[index] = nodeObj; // Speculative Update
    } else {
      allNodes.push(nodeObj); // Speculative Insert
    }
  }

  const nodeMap = new Map(allNodes.map(n => [n._id.toString(), n]));

  // 3. Verify Root Node exists and is correctly configured
  const rootNodeIdStr = doc.rootNodeId.toString();
  const rootNode = nodeMap.get(rootNodeIdStr);

  if (!rootNode) {
    throw new Error(`Root node ${rootNodeIdStr} for document ${docIdStr} does not exist in the database.`);
  }

  if (rootNode.type !== 'document') {
    throw new Error(`Root node ${rootNodeIdStr} must be of type "document", but found "${rootNode.type}".`);
  }

  if (rootNode.parentId !== null) {
    throw new Error(`Root node ${rootNodeIdStr} must have parentId set to null, but found "${rootNode.parentId}".`);
  }

  if (rootNode.documentId.toString() !== docIdStr) {
    throw new Error(`Root node ${rootNodeIdStr} documentId mismatch. Expected ${docIdStr}, found ${rootNode.documentId}.`);
  }

  // Set up validation constraints
  const visited = new Set();

  const ALLOWED_CHILDREN = {
    document: ['section', 'heading', 'paragraph', 'code_block', 'list', 'quote'],
    section: ['section', 'heading', 'paragraph', 'code_block', 'list', 'quote'],
    heading: ['text'],
    paragraph: ['text'],
    code_block: ['text'],
    list: [],
    quote: ['text'],
    text: []
  };

  // Traversal function with cycle protection
  function traverse(nodeId, currentPath = []) {
    const nodeIdStr = nodeId.toString();

    // Circular reference detection
    if (currentPath.includes(nodeIdStr)) {
      const cyclePath = [...currentPath, nodeIdStr].join(' -> ');
      throw new Error(`Circular AST reference detected involving node ${nodeIdStr}. Path: ${cyclePath}`);
    }

    if (visited.has(nodeIdStr)) {
      return;
    }
    visited.add(nodeIdStr);

    const node = nodeMap.get(nodeIdStr);
    if (!node) {
      throw new Error(`Node ${nodeIdStr} is referenced in the tree but does not exist.`);
    }

    // Fetch children of the current node from our local list
    const children = allNodes.filter(n => n.parentId && n.parentId.toString() === nodeIdStr);

    // Duplicate position detection among siblings
    const siblingPositions = new Map(); // position -> nodeId
    for (const child of children) {
      if (siblingPositions.has(child.position)) {
        throw new Error(`Duplicate sibling position ${child.position} under parent ${nodeIdStr}.`);
      }
      siblingPositions.set(child.position, child._id.toString());
    }

    // Validate child types and document ownership
    const allowedTypes = ALLOWED_CHILDREN[node.type] || [];
    for (const child of children) {
      const childIdStr = child._id.toString();

      // Parent-child compatibility validation
      if (!allowedTypes.includes(child.type)) {
        throw new Error(`Invalid AST relationship: parent node ${nodeIdStr} of type "${node.type}" cannot contain child node ${childIdStr} of type "${child.type}".`);
      }

      // Document ownership validation
      if (child.documentId.toString() !== docIdStr) {
        throw new Error(`Document ownership mismatch: Node ${childIdStr} belongs to document ${child.documentId}, but is in the tree of document ${docIdStr}.`);
      }

      // Recurse
      traverse(child._id, [...currentPath, nodeIdStr]);
    }
  }

  // 4. Start recursion from root
  traverse(doc.rootNodeId);

  // 5. Verify parent references exist for all nodes and check for missing parents
  for (const node of allNodes) {
    const nodeIdStr = node._id.toString();
    if (nodeIdStr !== rootNodeIdStr) {
      if (!node.parentId) {
        throw new Error(`Missing parent node for node ${nodeIdStr}.`);
      }
      const parentIdStr = node.parentId.toString();
      if (!nodeMap.has(parentIdStr)) {
        throw new Error(`Missing parent node ${parentIdStr} for node ${nodeIdStr}.`);
      }
    }
  }

  // 6. Orphan Node Detection
  for (const node of allNodes) {
    const nodeIdStr = node._id.toString();
    if (!visited.has(nodeIdStr)) {
      throw new Error(`Orphan AST node detected: ${nodeIdStr}.`);
    }
  }
}
