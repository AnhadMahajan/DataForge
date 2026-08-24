/**
 * DataForge — Strategy Recommendation Engine
 * Generates evidence-backed verdicts and plain-language explanations
 * referencing actual column names, class counts, and experimental deltas.
 */

export function generateRecommendation(dataset, baseline, strategyResults) {
  const analysis = dataset.analysisResult || {};
  let bestStrategy = null;
  let bestImprovement = -Infinity;
  let bestComparison = null;
  let bestStrategyObj = null;

  const evaluatedStrategies = strategyResults.map(res => {
    const comp = res.comparison;
    const isDegraded = comp.percentageImprovement < -1.0;
    const isMarginal = Math.abs(comp.percentageImprovement) <= 1.0;
    const isImproved = comp.percentageImprovement > 1.0;

    let verdict = 'not_recommended';
    if (isImproved) {
      verdict = comp.isSignificant ? 'recommended' : 'use_with_caution';
    } else if (isMarginal) {
      verdict = 'inconclusive';
    }

    if (comp.percentageImprovement > bestImprovement) {
      bestImprovement = comp.percentageImprovement;
      bestStrategy = res.strategyType;
      bestComparison = comp;
      bestStrategyObj = res;
    }

    return {
      strategyType: res.strategyType,
      verdict,
      improvement: comp.percentageImprovement,
      deltaF1: comp.deltaF1,
      isSignificant: comp.isSignificant,
    };
  });

  const overallVerdict = bestImprovement > 2.0
    ? (bestComparison.isSignificant ? 'recommended' : 'inconclusive')
    : (bestImprovement < -1.0 ? 'not_recommended' : 'inconclusive');

  // Generate plain-language explanations
  const explanations = [];
  const risks = [];

  const minClass = analysis.minClass || 'Minority Class';
  const minCount = analysis.minCount || 0;

  if (bestStrategy === 'smote' && bestImprovement > 0) {
    explanations.push(`SMOTE generated synthetic interpolations for "${minClass}" (baseline sample size: ${minCount}), expanding sparse minority regions and raising macro F1 by ${bestImprovement.toFixed(1)}%.`);
  } else if (bestStrategy === 'adasyn' && bestImprovement > 0) {
    explanations.push(`ADASYN adaptively focused synthetic density on hard-to-learn boundary samples for "${minClass}", improving minority decision boundaries by ${bestImprovement.toFixed(1)}%.`);
  } else if (bestStrategy === 'smote_tomek' && bestImprovement > 0) {
    explanations.push(`SMOTE-Tomek cleaned ambiguous overlapping boundary instances after interpolation, reducing false positives and boosting macro F1 by ${bestImprovement.toFixed(1)}%.`);
  } else if (bestStrategy === 'oversampling' && bestImprovement > 0) {
    explanations.push(`Random oversampling with variance jitter improved representation of underrepresented classes by ${bestImprovement.toFixed(1)}% without exact-duplicate overfitting.`);
  } else if (bestStrategy === 'noise_injection') {
    if (bestImprovement > 0) {
      explanations.push(`Gaussian noise injection regularized decision boundaries across numeric features, yielding a ${bestImprovement.toFixed(1)}% gain in generalization.`);
    } else {
      explanations.push(`Noise injection distorted feature boundaries on low-variance columns, reducing model precision.`);
    }
  }

  // Detect per-class impacts
  const perClassImpact = [];
  if (bestStrategyObj) {
    const classes = baseline.classes || [];
    classes.forEach(cls => {
      const baseRec = baseline.runs.map(r => r.perClass[cls]?.recall || 0);
      const augRec = bestStrategyObj.evaluation.runs.map(r => r.perClass[cls]?.recall || 0);
      const avgBase = baseRec.reduce((a, b) => a + b, 0) / baseRec.length;
      const avgAug = augRec.reduce((a, b) => a + b, 0) / augRec.length;
      const diff = avgAug - avgBase;

      let impact = 'unchanged';
      if (diff > 0.03) impact = 'improved';
      else if (diff < -0.03) impact = 'degraded';

      perClassImpact.push({
        className: cls,
        impact,
        delta: Number((diff * 100).toFixed(1)),
      });

      if (impact === 'degraded') {
        risks.push(`Recall for class "${cls}" dropped by ${Math.abs(diff * 100).toFixed(1)}% despite overall macro improvement.`);
      }
    });
  }

  // Variance check risk
  if (bestStrategyObj) {
    const f1Std = bestStrategyObj.evaluation.aggregated.f1.std;
    if (f1Std > 0.05) {
      risks.push(`High variance across seeds (±${(f1Std * 100).toFixed(1)}%) indicates sensitivity to data split composition.`);
    }
  }

  return {
    verdict: overallVerdict,
    bestStrategy,
    improvement: Number(bestImprovement.toFixed(1)),
    confidence: bestComparison?.isSignificant ? 'high' : 'medium',
    explanations,
    risks,
    perClassImpact,
    evaluatedStrategies,
  };
}
