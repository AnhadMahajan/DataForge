import { requireSession } from '../services/auth.js';
import { initSidebar } from '../components/sidebar.js';
import { createDropzone } from '../components/dropzone.js';
import {
  createDatasetFromCSV,
  getSampleDatasetCSV,
  getDatasets,
  getDatasetById,
  updateDatasetTarget,
  exportDatasetAsCSV,
  validateForPipeline,
  cleanDataset,
} from '../services/dataset.js';
import * as storage from '../services/storage.js';
import { renderBarChart, renderCorrelationHeatmap } from '../components/charts.js';
import { renderDataTable } from '../components/tables.js';
import { toast } from '../components/toast.js';
import { downloadCSV } from '../utils/csv.js';
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
const targetSelectContainer = qs('#target-select-container');
const reasonsList = qs('#diagnostic-reasons-list');
const warningsList = qs('#diagnostic-warnings-list');
const heatmapContainer = qs('#correlation-heatmap-container');
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

  const btnExportCSV = el('button', {
    className: 'btn btn-secondary btn-sm',
    onClick: () => {
      const csvStr = exportDatasetAsCSV(dataset);
      downloadCSV(`${dataset.name}_clean.csv`, csvStr);
      toast.success('Dataset CSV exported.');
    },
  }, '📥 Export CSV');

  // Pipeline Pre-flight Validation
  const validation = validateForPipeline(dataset);
  const totalMissing = dataset.columns.reduce((acc, c) => acc + (c.stats.nullCount || 0), 0);

  if (totalMissing > 0) {
    const btnClean = el('button', {
      className: 'btn btn-secondary btn-sm',
      onClick: async () => {
        toast.info('Auto-cleaning missing values and outliers...');
        const cleanRes = cleanDataset(dataset);
        dataset.fullData = cleanRes.cleanedData;
        dataset.sampleRows = cleanRes.cleanedData.slice(0, 100);
        dataset.rowCount = cleanRes.cleanedRowCount;

        // Recompute stats on cleaned columns
        const { analyzeDataset } = await import('../services/analysis.js');
        dataset.columns.forEach((col, colIdx) => {
          const colVals = dataset.fullData.map(r => r[colIdx]).filter(v => v !== null && v !== undefined && v !== '');
          col.stats.nullCount = dataset.rowCount - colVals.length;
        });

        const reAnalysis = analyzeDataset(dataset);
        dataset.analysisResult = reAnalysis;
        dataset.healthScore = Math.max(0, 100 - reAnalysis.augmentationNeedScore);

        const storageKey = `datasets_${userId}`;
        storage.updateInCollection(storageKey, dataset.id, dataset);
        toast.success(`Dataset cleaned! ${cleanRes.cleanLog.length} operations performed.`);
        renderAnalysisView(dataset);
      },
    }, `🧹 Auto-Clean (${totalMissing} missing)`);
    headerActions.appendChild(btnClean);
  }

  const btnStartExp = el('a', {
    className: `btn ${validation.valid ? 'btn-primary' : 'btn-secondary'} btn-sm`,
    href: `experiment.html?datasetId=${dataset.id}`,
  }, validation.valid ? 'Configure Experiment →' : '⚠️ Configure Experiment →');

  headerActions.appendChild(btnBack);
  headerActions.appendChild(btnExportCSV);
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
  classChartContainer.innerHTML = '';
  if (dataset.classDistribution) {
    const chartData = Object.entries(dataset.classDistribution).map(([cls, count]) => ({
      label: cls,
      value: count,
      color: cls === analysis.minClass ? '#c43e3e' : '#333333',
    }));
    renderBarChart(classChartContainer, chartData, { height: 180 });
  }

  // Render Target Column Dropdown selector
  if (targetSelectContainer) {
    targetSelectContainer.innerHTML = '';
    const select = el('select', {
      className: 'select select-sm',
      onChange: (e) => {
        const newTarget = e.target.value;
        const updateRes = updateDatasetTarget(userId, dataset.id, newTarget);
        if (updateRes.success) {
          toast.success(`Target column switched to "${newTarget}". Diagnostics updated.`);
          renderAnalysisView(updateRes.data);
        }
      },
    }, dataset.headers.map(h => el('option', {
      value: h,
      selected: h === dataset.targetColumn,
    }, `Target: ${h}`)));
    targetSelectContainer.appendChild(select);
  }

  // Profile metadata
  metadataList.innerHTML = '';
  const numCols = dataset.columns.filter(c => c.type === 'numeric').length;
  const catCols = dataset.columns.filter(c => c.type !== 'numeric').length;
  const idColNames = (analysis.idIndices || []).map(idx => dataset.headers[idx]).join(', ');

  const metaItems = [
    ['Total Rows', dataset.rowCount],
    ['Numeric Features', numCols],
    ['Categorical Features', catCols],
    ['Auto-detected ID Columns', idColNames || 'None'],
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
  const warnings = [...(analysis.warnings || [])];
  if (validation.issues) {
    validation.issues.forEach(iss => {
      warnings.push(`[${iss.severity.toUpperCase()}] ${iss.message}`);
    });
  }

  if (warnings.length === 0) {
    warningsList.appendChild(el('div', { className: 'text-small text-muted' }, 'No data health warnings detected. Dataset is 100% pipeline ready!'));
  } else {
    warnings.forEach(w => {
      const isErr = w.startsWith('[ERROR]');
      warningsList.appendChild(el('div', { className: 'analysis-reason-item mb-sm' }, [
        el('span', { className: `font-semi ${isErr ? 'delta-negative' : 'text-primary'}` }, isErr ? '✕' : '!'),
        el('span', { className: isErr ? 'font-semi' : '' }, w),
      ]));
    });
  }

  // Render Correlation Matrix Heatmap
  if (heatmapContainer) {
    const numIndices = analysis.numericIndices || [];
    const numFeatures = numIndices.map(idx => dataset.headers[idx]);
    const numCount = numFeatures.length;

    if (numCount >= 2) {
      const matrix = Array.from({ length: numCount }, () => Array(numCount).fill(1));
      const corrs = analysis.correlations || [];

      for (let i = 0; i < numCount; i++) {
        for (let j = 0; j < numCount; j++) {
          if (i === j) {
            matrix[i][j] = 1;
          } else {
            const f1 = numFeatures[i];
            const f2 = numFeatures[j];
            const found = corrs.find(c => (c.feature1 === f1 && c.feature2 === f2) || (c.feature1 === f2 && c.feature2 === f1));
            matrix[i][j] = found ? found.coefficient : 0;
          }
        }
      }

      renderCorrelationHeatmap(heatmapContainer, numFeatures, matrix);
    } else {
      heatmapContainer.innerHTML = '<div class="text-small text-muted p-md text-center">Need at least 2 numeric features to generate correlation matrix.</div>';
    }
  }

  // Preview Data Table
  previewCountLabel.textContent = `Showing top ${Math.min(20, dataset.sampleRows.length)} samples`;
  renderDataTable(previewContainer, dataset.headers, dataset.sampleRows.slice(0, 20), { pageSize: 10 });
}
