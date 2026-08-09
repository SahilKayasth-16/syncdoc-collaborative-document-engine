import mongoose from 'mongoose';

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

const Document = mongoose.model('Document', DocumentSchema);
export default Document;
