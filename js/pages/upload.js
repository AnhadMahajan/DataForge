/**
 * DataForge — Upload & Analysis Page Controller
 */

import { requireSession } from '../services/auth.js';
import { initSidebar } from '../components/sidebar.js';
import { createDropzone } from '../components/dropzone.js';
import { createDatasetFromCSV, getSampleDatasetCSV, getDatasets, getDatasetById } from '../services/dataset.js';
import { renderBarChart } from '../components/charts.js';
import { renderDataTable } from '../components/tables.js';
import { toast } from '../components/toast.js';
import { formatDimensions, formatRelativeTime } from '../utils/formatting.js';
import { el, qs, show, hide } from '../utils/dom.js';

const session = requireSession();
if (!session) {
  // redirect handled
}

initSidebar('sidebar');

const userId = session.userId;
const uploadState = qs('#upload-state');
const analysisState = qs('#analysis-state');
const headerActions = qs('#header-actions');
const dropzoneContainer = qs('#dropzone-container');
const btnLoadSample = qs('#btn-load-sample');
const historyList = qs('#datasets-history-list');

const pageTitle = qs('#page-title');
const pageSubtitle = qs('#page-subtitle');
const needScoreVal = qs('#need-score-val');
const needScoreSummary = qs('#need-score-summary');
const imbalancePill = qs('#imbalance-pill');
const classChartContainer = qs('#class-chart-container');
const metadataList = qs('#dataset-metadata-list');
const reasonsList = qs('#diagnostic-reasons-list');
const warningsList = qs('#diagnostic-warnings-list');
const previewContainer = qs('#preview-table-container');
const previewCountLabel = qs('#preview-count-label');

// Check URL query parameters for ?id={datasetId}
const urlParams = new URLSearchParams(window.location.search);
const datasetIdParam = urlParams.get('id');

if (datasetIdParam) {
  const existingDataset = getDatasetById(userId, datasetIdParam);
  if (existingDataset) {
    renderAnalysisView(existingDataset);
  } else {
    renderUploadView();
  }
} else {
  renderUploadView();
}

function renderUploadView() {
  show(uploadState);
  hide(analysisState);
  headerActions.innerHTML = '';
  pageTitle.textContent = 'Upload Dataset';
  pageSubtitle.textContent = 'Upload a CSV dataset or explore our built-in benchmark.';

  // Initialize dropzone
  createDropzone(dropzoneContainer, async (result) => {
    if (!result.success) {
      toast.error(result.error.message || 'Upload failed');
      return;
    }

    toast.info('Parsing and analyzing dataset...');
    const createRes = await createDatasetFromCSV(userId, result.name, result.content);
    if (createRes.success) {
      toast.success('Dataset analyzed successfully.');
      renderAnalysisView(createRes.data);
    } else {
      toast.error(createRes.error.message || 'Failed to process dataset.');
    }
  });

  // Sample dataset load button
  btnLoadSample.onclick = async () => {
    btnLoadSample.disabled = true;
    toast.info('Loading benchmark sample dataset...');
    const csv = getSampleDatasetCSV();
    const createRes = await createDatasetFromCSV(userId, 'customer_churn_benchmark.csv', csv, 'ChurnRisk');
    btnLoadSample.disabled = false;

    if (createRes.success) {
      toast.success('Benchmark dataset loaded.');
      renderAnalysisView(createRes.data);
    } else {
      toast.error('Failed to load sample dataset.');
    }
  };

  // Render past uploads list
  const datasets = getDatasets(userId);
  historyList.innerHTML = '';
  if (datasets.length === 0) {
    historyList.appendChild(el('div', { className: 'p-md text-muted text-small text-center' }, 'No previous datasets found.'));
  } else {
    datasets.forEach(ds => {
      const item = el('div', {
        className: 'dataset-item flex items-center justify-between p-md',
      }, [
        el('div', {}, [
          el('div', { className: 'font-semi text-primary' }, ds.name),
          el('div', { className: 'text-caption text-muted' }, `${formatDimensions(ds.rowCount, ds.columnCount)} • ${formatRelativeTime(ds.uploadedAt)}`),
        ]),
        el('button', {
          className: 'btn btn-secondary btn-sm',
          onClick: () => renderAnalysisView(ds),
        }, 'Inspect Analysis →'),
      ]);
      historyList.appendChild(item);
    });
  }
}

