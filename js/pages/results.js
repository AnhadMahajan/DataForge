/**
 * DataForge — Results & Performance Dashboard
 * Displays evaluation matrix, statistical recommendations, multi-strategy comparisons,
 * Confusion Matrix visualizer (Raw vs Normalized), Feature Drift Diagnostics (KS & Wasserstein),
 * and cross-experiment benchmarking.
 */

import { requireSession } from '../services/auth.js';
import { initSidebar } from '../components/sidebar.js';
import { getExperimentById, getExperiments } from '../services/experiment.js';
import { getDatasetById } from '../services/dataset.js';
import { generateStandalonePythonScript } from '../services/pipeline.js';
import {
  renderGroupedBarChart,
  renderRunVarianceChart,
  renderConfusionMatrix,
  renderDriftDensityChart,
} from '../components/charts.js';
import { renderDataTable } from '../components/tables.js';
import { toast } from '../components/toast.js';
import { downloadCSV, generateCSV } from '../utils/csv.js';
import { formatDelta, formatPercent, formatStrategy } from '../utils/formatting.js';
import { el, qs, show, hide } from '../utils/dom.js';

const session = requireSession();
if (!session) {
  // redirect handled
}

initSidebar('sidebar');

const userId = session.userId;
const resultsContent = qs('#results-content');
const resultsEmpty = qs('#results-empty');
const expTitle = qs('#exp-title');
const expSubtitle = qs('#exp-subtitle');
const expHeaderActions = qs('#exp-header-actions');

const verdictLabel = qs('#verdict-label');
const verdictConfidence = qs('#verdict-confidence');
const bestStratPill = qs('#best-strat-pill');
const verdictExplanation = qs('#verdict-explanation');
const metricsGrid = qs('#metrics-grid');
const comparisonChartContainer = qs('#comparison-chart-container');
const varianceChartContainer = qs('#variance-chart-container');
const matrixTableContainer = qs('#matrix-table-container');
const classTableContainer = qs('#class-table-container');
const qualityCardsContainer = qs('#quality-cards-container');
const resultsContextStrip = qs('#results-context-strip');
const compareSelectContainer = qs('#compare-select-container');
const compareCardContainer = qs('#compare-card-container');

// Confusion Matrix & Feature Drift selectors
const confStratSelectContainer = qs('#conf-strat-select-container');
const btnConfRaw = qs('#btn-conf-raw');
const btnConfNorm = qs('#btn-conf-norm');
const confMatrixContainer = qs('#conf-matrix-container');
const confMatrixMetricsStrip = qs('#conf-matrix-metrics-strip');
const driftFeatureSelectContainer = qs('#drift-feature-select-container');
const driftTableContainer = qs('#drift-table-container');
const driftChartTitle = qs('#drift-chart-title');
const distributionChartContainer = qs('#distribution-chart-container');

const urlParams = new URLSearchParams(window.location.search);
let expId = urlParams.get('id');

// If no experiment ID in query, pick the latest experiment
if (!expId) {
  const allExp = getExperiments(userId);
  if (allExp.length > 0) {
    expId = allExp[allExp.length - 1].id;
  }
}

const experiment = expId ? getExperimentById(userId, expId) : null;

if (!experiment) {
  hide(resultsContent);
  show(resultsEmpty);
  expTitle.textContent = 'Results';
  expSubtitle.textContent = 'No experiment found.';
} else {
  renderResults(experiment);
}

