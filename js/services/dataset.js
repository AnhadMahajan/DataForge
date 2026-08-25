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
 * Get a specific dataset by ID.
 */
export function getDatasetById(userId, datasetId) {
  const storageKey = `${DATASETS_PREFIX}${userId}`;
  return storage.findInCollection(storageKey, datasetId);
}

/**
 * Update the designated target column of a dataset and re-run diagnostics.
 */
export function updateDatasetTarget(userId, datasetId, newTargetColumn) {
  const storageKey = `${DATASETS_PREFIX}${userId}`;
  const dataset = storage.findInCollection(storageKey, datasetId);
  if (!dataset) return { success: false, error: { message: 'Dataset not found.' } };

  const targetIndex = dataset.headers.indexOf(newTargetColumn);
  if (targetIndex === -1) return { success: false, error: { message: 'Column not found in dataset headers.' } };

  dataset.targetColumn = newTargetColumn;

  // Recompute class distribution
  const classDist = {};
  dataset.fullData.forEach(r => {
    const cls = String(r[targetIndex] ?? 'UNKNOWN');
    classDist[cls] = (classDist[cls] || 0) + 1;
  });
  dataset.classDistribution = classDist;

  // Re-run health analysis
  const analysis = analyzeDataset(dataset);
  dataset.analysisResult = analysis;
  dataset.healthScore = Math.max(0, 100 - analysis.augmentationNeedScore);

  storage.updateInCollection(storageKey, datasetId, dataset);
  return { success: true, data: dataset };
}

/**
 * Generate CSV text representation of a dataset.
 */
export function exportDatasetAsCSV(dataset) {
  if (!dataset || !dataset.headers || !dataset.fullData) return '';
  const lines = [dataset.headers.join(',')];
  dataset.fullData.forEach(row => {
    lines.push(row.map(v => {
      const s = String(v ?? '');
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    }).join(','));
  });
  return lines.join('\n');
}

/**
 * Delete a dataset by ID.
 */
export function deleteDataset(userId, datasetId) {
  const storageKey = `${DATASETS_PREFIX}${userId}`;
  return storage.removeFromCollection(storageKey, datasetId);
}

// ============================================================
// DATA VALIDATION & CLEANING
// ============================================================

/**
 * Validate a dataset for pipeline readiness (pre-flight check before experiments).
 * Returns { valid: boolean, issues: Array<{ severity: 'error'|'warning', message: string }> }
 */
export function validateForPipeline(dataset) {
  const issues = [];
  const { headers, fullData, columns, targetColumn, analysisResult } = dataset;

  // Check minimum rows
  if (!fullData || fullData.length < 10) {
    issues.push({ severity: 'error', message: `Dataset has only ${fullData?.length || 0} rows. Minimum 10 required for meaningful evaluation.` });
  }

  // Check target column exists
  const targetIndex = headers ? headers.indexOf(targetColumn) : -1;
  if (targetIndex === -1) {
    issues.push({ severity: 'error', message: `Target column "${targetColumn}" not found in dataset headers.` });
  }

  // Check at least 2 classes in target
  if (targetIndex !== -1 && fullData && fullData.length > 0) {
    const uniqueClasses = new Set(
      fullData.map(r => String(r[targetIndex] ?? '')).filter(v => v !== '' && v.toLowerCase() !== 'nan' && v.toLowerCase() !== 'null')
    );
    if (uniqueClasses.size < 2) {
      issues.push({ severity: 'error', message: `Target column "${targetColumn}" has only ${uniqueClasses.size} unique class(es). Classification requires at least 2 classes.` });
    }
    // Check for extremely rare classes (< 3 samples)
    if (uniqueClasses.size >= 2) {
      const classCounts = {};
      fullData.forEach(r => {
        const cls = String(r[targetIndex] ?? '');
        if (cls && cls.toLowerCase() !== 'nan') classCounts[cls] = (classCounts[cls] || 0) + 1;
      });
      const tinyCls = Object.entries(classCounts).filter(([_, c]) => c < 3);
      if (tinyCls.length > 0) {
        issues.push({ severity: 'warning', message: `Classes with <3 samples: ${tinyCls.map(([c, n]) => `"${c}" (${n})`).join(', ')}. May cause issues with stratified splits.` });
      }
    }
  }

  // Check for at least 1 non-ID numeric feature
  const idIndices = analysisResult?.idIndices || [];
  const numericFeatures = (columns || [])
    .map((c, idx) => ({ ...c, idx }))
    .filter(c => c.type === 'numeric' && c.idx !== targetIndex && !idIndices.includes(c.idx));

  if (numericFeatures.length === 0) {
    issues.push({ severity: 'error', message: 'No usable numeric features found (excluding ID columns and target). Need at least 1 numeric feature for ML pipelines.' });
  }

  // Check for columns that are 100% missing
  if (columns) {
    const emptyColumns = columns.filter((c, idx) => {
      if (idx === targetIndex) return false;
      return (c.stats.nullCount || 0) >= (fullData?.length || 1);
    });
    if (emptyColumns.length > 0) {
      issues.push({ severity: 'warning', message: `Columns with 100% missing values (will be excluded): ${emptyColumns.map(c => c.name).join(', ')}` });
    }
  }

  // Check for zero-variance numeric columns
  const zeroVarCols = numericFeatures.filter(c => c.stats.std === 0 || c.stats.std === undefined || isNaN(c.stats.std));
  if (zeroVarCols.length > 0) {
    issues.push({ severity: 'warning', message: `Zero-variance numeric columns (will be excluded from distance metrics): ${zeroVarCols.map(c => c.name).join(', ')}` });
  }

  // Check for high cardinality categorical columns
  const highCardCols = (columns || [])
    .filter(c => c.type !== 'numeric' && c.stats.uniqueCount > 50)
    .map(c => c.name);
  if (highCardCols.length > 0) {
    issues.push({ severity: 'warning', message: `High cardinality categorical columns (>50 unique): ${highCardCols.join(', ')}. These may cause slow encoding.` });
  }

  // Check for large missing data percentage
  if (columns && fullData) {
    const totalCells = fullData.length * columns.length;
    const totalMissing = columns.reduce((acc, c) => acc + (c.stats.nullCount || 0), 0);
    const missingPct = (totalMissing / totalCells) * 100;
    if (missingPct > 30) {
      issues.push({ severity: 'warning', message: `Dataset has ${missingPct.toFixed(1)}% missing values. Auto-imputation will fill these, but results may be less reliable.` });
    }
  }

  const hasErrors = issues.some(i => i.severity === 'error');
  return { valid: !hasErrors, issues };
}

