/**
 * DataForge — Model Training & Evaluation Engine
 * Pure JavaScript implementations of k-NN and simplified Decision Tree classifiers.
 * Enforces strict scientific constraint: TEST SET IS NEVER AUGMENTED.
 */

import {
  createRNG,
  stratifiedSplit,
  accuracy,
  computeConfusionMetrics,
  macroAverage,
  mean,
  std,
  pairedTTest,
  euclideanDistance,
} from '../utils/math.js';

// ---- Classifier 1: k-Nearest Neighbors ----

class KNNClassifier {
  constructor(k = 3) {
    this.k = k;
    this.trainX = [];
    this.trainY = [];
  }

  fit(X, y) {
    this.trainX = X;
    this.trainY = y;
  }

  predict(X) {
    return X.map(sample => {
      const neighbors = this.trainX
        .map((trainSample, idx) => ({
          dist: euclideanDistance(sample, trainSample),
          label: this.trainY[idx],
        }))
        .sort((a, b) => a.dist - b.dist)
        .slice(0, this.k);

      // Majority vote
      const votes = {};
      neighbors.forEach(n => {
        votes[n.label] = (votes[n.label] || 0) + 1;
      });

      let topClass = null;
      let maxVotes = -1;
      for (const [cls, count] of Object.entries(votes)) {
        if (count > maxVotes) {
          maxVotes = count;
          topClass = cls;
        }
      }
      return topClass;
    });
  }
}

// ---- Classifier 2: Decision Tree ----

class DecisionTreeClassifier {
  constructor(maxDepth = 4) {
    this.maxDepth = maxDepth;
    this.tree = null;
  }

  fit(X, y) {
    this.tree = this.buildTree(X, y, 0);
  }

  gini(y) {
    if (y.length === 0) return 0;
    const counts = {};
    y.forEach(label => { counts[label] = (counts[label] || 0) + 1; });
    let impurity = 1;
    for (const count of Object.values(counts)) {
      const p = count / y.length;
      impurity -= p * p;
    }
    return impurity;
  }

  findBestSplit(X, y) {
    let bestGain = -1;
    let bestFeature = null;
    let bestThreshold = null;
    const baseGini = this.gini(y);
    const nFeatures = X[0]?.length || 0;

    for (let f = 0; f < nFeatures; f++) {
      const values = X.map(row => row[f]);
      const uniqueVals = Array.from(new Set(values)).sort((a, b) => a - b);

      for (let i = 0; i < uniqueVals.length - 1; i++) {
        const threshold = (uniqueVals[i] + uniqueVals[i + 1]) / 2;
        const leftY = [];
        const rightY = [];

        for (let r = 0; r < X.length; r++) {
          if (X[r][f] <= threshold) leftY.push(y[r]);
          else rightY.push(y[r]);
        }

        if (leftY.length === 0 || rightY.length === 0) continue;

        const leftGini = this.gini(leftY);
        const rightGini = this.gini(rightY);
        const weightedGini = (leftY.length / y.length) * leftGini + (rightY.length / y.length) * rightGini;
        const gain = baseGini - weightedGini;

        if (gain > bestGain) {
          bestGain = gain;
          bestFeature = f;
          bestThreshold = threshold;
        }
      }
    }

    return { bestFeature, bestThreshold, bestGain };
  }

  buildTree(X, y, depth) {
    const uniqueClasses = Array.from(new Set(y));
    if (uniqueClasses.length === 1 || depth >= this.maxDepth || X.length < 4) {
      // Leaf node: return majority class
      const counts = {};
      y.forEach(l => { counts[l] = (counts[l] || 0) + 1; });
      let majority = uniqueClasses[0];
      let maxC = 0;
      for (const [cls, c] of Object.entries(counts)) {
        if (c > maxC) { maxC = c; majority = cls; }
      }
      return { leaf: true, prediction: majority };
    }

    const { bestFeature, bestThreshold, bestGain } = this.findBestSplit(X, y);
    if (bestGain <= 0 || bestFeature === null) {
      const counts = {};
      y.forEach(l => { counts[l] = (counts[l] || 0) + 1; });
      let majority = uniqueClasses[0];
      let maxC = 0;
      for (const [cls, c] of Object.entries(counts)) {
        if (c > maxC) { maxC = c; majority = cls; }
      }
      return { leaf: true, prediction: majority };
    }

    const leftX = [], leftY = [], rightX = [], rightY = [];
    for (let i = 0; i < X.length; i++) {
      if (X[i][bestFeature] <= bestThreshold) {
        leftX.push(X[i]);
        leftY.push(y[i]);
      } else {
        rightX.push(X[i]);
        rightY.push(y[i]);
      }
    }

    return {
      leaf: false,
      feature: bestFeature,
      threshold: bestThreshold,
      left: this.buildTree(leftX, leftY, depth + 1),
      right: this.buildTree(rightX, rightY, depth + 1),
    };
  }

