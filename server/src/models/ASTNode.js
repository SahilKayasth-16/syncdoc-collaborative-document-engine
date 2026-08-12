import mongoose from 'mongoose';
import { validateDocumentTree } from '../validators/ast.validator.js';

const ASTNodeSchema = new mongoose.Schema({
  documentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Document',
    required: [true, 'Document ID is required']
  },
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ASTNode',
    default: null
  },
  type: {
    type: String,
    required: [true, 'Node type is required'],
    enum: {
      values: ['document', 'section', 'heading', 'paragraph', 'code_block', 'text', 'list', 'quote'],
      message: '{VALUE} is not a valid node type'
    }
  },
  position: {
    type: Number,
    required: [true, 'Position is required']
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: () => ({}),
    validate: {
      validator: function(v) {
        return typeof v === 'object' && v !== null && !Array.isArray(v);
      },
      message: 'data must be a valid plain object'
    }
  }
}, {
  timestamps: true
});

// Root node constraints:
// 1. If type is 'document', parentId must be null
ASTNodeSchema.path('type').validate(function(value) {
  if (value === 'document' && this.parentId !== null) {
    return false;
  }
  return true;
}, 'Root document node must have parentId set to null');

// 2. If parentId is null, type must be 'document'
ASTNodeSchema.path('parentId').validate(function(value) {
  if (value === null && this.type !== 'document') {
    return false;
  }
  return true;
}, 'Only root document nodes can have a null parentId');

// Add Indexes
ASTNodeSchema.index({ documentId: 1 });
ASTNodeSchema.index({ parentId: 1 });
ASTNodeSchema.index({ documentId: 1, parentId: 1, position: 1 });

// Pre-save hook for deep recursive validation
ASTNodeSchema.pre('save', async function(next) {
  // Allow bypassing tree validation (useful during initial root creation or seeding)
  if (this.bypassTreeValidation) {
    return next();
  }

  try {
    const Document = mongoose.model('Document');
    const docExists = await Document.exists({ _id: this.documentId });

    // If the document container exists in the database, we can validate the entire tree
    if (docExists) {
      await validateDocumentTree(this.documentId, this);
    }
    next();
  } catch (error) {
    next(error);
  }
});

const ASTNode = mongoose.model('ASTNode', ASTNodeSchema);
export default ASTNode;
