/**
 * DataForge — Model Training & Evaluation Engine
 * Pure JavaScript implementations of:
 * 1. k-Nearest Neighbors (k-NN)
 * 2. Decision Tree (Gini split)
 * 3. Logistic Regression (One-vs-Rest SGD with L2 regularization)
 * 4. Random Forest (Bagging Ensemble of randomized Decision Trees)
 * Plus automatic categorical one-hot encoding, missing value imputation, and ID column exclusion.
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
  median,
  mode,
  sigmoid,
  dotProduct,
  pairedTTest,
  euclideanDistance,
} from '../utils/math.js';

// ---- Feature Encoder for Mixed-Type Datasets ----

export function createDatasetEncoder(data, numericIndices, categoricalIndices = [], idIndices = []) {
  const numericStats = {};
  numericIndices.forEach(idx => {
    if (idIndices.includes(idx)) return;
    const vals = data.map(r => Number(r[idx])).filter(v => !isNaN(v) && v !== null);
    numericStats[idx] = {
      median: vals.length > 0 ? median(vals) : 0,
      std: vals.length > 1 ? (std(vals) || 1) : 1,
      mean: vals.length > 0 ? mean(vals) : 0,
    };
  });

  const categoricalMaps = {};
  categoricalIndices.forEach(idx => {
    if (idIndices.includes(idx)) return;
    const rawVals = data.map(r => r[idx]).filter(v => v !== null && v !== undefined && v !== '');
    const defaultMode = rawVals.length > 0 ? mode(rawVals) : 'UNKNOWN';
    const uniqueVals = Array.from(new Set(rawVals)).slice(0, 20); // Top 20 categories per column

    categoricalMaps[idx] = {
      defaultMode,
      categories: uniqueVals,
    };
  });

  function encodeRow(row) {
    const vector = [];

    // 1. Continuous Features (Imputed & Standardized)
    numericIndices.forEach(idx => {
      if (idIndices.includes(idx)) return;
      let v = Number(row[idx]);
      const stat = numericStats[idx] || { median: 0, mean: 0, std: 1 };
      if (isNaN(v) || v === null || v === undefined) {
        v = stat.median;
      }
      // Scaled feature
      vector.push((v - stat.mean) / stat.std);
    });

    // 2. Nominal Features (One-Hot Encoded)
    categoricalIndices.forEach(idx => {
      if (idIndices.includes(idx)) return;
      const meta = categoricalMaps[idx];
      let val = row[idx];
      if (val === null || val === undefined || val === '') {
        val = meta?.defaultMode || 'UNKNOWN';
      }
      const strVal = String(val);
      if (meta && meta.categories.length > 0) {
        meta.categories.forEach(cat => {
          vector.push(strVal === String(cat) ? 1.0 : 0.0);
        });
      }
    });

    return vector;
  }

  function encodeMatrix(rows) {
    return rows.map(encodeRow);
  }

  return {
    encodeRow,
    encodeMatrix,
  };
}

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
        .slice(0, Math.min(this.k, this.trainX.length));

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
      return topClass || this.trainY[0];
    });
  }
}

// ---- Classifier 2: Decision Tree ----

class DecisionTreeClassifier {
  constructor(maxDepth = 4, maxFeatures = null) {
    this.maxDepth = maxDepth;
    this.maxFeatures = maxFeatures;
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
    const totalFeatures = X[0]?.length || 0;

    let featureIndices = Array.from({ length: totalFeatures }, (_, i) => i);
    if (this.maxFeatures && this.maxFeatures < totalFeatures) {
      featureIndices = featureIndices.sort(() => Math.random() - 0.5).slice(0, this.maxFeatures);
    }

    for (const f of featureIndices) {
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
    if (!node || node.leaf) return node?.prediction || 'UNKNOWN';
    if (sample[node.feature] <= node.threshold) {
      return this.predictSample(sample, node.left);
    }
    return this.predictSample(sample, node.right);
  }

  predict(X) {
    return X.map(sample => this.predictSample(sample, this.tree));
  }
}

// ---- Classifier 3: Logistic Regression (One-vs-Rest) ----

class LogisticRegressionClassifier {
  constructor(epochs = 40, learningRate = 0.05) {
    this.epochs = epochs;
    this.lr = learningRate;
    this.models = {}; // Class -> { weights, bias }
    this.classes = [];
  }

  fit(X, y) {
    this.classes = Array.from(new Set(y));
    const nFeatures = X[0]?.length || 0;

    this.classes.forEach(targetCls => {
      const weights = new Array(nFeatures).fill(0);
      let bias = 0;

      for (let epoch = 0; epoch < this.epochs; epoch++) {
        for (let i = 0; i < X.length; i++) {
          const row = X[i];
          const target = y[i] === targetCls ? 1.0 : 0.0;
          const z = dotProduct(weights, row) + bias;
          const pred = sigmoid(z);
          const error = pred - target;

          // Gradient updates with L2 regularization
          for (let f = 0; f < nFeatures; f++) {
            weights[f] -= this.lr * (error * row[f] + 0.001 * weights[f]);
          }
          bias -= this.lr * error;
        }
      }

      this.models[targetCls] = { weights, bias };
    });
  }

  predict(X) {
    return X.map(sample => {
      let bestClass = this.classes[0];
      let maxProb = -Infinity;

      this.classes.forEach(cls => {
        const model = this.models[cls];
        if (model) {
          const z = dotProduct(model.weights, sample) + model.bias;
          const prob = sigmoid(z);
          if (prob > maxProb) {
            maxProb = prob;
            bestClass = cls;
          }
        }
      });

      return bestClass;
    });
  }
}

// ---- Classifier 4: Random Forest (Bagging Ensemble) ----

class RandomForestClassifier {
  constructor(numTrees = 7, maxDepth = 4) {
    this.numTrees = numTrees;
    this.maxDepth = maxDepth;
    this.trees = [];
  }

  fit(X, y) {
    this.trees = [];
    const n = X.length;
    const nFeatures = X[0]?.length || 0;
    const maxSubFeatures = Math.max(2, Math.round(Math.sqrt(nFeatures)));

    for (let t = 0; t < this.numTrees; t++) {
      // Bootstrap sampling with replacement
      const bootX = [];
      const bootY = [];
      for (let i = 0; i < n; i++) {
        const randIdx = Math.floor(Math.random() * n);
        bootX.push(X[randIdx]);
        bootY.push(y[randIdx]);
      }

      const tree = new DecisionTreeClassifier(this.maxDepth, maxSubFeatures);
      tree.fit(bootX, bootY);
      this.trees.push(tree);
    }
  }

  predict(X) {
    const allPreds = this.trees.map(tree => tree.predict(X));
    return X.map((_, sampleIdx) => {
      const votes = {};
      allPreds.forEach(preds => {
        const label = preds[sampleIdx];
        votes[label] = (votes[label] || 0) + 1;
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

/**
 * Factory for creating configured models.
 */
