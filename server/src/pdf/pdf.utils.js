/**
 * PDF Generator Utility Helpers
 *
 * Helper utilities for buffer stream accumulation, page break management,
 * and text formatting for the PDF renderer.
 */

/**
 * Accumulates PDFDocument stream events into a Buffer resolving on document finish.
 *
 * @param {PDFDocument} doc - PDFKit Document instance.
 * @returns {Promise<Buffer>} Resolves to completed PDF Buffer.
 */
export function pdfDocToBuffer(doc) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    doc.on('data', chunk => {
      chunks.push(chunk);
    });

    doc.on('end', () => {
      const resultBuffer = Buffer.concat(chunks);
      resolve(resultBuffer);
    });

    doc.on('error', err => {
      reject(err);
    });
  });
}

/**
 * Checks remaining vertical space on current page and triggers a page break if needed.
 *
 * @param {PDFDocument} doc - PDFKit Document instance.
 * @param {number} requiredHeight - Height in points required for upcoming block.
 */
export function ensurePageSpace(doc, requiredHeight = 20) {
  const bottomMargin = doc.page.margins.bottom;
  const pageBottom = doc.page.height - bottomMargin;

  if (doc.y + requiredHeight > pageBottom) {
    doc.addPage();
  }
}

/**
 * Generates item bullet or number prefix based on list style and 0-indexed position.
 *
 * @param {number} index - Item index in list.
 * @param {string} style - List style ('ordered' or 'unordered').
 * @returns {string} Formatted list marker prefix.
 */
export function formatListMarker(index, style = 'unordered') {
  if (style === 'ordered') {
    return `${index + 1}.`;
  }
  return '•';
}

/**
 * Sanitizes and normalizes raw text input to prevent rendering undefined/null text.
 *
 * @param {any} input - Raw text value.
 * @returns {string} Clean string value.
 */
export function sanitizeText(input) {
  if (typeof input === 'string') {
    return input;
  }
  if (input === null || input === undefined) {
    return '';
  }
  return String(input);
}

