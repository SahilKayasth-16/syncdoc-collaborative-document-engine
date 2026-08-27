/**
 * Transformation Utility Helpers
 *
 * Provides reusable validation, extraction, normalization, and sorting
 * functions for the SyncDoc backend transformation engine.
 */

/**
 * Validates AST input tree container or root node.
 *
 * @param {object} input - AST input tree or root node.
 * @throws {Error} If input is invalid, null, or missing a root node.
 * @returns {{ rootNode: object, documentTitle: string|null, documentId: string|null }}
 */
export function validateASTInput(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('Invalid AST input: document input must be a non-null object.');
  }

  let rootNode = null;
  let documentTitle = null;
  let documentId = null;

  // Case A: Input is a document tree wrapper { id, title, root, ... }
  if (input.root && typeof input.root === 'object') {
    rootNode = input.root;
    documentTitle = input.title ?? null;
    documentId = input.id ? String(input.id) : null;
  }
  // Case B: Input is directly the root AST node { id/documentId, type: 'document', ... }
  else if (input.type === 'document' || input.id || input._id) {
    rootNode = input;
    documentTitle = input.title ?? input.data?.title ?? null;
    documentId = input.documentId ? String(input.documentId) : (input.id ? String(input.id) : null);
  }

  if (!rootNode) {
    throw new Error('Invalid AST input: document root node is missing or invalid.');
  }

  const rootId = rootNode.id ?? rootNode._id;
  if (!rootId && rootNode.type !== 'document') {
    throw new Error('Invalid AST input: root node must possess a valid identifier.');
  }

  return {
    rootNode,
    documentTitle,
    documentId: documentId || (rootId ? String(rootId) : null)
  };
}

/**
 * Safely extracts text content from an AST node.
 * Supports direct data fields (data.content, data.text), numeric/primitive content, and
 * recursive inline text children (e.g. type: 'text' nodes).
 *
 * @param {object} node - AST node object.
 * @returns {string} Extracted plain text content.
 */
export function extractTextContent(node) {
  if (!node || typeof node !== 'object') {
    return '';
  }

  if (node.data?.content !== undefined && node.data?.content !== null) {
    return typeof node.data.content === 'string'
      ? node.data.content
      : String(node.data.content);
  }

  if (node.data?.text !== undefined && node.data?.text !== null) {
    return typeof node.data.text === 'string'
      ? node.data.text
      : String(node.data.text);
  }

  // Fallback: If node has child text nodes (e.g. text leaf nodes in schema)
  if (Array.isArray(node.children) && node.children.length > 0) {
    const textPieces = [];
    for (const child of node.children) {
      if (child && child.type === 'text') {
        const textVal = child.data?.content ?? child.data?.text ?? '';
        if (textVal) {
          textPieces.push(String(textVal));
        }
      }
    }
    if (textPieces.length > 0) {
      return textPieces.join('');
    }
  }

  return '';
}

/**
 * Counts total block nodes in an AST or IDR node tree recursively (excluding document root).
 *
 * @param {object} treeNode - Root document node or container node.
 * @returns {number} Count of child/descendant block nodes.
 */
export function countASTNodes(treeNode) {
  if (!treeNode || typeof treeNode !== 'object') {
    return 0;
  }

  let count = treeNode.type === 'document' ? 0 : 1;

  if (Array.isArray(treeNode.children)) {
    for (const child of treeNode.children) {
      count += countASTNodes(child);
    }
  }

  return count;
}

/**
 * Normalizes node formatting metadata by excluding content-specific fields.
 *
 * @param {object} [data={}] - Raw node data object.
 * @param {string[]} [excludeKeys=[]] - Data keys consumed by content.
 * @returns {object} Clean normalized metadata object.
 */
export function normalizeMetadata(data = {}, excludeKeys = []) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return {};
  }

  const excludeSet = new Set(excludeKeys);
  const metadata = {};

  for (const [key, value] of Object.entries(data)) {
    if (!excludeSet.has(key)) {
      // Deep clone or copy primitive values to prevent state mutation
      metadata[key] = typeof value === 'object' && value !== null
        ? JSON.parse(JSON.stringify(value))
        : value;
    }
  }

  return metadata;
}

/**
 * Normalizes a position value to a valid number.
 *
 * @param {number|any} position - Raw position value.
 * @returns {number} Numeric position.
 */
export function normalizePosition(position) {
  const num = Number(position);
  return Number.isFinite(num) ? num : 0;
}

/**
 * Normalizes a node ID to string.
 *
 * @param {any} id - Node ID (string, ObjectId, etc.)
 * @returns {string|null} Stringified ID or null.
 */
export function normalizeId(id) {
  if (id === null || id === undefined) {
    return null;
  }
  if (typeof id === 'object' && typeof id.toString === 'function') {
    return id.toString();
  }
  return String(id);
}

/**
 * Safely sorts sibling children by position in ascending order.
 * Pure operation: returns a new sorted array without mutating original array.
 *
 * @param {Array} [children=[]] - Array of child nodes.
 * @returns {Array} New sorted array of children.
 */
export function sortChildrenByPosition(children = []) {
  if (!Array.isArray(children)) {
    return [];
  }

  return [...children].sort((a, b) => {
    const posA = normalizePosition(a?.position);
    const posB = normalizePosition(b?.position);
    return posA - posB;
  });
}

/**
 * Construct an Intermediate Document Representation object for unsupported node types.
 *
 * @param {object} node - Raw unsupported AST node.
 * @param {Array} [transformedChildren=[]] - Transformed child nodes.
 * @returns {object} Normalized IDR node of type 'unsupported'.
 */
export function createUnsupportedNode(node, transformedChildren = []) {
  const originalType = typeof node?.type === 'string' ? node.type : 'unknown';

  console.warn(
    `[Transformer Warning] Unsupported node type encountered: "${originalType}" (id: ${node?.id ?? node?._id ?? 'unknown'})`
  );

  return {
    id: normalizeId(node?.id ?? node?._id),
    type: 'unsupported',
    originalType,
    position: normalizePosition(node?.position),
    content: {
      rawData: node?.data ? JSON.parse(JSON.stringify(node.data)) : {}
    },
    metadata: normalizeMetadata(node?.data, []),
    children: transformedChildren
  };
}

