/**
 * PDF Renderer Module
 *
 * Converts a normalized Intermediate Document Representation (IDR) tree
 * into a high-quality, selectable PDF document using PDFKit.
 *
 * STRICT RULE: This renderer accepts ONLY Intermediate Document Representation (IDR)
 * objects. It has zero knowledge of MongoDB, Mongoose, or database models.
 */

import PDFDocument from 'pdfkit';
import {
  PDF_PAGE_CONFIG,
  PDF_TYPOGRAPHY,
  PDF_FONTS,
  PDF_COLORS
} from './pdf.styles.js';
import {
  pdfDocToBuffer,
  ensurePageSpace,
  formatListMarker,
  sanitizeText
} from './pdf.utils.js';

/**
 * Main PDF rendering entry point. Accepts an IDR root document tree and
 * returns a Promise resolving to a PDF binary Buffer.
 *
 * @param {object} idrTree - Normalized Intermediate Document Representation.
 * @param {object} [options={}] - Additional rendering options.
 * @returns {Promise<Buffer>} PDF binary Buffer.
 */
export async function renderIDRToPDF(idrTree, options = {}) {
  if (!idrTree || typeof idrTree !== 'object') {
    throw new Error('PDF Renderer Error: IDR input tree must be a non-null object.');
  }

  // Create new PDFKit Document instance
  const doc = new PDFDocument({
    size: PDF_PAGE_CONFIG.size,
    margins: PDF_PAGE_CONFIG.margins,
    bufferPages: true,
    autoFirstPage: true,
    ...options
  });

  // Start stream accumulation
  const bufferPromise = pdfDocToBuffer(doc);

  // Render root document node and its structural tree
  renderNode(idrTree, doc);

  // Finalize PDF stream
  doc.end();

  return await bufferPromise;
}

/**
 * Recursively dispatches an IDR node to its corresponding block renderer.
 *
 * @param {object} node - IDR node object.
 * @param {PDFDocument} doc - PDFKit Document instance.
 */
function renderNode(node, doc) {
  if (!node || typeof node !== 'object') {
    return;
  }

  switch (node.type) {
    case 'document':
      renderDocument(node, doc);
      break;

    case 'heading':
      renderHeading(node, doc);
      break;

    case 'paragraph':
      renderParagraph(node, doc);
      break;

    case 'code_block':
      renderCodeBlock(node, doc);
      break;

    case 'list':
      renderList(node, doc);
      break;

    case 'quote':
      renderQuote(node, doc);
      break;

    case 'section':
      renderSection(node, doc);
      break;

    case 'unsupported':
      renderUnsupported(node, doc);
      break;

    default:
      console.warn(`[PDF Renderer] Unknown IDR node type "${node.type}". Using fallback renderer.`);
      renderUnsupported(node, doc);
      break;
  }
}

/**
 * Recursively renders child nodes of an IDR node.
 *
 * @param {Array} children - Array of IDR child nodes.
 * @param {PDFDocument} doc - PDFKit Document instance.
 */
function renderChildren(children, doc) {
  if (!Array.isArray(children) || children.length === 0) {
    return;
  }

  for (const child of children) {
    renderNode(child, doc);
  }
}

/**
 * Renders the Root Document Header and its child blocks.
 */
function renderDocument(node, doc) {
  const titleText = sanitizeText(node.title);

  if (titleText) {
    ensurePageSpace(doc, 50);

    const style = PDF_TYPOGRAPHY.documentTitle;
    doc
      .font(style.font)
      .fontSize(style.size)
      .fillColor(style.color)
      .text(titleText, { align: 'left' });

    doc.moveDown(0.5);

    // Draw horizontal rule under document title
    const currentY = doc.y;
    const startX = doc.page.margins.left;
    const endX = doc.page.width - doc.page.margins.right;

    doc
      .strokeColor(PDF_COLORS.codeBorder)
      .lineWidth(1)
      .moveTo(startX, currentY)
      .lineTo(endX, currentY)
      .stroke();

    doc.moveDown(1);
  }

  renderChildren(node.children, doc);
}

