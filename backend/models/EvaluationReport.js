/**
 * DataForge — EvaluationReport Model
 * Architecture: MVC Model Layer (Assigned to: Person 1 / Lead Architect)
 */

import mongoose from 'mongoose';

const evaluationReportSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Report title is required'],
      trim: true,
      maxlength: [120, 'Title cannot exceed 120 characters'],
    },
    datasetId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Dataset',
      default: null,
    },
    synthesisJobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SynthesisJob',
      default: null,
    },
    targetColumn: {
      type: String,
      required: [true, 'Target column for TSTR benchmark is required'],
    },
    modelType: {
      type: String,
      enum: ['decision_tree', 'random_forest', 'knn', 'logistic_regression'],
      default: 'decision_tree',
    },
    fidelity: {
      ksPValueMean: { type: Number, default: 0 },
      ksPassedFraction: { type: Number, default: 0 },
      wassersteinMean: { type: Number, default: 0 },
      covarianceFrobeniusNorm: { type: Number, default: 0 },
      dcrPrivacyScore: { type: Number, default: 0 },
      zeroMemorizationRate: { type: Number, default: 100 },
      columnMetrics: [
        {
          column: String,
          ksStat: Number,
          ksPVal: Number,
          wasserstein: Number,
          passed: Boolean,
        },
      ],
    },
    tstrBenchmark: {
      baselineAccuracy: { type: Number, default: 0 },
      baselineF1: { type: Number, default: 0 },
      syntheticAccuracy: { type: Number, default: 0 },
      syntheticF1: { type: Number, default: 0 },
      macroF1Lift: { type: Number, default: 0 },
      confusionMatrix: { type: [[Number]], default: [] },
      verdict: {
        type: String,
        enum: ['VERIFIED_POSITIVE', 'VIABLE_NEUTRAL', 'DEGRADED_REJECT'],
        default: 'VIABLE_NEUTRAL',
      },
    },
    runs: {
      type: Number,
      default: 3,
    },
    trainTestSplit: {
      type: Number,
      default: 0.8,
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

evaluationReportSchema.index({ createdAt: -1 });
evaluationReportSchema.index({ datasetId: 1 });
evaluationReportSchema.index({ 'tstrBenchmark.verdict': 1 });

const EvaluationReport = mongoose.model('EvaluationReport', evaluationReportSchema);

export default EvaluationReport;
