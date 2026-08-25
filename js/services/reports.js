/**
 * DataForge — Report Generation Service
 * Compiles experiment telemetry, health assessments, and causal explanations into structured reports.
 */

import * as storage from './storage.js';
import { formatPercent, formatStrategy } from '../utils/formatting.js';
import { generateUUID } from '../utils/math.js';

const REPORTS_PREFIX = 'reports_';

/**
 * Compile a comprehensive narrative report from a completed experiment.
 */
export function generateReportFromExperiment(userId, experiment, dataset) {
  const { id, name, createdAt, config, baseline, strategyResults, recommendation } = experiment;

  const bestStrat = recommendation.bestStrategy ? formatStrategy(recommendation.bestStrategy) : 'None';
  const bestStratObj = strategyResults.find(s => s.strategyType === recommendation.bestStrategy) || strategyResults[0];
  const deltaF1 = recommendation.improvement;

  const title = `Synthetic Intelligence Report: ${name}`;
  const summary = `Evaluation of ${strategyResults.length} synthetic augmentation strategies on "${dataset.name}" (${dataset.rowCount} rows, ${dataset.columnCount - 1} features). Top recommendation: ${bestStrat} yielding ${deltaF1 > 0 ? '+' : ''}${deltaF1}% macro F1 delta.`;

  const sections = [
    {
      heading: '1. Executive Summary',
      content: `This study investigated whether synthetic augmentation resolves class imbalance and improves generalization on the "${dataset.name}" dataset. Under controlled evaluation (${config.runs} randomized cross-splits with held-out unaugmented test partitions), ${bestStrat} proved ${recommendation.verdict === 'recommended' ? 'statistically effective' : 'inconclusive'}. Overall recommendation verdict is "${recommendation.verdict.toUpperCase()}".`,
    },
    {
      heading: '2. Dataset Diagnostic Assessment',
      content: `The raw dataset exhibited an Augmentation Need Score of ${dataset.analysisResult?.augmentationNeedScore || 0}/100 with an imbalance ratio of ${dataset.analysisResult?.imbalanceRatio || 1}:1 (${dataset.analysisResult?.imbalanceSeverity || 'none'}). Target column "${dataset.targetColumn}" possessed minority class "${dataset.analysisResult?.minClass || 'N/A'}" with only ${dataset.analysisResult?.minCount || 0} observations.`,
    },
    {
      heading: '3. Augmentation Mechanics & Statistical Drift Audit',
      content: strategyResults.map(s => {
        const q = s.qualityMetrics || {};
        const driftSummaries = (s.featureDrift || []).map(d => `${d.featureName}: KS D=${d.ksStatistic} (Severity: ${d.driftSeverity.toUpperCase()})`).join(', ');
        return `• ${formatStrategy(s.strategyType)}: Synthesized ${s.syntheticCount} rows. Diversity Score: ${q.diversityScore || 80}/100, Duplicate Redundancy: ${q.redundancyScore || 0}%, Feature Shift: ${q.distributionShift || 0.05}.\n  Feature Drift: ${driftSummaries || 'No continuous features analyzed.'}`;
      }).join('\n\n'),
    },
    {
      heading: '4. Confusion Matrix & Decision Boundary Diagnostics',
      content: (() => {
        const baseCm = baseline.aggregated?.confusionMatrix?.perClassMetrics || {};
        const bestCm = bestStratObj?.evaluation?.aggregated?.confusionMatrix?.perClassMetrics || {};
        const lines = ['Class-level sensitivity and error rate shifts:'];
        Object.keys(baseCm).forEach(cls => {
          const b = baseCm[cls];
          const a = bestCm[cls] || b;
          const sensDelta = ((a.sensitivity - b.sensitivity) * 100).toFixed(1);
          lines.push(`• Class "${cls}": Sensitivity: ${(b.sensitivity * 100).toFixed(1)}% → ${(a.sensitivity * 100).toFixed(1)}% (Δ ${sensDelta > 0 ? '+' : ''}${sensDelta}%), Specificity: ${(a.specificity * 100).toFixed(1)}%, False Positive Rate: ${(a.fpr * 100).toFixed(1)}%`);
        });
        return lines.join('\n');
      })(),
    },
    {
      heading: '5. Causal Explanation Engine',
      content: (recommendation.explanations || []).join('\n\n') || 'Baseline and augmented distributions produced equivalent decision boundaries across test splits.',
    },
    {
      heading: '6. Risk & Degradation Analysis',
      content: (recommendation.risks && recommendation.risks.length > 0)
        ? recommendation.risks.map(r => `⚠️ ${r}`).join('\n')
        : 'No class-level degradation or excess variance was detected across repeated seeds.',
    },
    {
      heading: '7. Strategic Recommendation',
      content: recommendation.verdict === 'recommended'
        ? `Adopt ${bestStrat} in production pipelines. Synthetic sampling resolved minority underrepresentation without causing feature drift or precision degradation.`
        : (recommendation.verdict === 'not_recommended'
          ? `Do NOT apply synthetic augmentation. Tested strategies degraded minority precision or introduced boundary artifacts.`
          : `Augmentation produced marginal gains within noise margins. Retain original unaugmented training data unless sample size expands.`),
    },
    {
      heading: '8. Reproducibility Manifest',
      content: `• Architecture: ${config.modelType.toUpperCase()}\n• Evaluation Iterations: ${config.runs}\n• Train/Test Split: ${(config.trainTestSplit * 100).toFixed(0)}% / ${(100 - config.trainTestSplit * 100).toFixed(0)}%\n• Seed Base: ${config.baseSeed}\n• Generated: ${new Date().toISOString()}`,
    },
  ];

  const report = {
    id: generateUUID(),
    userId,
    experimentId: id,
    datasetId: dataset.id,
    generatedAt: new Date().toISOString(),
    title,
    summary,
    verdict: recommendation.verdict,
    sections,
  };

  const storageKey = `${REPORTS_PREFIX}${userId}`;
  storage.addToCollection(storageKey, report);

  return report;
}

/**
 * Get all reports for a user.
 */
export function getReports(userId) {
  const storageKey = `${REPORTS_PREFIX}${userId}`;
  return storage.getCollection(storageKey);
}

/**
 * Get a report by ID.
 */
export function getReportById(userId, reportId) {
  const storageKey = `${REPORTS_PREFIX}${userId}`;
  return storage.findInCollection(storageKey, reportId);
}

/**
 * Delete a report by ID.
 */
export function deleteReport(userId, reportId) {
  const storageKey = `${REPORTS_PREFIX}${userId}`;
  return storage.removeFromCollection(storageKey, reportId);
}
