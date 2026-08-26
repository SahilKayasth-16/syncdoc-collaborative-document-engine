/**
 * PDF Styling Configuration
 *
 * Defines page layout, typography hierarchy, colors, margins, and component
 * spacing for the SyncDoc PDF renderer.
 */

export const PDF_PAGE_CONFIG = {
  size: 'A4',
  margins: {
    top: 50,
    bottom: 50,
    left: 50,
    right: 50
  }
};

export const PDF_FONTS = {
  regular: 'Helvetica',
  bold: 'Helvetica-Bold',
  italic: 'Helvetica-Oblique',
  monospace: 'Courier',
  monospaceBold: 'Courier-Bold'
};

export const PDF_COLORS = {
  title: '#0F172A',         // Slate 900
  h1: '#1E293B',            // Slate 800
  h2: '#334155',            // Slate 700
  h3: '#475569',            // Slate 600
  body: '#374151',          // Gray 700
  codeText: '#1F2937',      // Gray 800
  codeBackground: '#F8FAFC',// Slate 50
  codeBorder: '#CBD5E1',    // Slate 300
  quoteText: '#475569',     // Slate 600
  quoteBar: '#3B82F6',      // Blue 500
  quoteAuthor: '#64748B',   // Slate 500
  unsupportedText: '#94A3B8'// Slate 400
};

export const PDF_TYPOGRAPHY = {
  documentTitle: {
    font: PDF_FONTS.bold,
    size: 24,
    color: PDF_COLORS.title,
    spaceAfter: 16
  },
  heading: {
    1: {
      font: PDF_FONTS.bold,
      size: 20,
      color: PDF_COLORS.h1,
      spaceBefore: 14,
      spaceAfter: 8
    },
    2: {
      font: PDF_FONTS.bold,
      size: 16,
      color: PDF_COLORS.h2,
      spaceBefore: 12,
      spaceAfter: 6
    },
    3: {
      font: PDF_FONTS.bold,
      size: 14,
      color: PDF_COLORS.h3,
      spaceBefore: 10,
      spaceAfter: 4
    }
  },
  paragraph: {
    font: PDF_FONTS.regular,
    size: 11,
    color: PDF_COLORS.body,
    lineGap: 3,
    spaceAfter: 8
  },
  codeBlock: {
    font: PDF_FONTS.monospace,
    size: 10,
    color: PDF_COLORS.codeText,
    backgroundColor: PDF_COLORS.codeBackground,
    borderColor: PDF_COLORS.codeBorder,
    padding: 8,
    spaceAfter: 10
  },
  list: {
    font: PDF_FONTS.regular,
    size: 11,
    color: PDF_COLORS.body,
    indent: 15,
    spaceAfter: 4
  },
  quote: {
    font: PDF_FONTS.italic,
    size: 11,
    color: PDF_COLORS.quoteText,
    barColor: PDF_COLORS.quoteBar,
    authorFont: PDF_FONTS.bold,
    authorSize: 10,
    authorColor: PDF_COLORS.quoteAuthor,
    indent: 15,
    padding: 8,
    spaceAfter: 10
  },
  section: {
    font: PDF_FONTS.bold,
    size: 14,
    color: PDF_COLORS.h2,
    spaceBefore: 12,
    spaceAfter: 6
  },
  unsupported: {
    font: PDF_FONTS.italic,
    size: 9,
    color: PDF_COLORS.unsupportedText,
    spaceAfter: 6
  }
};