/**
 * Renders a Heading block (levels 1-6).
 */
function renderHeading(node, doc) {
  const text = sanitizeText(node.content?.text);
  if (!text) {
    renderChildren(node.children, doc);
    return;
  }

  const rawLevel = Number(node.content?.level);
  const level = Number.isInteger(rawLevel) ? Math.min(Math.max(rawLevel, 1), 3) : 1;
  const style = PDF_TYPOGRAPHY.heading[level] || PDF_TYPOGRAPHY.heading[1];

  ensurePageSpace(doc, style.size + style.spaceBefore + style.spaceAfter);

  if (style.spaceBefore) {
    doc.y += style.spaceBefore / 2;
  }

  doc
    .font(style.font)
    .fontSize(style.size)
    .fillColor(style.color)
    .text(text, {
      align: 'left',
      lineBreak: true
    });

  doc.y += style.spaceAfter / 2;

  renderChildren(node.children, doc);
}

/**
 * Renders a Paragraph block.
 */
function renderParagraph(node, doc) {
  const text = sanitizeText(node.content?.text);
  if (!text) {
    renderChildren(node.children, doc);
    return;
  }

  const style = PDF_TYPOGRAPHY.paragraph;
  ensurePageSpace(doc, 25);

  doc
    .font(style.font)
    .fontSize(style.size)
    .fillColor(style.color)
    .text(text, {
      align: 'left',
      lineGap: style.lineGap,
      lineBreak: true
    });

  doc.y += style.spaceAfter / 2;

  renderChildren(node.children, doc);
}

/**
 * Renders a Code Block with Courier monospace font, background box, and optional language tag.
 */
function renderCodeBlock(node, doc) {
  const codeText = sanitizeText(node.content?.text);
  const language = sanitizeText(node.content?.language || 'text');

  if (!codeText) {
    renderChildren(node.children, doc);
    return;
  }

  const style = PDF_TYPOGRAPHY.codeBlock;
  const marginX = doc.page.margins.left;
  const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const padding = style.padding;

  doc.font(style.font).fontSize(style.size);
  const headerHeight = language ? 14 : 0;

  // Calculate code block text height using width constraint
  const textHeight = doc.heightOfString(codeText, { width: contentWidth - padding * 2 });
  const boxHeight = textHeight + padding * 2 + headerHeight;

  ensurePageSpace(doc, Math.min(boxHeight + 10, 100));

  const startY = doc.y;
  const pageBottom = doc.page.height - doc.page.margins.bottom;
  const availableOnPage = Math.max(pageBottom - startY, 20);
  const renderRectHeight = Math.min(boxHeight, availableOnPage);

  // Render background box and border
  doc
    .rect(marginX, startY, contentWidth, renderRectHeight)
    .fillAndStroke(style.backgroundColor, style.borderColor);

  // Render language tag if present
  let textStartY = startY + padding;
  if (language) {
    doc
      .font(PDF_FONTS.monospaceBold)
      .fontSize(8)
      .fillColor(PDF_COLORS.quoteAuthor)
      .text(`// ${language.toUpperCase()}`, marginX + padding, startY + 4, {
        width: contentWidth - padding * 2,
        align: 'right'
      });

    textStartY += 10;
  }

  // Render syntax code content
  doc
    .font(style.font)
    .fontSize(style.size)
    .fillColor(style.color)
    .text(codeText, marginX + padding, textStartY, {
      width: contentWidth - padding * 2,
      lineBreak: true
    });

  doc.y = startY + boxHeight + style.spaceAfter;

  renderChildren(node.children, doc);
}

/**
 * Renders an Ordered or Unordered List block.
 */
