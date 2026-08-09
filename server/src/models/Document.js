import mongoose from 'mongoose';
import { validateDocumentTree } from '../validators/ast.validator.js';

const DocumentSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Document title is required'],
    trim: true,
    validate: {
      validator: function(v) {
        return v && v.trim().length > 0;
      },
      message: 'Document title cannot be blank'
    }
  },
  rootNodeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ASTNode',
    required: [true, 'Root node ID is required']
  }
}, {
  timestamps: true
});

// Document pre-save tree validation
DocumentSchema.pre('save', async function(next) {
  if (this.bypassTreeValidation) {
    return next();
  }

  try {
    const ASTNode = mongoose.model('ASTNode');
    const rootExists = await ASTNode.exists({ _id: this.rootNodeId });
    if (rootExists) {
      await validateDocumentTree(this._id);
    }
    next();
  } catch (error) {
    next(error);
  }
});

const Document = mongoose.model('Document', DocumentSchema);
export default Document;
