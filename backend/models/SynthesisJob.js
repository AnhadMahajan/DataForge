/**
 * DataForge — SynthesisJob Model
 * Architecture: MVC Model Layer (Assigned to: Person 1 / Lead Architect)
 */

import mongoose from 'mongoose';

const synthesisJobSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Synthesis job name is required'],
      trim: true,
      maxlength: [100, 'Job name cannot exceed 100 characters'],
    },
    datasetId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Dataset',
      default: null,
    },
    algorithm: {
      type: String,
      required: [true, 'Synthesis algorithm is required'],
      enum: {
        values: ['copula', 'kde', 'smote', 'adasyn', 'gaussian_jitter'],
        message: '{VALUE} is not a supported synthesis algorithm',
      },
      default: 'copula',
    },
    rowCount: {
      type: Number,
      required: [true, 'Target row count is required'],
      min: [1, 'Must synthesize at least 1 row'],
      max: [50000, 'Single batch limit is 50,000 rows'],
      default: 100,
    },
    headers: {
      type: [String],
      required: [true, 'Column headers are required'],
    },
    params: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    seed: {
      type: Number,
      default: 42,
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
    },
    metrics: {
      executionTimeMs: { type: Number, default: 0 },
      generatedRows: { type: Number, default: 0 },
      featureCount: { type: Number, default: 0 },
    },
    resultPreview: {
      type: [[mongoose.Schema.Types.Mixed]],
      default: [],
    },
    syntheticData: {
      type: [[mongoose.Schema.Types.Mixed]],
      default: [],
      select: false, // Don't return huge raw matrix by default in lists
    },
    error: {
      type: String,
      default: null,
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

// Index for high-speed job queries
synthesisJobSchema.index({ status: 1, createdAt: -1 });
synthesisJobSchema.index({ datasetId: 1 });
synthesisJobSchema.index({ createdBy: 1 });

const SynthesisJob = mongoose.model('SynthesisJob', synthesisJobSchema);

export default SynthesisJob;