function renderAnalysisView(dataset) {
  hide(uploadState);
  show(analysisState);

  pageTitle.textContent = dataset.name;
  pageSubtitle.textContent = `Analyzed on ${new Date(dataset.uploadedAt).toLocaleDateString()}`;

  // Header Actions
  headerActions.innerHTML = '';
  const btnBack = el('button', {
    className: 'btn btn-secondary btn-sm',
    onClick: () => {
      window.history.pushState({}, '', 'upload.html');
      renderUploadView();
    },
  }, '← Upload Another');

  const btnStartExp = el('a', {
    className: 'btn btn-primary btn-sm',
    href: `experiment.html?datasetId=${dataset.id}`,
  }, 'Configure Experiment →');

  headerActions.appendChild(btnBack);
  headerActions.appendChild(btnStartExp);

  // Health Score & Analysis
  const analysis = dataset.analysisResult || {};
  const needScore = analysis.augmentationNeedScore || 0;
  needScoreVal.textContent = String(needScore);

  imbalancePill.textContent = `Imbalance Ratio: ${analysis.imbalanceRatio || 1}:1 (${analysis.imbalanceSeverity || 'none'})`;
  if (analysis.imbalanceSeverity === 'severe' || analysis.imbalanceSeverity === 'moderate') {
    imbalancePill.className = 'pill pill-negative mb-sm';
  } else {
    imbalancePill.className = 'pill pill-positive mb-sm';
  }

  needScoreSummary.textContent = needScore >= 60
    ? 'High augmentation potential: class imbalance and sample boundaries require synthetic oversampling.'
    : (needScore >= 30 ? 'Moderate potential: augmentation may yield marginal improvements in boundary resolution.' : 'Low augmentation need: dataset is well-balanced and representative.');

  // Render Class Balance Bar Chart
  if (dataset.classDistribution) {
    const chartData = Object.entries(dataset.classDistribution).map(([cls, count]) => ({
      label: cls,
      value: count,
      color: cls === analysis.minClass ? '#c43e3e' : '#333333',
    }));
    renderBarChart(classChartContainer, chartData, { height: 180 });
  }

  // Profile metadata
  metadataList.innerHTML = '';
  const metaItems = [
    ['Total Rows', dataset.rowCount],
    ['Feature Count', dataset.columnCount - 1],
    ['Target Column', dataset.targetColumn || 'None designated'],
    ['Missing Values', dataset.columns.reduce((acc, c) => acc + (c.stats.nullCount || 0), 0)],
  ];
  metaItems.forEach(([k, v]) => {
    metadataList.appendChild(el('div', { className: 'flex justify-between border-bottom py-xs text-small' }, [
      el('span', { className: 'text-muted' }, String(k)),
      el('span', { className: 'font-mono font-semi' }, String(v)),
    ]));
  });

  // Diagnostic Reasons List
  reasonsList.innerHTML = '';
  (analysis.augmentationReasons || []).forEach(r => {
    reasonsList.appendChild(el('div', { className: 'analysis-reason-item mb-sm' }, [
      el('span', { className: 'font-semi text-primary' }, '•'),
      el('span', {}, r),
    ]));
  });

  // Diagnostic Warnings List
  warningsList.innerHTML = '';
  const warnings = analysis.warnings || [];
  if (warnings.length === 0) {
    warningsList.appendChild(el('div', { className: 'text-small text-muted' }, 'No data health warnings detected.'));
  } else {
    warnings.forEach(w => {
      warningsList.appendChild(el('div', { className: 'analysis-reason-item mb-sm' }, [
        el('span', { className: 'font-semi delta-negative' }, '!'),
        el('span', {}, w),
      ]));
    });
  }

  // Preview Data Table
  previewCountLabel.textContent = `Showing top ${Math.min(20, dataset.sampleRows.length)} samples`;
  renderDataTable(previewContainer, dataset.headers, dataset.sampleRows.slice(0, 20), { pageSize: 10 });
}
