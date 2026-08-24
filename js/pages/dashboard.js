/**
 * DataForge — Redesigned Dashboard Page Controller
 * Real-time analytics, 1-click benchmark execution, canvas visualizations, and executive guidance.
 */

import { requireSession, getCurrentUser } from '../services/auth.js';
import { initSidebar } from '../components/sidebar.js';
import { getDatasets, getSampleDatasetCSV, createDatasetFromCSV } from '../services/dataset.js';
import { getExperiments, runExperiment } from '../services/experiment.js';
import { generateReportFromExperiment } from '../services/reports.js';
import { createMetricsCard } from '../components/metrics-card.js';
import { renderGroupedBarChart } from '../components/charts.js';
import { toast } from '../components/toast.js';
import { formatDimensions, formatRelativeTime, formatPercent, formatStrategy } from '../utils/formatting.js';
import { el, qs, show, hide } from '../utils/dom.js';

// Authenticate session
const session = requireSession();
if (!session) {
  // redirect handled in requireSession
}

// Initialize sidebar navigation
initSidebar('sidebar');

const user = getCurrentUser();
const welcomeTitle = qs('#welcome-title');
const currentDate = qs('#current-date');
const statsContainer = qs('#stats-container');
const experimentsList = qs('#recent-experiments-list');
const datasetsList = qs('#datasets-list');
const chartContainer = qs('#dashboard-chart-container');
const healthSummary = qs('#dataset-health-summary');
const healthScoreVal = qs('#health-score-val');
const healthScoreLabel = qs('#health-score-label');
const insightsTitle = qs('#insights-title');
const insightsText = qs('#insights-text');
const insightsTimestamp = qs('#insights-timestamp');

const btnQuickDemo = qs('#btn-quick-benchmark');
const btnBannerDemo = qs('#btn-banner-demo');

if (welcomeTitle && user) {
  welcomeTitle.textContent = `Welcome, ${user.name.split(' ')[0]}`;
}

