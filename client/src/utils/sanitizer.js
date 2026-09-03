/**
 * Client-Side Plain-Text Sanitizer for SyncDoc
 *
 * Ensures user-controlled input (document titles, paragraph text, heading text, etc.)
 * is stripped of executable HTML/Script tags before updating local React state,
 * Yjs collaborative document maps, or sending requests to the backend.
 */

export const sanitizePlainText = (value) => {
    if (value === null || value === undefined) {
        return "";
    }

    if (typeof value !== "string") {
        return String(value);
    }

    if (!value.trim()) {
        return value;
    }

    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(value, "text/html");

        // Remove script, style, iframe, object, embed, svg elements completely (including inner text of script/style)
        const dangerousElements = doc.querySelectorAll("script, style, iframe, object, embed, svg");
        dangerousElements.forEach((el) => el.remove());

        // Extract textContent from body
        const cleanText = doc.body.textContent || "";
        return cleanText.slice(0, 100000);
    } catch {
        // Fallback simple regex tag stripping if DOMParser fails
        return value.replace(/<[^>]*>?/gm, "").slice(0, 100000);
    }
};

/**
 * Sanitize block data fields based on block type.
 *
 * @param {string} type
 * @param {object} data
 * @returns {object}
 */
export const sanitizeNodeData = (type, data) => {
    if (!data || typeof data !== "object") {
        return {};
    }

    const sanitized = { ...data };

    switch (type) {
        case "heading":
        case "paragraph":
        case "code_block":
        case "text": {
            if ("content" in sanitized) {
                sanitized.content = sanitizePlainText(sanitized.content);
            }
            break;
        }

        case "quote": {
            if ("content" in sanitized) {
                sanitized.content = sanitizePlainText(sanitized.content);
            }
            if ("author" in sanitized) {
                sanitized.author = sanitizePlainText(sanitized.author);
            }
            break;
        }

        case "list": {
            if (Array.isArray(sanitized.items)) {
                sanitized.items = sanitized.items.map((item) => {
                    if (typeof item === "string") {
                        return sanitizePlainText(item);
                    }
                    if (item && typeof item === "object") {
                        const sItem = { ...item };
                        if ("content" in sItem) sItem.content = sanitizePlainText(sItem.content);
                        if ("text" in sItem) sItem.text = sanitizePlainText(sItem.text);
                        return sItem;
                    }
                    return item;
                });
            }
            break;
        }

        default:
            break;
    }

    return sanitized;
};