  predictSample(sample, node) {
    if (node.leaf) return node.prediction;
    if (sample[node.feature] <= node.threshold) {
      return this.predictSample(sample, node.left);
    }
    return this.predictSample(sample, node.right);
  }

  predict(X) {
    return X.map(sample => this.predictSample(sample, this.tree));
  }
}

/**
 * Factory for creating configured model.
 */
function createModel(type) {
  if (type === 'decision_tree') return new DecisionTreeClassifier(4);
  return new KNNClassifier(3);
}

/**
 * Run standard evaluation pipeline across N seeds.
 * Evaluates both raw baseline training and augmented training on the EXACT SAME test set.
 */
export async function runControlledEvaluation({
  data,
  labels,
  numericIndices,
  augmentFn = null,
  runs = 5,
  trainTestSplit = 0.8,
  modelType = 'knn',
  baseSeed = 42,
}) {
  const classes = Array.from(new Set(labels));
  const runResults = [];

  // Extract purely numeric feature representation for model training
  const featureMatrix = data.map(row =>
    numericIndices.map(colIdx => {
      const v = Number(row[colIdx]);
      return isNaN(v) ? 0 : v;
    })
  );

  for (let r = 0; r < runs; r++) {
    const seed = baseSeed + r * 17;
    const rng = createRNG(seed);

    // 1. Create Stratified Train / Test Split
    const split = stratifiedSplit(featureMatrix, labels, 1.0 - trainTestSplit, rng);
    let trainX = split.trainData;
    let trainY = split.trainLabels;
    const testX = split.testData;
    const testY = split.testLabels;

    // 2. If augmentation function is supplied, augment ONLY the training data
    if (typeof augmentFn === 'function') {
      // Reconstruct row representation for augmentation
      const fullTrainRows = split.trainIndices.map(i => data[i]);
      const augRes = augmentFn(fullTrainRows, trainY, numericIndices, { seed });
      // Map back to numeric feature matrix
      trainX = augRes.augmentedData.map(row =>
        numericIndices.map(colIdx => {
          const v = Number(row[colIdx]);
          return isNaN(v) ? 0 : v;
        })
      );
      trainY = augRes.augmentedLabels;
    }

    // 3. Train model
    const model = createModel(modelType);
    model.fit(trainX, trainY);

    // 4. Predict on unaugmented test data
    const preds = model.predict(testX);

    // 5. Calculate metrics
    const acc = accuracy(testY, preds);
    const perClass = computeConfusionMetrics(testY, preds, classes);
    const prec = macroAverage(perClass, 'precision');
    const rec = macroAverage(perClass, 'recall');
    const f1 = macroAverage(perClass, 'f1');

    runResults.push({
      run: r + 1,
      accuracy: acc,
      precision: prec,
      recall: rec,
      f1,
      perClass,
    });
  }

  // Aggregate stats across runs
  const accs = runResults.map(r => r.accuracy);
  const precs = runResults.map(r => r.precision);
  const recs = runResults.map(r => r.recall);
  const f1s = runResults.map(r => r.f1);

  const aggregated = {
    accuracy: { mean: Number(mean(accs).toFixed(4)), std: Number(std(accs).toFixed(4)) },
    precision: { mean: Number(mean(precs).toFixed(4)), std: Number(std(precs).toFixed(4)) },
    recall: { mean: Number(mean(recs).toFixed(4)), std: Number(std(recs).toFixed(4)) },
    f1: { mean: Number(mean(f1s).toFixed(4)), std: Number(std(f1s).toFixed(4)) },
  };

  return {
    runs: runResults,
    aggregated,
    classes,
  };
}

/**
 * Compare baseline and augmented evaluation results with statistical test.
 */
export function compareEvaluations(baseline, augmented) {
  const baseF1s = baseline.runs.map(r => r.f1);
  const augF1s = augmented.runs.map(r => r.f1);

  const diffF1 = augmented.aggregated.f1.mean - baseline.aggregated.f1.mean;
  const pctChange = baseline.aggregated.f1.mean > 0
    ? Number(((diffF1 / baseline.aggregated.f1.mean) * 100).toFixed(1))
    : 0;

  const tTest = pairedTTest(augF1s, baseF1s);

  return {
    deltaAccuracy: Number((augmented.aggregated.accuracy.mean - baseline.aggregated.accuracy.mean).toFixed(4)),
    deltaPrecision: Number((augmented.aggregated.precision.mean - baseline.aggregated.precision.mean).toFixed(4)),
    deltaRecall: Number((augmented.aggregated.recall.mean - baseline.aggregated.recall.mean).toFixed(4)),
    deltaF1: Number(diffF1.toFixed(4)),
    percentageImprovement: pctChange,
    isSignificant: tTest.significant,
    pEstimate: Number(tTest.pEstimate.toFixed(4)),
  };
}
