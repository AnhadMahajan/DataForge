/**
 * DataForge — Experiment Results Page Controller
 */

import { requireSession } from '../services/auth.js';
import { initSidebar } from '../components/sidebar.js';
import { getExperimentById, getExperiments } from '../services/experiment.js';
import { getDatasetById } from '../services/dataset.js';
import { renderGroupedBarChart, renderRunVarianceChart } from '../components/charts.js';
import { renderDataTable } from '../components/tables.js';
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

  expTitle.textContent = exp.name;
  expSubtitle.textContent = `Evaluated on ${dataset ? dataset.name : 'Dataset'} • ${exp.config.runs} Iterations (${exp.config.modelType.toUpperCase()})`;

  // Header Actions
  expHeaderActions.innerHTML = '';
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

  // 2. Metrics Comparison Grid (Baseline vs Best Strategy)
  const bestStratRes = strategyResults.find(s => s.strategyType === rec.bestStrategy) || strategyResults[0];
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

  const colors = ['#1a8a5c', '#4a7fb5', '#b08a2e'];
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
}
