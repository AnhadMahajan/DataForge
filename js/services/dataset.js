/**
 * DataForge — Dataset Management Service
 * Parsing, validation, storage, and sample dataset provision.
 */

import * as storage from './storage.js';
import { parseCSV } from '../utils/csv.js';
import { mean, std, min, max, median, skewness, detectOutliers, generateUUID } from '../utils/math.js';
import { analyzeDataset } from './analysis.js';

const DATASETS_PREFIX = 'datasets_';

/**
 * Generate a realistic sample dataset for zero-friction exploration.
 * Dataset: "Customer Churn Risk" (280 rows, 6 numeric/categorical features, 3-class imbalanced target)
 */
export function getSampleDatasetCSV() {
  const headers = ['AccountAgeMonths', 'MonthlyCharges', 'UsageHours', 'SupportTickets', 'ContractType', 'ChurnRisk'];
  const rows = [];
  
  // Deterministic generator
  let seed = 42;
  function rnd() {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  }

  const contracts = ['Month-to-Month', 'One-Year', 'Two-Year'];

  for (let i = 0; i < 280; i++) {
    // Imbalanced distribution: 70% Low, 20% Medium, 10% High risk
    const r = rnd();
    let risk = 'Low';
    let accountAge = Math.floor(rnd() * 60) + 12;
    let charges = Math.floor(rnd() * 70) + 30;
    let usage = Math.floor(rnd() * 80) + 40;
    let tickets = Math.floor(rnd() * 3);
    let contract = contracts[Math.floor(rnd() * 3)];

    if (r > 0.90) {
      risk = 'High'; // Minority class (10%)
      accountAge = Math.floor(rnd() * 10) + 1; // Newer accounts
      charges = Math.floor(rnd() * 40) + 85;   // Higher charges
      usage = Math.floor(rnd() * 30) + 10;     // Low usage
      tickets = Math.floor(rnd() * 5) + 3;     // Many support tickets
      contract = 'Month-to-Month';
    } else if (r > 0.70) {
      risk = 'Medium'; // Minority class (20%)
      accountAge = Math.floor(rnd() * 24) + 6;
      charges = Math.floor(rnd() * 50) + 60;
      usage = Math.floor(rnd() * 50) + 30;
      tickets = Math.floor(rnd() * 3) + 1;
      contract = rnd() > 0.5 ? 'Month-to-Month' : 'One-Year';
    }

    // Add 2-3 outliers intentionally for health detection
    if (i === 12) charges = 245; // Outlier charges
    if (i === 55) tickets = 14;  // Outlier tickets

    rows.push([accountAge, charges, usage, tickets, contract, risk]);
  }

  const csvLines = [headers.join(',')];
  for (const row of rows) {
    csvLines.push(row.join(','));
  }
  return csvLines.join('\n');
}

/**
 * Process and save an uploaded or sample CSV into a structured Dataset record.
 */
export async function createDatasetFromCSV(userId, fileName, csvText, targetColumn = null) {
  const parsed = parseCSV(csvText);
  if (!parsed.success) {
    return parsed;
  }

  const { headers, rows, columnTypes, rowCount, columnCount } = parsed.data;

  // Auto-detect target column if not provided (default to last column)
  const chosenTarget = targetColumn || headers[headers.length - 1];
  const targetIndex = headers.indexOf(chosenTarget);

  // Compute column statistics
  const columns = headers.map((colName, colIdx) => {
    const type = columnTypes[colIdx];
    const colValues = rows.map(r => r[colIdx]);
    const nonNullValues = colValues.filter(v => v !== null && v !== undefined && v !== '');

    let stats = { nullCount: rowCount - nonNullValues.length };

    if (type === 'numeric') {
      const numValues = nonNullValues.map(Number).filter(v => !isNaN(v));
      if (numValues.length > 0) {
        const outlierInfo = detectOutliers(numValues);
        stats = {
          ...stats,
          min: min(numValues),
          max: max(numValues),
          mean: mean(numValues),
          std: std(numValues),
          median: median(numValues),
          skewness: skewness(numValues),
          outlierCount: outlierInfo.count,
        };
      }
    } else {
      // Categorical / text stats
      const counts = {};
      nonNullValues.forEach(v => { counts[v] = (counts[v] || 0) + 1; });
      const topValues = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([val, count]) => ({ val, count }));
      stats = {
        ...stats,
        uniqueCount: Object.keys(counts).length,
        topValues,
      };
    }

    return {
      name: colName,
      type,
      stats,
    };
  });

  // Compute class distribution if target column is valid
  let classDistribution = null;
  if (targetIndex !== -1) {
    classDistribution = {};
    rows.forEach(r => {
      const cls = String(r[targetIndex]);
      classDistribution[cls] = (classDistribution[cls] || 0) + 1;
    });
  }

  const datasetId = generateUUID();
  const rawDataset = {
    id: datasetId,
    userId,
    name: fileName.replace(/\.[^/.]+$/, ''),
    fileName,
    uploadedAt: new Date().toISOString(),
    rowCount,
    columnCount,
    headers,
    columns,
    targetColumn: chosenTarget,
    classDistribution,
    sampleRows: rows.slice(0, 100),
    fullData: rows,
  };

  // Perform dataset health analysis
  const analysis = analyzeDataset(rawDataset);
  rawDataset.analysisResult = analysis;
  rawDataset.healthScore = Math.max(0, 100 - analysis.augmentationNeedScore);

  // Persist to user's dataset collection
  const storageKey = `${DATASETS_PREFIX}${userId}`;
  const saveRes = storage.addToCollection(storageKey, rawDataset);
  if (!saveRes.success) return saveRes;

  return { success: true, data: rawDataset };
}

/**
 * Get all datasets belonging to a user.
 */
export function getDatasets(userId) {
  const storageKey = `${DATASETS_PREFIX}${userId}`;
  return storage.getCollection(storageKey);
}

/**
 * Retrieve a specific dataset by ID.
 */
export function getDatasetById(userId, datasetId) {
  const storageKey = `${DATASETS_PREFIX}${userId}`;
  return storage.findInCollection(storageKey, datasetId);
}

/**
 * Delete a dataset by ID.
 */
export function deleteDataset(userId, datasetId) {
  const storageKey = `${DATASETS_PREFIX}${userId}`;
  return storage.removeFromCollection(storageKey, datasetId);
}
