/**
 * DataForge — Train-on-Synthetic, Test-on-Real (TSTR) Benchmark Engine
 * Architecture: Service Layer (Assigned to: Person 1 / Lead Architect)
 * Zero Data Leakage: Real test partition is strictly held out before any training.
 */

// Simple deterministic k-NN Classifier in pure JS
class KNNClassifier {
  constructor(k = 3) {
    this.k = k;
    this.X = [];
    this.y = [];
  }

  fit(X, y) {
    this.X = X;
    this.y = y;
  }

  predict(xQuery) {
    const dists = this.X.map((xTrain, idx) => {
      let d = 0;
      for (let i = 0; i < xQuery.length; i++) {
        const diff = xQuery[i] - xTrain[i];
        d += diff * diff;
      }
      return { label: this.y[idx], dist: d };
    });

    dists.sort((a, b) => a.dist - b.dist);
    const votes = {};
    const topK = dists.slice(0, Math.min(this.k, dists.length));
    topK.forEach((item) => {
      votes[item.label] = (votes[item.label] || 0) + 1;
    });

    let bestLabel = topK[0]?.label;
    let maxVotes = -1;
    for (const label in votes) {
      if (votes[label] > maxVotes) {
        maxVotes = votes[label];
        bestLabel = label;
      }
    }
    return bestLabel;
  }
}

// Compute classification metrics (Accuracy, Macro F1, Confusion Matrix)
function evaluatePredictions(yTrue, yPred) {
  const uniqueLabels = [...new Set([...yTrue, ...yPred])].sort();
  const n = yTrue.length;
  if (n === 0) return { accuracy: 0, f1: 0, confusionMatrix: [] };

  let correct = 0;
  const labelIndex = {};
  uniqueLabels.forEach((l, i) => (labelIndex[l] = i));

  const cm = Array.from({ length: uniqueLabels.length }, () => Array(uniqueLabels.length).fill(0));

  for (let i = 0; i < n; i++) {
    const actual = yTrue[i];
    const predicted = yPred[i];
    if (actual === predicted) correct++;
    const row = labelIndex[actual];
    const col = labelIndex[predicted];
    if (row !== undefined && col !== undefined) {
      cm[row][col]++;
    }
  }

  const accuracy = correct / n;

  // Macro F1 Calculation
  let f1Sum = 0;
  uniqueLabels.forEach((label, idx) => {
    let tp = cm[idx][idx];
    let fp = 0;
    let fn = 0;
    for (let r = 0; r < uniqueLabels.length; r++) {
      if (r !== idx) fp += cm[r][idx];
    }
    for (let c = 0; c < uniqueLabels.length; c++) {
      if (c !== idx) fn += cm[idx][c];
    }

    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
    f1Sum += f1;
  });

  const macroF1 = f1Sum / (uniqueLabels.length || 1);

  return {
    accuracy: Number(accuracy.toFixed(4)),
    f1: Number(macroF1.toFixed(4)),
    confusionMatrix: cm,
  };
}

/**
 * Execute TSTR Benchmark comparing Baseline (TRTR) vs Synthetic (TSTR)
 */
export async function executeTstrBenchmark({
  headers,
  realData,
  syntheticData,
  targetCol,
  testSize = 0.25,
  seed = 42,
}) {
  const targetIdx = headers.indexOf(targetCol);
  if (targetIdx === -1) {
    throw new Error(`Target column "${targetCol}" not found in headers.`);
  }

  const featureIndices = headers.map((_, i) => i).filter((i) => i !== targetIdx);

  // Separate features and targets
  function parseXY(dataset) {
    const X = [];
    const y = [];
    for (let r = 0; r < dataset.length; r++) {
      const row = dataset[r];
      X.push(featureIndices.map((i) => Number(row[i]) || 0));
      y.push(String(row[targetIdx]));
    }
    return { X, y };
  }

  const { X: XReal, y: yReal } = parseXY(realData);
  const { X: XSynth, y: ySynth } = parseXY(syntheticData);

  // Train/Test Split on Real Data (Stratified pseudo-random)
  const nReal = realData.length;
  const nTest = Math.max(Math.floor(nReal * testSize), 2);
  const nTrain = nReal - nTest;

  // Shuffle indices
  const indices = Array.from({ length: nReal }, (_, i) => i);
  let s = seed;
  for (let i = nReal - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  const trainIndices = indices.slice(0, nTrain);
  const testIndices = indices.slice(nTrain);

  const XRealTrain = trainIndices.map((i) => XReal[i]);
  const yRealTrain = trainIndices.map((i) => yReal[i]);

  const XRealTest = testIndices.map((i) => XReal[i]);
  const yRealTest = testIndices.map((i) => yReal[i]);

  // Model 1: Baseline Real (TRTR: Train on Real Train, Test on Real Test)
  const baselineModel = new KNNClassifier(3);
  baselineModel.fit(XRealTrain, yRealTrain);
  const yPredBaseline = XRealTest.map((x) => baselineModel.predict(x));
  const baselineMetrics = evaluatePredictions(yRealTest, yPredBaseline);

  // Model 2: Synthetic (TSTR: Train on Synthetic, Test on Pristine Real Test)
  const synthModel = new KNNClassifier(3);
  synthModel.fit(XSynth, ySynth);
  const yPredSynth = XRealTest.map((x) => synthModel.predict(x));
  const synthMetrics = evaluatePredictions(yRealTest, yPredSynth);

  // Macro F1 Lift
  const macroF1Lift = Number((synthMetrics.f1 - baselineMetrics.f1).toFixed(4));

  // Determine Empirical Verdict
  let verdict = 'VIABLE_NEUTRAL';
  if (macroF1Lift >= 0.02) {
    verdict = 'VERIFIED_POSITIVE';
  } else if (macroF1Lift < -0.03) {
    verdict = 'DEGRADED_REJECT';
  }

  // Retention & Delta
  const tstrRetention = baselineMetrics.accuracy > 0
    ? Number(((synthMetrics.accuracy / baselineMetrics.accuracy) * 100).toFixed(1))
    : 100;

  const uniqueLabels = Array.from(new Set([...yReal, ...ySynth]));

  return {
    targetColumn: targetCol,
    baselineAccuracy: baselineMetrics.accuracy,
    baselineF1: baselineMetrics.f1,
    syntheticAccuracy: synthMetrics.accuracy,
    syntheticF1: synthMetrics.f1,
    macroF1Lift,
    deltaF1: macroF1Lift,
    tstrRetention,
    baseline: {
      accuracy: baselineMetrics.accuracy,
      f1: baselineMetrics.f1,
    },
    synthetic: {
      accuracy: synthMetrics.accuracy,
      f1: synthMetrics.f1,
    },
    classes: uniqueLabels,
    confusionMatrix: synthMetrics.confusionMatrix,
    verdict,
    testSize,
    testSampleCount: XRealTest.length,
    testRealSamples: XRealTest.length,
    trainSampleCount: XSynth.length,
  };
}
