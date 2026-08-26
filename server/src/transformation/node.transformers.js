/**
 * Node Transformers Module
 *
 * Implements node-type-specific transformation logic for converting
 * MongoDB / AST nodes into normalized Intermediate Document Representation (IDR) nodes.
 */

import {
  extractTextContent,
  normalizeMetadata,
  normalizePosition,
  normalizeId,
  createUnsupportedNode
} from './transformation.utils.js';

/**
 * Transforms a root document node into an IDR document node.
 *
 * @param {object} node - AST node of type 'document'.
 * @param {object} context - Transformation context (e.g. document title, visited set).
 * @param {Function} transformChildren - Callback to recursively transform child nodes.
 * @returns {object} IDR Document Node.
 */
export function transformDocumentNode(node, context, transformChildren) {
  const documentId = context.documentId ?? normalizeId(node.id ?? node._id);
  const documentTitle = context.documentTitle ?? node.title ?? node.data?.title ?? '';

  return {
    id: documentId,
    type: 'document',
    title: documentTitle,
    metadata: normalizeMetadata(node.data, ['title']),
    children: transformChildren(node.children, context)
  };
}

/**
 * Transforms a heading node into an IDR heading node.
 *
 * @param {object} node - AST node of type 'heading'.
 * @param {object} context - Transformation context.
 * @param {Function} transformChildren - Callback to recursively transform child nodes.
 * @returns {object} IDR Heading Node.
 */
export function transformHeadingNode(node, context, transformChildren) {
  const rawLevel = Number(node.data?.level);
  const level = Number.isInteger(rawLevel) ? Math.min(Math.max(rawLevel, 1), 6) : 1;

  return {
    id: normalizeId(node.id ?? node._id),
    type: 'heading',
    position: normalizePosition(node.position),
    content: {
      text: extractTextContent(node),
      level
    },
    metadata: normalizeMetadata(node.data, ['content', 'text', 'level']),
    children: transformChildren(node.children, context)
  };
}

/**
 * Transforms a paragraph node into an IDR paragraph node.
 *
 * @param {object} node - AST node of type 'paragraph'.
 * @param {object} context - Transformation context.
 * @param {Function} transformChildren - Callback to recursively transform child nodes.
 * @returns {object} IDR Paragraph Node.
 */
export function transformParagraphNode(node, context, transformChildren) {
  return {
    id: normalizeId(node.id ?? node._id),
    type: 'paragraph',
    position: normalizePosition(node.position),
    content: {
      text: extractTextContent(node)
    },
    metadata: normalizeMetadata(node.data, ['content', 'text']),
    children: transformChildren(node.children, context)
  };
}

/**
 * Transforms a code block node into an IDR code block node.
 *
 * @param {object} node - AST node of type 'code_block'.
 * @param {object} context - Transformation context.
 * @param {Function} transformChildren - Callback to recursively transform child nodes.
 * @returns {object} IDR Code Block Node.
 */
export function transformCodeBlockNode(node, context, transformChildren) {
  const language = typeof node.data?.language === 'string' && node.data.language.trim()
    ? node.data.language.trim()
    : 'text';

  return {
    id: normalizeId(node.id ?? node._id),
    type: 'code_block',
    position: normalizePosition(node.position),
    content: {
      text: extractTextContent(node),
      language
    },
    metadata: normalizeMetadata(node.data, ['content', 'text', 'language', 'code']),
    children: transformChildren(node.children, context)
  };
}

/**
 * Transforms a list node into an IDR list node.
 *
 * @param {object} node - AST node of type 'list'.
 * @param {object} context - Transformation context.
 * @param {Function} transformChildren - Callback to recursively transform child nodes.
 * @returns {object} IDR List Node.
 */
export function transformListNode(node, context, transformChildren) {
  const style = node.data?.style === 'ordered' ? 'ordered' : 'unordered';
  const items = Array.isArray(node.data?.items)
    ? node.data.items.map(item => typeof item === 'string' ? item : String(item ?? ''))
    : [];

  return {
    id: normalizeId(node.id ?? node._id),
    type: 'list',
    position: normalizePosition(node.position),
    content: {
      style,
      items
    },
    metadata: normalizeMetadata(node.data, ['style', 'items']),
    children: transformChildren(node.children, context)
  };
}

/**
 * Transforms a quote node into an IDR quote node.
 *
 * @param {object} node - AST node of type 'quote'.
 * @param {object} context - Transformation context.
 * @param {Function} transformChildren - Callback to recursively transform child nodes.
 * @returns {object} IDR Quote Node.
 */
export function transformQuoteNode(node, context, transformChildren) {
  const author = typeof node.data?.author === 'string'
    ? node.data.author
    : (node.data?.author ?? null);

  return {
    id: normalizeId(node.id ?? node._id),
    type: 'quote',
    position: normalizePosition(node.position),
    content: {
      text: extractTextContent(node),
      author
    },
    metadata: normalizeMetadata(node.data, ['content', 'text', 'author']),
    children: transformChildren(node.children, context)
  };
}

/**
 * Transforms a section container node into an IDR section node.
 *
 * @param {object} node - AST node of type 'section'.
 * @param {object} context - Transformation context.
 * @param {Function} transformChildren - Callback to recursively transform child nodes.
 * @returns {object} IDR Section Node.
 */
export function transformSectionNode(node, context, transformChildren) {
  const title = typeof node.data?.title === 'string'
    ? node.data.title
    : extractTextContent(node);

  return {
    id: normalizeId(node.id ?? node._id),
    type: 'section',
    position: normalizePosition(node.position),
    content: {
      title
    },
    metadata: normalizeMetadata(node.data, ['title', 'content', 'text']),
    children: transformChildren(node.children, context)
  };
}

/**
 * Transforms an unsupported node into an IDR unsupported node.
 *
 * @param {object} node - AST node with unknown type.
 * @param {object} context - Transformation context.
 * @param {Function} transformChildren - Callback to recursively transform child nodes.
 * @returns {object} IDR Unsupported Node.
 */
export function transformUnsupportedNode(node, context, transformChildren) {
  const transformedChildren = transformChildren(node.children, context);
  return createUnsupportedNode(node, transformedChildren);
}

/**
 * Map of supported node types to their corresponding transformer handler.
 */
export const nodeTransformers = {
  document: transformDocumentNode,
  heading: transformHeadingNode,
  paragraph: transformParagraphNode,
  code_block: transformCodeBlockNode,
  list: transformListNode,
  quote: transformQuoteNode,
  section: transformSectionNode
};