/**
 * Clean a dataset for pipeline readiness.
 * Handles: missing value imputation, zero-variance exclusion, type coercion.
 * Returns a new dataset object with cleaned data (does NOT modify original).
 */
export function cleanDataset(dataset) {
  const { headers, fullData, columns, targetColumn } = dataset;
  const targetIndex = headers.indexOf(targetColumn);
  const cleanLog = [];

  // Deep clone data
  const cleanedData = fullData.map(row => [...row]);

  // 1. Impute missing values per column
  columns.forEach((col, colIdx) => {
    if (colIdx === targetIndex) return;

    const missingIndices = [];
    cleanedData.forEach((row, rowIdx) => {
      const val = row[colIdx];
      if (isMissing(val)) {
        missingIndices.push(rowIdx);
      }
    });

    if (missingIndices.length === 0) return;

    if (col.type === 'numeric') {
      const numericVals = cleanedData
        .map(r => r[colIdx])
        .filter(v => !isMissing(v) && typeof v === 'number' && !isNaN(v));
      const medianVal = numericVals.length > 0 ? median(numericVals) : 0;

      missingIndices.forEach(rowIdx => {
        cleanedData[rowIdx][colIdx] = medianVal;
      });
      cleanLog.push(`Imputed ${missingIndices.length} missing values in "${col.name}" with median (${Number(medianVal.toFixed(2))})`);
    } else {
      const catVals = cleanedData
        .map(r => r[colIdx])
        .filter(v => !isMissing(v))
        .map(String);
      // Manual mode calculation
      const freq = {};
      catVals.forEach(v => { freq[v] = (freq[v] || 0) + 1; });
      let modeVal = 'UNKNOWN';
      let maxFreq = 0;
      for (const [v, c] of Object.entries(freq)) {
        if (c > maxFreq) { maxFreq = c; modeVal = v; }
      }

      missingIndices.forEach(rowIdx => {
        cleanedData[rowIdx][colIdx] = modeVal;
      });
      cleanLog.push(`Imputed ${missingIndices.length} missing values in "${col.name}" with mode ("${modeVal}")`);
    }
  });

  // 2. Ensure all numeric columns have actual numbers (re-coerce after imputation)
  columns.forEach((col, colIdx) => {
    if (col.type === 'numeric') {
      let coerced = 0;
      cleanedData.forEach(row => {
        if (typeof row[colIdx] !== 'number' || isNaN(row[colIdx])) {
          const num = Number(row[colIdx]);
          row[colIdx] = isNaN(num) ? 0 : num;
          coerced++;
        }
      });
      if (coerced > 0 && coerced > cleanedData.length * 0.01) {
        cleanLog.push(`Re-coerced ${coerced} non-numeric values in "${col.name}" to numbers`);
      }
    }
  });

  // 3. Drop rows where target is missing
  const validRows = [];
  let droppedTargetRows = 0;
  cleanedData.forEach(row => {
    if (isMissing(row[targetIndex])) {
      droppedTargetRows++;
    } else {
      validRows.push(row);
    }
  });
  if (droppedTargetRows > 0) {
    cleanLog.push(`Dropped ${droppedTargetRows} rows with missing target values`);
  }

  // 4. Identify columns to exclude (zero-variance, 100% missing pre-imputation)
  const excludedColumns = [];
  columns.forEach((col, colIdx) => {
    if (colIdx === targetIndex) return;
    if (col.type === 'numeric') {
      const vals = validRows.map(r => r[colIdx]).filter(v => typeof v === 'number' && !isNaN(v));
      const uniq = new Set(vals);
      if (uniq.size <= 1) {
        excludedColumns.push(colIdx);
        cleanLog.push(`Flagged "${col.name}" for exclusion (zero variance)`);
      }
    }
  });

  return {
    cleanedData: validRows,
    cleanLog,
    excludedColumns,
    originalRowCount: fullData.length,
    cleanedRowCount: validRows.length,
  };
}

/**
 * Check if a value should be considered "missing".
 */
function isMissing(val) {
  if (val === null || val === undefined || val === '') return true;
  if (typeof val === 'number') return isNaN(val);
  if (typeof val === 'string') {
    const lower = val.trim().toLowerCase();
    return lower === '' || lower === 'nan' || lower === 'null' || lower === 'na' ||
           lower === 'n/a' || lower === 'none' || lower === 'missing' || lower === '?' || lower === '-';
  }
  return false;
}
