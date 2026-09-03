import { JSDOM } from "jsdom";
import createDOMPurify from "dompurify";
import { ALLOWED_HTML_ATTRIBUTES, 
         ALLOWED_HTML_TAGS, 
         MAX_LIST_ITEMS, 
         MAX_TEXT_LENGTH, 
         SUPPORTED_NODE_TYPES
        } from "./security.constants.js";

/**
 * Creating an instance for Node.js Backend.
 * As DOMPurify requires a DOM implementation provided by jsdom.
 */
const window = new JSDOM("").window;

const DOMPurify = createDOMPurify(window);

/**
 * Sanitize values as plain text.
 * 
 * SyncDoc currently does not support rich HTML editing.
 * 
 * @param {*} value
 * @returns {string}
 */
export const sanitizePlainText = (value) => {
    if (value === null || value === undefined) {
        return "";
    }

    if (typeof value !== "string") {
        return String(value);
    }
    /**
     * DOMPurify removes HTML and dangerous attributes/protocols.
     * With no allowed tags and attributes, the resulting value contains only textual content. 
     */
    const sanitized = DOMPurify.sanitize(value, {
        ALLOWED_TAGS: ALLOWED_HTML_TAGS,
        ALLOWED_ATTRIBUTES: ALLOWED_HTML_ATTRIBUTES,
        KEEP_CONTENT: true
    });

    return sanitized.slice(0, MAX_TEXT_LENGTH);
}

/**
 * Sanitize a list item.
 *
 * List items in the current architecture are treated as
 * plain-text values.
 *
 * @param {*} item
 * @returns {*}
 */
const sanitizeListItem = (item) => {
    if (typeof item === "string") {
        return sanitizePlainText(item);
    }
    /**
     * If the list item is an object, preserve its structure
     * while sanitizing known textual fields.
     */

    if (item && typeof item === "object") {
        const sanitizedItem = { ...item };

        if ("content" in sanitizedItem) {
            sanitizedItem.content = sanitizePlainText(sanitizedItem.content);
        }

        if ("text" in sanitizedItem) {
            sanitizedItem.text = sanitizePlainText(sanitizedItem.text);
        }

        return sanitizedItem;
    }

    return item;
};

/**
 * Sanitize AST node data according to its node type.
 *
 * @param {string} type
 * @param {object} data
 * @returns {object}
 */
const sanitizeNodeData = (type, data) => {
    if (!data || typeof data !== "object") {
        return {};
    }

    const sanitized = {...data };

    switch (type) {
        case "heading":

        case "paragraph":

        case "code_block":

        case "text": {
            if ("content" in sanitized ) {
                sanitized.content = sanitizePlainText(sanitized.content);
            }
            break
        }

        case "quote": {
            if ("content" in sanitized ) {
                sanitized.content = sanitizePlainText(sanitized.content);
            }

            if ("author" in sanitized ) {
                sanitized.author = sanitizePlainText(sanitized.author);
            }

            break;
        }

        case "list": {
            if (Array.isArray(sanitized.items)) {
                sanitized.items = sanitized.items.slice(0, MAX_LIST_ITEMS).map(sanitizeListItem);
            }

            break;
        }

        case "document":

        case "section":
            /**
             * These nodes currently do not have known textual
             * fields inside `data`.
             *
             * Preserve their metadata as-is.
             */
            break;

        default:
            /**
             * Unknown node types are handled safely.
             *
             * We do not attempt to interpret unknown data.
             */
            break;
    }

    return sanitized;
};

/**
 * Recursively sanitize an AST node.
 *
 * Important:
 * Does not mutate the original node.
 * Preserves node identity fields.
 * Recursively processes children.
 * Sanitizes known user-controlled fields.
 * Handles malformed nodes safely.
 *
 * @param {*} node
 * @returns {object|null}
 */
export const sanitizeASTNode = (node) => {
    if (!node || typeof node !== "object") {
        return null;
    }

    const type = typeof node.type === "string" ? node.type : "unknown";

    const sanitizedNode = {
        ... node,

        data: sanitizeNodeData(
            type,
            node.data
        ),

        children: Array.isArray(node.children) ? node.children.map(sanitizeASTNode).filter(Boolean) : []
    };

     /**
     * Unknown node types are retained rather than causing
     * the entire document to fail.
     *
     * The caller can decide whether unsupported nodes should
     * later be ignored by the transformation/PDF layer.
     */

     if (!SUPPORTED_NODE_TYPES.includes(type)) {
        sanitizedNode.type = type;
     }

     return sanitizedNode;
};

/**
 * Sanitize an entire AST tree.
 *
 * @param {*} documentTree
 * @returns {object|null}
 */
export const sanitizeAST = (documentTree) => {
    if (!documentTree || typeof documentTree !== "object") {
        return null;
    }

    const sanitizedDocument = {
        ...documentTree
    };

    /**
     * Sanitize Document Title
     */
    if ("title" in sanitizedDocument) {
        sanitizedDocument.title = sanitizePlainText(sanitizedDocument.title);
    }

    /**
     * Sanitize root recursively
     */
    if (sanitizedDocument.root) {
        sanitizedDocument.root = sanitizeASTNode(sanitizedDocument.root);
    }

    return sanitizedDocument;
}

/**
 * Determine whether a node type is supported.
 *
 * @param {*} type
 * @returns {boolean}
 */
export const isSupportedNodeType = (type) => {
    return SUPPORTED_NODE_TYPES.includes(type);
};