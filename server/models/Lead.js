const mongoose = require('mongoose');

const LeadSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: '',
    },
    phone: {
      type: String,
      trim: true,
      default: '',
    },
    company: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: ['New', 'Contacted', 'Qualified', 'Proposal', 'Won', 'Lost'],
      default: 'New',
    },
    value: {
      type: Number,
      default: 0,
      min: 0,
    },
    source: {
      type: String,
      default: 'Excel Import',
      trim: true,
    },
    city: {
      type: String,
      default: '',
      trim: true,
    },
    country: {
      type: String,
      default: '',
      trim: true,
    },
    assignedTo: {
      type: String,
      default: 'Unassigned',
      trim: true,
    },
    notes: {
      type: String,
      default: '',
    },
    tags: {
      type: [String],
      default: [],
    },
    customFields: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Index for fast search across multiple fields
LeadSchema.index({ name: 'text', email: 'text', company: 'text', phone: 'text' });

module.exports = mongoose.model('Lead', LeadSchema);
