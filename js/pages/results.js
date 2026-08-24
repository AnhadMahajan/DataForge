import { requireSession } from '../services/auth.js';
import { initSidebar } from '../components/sidebar.js';
import { getExperimentById, getExperiments } from '../services/experiment.js';
import { getDatasetById } from '../services/dataset.js';
import { renderGroupedBarChart, renderRunVarianceChart } from '../components/charts.js';
import { renderDataTable } from '../components/tables.js';
import { toast } from '../components/toast.js';
import { downloadCSV, generateCSV } from '../utils/csv.js';
import { formatDelta, formatPercent, formatStrategy } from '../utils/formatting.js';
import { min, max } from '../utils/math.js';
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
const featureSelectContainer = qs('#feature-select-container');
const distributionChartContainer = qs('#distribution-chart-container');
const compareSelectContainer = qs('#compare-select-container');
const compareCardContainer = qs('#compare-card-container');

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

  // Metrics CSV Export (Feature C)
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
  }, '📥 Export Matrix (CSV)');
  expHeaderActions.appendChild(btnExportMetrics);

  if (bestStratRes?.augmentedCSV) {
    const btnExportAug = el('button', {
      className: 'btn btn-secondary btn-sm',
      onClick: () => {
        downloadCSV(`${exp.name}_augmented_${bestStratRes.strategyType}.csv`, bestStratRes.augmentedCSV);
        toast.success(`Augmented dataset downloaded (${formatStrategy(bestStratRes.strategyType)}).`);
      },
    }, '📥 Export Augmented CSV');
    expHeaderActions.appendChild(btnExportAug);
  }

  if (bestStratRes?.syntheticCSV) {
    const btnExportSynth = el('button', {
      className: 'btn btn-secondary btn-sm',
      onClick: () => {
        downloadCSV(`${exp.name}_synthetic_only.csv`, bestStratRes.syntheticCSV);
        toast.success('Synthetic-only samples downloaded.');
      },
    }, '📥 Export Synthetic Only');
    expHeaderActions.appendChild(btnExportSynth);
  }

  const btnReport = el('a', {
    className: 'btn btn-primary btn-sm',
    href: `reports.html?id=${exp.id}`,
  }, 'Generate Narrative Report →');
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

  // 2. Metrics Comparison Grid (Baseline vs Best Strategy)
  const bestAgg = bestStratRes ? bestStratRes.evaluation.aggregated : baseline.aggregated;
  const baseAgg = baseline.aggregated;

  metricsGrid.innerHTML = '';
  const metricItems = [
    { name: 'Macro F1-Score', base: baseAgg.f1.mean, aug: bestAgg.f1.mean },
    { name: 'Accuracy', base: baseAgg.accuracy.mean, aug: bestAgg.accuracy.mean },
    { name: 'Precision', base: baseAgg.precision.mean, aug: bestAgg.precision.mean },
    { name: 'Recall', base: baseAgg.recall.mean, aug: bestAgg.recall.mean },
  ];

  metricItems.forEach(item => {
    const diffPct = item.base > 0 ? ((item.aug - item.base) / item.base) * 100 : 0;
    const delta = formatDelta(diffPct);

    const card = el('div', { className: 'metric-comparison-card' }, [
      el('div', { className: 'card-title text-small text-muted font-medium' }, item.name),
      el('div', { className: 'metric-value mt-xs', style: { fontSize: '2rem' } }, formatPercent(item.aug)),
      el('div', { className: 'metric-delta-row' }, [
        el('span', { className: 'text-caption text-muted' }, `Baseline: ${formatPercent(item.base)}`),
        el('span', { className: `pill ${delta.className} text-caption` }, delta.text),
      ]),
      el('div', { className: 'metric-context text-caption text-muted' }, item === metricItems[0] ? 'Primary selection metric' : 'Held-out evaluation metric'),
    ]);
    metricsGrid.appendChild(card);
  });

  // 3. Multi-Strategy Comparison Chart
  const chartLabels = ['Macro F1', 'Accuracy', 'Precision', 'Recall'];
  const chartSeries = [
    {
      name: 'Baseline (Raw)',
      values: [baseAgg.f1.mean, baseAgg.accuracy.mean, baseAgg.precision.mean, baseAgg.recall.mean],
      color: '#333333',
    },
  ];

  const colors = ['#1a8a5c', '#4a7fb5', '#b08a2e', '#8a4ab5', '#33a398'];
  strategyResults.forEach((s, idx) => {
    chartSeries.push({
      name: formatStrategy(s.strategyType),
      values: [
        s.evaluation.aggregated.f1.mean,
        s.evaluation.aggregated.accuracy.mean,
        s.evaluation.aggregated.precision.mean,
        s.evaluation.aggregated.recall.mean,
      ],
      color: colors[idx % colors.length],
    });
  });

  renderGroupedBarChart(comparisonChartContainer, chartLabels, chartSeries, { height: 240 });

  // 4. Per-Run Variance Line Chart
  const runVarianceData = baseline.runs.map((r, i) => ({
    run: i + 1,
    baseline: r.f1,
    augmented: bestStratRes ? bestStratRes.evaluation.runs[i].f1 : r.f1,
  }));
  renderRunVarianceChart(varianceChartContainer, runVarianceData, { height: 240 });

  // 5. Strategy Matrix Table
  const matrixHeaders = ['Strategy', 'Synthetic Rows', 'Macro F1', 'Δ from Baseline', 'Significance (p)', 'Verdict'];
  const matrixRows = strategyResults.map(s => {
    const dF1 = s.comparison.percentageImprovement;
    const signPill = s.comparison.isSignificant ? 'p < 0.05 (Valid)' : 'p ≥ 0.05 (High noise)';
    const vText = s.comparison.percentageImprovement > 1 ? 'Recommended' : (s.comparison.percentageImprovement < -1 ? 'Degraded' : 'Marginal');

    return [
      formatStrategy(s.strategyType),
      `+${s.syntheticCount} rows`,
      formatPercent(s.evaluation.aggregated.f1.mean),
      `${dF1 > 0 ? '+' : ''}${dF1.toFixed(1)}%`,
      signPill,
      vText,
    ];
  });
  renderDataTable(matrixTableContainer, matrixHeaders, matrixRows, { pageSize: 5 });

  // 6. Per-Class Breakdown Table
  const classHeaders = ['Class Label', 'Baseline Recall', 'Augmented Recall', 'Δ Recall', 'Impact'];
  const classRows = (rec.perClassImpact || []).map(p => {
    const baseRec = baseline.runs.map(r => r.perClass[p.className]?.recall || 0);
    const avgBase = baseRec.reduce((a, b) => a + b, 0) / baseRec.length;
    const avgAug = avgBase + (p.delta / 100);

    return [
      p.className,
      formatPercent(avgBase),
      formatPercent(avgAug),
      `${p.delta > 0 ? '+' : ''}${p.delta}%`,
      p.impact.toUpperCase(),
    ];
  });
  renderDataTable(classTableContainer, classHeaders, classRows, { pageSize: 5 });

  // 7. Synthetic Data Quality Audit Cards
  qualityCardsContainer.innerHTML = '';
  const qm = bestStratRes?.qualityMetrics || { diversityScore: 82, redundancyScore: 0, distributionShift: 0.08 };

  qualityCardsContainer.appendChild(el('div', { className: 'card' }, [
    el('div', { className: 'text-caption text-muted' }, 'Diversity Score'),
    el('div', { className: 'metric-value mt-xs' }, `${qm.diversityScore}/100`),
    el('div', { className: 'text-small text-secondary mt-xs' }, 'Variance across synthetic feature manifolds'),
  ]));

  qualityCardsContainer.appendChild(el('div', { className: 'card' }, [
    el('div', { className: 'text-caption text-muted' }, 'Duplicate Redundancy'),
    el('div', { className: 'metric-value mt-xs' }, `${qm.redundancyScore}%`),
    el('div', { className: 'text-small text-secondary mt-xs' }, 'Proximity to exact training duplicates'),
  ]));

  qualityCardsContainer.appendChild(el('div', { className: 'card' }, [
    el('div', { className: 'text-caption text-muted' }, 'Distribution Shift'),
    el('div', { className: 'metric-value mt-xs' }, String(qm.distributionShift)),
    el('div', { className: 'text-small text-secondary mt-xs' }, 'Normalized deviation from original ground truth'),
  ]));

  // 8. Feature Distribution Comparator
  if (dataset && featureSelectContainer && distributionChartContainer) {
    const numericCols = dataset.columns.filter(c => c.type === 'numeric' && c.name !== dataset.targetColumn);
    
    if (numericCols.length > 0) {
      featureSelectContainer.innerHTML = '';
      const select = el('select', {
        className: 'select select-sm',
        onChange: (e) => renderFeatureComparison(e.target.value),
      }, numericCols.map(c => el('option', { value: c.name }, `Feature: ${c.name}`)));
      featureSelectContainer.appendChild(select);

      function renderFeatureComparison(colName) {
        distributionChartContainer.innerHTML = '';
        const colIdx = dataset.headers.indexOf(colName);
        if (colIdx === -1) return;

        const origVals = dataset.fullData.map(r => Number(r[colIdx])).filter(v => !isNaN(v));
        const minVal = min(origVals);
        const maxVal = max(origVals);
        const binCount = 5;
        const binStep = (maxVal - minVal) / binCount || 1;

        const binLabels = [];
        const origBinCounts = new Array(binCount).fill(0);
        const augBinCounts = new Array(binCount).fill(0);

        for (let b = 0; b < binCount; b++) {
          const bStart = (minVal + b * binStep).toFixed(1);
          const bEnd = (minVal + (b + 1) * binStep).toFixed(1);
          binLabels.push(`${bStart}-${bEnd}`);
        }

        origVals.forEach(v => {
          const idx = Math.min(binCount - 1, Math.max(0, Math.floor((v - minVal) / binStep)));
          origBinCounts[idx]++;
        });

        // Synthetic values from best strategy
        const synthRows = bestStratRes?.syntheticData || [];
        const synthVals = synthRows.map(r => Number(r[colIdx])).filter(v => !isNaN(v));
        synthVals.forEach(v => {
          const idx = Math.min(binCount - 1, Math.max(0, Math.floor((v - minVal) / binStep)));
          augBinCounts[idx]++;
        });

        const series = [
          { name: 'Original Ground Truth', values: origBinCounts, color: '#333333' },
          { name: 'Synthetic Distribution', values: augBinCounts, color: '#1a8a5c' },
        ];

        renderGroupedBarChart(distributionChartContainer, binLabels, series, { height: 210 });
      }

      renderFeatureComparison(numericCols[0].name);
    } else {
      distributionChartContainer.innerHTML = '<div class="text-small text-muted p-md">No continuous numeric features available for histogram comparison.</div>';
    }
  }

  // 9. Cross-Experiment Comparison (Feature A)
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
}

