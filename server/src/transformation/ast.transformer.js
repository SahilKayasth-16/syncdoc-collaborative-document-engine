/**
 * AST Transformer Engine
 *
 * Core backend transformation layer for SyncDoc. Converts a loaded AST tree
 * into a clean, normalized Intermediate Document Representation (IDR)
 * suitable for future rendering and PDF export.
 */

import {
  validateASTInput,
  sortChildrenByPosition,
  normalizeId
} from './transformation.utils.js';

import {
  nodeTransformers,
  transformUnsupportedNode
} from './node.transformers.js';

/**
 * Recursively transforms an individual AST node and its child hierarchy.
 *
 * @param {object} node - AST node to transform.
 * @param {object} context - Shared transformation context.
 * @returns {object|null} Transformed IDR node object, or null if skipped.
 */
function transformNode(node, context) {
  if (!node || typeof node !== 'object') {
    return null;
  }

  // Identity & duplicate reference protection
  const nodeId = normalizeId(node.id ?? node._id);
  if (nodeId) {
    if (context.visited.has(nodeId)) {
      console.warn(`[Transformer Warning] Duplicate node reference detected and skipped for node ID: ${nodeId}`);
      return null;
    }
    context.visited.add(nodeId);
  }

  const nodeType = typeof node.type === 'string' ? node.type : '';
  const handler = nodeTransformers[nodeType] || transformUnsupportedNode;

  return handler(node, context, transformChildNodes);
}

/**
 * Transforms an array of child AST nodes.
 * Orders siblings by position ascending and filters out null/invalid nodes.
 *
 * @param {Array} children - Array of child AST nodes.
 * @param {object} context - Shared transformation context.
 * @returns {Array} Array of transformed IDR child nodes.
 */
function transformChildNodes(children, context) {
  if (!Array.isArray(children)) {
    return [];
  }

  // Sort siblings by position ascending (pure, non-mutating copy)
  const sortedSiblings = sortChildrenByPosition(children);
  const transformedChildren = [];

  for (const child of sortedSiblings) {
    if (!child || typeof child !== 'object') {
      console.warn('[Transformer Warning] Skipping invalid or null child node in AST array.');
      continue;
    }

    const transformed = transformNode(child, context);
    if (transformed) {
      transformedChildren.push(transformed);
    }
  }

  return transformedChildren;
}

/**
 * Transforms an entire AST document tree into its Intermediate Document Representation (IDR).
 *
 * @param {object} astInput - Input document container ({ id, title, root: ... }) or root AST node.
 * @param {object} [options={}] - Transformation options.
 * @throws {Error} If root input is null or malformed.
 * @returns {object} The normalized Intermediate Document Representation (IDR) tree.
 */
export function transformAST(astInput, options = {}) {
  // 1. Validate root input and extract identity
  const { rootNode, documentTitle, documentId } = validateASTInput(astInput);

  // 2. Initialize transformation context
  const context = {
    documentTitle,
    documentId,
    visited: new Set(),
    ...options
  };

  // 3. Perform recursive pure transformation starting at root node
  const transformedRoot = transformNode(rootNode, context);

  if (!transformedRoot) {
    throw new Error('Failed to transform document root node.');
  }

  return transformedRoot;
}

export default transformAST;