function renderList(node, doc) {
  const items = Array.isArray(node.content?.items) ? node.content.items : [];
  const styleType = node.content?.style === 'ordered' ? 'ordered' : 'unordered';
  const style = PDF_TYPOGRAPHY.list;

  const leftMargin = doc.page.margins.left + style.indent;
  const contentWidth = doc.page.width - leftMargin - doc.page.margins.right;

  for (let i = 0; i < items.length; i++) {
    const itemText = sanitizeText(items[i]);
    if (!itemText) continue;

    ensurePageSpace(doc, 18);

    const marker = formatListMarker(i, styleType);

    const itemY = doc.y;

    // Render list marker (bullet or number)
    doc
      .font(PDF_FONTS.bold)
      .fontSize(style.size)
      .fillColor(style.color)
      .text(marker, leftMargin - 12, itemY, { width: 12, align: 'left' });

    // Render item content text
    doc
      .font(style.font)
      .fontSize(style.size)
      .fillColor(style.color)
      .text(itemText, leftMargin, itemY, {
        width: contentWidth,
        lineBreak: true
      });

    doc.y += style.spaceAfter / 2;
  }

  renderChildren(node.children, doc);
}

/**
 * Renders a Quote block with left vertical border bar and author citation.
 */
function renderQuote(node, doc) {
  const quoteText = sanitizeText(node.content?.text);
  const author = sanitizeText(node.content?.author);

  if (!quoteText) {
    renderChildren(node.children, doc);
    return;
  }

  const style = PDF_TYPOGRAPHY.quote;
  const marginX = doc.page.margins.left + style.indent;
  const contentWidth = doc.page.width - marginX - doc.page.margins.right;

  doc.font(style.font).fontSize(style.size);
  const quoteHeight = doc.heightOfString(quoteText, { width: contentWidth });
  const authorHeight = author ? 14 : 0;
  const totalBoxHeight = quoteHeight + authorHeight + style.padding;

  ensurePageSpace(doc, totalBoxHeight + 10);

  const startY = doc.y;

  // Draw left vertical accent line
  doc
    .strokeColor(style.barColor)
    .lineWidth(3)
    .moveTo(marginX - 6, startY)
    .lineTo(marginX - 6, startY + totalBoxHeight)
    .stroke();

  // Render quote body text
  doc
    .font(style.font)
    .fontSize(style.size)
    .fillColor(style.color)
    .text(`"${quoteText}"`, marginX, startY + 2, {
      width: contentWidth,
      lineBreak: true
    });

  // Render author attribution if present
  if (author) {
    doc
      .font(style.authorFont)
      .fontSize(style.authorSize)
      .fillColor(style.authorColor)
      .text(`— ${author}`, marginX, doc.y + 3, {
        width: contentWidth,
        align: 'left'
      });
  }

  doc.y += style.spaceAfter;

  renderChildren(node.children, doc);
}

/**
 * Renders a Section container block.
 */
function renderSection(node, doc) {
  const title = sanitizeText(node.content?.title);

  if (title) {
    const style = PDF_TYPOGRAPHY.section;
    ensurePageSpace(doc, 25);

    doc
      .font(style.font)
      .fontSize(style.size)
      .fillColor(style.color)
      .text(title, { align: 'left' });

    doc.y += style.spaceAfter / 2;
  }

  renderChildren(node.children, doc);
}

/**
 * Renders a fallback note for Unsupported node types.
 */
function renderUnsupported(node, doc) {
  const originalType = sanitizeText(node.originalType || node.type || 'unknown');
  const style = PDF_TYPOGRAPHY.unsupported;

  ensurePageSpace(doc, 15);

  doc
    .font(style.font)
    .fontSize(style.size)
    .fillColor(style.color)
    .text(`[Unsupported content block: ${originalType}]`, { align: 'left' });

  doc.y += style.spaceAfter;

  renderChildren(node.children, doc);
}

export default renderIDRToPDF;