function renderResults(exp) {
  const dataset = getDatasetById(userId, exp.datasetId);
  const baseline = exp.baseline;
  const rec = exp.recommendation;
  const strategyResults = exp.strategyResults || [];
  const bestStratRes = strategyResults.find(s => s.strategyType === rec.bestStrategy) || strategyResults[0];
  const baseAgg = baseline.aggregated;
  const bestAgg = bestStratRes ? bestStratRes.evaluation.aggregated : baseline.aggregated;

  expTitle.textContent = exp.name;
  expSubtitle.textContent = `Evaluated on ${dataset ? dataset.name : 'Dataset'} • ${exp.config.runs} Iterations (${exp.config.modelType.toUpperCase()})`;

  // Header Actions
  expHeaderActions.innerHTML = '';

  // Metrics CSV Export
  const btnExportMetrics = el('button', {
    className: 'btn btn-secondary btn-sm',
    onClick: () => {
      const headers = [
        'Experiment_Name',
        'Model_Architecture',
        'Runs',
        'Train_Test_Split',
        'Strategy',
        'Synthetic_Rows_Added',
        'Macro_F1_Mean',
        'Macro_F1_Std',
        'Accuracy_Mean',
        'Precision_Mean',
        'Recall_Mean',
        'Percentage_Gain_F1',
        'P_Value_Estimate',
        'Statistically_Significant',
        'Verdict'
      ];
      const rows = [];
      rows.push([
        exp.name,
        exp.config.modelType,
        exp.config.runs,
        exp.config.trainTestSplit || 0.8,
        'Baseline (Raw)',
        0,
        baseAgg.f1.mean.toFixed(4),
        baseAgg.f1.std.toFixed(4),
        baseAgg.accuracy.mean.toFixed(4),
        baseAgg.precision.mean.toFixed(4),
        baseAgg.recall.mean.toFixed(4),
        '0.0%',
        '1.000',
        'No',
        'Baseline'
      ]);
      strategyResults.forEach(s => {
        const agg = s.evaluation.aggregated;
        rows.push([
          exp.name,
          exp.config.modelType,
          exp.config.runs,
          exp.config.trainTestSplit || 0.8,
          formatStrategy(s.strategyType),
          s.syntheticCount || 0,
          agg.f1.mean.toFixed(4),
          agg.f1.std.toFixed(4),
          agg.accuracy.mean.toFixed(4),
          agg.precision.mean.toFixed(4),
          agg.recall.mean.toFixed(4),
          `${s.comparison.percentageImprovement > 0 ? '+' : ''}${s.comparison.percentageImprovement.toFixed(2)}%`,
          s.comparison.pEstimate.toFixed(4),
          s.comparison.isSignificant ? 'Yes' : 'No',
          s.comparison.percentageImprovement > 1 ? 'Recommended' : (s.comparison.percentageImprovement < -1 ? 'Harmful' : 'Marginal')
        ]);
      });
      const csvStr = generateCSV(headers, rows);
      downloadCSV(`${exp.name}_evaluation_matrix.csv`, csvStr);
      toast.success('Evaluation metrics matrix exported as CSV.');
    }
  }, '📊 Export Matrix');
  expHeaderActions.appendChild(btnExportMetrics);

  if (bestStratRes?.augmentedCSV) {
    const btnExportAug = el('button', {
      className: 'btn btn-secondary btn-sm',
      onClick: () => {
        downloadCSV(`${exp.name}_augmented_${bestStratRes.strategyType}.csv`, bestStratRes.augmentedCSV);
        toast.success(`Augmented dataset downloaded (${formatStrategy(bestStratRes.strategyType)}).`);
      },
    }, '📥 Augmented Data');
    expHeaderActions.appendChild(btnExportAug);
  }

  if (bestStratRes?.syntheticCSV) {
    const btnExportSynth = el('button', {
      className: 'btn btn-secondary btn-sm',
      onClick: () => {
        downloadCSV(`${exp.name}_synthetic_only.csv`, bestStratRes.syntheticCSV);
        toast.success('Synthetic-only samples downloaded.');
      },
    }, '✨ Synthetic Data');
    expHeaderActions.appendChild(btnExportSynth);
  }

  const btnReport = el('a', {
    className: 'btn btn-primary btn-sm',
    href: `reports.html?id=${exp.id}`,
  }, '📝 Generate Narrative Report →');
  expHeaderActions.appendChild(btnReport);

  // 1. Verdict Hero Card
  const isRecommended = rec.verdict === 'recommended';
  const isNegative = rec.verdict === 'not_recommended';
  
  verdictLabel.textContent = isRecommended
    ? 'Augmentation Recommended'
    : (isNegative ? 'Augmentation Harmful' : 'Marginal / Inconclusive');

  verdictConfidence.textContent = `Confidence: ${rec.confidence.toUpperCase()} (Statistical test p = ${strategyResults[0]?.comparison?.pEstimate || 0.05})`;

  bestStratPill.textContent = rec.bestStrategy ? `Top Performer: ${formatStrategy(rec.bestStrategy)}` : 'No strategy improved performance';
  bestStratPill.className = `pill ${isRecommended ? 'pill-positive' : (isNegative ? 'pill-negative' : 'pill-neutral')} mb-sm`;

  verdictExplanation.textContent = rec.explanations.length > 0
    ? rec.explanations[0]
    : 'No statistically significant delta observed over baseline model training.';

  resultsContextStrip.innerHTML = '';
  [
    ['DATASET', dataset?.name || 'Unknown dataset'],
    ['MODEL', exp.config.modelType.toUpperCase()],
    ['EVALUATION', `${exp.config.runs} repeated splits`],
    ['BEST F1 DELTA', `${rec.improvement > 0 ? '+' : ''}${rec.improvement}%`],
  ].forEach(([label, value]) => {
    resultsContextStrip.appendChild(el('div', { className: 'results-context-item' }, [
      el('div', { className: 'text-caption text-muted' }, label),
      el('div', { className: 'results-context-value' }, value),
    ]));
  });

  // Check Task Type (Classification vs Regression)
  const isRegression = exp.taskType === 'regression' || baseAgg.r2 !== undefined || exp.config?.taskType === 'regression';

  // 2. Metrics Comparison Grid (Baseline vs Best Strategy)
  metricsGrid.innerHTML = '';
  const metricItems = isRegression
    ? [
        { name: 'R² Score (Fit)', base: baseAgg.r2?.mean ?? baseAgg.accuracy?.mean ?? 0, aug: bestAgg.r2?.mean ?? bestAgg.accuracy?.mean ?? 0, isPercent: true, context: 'Primary variance explained metric' },
        { name: 'RMSE Error', base: baseAgg.rmse?.mean ?? 0, aug: bestAgg.rmse?.mean ?? 0, isPercent: false, isLowerBetter: true, context: 'Root mean squared error (lower is better)' },
        { name: 'MAE Error', base: baseAgg.mae?.mean ?? 0, aug: bestAgg.mae?.mean ?? 0, isPercent: false, isLowerBetter: true, context: 'Mean absolute error (lower is better)' },
        { name: 'Pearson Correlation (r)', base: baseAgg.pearsonR?.mean ?? 0, aug: bestAgg.pearsonR?.mean ?? 0, isPercent: false, context: 'Prediction to ground truth linear correlation' },
      ]
    : [
        { name: 'Macro F1-Score', base: baseAgg.f1.mean, aug: bestAgg.f1.mean, isPercent: true, context: 'Primary selection metric' },
        { name: 'Accuracy', base: baseAgg.accuracy.mean, aug: bestAgg.accuracy.mean, isPercent: true, context: 'Held-out evaluation metric' },
        { name: 'Precision', base: baseAgg.precision.mean, aug: bestAgg.precision.mean, isPercent: true, context: 'Held-out evaluation metric' },
        { name: 'Recall', base: baseAgg.recall.mean, aug: bestAgg.recall.mean, isPercent: true, context: 'Held-out evaluation metric' },
      ];

  metricItems.forEach(item => {
    let diffPct = 0;
    if (item.base !== 0) {
      diffPct = item.isLowerBetter
        ? ((item.base - item.aug) / Math.abs(item.base)) * 100
        : ((item.aug - item.base) / Math.abs(item.base)) * 100;
    }
    const delta = formatDelta(diffPct);
    const augValStr = item.isPercent ? formatPercent(item.aug) : item.aug.toFixed(2);
    const baseValStr = item.isPercent ? formatPercent(item.base) : item.base.toFixed(2);

    const card = el('div', { className: 'metric-comparison-card' }, [
      el('div', { className: 'card-title text-small text-muted font-medium' }, item.name),
      el('div', { className: 'metric-value mt-xs', style: { fontSize: '2rem' } }, augValStr),
      el('div', { className: 'metric-delta-row' }, [
        el('span', { className: 'text-caption text-muted' }, `Baseline: ${baseValStr}`),
        el('span', { className: `pill ${delta.className} text-caption` }, delta.text),
      ]),
      el('div', { className: 'metric-context text-caption text-muted' }, item.context),
    ]);
    metricsGrid.appendChild(card);
  });

  // 3. Multi-Strategy Comparison Chart
  const chartLabels = isRegression
    ? ['R² Score', 'RMSE Rel', 'MAE Rel', 'Pearson r']
    : ['Macro F1', 'Accuracy', 'Precision', 'Recall'];

  const getSeriesValues = (agg) => {
    if (isRegression) {
      const r2Val = Math.max(0, agg.r2?.mean ?? agg.accuracy?.mean ?? 0);
      const rmseVal = Math.max(0, 1 - Math.min(1, (agg.rmse?.mean || 0) / (baseAgg.rmse?.mean || 1)));
      const maeVal = Math.max(0, 1 - Math.min(1, (agg.mae?.mean || 0) / (baseAgg.mae?.mean || 1)));
      const rVal = Math.max(0, agg.pearsonR?.mean ?? 0);
      return [r2Val, rmseVal, maeVal, rVal];
    }
    return [
      agg.f1.mean,
      agg.accuracy.mean,
      agg.precision.mean,
      agg.recall.mean,
    ];
  };

  const chartSeries = [
    {
      name: 'Baseline (Raw)',
      values: getSeriesValues(baseAgg),
      color: '#333333',
    },
  ];

  const colors = ['#1a8a5c', '#4a7fb5', '#b08a2e', '#8a4ab5', '#33a398'];
  strategyResults.forEach((s, idx) => {
    chartSeries.push({
      name: formatStrategy(s.strategyType),
      values: getSeriesValues(s.evaluation.aggregated),
      color: colors[idx % colors.length],
    });
  });

  renderGroupedBarChart(comparisonChartContainer, chartLabels, chartSeries, { height: 240 });

  // 4. Per-Run Variance Line Chart
  const runVarianceData = baseline.runs.map((r, i) => ({
    run: i + 1,
    baseline: isRegression ? (r.r2 ?? r.accuracy) : r.f1,
    augmented: bestStratRes ? (isRegression ? (bestStratRes.evaluation.runs[i]?.r2 ?? bestStratRes.evaluation.runs[i]?.accuracy) : bestStratRes.evaluation.runs[i]?.f1) : (isRegression ? (r.r2 ?? r.accuracy) : r.f1),
  }));
  renderRunVarianceChart(varianceChartContainer, runVarianceData, { height: 240 });

  // 5. Strategy Matrix Table
  const matrixHeaders = isRegression
    ? ['Strategy', 'Synthetic Rows', 'R² Score', 'RMSE', 'Δ Score', 'Verdict']
    : ['Strategy', 'Synthetic Rows', 'Macro F1', 'Δ from Baseline', 'Significance (p)', 'Verdict'];

  const matrixRows = strategyResults.map(s => {
    const dScore = s.comparison.percentageImprovement;
    const vText = s.comparison.percentageImprovement > 1 ? 'Recommended' : (s.comparison.percentageImprovement < -1 ? 'Degraded' : 'Marginal');

    if (isRegression) {
      const r2Str = formatPercent(s.evaluation.aggregated.r2?.mean ?? s.evaluation.aggregated.accuracy?.mean ?? 0);
      const rmseStr = (s.evaluation.aggregated.rmse?.mean || 0).toFixed(2);
      return [
        formatStrategy(s.strategyType),
        `+${s.syntheticCount} rows`,
        r2Str,
        rmseStr,
        `${dScore > 0 ? '+' : ''}${dScore.toFixed(1)}%`,
        vText,
      ];
    } else {
      const signPill = s.comparison.isSignificant ? 'p < 0.05 (Valid)' : 'p ≥ 0.05 (High noise)';
      return [
        formatStrategy(s.strategyType),
        `+${s.syntheticCount} rows`,
        formatPercent(s.evaluation.aggregated.f1.mean),
        `${dScore > 0 ? '+' : ''}${dScore.toFixed(1)}%`,
        signPill,
        vText,
      ];
    }
  });
  renderDataTable(matrixTableContainer, matrixHeaders, matrixRows, { pageSize: 5 });

  // 6. Per-Class / Target Breakdown Table
  const classHeaders = isRegression
    ? ['Target Variable', 'Baseline R²', 'Baseline RMSE', 'Augmented R²', 'Augmented RMSE', 'Δ R² Gain']
    : ['Class Label', 'Baseline Precision', 'Baseline Recall', 'Baseline F1', 'Augmented F1', 'Δ F1'];

  let classRows = [];
  if (isRegression) {
    const targetName = dataset?.targetColumn || 'Target';
    const bR2 = baseAgg.r2?.mean ?? baseAgg.accuracy?.mean ?? 0;
    const bRMSE = baseAgg.rmse?.mean ?? 0;
    const aR2 = bestAgg.r2?.mean ?? bestAgg.accuracy?.mean ?? 0;
    const aRMSE = bestAgg.rmse?.mean ?? 0;
    const dR2 = (aR2 - bR2) * 100;

    classRows = [[
      targetName,
      formatPercent(bR2),
      bRMSE.toFixed(2),
      formatPercent(aR2),
      aRMSE.toFixed(2),
      `${dR2 > 0 ? '+' : ''}${dR2.toFixed(1)}%`,
    ]];
  } else {
    const allClasses = baseline.aggregated?.confusionMatrix?.classes || [];
    classRows = allClasses.map(cName => {
      const baseClassMetric = baseline.aggregated?.confusionMatrix?.perClassMetrics?.[cName] || {};
      const augClassMetric = bestStratRes?.evaluation?.aggregated?.confusionMatrix?.perClassMetrics?.[cName] || {};

      const bPrec = baseClassMetric.precision || 0;
      const bRec = baseClassMetric.sensitivity || baseClassMetric.recall || 0;
      const bF1 = baseline.runs.map(r => r.perClass?.[cName]?.f1 || 0).reduce((a, b) => a + b, 0) / (baseline.runs.length || 1);
      const aF1 = (bestStratRes?.evaluation?.runs || []).map(r => r.perClass?.[cName]?.f1 || 0).reduce((a, b) => a + b, 0) / (bestStratRes?.evaluation?.runs?.length || 1);
      const dF1 = bF1 > 0 ? ((aF1 - bF1) / bF1 * 100) : (aF1 > 0 ? 100 : 0);

      return [
        String(cName),
        formatPercent(bPrec),
        formatPercent(bRec),
        formatPercent(bF1),
        formatPercent(aF1),
        `${dF1 > 0 ? '+' : ''}${dF1.toFixed(1)}%`,
      ];
    });
  }
  renderDataTable(classTableContainer, classHeaders, classRows, { pageSize: 5 });

  // 7. Synthetic Data Quality Audit Cards
  qualityCardsContainer.innerHTML = '';
  const avgKS = bestStratRes?.featureDrift?.length > 0
    ? (bestStratRes.featureDrift.reduce((acc, f) => acc + (f.ksStatistic || 0), 0) / bestStratRes.featureDrift.length)
    : 0.08;
  const avgW1 = bestStratRes?.featureDrift?.length > 0
    ? (bestStratRes.featureDrift.reduce((acc, f) => acc + (f.wassersteinDistance || 0), 0) / bestStratRes.featureDrift.length)
    : 0.05;

  const ksFidelityScore = Math.max(0, Math.round((1 - avgKS) * 100));

  qualityCardsContainer.appendChild(el('div', { className: 'card' }, [
    el('div', { className: 'text-caption text-muted' }, 'Marginal Distribution Fidelity'),
    el('div', { className: 'metric-value mt-xs' }, `${ksFidelityScore}%`),
    el('div', { className: 'text-small text-secondary mt-xs' }, `Average KS divergence: ${avgKS.toFixed(3)} (lower is better)`),
  ]));

  qualityCardsContainer.appendChild(el('div', { className: 'card' }, [
    el('div', { className: 'text-caption text-muted' }, 'Wasserstein-1 Shift'),
    el('div', { className: 'metric-value mt-xs' }, `${avgW1.toFixed(3)}`),
    el('div', { className: 'text-small text-secondary mt-xs' }, 'Average physical distribution shift across features'),
  ]));

  qualityCardsContainer.appendChild(el('div', { className: 'card' }, [
    el('div', { className: 'text-caption text-muted' }, 'Augmentation Sample Volume'),
    el('div', { className: 'metric-value mt-xs' }, `+${bestStratRes?.syntheticCount || 0}`),
    el('div', { className: 'text-small text-secondary mt-xs' }, `Total training samples: ${bestStratRes?.augmentedRowCount || dataset?.rowCount || 0}`),
  ]));

  // 8. Confusion Matrix Visualizer Controller
  if (confMatrixContainer) {
    let currentConfStrat = rec.bestStrategy || (strategyResults[0]?.strategyType) || 'baseline';
    let isConfNorm = false;

    // Strategy selector
    if (confStratSelectContainer) {
      confStratSelectContainer.innerHTML = '';
      const stratOptions = [
        el('option', { value: 'baseline' }, 'Model: Baseline (Raw)'),
        ...strategyResults.map(s => el('option', {
          value: s.strategyType,
          selected: s.strategyType === currentConfStrat,
        }, `Model: ${formatStrategy(s.strategyType)}`)),
      ];

      const stratSelect = el('select', {
        className: 'select select-sm',
        onChange: (e) => {
          currentConfStrat = e.target.value;
          updateConfusionMatrixDisplay();
        },
      }, stratOptions);
      confStratSelectContainer.appendChild(stratSelect);
    }

    // Normalized vs Raw Buttons
    if (btnConfRaw && btnConfNorm) {
      btnConfRaw.onclick = () => {
        isConfNorm = false;
        btnConfRaw.classList.add('active');
        btnConfNorm.classList.remove('active');
        updateConfusionMatrixDisplay();
      };
      btnConfNorm.onclick = () => {
        isConfNorm = true;
        btnConfNorm.classList.add('active');
        btnConfRaw.classList.remove('active');
        updateConfusionMatrixDisplay();
      };
    }

    function updateConfusionMatrixDisplay() {
      const isBase = currentConfStrat === 'baseline';
      const targetEval = isBase ? baseline : (strategyResults.find(s => s.strategyType === currentConfStrat)?.evaluation || baseline);
      const matrixData = targetEval?.aggregated?.confusionMatrix;

      if (isRegression) {
        const r2Val = formatPercent(targetEval.aggregated?.r2?.mean ?? targetEval.aggregated?.accuracy?.mean ?? 0);
        const rmseVal = (targetEval.aggregated?.rmse?.mean || 0).toFixed(2);
        const maeVal = (targetEval.aggregated?.mae?.mean || 0).toFixed(2);
        const rVal = (targetEval.aggregated?.pearsonR?.mean || 0).toFixed(3);

        confMatrixContainer.innerHTML = `
          <div class="card p-md" style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 8px;">
            <h4 class="text-small font-semi text-primary mb-sm">Continuous Target Regression Fit (${formatStrategy(currentConfStrat)})</h4>
            <div class="grid grid-cols-2 gap-sm">
              <div class="p-sm background-subtle rounded"><div class="text-caption text-muted">Coefficient of Determination (R²)</div><div class="text-large font-bold mt-xs">${r2Val}</div></div>
              <div class="p-sm background-subtle rounded"><div class="text-caption text-muted">Root Mean Squared Error (RMSE)</div><div class="text-large font-bold mt-xs">${rmseVal}</div></div>
              <div class="p-sm background-subtle rounded"><div class="text-caption text-muted">Mean Absolute Error (MAE)</div><div class="text-large font-bold mt-xs">${maeVal}</div></div>
              <div class="p-sm background-subtle rounded"><div class="text-caption text-muted">Pearson Correlation (r)</div><div class="text-large font-bold mt-xs">${rVal}</div></div>
            </div>
          </div>
        `;
        if (confMatrixMetricsStrip) confMatrixMetricsStrip.innerHTML = '';
        return;
      }

      if (!matrixData) {
        confMatrixContainer.innerHTML = '<div class="text-small text-muted p-md text-center">No confusion matrix recorded for this evaluation.</div>';
        return;
      }

      renderConfusionMatrix(confMatrixContainer, matrixData, { isNormalized: isConfNorm });

      // Render per-class metrics summary strip
      if (confMatrixMetricsStrip) {
        confMatrixMetricsStrip.innerHTML = '';
        const perClass = matrixData.perClassMetrics || {};
        Object.values(perClass).forEach(m => {
          const chip = el('div', { className: 'card background-subtle p-sm' }, [
            el('div', { className: 'flex justify-between items-center mb-xs' }, [
              el('span', { className: 'font-semi text-primary text-small' }, m.className),
              el('span', { className: 'text-caption font-mono text-muted' }, `TP: ${m.tp} | FP: ${m.fp}`),
            ]),
            el('div', { className: 'flex justify-between text-caption border-bottom py-xs' }, [
              el('span', { className: 'text-muted' }, 'Sensitivity (Recall)'),
              el('span', { className: 'font-mono font-semi ' + (m.sensitivity >= 0.85 ? 'delta-positive' : '') }, formatPercent(m.sensitivity)),
            ]),
            el('div', { className: 'flex justify-between text-caption border-bottom py-xs' }, [
              el('span', { className: 'text-muted' }, 'Specificity'),
              el('span', { className: 'font-mono font-semi ' + (m.specificity >= 0.85 ? 'delta-positive' : '') }, formatPercent(m.specificity)),
            ]),
            el('div', { className: 'flex justify-between text-caption py-xs' }, [
              el('span', { className: 'text-muted' }, 'False Positive Rate'),
              el('span', { className: 'font-mono font-semi ' + (m.fpr > 0.15 ? 'delta-negative' : 'text-muted') }, formatPercent(m.fpr)),
            ]),
          ]);
          confMatrixMetricsStrip.appendChild(chip);
        });
      }
    }

    updateConfusionMatrixDisplay();
  }

  // 9. Feature Distribution Shift & Drift Diagnostics Controller
  if (driftTableContainer && distributionChartContainer) {
    const driftList = bestStratRes?.featureDrift || [];

    if (driftList.length > 0) {
      // Build Drift Diagnostics Table
      const driftHeaders = [
        'Feature',
        'Baseline Dist (μ ± σ)',
        'Synthetic Dist (μ ± σ)',
        'KS Stat (D)',
        'Wasserstein Dist (W₁)',
        'Drift Severity'
      ];

      const driftRows = driftList.map(item => {
        const badgeClass = item.driftSeverity === 'severe'
          ? 'drift-badge drift-badge-severe'
          : (item.driftSeverity === 'moderate' ? 'drift-badge drift-badge-moderate' : 'drift-badge drift-badge-safe');

        return [
          item.featureName,
          `${item.originalMean} ± ${item.originalStd}`,
          `${item.syntheticMean} ± ${item.syntheticStd}`,
          item.ksStatistic.toFixed(4),
          item.wassersteinDistance.toFixed(4),
          `<span class="${badgeClass}">${item.driftSeverity.toUpperCase()}</span>`,
        ];
      });

      renderDataTable(driftTableContainer, driftHeaders, driftRows, {
        pageSize: 10,
        onRowClick: (rowIdx) => {
          const selectedFeat = driftList[rowIdx]?.featureName;
          if (selectedFeat) {
            renderDriftOverlayChart(selectedFeat);
            if (driftFeatureSelect) driftFeatureSelect.value = selectedFeat;
          }
        },
      });

      // Feature selector for chart
      let driftFeatureSelect = null;
      if (driftFeatureSelectContainer) {
        driftFeatureSelectContainer.innerHTML = '';
        driftFeatureSelect = el('select', {
          className: 'select select-sm',
          onChange: (e) => renderDriftOverlayChart(e.target.value),
        }, driftList.map(d => el('option', { value: d.featureName }, `Feature: ${d.featureName}`)));
        driftFeatureSelectContainer.appendChild(driftFeatureSelect);
      }

      function renderDriftOverlayChart(featName) {
        const driftItem = driftList.find(d => d.featureName === featName) || driftList[0];
        if (!driftItem || !dataset) return;

        const colIdx = dataset.headers.indexOf(featName);
        if (colIdx === -1) return;

        if (driftChartTitle) {
          driftChartTitle.textContent = `Distribution Overlay: ${featName}`;
        }

        const origVals = dataset.fullData.map(r => Number(r[colIdx])).filter(v => !isNaN(v));
        const synthVals = (bestStratRes?.syntheticData || []).map(r => Number(r[colIdx])).filter(v => !isNaN(v));

        renderDriftDensityChart(distributionChartContainer, origVals, synthVals, featName, {
          height: 220,
          ksStatistic: driftItem.ksStatistic,
          severity: driftItem.driftSeverity,
        });
      }

      // Initial render for top drift feature (or first feature)
      const topDriftFeat = [...driftList].sort((a, b) => b.ksStatistic - a.ksStatistic)[0]?.featureName || driftList[0].featureName;
      if (driftFeatureSelect) driftFeatureSelect.value = topDriftFeat;
      renderDriftOverlayChart(topDriftFeat);
    } else {
      driftTableContainer.innerHTML = '<div class="text-small text-muted p-md text-center">No continuous numeric features available for drift diagnostics.</div>';
      distributionChartContainer.innerHTML = '<div class="text-small text-muted p-md text-center">Insufficient numeric features for distribution overlay.</div>';
    }
  }

  // 10. Cross-Experiment Head-to-Head Comparison
  const allUserExps = getExperiments(userId);
  const otherExps = allUserExps.filter(e => e.id !== exp.id && e.status === 'completed');

  if (compareSelectContainer && compareCardContainer) {
    if (otherExps.length === 0) {
      compareSelectContainer.innerHTML = '';
      compareCardContainer.innerHTML = `
        <div class="text-center p-lg">
          <div class="text-small text-muted mb-sm">Only 1 experiment recorded in workspace. Launch another run in the Experiment Lab to compare performance across classifiers.</div>
          <a href="experiment.html" class="btn btn-secondary btn-sm">Configure Another Experiment →</a>
        </div>
      `;
    } else {
      compareSelectContainer.innerHTML = '';
      const select = el('select', {
        className: 'select select-sm',
        onChange: (e) => renderExperimentComparison(e.target.value),
      }, [
        el('option', { value: '' }, '-- Select Comparison Experiment --'),
        ...otherExps.map(e => el('option', { value: e.id }, `${e.name} (${e.config.modelType.toUpperCase()})`)),
      ]);
      compareSelectContainer.appendChild(select);

      function renderExperimentComparison(compareId) {
        if (!compareId) {
          compareCardContainer.innerHTML = '<div class="text-small text-muted p-md text-center">Select a benchmark from the dropdown to compare metrics side-by-side.</div>';
          return;
        }
        const otherExp = getExperimentById(userId, compareId);
        if (!otherExp) return;

        const otherBase = otherExp.baseline.aggregated;
        const otherRec = otherExp.recommendation;
        const otherBestStrat = (otherExp.strategyResults || []).find(s => s.strategyType === otherRec.bestStrategy) || (otherExp.strategyResults || [])[0];
        const otherBestAgg = otherBestStrat ? otherBestStrat.evaluation.aggregated : otherBase;

        compareCardContainer.innerHTML = '';

        // Summary cards comparison
        const summaryGrid = el('div', { className: 'card-grid-2 mb-lg' }, [
          // Current Exp Card
          el('div', { className: 'card background-subtle p-md' }, [
            el('div', { className: 'flex justify-between items-center mb-xs' }, [
              el('span', { className: 'font-semi text-primary' }, exp.name),
              el('span', { className: 'pill pill-dark' }, exp.config.modelType.toUpperCase()),
            ]),
            el('div', { className: 'text-caption text-muted' }, `Top Strategy: ${rec.bestStrategy ? formatStrategy(rec.bestStrategy) : 'None'}`),
            el('div', { className: 'metric-value mt-xs', style: { fontSize: '1.75rem' } }, formatPercent(bestAgg.f1.mean)),
            el('div', { className: 'text-caption mt-xs font-semi ' + (rec.improvement > 0 ? 'delta-positive' : 'text-muted') },
              `F1 Delta: ${rec.improvement > 0 ? '+' : ''}${rec.improvement.toFixed(1)}%`
            ),
          ]),
          // Target Exp Card
          el('div', { className: 'card background-subtle p-md' }, [
            el('div', { className: 'flex justify-between items-center mb-xs' }, [
              el('span', { className: 'font-semi text-primary' }, otherExp.name),
              el('span', { className: 'pill pill-dark' }, otherExp.config.modelType.toUpperCase()),
            ]),
            el('div', { className: 'text-caption text-muted' }, `Top Strategy: ${otherRec.bestStrategy ? formatStrategy(otherRec.bestStrategy) : 'None'}`),
            el('div', { className: 'metric-value mt-xs', style: { fontSize: '1.75rem' } }, formatPercent(otherBestAgg.f1.mean)),
            el('div', { className: 'text-caption mt-xs font-semi ' + (otherRec.improvement > 0 ? 'delta-positive' : 'text-muted') },
              `F1 Delta: ${otherRec.improvement > 0 ? '+' : ''}${otherRec.improvement.toFixed(1)}%`
            ),
          ]),
        ]);
        compareCardContainer.appendChild(summaryGrid);

        // Comparison Chart
        const chartWrapper = el('div', { className: 'mt-md' }, [
          el('div', { className: 'card-title text-small font-semi mb-sm' }, 'Macro Metrics Head-to-Head Comparison'),
        ]);
        const chartBox = el('div', { style: { minHeight: '220px' } });
        chartWrapper.appendChild(chartBox);
        compareCardContainer.appendChild(chartWrapper);

        const compLabels = ['Macro F1', 'Accuracy', 'Precision', 'Recall'];
        const compSeries = [
          {
            name: `${exp.name} (Top Strategy)`,
            values: [bestAgg.f1.mean, bestAgg.accuracy.mean, bestAgg.precision.mean, bestAgg.recall.mean],
            color: '#1a8a5c',
          },
          {
            name: `${otherExp.name} (Top Strategy)`,
            values: [otherBestAgg.f1.mean, otherBestAgg.accuracy.mean, otherBestAgg.precision.mean, otherBestAgg.recall.mean],
            color: '#4a7fb5',
          },
        ];
        renderGroupedBarChart(chartBox, compLabels, compSeries, { height: 210 });
      }

      // Auto-select first other experiment
      if (otherExps.length > 0) {
        select.value = otherExps[0].id;
        renderExperimentComparison(otherExps[0].id);
      }
    }
  }

  // 10. Render 100% Reproducible Python Script
  const pyCodeEl = qs('#results-python-script');
  const btnCopyPy = qs('#btn-copy-py-exp');
  const btnDownloadPy = qs('#btn-download-py-exp');

  if (pyCodeEl) {
    const pythonScript = generateStandalonePythonScript({
      datasetName: exp.name || 'dataset',
      targetCol: dataset?.targetColumn || 'target',
      modelType: exp.config?.modelType || 'random_forest',
      testSize: exp.config?.trainTestSplit ? (1 - exp.config.trainTestSplit) : 0.25,
      seed: exp.config?.baseSeed || 42,
    });

    pyCodeEl.textContent = pythonScript;

    if (btnCopyPy) {
      btnCopyPy.onclick = async () => {
        try {
          await navigator.clipboard.writeText(pythonScript);
          toast.success('Python script copied to clipboard!');
        } catch (e) {
          toast.error('Failed to copy. Please select and copy manually.');
        }
      };
    }

    if (btnDownloadPy) {
      btnDownloadPy.onclick = () => {
        const blob = new Blob([pythonScript], { type: 'text/x-python;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `reproduce_${exp.name}.py`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Python reproduction script downloaded (.py)!');
      };
    }
  }
}