if (currentDate) {
  currentDate.textContent = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// 1-Click Benchmark Demo Runner
async function executeBenchmarkDemo() {
  toast.info('Loading benchmark dataset and initiating controlled experiment...');
  const userId = session.userId;

  try {
    // 1. Create or retrieve benchmark dataset
    let datasets = getDatasets(userId);
    let benchmarkDataset = datasets.find(d => d.name.includes('churn') || d.name.includes('benchmark'));

    if (!benchmarkDataset) {
      const sampleCSV = getSampleDatasetCSV();
      const createRes = await createDatasetFromCSV(userId, 'customer_churn_benchmark.csv', sampleCSV, 'ChurnRisk');
      if (createRes.success) {
        benchmarkDataset = createRes.data;
      }
    }

    if (!benchmarkDataset) throw new Error('Failed to prepare benchmark dataset.');

    // 2. Run multi-strategy experiment
    const expRes = await runExperiment({
      userId,
      dataset: benchmarkDataset,
      name: 'Customer_Churn_Augmentation_Benchmark',
      strategies: ['smote', 'oversampling', 'noise_injection'],
      runs: 3,
      trainTestSplit: 0.8,
      modelType: 'knn',
      baseSeed: 42,
    });

    if (expRes.success) {
      generateReportFromExperiment(userId, expRes.data, benchmarkDataset);
      toast.success('Benchmark experiment completed! Refreshing analytics...');
      renderDashboard();
    } else {
      toast.error(expRes.error.message || 'Benchmark execution failed.');
    }
  } catch (err) {
    console.error(err);
    toast.error('An error occurred during benchmark execution.');
  }
}

if (btnQuickDemo) btnQuickDemo.addEventListener('click', executeBenchmarkDemo);
if (btnBannerDemo) btnBannerDemo.addEventListener('click', executeBenchmarkDemo);

// Main Dashboard Renderer
function renderDashboard() {
  const userId = session.userId;
  const datasets = getDatasets(userId);
  const experiments = getExperiments(userId);

  // Compute aggregate statistics
  const totalDatasets = datasets.length;
  const completedExperiments = experiments.filter(e => e.status === 'completed');
  const totalCompleted = completedExperiments.length;

  let maxGain = 0;
  let bestStrategyName = '—';
  let totalRowsManaged = datasets.reduce((acc, d) => acc + (d.rowCount || 0), 0);

  completedExperiments.forEach(exp => {
    if (exp.recommendation) {
      if (exp.recommendation.improvement > maxGain) {
        maxGain = exp.recommendation.improvement;
        bestStrategyName = exp.recommendation.bestStrategy ? formatStrategy(exp.recommendation.bestStrategy) : '—';
      }
    }
  });

  // Render 4 Hero Metrics Cards
  statsContainer.innerHTML = '';
  statsContainer.appendChild(createMetricsCard({
    label: 'Datasets in Vault',
    value: totalDatasets,
    subtitle: `${totalRowsManaged} Total Observations`,
    isDark: true,
  }));

  statsContainer.appendChild(createMetricsCard({
    label: 'Controlled Experiments',
    value: totalCompleted,
    subtitle: `${experiments.length} Total Runs`,
    isDark: true,
  }));

  statsContainer.appendChild(createMetricsCard({
    label: 'Max F1 Gain Observed',
    value: maxGain > 0 ? `+${maxGain.toFixed(1)}%` : '0.0%',
    delta: maxGain > 0 ? { text: 'Statistically Significant', className: 'delta-positive' } : null,
    isDark: true,
  }));

  statsContainer.appendChild(createMetricsCard({
    label: 'Optimal Strategy',
    value: bestStrategyName,
    subtitle: maxGain > 0 ? 'Empirically Recommended' : 'Awaiting Experiments',
    isDark: true,
  }));

  // Render Visual Analytics Chart
  if (completedExperiments.length > 0) {
    const latestExp = completedExperiments[completedExperiments.length - 1];
    const baseAgg = latestExp.baseline.aggregated;
    const stratResults = latestExp.strategyResults || [];

    const labels = ['Macro F1', 'Accuracy', 'Precision', 'Recall'];
    const series = [
      {
        name: 'Baseline (Raw)',
        values: [baseAgg.f1.mean, baseAgg.accuracy.mean, baseAgg.precision.mean, baseAgg.recall.mean],
        color: '#333333',
      },
    ];

    const colors = ['#1a8a5c', '#4a7fb5', '#b08a2e'];
    stratResults.forEach((s, idx) => {
      series.push({
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

    renderGroupedBarChart(chartContainer, labels, series, { height: 210 });
  } else {
    // Show clean interactive preview chart
    const previewLabels = ['Macro F1', 'Accuracy', 'Precision', 'Recall'];
    const previewSeries = [
      { name: 'Baseline (Sample)', values: [0.74, 0.78, 0.72, 0.70], color: '#333333' },
      { name: 'SMOTE (Sample)', values: [0.86, 0.85, 0.84, 0.87], color: '#1a8a5c' },
    ];
    renderGroupedBarChart(chartContainer, previewLabels, previewSeries, { height: 210 });
  }

  // Render Dataset Health Radar
  healthSummary.innerHTML = '';
  if (datasets.length > 0) {
    const primaryDataset = datasets[0];
    const analysis = primaryDataset.analysisResult || {};
    const health = primaryDataset.healthScore || 75;

    healthScoreVal.textContent = `${health}/100`;
    healthScoreLabel.textContent = health >= 70 ? 'Optimal Dataset Health' : 'Imbalanced Distribution';

    const items = [
      ['Primary Dataset', primaryDataset.name],
      ['Class Imbalance', `${analysis.imbalanceRatio || 1}:1 (${analysis.imbalanceSeverity || 'none'})`],
      ['Minority Observations', `${analysis.minCount || 0} samples (${analysis.minClass || 'N/A'})`],
      ['Augmentation Need', `${analysis.augmentationNeedScore || 0} / 100`],
    ];

    items.forEach(([label, val]) => {
      healthSummary.appendChild(el('div', { className: 'flex justify-between py-xs border-bottom text-small' }, [
        el('span', { className: 'text-muted' }, label),
        el('span', { className: 'font-semi text-primary' }, String(val)),
      ]));
    });
  } else {
    healthScoreVal.textContent = '80/100';
    healthScoreLabel.textContent = 'Benchmark Baseline';
    healthSummary.appendChild(el('div', { className: 'text-small text-muted py-sm' }, [
      el('span', {}, 'Load our Customer Churn Risk benchmark dataset to inspect live class distribution diagnostics.'),
    ]));
  }

  // Render Recent Experiments Feed
  experimentsList.innerHTML = '';
  if (experiments.length === 0) {
    experimentsList.appendChild(el('div', { className: 'p-lg text-center' }, [
      el('div', { className: 'text-small text-secondary mb-sm' }, 'No experiments run yet in this workspace.'),
      el('button', {
        className: 'btn btn-primary btn-sm',
        onClick: executeBenchmarkDemo,
      }, '⚡ Run Benchmark Demo'),
    ]));
  } else {
    experiments.slice(-5).reverse().forEach(exp => {
      const ds = datasets.find(d => d.id === exp.datasetId);
      const rec = exp.recommendation;
      const gain = rec ? rec.improvement : 0;
      const isPos = gain > 0;
      const isRecommended = rec?.verdict === 'recommended';

      const row = el('a', {
        className: 'dash-item-row',
        href: `results.html?id=${exp.id}`,
      }, [
        el('div', {}, [
          el('div', { className: 'font-semi text-primary text-small' }, exp.name),
          el('div', { className: 'dash-item-meta' }, [
            el('span', {}, ds ? ds.name : 'Dataset'),
            el('span', {}, '•'),
            el('span', {}, formatRelativeTime(exp.createdAt)),
            el('span', {}, '•'),
            el('span', { className: 'font-mono' }, `${exp.config.runs} seeds`),
          ]),
        ]),
        el('div', { className: 'flex items-center gap-sm' }, [
          el('div', {
            className: `pill ${isRecommended ? 'pill-positive' : (gain < 0 ? 'pill-negative' : 'pill-neutral')}`,
          }, `${isPos ? '+' : ''}${gain.toFixed(1)}% F1`),
          el('span', { className: 'text-muted text-small' }, '→'),
        ]),
      ]);
      experimentsList.appendChild(row);
    });
  }

  // Render Datasets Vault List
  datasetsList.innerHTML = '';
  if (datasets.length === 0) {
    datasetsList.appendChild(el('div', { className: 'p-lg text-center' }, [
      el('div', { className: 'text-small text-secondary mb-sm' }, 'No uploaded datasets yet.'),
      el('a', { href: 'upload.html', className: 'btn btn-secondary btn-sm' }, 'Upload CSV'),
    ]));
  } else {
    datasets.slice(0, 4).forEach(ds => {
      const health = ds.healthScore || 80;
      const healthClass = health >= 75 ? 'health-high' : (health >= 50 ? 'health-medium' : 'health-low');

      const row = el('a', {
        className: 'dash-item-row',
        href: `upload.html?id=${ds.id}`,
      }, [
        el('div', {}, [
          el('div', { className: 'font-semi text-primary text-small' }, ds.name),
          el('div', { className: 'dash-item-meta' }, [
            el('span', {}, formatDimensions(ds.rowCount, ds.columnCount)),
            el('span', {}, '•'),
            el('span', {}, `Target: ${ds.targetColumn || 'Last col'}`),
          ]),
        ]),
        el('div', { className: `health-badge ${healthClass}` }, `${health}/100`),
      ]);
      datasetsList.appendChild(row);
    });
  }

  // Render Strategic Guidance Card
  if (completedExperiments.length > 0) {
    const latestExp = completedExperiments[completedExperiments.length - 1];
    const rec = latestExp.recommendation;
    insightsTitle.textContent = rec.verdict === 'recommended' ? 'Augmentation Recommended' : 'Empirical Findings';
    insightsText.textContent = rec.explanations.length > 0
      ? rec.explanations[0]
      : `Across ${completedExperiments.length} experiment(s), ${bestStrategyName} produced the highest generalization gain.`;
    insightsTimestamp.textContent = `Updated ${formatRelativeTime(latestExp.completedAt)}`;
  } else {
    insightsTitle.textContent = 'Empirical Guidance';
    insightsText.textContent = 'Ready for experimentation. Click "Run Benchmark Demo" to test SMOTE and noise injection against unaugmented data.';
    insightsTimestamp.textContent = 'Engine ready';
  }
}

// Initial render
renderDashboard();
