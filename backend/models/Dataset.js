/**
 * DataForge — Dataset Model
 * Architecture: MVC Model Layer (Assigned to: Person 3 / Dataset Ingestion & Profiling)
 */

import mongoose from 'mongoose';

/**
 * Per-column statistical profile produced by services/profilingService.js.
 * Numeric stats (min, max, mean, std, skewness) are null for non-numeric columns;
 * classBalance is only populated for categorical columns.
 */
const columnProfileSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Column name is required'],
      trim: true,
    },
    dataType: {
      type: String,
      enum: {
        values: ['numeric', 'categorical', 'datetime'],
        message: '{VALUE} is not a supported column data type',
      },
      default: 'categorical',
    },
    nullCount: { type: Number, default: 0, min: 0 },
    missingPct: { type: Number, default: 0, min: 0, max: 100 },
    uniqueCount: { type: Number, default: 0, min: 0 },
    min: { type: Number, default: null },
    max: { type: Number, default: null },
    mean: { type: Number, default: null },
    std: { type: Number, default: null },
    skewness: { type: Number, default: null },
    classBalance: {
      // Ordered category frequencies — categorical columns only (null otherwise).
      // Stored as an array (not a label-keyed object) so labels containing '.' or '$' are safe.
      type: [
        {
          _id: false,
          value: { type: String },
          count: { type: Number, min: 0 },
          pct: { type: Number, min: 0, max: 100 },
        },
      ],
      default: undefined,
    },
  },
  { _id: false }
);

const datasetSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Dataset name is required'],
      trim: true,
      maxlength: [120, 'Dataset name cannot exceed 120 characters'],
    },
    filename: {
      type: String,
      required: [true, 'Original filename is required'],
      trim: true,
    },
    sizeBytes: {
      type: Number,
      required: [true, 'File size is required'],
      min: [0, 'File size cannot be negative'],
    },
    rowCount: {
      type: Number,
      required: [true, 'Row count is required'],
      min: [0, 'Row count cannot be negative'],
    },
    columnCount: {
      type: Number,
      required: [true, 'Column count is required'],
      min: [0, 'Column count cannot be negative'],
    },
    headers: {
      type: [String],
      required: [true, 'Column headers are required'],
    },
    columns: {
      type: [columnProfileSchema],
      default: [],
    },
    dataMatrix: {
      type: [[mongoose.Schema.Types.Mixed]],
      default: [],
      select: false, // Raw matrix can be large — exclude from queries unless explicitly requested
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for listing queries
datasetSchema.index({ createdBy: 1, createdAt: -1 });
datasetSchema.index({ createdAt: -1 });

const Dataset = mongoose.model('Dataset', datasetSchema);

export default Dataset;