function createModel(type) {
  if (type === 'decision_tree') return new DecisionTreeClassifier(4);
  if (type === 'logistic_regression') return new LogisticRegressionClassifier(45, 0.05);
  if (type === 'random_forest') return new RandomForestClassifier(7, 4);
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
  categoricalIndices = [],
  idIndices = [],
  augmentFn = null,
  runs = 5,
  trainTestSplit = 0.8,
  modelType = 'knn',
  baseSeed = 42,
}) {
  const classes = Array.from(new Set(labels));
  const runResults = [];

  for (let r = 0; r < runs; r++) {
    const seed = baseSeed + r * 17;
    const rng = createRNG(seed);

    // 1. Create Stratified Train / Test Split on raw rows
    const split = stratifiedSplit(data, labels, 1.0 - trainTestSplit, rng);
    let trainRawData = split.trainData;
    let trainY = split.trainLabels;
    const testRawData = split.testData;
    const testY = split.testLabels;

    // 2. If augmentation function is supplied, augment ONLY the training data
    if (typeof augmentFn === 'function') {
      const augRes = augmentFn(trainRawData, trainY, numericIndices, {
        seed,
        categoricalIndices,
      });
      trainRawData = augRes.augmentedData;
      trainY = augRes.augmentedLabels;
    }

    // 3. Build encoder strictly using training data
    const encoder = createDatasetEncoder(trainRawData, numericIndices, categoricalIndices, idIndices);
    const trainX = encoder.encodeMatrix(trainRawData);
    const testX = encoder.encodeMatrix(testRawData);

    // 4. Train model
    const model = createModel(modelType);
    model.fit(trainX, trainY);

    // 5. Predict on unaugmented test data
    const preds = model.predict(testX);

    // 6. Calculate metrics
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
