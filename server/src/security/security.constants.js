/**
 * SynDoc Security Constants:
 * 
 * No rich HTML is required by the current editor architecture.
 * Therefore, the safest policy is to remove all HTML markup from
 * user-controlled document content.
 */

/**
 * Fields that are explicitly treated as plain-text content.
 *
 * These paths represent user-controlled values inside the AST.
 */
export const PLAIN_TEXT_FIELDS = Object.freeze([
    "document.title", "heading.data.content", "paragraph.data.content", "code_block.data.content", "quote.data.content", "quote.data.author", "text.data.content", "list.data.items"
]);

/**
 * DOMPurify is configured with an empty allow list so-that
 * arbitrary HTML cannot survive sanitization.
 */
export const ALLOWED_HTML_TAGS = Object.freeze([]);

/**
 * No HTML attributes are currently required by SyncDoc.
 */
export const ALLOWED_HTML_ATTRIBUTES = Object.freeze([]);

/**
 * Current node tpyes supported by AST.
 */
export const SUPPORTED_NODE_TYPES = Object.freeze([
    "document", "section", "heading", "paragraph", "code_block", "list", "quote", "text"
]);

/**
 * Maximum length for individual text fields. A limit against unnecessarily 
 * huge payloads reaching transformation/rendering pipeline.
 */
export const MAX_TEXT_LENGTH = 100000;

/**
 * Maximum list items accepted by the sanitizer.
 */
export const MAX_LIST_ITEMS = 10000;